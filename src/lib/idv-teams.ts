/**
 * 取得・保持・表示の対象となる Identity V（第五人格）IJL チーム定義。
 * スクレイピング CLI とダッシュボードの両方から参照する。
 */

export type IdvTeamDefinition = {
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

export const IJL_TEAMS: readonly IdvTeamDefinition[] = [
  {
    name: "ZETA DIVISION",
    shortName: "ZETA",
    aliases: ["ZETA", "ZETA DIVISION"],
    liquipediaPage: "ZETA_DIVISION",
    accent: "purple",
    logoSlug: "zeta_idv",
    regionCode: "IJL",
  },
  {
    name: "SCARZ",
    shortName: "SZ",
    aliases: ["SZ", "SCARZ"],
    liquipediaPage: "SCARZ",
    accent: "red",
    logoSlug: "scarz_idv",
    regionCode: "IJL",
  },
  {
    name: "REJECT",
    shortName: "RC",
    aliases: ["RC", "REJECT"],
    liquipediaPage: "REJECT",
    accent: "purple",
    logoSlug: "reject_idv",
    regionCode: "IJL",
  },
  {
    name: "FENNEL",
    shortName: "FENNEL",
    aliases: ["FL", "FENNEL"],
    liquipediaPage: "FENNEL",
    accent: "orange",
    logoSlug: "fennel_idv",
    regionCode: "IJL",
  },
  {
    name: "AXIZ WAVE",
    shortName: "AXZ",
    aliases: ["AXZ", "AXIZ WAVE", "AXIZ"],
    liquipediaPage: "AXIZ_WAVE",
    accent: "cyan",
    logoSlug: "axiz_idv",
    regionCode: "IJL",
  },
  {
    name: "FAV gaming",
    shortName: "FAV",
    aliases: ["FAV", "FAV gaming"],
    liquipediaPage: "FAV_gaming",
    accent: "gold",
    logoSlug: "fav_idv",
    regionCode: "IJL",
  },
  {
    name: "Arneb with WoG",
    shortName: "Arneb",
    aliases: ["Arneb", "Arneb with WoG", "WoG"],
    liquipediaPage: "Arneb_with_WoG",
    accent: "emerald",
    logoSlug: "arneb_idv",
    regionCode: "IJL",
  },
  {
    name: "Crest Gaming Lst",
    shortName: "CGL",
    aliases: ["CGL", "Crest Gaming Lst", "Crest"],
    liquipediaPage: "Crest_Gaming_Lst",
    accent: "amber",
    logoSlug: "cgl_idv",
    regionCode: "IJL",
  },
];

export const IJL_TEAM_NAMES = IJL_TEAMS.map((team) => team.name);
export const IJL_TEAM_SHORT_NAMES = IJL_TEAMS.map((team) => team.shortName);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toPattern(value: string) {
  return new RegExp(`\\b${escapeRegExp(value)}\\b`, "i");
}

const IJL_PATTERNS = IJL_TEAMS.flatMap((team) => {
  const names = new Set<string>([team.name, team.shortName, ...team.aliases]);
  return Array.from(names).map(toPattern);
});

/** 文字列が IJL 対象チームのいずれかを表しているか。 */
export function isIdvTargetTeamName(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text) return false;
  return IJL_PATTERNS.some((pattern) => pattern.test(text));
}

/** 表記揺れを正規の IJL チーム名に変換する。対象外なら null。 */
export function canonicalIdvTargetTeamName(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text) return null;

  for (const team of IJL_TEAMS) {
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

/** IJL 対象チームの定義を取得する。対象外なら null。 */
export function getIdvTargetTeam(value: string | null | undefined) {
  const canonical = canonicalIdvTargetTeamName(value);
  if (!canonical) return null;
  return IJL_TEAMS.find((team) => team.name === canonical) ?? null;
}
