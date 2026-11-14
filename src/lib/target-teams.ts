/**
 * 取得・保持・表示の対象となる VALORANT チーム定義。
 * Phase 4-1 では VCT Pacific 全12チームと日本 Tier2（VCJ）主要チームを対象とする。
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
  /** Prisma Region.code と対応する地域識別子 */
  regionCode: string;
};

// ───────────────────────────────────────────────────────────────
// VCT Pacific（12チーム）
// ───────────────────────────────────────────────────────────────
export const VALO_PACIFIC_TEAMS: readonly TargetTeamDefinition[] = [
  {
    name: "ZETA DIVISION",
    shortName: "ZETA",
    aliases: ["ZETA", "ZETA DIVISION"],
    liquipediaPage: "ZETA_DIVISION",
    accent: "violet",
    logoSlug: "zeta",
    regionCode: "Pacific",
  },
  {
    name: "DetonatioN FocusMe",
    shortName: "DFM",
    aliases: ["DFM", "DetonatioN FocusMe"],
    liquipediaPage: "DetonatioN_FocusMe",
    accent: "red",
    logoSlug: "dfm",
    regionCode: "Pacific",
  },
  {
    name: "DRX",
    shortName: "DRX",
    aliases: ["DRX"],
    liquipediaPage: "DRX",
    accent: "cyan",
    logoSlug: "drx",
    regionCode: "Pacific",
  },
  {
    name: "Gen.G Esports",
    shortName: "GEN",
    aliases: ["Gen.G", "Gen.G Esports", "GEN"],
    liquipediaPage: "Gen.G_Esports",
    accent: "gold",
    logoSlug: "geng",
    regionCode: "Pacific",
  },
  {
    name: "T1",
    shortName: "T1",
    aliases: ["T1"],
    liquipediaPage: "T1",
    accent: "red",
    logoSlug: "t1",
    regionCode: "Pacific",
  },
  {
    name: "Paper Rex",
    shortName: "PRX",
    aliases: ["PRX", "Paper Rex"],
    liquipediaPage: "Paper_Rex",
    accent: "amber",
    logoSlug: "prx",
    regionCode: "Pacific",
  },
  {
    name: "Talon Esports",
    shortName: "TLN",
    aliases: ["TLN", "Talon Esports"],
    liquipediaPage: "Talon_Esports",
    accent: "orange",
    logoSlug: "talon",
    regionCode: "Pacific",
  },
  {
    name: "Team Secret",
    shortName: "TS",
    aliases: ["TS", "Team Secret"],
    liquipediaPage: "Team_Secret",
    accent: "emerald",
    logoSlug: "teamsecret",
    regionCode: "Pacific",
  },
  {
    name: "Global Esports",
    shortName: "GE",
    aliases: ["GE", "Global Esports"],
    liquipediaPage: "Global_Esports",
    accent: "pink",
    logoSlug: "ge",
    regionCode: "Pacific",
  },
  {
    name: "Rex Regum Qeon",
    shortName: "RRQ",
    aliases: ["RRQ", "Rex Regum Qeon"],
    liquipediaPage: "Rex_Regum_Qeon",
    accent: "amber",
    logoSlug: "rrq",
    regionCode: "Pacific",
  },
  {
    name: "Nongshim RedForce",
    shortName: "NS",
    aliases: ["NS", "Nongshim RedForce", "BLEED Esports", "BLEED"],
    liquipediaPage: "Nongshim_RedForce",
    accent: "red",
    logoSlug: "nongshim",
    regionCode: "Pacific",
  },
  {
    name: "BOOM Esports",
    shortName: "BOOM",
    aliases: ["BOOM", "BOOM Esports"],
    liquipediaPage: "BOOM_Esports",
    accent: "orange",
    logoSlug: "boom",
    regionCode: "Pacific",
  },
];

// ───────────────────────────────────────────────────────────────
// 日本 Tier2 / VCJ 主要チーム（8チーム）
// ───────────────────────────────────────────────────────────────
export const VALO_JP_TIER2_TEAMS: readonly TargetTeamDefinition[] = [
  {
    name: "FENNEL",
    shortName: "FENNEL",
    aliases: ["FL", "FENNEL"],
    liquipediaPage: "FENNEL",
    accent: "orange",
    logoSlug: "fennel",
    regionCode: "JP Tier 2",
  },
  {
    name: "MURASH GAMING",
    shortName: "MURASH",
    aliases: ["MURASH", "MURASH GAMING"],
    liquipediaPage: "MURASH_GAMING",
    accent: "emerald",
    logoSlug: "murash",
    regionCode: "JP Tier 2",
  },
  {
    name: "RIDDLE",
    shortName: "RIDDLE",
    aliases: ["RIDDLE"],
    liquipediaPage: "RIDDLE",
    accent: "violet",
    logoSlug: "riddle",
    regionCode: "JP Tier 2",
  },
  {
    name: "SCARZ",
    shortName: "SZ",
    aliases: ["SZ", "SCARZ"],
    liquipediaPage: "SCARZ",
    accent: "red",
    logoSlug: "scarz",
    regionCode: "JP Tier 2",
  },
  {
    name: "Sengoku Gaming",
    shortName: "SG",
    aliases: ["SG", "Sengoku Gaming", "SENGOKU"],
    liquipediaPage: "Sengoku_Gaming",
    accent: "gold",
    logoSlug: "sengoku",
    regionCode: "JP Tier 2",
  },
  {
    name: "REJECT",
    shortName: "RC",
    aliases: ["RC", "REJECT"],
    liquipediaPage: "REJECT",
    accent: "cyan",
    logoSlug: "reject",
    regionCode: "JP Tier 2",
  },
  {
    name: "NOEZ FOXX",
    shortName: "NOEZ",
    aliases: ["NOEZ", "NOEZ FOXX"],
    liquipediaPage: "NOEZ_FOXX",
    accent: "pink",
    logoSlug: "noez",
    regionCode: "JP Tier 2",
  },
  {
    name: "NORTHEPTION",
    shortName: "NTH",
    aliases: ["NTH", "NORTHEPTION"],
    liquipediaPage: "NORTHEPTION",
    accent: "emerald",
    logoSlug: "northeption",
    regionCode: "JP Tier 2",
  },
];

// ───────────────────────────────────────────────────────────────
// 全対象チーム
// ───────────────────────────────────────────────────────────────
export const TARGET_TEAMS: readonly TargetTeamDefinition[] = [
  ...VALO_PACIFIC_TEAMS,
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
