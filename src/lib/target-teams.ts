/**
 * 取得・保持・表示の対象となる VALORANT 日本チーム定義。
 * スクレイピング CLI とダッシュボードの両方から参照する。
 */

export type TargetTeamDefinition = {
  name: string;
  shortName: string;
  aliases: readonly string[];
  liquipediaPage: string;
  accent: string;
  /** public/logos 配下に保存するロゴ画像のファイル名（拡張子なし） */
  logoSlug: string;
  /** 表示用の地域グループ */
  regionCode: string;
};

// ───────────────────────────────────────────────────────────────
// VCT Pacific 日本チーム
// ───────────────────────────────────────────────────────────────
export const VALO_PACIFIC_JP_TEAMS: readonly TargetTeamDefinition[] = [
  {
    name: "ZETA DIVISION",
    shortName: "ZETA",
    aliases: ["ZETA", "ZETA DIVISION"],
    liquipediaPage: "ZETA_DIVISION",
    accent: "violet",
    logoSlug: "zeta",
    regionCode: "VCT Pacific (JP)",
  },
  {
    name: "DetonatioN FocusMe",
    shortName: "DFM",
    aliases: ["DFM", "DetonatioN FocusMe"],
    liquipediaPage: "DetonatioN_FocusMe",
    accent: "red",
    logoSlug: "dfm",
    regionCode: "VCT Pacific (JP)",
  },
];

// ───────────────────────────────────────────────────────────────
// 日本 Tier2 / VCJ 主要チーム
// ───────────────────────────────────────────────────────────────
export const VALO_JP_TIER2_TEAMS: readonly TargetTeamDefinition[] = [
  {
    name: "FENNEL",
    shortName: "FENNEL",
    aliases: ["FL", "FENNEL"],
    liquipediaPage: "FENNEL",
    accent: "orange",
    logoSlug: "fennel",
    regionCode: "JP Tier 2 (VCJ)",
  },
  {
    name: "MURASH GAMING",
    shortName: "MURASH",
    aliases: ["MURASH", "MURASH GAMING"],
    liquipediaPage: "MURASH_GAMING",
    accent: "emerald",
    logoSlug: "murash",
    regionCode: "JP Tier 2 (VCJ)",
  },
  {
    name: "RIDDLE",
    shortName: "RIDDLE",
    aliases: ["RIDDLE"],
    liquipediaPage: "RIDDLE",
    accent: "cyan",
    logoSlug: "riddle",
    regionCode: "JP Tier 2 (VCJ)",
  },
  {
    name: "SCARZ",
    shortName: "SZ",
    aliases: ["SZ", "SCARZ"],
    liquipediaPage: "SCARZ",
    accent: "red",
    logoSlug: "scarz",
    regionCode: "JP Tier 2 (VCJ)",
  },
  {
    name: "Sengoku Gaming",
    shortName: "SG",
    aliases: ["SG", "Sengoku Gaming", "SENGOKU"],
    liquipediaPage: "Sengoku_Gaming",
    accent: "gold",
    logoSlug: "sengoku",
    regionCode: "JP Tier 2 (VCJ)",
  },
  {
    name: "REJECT",
    shortName: "RC",
    aliases: ["RC", "REJECT"],
    liquipediaPage: "REJECT",
    accent: "purple",
    logoSlug: "reject",
    regionCode: "JP Tier 2 (VCJ)",
  },
  {
    name: "NOEZ FOXX",
    shortName: "NOEZ",
    aliases: ["NOEZ", "NOEZ FOXX"],
    liquipediaPage: "NOEZ_FOXX",
    accent: "pink",
    logoSlug: "noez",
    regionCode: "JP Tier 2 (VCJ)",
  },
  {
    name: "NORTHEPTION",
    shortName: "NTH",
    aliases: ["NTH", "NORTHEPTION"],
    liquipediaPage: "NORTHEPTION",
    accent: "emerald",
    logoSlug: "northeption",
    regionCode: "JP Tier 2 (VCJ)",
  },
];

// ───────────────────────────────────────────────────────────────
// 全対象チーム（日本チームのみ）
// ───────────────────────────────────────────────────────────────
export const TARGET_TEAMS: readonly TargetTeamDefinition[] = [
  ...VALO_PACIFIC_JP_TEAMS,
  ...VALO_JP_TIER2_TEAMS,
];

export const TARGET_TEAM_NAMES = TARGET_TEAMS.map((team) => team.name);
export const TARGET_TEAM_SHORT_NAMES = TARGET_TEAMS.map(
  (team) => team.shortName,
);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toPattern(value: string) {
  return new RegExp(`\\b${escapeRegExp(value)}\\b`, "i");
}

const TARGET_PATTERNS = TARGET_TEAMS.flatMap((team) => {
  const names = new Set<string>([
    team.name,
    team.shortName,
    ...team.aliases,
  ]);
  return Array.from(names).map(toPattern);
});

/** 文字列が対象チームのいずれかを表しているか。 */
export function isTargetTeamName(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text) return false;
  return TARGET_PATTERNS.some((pattern) => pattern.test(text));
}

/** 表記揺れを正規のチーム名に変換する。対象外なら null。 */
export function canonicalTargetTeamName(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text) return null;

  for (const team of TARGET_TEAMS) {
    const names = new Set<string>([
      team.name,
      team.shortName,
      ...team.aliases,
    ]);
    if (Array.from(names).some((name) => toPattern(name).test(text))) {
      return team.name;
    }
  }

  return null;
}

/** 対象チームの定義を取得する。対象外なら null。 */
export function getTargetTeam(value: string | null | undefined) {
  const canonical = canonicalTargetTeamName(value);
  if (!canonical) return null;
  return TARGET_TEAMS.find((team) => team.name === canonical) ?? null;
}

/** 地域コードで対象チームを絞り込む。 */
export function getTeamsByRegion(regionCode: string) {
  return TARGET_TEAMS.filter((team) => team.regionCode === regionCode);
}
