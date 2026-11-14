export type TeamSource = {
  id: string;
  teamShortName: string;
  teamName: string;
  /** ロスター情報を取得するページ（チーム公式サイト） */
  rosterUrl: string;
  /** チーム公式 HP */
  officialUrl: string;
  logoUrl: string;
  accent: string;
  regionCode: "JP";
};

/**
 * ローカルから取得するチーム公式サイト。
 * サイト構造が変わった場合は、ここに URL を追加 / 変更してください。
 */
export const TEAM_SOURCES: TeamSource[] = [
  {
    id: "zeta",
    teamShortName: "ZETA",
    teamName: "ZETA DIVISION",
    rosterUrl: "https://zetadivision.com/",
    officialUrl: "https://zetadivision.com/",
    logoUrl: "/logos/zeta.svg",
    accent: "violet",
    regionCode: "JP",
  },
  {
    id: "dfm",
    teamShortName: "DFM",
    teamName: "DetonatioN FocusMe",
    rosterUrl: "https://www.detonation.co.jp/",
    officialUrl: "https://www.detonation.co.jp/",
    logoUrl: "/logos/dfm.svg",
    accent: "red",
    regionCode: "JP",
  },
  {
    id: "fennel",
    teamShortName: "FENNEL",
    teamName: "FENNEL",
    rosterUrl: "https://fennel.gg/",
    officialUrl: "https://fennel.gg/",
    logoUrl: "",
    accent: "orange",
    regionCode: "JP",
  },
  {
    id: "murash",
    teamShortName: "MURASH",
    teamName: "MURASH GAMING",
    rosterUrl: "https://murashgaming.jp/",
    officialUrl: "https://murashgaming.jp/",
    logoUrl: "/logos/murash.png",
    accent: "emerald",
    regionCode: "JP",
  },
];
