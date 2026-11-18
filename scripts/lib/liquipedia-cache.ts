/**
 * Liquipedia MediaWiki API の生データをローカルファイルへキャッシュする共有モジュール。
 *
 * 目的:
 *  - レート制限（429）を避けるため、一度取得に成功した JSON を
 *    `data/liquipedia-cache/<game>/<cache_key>.json` に保存する
 *  - 既定実行ではキャッシュがあれば外部通信（および 30 秒待機）をせず、
 *    ローカルファイルから即座にパース・DB 保存できるようにする
 *  - `--force` でキャッシュを無視して再取得、`--offline` でキャッシュのみから
 *    再構築（キャッシュが無いページは通信せずスキップ）できるようにする
 *
 * キャッシュは `data/liquipedia-cache/` 配下に保存し、`.gitignore` で Git 管理外にしている。
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  fetchLiquipediaText,
  LiquipediaError,
  type LiquipediaRequestOptions,
} from "./liquipedia-client";

/** API 取得時の Accept ヘッダー（MediaWiki / Liquipedia 規約準拠）。 */
export const LIQUIPEDIA_JSON_ACCEPT = "application/json, text/plain, */*";

/** ローカルキャッシュのルートディレクトリ。 */
export const CACHE_ROOT = path.join(process.cwd(), "data", "liquipedia-cache");

export type LiquipediaCacheKind = "parse" | "search";

export type LiquipediaCacheEntry = {
  /** キャッシュ形式のバージョン。 */
  version: 1;
  game: string;
  kind: LiquipediaCacheKind;
  /** API の page / 検索クエリ。 */
  page: string;
  /** 取得目的（ログ・メタデータ用）。 */
  purpose: string;
  /** API エンドポイント URL。 */
  url: string;
  /** 取得日時（ISO 8601）。 */
  fetchedAt: string;
  /** HTTP ステータスコード。 */
  status: number;
  /** API の生レスポンス（JSON 文字列）。 */
  body: string;
};

export type FetchWithCacheArgs = {
  /** キャッシュのサブディレクトリ（例: valorant / league-of-legends / identity-v）。 */
  game: string;
  kind: LiquipediaCacheKind;
  /** API の page / 検索クエリ。 */
  page: string;
  purpose: string;
  url: string;
  /** true の場合はキャッシュを無視して外部 API から再取得する。 */
  force: boolean;
  /** true の場合はキャッシュが無いページを通信せずスキップする。 */
  offline: boolean;
  delayMs?: number;
  timeoutMs?: number;
};

export type FetchWithCacheResult = {
  text: string;
  fromCache: boolean;
};

function sanitizeSegment(value: string, fallback: string) {
  const safe = value
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
  return safe || fallback;
}

/**
 * キャッシュキーを生成する。
 * ページ名を人間が読める形で残しつつ、衝突しないよう短いハッシュを付与する。
 */
export function buildCacheKey(kind: LiquipediaCacheKind, page: string) {
  const hash = createHash("sha1")
    .update(`${kind}:${page}`)
    .digest("hex")
    .slice(0, 8);
  return `${kind}-${sanitizeSegment(page, "entry")}-${hash}`;
}

/** キャッシュファイルの絶対パス。 */
export function cacheFilePath(
  game: string,
  kind: LiquipediaCacheKind,
  page: string,
) {
  return path.join(
    CACHE_ROOT,
    sanitizeSegment(game, "unknown"),
    `${buildCacheKey(kind, page)}.json`,
  );
}

function relativeCachePath(filePath: string) {
  return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

async function readCacheEntry(
  filePath: string,
): Promise<LiquipediaCacheEntry | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf8");
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LiquipediaCacheEntry>;
    if (
      parsed.version !== 1 ||
      typeof parsed.body !== "string" ||
      parsed.body.length === 0
    ) {
      console.warn(
        `  ⚠️  [CACHE INVALID] 形式が不正なため無視します: ${relativeCachePath(filePath)}`,
      );
      return null;
    }
    return parsed as LiquipediaCacheEntry;
  } catch {
    console.warn(
      `  ⚠️  [CACHE INVALID] JSON として読み込めないため無視します: ${relativeCachePath(filePath)}`,
    );
    return null;
  }
}

/** 指定ページのキャッシュファイルが存在するか。24 時間 TTL の判定に使う。 */
export async function hasLiquipediaCache(
  game: string,
  kind: LiquipediaCacheKind,
  page: string,
) {
  const entry = await readCacheEntry(cacheFilePath(game, kind, page));
  return entry !== null;
}

async function writeCacheEntry(entry: LiquipediaCacheEntry, filePath: string) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
}

/** API レスポンスが正常な MediaWiki JSON か（エラー応答をキャッシュしない）。 */
function isCacheableJson(text: string) {
  try {
    const json = JSON.parse(text) as { error?: unknown };
    return typeof json === "object" && json !== null && !json.error;
  } catch {
    return false;
  }
}

/**
 * キャッシュ優先で Liquipedia API のテキストを取得する。
 *
 * 1. `--force` 以外でキャッシュがあれば、通信せずキャッシュを返す（[CACHE HIT]）
 * 2. キャッシュが無く `--offline` なら通信せず CACHE_MISS エラー
 * 3. それ以外は共通リミッター経由で取得し、正常な JSON のみキャッシュへ保存
 */
export async function fetchLiquipediaTextWithCache(
  args: FetchWithCacheArgs,
): Promise<FetchWithCacheResult> {
  const filePath = cacheFilePath(args.game, args.kind, args.page);
  const displayPath = relativeCachePath(filePath);
  const cached = await readCacheEntry(filePath);

  // --offline 中は通信できないため、--force の同時指定でもキャッシュを優先する。
  if (cached && (!args.force || args.offline)) {
    console.log(`  💾 [CACHE HIT] ${args.purpose} (${displayPath})`);
    return { text: cached.body, fromCache: true };
  }

  if (args.offline) {
    console.warn(
      `  📭 [CACHE MISS] ${args.purpose} (${displayPath}) — --offline のため通信せずスキップします`,
    );
    throw new LiquipediaError(
      `ローカルキャッシュがありません: ${displayPath}（--offline 中は外部通信しません）`,
      "CACHE_MISS",
    );
  }

  if (cached && args.force) {
    console.log(`  🔄 [CACHE IGNORE] --force のため再取得します: ${args.purpose}`);
  }

  const requestOptions: LiquipediaRequestOptions = {
    purpose: args.purpose,
    delayMs: args.delayMs,
    timeoutMs: args.timeoutMs,
    accept: LIQUIPEDIA_JSON_ACCEPT,
  };

  const { text, response } = await fetchLiquipediaText(args.url, requestOptions);

  if (!isCacheableJson(text)) {
    console.warn(
      `  ⚠️  [CACHE SKIP] 正常な JSON ではないためキャッシュしません: ${args.purpose}`,
    );
    return { text, fromCache: false };
  }

  await writeCacheEntry(
    {
      version: 1,
      game: args.game,
      kind: args.kind,
      page: args.page,
      purpose: args.purpose,
      url: args.url,
      fetchedAt: new Date().toISOString(),
      status: response.status,
      body: text,
    },
    filePath,
  );
  console.log(`  💾 [CACHE SAVE] ${args.purpose} (${displayPath})`);

  return { text, fromCache: false };
}
