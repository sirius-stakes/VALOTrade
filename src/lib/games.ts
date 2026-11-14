import {
  ArrowLeftRight,
  Crosshair,
  Ghost,
  Swords,
  Trophy,
  UserRoundSearch,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * ヘッダーで切り替えるゲームタイトル定義。
 * テーマクラスは globals.css の `.theme-*` と 1:1 で対応する。
 */
export type GameDefinition = {
  /** React の状態管理に使う安定キー */
  key: "valorant" | "lol" | "idv";
  /** Prisma `Game.slug` と一致させるスラッグ */
  slug: string;
  name: string;
  shortName: string;
  /** ヘッダーのタブに表示する正式名称 */
  tabLabel: string;
  /** モバイル幅で使う短縮名 */
  compactLabel: string;
  regionLabel: string;
  heroTitle: string;
  description: string;
  /** globals.css のテーマクラス */
  themeClass: string;
  /** テーマの呼び名（例: Gold & Cyan） */
  themeName: string;
  /** タブのインジケーターに使う固定アクセント色 */
  dotClassName: string;
  /** データ基盤を実装するロードマップ上のフェーズ */
  dataPhase: string;
  /** 対象範囲の説明（準備中画面に表示） */
  scope: readonly string[];
  /** ローカル DB にデータが投入済みか */
  hasLocalData: boolean;
  icon: LucideIcon;
};

export const GAME_DEFINITIONS: readonly GameDefinition[] = [
  {
    key: "valorant",
    slug: "valorant",
    name: "VALORANT",
    shortName: "VALO",
    tabLabel: "VALORANT",
    compactLabel: "VALORANT",
    regionLabel: "Japan",
    heroTitle: "プロチーム移籍・ロスター追跡",
    description:
      "日本の VALORANT プロチーム（VCT Pacific 日本代表 / VCJ Tier2）のロスター、LFT / FA 選手、移籍・契約の履歴をひとつのダッシュボードで追跡。データは外部クラウドに送信されません。",

    themeClass: "theme-valorant",
    themeName: "Crimson Red",
    dotClassName:
      "bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.85)]",
    dataPhase: "Phase 1",
    scope: [
      "VCT Pacific / 日本 Tier2（VCJ）",
      "対象4チームのロスター",
      "Liquipedia MediaWiki API",
    ],
    hasLocalData: true,
    icon: Crosshair,
  },
  {
    key: "lol",
    slug: "league-of-legends",
    name: "League of Legends",
    shortName: "LoL",
    tabLabel: "League of Legends",
    compactLabel: "LoL",
    regionLabel: "Korea",
    heroTitle: "LCK プロチーム追跡",
    description:
      "韓国 LCK 出場全10チームのロスター、LFT / FA 選手、移籍・契約の履歴をひとつのダッシュボードで追跡。データは外部クラウドに送信されません。",

    themeClass: "theme-lol",
    themeName: "Gold & Cyan",
    dotClassName:
      "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.85)]",
    dataPhase: "Phase 5-1",
    scope: [
      "LCK 全10チーム",
      "Top / Jungle / Mid / Bot / Support",
      "Liquipedia League of Legends API",
    ],
    hasLocalData: true,
    icon: Swords,
  },
  {
    key: "idv",
    slug: "identity-v",
    name: "Identity V",
    shortName: "IDV",
    tabLabel: "Identity V",
    compactLabel: "IDENTITY V",
    regionLabel: "Japan",
    heroTitle: "IJL プロチーム追跡",
    description:
      "第五人格（Identity V）の日本 IJL 出場全チームを対象に、ロスターと移籍を追跡するタイトルです。ゴシックパープル＆アンバーのテーマを先行適用しています。",
    themeClass: "theme-idv",
    themeName: "Gothic Purple & Amber",
    dotClassName:
      "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.85)]",
    dataPhase: "Phase 5-2",
    scope: [
      "IJL 出場全チーム",
      "Survivor / Hunter ロール",
      "Liquipedia Identity V API",
    ],
    hasLocalData: true,
    icon: Ghost,
  },
];

export const DEFAULT_GAME = GAME_DEFINITIONS[0];

/** slug / key のどちらでもゲーム定義を引ける。未登録は VALORANT にフォールバック。 */
export function getGameDefinition(value: string | null | undefined) {
  return (
    GAME_DEFINITIONS.find(
      (game) => game.slug === value || game.key === value,
    ) ?? DEFAULT_GAME
  );
}

/** 2階層ナビゲーションのサブタブ定義。 */
export type DashboardSection = "roster" | "standings" | "transfers" | "lft";

export type SectionDefinition = {
  key: DashboardSection;
  label: string;
  /** 見出しに使う日本語タイトル */
  title: string;
  /** タブ横に添える英語ヒント */
  hint: string;
  description: string;
  /** 未実装セクションに表示するフェーズバッジ */
  badge?: string;
  icon: LucideIcon;
};

export const DASHBOARD_SECTIONS: readonly SectionDefinition[] = [
  {
    key: "roster",
    label: "ロスター",
    title: "チーム別ロスター",
    hint: "Roster",
    description:
      "チームごとの現行ロスター。選手名をクリックすると移籍・所属タイムラインが開きます。",
    icon: Users,
  },
  {
    key: "standings",
    label: "順位表",
    title: "リーグ順位表",
    hint: "Standings",
    description:
      "公式リーグの順位・勝敗・ポイントを表示するセクションです。",
    badge: "Phase 6",
    icon: Trophy,
  },
  {
    key: "transfers",
    label: "移籍",
    title: "直近の移籍タイムライン",
    hint: "Transfers",
    description:
      "Liquipedia から取得した加入・移籍・退団・LFT / FA を新しい順に表示。選手名をクリックすると経歴が開きます。",
    icon: ArrowLeftRight,
  },
  {
    key: "lft",
    label: "LFT / FA 市場",
    title: "LFT / FA 選手一覧",
    hint: "Market",
    description:
      "LFT / FA / Inactive / Sub など、移籍市場に含まれる選手の横断一覧。カードをクリックして経歴を確認できます。",
    icon: UserRoundSearch,
  },
];
