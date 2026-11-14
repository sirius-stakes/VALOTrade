/**
 * 取得・保持・表示の対象となる League of Legends LCK チーム定義。
 * スクレイピング CLI とダッシュボードの両方から参照する。
 */

export type LolTeamDefinition = {
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

export const LCK_TEAMS: readonly LolTeamDefinition[] = [
  {
    name: "T1",
    shortName: "T1",
    aliases: ["T1"],
    liquipediaPage: "T1",
    accent: "red",
    logoSlug: "t1",
    regionCode: "LCK",
  },
  {
    name: "Gen.G",
    shortName: "GEN",
    aliases: ["Gen.G", "GEN", "Gen.G Esports"],
    liquipediaPage: "Gen.G",
    accent: "gold",
    logoSlug: "geng",
    regionCode: "LCK",
  },
  {
    name: "Hanwha Life Esports",
    shortName: "HLE",
    aliases: ["HLE", "Hanwha Life Esports", "Hanwha Life"],
    liquipediaPage: "Hanwha_Life_Esports",
    accent: "orange",
    logoSlug: "hle",
    regionCode: "LCK",
  },
  {
    name: "Dplus KIA",
    shortName: "DK",
    aliases: ["DK", "Dplus KIA", "DplusKIA"],
    liquipediaPage: "Dplus_KIA",
    accent: "cyan",
    logoSlug: "dk",
    regionCode: "LCK",
  },
  {
    name: "KT Rolster",
    shortName: "KT",
    aliases: ["KT", "KT Rolster"],
    liquipediaPage: "KT_Rolster",
    accent: "red",
    logoSlug: "kt",
    regionCode: "LCK",
  },
  {
    name: "Kwangdong Freecs",
    shortName: "KDF",
    aliases: ["KDF", "Kwangdong Freecs", "DN Freecs", "DNF"],
    liquipediaPage: "Kwangdong_Freecs",
    accent: "emerald",
    logoSlug: "kdf",
    regionCode: "LCK",
  },
  {
    name: "BNK FearX",
    shortName: "FOX",
    aliases: ["FOX", "BNK FearX", "FearX"],
    liquipediaPage: "BNK_FearX",
    accent: "amber",
    logoSlug: "fox",
    regionCode: "LCK",
  },
  {
    name: "Nongshim RedForce",
    shortName: "NS",
    aliases: ["NS", "Nongshim RedForce"],
    liquipediaPage: "Nongshim_RedForce",
    accent: "red",
    logoSlug: "ns",
    regionCode: "LCK",
  },
  {
    name: "DRX",
    shortName: "DRX",
    aliases: ["DRX"],
    liquipediaPage: "DRX",
    accent: "violet",
    logoSlug: "drx",
    regionCode: "LCK",
  },
  {
    name: "OKSavingsBank BRION",
    shortName: "BRO",
    aliases: ["BRO", "OKSavingsBank BRION", "Brion"],
    liquipediaPage: "OKSavingsBank_BRION",
    accent: "emerald",
    logoSlug: "bro",
    regionCode: "LCK",
  },
];

export const LCK_TEAM_NAMES = LCK_TEAMS.map((team) => team.name);
export const LCK_TEAM_SHORT_NAMES = LCK_TEAMS.map((team) => team.shortName);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toPattern(value: string) {
  return new RegExp(`\\b${escapeRegExp(value)}\\b`, "i");
}

const LCK_PATTERNS = LCK_TEAMS.flatMap((team) => {
  const names = new Set<string>([team.name, team.shortName, ...team.aliases]);
  return Array.from(names).map(toPattern);
});

/** 文字列が LCK 対象チームのいずれかを表しているか。 */
export function isLolTargetTeamName(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text) return false;
  return LCK_PATTERNS.some((pattern) => pattern.test(text));
}

/** 表記揺れを正規の LCK チーム名に変換する。対象外なら null。 */
export function canonicalLolTargetTeamName(value: string | null | undefined) {
  const text = (value ?? "").trim();
  if (!text) return null;

  for (const team of LCK_TEAMS) {
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

/** LCK 対象チームの定義を取得する。対象外なら null。 */
export function getLolTargetTeam(value: string | null | undefined) {
  const canonical = canonicalLolTargetTeamName(value);
  if (!canonical) return null;
  return LCK_TEAMS.find((team) => team.name === canonical) ?? null;
}
