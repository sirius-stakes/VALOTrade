import type { PlayerStatus } from "@prisma/client";

export type ParsedPlayer = {
  handle: string;
  realName?: string;
  role?: string;
  status: PlayerStatus;
  startDate?: string;
  note?: string;
  xUrl?: string;
  announcementUrl?: string;
};

export type ParsedAnnouncement = {
  title: string;
  url: string;
  playerHandle?: string;
  kind?: string;
};

export type KeywordHits = {
  lft: number;
  fa: number;
  inactive: number;
  transfer: number;
};

export type RosterParseResult = {
  players: ParsedPlayer[];
  announcements: ParsedAnnouncement[];
  keywordHits: KeywordHits;
  warnings: string[];
};

const TITLE_RE = /<title[^>]*>([\s\S]*?)<\/title>/i;
const JSON_SCRIPT_RE =
  /<script[^>]+type=["']application\/vnd\.valo-roster\+json["'][^>]*>([\s\S]*?)<\/script>/i;
const PLAYER_TAG_RE =
  /<(li|article|div|section|tr|button)\b([^>]*\bdata-roster-player\b[^>]*)>/gi;
const ANCHOR_RE = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    );
}

function stripTags(value: string) {
  return decodeEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function getAttribute(attributes: string, name: string) {
  const doubleQuoted = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*"([^"]*)"`,
    "i",
  ).exec(attributes);
  if (doubleQuoted) return decodeEntities(doubleQuoted[1].trim());

  const singleQuoted = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*'([^']*)'`,
    "i",
  ).exec(attributes);
  if (singleQuoted) return decodeEntities(singleQuoted[1].trim());

  const bare = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*([^\\s"'>]+)`,
    "i",
  ).exec(attributes);
  return bare ? decodeEntities(bare[1].trim()) : undefined;
}

export function normalizeStatus(value: string | undefined): PlayerStatus {
  const normalized = (value ?? "").trim().toLowerCase();

  if (!normalized) return "ACTIVE";
  if (/(lft|looking\s*for\s*team|移籍先|募集中)/i.test(normalized)) {
    return "LFT";
  }
  if (/(free\s*agent|\bfa\b|フリーエージェント)/i.test(normalized)) {
    return "FA";
  }
  if (/(sub|reserve|substitute|リザーブ|控え|サブ)/i.test(normalized)) {
    return "SUB";
  }
  if (/(inactive|retired|引退|休止|無期限)/i.test(normalized)) {
    return "INACTIVE";
  }
  return "ACTIVE";
}

export function normalizeMonth(value: string | undefined) {
  if (!value) return undefined;
  const match = /(\d{4})[./年\-](\d{1,2})/.exec(value);
  if (!match) return undefined;
  const month = Number.parseInt(match[2], 10);
  if (month < 1 || month > 12) return undefined;
  return `${match[1]}-${String(month).padStart(2, "0")}`;
}

function dedupePlayers(players: ParsedPlayer[]) {
  const map = new Map<string, ParsedPlayer>();
  for (const player of players) {
    if (!player.handle) continue;
    map.set(player.handle.toLowerCase(), player);
  }
  return Array.from(map.values());
}

function parseStructuredJson(html: string, warnings: string[]) {
  const scriptMatch = JSON_SCRIPT_RE.exec(html);
  if (!scriptMatch) return [] as ParsedPlayer[];

  try {
    const data = JSON.parse(scriptMatch[1]) as {
      players?: Array<Record<string, unknown>>;
    };
    if (!Array.isArray(data.players)) {
      warnings.push("JSON ロスターに players 配列がありません");
      return [];
    }

    return data.players
      .map((raw): ParsedPlayer | null => {
        const handle = String(raw.handle ?? raw.name ?? "").trim();
        if (!handle) return null;
        return {
          handle,
          realName:
            typeof raw.realName === "string" ? raw.realName : undefined,
          role: typeof raw.role === "string" ? raw.role : undefined,
          status: normalizeStatus(
            typeof raw.status === "string" ? raw.status : undefined,
          ),
          startDate: normalizeMonth(
            typeof raw.startDate === "string" ? raw.startDate : undefined,
          ),
          note: typeof raw.note === "string" ? raw.note : undefined,
          xUrl: typeof raw.xUrl === "string" ? raw.xUrl : undefined,
          announcementUrl:
            typeof raw.announcementUrl === "string"
              ? raw.announcementUrl
              : undefined,
        };
      })
      .filter((player): player is ParsedPlayer => Boolean(player));
  } catch (error) {
    warnings.push(
      `JSON ロスターの解析に失敗しました: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return [];
  }
}

function parsePlayerTags(html: string) {
  const players: ParsedPlayer[] = [];
  let match: RegExpExecArray | null;

  PLAYER_TAG_RE.lastIndex = 0;
  while ((match = PLAYER_TAG_RE.exec(html)) !== null) {
    const attributes = match[2];
    const handle =
      getAttribute(attributes, "data-player-handle") ??
      getAttribute(attributes, "data-handle") ??
      getAttribute(attributes, "data-player-name");

    if (!handle) continue;

    players.push({
      handle,
      realName:
        getAttribute(attributes, "data-player-real-name") ??
        getAttribute(attributes, "data-real-name"),
      role:
        getAttribute(attributes, "data-player-role") ??
        getAttribute(attributes, "data-role"),
      status: normalizeStatus(
        getAttribute(attributes, "data-player-status") ??
          getAttribute(attributes, "data-status"),
      ),
      startDate: normalizeMonth(
        getAttribute(attributes, "data-player-start-date") ??
          getAttribute(attributes, "data-start-date"),
      ),
      note:
        getAttribute(attributes, "data-player-note") ??
        getAttribute(attributes, "data-note"),
      xUrl:
        getAttribute(attributes, "data-player-x") ??
        getAttribute(attributes, "data-x"),
      announcementUrl:
        getAttribute(attributes, "data-announcement-url") ??
        getAttribute(attributes, "data-player-announcement"),
    });
  }

  return players;
}

function parseAnnouncements(html: string) {
  const announcements: ParsedAnnouncement[] = [];
  let match: RegExpExecArray | null;

  ANCHOR_RE.lastIndex = 0;
  while ((match = ANCHOR_RE.exec(html)) !== null) {
    const attributes = match[1];
    const text = stripTags(match[2]);
    const href =
      getAttribute(attributes, "href") ??
      getAttribute(attributes, "data-announcement-url");
    const flagged = /\bdata-announcement\b/i.test(attributes);
    const keyword = /加入|移籍|退団|契約終了|契約満了|ロスター|LFT|FA/i.test(
      text,
    );

    if (!href || (!flagged && !keyword)) continue;
    if (/^(#|javascript:|mailto:)/i.test(href)) continue;

    announcements.push({
      title: text || "公式発表",
      url: href,
      playerHandle:
        getAttribute(attributes, "data-player-handle") ??
        getAttribute(attributes, "data-player"),
      kind: getAttribute(attributes, "data-kind"),
    });
  }

  return announcements;
}

function countKeywords(text: string): KeywordHits {
  const count = (pattern: RegExp) =>
    (text.match(pattern) ?? []).length;

  return {
    lft: count(/\bLFT\b|Looking\s+For\s+Team/gi),
    fa: count(/\bFA\b|Free\s+Agent/gi),
    inactive: count(/\bInactive\b|Retired|引退|休止/gi),
    transfer: count(/移籍|加入|退団|契約終了|契約満了/gi),
  };
}

/**
 * チーム公式 HTML を正規表現で解析する。
 * 対応フォーマット:
 *  1. <script type="application/vnd.valo-roster+json"> ... </script>
 *  2. data-roster-player 属性を持つ要素
 *     例: <li data-roster-player data-player-handle="Aster"
 *              data-player-role="Duelist" data-player-status="ACTIVE"></li>
 *  3. 上記がない場合はキーワード検出のみ行い、DB は更新しない（安全側）
 */
export function parseRosterHtml(html: string): RosterParseResult {
  const warnings: string[] = [];
  const jsonPlayers = parseStructuredJson(html, warnings);
  const tagPlayers = parsePlayerTags(html);
  const players = dedupePlayers([...jsonPlayers, ...tagPlayers]);
  const announcements = parseAnnouncements(html);
  const bodyText = stripTags(html);
  const keywordHits = countKeywords(bodyText);

  if (players.length === 0) {
    const title = TITLE_RE.exec(html)?.[1];
    warnings.push(
      `ロスターを特定できませんでした${
        title ? `（ページ: ${stripTags(title)}）` : ""
      }。data-roster-player 属性または JSON ブロックが必要です。`,
    );
    if (
      keywordHits.lft + keywordHits.fa + keywordHits.inactive > 0
    ) {
      warnings.push(
        `キーワード検出のみ: LFT=${keywordHits.lft}, FA=${keywordHits.fa}, Inactive=${keywordHits.inactive}。誤登録防止のため DB は変更していません。`,
      );
    }
  }

  return { players, announcements, keywordHits, warnings };
}
