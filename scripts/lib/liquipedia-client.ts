/**
 * Liquipedia へのすべての HTTP 通信（MediaWiki API・検索 API・画像 CDN）を
 * 単一のレートリミッターに集約する共通クライアント。
 *
 * 運用ルール:
 *  - API か画像かを問わず、直前のリクエスト完了から必ず 30000ms 以上あける
 *  - `User-Agent`（連絡先入り）と `Accept-Encoding: gzip` を必ず付与する
 *  - `429 Too Many Requests` を検知したらリトライせず、プロセス内の
 *    以降の全通信を即座に停止する（取得済みデータの保存は呼び出し側で継続）
 *
 * 各取得スクリプトは必ずこのモジュール経由で `liquipedia.net` へアクセスすること。
 */

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

/** Liquipedia 規約に合わせた最小リクエスト間隔（30 秒）。 */
export const MIN_REQUEST_INTERVAL_MS = 30000;

/** 連絡先・プロジェクト URL を含む固有の User-Agent。 */
const DEFAULT_USER_AGENT =
  "TeamTradeEsportsDashboard/1.0 (https://github.com/sirius/TeamTrade; contact@example.com)";

export type LiquipediaErrorKind =
  | "BLOCKED"
  | "RATE_LIMIT"
  | "HTTP"
  | "NETWORK"
  | "PARSE"
  | "MISSING_PAGE";

export class LiquipediaError extends Error {
  constructor(
    message: string,
    readonly kind: LiquipediaErrorKind,
  ) {
    super(message);
    this.name = "LiquipediaError";
  }
}

export type LiquipediaRequestOptions = {
  /** ログに表示する取得内容（例: "ZETA DIVISION のロスター"）。 */
  purpose: string;
  /** リクエスト間隔。30000ms 未満は無視される。 */
  delayMs?: number;
  timeoutMs?: number;
  /** Accept ヘッダー。画像取得時は "image/*" を指定する。 */
  accept?: string;
};

export type LiquipediaTextResponse = {
  response: Response;
  text: string;
};

export type LiquipediaBinaryResponse = {
  response: Response;
  data: Buffer;
};

let lastRequestAt = 0;
let rateLimited = false;
let stateLoaded = false;

/**
 * 直前のリクエスト時刻を scripts/.cache に保存する。
 * 別プロセスで連続実行した場合（例: update:valo の直後に update:lol）でも
 * 30 秒の間隔を引き継ぎ、429 を防ぐ。
 */
const STATE_FILE = path.join(
  process.cwd(),
  "scripts",
  ".cache",
  "liquipedia-rate-limit.json",
);

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function loadPersistedLastRequestAt() {
  if (stateLoaded) return;
  stateLoaded = true;

  try {
    const raw = await readFile(STATE_FILE, "utf8");
    const parsed = JSON.parse(raw) as { lastRequestAt?: unknown };
    if (
      typeof parsed.lastRequestAt === "number" &&
      Number.isFinite(parsed.lastRequestAt) &&
      parsed.lastRequestAt > lastRequestAt
    ) {
      lastRequestAt = parsed.lastRequestAt;
    }
  } catch {
    // 初回実行や読み取り失敗時は何もしない
  }
}

async function persistLastRequestAt() {
  try {
    await mkdir(path.dirname(STATE_FILE), { recursive: true });
    await writeFile(
      STATE_FILE,
      JSON.stringify({ lastRequestAt }, null, 2),
      "utf8",
    );
  } catch {
    // 状態保存に失敗しても通信自体は継続する
  }
}

export function resolveUserAgent() {
  return process.env.LIQUIPEDIA_USER_AGENT?.trim() || DEFAULT_USER_AGENT;
}

/** User-Agent に連絡先（メールまたは URL）が含まれているか検証する。 */
export function validateUserAgent(userAgent = resolveUserAgent()) {
  if (!/\([^)]*(?:@|https?:\/\/)[^)]*\)/.test(userAgent)) {
    throw new Error(
      "User-Agent に連絡先（メールアドレスまたは URL）を括弧書きで含めてください。例: TeamTradeEsportsDashboard/1.0 (https://github.com/sirius/TeamTrade; contact@example.com)",
    );
  }
}

/** 429 を検知して以降の通信が停止しているか。 */
export function isRateLimited() {
  return rateLimited;
}

function markRateLimited() {
  rateLimited = true;
}

function intervalMs(options: Pick<LiquipediaRequestOptions, "delayMs">) {
  return Math.max(
    MIN_REQUEST_INTERVAL_MS,
    options.delayMs ?? MIN_REQUEST_INTERVAL_MS,
  );
}

function describeError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function recordRequestCompleted() {
  lastRequestAt = Date.now();
  await persistLastRequestAt();
}

/**
 * 直前のリクエスト完了時刻から必要間隔が経過するまで待機する。
 * API・検索・画像のすべてがこの関数を共有する。
 */
export async function waitForRateLimit(
  options: Pick<LiquipediaRequestOptions, "delayMs">,
  purpose: string,
) {
  await loadPersistedLastRequestAt();
  if (lastRequestAt === 0) return;

  const remaining = intervalMs(options) - (Date.now() - lastRequestAt);
  if (remaining <= 0) return;

  console.log(
    `  ⏳ rate limit: ${(remaining / 1000).toFixed(1)}s 待機してから ${purpose} を取得します`,
  );
  await sleep(remaining);
}

function ensureNotRateLimited(purpose: string) {
  if (!rateLimited) return;
  throw new LiquipediaError(
    `HTTP 429 を検知済みのため、以降の全通信を停止しています（${purpose} は実行しません）`,
    "RATE_LIMIT",
  );
}

function throwRateLimit(purpose: string): never {
  markRateLimited();
  throw new LiquipediaError(
    `HTTP 429 Too Many Requests を検知しました（${purpose}）。リトライせず以降の全通信を停止します。取得済みデータは保存されます。`,
    "RATE_LIMIT",
  );
}

async function beginRequest(
  url: string,
  options: LiquipediaRequestOptions,
): Promise<Response> {
  ensureNotRateLimited(options.purpose);
  await waitForRateLimit(options, options.purpose);
  ensureNotRateLimited(options.purpose);

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(options.timeoutMs ?? 30000),
      headers: {
        // ヘッダーは呼び出し側で上書きできないよう、ここで強制する。
        "User-Agent": resolveUserAgent(),
        "Accept-Encoding": "gzip",
        Accept: options.accept ?? "*/*",
      },
    });
  } catch (error) {
    await recordRequestCompleted();
    throw new LiquipediaError(
      `Liquipedia への接続に失敗しました (${url}): ${describeError(error)}`,
      "NETWORK",
    );
  }

  return response;
}

/**
 * テキスト（JSON / HTML）を取得する共通ラッパー。
 * 429 / 403 / 非 2xx は LiquipediaError として送出する。
 */
export async function fetchLiquipediaText(
  url: string,
  options: LiquipediaRequestOptions,
): Promise<LiquipediaTextResponse> {
  const response = await beginRequest(url, options);

  let text = "";
  try {
    text = await response.text();
  } catch (error) {
    throw new LiquipediaError(
      `レスポンスの読み取りに失敗しました (${url}): ${describeError(error)}`,
      "NETWORK",
    );
  } finally {
    await recordRequestCompleted();
  }

  if (response.status === 429) throwRateLimit(options.purpose);

  if (
    response.status === 403 ||
    /verify you are human|challenges\.cloudflare\.com\/turnstile/i.test(text)
  ) {
    throw new LiquipediaError(
      `Liquipedia がアクセスをブロックしました (HTTP ${response.status})。Cloudflare Turnstile を自動回避することはできません。`,
      "BLOCKED",
    );
  }

  if (!response.ok) {
    throw new LiquipediaError(
      `HTTP ${response.status} ${response.statusText} (${url})`,
      "HTTP",
    );
  }

  return { response, text };
}

/**
 * 画像などのバイナリを取得する共通ラッパー。
 * 429 を検知すると以降の全通信（API 含む）を停止する。
 */
export async function fetchLiquipediaBinary(
  url: string,
  options: LiquipediaRequestOptions,
): Promise<LiquipediaBinaryResponse> {
  const response = await beginRequest(url, options);

  if (response.status === 429) {
    try {
      await response.body?.cancel();
    } catch {
      // キャンセル失敗は無視する
    }
    await recordRequestCompleted();
    throwRateLimit(options.purpose);
  }

  if (!response.ok) {
    try {
      await response.body?.cancel();
    } catch {
      // キャンセル失敗は無視する
    }
    await recordRequestCompleted();
    throw new LiquipediaError(
      `HTTP ${response.status} ${response.statusText} (${url})`,
      response.status === 403 ? "BLOCKED" : "HTTP",
    );
  }

  let data: Buffer;
  try {
    data = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    throw new LiquipediaError(
      `画像データの読み取りに失敗しました (${url}): ${describeError(error)}`,
      "NETWORK",
    );
  } finally {
    await recordRequestCompleted();
  }

  if (data.length === 0) {
    throw new LiquipediaError("画像データが空でした", "PARSE");
  }

  return { response, data };
}

export function safeImageFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

/** 選手顔写真の公開パス（/players/<handle>.png）。 */
export function playerAvatarPath(handle: string) {
  return `/players/${safeImageFileName(handle)}.png`;
}

/** チームロゴの公開パス（/logos/<slug>.png）。 */
export function teamLogoPath(logoSlug: string) {
  return `/logos/${safeImageFileName(logoSlug)}.png`;
}

/**
 * public/ 配下に既に保存済みの画像があればその公開パスを返す。
 * 画像ダウンロードをスキップする既定モードでも既存画像を維持するために使う。
 */
export async function resolveExistingImagePath(
  relativePath: string,
): Promise<string | null> {
  if (!relativePath) return null;

  const publicPath = relativePath.startsWith("/")
    ? relativePath
    : `/${relativePath}`;

  try {
    const absolute = path.join(
      process.cwd(),
      "public",
      publicPath.replace(/^\/+/, ""),
    );
    const info = await stat(absolute);
    return info.isFile() && info.size > 0 ? publicPath : null;
  } catch {
    return null;
  }
}
