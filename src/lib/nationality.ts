/**
 * Liquipedia の国旗 alt（"Japan" / "South Korea" など）や
 * 既存 DB の `Player.country` を ISO 3166-1 alpha-2 に正規化する。
 */

export type CountryMeta = {
  /** ISO 3166-1 alpha-2 */
  code: string;
  /** 絵文字国旗 */
  flag: string;
  /** ツールチップ用の日本語名 */
  label: string;
  /** 日本（JP）以外をインポート枠として扱う */
  isImport: boolean;
};

const COUNTRIES: Record<string, { code: string; label: string }> = {
  japan: { code: "JP", label: "日本" },
  jp: { code: "JP", label: "日本" },
  日本: { code: "JP", label: "日本" },
  韓国: { code: "KR", label: "韓国" },
  korea: { code: "KR", label: "韓国" },
  "south korea": { code: "KR", label: "韓国" },
  "republic of korea": { code: "KR", label: "韓国" },
  kr: { code: "KR", label: "韓国" },
  china: { code: "CN", label: "中国" },
  中国: { code: "CN", label: "中国" },
  cn: { code: "CN", label: "中国" },
  taiwan: { code: "TW", label: "台湾" },
  tw: { code: "TW", label: "台湾" },
  "hong kong": { code: "HK", label: "香港" },
  hk: { code: "HK", label: "香港" },
  brazil: { code: "BR", label: "ブラジル" },
  br: { code: "BR", label: "ブラジル" },
  ukraine: { code: "UA", label: "ウクライナ" },
  ua: { code: "UA", label: "ウクライナ" },
  "united kingdom": { code: "GB", label: "イギリス" },
  uk: { code: "GB", label: "イギリス" },
  gb: { code: "GB", label: "イギリス" },
  "united states": { code: "US", label: "アメリカ" },
  usa: { code: "US", label: "アメリカ" },
  us: { code: "US", label: "アメリカ" },
  canada: { code: "CA", label: "カナダ" },
  ca: { code: "CA", label: "カナダ" },
  australia: { code: "AU", label: "オーストラリア" },
  au: { code: "AU", label: "オーストラリア" },
  france: { code: "FR", label: "フランス" },
  fr: { code: "FR", label: "フランス" },
  germany: { code: "DE", label: "ドイツ" },
  de: { code: "DE", label: "ドイツ" },
  spain: { code: "ES", label: "スペイン" },
  es: { code: "ES", label: "スペイン" },
  sweden: { code: "SE", label: "スウェーデン" },
  se: { code: "SE", label: "スウェーデン" },
  finland: { code: "FI", label: "フィンランド" },
  fi: { code: "FI", label: "フィンランド" },
  poland: { code: "PL", label: "ポーランド" },
  pl: { code: "PL", label: "ポーランド" },
  russia: { code: "RU", label: "ロシア" },
  ru: { code: "RU", label: "ロシア" },
  turkey: { code: "TR", label: "トルコ" },
  tr: { code: "TR", label: "トルコ" },
  mongolia: { code: "MN", label: "モンゴル" },
  mn: { code: "MN", label: "モンゴル" },
  vietnam: { code: "VN", label: "ベトナム" },
  vn: { code: "VN", label: "ベトナム" },
  thailand: { code: "TH", label: "タイ" },
  th: { code: "TH", label: "タイ" },
  philippines: { code: "PH", label: "フィリピン" },
  ph: { code: "PH", label: "フィリピン" },
  indonesia: { code: "ID", label: "インドネシア" },
  id: { code: "ID", label: "インドネシア" },
  malaysia: { code: "MY", label: "マレーシア" },
  my: { code: "MY", label: "マレーシア" },
  singapore: { code: "SG", label: "シンガポール" },
  sg: { code: "SG", label: "シンガポール" },
  india: { code: "IN", label: "インド" },
  in: { code: "IN", label: "インド" },
};

const metaCache = new Map<string, CountryMeta | null>();

function flagEmoji(code: string) {
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return code
    .split("")
    .map((character) =>
      String.fromCodePoint(0x1f1e6 + character.charCodeAt(0) - 65),
    )
    .join("");
}

/** 国名・国コードから国旗メタ情報を返す。不明なら null。 */
export function getCountryMeta(
  country: string | null | undefined,
): CountryMeta | null {
  const raw = (country ?? "").trim();
  if (!raw) return null;

  const cacheKey = raw.toLowerCase();
  if (metaCache.has(cacheKey)) return metaCache.get(cacheKey) ?? null;

  let resolved = COUNTRIES[cacheKey] ?? null;

  // "Japan " のようなゆらぎや、未知の英語名は先頭2文字をコードとして扱わない。
  if (!resolved) {
    const compact = cacheKey.replace(/[^a-z]/g, "");
    resolved = COUNTRIES[compact] ?? null;
  }

  const meta: CountryMeta | null = resolved
    ? {
        code: resolved.code,
        label: resolved.label,
        flag: flagEmoji(resolved.code),
        isImport: resolved.code !== "JP",
      }
    : null;

  metaCache.set(cacheKey, meta);
  return meta;
}

/** 日本以外の国籍ならインポート選手として扱う。 */
export function isImportCountry(country: string | null | undefined) {
  return getCountryMeta(country)?.isImport ?? false;
}
