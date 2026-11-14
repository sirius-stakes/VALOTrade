/**
 * Liquipedia (VALORANT) から移籍・ロスター情報を取得してローカル SQLite を更新する。
 *
 * 実行:
 *   npm run update
 *   npm run update -- --dry-run --verbose
 *   npm run update -- --fixture=scripts/fixtures/liquipedia-transfers.html
 *
 * Liquipedia の利用規約に合わせ、以下を必ず守る:
 *  - 独自の User-Agent と連絡先を設定する（未設定だと 403 になる）
 *  - リクエスト間は最低 2.5 秒あける
 *  - 失敗時に captcha / Turnstile を回避するような処理は行わない
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  PrismaClient,
  type PlayerStatus,
  type TransferType,
} from "@prisma/client";
import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

import {
  TARGET_TEAMS,
  canonicalTargetTeamName,
  isTargetTeamName,
} from "../src/lib/target-teams";

process.env.DATABASE_URL ??= "file:./dev.db";

const prisma = new PrismaClient();

const BASE_URL = "https://liquipedia.net";
const TRANSFER_PORTAL_URL = `${BASE_URL}/valorant/Portal:Transfers`;
const DEFAULT_USER_AGENT =
  "ValorantRosterTracker/1.0 (local-personal-tool; contact@example.com)";
const USER_AGENT =
  process.env.LIQUIPEDIA_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
const MIN_REQUEST_INTERVAL_MS = 2500;

const ROLE_PATTERN =
  /\b(Duelist|Initiator|Controller|Sentinel|IGL|Flex|Coach|Analyst|Manager)\b/i;

type CliOptions = {
  dryRun: boolean;
  verbose: boolean;
  debug: boolean;
  fetchTeams: boolean;
  fixture?: string;
  url: string;
  limit: number;
  timeoutMs: number;
  delayMs: number;
};

type ParsedTransfer = {
  playerHandle: string;
  playerCountry: string | null;
  fromTeamName: string | null;
  toTeamName: string | null;
  role: string | null;
  type: TransferType;
  eventDate: string;
  sourceUrl: string;
  sourceTitle: string;
  rawText: string;
  dedupeKey: string;
};

type ParseResult = {
  events: ParsedTransfer[];
  warnings: string[];
  tablesScanned: number;
};

type ApplyStats = {
  events: number;
  inserted: number;
  updated: number;
  membershipsCreated: number;
  membershipsClosed: number;
  playersCreated: number;
  teamsCreated: number;
  skipped: number;
  warnings: string[];
};

type TeamPage = {
  name: string;
  shortName: string;
  page: string;
  accent: string;
};

/**
 * 取得対象は ZETA / DFM / FENNEL / QTnet DISCONNECT の 4 チームのみ。
 * Portal:Transfers のページ名は Liquipedia の記事名と一致させる。
 */
const JP_TEAM_PAGES: TeamPage[] = TARGET_TEAMS.map((team) => ({
  name: team.name,
  shortName: team.shortName,
  page: team.liquipediaPage,
  accent: team.accent,
}));

const MONTHS: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function parseArgs(argv: string[]): CliOptions {
  const hasFlag = (name: string) => argv.includes(`--${name}`);
  const getOption = (name: string) => {
    const withEquals = argv.find((arg) => arg.startsWith(`--${name}=`));
    if (withEquals) return withEquals.slice(name.length + 3);

    const index = argv.indexOf(`--${name}`);
    if (index >= 0) return argv[index + 1];
    return undefined;
  };

  const delayMs = Math.max(
    MIN_REQUEST_INTERVAL_MS,
    Number.parseInt(
      getOption("delay") ?? process.env.LIQUIPEDIA_DELAY_MS ?? "2500",
      10,
    ) || MIN_REQUEST_INTERVAL_MS,
  );

  return {
    dryRun: hasFlag("dry-run"),
    verbose: hasFlag("verbose"),
    debug: hasFlag("debug"),
    fetchTeams: hasFlag("teams"),
    fixture: getOption("fixture"),
    url: getOption("url") ?? TRANSFER_PORTAL_URL,
    limit: Math.max(1, Number.parseInt(getOption("limit") ?? "150", 10) || 150),
    timeoutMs:
      Number.parseInt(getOption("timeout") ?? "20000", 10) || 20000,
    delayMs,
  };
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function clean(value: string | undefined | null) {
  return (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function absoluteUrl(href: string | undefined, base: string) {
  if (!href) return null;
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function validDate(year: number, month: number, day?: number) {
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (year < 2010 || year > 2100 || month < 1 || month > 12) return null;

  if (day == null) {
    return `${year}-${pad(month)}`;
  }
  if (day < 1 || day > 31) {
    return `${year}-${pad(month)}`;
  }
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Liquipedia の日付表記を YYYY-MM-DD / YYYY-MM に正規化する。
 * data-sort-value / data-timestamp があれば優先する。
 */
export function normalizeDate(
  rawText: string,
  sortValue?: string | null,
  now = new Date(),
) {
  const raw = clean(rawText);
  const sort = clean(sortValue);

  const sortMatch =
    /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(sort) ??
    /^(\d{4})\/(\d{1,2})(?:\/(\d{1,2}))?$/.exec(sort);
  if (sortMatch) {
    return validDate(
      Number(sortMatch[1]),
      Number(sortMatch[2]),
      sortMatch[3] ? Number(sortMatch[3]) : undefined,
    );
  }

  const iso = /(\d{4})[-./年](\d{1,2})(?:[-./月](\d{1,2}))?/.exec(raw);
  if (iso) {
    return validDate(
      Number(iso[1]),
      Number(iso[2]),
      iso[3] ? Number(iso[3]) : undefined,
    );
  }

  const us = /\b(\d{1,2})[-./](\d{1,2})[-./](\d{4})\b/.exec(raw);
  if (us) {
    return validDate(Number(us[3]), Number(us[1]), Number(us[2]));
  }

  const monthFirst =
    /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i.exec(
      raw,
    );
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].toLowerCase()];
    if (month) {
      return validDate(Number(monthFirst[3]), month, Number(monthFirst[2]));
    }
  }

  const dayFirst =
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})\b/i.exec(
      raw,
    );
  if (dayFirst) {
    const month = MONTHS[dayFirst[2].toLowerCase()];
    if (month) {
      return validDate(Number(dayFirst[3]), month, Number(dayFirst[1]));
    }
  }

  // 年なし表記（ポータル上部の「直近の移籍」で使われることがある）
  const monthDay =
    /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/i.exec(raw);
  if (monthDay) {
    const month = MONTHS[monthDay[1].toLowerCase()];
    if (month) {
      const day = Number(monthDay[2]);
      const candidate = new Date(
        Date.UTC(now.getUTCFullYear(), month - 1, day),
      );
      const year =
        candidate.getTime() - now.getTime() > 1000 * 60 * 60 * 24 * 45
          ? now.getUTCFullYear() - 1
          : now.getUTCFullYear();
      return validDate(year, month, day);
    }
  }

  return null;
}

function classifyTransfer(value: string): TransferType | null {
  const text = value.toLowerCase();
  if (!text.trim()) return null;

  if (/\blft\b|looking\s+for\s+team|移籍先募集/.test(text)) return "LFT";
  if (/\bfree\s*agent\b|\bfa\b|フリーエージェント/.test(text)) return "FA";
  if (/retir|引退/.test(text)) return "RETIRE";
  if (/inactive|休止|無期限/.test(text)) return "INACTIVE";
  if (/leav|left|depart|quit|release|退団|脱退|離脱|契約終了/.test(text)) {
    return "LEAVE";
  }
  if (/join|加入/.test(text)) return "JOIN";
  if (/transfer|移籍/.test(text)) return "TRANSFER";
  return null;
}

function resolveTransferType(
  detected: TransferType | null,
  fromTeamName: string | null,
  toTeamName: string | null,
): TransferType {
  if (detected) return detected;
  if (fromTeamName && toTeamName) return "TRANSFER";
  if (toTeamName) return "JOIN";
  if (fromTeamName) return "LEAVE";
  return "OTHER";
}

function isSpecialTeam(value: string | null) {
  if (!value) return false;
  return /^(lft|fa|free agent|inactive|retired|retirement|none|tbd|-|\?)$/i.test(
    value.trim(),
  );
}

function normalizeTeamName(value: string | null | undefined) {
  const text = clean(value);
  if (!text) return null;
  if (/^(lft|fa|free agent|inactive|retired|retirement|none|tbd|-|\?)$/i.test(text)) {
    return null;
  }
  // チーム名に付記される「(Inactive)」等を落とす
  return text.replace(/\s*\((?:inactive|retired|lft|fa)\)\s*$/i, "").trim();
}

function makeDedupeKey(input: {
  playerHandle: string;
  type: TransferType;
  eventDate: string;
  fromTeamName: string | null;
  toTeamName: string | null;
  role: string | null;
}) {
  return [
    "liquipedia",
    input.playerHandle,
    input.type,
    input.eventDate,
    input.fromTeamName ?? "",
    input.toTeamName ?? "",
    input.role ?? "",
  ]
    .join("|")
    .toLowerCase();
}

type AnchorInfo = {
  text: string;
  href: string | null;
  title: string | null;
  className: string;
  isExternal: boolean;
};

function anchorsIn($: CheerioAPI, cell: Cheerio<AnyNode>) {
  const anchors: AnchorInfo[] = [];
  const external: AnchorInfo[] = [];

  cell.find("a[href]").each((_, element) => {
    const anchor = $(element);
    const href = anchor.attr("href") ?? null;
    const text = clean(anchor.text());
    if (!text) return;
    const absolute = absoluteUrl(href ?? undefined, BASE_URL);
    if (!absolute) return;

    const info: AnchorInfo = {
      text,
      href: absolute,
      title: clean(anchor.attr("title")) || null,
      className: anchor.attr("class") ?? "",
      isExternal: !absolute.startsWith(BASE_URL),
    };

    if (info.isExternal) {
      external.push(info);
      return;
    }

    const pathName = new URL(absolute).pathname;
    if (
      pathName.includes("/valorant/") &&
      !pathName.includes("/Portal:") &&
      !pathName.includes("/Special:")
    ) {
      anchors.push(info);
    }
  });

  return { anchors, external };
}

function extractPlayer($: CheerioAPI, cell: Cheerio<AnyNode>) {
  const { anchors } = anchorsIn($, cell);
  if (anchors.length === 0) {
    const text = clean(cell.text());
    return text ? { handle: text, country: null } : null;
  }

  // class / title に player を示す手がかりがあるリンクを優先
  const preferred =
    anchors.find((anchor) => /player|name|text/i.test(anchor.className)) ??
    anchors.find((anchor) => anchor.title === anchor.text) ??
    anchors[0];

  const country =
    clean(
      cell.find("img.flag, img[alt*='flag' i], .flag img").first().attr("alt"),
    ) ||
    clean(cell.find("[data-country]").first().attr("data-country")) ||
    null;

  return { handle: preferred.text, country };
}

function extractTeams($: CheerioAPI, cell: Cheerio<AnyNode>) {
  const { anchors } = anchorsIn($, cell);
  const names = anchors
    .map((anchor) => normalizeTeamName(anchor.text || anchor.title))
    .filter((name): name is string => Boolean(name));

  if (names.length > 0) return Array.from(new Set(names));

  const text = normalizeTeamName(cell.text());
  return text ? [text] : [];
}

function findColumn(headers: string[], patterns: RegExp[]) {
  return headers.findIndex((header) =>
    patterns.some((pattern) => pattern.test(header)),
  );
}

function parseTable(
  $: CheerioAPI,
  table: Cheerio<AnyNode>,
  pageUrl: string,
  warnings: string[],
) {
  const events: ParsedTransfer[] = [];

  const headerCells = table
    .find("tr")
    .first()
    .find("th")
    .toArray()
    .map((cell) => clean($(cell).text()));

  const headers = headerCells.length
    ? headerCells
    : table
        .find("thead tr")
        .first()
        .find("th, td")
        .toArray()
        .map((cell) => clean($(cell).text()));

  const dateIndex = findColumn(headers, [/date|日付|when/i]);
  const playerIndex = findColumn(headers, [
    /player|選手|^id$|^name$/i,
  ]);
  const fromIndex = findColumn(headers, [
    /from|left|old|previous|前所属|旧|退団|離脱/i,
  ]);
  const toIndex = findColumn(headers, [
    /to|join|new|next|加入|移籍先/i,
  ]);
  const roleIndex = findColumn(headers, [/role|position|役割/i]);
  const typeIndex = findColumn(headers, [/type|status|move|種別|状態/i]);
  const sourceIndex = findColumn(headers, [/source|ref|出典|announcement/i]);

  const hasUsefulHeader =
    (dateIndex >= 0 && playerIndex >= 0) ||
    (playerIndex >= 0 && (fromIndex >= 0 || toIndex >= 0));

  if (!hasUsefulHeader && headers.length > 0) {
    // ヘッダーがアイコン画像だけの表などは、行の中身から推測する
    const headerText = headers.join(" ");
    if (!/date|player|from|to|team|type|status/i.test(headerText)) {
      return events;
    }
  }

  const rows = table.find("tbody tr, tr").toArray();

  for (const row of rows) {
    const rowNode = $(row);
    const cells = rowNode.find("td").toArray();
    if (cells.length < 2) continue;

    const cellTexts = cells.map((cell) => clean($(cell).text()));
    if (cellTexts.every((text) => !text)) continue;

    let date: string | null = null;
    let dateCellIndex = -1;

    if (dateIndex >= 0 && cells[dateIndex]) {
      date = normalizeDate(
        $(cells[dateIndex]).text(),
        $(cells[dateIndex]).attr("data-sort-value") ??
          $(cells[dateIndex]).attr("data-timestamp"),
      );
      if (date) dateCellIndex = dateIndex;
    }

    if (!date) {
      for (const [index, cell] of cells.entries()) {
        const text = cellTexts[index];
        if (!text) continue;
        const candidate = normalizeDate(
          text,
          $(cell).attr("data-sort-value") ?? $(cell).attr("data-timestamp"),
        );
        if (candidate) {
          date = candidate;
          dateCellIndex = index;
          break;
        }
      }
    }

    if (!date) continue;

    const rowAttributes = [
      rowNode.attr("class") ?? "",
      rowNode.attr("data-type") ?? "",
      rowNode.attr("data-status") ?? "",
      rowNode.attr("title") ?? "",
      rowNode
        .find("[title], [alt], .explain")
        .toArray()
        .map((element) =>
          [
            $(element).attr("title"),
            $(element).attr("alt"),
            $(element).attr("data-tooltip"),
          ]
            .filter(Boolean)
            .join(" "),
        )
        .join(" "),
    ].join(" ");

    let player = null as { handle: string; country: string | null } | null;
    if (playerIndex >= 0 && cells[playerIndex]) {
      player = extractPlayer($, $(cells[playerIndex]));
    }

    if (!player) {
      for (const [index, cell] of cells.entries()) {
        if (index === dateCellIndex) continue;
        if (fromIndex === index || toIndex === index) continue;
        if (typeIndex === index || roleIndex === index) continue;

        const { anchors } = anchorsIn($, $(cell));
        if (anchors.length === 0) continue;
        const candidate = extractPlayer($, $(cell));
        if (candidate?.handle) {
          player = candidate;
          break;
        }
      }
    }

    if (!player?.handle) continue;
    if (/^(date|player|from|to|team|type|status)$/i.test(player.handle)) {
      continue;
    }

    let fromTeamName: string | null = null;
    let toTeamName: string | null = null;

    if (fromIndex >= 0 && cells[fromIndex]) {
      fromTeamName = extractTeams($, $(cells[fromIndex]))[0] ?? null;
    }
    if (toIndex >= 0 && cells[toIndex]) {
      toTeamName = extractTeams($, $(cells[toIndex]))[0] ?? null;
    }

    const teamsFromOtherCells: Array<{ index: number; name: string }> = [];
    for (const [index, cell] of cells.entries()) {
      if (index === dateCellIndex || index === playerIndex) continue;
      if (index === fromIndex || index === toIndex) continue;
      if (index === roleIndex || index === typeIndex || index === sourceIndex) {
        continue;
      }

      const names = extractTeams($, $(cell)).filter(
        (name) => name.toLowerCase() !== player?.handle.toLowerCase(),
      );
      for (const name of names) {
        teamsFromOtherCells.push({ index, name });
      }
    }

    const specialType =
      classifyTransfer(
        [
          typeIndex >= 0 ? cellTexts[typeIndex] : "",
          fromTeamName ?? "",
          toTeamName ?? "",
          teamsFromOtherCells.map((entry) => entry.name).join(" "),
          rowAttributes,
        ].join(" "),
      ) ?? null;

    if (
      fromTeamName &&
      isSpecialTeam(fromTeamName) &&
      !specialType
    ) {
      // 例: From 列に「LFT」とだけ書かれている
    }

    if (!fromTeamName || !toTeamName) {
      const resolved = resolveTransferType(
        specialType,
        fromTeamName,
        toTeamName,
      );
      const teamCandidates = Array.from(
        new Set(teamsFromOtherCells.map((entry) => entry.name)),
      );

      if (!fromTeamName && !toTeamName) {
        if (teamCandidates.length >= 2) {
          fromTeamName = teamCandidates[0];
          toTeamName = teamCandidates[1];
        } else if (teamCandidates.length === 1) {
          if (resolved === "LEAVE") {
            fromTeamName = teamCandidates[0];
          } else {
            toTeamName = teamCandidates[0];
          }
        }
      } else if (!fromTeamName && teamCandidates.length > 0) {
        fromTeamName = teamCandidates.find(
          (name) => name !== toTeamName,
        ) ?? null;
      } else if (!toTeamName && teamCandidates.length > 0) {
        toTeamName = teamCandidates.find(
          (name) => name !== fromTeamName,
        ) ?? null;
      }
    }

    const type = resolveTransferType(
      specialType,
      fromTeamName,
      toTeamName,
    );

    let role = roleIndex >= 0 ? clean(cellTexts[roleIndex]) : "";
    if (!role) {
      role = ROLE_PATTERN.exec(cellTexts.join(" "))?.[1] ?? "";
    }
    role = role.replace(/^role\s*:\s*/i, "").trim();

    const { external } = anchorsIn($, rowNode);
    const source =
      (sourceIndex >= 0
        ? anchorsIn($, $(cells[sourceIndex])).external[0]
        : null) ??
      external.find(
        (anchor) =>
          anchor.href != null && /x\.com|twitter\.com|youtu/i.test(anchor.href),
      ) ?? external[0];

    const event: ParsedTransfer = {
      playerHandle: player.handle,
      playerCountry: player.country,
      fromTeamName: isSpecialTeam(fromTeamName) ? null : fromTeamName,
      toTeamName: isSpecialTeam(toTeamName) ? null : toTeamName,
      role: role || null,
      type,
      eventDate: date,
      sourceUrl: source?.href ?? pageUrl,
      sourceTitle: source?.text ?? "Liquipedia",
      rawText: cellTexts.join(" | ").slice(0, 500),
      dedupeKey: "",
    };

    event.dedupeKey = makeDedupeKey(event);

    if (!event.fromTeamName && !event.toTeamName) {
      // チーム移動を伴わない行は、LFT / FA / Inactive 等の明示がある場合のみ採用
      if (!["LFT", "FA", "INACTIVE", "RETIRE"].includes(event.type)) {
        warnings.push(
          `チーム情報を特定できずスキップ: ${event.playerHandle} (${event.eventDate})`,
        );
        continue;
      }
    }

    events.push(event);
  }

  return events;
}

function scoreTable($: CheerioAPI, table: Cheerio<AnyNode>) {
  const headers = table
    .find("tr")
    .first()
    .find("th, td")
    .toArray()
    .map((cell) => clean($(cell).text()));

  let score = 0;
  for (const header of headers) {
    if (/date|日付/i.test(header)) score += 3;
    if (/player|選手|^id$|^name$/i.test(header)) score += 3;
    if (/from|left|old|previous|前所属|旧/i.test(header)) score += 2;
    if (/to|join|new|next|加入|移籍先/i.test(header)) score += 2;
    if (/type|status|move|種別|状態/i.test(header)) score += 2;
    if (/role|position|役割/i.test(header)) score += 1;
    if (/team|チーム/i.test(header)) score += 1;
  }

  if (headers.length === 0) {
    const rowCount = table.find("tr").length;
    const linkCount = table.find('a[href*="/valorant/"]').length;
    if (rowCount >= 2 && linkCount >= 2) score += 1;
  }

  return score;
}

/**
 * Portal:Transfers の HTML を解析する。
 * Liquipedia のマークアップ変更に備え、複数テーブルをスコアリングして
 * 最も移籍表らしいものを採用する。
 */
export function parseTransferPortalHtml(
  html: string,
  pageUrl = TRANSFER_PORTAL_URL,
): ParseResult {
  const $ = load(html);
  const warnings: string[] = [];
  const tables = $("table").toArray();
  const scored = tables.map((table) => ({
    table,
    score: scoreTable($, $(table)),
  }));

  scored.sort((a, b) => b.score - a.score);

  const events: ParsedTransfer[] = [];
  let tablesScanned = 0;

  for (const { table, score } of scored) {
    if (score <= 0 && events.length > 0) continue;
    tablesScanned += 1;
    const parsed = parseTable($, $(table), pageUrl, warnings);
    events.push(...parsed);
    if (parsed.length > 0 && score >= 3) break;
  }

  // table 要素を使わないレイアウト向けのフォールバック
  if (events.length === 0) {
    const candidates = $(
      '[class*="transfer" i], [data-transfer], [class*="move" i]',
    ).toArray();

    for (const element of candidates.slice(0, 300)) {
      const node = $(element);
      const text = clean(node.text());
      if (!text) continue;
      const date = normalizeDate(text);
      if (!date) continue;

      const { anchors, external } = anchorsIn($, node);
      if (anchors.length === 0) continue;

      const player = anchors[0];
      const teams = anchors
        .slice(1)
        .map((anchor) => normalizeTeamName(anchor.text))
        .filter((name): name is string => Boolean(name));

      const type = resolveTransferType(
        classifyTransfer(text),
        teams[0] ?? null,
        teams[1] ?? null,
      );

      const source =
        external.find(
          (anchor) =>
            anchor.href != null && /x\.com|twitter\.com/i.test(anchor.href),
        ) ?? external[0];

      const event: ParsedTransfer = {
        playerHandle: player.text,
        playerCountry: null,
        fromTeamName: teams[0] ?? null,
        toTeamName: teams[1] ?? null,
        role: ROLE_PATTERN.exec(text)?.[1] ?? null,
        type,
        eventDate: date,
        sourceUrl: source?.href ?? pageUrl,
        sourceTitle: source?.text ?? "Liquipedia",
        rawText: text.slice(0, 500),
        dedupeKey: "",
      };
      event.dedupeKey = makeDedupeKey(event);
      events.push(event);
    }
  }

  const unique = new Map<string, ParsedTransfer>();
  for (const event of events) {
    if (!unique.has(event.dedupeKey)) unique.set(event.dedupeKey, event);
  }

  const result = Array.from(unique.values()).sort((a, b) => {
    if (a.eventDate !== b.eventDate) {
      return b.eventDate.localeCompare(a.eventDate);
    }
    return a.playerHandle.localeCompare(b.playerHandle);
  });

  if (result.length === 0) {
    warnings.push(
      "移籍イベントを 1 件も特定できませんでした。Liquipedia の HTML 構造変更、または captcha の可能性があります。--debug で HTML を保存して確認してください。",
    );
  }

  return { events: result, warnings, tablesScanned };
}

type RosterEntry = {
  handle: string;
  role: string | null;
  status: PlayerStatus;
};

export function parseTeamRosterHtml(html: string): RosterEntry[] {
  const $ = load(html);
  const entries: RosterEntry[] = [];

  for (const table of $("table").toArray()) {
    const headers = $(table)
      .find("tr")
      .first()
      .find("th, td")
      .toArray()
      .map((cell) => clean($(cell).text()));

    const playerIndex = findColumn(headers, [/player|選手|^id$|^name$/i]);
    const roleIndex = findColumn(headers, [/role|position|役割/i]);
    if (playerIndex < 0) continue;

    for (const row of $(table).find("tbody tr, tr").toArray()) {
      const cells = $(row).find("td").toArray();
      if (cells.length <= playerIndex) continue;

      const player = extractPlayer($, $(cells[playerIndex]));
      if (!player?.handle) continue;

      const role =
        roleIndex >= 0 && cells[roleIndex]
          ? clean($(cells[roleIndex]).text())
          : null;
      const rowText = clean($(row).text());
      const status = classifyTransfer(rowText);

      entries.push({
        handle: player.handle,
        role: role || null,
        status:
          status === "LFT"
            ? "LFT"
            : status === "FA"
              ? "FA"
              : status === "INACTIVE" || status === "RETIRE"
                ? "INACTIVE"
                : "ACTIVE",
      });
    }

    if (entries.length > 0) break;
  }

  const unique = new Map<string, RosterEntry>();
  for (const entry of entries) {
    unique.set(entry.handle.toLowerCase(), entry);
  }
  return Array.from(unique.values());
}

class ScrapeError extends Error {
  constructor(
    message: string,
    readonly kind: "BLOCKED" | "RATE_LIMIT" | "HTTP" | "NETWORK" | "PARSE",
  ) {
    super(message);
    this.name = "ScrapeError";
  }
}

let lastRequestAt = 0;

async function politeFetch(
  url: string,
  options: CliOptions,
  purpose: string,
): Promise<string> {
  const waitMs = Math.max(
    0,
    lastRequestAt + options.delayMs - Date.now(),
  );
  if (lastRequestAt > 0 && waitMs > 0) {
    console.log(
      `  ⏳ rate limit: ${Math.ceil(waitMs / 1000)}s 待機してから ${purpose} を取得します`,
    );
    await sleep(waitMs);
  }

  const maxAttempts = 2;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    lastRequestAt = Date.now();

    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(options.timeoutMs),
        headers: {
          "User-Agent": USER_AGENT,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9,ja;q=0.8",
          "Cache-Control": "no-cache",
        },
      });

      const body = await response.text();

      if (
        response.status === 403 ||
        /verify you are human|challenges\.cloudflare\.com\/turnstile/i.test(
          body,
        )
      ) {
        throw new ScrapeError(
          `Liquipedia がアクセスをブロックしました (HTTP ${response.status})。Cloudflare Turnstile を自動回避することはできません。少し時間を置くか、ブラウザで一度ページを開いてから再実行してください。`,
          "BLOCKED",
        );
      }

      if (response.status === 429) {
        const retryAfter = Number.parseInt(
          response.headers.get("retry-after") ?? "",
          10,
        );
        const backoff = Number.isFinite(retryAfter)
          ? Math.max(options.delayMs, retryAfter * 1000)
          : options.delayMs * 2;
        throw new ScrapeError(
          `Rate limit (HTTP 429)。${Math.ceil(backoff / 1000)} 秒待機して再試行します。`,
          "RATE_LIMIT",
        );
      }

      if (!response.ok) {
        throw new ScrapeError(
          `HTTP ${response.status} ${response.statusText} (${url})`,
          "HTTP",
        );
      }

      if (!body.trim()) {
        throw new ScrapeError(`空のレスポンス (${url})`, "PARSE");
      }

      return body;
    } catch (error) {
      lastError = error;
      const shouldRetry =
        attempt < maxAttempts &&
        error instanceof ScrapeError &&
        (error.kind === "RATE_LIMIT" || error.kind === "HTTP");

      if (!shouldRetry) break;
      const backoff =
        error.kind === "RATE_LIMIT" ? options.delayMs * 2 : options.delayMs;
      console.log(
        `  ⏳ 再試行 (${attempt}/${maxAttempts}): ${Math.ceil(backoff / 1000)}s 待機`,
      );
      await sleep(backoff);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new ScrapeError(`取得に失敗しました (${url})`, "NETWORK");
}

async function ensureBaseData() {
  const game = await prisma.game.upsert({
    where: { slug: "valorant" },
    update: {},
    create: {
      slug: "valorant",
      name: "VALORANT",
      shortName: "VAL",
      isActive: true,
      sortOrder: 0,
    },
  });

  const region = await prisma.region.upsert({
    where: { code: "JP" },
    update: {},
    create: { code: "JP", name: "日本", sortOrder: 0 },
  });

  return { game, region };
}

function monthBefore(date: string) {
  const [yearText, monthText] = date.split("-");
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return date;

  const previous = new Date(Date.UTC(year, month - 2, 1));
  return `${previous.getUTCFullYear()}-${pad(previous.getUTCMonth() + 1)}`;
}

function toMonth(date: string) {
  return date.slice(0, 7);
}

function statusForEvent(type: TransferType): PlayerStatus | null {
  switch (type) {
    case "LFT":
      return "LFT";
    case "FA":
      return "FA";
    case "INACTIVE":
    case "RETIRE":
      return "INACTIVE";
    case "JOIN":
    case "TRANSFER":
      return "ACTIVE";
    default:
      return null;
  }
}

function deriveShortName(name: string) {
  const compact = name.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return compact.slice(0, 8) || "TEAM";
}

async function ensureTeam(
  gameId: string,
  regionId: string,
  name: string,
  stats: ApplyStats,
  preferredShortName?: string,
  accent?: string,
) {
  const canonicalName = canonicalTargetTeamName(name);
  if (!canonicalName) {
    throw new Error(
      `対象4チーム以外は DB に登録できません: ${name}`,
    );
  }

  const target = TARGET_TEAMS.find((team) => team.name === canonicalName);
  const teams = await prisma.team.findMany({
    where: { gameId },
    select: { id: true, name: true, shortName: true },
  });
  const normalized = canonicalName.toLowerCase();
  const existing = teams.find(
    (team) =>
      team.name.toLowerCase() === normalized ||
      team.shortName.toLowerCase() ===
        (preferredShortName ?? target?.shortName ?? normalized).toLowerCase(),
  );
  if (existing) return existing;

  let shortName =
    preferredShortName ?? target?.shortName ?? deriveShortName(canonicalName);
  let candidate = shortName;
  let suffix = 2;
  while (
    teams.some(
      (team) => team.shortName.toLowerCase() === candidate.toLowerCase(),
    )
  ) {
    candidate = `${shortName.slice(0, 7)}${suffix}`;
    suffix += 1;
  }
  shortName = candidate;

  const created = await prisma.team.create({
    data: {
      gameId,
      regionId,
      name: canonicalName,
      shortName,
      accent: accent ?? target?.accent ?? "violet",
      description: "Liquipedia から自動登録された対象チーム",
      isActive: true,
    },
    select: { id: true, name: true, shortName: true },
  });

  stats.teamsCreated += 1;
  return created;
}

async function closeCurrentMemberships(
  playerId: string,
  endDate: string,
  stats: ApplyStats,
  sourceNote: string,
) {
  const current = await prisma.membershipHistory.findMany({
    where: { playerId, isCurrent: true },
  });

  for (const membership of current) {
    await prisma.membershipHistory.update({
      where: { id: membership.id },
      data: {
        isCurrent: false,
        endDate: toMonth(endDate),
        sourceNote,
      },
    });
    stats.membershipsClosed += 1;
  }
}

async function applyEvent(
  event: ParsedTransfer,
  context: Awaited<ReturnType<typeof ensureBaseData>>,
  stats: ApplyStats,
  dryRun: boolean,
) {
  const existingPlayer = await prisma.player.findUnique({
    where: {
      gameId_handle: {
        gameId: context.game.id,
        handle: event.playerHandle,
      },
    },
    include: {
      memberships: { where: { isCurrent: true } },
    },
  });

  if (dryRun) {
    stats.inserted += 1;
    return;
  }

  let player = existingPlayer;

  if (!player) {
    player = await prisma.player.create({
      data: {
        gameId: context.game.id,
        regionId: context.region.id,
        handle: event.playerHandle,
        country: event.playerCountry ?? "JP",
        status: statusForEvent(event.type) ?? "ACTIVE",
        note: "Liquipedia から自動登録",
      },
      include: { memberships: { where: { isCurrent: true } } },
    });
    stats.playersCreated += 1;
  }

  const status = statusForEvent(event.type);
  if (status && player.status !== status) {
    await prisma.player.update({
      where: { id: player.id },
      data: { status },
    });
  }

  const sourceNote = `liquipedia:${event.eventDate}`;
  const canonicalToTeam = canonicalTargetTeamName(event.toTeamName);

  // 対象4チームから対象外チームへの移籍は、イベントだけを記録し
  // 対象外チームの Team レコードや所属履歴は作成しない。
  // LFT / FA / INACTIVE は下の分岐で扱うため、ここでは在籍元が
  // 明確な移籍イベントだけを対象にする。
  if (
    event.toTeamName &&
    !canonicalToTeam &&
    (event.type === "JOIN" || event.type === "TRANSFER")
  ) {
    await closeCurrentMemberships(
      player.id,
      event.eventDate,
      stats,
      sourceNote,
    );
    return;
  }

  let toTeamId: string | null = null;
  if (canonicalToTeam) {
    const team = await ensureTeam(
      context.game.id,
      context.region.id,
      canonicalToTeam,
      stats,
    );
    toTeamId = team.id;
  }

  if (event.type === "JOIN" || event.type === "TRANSFER") {
    if (!toTeamId) {
      stats.skipped += 1;
      stats.warnings.push(
        `加入先を特定できず所属履歴を更新しませんでした: ${event.playerHandle} (${event.eventDate})`,
      );
      return;
    }

    const alreadyCurrent = player.memberships.find(
      (membership) => membership.teamId === toTeamId,
    );

    if (alreadyCurrent) {
      await prisma.membershipHistory.update({
        where: { id: alreadyCurrent.id },
        data: {
          role: event.role ?? alreadyCurrent.role,
          announcementUrl: event.sourceUrl,
          sourceNote,
        },
      });
    } else {
      await closeCurrentMemberships(player.id, event.eventDate, stats, sourceNote);

      const duplicate = await prisma.membershipHistory.findFirst({
        where: {
          playerId: player.id,
          teamId: toTeamId,
          startDate: toMonth(event.eventDate),
        },
      });

      if (duplicate) {
        await prisma.membershipHistory.update({
          where: { id: duplicate.id },
          data: {
            isCurrent: true,
            endDate: null,
            role: event.role ?? duplicate.role,
            announcementUrl: event.sourceUrl,
            sourceNote,
          },
        });
      } else {
        await prisma.membershipHistory.create({
          data: {
            playerId: player.id,
            teamId: toTeamId,
            role: event.role ?? "Member",
            startDate: toMonth(event.eventDate),
            endDate: null,
            isCurrent: true,
            announcementUrl: event.sourceUrl,
            sourceNote,
          },
        });
        stats.membershipsCreated += 1;
      }
    }
    return;
  }

  if (event.type === "LEAVE") {
    await closeCurrentMemberships(player.id, event.eventDate, stats, sourceNote);
    if (player.status !== "LFT" && player.status !== "FA") {
      await prisma.player.update({
        where: { id: player.id },
        data: { status: "LFT" },
      });
    }
    return;
  }

  if (event.type === "LFT" || event.type === "FA") {
    // 「Team -> LFT / FA」は退団を伴うため、現所属を終了させる。
    // 所属元が不明な場合は、在籍中のチームを誤って消さないよう何もしない。
    if (event.fromTeamName) {
      await closeCurrentMemberships(
        player.id,
        event.eventDate,
        stats,
        sourceNote,
      );
    }
    return;
  }

  if (event.type === "INACTIVE" || event.type === "RETIRE") {
    await closeCurrentMemberships(player.id, event.eventDate, stats, sourceNote);
  }
}

async function syncTeamPage(
  page: TeamPage,
  context: Awaited<ReturnType<typeof ensureBaseData>>,
  options: CliOptions,
  stats: ApplyStats,
) {
  const url = `${BASE_URL}/valorant/${page.page}`;
  console.log(`\n[team] ${page.name} (${url})`);

  const html = await politeFetch(url, options, `${page.name} のロスター`);
  const roster = parseTeamRosterHtml(html);

  if (roster.length === 0) {
    stats.warnings.push(`${page.name}: ロスターを特定できませんでした`);
    return;
  }

  if (options.dryRun) {
    stats.warnings.push(
      `${page.name}: ${roster.length} 名のロスターを検出（dry-run のためDB未更新）`,
    );
    return;
  }

  const team = await ensureTeam(
    context.game.id,
    context.region.id,
    page.name,
    stats,
    page.shortName,
    page.accent,
  );

  for (const entry of roster) {
    const player = await prisma.player.upsert({
      where: {
        gameId_handle: {
          gameId: context.game.id,
          handle: entry.handle,
        },
      },
      update: {
        status: entry.status,
        regionId: context.region.id,
      },
      create: {
        gameId: context.game.id,
        regionId: context.region.id,
        handle: entry.handle,
        country: "JP",
        status: entry.status,
        note: `${page.name} の Liquipedia ロスター`,
      },
    });

    const current = await prisma.membershipHistory.findFirst({
      where: { playerId: player.id, teamId: team.id, isCurrent: true },
    });

    if (!current && entry.status !== "LFT" && entry.status !== "FA") {
      await closeCurrentMemberships(
        player.id,
        `${new Date().toISOString().slice(0, 7)}-01`,
        stats,
        `liquipedia:${page.page}`,
      );
      await prisma.membershipHistory.create({
        data: {
          playerId: player.id,
          teamId: team.id,
          role: entry.role ?? "Member",
          startDate: new Date().toISOString().slice(0, 7),
          isCurrent: true,
          sourceNote: `liquipedia:${page.page}`,
        },
      });
      stats.membershipsCreated += 1;
    } else if (current && entry.role) {
      await prisma.membershipHistory.update({
        where: { id: current.id },
        data: { role: entry.role },
      });
    }
  }

  stats.warnings.push(
    `${page.name}: ${roster.length} 名のロスターを確認しました（削除・LFT化は行いません）`,
  );
}

/**
 * 旧チームまたは新チームが対象 4 チームのいずれかに一致するイベントのみ残す。
 * 対象外チーム同士の移籍は、選手が既知でも取り込まない。
 */
function isTargetTeamEvent(event: ParsedTransfer) {
  return (
    isTargetTeamName(event.fromTeamName) ||
    isTargetTeamName(event.toTeamName)
  );
}

async function saveDebugHtml(html: string, url: string) {
  const directory = path.join(process.cwd(), "scripts", ".cache");
  await mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = path.join(
    directory,
    `liquipedia-${stamp}.html`,
  );
  await writeFile(
    fileName,
    `<!-- source: ${url} -->\n${html}`,
    "utf8",
  );
  return fileName;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = new Date();

  console.log("──────────────────────────────────────────────");
  console.log(" VALO-ROSTER JP / Liquipedia updater");
  console.log(` mode       : ${options.dryRun ? "DRY RUN" : "APPLY"}`);
  console.log(` source     : ${options.fixture ? `fixture:${options.fixture}` : options.url}`);
  console.log(` user-agent : ${USER_AGENT}`);
  console.log(
    ` rate limit : ${options.delayMs}ms (Liquipedia 規約に合わせ最低 ${MIN_REQUEST_INTERVAL_MS}ms)`,
  );
  console.log(` target     : ${TARGET_TEAMS.map((team) => team.shortName).join(" / ")}`);
  console.log(` team pages : ${options.fetchTeams ? "ON (--teams)" : "OFF"}`);
  console.log("──────────────────────────────────────────────");

  if (!/\([^)]*(?:@|https?:\/\/)[^)]*\)/.test(USER_AGENT)) {
    throw new Error(
      "User-Agent に連絡先（メールアドレスまたは URL）を括弧書きで含めてください。例: ValorantRosterTracker/1.0 (local-personal-tool; contact@example.com)",
    );
  }

  const context = await ensureBaseData();
  const stats: ApplyStats = {
    events: 0,
    inserted: 0,
    updated: 0,
    membershipsCreated: 0,
    membershipsClosed: 0,
    playersCreated: 0,
    teamsCreated: 0,
    skipped: 0,
    warnings: [],
  };

  const updateLog = options.dryRun
    ? null
    : await prisma.updateLog.create({
        data: {
          source: "liquipedia:transfers",
          status: "RUNNING",
          message: "Liquipedia Portal:Transfers を取得中",
        },
      });

  let status: "SUCCESS" | "PARTIAL" | "FAILED" = "FAILED";
  let parseResult: ParseResult = {
    events: [],
    warnings: [],
    tablesScanned: 0,
  };

  try {
    let html: string;
    if (options.fixture) {
      html = await readFile(path.resolve(options.fixture), "utf8");
      console.log(`📄 fixture を読み込みました: ${options.fixture}`);
    } else {
      console.log(`\n[1/1] Portal:Transfers を取得中...`);
      html = await politeFetch(options.url, options, "Portal:Transfers");
    }

    if (options.debug && !options.fixture) {
      const debugPath = await saveDebugHtml(html, options.url);
      console.log(`🐞 HTML を保存しました: ${debugPath}`);
    }

    parseResult = parseTransferPortalHtml(html, options.url);
    console.log(
      `\n📊 解析結果: ${parseResult.events.length} 件 / ${parseResult.tablesScanned} tables`,
    );
    for (const warning of parseResult.warnings) {
      console.log(`  ⚠️  ${warning}`);
    }
    stats.warnings.push(...parseResult.warnings);

    const relatedEvents = parseResult.events.filter(isTargetTeamEvent);

    const skippedOutsideTarget = parseResult.events.length - relatedEvents.length;
    if (skippedOutsideTarget > 0) {
      console.log(
        `  ℹ️  対象4チーム（ZETA / DFM / FENNEL / QTD）外として ${skippedOutsideTarget} 件をスキップ`,
      );
    }

    const targetEvents = relatedEvents.slice(0, options.limit);
    stats.events = targetEvents.length;

    for (const [index, event] of targetEvents.entries()) {
      const label = `${event.eventDate} ${event.playerHandle} ${
        event.fromTeamName ?? "—"
      } -> ${event.toTeamName ?? event.type}`;

      if (options.verbose) {
        console.log(`  [${index + 1}/${targetEvents.length}] ${label}`);
      }

      if (options.dryRun) {
        stats.inserted += 1;
        continue;
      }

      const existing = await prisma.transferEvent.findUnique({
        where: { dedupeKey: event.dedupeKey },
        select: { id: true },
      });

      await prisma.transferEvent.upsert({
        where: { dedupeKey: event.dedupeKey },
        update: {
          playerHandle: event.playerHandle,
          fromTeamName: event.fromTeamName,
          toTeamName: event.toTeamName,
          role: event.role,
          type: event.type,
          eventDate: event.eventDate,
          sourceUrl: event.sourceUrl,
          sourceTitle: event.sourceTitle,
          rawText: event.rawText,
        },
        create: {
          gameId: context.game.id,
          playerHandle: event.playerHandle,
          fromTeamName: event.fromTeamName,
          toTeamName: event.toTeamName,
          role: event.role,
          type: event.type,
          eventDate: event.eventDate,
          sourceUrl: event.sourceUrl,
          sourceTitle: event.sourceTitle,
          rawText: event.rawText,
          dedupeKey: event.dedupeKey,
        },
      });

      if (existing) stats.updated += 1;
      else stats.inserted += 1;

      try {
        await applyEvent(event, context, stats, false);
      } catch (error) {
        stats.skipped += 1;
        stats.warnings.push(
          `所属履歴の更新に失敗: ${event.playerHandle} (${event.eventDate}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    if (parseResult.events.length === 0) {
      status = "FAILED";
    } else if (
      stats.warnings.some((warning) => /失敗|特定できません/.test(warning))
    ) {
      status = "PARTIAL";
    } else {
      status = "SUCCESS";
    }

    if (options.fetchTeams) {
      let teamFailures = 0;
      for (const page of JP_TEAM_PAGES) {
        try {
          await syncTeamPage(page, context, options, stats);
        } catch (error) {
          teamFailures += 1;
          stats.warnings.push(
            `${page.name}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          console.error(
            `  ❌ ${page.name}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      }
      if (teamFailures > 0 && status === "SUCCESS") status = "PARTIAL";
    }
  } catch (error) {
    status = "FAILED";
    stats.warnings.push(
      error instanceof Error ? error.message : String(error),
    );
    console.error(
      `\n❌ 更新に失敗しました: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    if (error instanceof ScrapeError && error.kind === "BLOCKED") {
      console.error(
        "   Liquipedia は自動アクセスに Cloudflare Turnstile を出すことがあります。規約に従い、自動回避は行いません。",
      );
      console.error(
        "   ブラウザで https://liquipedia.net/valorant/Portal:Transfers を開ける状態にしてから再実行してください。",
      );
    }
  }

  if (options.fetchTeams) {
    status = status === "FAILED" ? "FAILED" : status;
  }

  const summary = [
    `parsed=${parseResult.events.length}`,
    `target=${stats.events}`,
    `inserted=${stats.inserted}`,
    `updated=${stats.updated}`,
    `players+${stats.playersCreated}`,
    `teams+${stats.teamsCreated}`,
    `memberships+${stats.membershipsCreated}/-${stats.membershipsClosed}`,
    `skipped=${stats.skipped}`,
  ].join(" ");

  console.log("\n──────────────────────────────────────────────");
  console.log(` summary: ${status} / ${summary}`);
  console.log(
    options.dryRun
      ? " DB writes skipped (dry-run)"
      : " TransferEvent / MembershipHistory / UpdateLog を保存しました",
  );
  for (const warning of stats.warnings.slice(0, 20)) {
    console.log(`  ⚠️  ${warning}`);
  }
  console.log("──────────────────────────────────────────────");

  if (updateLog) {
    await prisma.updateLog.update({
      where: { id: updateLog.id },
      data: {
        status,
        message: `${summary} | ${stats.warnings.slice(0, 5).join(" / ")}`.slice(
          0,
          2000,
        ),
        finishedAt: new Date(),
      },
    });
  }

  if (status === "FAILED") {
    process.exitCode = 1;
  }
}

run()
  .catch(async (error) => {
    console.error("❌ Liquipedia 更新処理に失敗しました:", error);
    try {
      await prisma.updateLog.create({
        data: {
          source: "liquipedia:transfers",
          status: "FAILED",
          message:
            error instanceof Error ? error.message.slice(0, 2000) : String(error),
          finishedAt: new Date(),
        },
      });
    } catch {
      // DB に接続できない場合はコンソール出力のみ
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
