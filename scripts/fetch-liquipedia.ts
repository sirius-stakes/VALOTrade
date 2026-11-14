/**
 * Liquipedia (VALORANT) の MediaWiki API から対象 4 チームのロスターを取得し、
 * ローカル SQLite (Prisma) に Upsert する。
 *
 * 実行:
 *   npm run update                  # API から 4 チームを取得して DB 更新
 *   npm run update -- --dry-run     # 取得・解析のみ（DB 更新なし）
 *   npm run update -- --verbose     # 取得した全選手を表示
 *   npm run update -- --fixture=... --team=ZETA_DIVISION --dry-run
 *
 * Liquipedia の利用規約に合わせ、以下を必ず守る:
 *  - 独自の User-Agent（連絡先入り）と Accept-Encoding: gzip を付与する
 *  - リクエスト間は最低 3 秒あける（自動化された連続アクセスを避ける）
 *  - captcha / Turnstile を回避するような処理は行わない
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient, type PlayerStatus } from "@prisma/client";
import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

import {
  TARGET_TEAMS,
  type TargetTeamDefinition,
} from "../src/lib/target-teams";

process.env.DATABASE_URL ??= "file:./dev.db";

const prisma = new PrismaClient();

const API_URL = "https://liquipedia.net/valorant/api.php";
const PAGE_BASE_URL = "https://liquipedia.net/valorant";
const DEFAULT_USER_AGENT =
  "ValorantRosterApp/1.0 (local-personal-tool; contact@example.com)";
const USER_AGENT =
  process.env.LIQUIPEDIA_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
const MIN_REQUEST_INTERVAL_MS = 3000;

type CliOptions = {
  dryRun: boolean;
  verbose: boolean;
  debug: boolean;
  fixture?: string;
  teamFilter?: string;
  timeoutMs: number;
  delayMs: number;
};

type ApiParseResponse = {
  parse?: {
    title?: string;
    pageid?: number;
    text?: { "*"?: string };
  };
  error?: {
    code?: string;
    info?: string;
  };
};

type RosterEntry = {
  handle: string;
  realName: string | null;
  role: string;
  status: PlayerStatus;
  country: string | null;
  /** Liquipedia の Join Date（YYYY-MM-DD）。不明なら null。 */
  startDate: string | null;
  /** Leave Date / Inactive Date（YYYY-MM-DD）。不明なら null。 */
  endDate: string | null;
  /** 現在もチームに在籍しているか。 */
  isCurrent: boolean;
  announcementUrl: string | null;
  tableLabel: string;
};

type TeamRoster = {
  team: TargetTeamDefinition;
  pageTitle: string;
  pageUrl: string;
  entries: RosterEntry[];
  warnings: string[];
};

type TableKind =
  | "active"
  | "inactive"
  | "former"
  | "organization"
  | "former-organization"
  | "substitute"
  | "unknown";

type TableBlock = {
  table: Cheerio<AnyNode>;
  title: string;
  heading: string;
  caption: string;
};

type ApplyStats = {
  teamsFetched: number;
  teamsFailed: number;
  entries: number;
  playersCreated: number;
  playersUpdated: number;
  membershipsCreated: number;
  membershipsUpdated: number;
  membershipsClosed: number;
  skipped: number;
  warnings: string[];
};

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
      getOption("delay") ?? process.env.LIQUIPEDIA_DELAY_MS ?? "3000",
      10,
    ) || MIN_REQUEST_INTERVAL_MS,
  );

  return {
    dryRun: hasFlag("dry-run"),
    verbose: hasFlag("verbose"),
    debug: hasFlag("debug"),
    fixture: getOption("fixture"),
    teamFilter: getOption("team"),
    timeoutMs:
      Number.parseInt(getOption("timeout") ?? "30000", 10) || 30000,
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

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function validDate(year: number, month: number, day?: number) {
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (year < 2010 || year > 2100 || month < 1 || month > 12) return null;

  if (day == null) return `${year}-${pad(month)}`;
  if (day < 1 || day > 31) return `${year}-${pad(month)}`;
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Liquipedia の日付表記を YYYY-MM-DD / YYYY-MM に正規化する。 */
export function normalizeDate(
  rawText: string,
  sortValue?: string | null,
): string | null {
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

  return null;
}

function toMonth(date: string | null | undefined) {
  return date ? date.slice(0, 7) : null;
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function nearestHeading(
  $: CheerioAPI,
  element: Cheerio<AnyNode>,
): string {
  let current: Cheerio<AnyNode> | null = element;

  for (let depth = 0; depth < 8 && current && current.length > 0; depth += 1) {
    const heading = current
      .prevAll("div.mw-heading, h2, h3, h4, h5, h6")
      .first();

    if (heading.length > 0) {
      return clean(heading.text()).replace(/\[\s*edit\s*\]/gi, "").trim();
    }

    current = current.parent();
  }

  return "";
}

function collectTableBlocks($: CheerioAPI): TableBlock[] {
  const blocks: TableBlock[] = [];
  const seen = new Set<AnyNode>();

  $(".table2").each((_, element) => {
    const wrapper = $(element);
    const table = wrapper.find("table").first();

    if (table.length === 0) return;
    const node = table.get(0);
    if (node) seen.add(node);

    blocks.push({
      table,
      title: clean(wrapper.find(".table2__title").first().text()),
      heading: nearestHeading($, wrapper),
      caption: clean(table.find("caption").first().text()),
    });
  });

  $("table.wikitable").each((_, element) => {
    if (seen.has(element)) return;
    const table = $(element);

    blocks.push({
      table,
      title: clean(table.attr("data-title")),
      heading: nearestHeading($, table),
      caption: clean(table.find("caption").first().text()),
    });
  });

  return blocks;
}

function findColumn(headers: string[], patterns: RegExp[]) {
  return headers.findIndex((header) =>
    patterns.some((pattern) => pattern.test(header)),
  );
}

function classifyTableKind(text: string): TableKind {
  const normalized = text.toLowerCase();

  if (/former.*organization|organization.*former/.test(normalized)) {
    return "former-organization";
  }
  if (/former|ex-/.test(normalized)) return "former";
  if (/inactive/.test(normalized)) return "inactive";
  if (/organization|staff|management/.test(normalized)) {
    return "organization";
  }
  if (/stand-?in|temporary|substitute|reserve|bench/.test(normalized)) {
    return "substitute";
  }
  if (/active|roster|player/.test(normalized)) return "active";
  return "unknown";
}

function isOrganizationKind(kind: TableKind) {
  return kind === "organization" || kind === "former-organization";
}

const STATUS_ROLE_MARKER =
  /^(inactive|retired|lft|fa|free\s+agent|stand-?in|substitute|reserve|bench|loan|trial|trialist|former|none|-)$/i;

const STAFF_ROLE_PATTERN =
  /player|coach|analyst|manager|igl|duelist|initiator|controller|sentinel|flex|stand-?in|substitute|reserve/i;

function resolveRole(kind: TableKind, roleText: string) {
  const text = clean(roleText);

  if (!text) {
    return isOrganizationKind(kind) ? "" : "Player";
  }

  if (STATUS_ROLE_MARKER.test(text)) {
    if (/stand-?in|substitute|reserve|bench/i.test(text)) {
      return "Stand-in";
    }
    return isOrganizationKind(kind) ? "" : "Player";
  }

  return text;
}

function resolveStatus(
  kind: TableKind,
  roleText: string,
  rowText: string,
): PlayerStatus {
  if (
    kind === "former" ||
    kind === "former-organization" ||
    kind === "inactive"
  ) {
    return "INACTIVE";
  }

  const text = `${roleText} ${rowText}`;

  if (/\bLFT\b|looking\s+for\s+team|移籍先募集/i.test(text)) return "LFT";
  if (/\bfree\s+agent\b|\bFA\b|フリーエージェント/.test(text)) return "FA";
  if (/\binactive\b|\bretired\b|引退|休止/i.test(text)) return "INACTIVE";
  if (
    /\bsub\b|substitute|reserve|stand-?in|bench|リザーブ|サブ/i.test(text)
  ) {
    return "SUB";
  }
  return "ACTIVE";
}

function extractHandle(
  $: CheerioAPI,
  cell: Cheerio<AnyNode>,
): string {
  if (!cell || cell.length === 0) return "";

  const inline = cell.find(".inline-player").first();
  const scope = inline.length > 0 ? inline : cell;
  const anchors = scope.find("a[href]").toArray();

  for (const element of anchors) {
    const anchor = $(element);
    const href = anchor.attr("href") ?? "";
    if (!href.includes("/valorant/")) continue;
    if (/\/(?:Category|Special|Portal|File|Template|Help):/i.test(href)) {
      continue;
    }

    const text = clean(anchor.text()) || clean(anchor.attr("title"));
    if (text) return text;
  }

  const clone = scope.clone();
  clone.find("sup, .reference, .flag, .mw-editsection").remove();
  return clean(clone.text()).replace(/\[\s*\d+\s*\]/g, "").trim();
}

function extractRealName(
  $: CheerioAPI,
  cell: Cheerio<AnyNode>,
): string | null {
  if (!cell || cell.length === 0) return null;

  const clone = cell.clone();
  clone.find("sup, .reference, .flag").remove();
  const text = clean(clone.text()).replace(/\[\s*\d+\s*\]/g, "").trim();
  return text || null;
}

function extractCountry(
  $: CheerioAPI,
  cell: Cheerio<AnyNode>,
): string | null {
  if (!cell || cell.length === 0) return null;

  const image = cell.find(".flag img, img.flag").first();
  const value =
    clean(image.attr("alt")) ||
    clean(image.attr("title")) ||
    clean(cell.find("[data-country]").first().attr("data-country"));

  return value || null;
}

function extractAnnouncementUrl(
  $: CheerioAPI,
  row: Cheerio<AnyNode>,
): string | null {
  const links = row.find("a.external[href], a[href^='http']").toArray();

  for (const element of links) {
    const href = clean($(element).attr("href"));
    if (/^https?:\/\//i.test(href)) return href;
  }

  return null;
}

function cellAt(
  $: CheerioAPI,
  cells: AnyNode[],
  index: number,
): Cheerio<AnyNode> | null {
  if (index < 0 || index >= cells.length) return null;
  return $(cells[index]);
}

function cellDate($: CheerioAPI, cell: Cheerio<AnyNode> | null) {
  if (!cell) return null;
  return normalizeDate(
    cell.text(),
    cell.attr("data-sort-value") ?? cell.attr("data-timestamp"),
  );
}

function parseTableBlock(
  $: CheerioAPI,
  block: TableBlock,
): { entries: RosterEntry[]; warnings: string[] } {
  const entries: RosterEntry[] = [];
  const warnings: string[] = [];
  const headerRow = block.table.find("tr").first();
  const headers = headerRow
    .find("th, td")
    .toArray()
    .map((cell) => clean($(cell).text()));

  const playerIndex = findColumn(headers, [
    /^id$|player|handle|選手|^name$/i,
  ]);
  if (playerIndex < 0) {
    return { entries, warnings };
  }

  const nameIndex = findColumn(headers, [/^name$|real\s*name|本名/i]);
  const explicitRoleIndex = findColumn(headers, [
    /role|position|役割/i,
  ]);
  const joinIndex = findColumn(headers, [
    /join|start|加入|入団|在籍開始/i,
  ]);
  const leaveIndex = findColumn(headers, [
    /leave|end|inactive|depart|退団|離脱|休止/i,
  ]);
  const statusIndex = findColumn(headers, [/status|状態/i]);

  // ロール列の見出しが空欄になっている Liquipedia の表に対応する。
  // 例: ID | (flag) | Name | (role) | Join Date | Leave Date
  let roleIndex = explicitRoleIndex;
  if (roleIndex < 0 && joinIndex > 0) {
    for (let index = joinIndex - 1; index > playerIndex; index -= 1) {
      if (!headers[index]) {
        roleIndex = index;
        break;
      }
    }
  }

  const contextText = [block.title, block.heading, block.caption]
    .filter(Boolean)
    .join(" ");
  let kind = classifyTableKind(contextText);

  if (kind === "unknown") {
    // 見出しが取れない場合でも、選手表の形をしていれば現役ロスターとみなす。
    if (
      headers.some((header) => /join|start|加入/i.test(header)) ||
      /player\s+roster/i.test(contextText)
    ) {
      kind = "active";
    }
  }

  // 選手表ではない表（大会結果など）を除外する。
  if (
    kind === "unknown" &&
    (joinIndex < 0 || (nameIndex < 0 && roleIndex < 0))
  ) {
    return { entries, warnings };
  }

  const rows = block.table.find("tbody tr, tr").toArray();

  for (const row of rows) {
    const rowNode = $(row);
    const cells = rowNode.find("td").toArray();
    if (cells.length === 0) continue;

    const playerCell =
      cellAt($, cells, playerIndex) ??
      cellAt($, cells, 0);
    if (!playerCell) continue;

    const handle = extractHandle($, playerCell);
    if (!handle) continue;
    if (/^(id|player|name|join date|leave date|status)$/i.test(handle)) {
      continue;
    }

    const roleCell = cellAt($, cells, roleIndex);
    const roleText = roleCell ? clean(roleCell.text()) : "";
    const rowClone = rowNode.clone();
    rowClone.find("sup, .reference, .mw-editsection").remove();
    const rowText = clean(rowClone.text()).slice(0, 500);
    const statusFromColumn =
      statusIndex >= 0
        ? clean(cellAt($, cells, statusIndex)?.text())
        : "";
    const status = resolveStatus(
      kind,
      `${roleText} ${statusFromColumn}`,
      rowText,
    );
    const role = resolveRole(kind, `${roleText} ${statusFromColumn}`);

    // Organization 表には CEO / Streamer / Owner なども並ぶため、
    // 選手・コーチ・アナリスト・マネージャー等だけをロスターとして扱う。
    if (isOrganizationKind(kind) && !STAFF_ROLE_PATTERN.test(role)) {
      continue;
    }

    const realName = nameIndex >= 0
      ? extractRealName($, cellAt($, cells, nameIndex) ?? $([]))
      : null;
    const startDate = cellDate($, cellAt($, cells, joinIndex));
    const endDate = cellDate($, cellAt($, cells, leaveIndex));
    const isCurrent =
      (kind === "active" ||
        kind === "organization" ||
        kind === "substitute") &&
      status !== "INACTIVE" &&
      status !== "LFT" &&
      status !== "FA" &&
      !endDate;

    entries.push({
      handle,
      realName,
      role: role || "Player",
      status,
      country: extractCountry($, playerCell),
      startDate,
      endDate,
      isCurrent,
      announcementUrl: extractAnnouncementUrl($, rowNode),
      tableLabel: block.title || block.heading || kind,
    });
  }

  return { entries, warnings };
}

/**
 * 現在の Liquipedia は table2 形式だが、旧レイアウトの roster-card や
 * 汎用的な wikitable も同じ選手情報として扱えるようにしている。
 */
export function parseTeamRosterHtml(
  html: string,
): { entries: RosterEntry[]; warnings: string[] } {
  const $ = load(html);
  const entries: RosterEntry[] = [];
  const warnings: string[] = [];
  const blocks = collectTableBlocks($);

  for (const block of blocks) {
    const parsed = parseTableBlock($, block);
    entries.push(...parsed.entries);
    warnings.push(...parsed.warnings);
  }

  // roster-card 形式（テーブルを使わない旧レイアウト）のフォールバック。
  $(".roster-card").each((_, element) => {
    const card = $(element);
    const rows = card
      .find(
        ".roster-card__player, .roster-card__member, .roster-card__row, li",
      )
      .toArray();

    for (const row of rows) {
      const rowNode = $(row);
      const playerCell = rowNode
        .find(".inline-player, .roster-card__player, .roster-card__name")
        .first();
      const scope = playerCell.length > 0 ? playerCell : rowNode;
      const handle = extractHandle($, scope);
      if (!handle) continue;

      const role = clean(
        rowNode
          .find(".roster-card__role, .roster-card__position")
          .first()
          .text(),
      );
      const rowText = clean(rowNode.text());
      const status = resolveStatus("active", role, rowText);

      entries.push({
        handle,
        realName: null,
        role: resolveRole("active", role),
        status,
        country: extractCountry($, scope),
        startDate: null,
        endDate: null,
        isCurrent: status === "ACTIVE" || status === "SUB",
        announcementUrl: extractAnnouncementUrl($, rowNode),
        tableLabel: "roster-card",
      });
    }
  });

  // 同じ選手・同じ加入月の重複行をまとめる。
  // Liquipedia は年別タブで同じスティントを再掲することがあり、
  // MembershipHistory の一意キー（playerId, teamId, startDate）とも揃える。
  const unique = new Map<string, RosterEntry>();
  for (const entry of entries) {
    const key = [
      entry.handle.toLowerCase(),
      toMonth(entry.startDate) ?? toMonth(entry.endDate) ?? "unknown",
    ].join("|");
    const existing = unique.get(key);
    if (!existing) {
      unique.set(key, entry);
      continue;
    }

    // 在籍中データを優先し、どちらも同じなら退団日が新しい方を残す。
    if (entry.isCurrent && !existing.isCurrent) {
      unique.set(key, entry);
    } else if (
      entry.isCurrent === existing.isCurrent &&
      (entry.endDate ?? "") > (existing.endDate ?? "")
    ) {
      unique.set(key, entry);
    }
  }

  return {
    entries: Array.from(unique.values()),
    warnings,
  };
}

class LiquipediaError extends Error {
  constructor(
    message: string,
    readonly kind:
      | "BLOCKED"
      | "RATE_LIMIT"
      | "HTTP"
      | "NETWORK"
      | "PARSE"
      | "MISSING_PAGE",
  ) {
    super(message);
    this.name = "LiquipediaError";
  }
}

let lastRequestAt = 0;

async function waitForRateLimit(options: CliOptions, purpose: string) {
  if (lastRequestAt === 0) return;

  // 前回のレスポンス完了後、必ず指定時間（既定 3 秒）以上の
  // ウェイトを挟んでから次のリクエストを送る。
  console.log(
    `  ⏳ rate limit: ${(options.delayMs / 1000).toFixed(1)}s 待機してから ${purpose} を取得します`,
  );
  await sleep(options.delayMs);
}

async function requestApi(
  page: string,
  options: CliOptions,
  purpose: string,
): Promise<{ title: string; html: string; rawBody: string }> {
  const url = `${API_URL}?action=parse&page=${encodeURIComponent(
    page,
  )}&prop=text&format=json`;
  const maxAttempts = 2;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await waitForRateLimit(options, purpose);

    try {
      const response = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(options.timeoutMs),
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Encoding": "gzip",
          Accept: "application/json",
        },
      });

      const body = await response.text();
      // 次のリクエストまで「レスポンス完了後」に 3 秒以上あける。
      lastRequestAt = Date.now();

      if (
        response.status === 403 ||
        /verify you are human|challenges\.cloudflare\.com\/turnstile/i.test(
          body,
        )
      ) {
        throw new LiquipediaError(
          `Liquipedia がアクセスをブロックしました (HTTP ${response.status})。Cloudflare Turnstile を自動回避することはできません。`,
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

        throw new LiquipediaError(
          `Rate limit (HTTP 429)。${Math.ceil(backoff / 1000)} 秒待機して再試行します。`,
          "RATE_LIMIT",
        );
      }

      if (!response.ok) {
        throw new LiquipediaError(
          `HTTP ${response.status} ${response.statusText} (${url})`,
          "HTTP",
        );
      }

      let json: ApiParseResponse;
      try {
        json = JSON.parse(body) as ApiParseResponse;
      } catch {
        throw new LiquipediaError(
          `API の JSON を解析できませんでした (${url})`,
          "PARSE",
        );
      }

      if (json.error) {
        const info = clean(json.error.info) || json.error.code || "unknown";
        const message = `MediaWiki API エラー: ${info} (page=${page})`;

        if (json.error.code === "missingtitle") {
          throw new LiquipediaError(message, "MISSING_PAGE");
        }
        throw new LiquipediaError(message, "HTTP");
      }

      const html = json.parse?.text?.["*"];
      if (!html) {
        throw new LiquipediaError(
          `API レスポンスに parse.text["*"] がありません (page=${page})`,
          "PARSE",
        );
      }

      return {
        title: clean(json.parse?.title) || page,
        html,
        rawBody: body,
      };
    } catch (error) {
      lastRequestAt = Date.now();
      lastError = error;
      const shouldRetry =
        attempt < maxAttempts &&
        error instanceof LiquipediaError &&
        (error.kind === "RATE_LIMIT" || error.kind === "HTTP");

      if (!shouldRetry) break;

      const backoff =
        error.kind === "RATE_LIMIT"
          ? options.delayMs * 2
          : options.delayMs;
      console.log(
        `  ⏳ 再試行 (${attempt}/${maxAttempts}): ${Math.ceil(
          backoff / 1000,
        )}s 待機`,
      );
      await sleep(backoff);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new LiquipediaError(
        `MediaWiki API からの取得に失敗しました (page=${page})`,
        "NETWORK",
      );
}

async function saveDebugBody(
  body: string,
  page: string,
  extension: "json" | "html",
) {
  const directory = path.join(process.cwd(), "scripts", ".cache");
  await mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = path.join(
    directory,
    `liquipedia-${page}-${stamp}.${extension}`,
  );
  await writeFile(fileName, body, "utf8");
  return fileName;
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

async function ensureTeam(
  team: TargetTeamDefinition,
  context: Awaited<ReturnType<typeof ensureBaseData>>,
) {
  const existing = await prisma.team.findFirst({
    where: {
      gameId: context.game.id,
      OR: [{ name: team.name }, { shortName: team.shortName }],
    },
  });

  if (existing) return existing;

  return prisma.team.create({
    data: {
      gameId: context.game.id,
      regionId: context.region.id,
      name: team.name,
      shortName: team.shortName,
      accent: team.accent,
      description: "Liquipedia MediaWiki API から自動登録された対象チーム",
      isActive: true,
    },
  });
}

type PlayerCache = Map<
  string,
  {
    id: string;
    handle: string;
    realName: string | null;
    country: string | null;
    status: PlayerStatus;
  }
>;

async function loadPlayerCache(gameId: string): Promise<PlayerCache> {
  const players = await prisma.player.findMany({
    where: { gameId },
    select: {
      id: true,
      handle: true,
      realName: true,
      country: true,
      status: true,
    },
  });

  return new Map(
    players.map((player) => [player.handle.toLowerCase(), player]),
  );
}

async function closeCurrentMemberships(
  playerId: string,
  exceptTeamId: string | null,
  endDate: string,
  stats: ApplyStats,
) {
  const current = await prisma.membershipHistory.findMany({
    where: {
      playerId,
      isCurrent: true,
      ...(exceptTeamId ? { NOT: { teamId: exceptTeamId } } : {}),
    },
  });

  for (const membership of current) {
    await prisma.membershipHistory.update({
      where: { id: membership.id },
      data: {
        isCurrent: false,
        endDate,
        sourceNote: "liquipedia:api (roster update)",
      },
    });
    stats.membershipsClosed += 1;
  }
}

async function ensurePlayer(
  entry: RosterEntry,
  context: Awaited<ReturnType<typeof ensureBaseData>>,
  cache: PlayerCache,
  stats: ApplyStats,
) {
  const key = entry.handle.toLowerCase();
  const cached = cache.get(key);

  if (cached) {
    const data: {
      realName?: string;
      country?: string;
      status?: PlayerStatus;
    } = {};

    if (entry.realName && entry.realName !== cached.realName) {
      data.realName = entry.realName;
    }
    if (entry.country && !cached.country) {
      data.country = entry.country;
    }
    if (entry.isCurrent && entry.status !== cached.status) {
      data.status = entry.status;
    }

    if (Object.keys(data).length > 0) {
      const updated = await prisma.player.update({
        where: { id: cached.id },
        data,
      });
      cached.realName = updated.realName;
      cached.country = updated.country;
      cached.status = updated.status;
      stats.playersUpdated += 1;
    }

    return updatedCacheEntry(cached);
  }

  const created = await prisma.player.create({
    data: {
      gameId: context.game.id,
      regionId: context.region.id,
      handle: entry.handle,
      realName: entry.realName,
      country: entry.country ?? "JP",
      status: entry.status,
      note: "Liquipedia MediaWiki API から自動取得",
    },
  });

  const cacheEntry = updatedCacheEntry(created);
  cache.set(key, cacheEntry);
  stats.playersCreated += 1;
  return cacheEntry;
}

function updatedCacheEntry(player: {
  id: string;
  handle: string;
  realName: string | null;
  country: string | null;
  status: PlayerStatus;
}) {
  return {
    id: player.id,
    handle: player.handle,
    realName: player.realName,
    country: player.country,
    status: player.status,
  };
}

async function upsertMembership(
  entry: RosterEntry,
  playerId: string,
  teamId: string,
  stats: ApplyStats,
) {
  const existingCurrent = entry.isCurrent
    ? await prisma.membershipHistory.findFirst({
        where: { playerId, teamId, isCurrent: true },
        select: { startDate: true },
      })
    : null;

  const startMonth =
    toMonth(entry.startDate) ??
    existingCurrent?.startDate ??
    (entry.isCurrent ? currentMonth() : null);

  if (!startMonth) {
    stats.skipped += 1;
    stats.warnings.push(
      `加入日不明のため所属履歴をスキップ: ${entry.handle} (${entry.tableLabel})`,
    );
    return;
  }

  const endMonth = entry.endDate
    ? toMonth(entry.endDate)
    : entry.isCurrent
      ? null
      : startMonth;

  if (entry.isCurrent) {
    // 同一選手の他チーム在籍中レコード、および同じチームの古い在籍レコードを閉じる。
    await closeCurrentMemberships(playerId, teamId, startMonth, stats);

    const sameTeamCurrent = await prisma.membershipHistory.findMany({
      where: {
        playerId,
        teamId,
        isCurrent: true,
        ...(startMonth ? { NOT: { startDate: startMonth } } : {}),
      },
    });

    for (const membership of sameTeamCurrent) {
      await prisma.membershipHistory.update({
        where: { id: membership.id },
        data: {
          isCurrent: false,
          endDate: startMonth,
          sourceNote: "liquipedia:api (roster update)",
        },
      });
      stats.membershipsClosed += 1;
    }
  }

  const existing = await prisma.membershipHistory.findUnique({
    where: {
      playerId_teamId_startDate: { playerId, teamId, startDate: startMonth },
    },
    select: { id: true },
  });

  await prisma.membershipHistory.upsert({
    where: {
      playerId_teamId_startDate: { playerId, teamId, startDate: startMonth },
    },
    update: {
      role: entry.role,
      endDate: endMonth,
      isCurrent: entry.isCurrent,
      announcementUrl: entry.announcementUrl,
      sourceNote: "liquipedia:api",
    },
    create: {
      playerId,
      teamId,
      role: entry.role,
      startDate: startMonth,
      endDate: endMonth,
      isCurrent: entry.isCurrent,
      announcementUrl: entry.announcementUrl,
      sourceNote: "liquipedia:api",
    },
  });

  if (existing) stats.membershipsUpdated += 1;
  else stats.membershipsCreated += 1;
}

async function applyTeamRoster(
  roster: TeamRoster,
  context: Awaited<ReturnType<typeof ensureBaseData>>,
  cache: PlayerCache,
  stats: ApplyStats,
) {
  const team = await ensureTeam(roster.team, context);
  const ordered = [...roster.entries].sort(
    (a, b) => Number(b.isCurrent) - Number(a.isCurrent),
  );

  for (const entry of ordered) {
    try {
      const player = await ensurePlayer(entry, context, cache, stats);
      await upsertMembership(entry, player.id, team.id, stats);
    } catch (error) {
      stats.skipped += 1;
      stats.warnings.push(
        `${roster.team.name} / ${entry.handle}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

function pickFinalStatus(entries: RosterEntry[]): PlayerStatus | null {
  const current = entries
    .filter((entry) => entry.isCurrent)
    .map((entry) => entry.status);

  if (current.includes("ACTIVE")) return "ACTIVE";
  if (current.includes("SUB")) return "SUB";
  if (current.includes("LFT")) return "LFT";
  if (current.includes("FA")) return "FA";
  if (entries.length > 0) return "INACTIVE";
  return null;
}

async function finalizePlayerStatuses(
  rosters: TeamRoster[],
  cache: PlayerCache,
  stats: ApplyStats,
) {
  const byHandle = new Map<string, RosterEntry[]>();

  for (const roster of rosters) {
    for (const entry of roster.entries) {
      const key = entry.handle.toLowerCase();
      const list = byHandle.get(key) ?? [];
      list.push(entry);
      byHandle.set(key, list);
    }
  }

  for (const [key, entries] of byHandle) {
    const player = cache.get(key);
    if (!player) continue;

    const status = pickFinalStatus(entries);
    if (!status || status === player.status) continue;

    const updated = await prisma.player.update({
      where: { id: player.id },
      data: { status },
    });
    player.status = updated.status;
    stats.playersUpdated += 1;
  }
}

function printTeamResult(roster: TeamRoster) {
  const counts = new Map<PlayerStatus, number>();
  for (const entry of roster.entries) {
    counts.set(entry.status, (counts.get(entry.status) ?? 0) + 1);
  }

  const summary = (
    ["ACTIVE", "SUB", "LFT", "FA", "INACTIVE"] as PlayerStatus[]
  )
    .filter((status) => (counts.get(status) ?? 0) > 0)
    .map((status) => `${status}=${counts.get(status)}`)
    .join(" / ");

  const uniquePlayers = new Set(
    roster.entries.map((entry) => entry.handle.toLowerCase()),
  ).size;

  console.log(
    `\n[${roster.team.name}] page=${roster.pageTitle} 取得=${roster.entries.length} 件 / 選手・スタッフ=${uniquePlayers} 名 (${summary || "0"})`,
  );

  if (roster.entries.length === 0) {
    console.log("  ⚠️  選手・スタッフを 1 名も抽出できませんでした");
    return;
  }

  const grouped = new Map<PlayerStatus, string[]>();
  for (const entry of roster.entries) {
    const names = grouped.get(entry.status) ?? [];
    names.push(
      entry.realName ? `${entry.handle} (${entry.realName})` : entry.handle,
    );
    grouped.set(entry.status, names);
  }

  for (const status of ["ACTIVE", "SUB", "LFT", "FA", "INACTIVE"] as PlayerStatus[]) {
    const names = grouped.get(status);
    if (!names || names.length === 0) continue;

    console.log(`  ${status} (${names.length}): ${names.join(", ")}`);
  }
}

async function fetchTeam(
  team: TargetTeamDefinition,
  options: CliOptions,
): Promise<TeamRoster> {
  const pageUrl = `${PAGE_BASE_URL}/${team.liquipediaPage}`;
  const { title, html, rawBody } = await requestApi(
    team.liquipediaPage,
    options,
    `${team.name} のロスター`,
  );

  if (options.debug) {
    const debugPath = await saveDebugBody(rawBody, team.liquipediaPage, "json");
    console.log(`  🐞 API レスポンスを保存しました: ${debugPath}`);
  }

  const parsed = parseTeamRosterHtml(html);
  return {
    team,
    pageTitle: title,
    pageUrl,
    entries: parsed.entries,
    warnings: parsed.warnings,
  };
}

async function fetchFromFixture(
  filePath: string,
  team: TargetTeamDefinition,
  options: CliOptions,
): Promise<TeamRoster> {
  const raw = await readFile(path.resolve(filePath), "utf8");
  const pageUrl = `${PAGE_BASE_URL}/${team.liquipediaPage}`;
  let html = raw;
  let title = team.name;

  if (raw.trimStart().startsWith("{")) {
    const json = JSON.parse(raw) as ApiParseResponse;
    if (json.error) {
      throw new LiquipediaError(
        `fixture の API エラー: ${json.error.info ?? json.error.code}`,
        json.error.code === "missingtitle" ? "MISSING_PAGE" : "PARSE",
      );
    }
    html = json.parse?.text?.["*"] ?? "";
    title = clean(json.parse?.title) || team.name;
  }

  if (!html) {
    throw new LiquipediaError(
      `fixture にロスター HTML が含まれていません: ${filePath}`,
      "PARSE",
    );
  }

  if (options.debug) {
    const debugPath = await saveDebugBody(html, team.liquipediaPage, "html");
    console.log(`  🐞 fixture HTML を保存しました: ${debugPath}`);
  }

  const parsed = parseTeamRosterHtml(html);
  return {
    team,
    pageTitle: title,
    pageUrl,
    entries: parsed.entries,
    warnings: parsed.warnings,
  };
}

function selectTeams(options: CliOptions) {
  if (!options.teamFilter) return [...TARGET_TEAMS];

  const normalized = options.teamFilter.toLowerCase();
  return TARGET_TEAMS.filter(
    (team) =>
      team.liquipediaPage.toLowerCase() === normalized ||
      team.name.toLowerCase() === normalized ||
      team.shortName.toLowerCase() === normalized,
  );
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const teams = selectTeams(options);

  console.log("──────────────────────────────────────────────");
  console.log(" VALO-ROSTER JP / Liquipedia MediaWiki API updater");
  console.log(` mode       : ${options.dryRun ? "DRY RUN" : "APPLY"}`);
  console.log(` source     : ${options.fixture ? `fixture:${options.fixture}` : API_URL}`);
  console.log(` user-agent : ${USER_AGENT}`);
  console.log(
    ` rate limit : ${options.delayMs}ms (Liquipedia 規約に合わせ最低 ${MIN_REQUEST_INTERVAL_MS}ms)`,
  );
  console.log(` target     : ${teams.map((team) => team.shortName).join(" / ")}`);
  console.log("──────────────────────────────────────────────");

  if (!/\([^)]*(?:@|https?:\/\/)[^)]*\)/.test(USER_AGENT)) {
    throw new Error(
      "User-Agent に連絡先（メールアドレスまたは URL）を括弧書きで含めてください。例: ValorantRosterApp/1.0 (local-personal-tool; contact@example.com)",
    );
  }

  if (teams.length === 0) {
    throw new Error(
      `対象チームが見つかりません: ${options.teamFilter ?? "(未指定)"}`,
    );
  }

  const context = await ensureBaseData();
  const cache = await loadPlayerCache(context.game.id);
  const stats: ApplyStats = {
    teamsFetched: 0,
    teamsFailed: 0,
    entries: 0,
    playersCreated: 0,
    playersUpdated: 0,
    membershipsCreated: 0,
    membershipsUpdated: 0,
    membershipsClosed: 0,
    skipped: 0,
    warnings: [],
  };

  const updateLog = options.dryRun
    ? null
    : await prisma.updateLog.create({
        data: {
          source: "liquipedia:api",
          status: "RUNNING",
          message: "MediaWiki API から対象4チームのロスターを取得中",
        },
      });

  let status: "SUCCESS" | "PARTIAL" | "FAILED" = "SUCCESS";
  const rosters: TeamRoster[] = [];

  try {
    for (const [index, team] of teams.entries()) {
      console.log(
        `\n[${index + 1}/${teams.length}] ${team.name} (page=${team.liquipediaPage})`,
      );

      try {
        const roster = options.fixture
          ? await fetchFromFixture(options.fixture, team, options)
          : await fetchTeam(team, options);

        rosters.push(roster);
        stats.teamsFetched += 1;
        stats.entries += roster.entries.length;
        stats.warnings.push(...roster.warnings);
        printTeamResult(roster);

        if (!options.dryRun) {
          await applyTeamRoster(roster, context, cache, stats);
        }
      } catch (error) {
        stats.teamsFailed += 1;
        const message = `${
          error instanceof Error ? error.message : String(error)
        }`;
        stats.warnings.push(`${team.name}: ${message}`);
        console.error(`  ❌ ${team.name}: ${message}`);

        if (
          error instanceof LiquipediaError &&
          error.kind === "BLOCKED"
        ) {
          console.error(
            "   Cloudflare Turnstile は自動回避しません。時間を置くか、ブラウザで一度ページを開いてから再実行してください。",
          );
        }
      }
    }

    if (!options.dryRun && rosters.length > 0) {
      await finalizePlayerStatuses(rosters, cache, stats);
    }

    if (stats.teamsFetched === 0) {
      status = "FAILED";
    } else if (
      stats.teamsFailed > 0 ||
      stats.skipped > 0 ||
      stats.warnings.some((warning) => /できませんでした|失敗/.test(warning))
    ) {
      status = "PARTIAL";
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
  }

  const summary = [
    `teams=${stats.teamsFetched}/${teams.length}`,
    `entries=${stats.entries}`,
    `players+${stats.playersCreated}~${stats.playersUpdated}`,
    `memberships+${stats.membershipsCreated}~${stats.membershipsUpdated}/-${stats.membershipsClosed}`,
    `skipped=${stats.skipped}`,
  ].join(" ");

  console.log("\n──────────────────────────────────────────────");
  console.log(` summary: ${status} / ${summary}`);
  console.log(
    options.dryRun
      ? " DB writes skipped (dry-run)"
      : " Player / MembershipHistory / UpdateLog を保存しました",
  );

  const warningLimit = options.verbose ? stats.warnings.length : 30;
  for (const warning of stats.warnings.slice(0, warningLimit)) {
    console.log(`  ⚠️  ${warning}`);
  }
  if (stats.warnings.length > warningLimit) {
    console.log(
      `  ⚠️  ... 他 ${stats.warnings.length - warningLimit} 件（--verbose で全件表示）`,
    );
  }
  console.log("──────────────────────────────────────────────");

  if (updateLog) {
    await prisma.updateLog.update({
      where: { id: updateLog.id },
      data: {
        status,
        message: `${summary} | ${stats.warnings
          .slice(0, 5)
          .join(" / ")}`.slice(0, 2000),
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
          source: "liquipedia:api",
          status: "FAILED",
          message:
            error instanceof Error
              ? error.message.slice(0, 2000)
              : String(error),
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
