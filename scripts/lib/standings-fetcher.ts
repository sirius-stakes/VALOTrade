/**
 * Liquipedia 大会ページから公式リーグ順位表を取得し、Standing テーブルへ保存する共有モジュール。
 *
 * 対象:
 *   - VALORANT: VCT Pacific / VCJ
 *   - League of Legends: LCK
 *   - Identity V: IJL
 *
 * Liquipedia 利用規約に従い、リクエスト間は最低 30 秒、24 時間以内の更新はスキップ、
 * 429 検知時は即座に停止する。HTTP 通信は scripts/lib/liquipedia-client.ts の
 * 共通リミッターに集約している。
 */

import { PrismaClient } from "@prisma/client";
import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { AnyNode } from "domhandler";

import {
  TARGET_TEAMS,
  canonicalTargetTeamName,
} from "../../src/lib/target-teams";
import {
  LCK_TEAMS,
  canonicalLolTargetTeamName,
} from "../../src/lib/lol-teams";
import {
  IJL_TEAMS,
  canonicalIdvTargetTeamName,
} from "../../src/lib/idv-teams";

import {
  fetchLiquipediaTextWithCache,
  hasLiquipediaCache,
} from "./liquipedia-cache";
import {
  LiquipediaError,
  MIN_REQUEST_INTERVAL_MS,
  validateUserAgent,
} from "./liquipedia-client";

export { LiquipediaError, MIN_REQUEST_INTERVAL_MS };

const STANDINGS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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

type ApiSearchResponse = {
  query?: {
    search?: Array<{ title: string; snippet?: string }>;
  };
  error?: {
    code?: string;
    info?: string;
  };
};

export type StandingEntry = {
  rank: number;
  teamName: string;
  wins: number;
  losses: number;
  points: number | null;
  differential: number | null;
  season: string;
  split: string;
  stage: string | null;
  tiebreaker: string | null;
  sourceUrl?: string;
};

export type StandingsOptions = {
  dryRun: boolean;
  verbose: boolean;
  force: boolean;
  /** ローカルキャッシュのみを使い、外部通信を一切行わない。 */
  offline?: boolean;
  debug?: boolean;
  delayMs: number;
  timeoutMs: number;
};

export type StandingsSource = {
  gameSlug: string;
  regionCode: string;
  label: string;
  /** MediaWiki 検索 API で最新シーズンの大会ページを探すクエリ。 */
  searchQueries: string[];
};

export type StandingsStats = {
  sourcesTried: number;
  sourcesSucceeded: number;
  sourcesFailed: number;
  entriesParsed: number;
  entriesSaved: number;
  skipped: number;
  warnings: string[];
};

export function clean(value: string | undefined | null) {
  return (value ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
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

function findColumnIndex(columns: string[], patterns: RegExp[]): number {
  return columns.findIndex((column) =>
    patterns.some((pattern) => pattern.test(column)),
  );
}

function nearestHeading($: CheerioAPI, element: Cheerio<AnyNode>): string {
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

function extractText($: CheerioAPI, cell: Cheerio<AnyNode> | null): string {
  if (!cell || cell.length === 0) return "";
  const clone = cell.clone();
  clone.find("sup, .reference, .mw-editsection, .flag, img").remove();
  return clean(clone.text());
}

function extractTeamNameFromCell(
  $: CheerioAPI,
  cell: Cheerio<AnyNode>,
): string | null {
  const link = cell.find("a").first();
  const scope = link.length > 0 ? link : cell;
  const clone = scope.clone();
  clone.find("sup, .reference, .mw-editsection, .flag, img").remove();
  let text = clean(clone.text());
  // 国旗アイコン alt などが残る場合の簡易除去
  text = text.replace(/^flag\s*/i, "").trim();
  if (!text) return null;
  return text;
}

function parseIntSafe(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = clean(value).replace(/^\+/, "").replace(/,/g, "");
  const number = Number.parseInt(normalized, 10);
  return Number.isFinite(number) ? number : null;
}

function parseRank(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = clean(value).toLowerCase();
  const match = /^(\d+)(?:st|nd|rd|th)?$/.exec(normalized);
  if (match) return Number.parseInt(match[1], 10);
  return parseIntSafe(value);
}

function inferSeasonSplit(
  context: string,
): { season: string; split: string; stage: string } {
  const yearMatch = /\b(20\d{2})\b/.exec(context);
  const season = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

  let split = "Regular Season";
  let stage = "Regular Season";

  if (/stage\s*1|stage1/i.test(context)) {
    split = "Stage 1";
    stage = "Stage 1";
  } else if (/stage\s*2|stage2/i.test(context)) {
    split = "Stage 2";
    stage = "Stage 2";
  } else if (/spring/i.test(context)) {
    split = "Spring";
    stage = "Spring";
  } else if (/summer/i.test(context)) {
    split = "Summer";
    stage = "Summer";
  } else if (/split\s*1|split1/i.test(context)) {
    split = "Split 1";
    stage = "Split 1";
  } else if (/split\s*2|split2/i.test(context)) {
    split = "Split 2";
    stage = "Split 2";
  } else if (/group\s*a/i.test(context)) {
    split = "Group A";
    stage = "Group A";
  } else if (/group\s*b/i.test(context)) {
    split = "Group B";
    stage = "Group B";
  } else if (/circuit\s*points/i.test(context)) {
    split = "Circuit Points";
    stage = "Circuit Points";
  }

  return { season, split, stage };
}

function isStandingsContext(context: string): boolean {
  const normalized = context.toLowerCase();
  return /standings|ranking|regular season|table|順位|順位表|グループ|group|stage|split|circuit points|ポイント/.test(
    normalized,
  );
}

export function parseStandingsHtml(
  html: string,
  pageTitle?: string,
): StandingEntry[] {
  const $ = load(html);
  const entries: StandingEntry[] = [];
  const seen = new Set<AnyNode>();

  const processTable = (
    table: Cheerio<AnyNode>,
    heading: string,
    title: string,
    caption: string,
  ) => {
    const context = [heading, title, caption, pageTitle].filter(Boolean).join(" ");
    if (!isStandingsContext(context)) return;

    const headerRow = table.find("tr").first();
    const headers = headerRow
      .find("th, td")
      .toArray()
      .map((cell) => clean($(cell).text()));
    const columns = normalizeColumns(headers);

    const rankIndex = findColumnIndex(columns, [
      /^#$/,
      /rank/i,
      /順位/i,
      /placement/i,
    ]);
    const teamIndex = findColumnIndex(columns, [
      /^team$/i,
      /チーム/i,
      /team name/i,
    ]);
    const winsIndex = findColumnIndex(columns, [/^w$/i, /wins?/i, /勝/i]);
    const lossesIndex = findColumnIndex(columns, [/^l$/i, /loss(es)?/i, /敗/i]);
    const pointsIndex = findColumnIndex(columns, [
      /^pts$/i,
      /points?/i,
      /ポイント/i,
    ]);
    const differentialIndex = findColumnIndex(columns, [
      /diff/i,
      /differential/i,
      /得失点差/i,
      /\+\/-?/i,
      /game diff/i,
    ]);

    // チーム名列がなければ順位表ではない。
    if (teamIndex < 0) return;
    // 勝敗またはポイント列がなければ順位表ではない。
    if (winsIndex < 0 && pointsIndex < 0) return;

    const { season, split, stage } = inferSeasonSplit(context);
    const rows = table.find("tr").toArray().slice(1);

    for (const [rowNum, row] of rows.entries()) {
      const cells = $(row).find("td").toArray();
      if (cells.length === 0) continue;

      const teamCell = cellAt($, cells, teamIndex);
      if (!teamCell) continue;

      const teamName = extractTeamNameFromCell($, teamCell);
      if (!teamName) continue;

      const rankCell = rankIndex >= 0 ? $(cells[rankIndex]) : null;
      const rank = parseRank(extractText($, rankCell)) || rowNum + 1;

      const wins = parseIntSafe(
        extractText($, winsIndex >= 0 ? $(cells[winsIndex]) : null),
      );
      const losses = parseIntSafe(
        extractText($, lossesIndex >= 0 ? $(cells[lossesIndex]) : null),
      );
      const points = parseIntSafe(
        extractText($, pointsIndex >= 0 ? $(cells[pointsIndex]) : null),
      );
      const differential = parseIntSafe(
        extractText($, differentialIndex >= 0 ? $(cells[differentialIndex]) : null),
      );

      entries.push({
        rank,
        teamName,
        wins: wins ?? 0,
        losses: losses ?? 0,
        points: points ?? null,
        differential: differential ?? null,
        season,
        split,
        stage,
        tiebreaker: null,
      });
    }
  };

  $("table.wikitable").each((_, element) => {
    if (seen.has(element)) return;
    seen.add(element);
    const table = $(element);
    const heading = nearestHeading($, table);
    const title = clean(table.attr("data-title"));
    const caption = clean(table.find("caption").first().text());
    processTable(table, heading, title, caption);
  });

  $(".table2").each((_, element) => {
    const wrapper = $(element);
    const table = wrapper.find("table").first();
    if (table.length === 0) return;
    const node = table.get(0);
    if (node) {
      if (seen.has(node)) return;
      seen.add(node);
    }
    const heading = nearestHeading($, wrapper);
    const title = clean(wrapper.find(".table2__title").first().text());
    const caption = clean(table.find("caption").first().text());
    processTable(table, heading, title, caption);
  });

  return entries;
}

function cellAt(
  $: CheerioAPI,
  cells: AnyNode[],
  index: number,
): Cheerio<AnyNode> | null {
  if (index < 0 || index >= cells.length) return null;
  return $(cells[index]);
}

async function requestApi(
  apiUrl: string,
  gameSlug: string,
  page: string,
  options: StandingsOptions,
  purpose: string,
): Promise<{ title: string; html: string }> {
  const url = `${apiUrl}?action=parse&page=${encodeURIComponent(
    page,
  )}&prop=text&redirects=1&format=json`;

  const { text: body } = await fetchLiquipediaTextWithCache({
    game: gameSlug,
    kind: "parse",
    page,
    purpose,
    url,
    force: options.force,
    offline: Boolean(options.offline),
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
  };
}

/** 検索結果を「最新シーズンの大会ページらしい順」に並べるためのスコア。 */
function scoreStandingTitle(title: string, query: string): {
  score: number;
  order: number;
} {
  const normalized = title.toLowerCase();
  const year = new Date().getFullYear();
  let score = 0;

  if (normalized.includes(String(year))) score += 6;
  if (normalized.includes(String(year - 1))) score += 3;
  if (/standings|ranking|regular\s*season|group\s*stage|playoffs?/i.test(title)) {
    score += 4;
  }
  if (/split|stage|season|league|championship|circuit/i.test(title)) {
    score += 2;
  }
  if (normalized.includes(query.toLowerCase())) score += 1;
  if (/^(talk|user|file|template|category|help):/i.test(title)) score -= 20;

  return { score, order: 0 };
}

/**
 * MediaWiki 検索 API を使い、大会ページの実在する最新タイトルを複数候補から探す。
 * 推測固定ページ名を順に叩くのを避け、検索結果上位を順位表解析に使う。
 */
async function searchStandingPageTitles(
  apiUrl: string,
  gameSlug: string,
  queries: string[],
  options: StandingsOptions,
): Promise<string[]> {
  const titles: string[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const url = `${apiUrl}?action=query&list=search&srsearch=${encodeURIComponent(
      query,
    )}&srlimit=5&srnamespace=0&format=json`;

    let body: string;
    try {
      const result = await fetchLiquipediaTextWithCache({
        game: gameSlug,
        kind: "search",
        page: query,
        purpose: `「${query}」の大会ページ検索`,
        url,
        force: options.force,
        offline: Boolean(options.offline),
        delayMs: options.delayMs,
        timeoutMs: options.timeoutMs,
      });
      body = result.text;
    } catch (error) {
      if (
        error instanceof LiquipediaError &&
        (error.kind === "RATE_LIMIT" || error.kind === "BLOCKED")
      ) {
        throw error;
      }
      continue;
    }

    let json: ApiSearchResponse;
    try {
      json = JSON.parse(body) as ApiSearchResponse;
    } catch {
      throw new LiquipediaError(
        `検索 API の JSON を解析できませんでした (${url})`,
        "PARSE",
      );
    }

    if (json.error) {
      const info = clean(json.error.info) || json.error.code || "unknown";
      throw new LiquipediaError(
        `MediaWiki 検索 API エラー: ${info}`,
        "HTTP",
      );
    }

    const results = (json.query?.search ?? [])
      .map((result, index) => ({
        title: result.title,
        index,
        ...scoreStandingTitle(result.title, query),
      }))
      .sort((a, b) => b.score - a.score || a.index - b.index);

    for (const result of results) {
      if (!seen.has(result.title)) {
        seen.add(result.title);
        titles.push(result.title);
      }
    }

    if (titles.length > 0) {
      // 検索結果が得られたらそれ以降のフォールバッククエリは省略。
      break;
    }
  }

  return titles;
}

function getCanonicalTeamName(
  gameSlug: string,
  teamName: string,
): string | null {
  switch (gameSlug) {
    case "valorant":
      return canonicalTargetTeamName(teamName);
    case "league-of-legends":
      return canonicalLolTargetTeamName(teamName);
    case "identity-v":
      return canonicalIdvTargetTeamName(teamName);
    default:
      return null;
  }
}

function getTeamDefinitionByCanonicalName(
  gameSlug: string,
  canonicalName: string,
) {
  switch (gameSlug) {
    case "valorant":
      return TARGET_TEAMS.find((team) => team.name === canonicalName) ?? null;
    case "league-of-legends":
      return LCK_TEAMS.find((team) => team.name === canonicalName) ?? null;
    case "identity-v":
      return IJL_TEAMS.find((team) => team.name === canonicalName) ?? null;
    default:
      return null;
  }
}

function normalizeTeamName(value: string): string {
  return clean(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildTeamLookup(
  teams: Array<{ id: string; name: string; shortName: string }>,
) {
  const map = new Map<
    string,
    { id: string; name: string; shortName: string }
  >();
  for (const team of teams) {
    map.set(normalizeTeamName(team.name), team);
    map.set(normalizeTeamName(team.shortName), team);
  }
  return map;
}

function resolveTeamByName(
  gameSlug: string,
  teamLookup: Map<string, { id: string; name: string; shortName: string }>,
  teamName: string,
): { id: string; name: string } | null {
  const canonical = getCanonicalTeamName(gameSlug, teamName);

  if (canonical) {
    const byCanonical = teamLookup.get(normalizeTeamName(canonical));
    if (byCanonical) return { id: byCanonical.id, name: byCanonical.name };

    const def = getTeamDefinitionByCanonicalName(gameSlug, canonical);
    if (def) {
      const byShort = teamLookup.get(normalizeTeamName(def.shortName));
      if (byShort) return { id: byShort.id, name: byShort.name };
    }
  }

  const normalized = normalizeTeamName(teamName);
  const direct = teamLookup.get(normalized);
  if (direct) return { id: direct.id, name: direct.name };

  // 部分一致フォールバック
  for (const [key, team] of teamLookup) {
    if (key.length < 2) continue;
    if (normalized.includes(key) || key.includes(normalized)) {
      return { id: team.id, name: team.name };
    }
  }

  return null;
}

async function ensureGameAndRegion(
  prisma: PrismaClient,
  gameSlug: string,
  regionCode: string,
) {
  const gameNames: Record<string, { name: string; shortName: string; sortOrder: number }> = {
    valorant: { name: "VALORANT", shortName: "VAL", sortOrder: 0 },
    "league-of-legends": {
      name: "League of Legends",
      shortName: "LoL",
      sortOrder: 1,
    },
    "identity-v": { name: "Identity V", shortName: "IDV", sortOrder: 2 },
  };
  const meta = gameNames[gameSlug] ?? {
    name: gameSlug,
    shortName: gameSlug,
    sortOrder: 99,
  };

  const game = await prisma.game.upsert({
    where: { slug: gameSlug },
    update: {},
    create: {
      slug: gameSlug,
      name: meta.name,
      shortName: meta.shortName,
      isActive: true,
      sortOrder: meta.sortOrder,
    },
  });

  const region = await prisma.region.upsert({
    where: { code: regionCode },
    update: {},
    create: { code: regionCode, name: regionCode, sortOrder: 0 },
  });

  return { game, region };
}

export async function saveStandings(
  prisma: PrismaClient,
  gameSlug: string,
  regionCode: string,
  entries: StandingEntry[],
  options: StandingsOptions,
): Promise<{ saved: number; unmatched: number }> {
  if (entries.length === 0) return { saved: 0, unmatched: 0 };

  const { game, region } = await ensureGameAndRegion(
    prisma,
    gameSlug,
    regionCode,
  );

  const teams = await prisma.team.findMany({
    where: { gameId: game.id, regionId: region.id },
    select: { id: true, name: true, shortName: true },
  });
  const teamLookup = buildTeamLookup(teams);

  // season + split ごとに既存レコードを置換する。
  const groups = new Map<string, StandingEntry[]>();
  for (const entry of entries) {
    const key = `${entry.season}|${entry.split}`;
    const list = groups.get(key) ?? [];
    list.push(entry);
    groups.set(key, list);
  }

  let saved = 0;
  let unmatched = 0;

  for (const [, groupEntries] of groups) {
    const season = groupEntries[0].season;
    const split = groupEntries[0].split;

    if (!options.dryRun) {
      await prisma.standing.deleteMany({
        where: {
          gameId: game.id,
          regionId: region.id,
          season,
          split,
        },
      });
    }

    for (const entry of groupEntries) {
      const resolved = resolveTeamByName(gameSlug, teamLookup, entry.teamName);
      if (!resolved) unmatched += 1;

      if (!options.dryRun) {
        await prisma.standing.create({
          data: {
            gameId: game.id,
            regionId: region.id,
            teamId: resolved?.id ?? null,
            teamName: entry.teamName,
            season: entry.season,
            split: entry.split,
            stage: entry.stage,
            rank: entry.rank,
            wins: entry.wins,
            losses: entry.losses,
            points: entry.points,
            differential: entry.differential,
            tiebreaker: entry.tiebreaker,
          },
        });
      }
      saved += 1;
    }
  }

  return { saved, unmatched };
}

export async function fetchAndSaveStandingsForSource(
  prisma: PrismaClient,
  baseUrl: string,
  apiUrl: string,
  source: StandingsSource,
  options: StandingsOptions,
): Promise<StandingsStats> {
  const stats: StandingsStats = {
    sourcesTried: 0,
    sourcesSucceeded: 0,
    sourcesFailed: 0,
    entriesParsed: 0,
    entriesSaved: 0,
    skipped: 0,
    warnings: [],
  };

  if (!options.force && !options.dryRun) {
    // ローカルキャッシュが存在する場合は 24 時間 TTL を無視し、
    // 通信せずキャッシュから即座に再パース・DB 保存する。
    let hasAnyCache = false;
    for (const query of source.searchQueries) {
      if (await hasLiquipediaCache(source.gameSlug, "search", query)) {
        hasAnyCache = true;
        break;
      }
    }

    const latest = hasAnyCache
      ? null
      : await prisma.standing.findFirst({
          where: {
            game: { slug: source.gameSlug },
            region: { code: source.regionCode },
          },
          orderBy: { updatedAt: "desc" },
          select: { updatedAt: true },
        });
    if (
      latest &&
      Date.now() - latest.updatedAt.getTime() < STANDINGS_CACHE_TTL_MS
    ) {
      console.log(
        `  ⏭️  ${source.label} の順位表は 24 時間以内に更新済みのためスキップします（--force で再取得）`,
      );
      stats.sourcesTried = 1;
      return stats;
    }
  }

  const pageTitles = await searchStandingPageTitles(
    apiUrl,
    source.gameSlug,
    source.searchQueries,
    options,
  );

  if (pageTitles.length === 0) {
    stats.sourcesFailed += 1;
    stats.warnings.push(
      `${source.label}: 検索で該当する大会ページが見つかりませんでした`,
    );
    return stats;
  }

  if (options.verbose) {
    console.log(
      `  🔍 ${source.label}: 候補ページ [${pageTitles.join(", ")}]`,
    );
  }

  for (const pageTitle of pageTitles) {
    stats.sourcesTried += 1;
    try {
      const { title, html } = await requestApi(
        apiUrl,
        source.gameSlug,
        pageTitle,
        options,
        `${source.label} 順位表`,
      );

      const entries = parseStandingsHtml(html, title);
      if (entries.length === 0) {
        stats.warnings.push(
          `${pageTitle}: 順位表データを検出できませんでした`,
        );
        continue;
      }

      if (options.verbose) {
        console.log(
          `  📊 ${source.label} (${pageTitle}): ${entries.length} 件の順位データを検出`,
        );
        for (const entry of entries.slice(0, 20)) {
          console.log(
            `     #${entry.rank} ${entry.teamName} | ${entry.wins}-${entry.losses} | PTS ${entry.points ?? "-"} | DIFF ${entry.differential ?? "-"}`,
          );
        }
        if (entries.length > 20) {
          console.log(`     ... 他 ${entries.length - 20} 件`);
        }
      }

      const { saved, unmatched } = await saveStandings(
        prisma,
        source.gameSlug,
        source.regionCode,
        entries,
        options,
      );
      stats.entriesParsed += entries.length;
      stats.entriesSaved += saved;
      stats.sourcesSucceeded += 1;
      if (unmatched > 0) {
        stats.warnings.push(
          `${source.label}: ${unmatched} 件のチーム紐付けに失敗（teamId=null で保存）`,
        );
      }
      return stats;
    } catch (error) {
      if (error instanceof LiquipediaError && error.kind === "MISSING_PAGE") {
        stats.warnings.push(`${pageTitle}: ページが見つかりません`);
        continue;
      }
      if (error instanceof LiquipediaError && error.kind === "CACHE_MISS") {
        stats.warnings.push(
          `${pageTitle}: ローカルキャッシュが無いためスキップ（--offline）`,
        );
        continue;
      }
      if (error instanceof LiquipediaError && error.kind === "RATE_LIMIT") {
        stats.warnings.push(`${pageTitle}: レート制限 (HTTP 429) を検知`);
        console.error(
          "   🚫 HTTP 429 を検知しました。リトライせず以降の全通信を停止します。",
        );
        throw error;
      }
      stats.warnings.push(
        `${pageTitle}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  stats.sourcesFailed += 1;
  stats.warnings.push(
    `${source.label}: 全候補ページから順位表を取得できませんでした`,
  );
  return stats;
}

export async function fetchAndSaveStandingsForGame(
  prisma: PrismaClient,
  baseUrl: string,
  apiUrl: string,
  gameSlug: string,
  options: StandingsOptions,
): Promise<StandingsStats> {
  const stats: StandingsStats = {
    sourcesTried: 0,
    sourcesSucceeded: 0,
    sourcesFailed: 0,
    entriesParsed: 0,
    entriesSaved: 0,
    skipped: 0,
    warnings: [],
  };

  const sources = STANDINGS_SOURCES.filter((source) => source.gameSlug === gameSlug);
  if (sources.length === 0) {
    stats.warnings.push(`${gameSlug}: 設定された順位表ソースがありません`);
    return stats;
  }

  validateUserAgent();

  const updateLog = options.dryRun
    ? null
    : await prisma.updateLog.create({
        data: {
          source: `liquipedia:standings:${gameSlug}`,
          status: "RUNNING",
          message: `${gameSlug} 順位表取得中`,
        },
      });

  let status: "SUCCESS" | "PARTIAL" | "FAILED" = "SUCCESS";

  try {
    for (const source of sources) {
      const sourceStats = await fetchAndSaveStandingsForSource(
        prisma,
        baseUrl,
        apiUrl,
        source,
        options,
      );
      stats.sourcesTried += sourceStats.sourcesTried;
      stats.sourcesSucceeded += sourceStats.sourcesSucceeded;
      stats.sourcesFailed += sourceStats.sourcesFailed;
      stats.entriesParsed += sourceStats.entriesParsed;
      stats.entriesSaved += sourceStats.entriesSaved;
      stats.skipped += sourceStats.skipped;
      stats.warnings.push(...sourceStats.warnings);
    }

    if (stats.sourcesSucceeded === 0 && stats.sourcesTried > 0) {
      status = "FAILED";
    } else if (stats.sourcesFailed > 0 || stats.warnings.length > 0) {
      status = "PARTIAL";
    }
  } catch (error) {
    status = "FAILED";
    stats.warnings.push(
      error instanceof Error ? error.message : String(error),
    );
  }

  if (updateLog) {
    const summary = `sources=${stats.sourcesSucceeded}/${stats.sourcesTried}, entries=${stats.entriesSaved}`;
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

  return stats;
}

const CURRENT_SEASON_YEAR = new Date().getFullYear();

export const STANDINGS_SOURCES: StandingsSource[] = [
  {
    gameSlug: "valorant",
    regionCode: "VCT Pacific (JP)",
    label: "VCT Pacific",
    searchQueries: [
      `VCT Pacific ${CURRENT_SEASON_YEAR}`,
      "VCT Pacific Stage",
      "Pacific League",
    ],
  },
  {
    gameSlug: "valorant",
    regionCode: "JP Tier 2 (VCJ)",
    label: "VCJ",
    searchQueries: [
      `VALORANT Challengers Japan ${CURRENT_SEASON_YEAR}`,
      "VALORANT Challengers Japan",
    ],
  },
  {
    gameSlug: "league-of-legends",
    regionCode: "LCK",
    label: "LCK",
    searchQueries: [
      `LCK ${CURRENT_SEASON_YEAR}`,
      `LCK Season ${CURRENT_SEASON_YEAR}`,
      "LCK Season",
    ],
  },
  {
    gameSlug: "identity-v",
    regionCode: "IJL",
    label: "IJL",
    searchQueries: [
      `Identity V Japan League ${CURRENT_SEASON_YEAR}`,
      `IJL ${CURRENT_SEASON_YEAR}`,
      "Identity V Japan League",
    ],
  },
];
