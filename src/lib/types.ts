import type { PlayerStatus, TransferType } from "@prisma/client";

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
  playerCount: number;
  players: PlayerDto[];
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
  };
};
