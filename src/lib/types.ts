import type { PlayerStatus, TransferType } from "@prisma/client";

import type { RosterCategory } from "@/lib/roles";

export type MembershipDto = {
  id: string;
  teamId: string;
  teamName: string;
  teamShortName: string;
  teamLogoUrl: string | null;
  teamAccent: string;
  teamOfficialUrl: string | null;
  teamRegionCode: string;
  role: string;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  announcementUrl: string | null;
};

export type PlayerDto = {
  id: string;
  handle: string;
  realName: string | null;
  status: PlayerStatus;
  /** 選手 / コーチ / スタッフの区分（チームカード内の表示制御に使用） */
  category: RosterCategory;
  country: string | null;
  regionCode: string | null;
  xUrl: string | null;
  officialUrl: string | null;
  avatarUrl: string | null;
  note: string | null;
  currentTeamName: string | null;
  currentTeamShortName: string | null;
  currentTeamLogoUrl: string | null;
  currentTeamAccent: string | null;
  currentTeamOfficialUrl: string | null;
  currentRole: string | null;
  memberships: MembershipDto[];
};

export type TeamDto = {
  id: string;
  name: string;
  shortName: string;
  regionCode: string;
  regionName: string;
  logoUrl: string | null;
  officialUrl: string | null;
  description: string | null;
  accent: string;
  /** 選手 + コーチの人数（スタッフを除く） */
  playerCount: number;
  /** 日本国籍以外の現ロスター選手数（チーム詳細モーダルで使用） */
  importCount: number;
  /** Import 数の計算対象選手（チーム詳細モーダルで使用） */
  importPlayers: PlayerDto[];
  players: PlayerDto[];
  staff: PlayerDto[];
  /** 過去大会実績（Phase 4-4 でデータ接続予定） */
  achievements: TeamAchievementDto[];
  /** 直近試合結果・次戦予定（Phase 4-4 でデータ接続予定） */
  matches: TeamMatchDto[];
};

export type GameDto = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
};

export type TransferEventDto = {
  id: string;
  playerId: string | null;
  playerHandle: string;
  playerRealName: string | null;
  playerStatus: PlayerStatus | null;
  type: TransferType;
  eventDate: string;
  role: string | null;
  fromTeamName: string | null;
  toTeamName: string | null;
  sourceUrl: string | null;
  sourceTitle: string | null;
};

/** チームの過去大会実績（Phase 2-3 では UI 枠組み、Phase 4-4 でデータ接続予定） */
export type TeamAchievementDto = {
  id: string;
  tier: string;
  tournament: string;
  placement: string;
  prize?: string | null;
  date: string;
};

/** チームの直近・次戦試合（Phase 2-3 では UI 枠組み、Phase 4-4 でデータ接続予定） */
export type TeamMatchDto = {
  id: string;
  opponentTeamName: string;
  opponentTeamShortName: string | null;
  opponentTeamLogoUrl: string | null;
  isWin: boolean | null;
  score: string | null;
  date: string;
  streamUrl: string | null;
  status: "UPCOMING" | "RECENT";
};

export type DashboardData = {
  game: GameDto;
  teams: TeamDto[];
  players: PlayerDto[];
  freeAgents: PlayerDto[];
  transfers: TransferEventDto[];
  lastUpdated: string | null;
  lastUpdateSource: string | null;
  stats: {
    teamCount: number;
    playerCount: number;
    activeCount: number;
    freeAgentCount: number;
    staffCount: number;
  };
};
