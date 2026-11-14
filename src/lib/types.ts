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
  /** 日本国籍以外の現ロスター選手数 */
  importCount: number;
  /** Import バッジのツールチップに使う対象選手 */
  importPlayers: PlayerDto[];
  players: PlayerDto[];
  staff: PlayerDto[];
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
