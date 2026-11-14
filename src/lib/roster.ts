import type { PlayerStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { roleRank } from "@/lib/status";
import {
  getRosterCategory,
  isCompetitiveRole,
  isRosterRole,
  rosterPriority,
} from "@/lib/roles";
import { isImportCountry } from "@/lib/nationality";
import { isTargetTeamName } from "@/lib/target-teams";
import type {
  DashboardData,
  MembershipDto,
  PlayerDto,
  TeamDto,
  TransferEventDto,
} from "@/lib/types";
import { formatUpdatedAt } from "@/lib/utils";

type PlayerWithMemberships = {
  id: string;
  handle: string;
  realName: string | null;
  status: PlayerStatus;
  role: string | null;
  staffCategory: import("@prisma/client").StaffCategory | null;
  country: string | null;
  nationality: string | null;
  xUrl: string | null;
  officialUrl: string | null;
  avatarUrl: string | null;
  note: string | null;
  region: { code: string } | null;
  memberships: Array<{
    id: string;
    role: string;
    startDate: string;
    endDate: string | null;
    isCurrent: boolean;
    announcementUrl: string | null;
    team: {
      id: string;
      name: string;
      shortName: string;
      logoUrl: string | null;
      accent: string;
      officialUrl: string | null;
      region: { code: string };
    };
  }>;
};

function mapPlayer(player: PlayerWithMemberships): PlayerDto {
  const memberships: MembershipDto[] = player.memberships
    .map((membership) => ({
      id: membership.id,
      teamId: membership.team.id,
      teamName: membership.team.name,
      teamShortName: membership.team.shortName,
      teamLogoUrl: membership.team.logoUrl,
      teamAccent: membership.team.accent,
      teamOfficialUrl: membership.team.officialUrl,
      teamRegionCode: membership.team.region.code,
      role: membership.role,
      startDate: membership.startDate,
      endDate: membership.endDate,
      isCurrent: membership.isCurrent,
      announcementUrl: membership.announcementUrl,
    }))
    .sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      return b.startDate.localeCompare(a.startDate);
    });

  const current = memberships.find((membership) => membership.isCurrent) ?? null;
  const primaryRole = current?.role ?? memberships[0]?.role ?? null;

  const staffCategory =
    player.staffCategory ?? getRosterCategory(primaryRole);

  return {
    id: player.id,
    handle: player.handle,
    realName: player.realName,
    status: player.status,
    category: staffCategory,
    country: player.country ?? player.nationality,
    regionCode: player.region?.code ?? null,
    xUrl: player.xUrl,
    officialUrl: player.officialUrl,
    avatarUrl: player.avatarUrl,
    note: player.note,
    currentTeamName: current?.teamName ?? null,
    currentTeamShortName: current?.teamShortName ?? null,
    currentTeamLogoUrl: current?.teamLogoUrl ?? null,
    currentTeamAccent: current?.teamAccent ?? null,
    currentTeamOfficialUrl: current?.teamOfficialUrl ?? null,
    currentRole: current?.role ?? player.role ?? null,
    memberships,
  };
}

function comparePlayers(a: PlayerDto, b: PlayerDto) {
  // 選手 → コーチ → スタッフの順にまとめ、選手はステータス順に並べる。
  const priorityDiff =
    rosterPriority(a.currentRole, a.status) -
    rosterPriority(b.currentRole, b.status);
  if (priorityDiff !== 0) return priorityDiff;

  const roleDiff = roleRank(a.currentRole ?? "") - roleRank(b.currentRole ?? "");
  if (roleDiff !== 0) return roleDiff;
  return a.handle.localeCompare(b.handle, "ja");
}

function isTargetRelatedPlayer(player: PlayerWithMemberships) {
  return player.memberships.some(
    (membership) =>
      isTargetTeamName(membership.team.name) ||
      isTargetTeamName(membership.team.shortName),
  );
}

export async function getDashboardData(): Promise<DashboardData | null> {
  const game = await prisma.game.findUnique({
    where: { slug: "valorant" },
    include: {
      players: {
        include: {
          region: { select: { code: true } },
          memberships: {
            include: {
              team: {
                include: { region: { select: { code: true } } },
              },
            },
            orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
          },
        },
        orderBy: { handle: "asc" },
      },
      teams: {
        where: { isActive: true },
        include: {
          region: true,
          memberships: {
            where: { isCurrent: true },
            include: {
              player: {
                include: {
                  region: { select: { code: true } },
                  memberships: {
                    include: {
                      team: {
                        include: { region: { select: { code: true } } },
                      },
                    },
                    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
                  },
                },
              },
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
      transferEvents: {
        include: {
          player: {
            select: {
              id: true,
              handle: true,
              realName: true,
              status: true,
            },
          },
        },
        orderBy: [{ eventDate: "desc" }, { createdAt: "desc" }],
        take: 300,
      },
    },
  });

  if (!game) return null;

  const targetTransferEvents = game.transferEvents.filter(
    (event) =>
      isTargetTeamName(event.fromTeamName) ||
      isTargetTeamName(event.toTeamName),
  );
  const targetEventPlayerIds = new Set(
    targetTransferEvents
      .map((event) => event.playerId)
      .filter((playerId): playerId is string => Boolean(playerId)),
  );

  const playerMap = new Map<string, PlayerDto>();
  for (const player of game.players) {
    if (
      !isTargetRelatedPlayer(player) &&
      !targetEventPlayerIds.has(player.id)
    ) {
      continue;
    }

    const dto = mapPlayer(player);
    const primaryRole = dto.currentRole ?? dto.memberships[0]?.role ?? null;
    if (!isRosterRole(primaryRole)) continue;

    playerMap.set(player.id, dto);
  }

  const targetTeams = game.teams.filter(
    (team) =>
      isTargetTeamName(team.name) || isTargetTeamName(team.shortName),
  );

  const teams: TeamDto[] = targetTeams.map((team) => {
    const playerIds = Array.from(
      new Set(team.memberships.map((membership) => membership.playerId)),
    );

    const members = playerIds
      .map((id) => playerMap.get(id))
      .filter((player): player is PlayerDto => Boolean(player))
      .sort(comparePlayers);

    const players = members.filter((player) => player.category !== "STAFF");
    const staff = members.filter((player) => player.category === "STAFF");

    const importPlayers = players.filter(
      (player) =>
        player.category === "PLAYER" && isImportCountry(player.country),
    );

    return {
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      regionCode: team.region.code,
      regionName: team.region.name,
      logoUrl: team.logoUrl,
      officialUrl: team.officialUrl,
      description: team.description,
      accent: team.accent,
      playerCount: players.length,
      importCount: importPlayers.length,
      importPlayers,
      players,
      staff,
      achievements: [],
      matches: [],
    };
  });

  const players = Array.from(playerMap.values()).sort((a, b) =>
    a.handle.localeCompare(b.handle, "ja"),
  );
  const competitivePlayers = players.filter(
    (player) => player.category !== "STAFF",
  );
  const freeAgents = competitivePlayers
    .filter((player) => player.status === "LFT" || player.status === "FA")
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "LFT" ? -1 : 1;
      return b.memberships[0]?.startDate.localeCompare(
        a.memberships[0]?.startDate ?? "",
      ) ?? 0;
    });

  const lastLog = await prisma.updateLog.findFirst({
    where: { status: { in: ["SUCCESS", "PARTIAL"] } },
    orderBy: { finishedAt: "desc" },
  });

  const transfers: TransferEventDto[] = game.transferEvents
    .filter(
      (event) =>
        isTargetTeamName(event.fromTeamName) ||
        isTargetTeamName(event.toTeamName),
    )
    .filter((event) => isCompetitiveRole(event.role))
    .map((event) => ({
      id: event.id,
      playerId: event.playerId,
      playerHandle: event.player?.handle ?? event.playerHandle,
      playerRealName: event.player?.realName ?? null,
      playerStatus: event.player?.status ?? null,
      type: event.type,
      eventDate: event.eventDate,
      role: event.role,
      fromTeamName: event.fromTeamName,
      toTeamName: event.toTeamName,
      sourceUrl: event.sourceUrl,
      sourceTitle: event.sourceTitle,
    }));

  return {
    game: {
      id: game.id,
      slug: game.slug,
      name: game.name,
      shortName: game.shortName,
    },
    teams,
    players,
    freeAgents,
    transfers,
    lastUpdated: formatUpdatedAt(lastLog?.finishedAt ?? lastLog?.startedAt),
    lastUpdateSource: lastLog?.source ?? null,
    stats: {
      teamCount: teams.length,
      playerCount: competitivePlayers.length,
      activeCount: competitivePlayers.filter(
        (player) => player.status === "ACTIVE",
      ).length,
      freeAgentCount: freeAgents.length,
      staffCount: players.length - competitivePlayers.length,
    },
  };
}
