/**
 * Liquipedia (VALORANT) の MediaWiki API から日本の主要チームのロスターを取得し、
 * ローカル SQLite (Prisma) に Upsert する。
 *
 * 実行:
 *   npm run update:valo                  # API から日本チームを取得して DB 更新（画像なし）
 *   npm run update:valo -- --dry-run     # 取得・解析のみ（DB 更新なし）
 *   npm run update:valo -- --verbose     # 取得した全選手を表示
 *   npm run update:valo -- --force       # キャッシュ・24時間 TTL を無視して強制再取得
 *   npm run update:valo -- --offline     # ローカルキャッシュのみで再パース（通信なし）
 *   npm run update:valo -- --limit 3     # 先頭3チームのみ取得（テスト用）
 *   npm run update:valo -- --team=ZETA_DIVISION  # 特定チームのみ取得
 *   npm run update:valo -- --with-images # チームロゴ・選手顔写真も取得
 *   npm run update:fixture               # ローカル fixture で動作確認
 *
 * API レスポンスは data/liquipedia-cache/ にローカル保存される。
 * 既定実行ではキャッシュがあれば外部通信せず、30 秒待機もスキップして再パースする。
 *
 * Liquipedia の利用規約に合わせ、以下を必ず守る:
 *  - 独自の User-Agent（連絡先先入り）・Accept・Accept-Encoding を付与する
 *  - API・検索・順位表・画像を含む全通信で 30 秒以上の間隔をあける
 *    （scripts/lib/liquipedia-client.ts の共通リミッターを必ず経由する）
 *  - 429 を検知したらリトライせず、以降の全通信を停止して取得済みデータのみ保存する
 *  - captcha / Turnstile を回避するような処理は行わない
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  PrismaClient,
  type PlayerStatus,
  type StaffCategory,
  type TransferType,
} from "@prisma/client";
import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

import { getCountryMeta } from "../src/lib/nationality";
import { getRosterCategory, isRosterRole } from "../src/lib/roles";
import {
  TARGET_TEAMS,
  type TargetTeamDefinition,
} from "../src/lib/target-teams";
import {
  fetchLiquipediaTextWithCache,
  hasLiquipediaCache,
} from "./lib/liquipedia-cache";
import {
  fetchLiquipediaBinary,
  IMAGE_ACCEPT,
  isRateLimited,
  LiquipediaError,
  MIN_REQUEST_INTERVAL_MS,
  playerAvatarPath,
  resolveExistingImagePath,
  resolveUserAgent,
  teamLogoPath,
  validateUserAgent,
} from "./lib/liquipedia-client";
import {
  fetchAndSaveStandingsForGame,
  LiquipediaError as StandingsLiquipediaError,
} from "./lib/standings-fetcher";

process.env.DATABASE_URL ??= "file:./dev.db";

const prisma = new PrismaClient();

const BASE_URL = "https://liquipedia.net";
const API_URL = `${BASE_URL}/valorant/api.php`;
const PAGE_BASE_URL = `${BASE_URL}/valorant`;
const LOGO_DIR = path.join(process.cwd(), "public", "logos");
const PLAYER_AVATAR_DIR = path.join(process.cwd(), "public", "players");
const USER_AGENT = resolveUserAgent();
const TEAM_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CliOptions = {
  dryRun: boolean;
  verbose: boolean;
  debug: boolean;
  force: boolean;
  /** ローカルキャッシュのみを使い、外部通信を一切行わない。 */
  offline: boolean;
  /** 顔写真・新規ロゴもダウンロードする（既定はスキップ）。 */
  withImages: boolean;
  /** 取得するチーム数の上限（テスト用）。 */
  limit: number | null;
  fixture?: string;
  teamFilter?: string;
  /** 取得対象地域。valo=VALORANT 日本チーム、未指定時は valo。 */
  region?: "valo" | "all";
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
  nationality: string | null;
  /** Liquipedia の Join Date（YYYY-MM-DD）。不明なら null。 */
  startDate: string | null;
  /** Leave Date / Inactive Date（YYYY-MM-DD）。不明なら null。 */
  endDate: string | null;
  /** 現在もチームに在籍しているか。 */
  isCurrent: boolean;
  announcementUrl: string | null;
  tableLabel: string;
  /** 選手顔写真の Liquipedia 画像 URL。未検出なら null。 */
  avatarSourceUrl: string | null;
};

type TeamRoster = {
  team: TargetTeamDefinition;
  pageTitle: string;
  pageUrl: string;
  entries: RosterEntry[];
  warnings: string[];
  /** インフォボックスから抽出したロゴ画像の絶対 URL。未検出なら null。 */
  logoSourceUrl: string | null;
  achievements: ParsedAchievement[];
  matches: ParsedMatch[];
};

type ParsedAchievement = {
  tier: string;
  tournament: string;
  placement: string;
  prize: string | null;
  date: string;
  sourceUrl: string | null;
  sourceTitle: string | null;
};

type ParsedMatch = {
  opponentTeamName: string;
  opponentTeamShortName: string | null;
  opponentTeamLogoUrl: string | null;
  isWin: boolean | null;
  score: string | null;
  date: string;
  streamUrl: string | null;
  status: "RECENT" | "UPCOMING";
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
  achievementsCreated: number;
  matchesCreated: number;
  standingsCreated: number;
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
      getOption("delay") ?? process.env.LIQUIPEDIA_DELAY_MS ?? `${MIN_REQUEST_INTERVAL_MS}`,
      10,
    ) || MIN_REQUEST_INTERVAL_MS,
  );

  const rawRegion = (getOption("region") ?? "valo").toLowerCase();
  const region: CliOptions["region"] =
    rawRegion === "valo" || rawRegion === "jp" || rawRegion === "pacific"
      ? "valo"
      : "all";
  const rawLimit = Number.parseInt(getOption("limit") ?? "", 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : null;

  return {
    dryRun: hasFlag("dry-run"),
    verbose: hasFlag("verbose"),
    debug: hasFlag("debug"),
    force: hasFlag("force"),
    offline: hasFlag("offline"),
    withImages: hasFlag("with-images"),
    limit,
    fixture: getOption("fixture"),
    teamFilter: getOption("team"),
    region,
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
  if (/organization|staff|management|content\s*creators?|streamers?/.test(
    normalized,
  )) {
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

const VALORANT_ROLE_PATTERN =
  /\b(Duelist|Initiator|Controller|Sentinel|Flex|IGL)\b/i;

function extractValorantRole(text: string): string | null {
  const match = VALORANT_ROLE_PATTERN.exec(text);
  if (match) {
    return match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
  }
  return null;
}

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

  const valorantRole = extractValorantRole(text);
  if (valorantRole) return valorantRole;

  return text;
}

const STREAMER_PATTERN = /streamer|content\s*creator|creator/i;

function isStreamerRole(role: string | null | undefined) {
  if (!role) return false;
  return STREAMER_PATTERN.test(role);
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

function extractCountryCodeFromSrc(src: string | undefined): string | null {
  if (!src) return null;
  const match = /\/flag\/([a-z]{2})\.png/i.exec(src);
  return match?.[1]?.toUpperCase() ?? null;
}

function extractCountry(
  $: CheerioAPI,
  cell: Cheerio<AnyNode>,
): string | null {
  if (!cell || cell.length === 0) return null;

  const image = cell.find(".flag img, img.flag").first();
  const src = clean(image.attr("src") ?? image.attr("data-src"));
  const value =
    extractCountryCodeFromSrc(src) ||
    clean(image.attr("alt")) ||
    clean(image.attr("title")) ||
    clean(cell.find("[data-country]").first().attr("data-country"));

  if (!value) return null;

  // 国名やゆらぎを ISO 3166-1 alpha-2 風の2文字コードに正規化する。
  const meta = getCountryMeta(value);
  return meta?.code ?? value.toUpperCase();
}

function resolveImageUrl(src: string | undefined): string | null {
  if (!src) return null;
  const cleanSrc = clean(src);
  if (/^https?:\/\//i.test(cleanSrc)) return cleanSrc;
  if (cleanSrc.startsWith("//")) return `https:${cleanSrc}`;
  if (cleanSrc.startsWith("/")) return `${BASE_URL}${cleanSrc}`;
  return new URL(cleanSrc, BASE_URL).toString();
}

function extractPlayerAvatarUrl(
  $: CheerioAPI,
  playerCell: Cheerio<AnyNode>,
): string | null {
  if (!playerCell || playerCell.length === 0) return null;

  // 選手セル内の画像を優先（.inline-player 内や直近の img）
  const inline = playerCell.find(".inline-player").first();
  const scope = inline.length > 0 ? inline : playerCell;
  const image = scope.find("img").first();
  const src = clean(image.attr("src") ?? image.attr("data-src"));
  return resolveImageUrl(src);
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
  const noteIndex = findColumn(headers, [/note|備考|comment/i]);

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
  const isContentCreatorSection =
    /content\s*creators?|streamers?/i.test(contextText);
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
    const noteFromColumn =
      noteIndex >= 0
        ? clean(cellAt($, cells, noteIndex)?.text())
        : "";

    // Streamer / Content Creator は role 列・備考欄・行テキストから検出し、
    // staffCategory="STAFF" として扱うため role テキストを統一する。
    const combinedRoleText = `${roleText} ${statusFromColumn} ${noteFromColumn}`;
    const detectedRole =
      isStreamerRole(combinedRoleText) ||
      isStreamerRole(rowText) ||
      (isContentCreatorSection && !roleText && !statusFromColumn && !noteFromColumn)
        ? "Streamer"
        : combinedRoleText;

    const status = resolveStatus(kind, detectedRole, rowText);
    const role = resolveRole(kind, detectedRole);

    // 表示対象は選手（Player / Duelist / IGL 等）とコーチのみ。
    // Manager / Analyst / Streamer / CEO / Director などのスタッフはスキップする。
    if (!isRosterRole(role)) {
      continue;
    }
    if (isOrganizationKind(kind) && !role) {
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

    const country = extractCountry($, playerCell);

    entries.push({
      handle,
      realName,
      role: role || "Player",
      status,
      country,
      nationality: country,
      startDate,
      endDate,
      isCurrent,
      announcementUrl: extractAnnouncementUrl($, rowNode),
      tableLabel: block.title || block.heading || kind,
      avatarSourceUrl: extractPlayerAvatarUrl($, playerCell),
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

      const country = extractCountry($, scope);

      entries.push({
        handle,
        realName: null,
        role: resolveRole("active", role),
        status,
        country,
        nationality: country,
        startDate: null,
        endDate: null,
        isCurrent: status === "ACTIVE" || status === "SUB",
        announcementUrl: extractAnnouncementUrl($, rowNode),
        tableLabel: "roster-card",
        avatarSourceUrl: extractPlayerAvatarUrl($, scope),
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

/**
 * チームページのインフォボックスからロゴ画像の URL を抽出する。
 * ダークテーマ用ロゴを優先し、無ければライトテーマ / 汎用画像にフォールバックする。
 */
export function extractTeamLogoUrl(html: string): string | null {
  const $ = load(html);
  const selectors = [
    ".infobox-image.darkmode img",
    ".infobox-image img",
    ".fo-nttax-infobox .infobox-image img",
    ".fo-nttax-infobox img",
    ".infobox img",
  ];

  for (const selector of selectors) {
    const image = $(selector).first();
    if (image.length === 0) continue;

    const src = clean(image.attr("src") ?? image.attr("data-src"));
    if (!src) continue;
    if (/^https?:\/\//i.test(src)) return src;
    if (src.startsWith("//")) return `https:${src}`;
    if (src.startsWith("/")) return `${BASE_URL}${src}`;
    return new URL(src, BASE_URL).toString();
  }

  return null;
}

function sectionHeading($: CheerioAPI, keywords: RegExp[]): Cheerio<AnyNode> | null {
  const headings = $("h2, h3, h4, div.mw-heading").toArray();
  for (const element of headings) {
    const heading = $(element);
    const text = clean(heading.text()).toLowerCase();
    if (keywords.some((pattern) => pattern.test(text))) {
      return heading;
    }
  }
  return null;
}

function nextTableAfter(
  $: CheerioAPI,
  heading: Cheerio<AnyNode>,
): Cheerio<AnyNode> | null {
  let cursor: Cheerio<AnyNode> | null = heading;
  for (let step = 0; step < 12 && cursor && cursor.length > 0; step += 1) {
    const sibling: Cheerio<AnyNode> = cursor.next();
    if (sibling.length === 0) {
      cursor = cursor.parent();
      continue;
    }

    const table = sibling.is("table.wikitable")
      ? sibling
      : sibling.find("table.wikitable").first();
    if (table.length > 0) return table;

    const table2 = sibling.is(".table2")
      ? sibling
      : sibling.find(".table2").first();
    if (table2.length > 0) {
      const nested = table2.find("table").first();
      return nested.length > 0 ? nested : null;
    }

    cursor = sibling;
  }
  return null;
}

function normalizeColumns(headers: string[]): string[] {
  return headers.map((header) =>
    clean(header)
      .toLowerCase()
      .replace(/[\[\]\(\)]/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function columnIndex(columns: string[], patterns: RegExp[]): number {
  return columns.findIndex((column) =>
    patterns.some((pattern) => pattern.test(column)),
  );
}

function extractText($: CheerioAPI, cell: Cheerio<AnyNode>): string {
  const clone = cell.clone();
  clone.find("sup, .reference, .mw-editsection, .flag").remove();
  return clean(clone.text());
}

function parsePrize(text: string): string | null {
  const normalized = clean(text);
  if (!normalized || /^[-—]$/.test(normalized)) return null;
  return normalized;
}

function parseScore(text: string): {
  score: string | null;
  isWin: boolean | null;
} {
  const normalized = clean(text).replace(/\s+/g, "");
  if (!normalized) return { score: null, isWin: null };

  // W / L 表記
  if (/^w$/i.test(normalized)) return { score: "W", isWin: true };
  if (/^l$/i.test(normalized)) return { score: "L", isWin: false };

  // 一般的な "2-1" / "2:1" / "2 - 1" 形式。前半が対象チームのスコア。
  const match =
    /^(\d+(?:\.\d+)?)[:\-–—]\s*(\d+(?:\.\d+)?)$/.exec(normalized) ??
    /^(\d+)\s*-\s*(\d+)$/.exec(normalized);
  if (match) {
    const teamScore = Number.parseFloat(match[1]);
    const opponentScore = Number.parseFloat(match[2]);
    const isWin =
      Number.isFinite(teamScore) && Number.isFinite(opponentScore)
        ? teamScore > opponentScore
        : null;
    return { score: `${match[1]} - ${match[2]}`, isWin };
  }

  return { score: normalized, isWin: null };
}

function extractOpponentLogoUrl(
  $: CheerioAPI,
  cell: Cheerio<AnyNode>,
): string | null {
  const image = cell.find("img").first();
  const src = clean(image.attr("src") ?? image.attr("data-src"));
  return resolveImageUrl(src);
}

function extractMatchStreamUrl(
  $: CheerioAPI,
  cell: Cheerio<AnyNode>,
): string | null {
  const anchors = cell.find("a[href]").toArray();
  for (const element of anchors) {
    const href = clean($(element).attr("href"));
    if (/youtube\.com\/watch|youtu\.be\//i.test(href)) {
      return href.startsWith("http") ? href : `${BASE_URL}${href}`;
    }
  }
  return null;
}

function buildYouTubeSearchUrl(
  teamName: string,
  opponentName: string,
  tournament?: string | null,
): string {
  const query = [teamName, "vs", opponentName, tournament]
    .filter(Boolean)
    .join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function parseTableAchievements(
  $: CheerioAPI,
  table: Cheerio<AnyNode>,
): ParsedAchievement[] {
  const achievements: ParsedAchievement[] = [];
  const headerRow = table.find("tr").first();
  const headers = headerRow
    .find("th, td")
    .toArray()
    .map((cell) => extractText($, $(cell)));
  const columns = normalizeColumns(headers);

  const placeIndex = columnIndex(columns, [/place|placement|順位|^#$/]);
  const tierIndex = columnIndex(columns, [/tier|規模/]);
  const tournamentIndex = columnIndex(columns, [/tournament|大会|event/]);
  const dateIndex = columnIndex(columns, [/date|日付|year/]);
  const prizeIndex = columnIndex(columns, [/prize|賞金|winnings/]);

  // 列特定に失敗した場合は汎用パースを諦めて安全に返す。
  if (placeIndex < 0 && tournamentIndex < 0) return achievements;

  const rows = table.find("tr").toArray().slice(1);
  for (const row of rows) {
    const cells = $(row).find("td").toArray();
    if (cells.length === 0) continue;

    const placement = placeIndex >= 0 ? extractText($, $(cells[placeIndex])) : "";
    const tournament =
      tournamentIndex >= 0
        ? extractText($, $(cells[tournamentIndex]))
        : "";
    if (!tournament && !placement) continue;

    const rawDate = dateIndex >= 0 ? extractText($, $(cells[dateIndex])) : "";
    const date = normalizeDate(rawDate) ?? "2000-01";

    achievements.push({
      tier: tierIndex >= 0 ? extractText($, $(cells[tierIndex])) : "",
      tournament: tournament || placement,
      placement: placement || "-",
      prize: prizeIndex >= 0 ? parsePrize(extractText($, $(cells[prizeIndex]))) : null,
      date,
      sourceUrl: null,
      sourceTitle: null,
    });
  }

  return achievements;
}

export function parseTeamAchievements(html: string): ParsedAchievement[] {
  const $ = load(html);
  const heading = sectionHeading($, [/achievements|achiev|実績/]);
  if (!heading) return [];

  const table = nextTableAfter($, heading);
  if (!table) return [];

  return parseTableAchievements($, table);
}

function parseTableMatches(
  $: CheerioAPI,
  table: Cheerio<AnyNode>,
  teamName: string,
): ParsedMatch[] {
  const matches: ParsedMatch[] = [];
  const headerRow = table.find("tr").first();
  const headers = headerRow
    .find("th, td")
    .toArray()
    .map((cell) => extractText($, $(cell)));
  const columns = normalizeColumns(headers);

  const dateIndex = columnIndex(columns, [/date|日付|time|日時/]);
  const tournamentIndex = columnIndex(columns, [/tournament|大会|event|league/]);
  const opponentIndex = columnIndex(columns, [/opponent|vs|相手|enemy|team/]);
  const scoreIndex = columnIndex(columns, [/score|result|結果|series|スコア/]);
  const vodIndex = columnIndex(columns, [/vod|links|link|配信|watch|video/]);

  // 対戦相手列またはスコア列がなければマッチ表とみなさない。
  if (opponentIndex < 0 && scoreIndex < 0) return matches;

  const now = new Date().toISOString().slice(0, 10);
  const rows = table.find("tr").toArray().slice(1);

  for (const row of rows) {
    const cells = $(row).find("td").toArray();
    if (cells.length === 0) continue;

    const opponentCell =
      opponentIndex >= 0 ? $(cells[opponentIndex]) : $(cells[0]);
    const opponentTeamName = extractText($, opponentCell) || "Unknown";
    if (/^date$|^opponent$|^score$|^tournament$/i.test(opponentTeamName)) {
      continue;
    }

    const rawDate = dateIndex >= 0 ? extractText($, $(cells[dateIndex])) : "";
    const rawScore = scoreIndex >= 0 ? extractText($, $(cells[scoreIndex])) : "";
    const { score, isWin } = parseScore(rawScore);

    let streamUrl: string | null = null;
    if (vodIndex >= 0) {
      streamUrl = extractMatchStreamUrl($, $(cells[vodIndex]));
    }
    if (!streamUrl) {
      // VOD列がなくても、行全体から YouTube リンクを探す。
      streamUrl = extractMatchStreamUrl($, $(row));
    }
    if (!streamUrl) {
      const tournament =
        tournamentIndex >= 0 ? extractText($, $(cells[tournamentIndex])) : null;
      streamUrl = buildYouTubeSearchUrl(teamName, opponentTeamName, tournament);
    }

    const date = normalizeDate(rawDate) ?? now;
    const status: "RECENT" | "UPCOMING" =
      isWin === null && date >= now ? "UPCOMING" : "RECENT";

    matches.push({
      opponentTeamName,
      opponentTeamShortName: null,
      opponentTeamLogoUrl: extractOpponentLogoUrl($, opponentCell),
      isWin,
      score,
      date,
      streamUrl,
      status,
    });
  }

  return matches;
}

export function parseTeamMatches(
  html: string,
  teamName: string,
): ParsedMatch[] {
  const $ = load(html);
  const heading = sectionHeading($, [/matches|match\s*history|試合/]);
  if (!heading) return [];

  const table = nextTableAfter($, heading);
  if (!table) return [];

  return parseTableMatches($, table, teamName);
}

async function shouldSkipTeamUpdate(
  team: TargetTeamDefinition,
  options: CliOptions,
): Promise<boolean> {
  if (options.force || options.dryRun || options.fixture) return false;

  // ローカルキャッシュがある場合は 24 時間 TTL を無視し、
  // 通信せずキャッシュから即座に再パース・DB 保存する（オフライン再構築対応）。
  if (await hasLiquipediaCache("valorant", "parse", team.liquipediaPage)) {
    return false;
  }

  // 他タイトル（LoL / Identity V 等）に同じ shortName のチームが存在しても
  // 誤ってスキップしないよう、必ず同一ゲーム内で判定する。
  const existing = await prisma.team.findFirst({
    where: {
      shortName: team.shortName,
      game: { slug: "valorant" },
    },
    select: { updatedAt: true },
  });

  if (!existing) return false;

  const elapsed = Date.now() - existing.updatedAt.getTime();
  return elapsed < TEAM_CACHE_TTL_MS;
}

async function requestApi(
  page: string,
  options: CliOptions,
  purpose: string,
): Promise<{ title: string; html: string; rawBody: string }> {
  const url = `${API_URL}?action=parse&page=${encodeURIComponent(
    page,
  )}&prop=text&redirects=1&format=json`;
  const maxAttempts = 2;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      // キャッシュ優先取得。通信時は共通リミッターが 30 秒間隔・
      // User-Agent・Accept・429 即停止を担保する。
      const { text: body } = await fetchLiquipediaTextWithCache({
        game: "valorant",
        kind: "parse",
        page,
        purpose,
        url,
        force: options.force,
        offline: options.offline,
        delayMs: options.delayMs,
        timeoutMs: options.timeoutMs,
      });

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
      lastError = error;
      const shouldRetry =
        attempt < maxAttempts &&
        error instanceof LiquipediaError &&
        error.kind === "HTTP";

      if (!shouldRetry) break;

      const backoff = options.delayMs;
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

/**
 * Liquipedia のロゴ画像を public/logos/{logoSlug}.png に保存する。
 * 外部 URL への直リンクによるホットリンク制限を避けるため、必ずローカル保存する。
 *
 * 既定（--with-images なし）では新規ダウンロードを行わない。
 * 既にローカルへ保存済みのファイルがあればそのパスを再利用する。
 */
async function downloadTeamLogo(
  team: TargetTeamDefinition,
  sourceUrl: string | null,
  options: CliOptions,
  stats: ApplyStats,
): Promise<string | null> {
  const existing = await resolveExistingImagePath(teamLogoPath(team.logoSlug));
  if (existing) {
    if (options.verbose) console.log(`  ♻️  既存ロゴを再利用: ${existing}`);
    return existing;
  }

  if (!options.withImages || !sourceUrl) return null;

  if (options.offline) {
    if (options.verbose) {
      console.log(
        `  📭 [OFFLINE] ${team.name} のロゴ画像ダウンロードをスキップします`,
      );
    }
    return null;
  }

  try {
    await mkdir(LOGO_DIR, { recursive: true });

    const { data } = await fetchLiquipediaBinary(sourceUrl, {
      purpose: `${team.name} のロゴ画像`,
      delayMs: options.delayMs,
      timeoutMs: options.timeoutMs,
      accept: IMAGE_ACCEPT,
    });

    const fileName = `${team.logoSlug}.png`;
    await writeFile(path.join(LOGO_DIR, fileName), data);
    const localPath = `/logos/${fileName}`;
    console.log(`  🖼️  ロゴを保存しました: ${localPath} (${sourceUrl})`);
    return localPath;
  } catch (error) {
    if (error instanceof LiquipediaError && error.kind === "RATE_LIMIT") {
      stats.warnings.push(`${team.name}: ${error.message}`);
      console.warn(`  ⚠️  ${team.name}: ${error.message}`);
      return null;
    }
    const message = error instanceof Error ? error.message : String(error);
    stats.warnings.push(`${team.name}: ロゴ取得に失敗 (${message})`);
    console.warn(`  ⚠️  ロゴ取得に失敗: ${team.name} (${message})`);
    return null;
  }
}

async function downloadPlayerAvatar(
  handle: string,
  sourceUrl: string | null,
  options: CliOptions,
  stats: ApplyStats,
): Promise<string | null> {
  const existing = await resolveExistingImagePath(playerAvatarPath(handle));
  if (existing) {
    if (options.verbose) console.log(`  ♻️  既存の顔写真を再利用: ${existing}`);
    return existing;
  }

  if (!sourceUrl || !options.withImages) return null;

  if (options.offline) {
    if (options.verbose) {
      console.log(
        `  📭 [OFFLINE] ${handle} の顔写真ダウンロードをスキップします`,
      );
    }
    return null;
  }

  try {
    await mkdir(PLAYER_AVATAR_DIR, { recursive: true });

    const { data } = await fetchLiquipediaBinary(sourceUrl, {
      purpose: `${handle} の顔写真`,
      delayMs: options.delayMs,
      timeoutMs: options.timeoutMs,
      accept: IMAGE_ACCEPT,
    });

    const fileName = `${handle.replace(/[^a-zA-Z0-9_-]/g, "_")}.png`;
    await writeFile(path.join(PLAYER_AVATAR_DIR, fileName), data);
    const localPath = `/players/${fileName}`;
    console.log(`  🖼️  選手顔写真を保存しました: ${localPath}`);
    return localPath;
  } catch (error) {
    if (error instanceof LiquipediaError && error.kind === "RATE_LIMIT") {
      stats.warnings.push(`${handle}: ${error.message}`);
      console.warn(`  ⚠️  ${handle}: ${error.message}`);
      return null;
    }
    const message = error instanceof Error ? error.message : String(error);
    stats.warnings.push(`${handle}: 顔写真取得に失敗 (${message})`);
    console.warn(`  ⚠️  顔写真取得に失敗: ${handle} (${message})`);
    return null;
  }
}

/**
 * 取得前のクリーンアップ。
 * 指定地域（regionCode）に該当する Team / Player とそれに紐づく
 * MembershipHistory / TransferEvent のみを削除する。
 * 外部キー制約に違反しないよう TransferEvent → MembershipHistory → Player → Team の順。
 */
async function cleanupExistingRecords(regionCode: string) {
  const region = await prisma.region.findUnique({
    where: { code: regionCode },
    select: { id: true },
  });

  if (!region) {
    console.log(`  ℹ️  地域 ${regionCode} のレコードは存在しません（初回実行）`);
    return {
      transferEvents: 0,
      memberships: 0,
      players: 0,
      teams: 0,
    };
  }

  const where = { regionId: region.id };

  const transferEvents = await prisma.transferEvent.deleteMany({
    where: { game: { slug: "valorant" } },
  });
  const memberships = await prisma.membershipHistory.deleteMany({
    where: { team: where },
  });
  const players = await prisma.player.deleteMany({ where });
  const teams = await prisma.team.deleteMany({ where });

  return {
    transferEvents: transferEvents.count,
    memberships: memberships.count,
    players: players.count,
    teams: teams.count,
  };
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

  return { game };
}

async function ensureRegion(regionCode: string, regionName: string) {
  return prisma.region.upsert({
    where: { code: regionCode },
    update: {},
    create: { code: regionCode, name: regionName, sortOrder: 0 },
  });
}

async function ensureTeam(
  team: TargetTeamDefinition,
  gameId: string,
  regionId: string,
  logoUrl: string | null = null,
) {
  const existing = await prisma.team.findFirst({
    where: {
      gameId,
      OR: [{ name: team.name }, { shortName: team.shortName }],
    },
  });

  if (existing) {
    if (
      (logoUrl && existing.logoUrl !== logoUrl) ||
      existing.regionId !== regionId
    ) {
      return prisma.team.update({
        where: { id: existing.id },
        data: {
          logoUrl,
          regionId,
        },
      });
    }
    return existing;
  }

  return prisma.team.create({
    data: {
      gameId,
      regionId,
      name: team.name,
      shortName: team.shortName,
      accent: team.accent,
      logoUrl,
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
    nationality: string | null;
    role: string | null;
    staffCategory: StaffCategory | null;
    status: PlayerStatus;
    avatarUrl: string | null;
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
      nationality: true,
      role: true,
      staffCategory: true,
      status: true,
      avatarUrl: true,
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
  gameId: string,
  regionId: string,
  cache: PlayerCache,
  stats: ApplyStats,
  avatarUrl: string | null,
) {
  const key = entry.handle.toLowerCase();
  const cached = cache.get(key);
  const staffCategory = getRosterCategory(entry.role);

  if (cached) {
    const data: {
      realName?: string;
      country?: string;
      nationality?: string;
      role?: string;
      staffCategory?: StaffCategory;
      status?: PlayerStatus;
      avatarUrl?: string | null;
    } = {};

    if (entry.realName && entry.realName !== cached.realName) {
      data.realName = entry.realName;
    }
    if (entry.country && !cached.country) {
      data.country = entry.country;
    }
    if (entry.nationality && !cached.nationality) {
      data.nationality = entry.nationality;
    }
    if (entry.role && entry.role !== cached.role) {
      data.role = entry.role;
    }
    if (staffCategory !== cached.staffCategory) {
      data.staffCategory = staffCategory;
    }
    if (entry.isCurrent && entry.status !== cached.status) {
      data.status = entry.status;
    }
    if (avatarUrl && !cached.avatarUrl) {
      data.avatarUrl = avatarUrl;
    }

    if (Object.keys(data).length > 0) {
      const updated = await prisma.player.update({
        where: { id: cached.id },
        data,
      });
      cached.realName = updated.realName;
      cached.country = updated.country;
      cached.nationality = updated.nationality;
      cached.role = updated.role;
      cached.staffCategory = updated.staffCategory;
      cached.status = updated.status;
      cached.avatarUrl = updated.avatarUrl;
      stats.playersUpdated += 1;
    }

    return updatedCacheEntry(cached);
  }

  const created = await prisma.player.create({
    data: {
      gameId,
      regionId,
      handle: entry.handle,
      realName: entry.realName,
      role: entry.role,
      staffCategory,
      country: entry.country ?? "JP",
      nationality: entry.nationality ?? entry.country ?? "JP",
      status: entry.status,
      avatarUrl,
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
  nationality: string | null;
  role: string | null;
  staffCategory: StaffCategory | null;
  status: PlayerStatus;
  avatarUrl: string | null;
}) {
  return {
    id: player.id,
    handle: player.handle,
    realName: player.realName,
    country: player.country,
    nationality: player.nationality,
    role: player.role,
    staffCategory: player.staffCategory,
    status: player.status,
    avatarUrl: player.avatarUrl,
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

async function upsertTransferEvents(
  entry: RosterEntry,
  playerId: string,
  team: { name: string; shortName: string },
  gameId: string,
) {
  const events: Array<{
    type: TransferType;
    eventDate: string;
    fromTeamName: string | null;
    toTeamName: string | null;
  }> = [];

  if (entry.startDate) {
    events.push({
      type: "JOIN",
      eventDate: entry.startDate,
      fromTeamName: null,
      toTeamName: team.name,
    });
  }

  if (!entry.isCurrent && entry.endDate) {
    events.push({
      type: entry.status === "INACTIVE" ? "INACTIVE" : "LEAVE",
      eventDate: entry.endDate,
      fromTeamName: team.name,
      toTeamName: null,
    });
  }

  for (const event of events) {
    const dedupeKey = [
      "liquipedia",
      team.shortName,
      entry.handle.toLowerCase(),
      event.type,
      event.eventDate,
    ].join("|");

    await prisma.transferEvent.upsert({
      where: { dedupeKey },
      update: {
        playerId,
        playerHandle: entry.handle,
        role: entry.role,
        fromTeamName: event.fromTeamName,
        toTeamName: event.toTeamName,
        eventDate: event.eventDate,
        sourceUrl: entry.announcementUrl,
        sourceTitle: "Liquipedia",
      },
      create: {
        gameId,
        playerId,
        playerHandle: entry.handle,
        role: entry.role,
        type: event.type,
        eventDate: event.eventDate,
        fromTeamName: event.fromTeamName,
        toTeamName: event.toTeamName,
        sourceUrl: entry.announcementUrl,
        sourceTitle: "Liquipedia",
        dedupeKey,
        rawText: `${entry.handle} ${event.type.toLowerCase()} ${team.name}`,
      },
    });
  }
}

async function applyTeamRoster(
  roster: TeamRoster,
  gameId: string,
  regionId: string,
  cache: PlayerCache,
  stats: ApplyStats,
  logoUrl: string | null,
  options: CliOptions,
) {
  const team = await ensureTeam(roster.team, gameId, regionId, logoUrl);
  const ordered = [...roster.entries].sort(
    (a, b) => Number(b.isCurrent) - Number(a.isCurrent),
  );

  for (const entry of ordered) {
    try {
      const avatarUrl = entry.avatarSourceUrl
        ? await downloadPlayerAvatar(
            entry.handle,
            entry.avatarSourceUrl,
            options,
            stats,
          )
        : null;
      const player = await ensurePlayer(
        entry,
        gameId,
        regionId,
        cache,
        stats,
        avatarUrl,
      );
      await upsertMembership(entry, player.id, team.id, stats);
      await upsertTransferEvents(entry, player.id, team, gameId);
    } catch (error) {
      if (
        error instanceof LiquipediaError &&
        error.kind === "RATE_LIMIT"
      ) {
        console.error(
          `   🚫 ${entry.handle} で HTTP 429 を検知しました。リトライせず以降の全通信を停止します。`,
        );
        throw error;
      }
      stats.skipped += 1;
      stats.warnings.push(
        `${roster.team.name} / ${entry.handle}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (!options.dryRun) {
    await applyTeamAchievements(team.id, roster.achievements, stats);
    await applyTeamMatches(team.id, roster.matches, stats);
  }
}

async function applyTeamAchievements(
  teamId: string,
  achievements: ParsedAchievement[],
  stats: ApplyStats,
) {
  if (achievements.length === 0) return;

  await prisma.teamAchievement.deleteMany({ where: { teamId } });

  for (const achievement of achievements) {
    await prisma.teamAchievement.create({
      data: {
        teamId,
        tier: achievement.tier,
        tournament: achievement.tournament,
        placement: achievement.placement,
        prize: achievement.prize,
        date: achievement.date,
        sourceUrl: achievement.sourceUrl,
        sourceTitle: achievement.sourceTitle,
      },
    });
    stats.achievementsCreated += 1;
  }
}

async function applyTeamMatches(
  teamId: string,
  matches: ParsedMatch[],
  stats: ApplyStats,
) {
  if (matches.length === 0) return;

  await prisma.teamMatch.deleteMany({ where: { teamId } });

  for (const match of matches) {
    await prisma.teamMatch.create({
      data: {
        teamId,
        opponentTeamName: match.opponentTeamName,
        opponentTeamShortName: match.opponentTeamShortName,
        opponentTeamLogoUrl: match.opponentTeamLogoUrl,
        isWin: match.isWin,
        score: match.score,
        date: match.date,
        streamUrl: match.streamUrl,
        status: match.status,
      },
    });
    stats.matchesCreated += 1;
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
  const achievements = parseTeamAchievements(html);
  const matches = parseTeamMatches(html, team.name);
  return {
    team,
    pageTitle: title,
    pageUrl,
    entries: parsed.entries,
    warnings: parsed.warnings,
    logoSourceUrl: extractTeamLogoUrl(html),
    achievements,
    matches,
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
  const achievements = parseTeamAchievements(html);
  const matches = parseTeamMatches(html, team.name);
  return {
    team,
    pageTitle: title,
    pageUrl,
    entries: parsed.entries,
    warnings: parsed.warnings,
    logoSourceUrl: extractTeamLogoUrl(html),
    achievements,
    matches,
  };
}

function selectTeams(options: CliOptions) {
  const baseTeams =
    options.region === "valo" ? [...TARGET_TEAMS] : [...TARGET_TEAMS];

  const filtered = !options.teamFilter
    ? baseTeams
    : baseTeams.filter((team) => {
        const normalized = options.teamFilter!.toLowerCase();
        return (
          team.liquipediaPage.toLowerCase() === normalized ||
          team.name.toLowerCase() === normalized ||
          team.shortName.toLowerCase() === normalized
        );
      });

  return options.limit ? filtered.slice(0, options.limit) : filtered;
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const teams = selectTeams(options);
  const targetRegions = Array.from(
    new Set(teams.map((team) => team.regionCode)),
  );

  console.log("──────────────────────────────────────────────");
  console.log(" VALORANT / Liquipedia MediaWiki API updater");
  console.log(` mode       : ${options.dryRun ? "DRY RUN" : "APPLY"}`);
  console.log(` source     : ${options.fixture ? `fixture:${options.fixture}` : API_URL}`);
  console.log(` user-agent : ${USER_AGENT}`);
  console.log(
    ` rate limit : ${options.delayMs}ms (Liquipedia 規約に合わせ最低 ${MIN_REQUEST_INTERVAL_MS}ms)`,
  );
  console.log(
    ` cache      : ${
      options.force
        ? "FORCE (キャッシュを無視して再取得)"
        : options.offline
          ? "OFFLINE (ローカルキャッシュのみ)"
          : "CACHE FIRST (キャッシュがあれば通信なし)"
    }`,
  );
  console.log(` target     : ${teams.map((team) => team.shortName).join(" / ")}`);
  console.log(` regions    : ${targetRegions.join(" / ")}`);
  console.log(
    ` images     : ${options.withImages ? "ON (--with-images)" : "OFF (既存画像のみ再利用)"}`,
  );
  if (options.limit) console.log(` limit      : ${options.limit} チーム`);
  console.log("──────────────────────────────────────────────");

  validateUserAgent(USER_AGENT);

  if (teams.length === 0) {
    throw new Error(
      `対象チームが見つかりません: ${options.teamFilter ?? "(未指定)"}`,
    );
  }

  const stats: ApplyStats = {
    teamsFetched: 0,
    teamsFailed: 0,
    entries: 0,
    playersCreated: 0,
    playersUpdated: 0,
    membershipsCreated: 0,
    membershipsUpdated: 0,
    membershipsClosed: 0,
    achievementsCreated: 0,
    matchesCreated: 0,
    standingsCreated: 0,
    skipped: 0,
    warnings: [],
  };

  // 24時間キャッシュ判定：スキップ対象チームを除外してクリーンアップ対象を絞る
  const teamsToFetch: TargetTeamDefinition[] = [];
  for (const team of teams) {
    if (await shouldSkipTeamUpdate(team, options)) {
      console.log(
        `  ⏭️  ${team.name} は 24 時間以内に更新済みのためスキップします（--force で再取得）`,
      );
      stats.teamsFetched += 1;
    } else {
      teamsToFetch.push(team);
    }
  }

  const fetchRegionCodes = Array.from(
    new Set(teamsToFetch.map((team) => team.regionCode)),
  );

  // --team / --limit / --fixture は部分更新のため、地域一括削除は行わない。
  // 全件取得時のみクリーンアップして古いレコードを整理する。
  const partialRun = Boolean(
    options.teamFilter || options.limit || options.fixture,
  );

  if (partialRun) {
    console.log(
      "  ℹ️  --team / --limit / --fixture 指定のため地域一括クリーンアップをスキップし、取得対象のみ Upsert します",
    );
  } else if (!options.dryRun) {
    for (const regionCode of fetchRegionCodes) {
      console.log(
        `  🧹 ${regionCode} の TransferEvent / MembershipHistory / Player / Team を削除します...`,
      );
      const cleaned = await cleanupExistingRecords(regionCode);
      console.log(
        `  🧹 ${regionCode} 削除完了: transferEvents=${cleaned.transferEvents} / memberships=${cleaned.memberships} / players=${cleaned.players} / teams=${cleaned.teams}`,
      );
    }
  }

  const context = await ensureBaseData();

  const regions = new Map<string, { id: string }>();
  for (const regionCode of fetchRegionCodes) {
    const region = await ensureRegion(regionCode, regionCode);
    regions.set(regionCode, region);
  }

  const cache = await loadPlayerCache(context.game.id);

  const updateLog = options.dryRun
    ? null
    : await prisma.updateLog.create({
        data: {
          source: "liquipedia:api",
          status: "RUNNING",
          message: "MediaWiki API から VALORANT 日本チームのロスターを取得中",
        },
      });

  let status: "SUCCESS" | "PARTIAL" | "FAILED" = "SUCCESS";
  const rosters: TeamRoster[] = [];
  let stoppedByRateLimit = false;

  try {
    for (const [index, team] of teamsToFetch.entries()) {
      const progress = `[${String(index + 1).padStart(2, "0")}/${String(teamsToFetch.length).padStart(2, "0")}]`;
      console.log(
        `\n${progress} Fetching ${team.liquipediaPage} (${team.name})...`,
      );

      const region = regions.get(team.regionCode);
      if (!region) {
        stats.teamsFailed += 1;
        const message = `地域 ${team.regionCode} の Region レコードが見つかりません`;
        stats.warnings.push(`${team.name}: ${message}`);
        console.error(`  ❌ ${team.name}: ${message}`);
        continue;
      }

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
          const logoUrl = await downloadTeamLogo(
            roster.team,
            roster.logoSourceUrl,
            options,
            stats,
          );

          if (!roster.logoSourceUrl && options.withImages) {
            stats.warnings.push(
              `${team.name}: インフォボックスのロゴ画像が見つかりませんでした`,
            );
          }

          await applyTeamRoster(
            roster,
            context.game.id,
            region.id,
            cache,
            stats,
            logoUrl,
            options,
          );
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
          error.kind === "RATE_LIMIT"
        ) {
          // 429 はリトライせず、以降の全通信を打ち切る。
          // 取得済みチームの DB 保存は完了しているため、そのまま集計へ進む。
          console.error(
            "   🚫 以降の全通信を停止し、取得済みデータのみ保存して終了します。しばらく時間を置いてから再実行してください。",
          );
          stoppedByRateLimit = true;
          break;
        } else if (
          error instanceof LiquipediaError &&
          error.kind === "BLOCKED"
        ) {
          console.error(
            "   Cloudflare Turnstile は自動回避しません。時間を置くか、ブラウザで一度ページを開いてから再実行してください。",
          );
        } else if (
          error instanceof LiquipediaError &&
          error.kind === "MISSING_PAGE"
        ) {
          console.warn(
            `   ⚠️  Liquipedia ページが見つからないためスキップ: ${team.liquipediaPage}`,
          );
        } else if (
          error instanceof LiquipediaError &&
          error.kind === "CACHE_MISS"
        ) {
          console.warn(
            `   📭 [CACHE MISS] ローカルキャッシュが無いためスキップ: ${team.liquipediaPage}`,
          );
        }
      }
    }

    // 公式順位表の取得・保存（Phase 6-1）。429 停止時は通信しない。
    if (!stoppedByRateLimit) {
      try {
        const standingStats = await fetchAndSaveStandingsForGame(
          prisma,
          BASE_URL,
          API_URL,
          "valorant",
          {
            dryRun: options.dryRun,
            verbose: options.verbose,
            force: options.force,
            offline: options.offline,
            debug: options.debug,
            delayMs: options.delayMs,
            timeoutMs: options.timeoutMs,
          },
        );
        stats.standingsCreated += standingStats.entriesSaved;
        if (standingStats.warnings.length > 0) {
          stats.warnings.push(...standingStats.warnings);
        }
        if (isRateLimited()) stoppedByRateLimit = true;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        stats.warnings.push(`順位表取得: ${message}`);
        console.error(`  ❌ 順位表取得: ${message}`);

        if (
          error instanceof StandingsLiquipediaError &&
          error.kind === "RATE_LIMIT"
        ) {
          stoppedByRateLimit = true;
          console.error(
            "   🚫 以降の全通信を停止し、取得済みデータのみ保存して終了します。",
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
      stoppedByRateLimit ||
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
    `achievements+${stats.achievementsCreated}`,
    `matches+${stats.matchesCreated}`,
    `standings+${stats.standingsCreated}`,
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

  if (status === "FAILED" || stoppedByRateLimit) {
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
