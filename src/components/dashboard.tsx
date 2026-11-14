"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Database,
  Layers,
  SearchX,
  Shield,
  Trophy,
  UserRoundSearch,
  Users,
} from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { ControlBar } from "@/components/control-bar";
import {
  MarketFilterBar,
  type MarketRoleFilter,
  type MarketStatusFilter,
} from "@/components/market-filter-bar";
import { MarketPlayerCard } from "@/components/market-player-card";
import { PlayerModal } from "@/components/player-modal";
import { RegionTabs, type RegionTab } from "@/components/region-tabs";
import { SectionNav } from "@/components/section-nav";
import { SectionPlaceholder } from "@/components/section-placeholder";
import { TeamCard } from "@/components/team-card";
import { TeamModal } from "@/components/team-modal";
import { TransferTimeline } from "@/components/transfer-timeline";
import { Button } from "@/components/ui/button";
import {
  DASHBOARD_SECTIONS,
  getGameDefinition,
  type DashboardSection,
} from "@/lib/games";
import { isStreamerLikeRole } from "@/lib/roles";
import type { StatusFilter } from "@/lib/status";
import type { DashboardData, PlayerDto, TeamDto } from "@/lib/types";
import { useFavorites } from "@/lib/use-favorites";
import { usePlayerFavorites } from "@/lib/use-player-favorites";
import { cn } from "@/lib/utils";

type DashboardProps = {
  dataMap: Record<string, DashboardData>;
  initialGameSlug: string;
};

const COUNT_UNIT: Record<DashboardSection, string> = {
  roster: "players",
  standings: "rows",
  transfers: "events",
  lft: "players",
};

function matchesQuery(value: string | null | undefined, query: string) {
  return Boolean(value?.toLowerCase().includes(query));
}

function playerMatchesQuery(player: PlayerDto, query: string) {
  if (
    matchesQuery(player.handle, query) ||
    matchesQuery(player.realName, query) ||
    matchesQuery(player.currentTeamName, query) ||
    matchesQuery(player.currentRole, query) ||
    matchesQuery(player.note, query)
  ) {
    return true;
  }

  return player.memberships.some(
    (membership) =>
      matchesQuery(membership.teamName, query) ||
      matchesQuery(membership.teamShortName, query) ||
      matchesQuery(membership.role, query),
  );
}

function roleMatchesFilter(
  role: string,
  filter: Exclude<MarketRoleFilter, "all">,
) {
  const normalizedRole = role.toLowerCase();
  const normalizedFilter = filter.toLowerCase();
  if (normalizedRole === normalizedFilter) return true;
  if (filter === "Coach" && normalizedRole.includes("coach")) return true;
  // LoL: Bot / ADC を同義として扱う
  if (
    (filter === "Bot" || filter === "ADC") &&
    (normalizedRole === "bot" || normalizedRole === "adc")
  ) {
    return true;
  }
  return false;
}

export function Dashboard({ dataMap, initialGameSlug }: DashboardProps) {
  const [gameSlug, setGameSlug] = useState(initialGameSlug);
  const [section, setSection] = useState<DashboardSection>("roster");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showStaff, setShowStaff] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDto | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<TeamDto | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<RegionTab>("all");
  const [marketStatusFilter, setMarketStatusFilter] =
    useState<MarketStatusFilter>("all");
  const [marketRoleFilter, setMarketRoleFilter] =
    useState<MarketRoleFilter>("all");
  const { isFavorite, toggleFavorite } = useFavorites();
  const { isFavorite: isPlayerFavorite, toggleFavorite: togglePlayerFavorite } =
    usePlayerFavorites();

  const game = getGameDefinition(gameSlug);
  const data = dataMap[gameSlug] ?? {
    game: {
      id: "",
      slug: game.slug,
      name: game.name,
      shortName: game.shortName,
    },
    teams: [],
    players: [],
    freeAgents: [],
    transfers: [],
    lastUpdated: null,
    lastUpdateSource: null,
    stats: {
      teamCount: 0,
      playerCount: 0,
      activeCount: 0,
      freeAgentCount: 0,
      staffCount: 0,
    },
  };
  const hasGameData = Boolean(dataMap[gameSlug]);
  const sectionMeta =
    DASHBOARD_SECTIONS.find((item) => item.key === section) ??
    DASHBOARD_SECTIONS[0];
  const isStandings = section === "standings";
  const normalizedQuery = query.trim().toLowerCase();

  const handleGameChange = (nextSlug: string) => {
    if (nextSlug === gameSlug) return;
    setGameSlug(nextSlug);
    setSection("roster");
    setStatusFilter("all");
    setSelectedRegion("all");
    setQuery("");
    setSelectedPlayer(null);
    setSelectedTeam(null);
    setMarketStatusFilter("all");
    setMarketRoleFilter("all");
  };

  const handleSectionChange = (next: DashboardSection) => {
    setSection(next);
    setStatusFilter("all");
    setQuery("");
    setSelectedPlayer(null);
    setSelectedTeam(null);
    if (next !== "lft") {
      setMarketStatusFilter("all");
      setMarketRoleFilter("all");
    }
  };

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setSelectedRegion("all");
    setSection("roster");
    setSelectedTeam(null);
    setMarketStatusFilter("all");
    setMarketRoleFilter("all");
  };

  const REGION_ORDER =
    gameSlug === "league-of-legends"
      ? ["LCK"]
      : gameSlug === "identity-v"
        ? ["IJL"]
        : ["VCT Pacific (JP)", "JP Tier 2 (VCJ)"];

  const availableRegions = useMemo(
    () =>
      Array.from(new Set(data.teams.map((team) => team.regionCode))).sort(
        (a, b) => {
          const indexA = REGION_ORDER.indexOf(a);
          const indexB = REGION_ORDER.indexOf(b);
          if (indexA === -1 && indexB === -1) return a.localeCompare(b);
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        },
      ),
    [data.teams],
  );

  const filteredTeams = useMemo(() => {
    return data.teams
      .filter(
        (team) =>
          selectedRegion === "all" || team.regionCode === selectedRegion,
      )
      .map((team) => {
        const teamMatches =
          normalizedQuery.length > 0 &&
          (matchesQuery(team.name, normalizedQuery) ||
            matchesQuery(team.shortName, normalizedQuery) ||
            matchesQuery(team.regionName, normalizedQuery) ||
            matchesQuery(team.description, normalizedQuery));

        const players = team.players.filter((player) => {
          if (statusFilter === "active" && player.status !== "ACTIVE") {
            return false;
          }
          if (
            statusFilter === "free" &&
            player.status !== "LFT" &&
            player.status !== "FA"
          ) {
            return false;
          }
          return (
            normalizedQuery.length === 0 ||
            teamMatches ||
            playerMatchesQuery(player, normalizedQuery)
          );
        });

        const staff = showStaff
          ? team.staff.filter(
              (member) =>
                normalizedQuery.length === 0 ||
                teamMatches ||
                playerMatchesQuery(member, normalizedQuery),
            )
          : [];

        return { ...team, players, staff };
      })
      .filter((team) => team.players.length > 0 || team.staff.length > 0)
      .sort((a, b) => {
        const aFavorite = isFavorite(data.game.slug, a.shortName) ? 1 : 0;
        const bFavorite = isFavorite(data.game.slug, b.shortName) ? 1 : 0;
        return bFavorite - aFavorite;
      });
  }, [
    data.teams,
    data.game.slug,
    selectedRegion,
    normalizedQuery,
    statusFilter,
    showStaff,
    isFavorite,
  ]);

  const filteredTransfers = useMemo(() => {
    return data.transfers.filter((event) => {
      if (
        statusFilter === "free" &&
        event.playerStatus !== "LFT" &&
        event.playerStatus !== "FA"
      ) {
        return false;
      }
      if (statusFilter === "active" && event.playerStatus !== "ACTIVE") {
        return false;
      }
      if (normalizedQuery.length === 0) return true;

      return (
        matchesQuery(event.playerHandle, normalizedQuery) ||
        matchesQuery(event.playerRealName, normalizedQuery) ||
        matchesQuery(event.fromTeamName, normalizedQuery) ||
        matchesQuery(event.toTeamName, normalizedQuery) ||
        matchesQuery(event.role, normalizedQuery) ||
        matchesQuery(event.eventDate, normalizedQuery) ||
        matchesQuery(event.sourceTitle, normalizedQuery)
      );
    });
  }, [data.transfers, normalizedQuery, statusFilter]);

  const isLftSection = section === "lft";

  const marketPlayers = useMemo(() => {
    return data.players
      .filter((player) => {
        if (
          !showStaff &&
          (player.category === "STAFF" || isStreamerLikeRole(player.currentRole))
        ) {
          return false;
        }
        const isMarketStatus = ["LFT", "FA", "SUB", "INACTIVE"].includes(
          player.status,
        );
        const hasNoCurrentTeam = !player.currentTeamName;
        return isMarketStatus || hasNoCurrentTeam;
      })
      .sort((a, b) => {
        const aFavorite = isPlayerFavorite(data.game.slug, a.id) ? 1 : 0;
        const bFavorite = isPlayerFavorite(data.game.slug, b.id) ? 1 : 0;
        if (aFavorite !== bFavorite) return bFavorite - aFavorite;

        const statusOrder: Record<string, number> = {
          LFT: 0,
          FA: 1,
          SUB: 2,
          INACTIVE: 3,
          ACTIVE: 4,
        };
        const orderDiff =
          (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
        if (orderDiff !== 0) return orderDiff;

        return a.handle.localeCompare(b.handle, "ja");
      });
  }, [data.players, data.game.slug, showStaff, isPlayerFavorite]);

  const filteredMarketPlayers = useMemo(() => {
    return marketPlayers.filter((player) => {
      if (marketStatusFilter === "lft" && player.status !== "LFT") {
        return false;
      }
      if (marketStatusFilter === "fa" && player.status !== "FA") {
        return false;
      }
      if (
        marketStatusFilter === "inactive-bench" &&
        player.status !== "INACTIVE" &&
        player.status !== "SUB"
      ) {
        return false;
      }
      if (marketRoleFilter !== "all") {
        const role = player.currentRole?.trim() ?? "";
        if (!roleMatchesFilter(role, marketRoleFilter)) {
          return false;
        }
      }
      if (normalizedQuery.length === 0) return true;
      return playerMatchesQuery(player, normalizedQuery);
    });
  }, [marketPlayers, marketStatusFilter, marketRoleFilter, normalizedQuery]);

  const visibleCount =
    !hasGameData || isStandings
      ? 0
      : section === "transfers"
        ? filteredTransfers.length
        : isLftSection
          ? filteredMarketPlayers.length
          : filteredTeams.reduce(
              (total, team) =>
                total + team.players.length + team.staff.length,
              0,
            );

  const totalCount =
    section === "transfers"
      ? data.transfers.length
      : isLftSection
        ? marketPlayers.length
        : data.stats.playerCount + (showStaff ? data.stats.staffCount : 0);

  const hasResults = visibleCount > 0;

  return (
    <div className={cn(game.themeClass, "relative min-h-screen")}>
      <div className="sticky top-0 z-40 bg-zinc-950/85 backdrop-blur-xl">
        <AppHeader
          activeGame={game}
          onGameChange={handleGameChange}
          lastUpdated={data.lastUpdated}
          lastUpdateSource={data.lastUpdateSource}
          updateCommand={
            gameSlug === "league-of-legends"
              ? "npm run update:lol"
              : gameSlug === "identity-v"
                ? "npm run update:idv"
                : "npm run update:valo"
          }
        />
        <SectionNav
          game={game}
          section={section}
          onSectionChange={handleSectionChange}
          counts={
            hasGameData
              ? {
                  roster: data.stats.playerCount,
                  transfers: data.transfers.length,
                  lft: data.stats.freeAgentCount,
                }
              : undefined
          }
        />
        {hasGameData && !isStandings && section === "roster" ? (
          <RegionTabs
            regions={availableRegions}
            active={selectedRegion}
            onChange={setSelectedRegion}
          />
        ) : null}

        {hasGameData && !isStandings ? (
          <ControlBar
            query={query}
            onQueryChange={setQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            showStatusFilter={section === "roster" || section === "transfers"}
            showStaffToggle={section === "roster"}
            showStaff={showStaff}
            onShowStaffChange={setShowStaff}
            placeholder={
              section === "transfers"
                ? "選手名・チーム名・出典で検索..."
                : section === "lft"
                  ? "LFT / FA 選手を検索..."
                  : "選手名・チーム名・ロールで検索..."
            }
            freeAgentCount={data.stats.freeAgentCount}
            activeCount={data.stats.activeCount}
            visibleCount={visibleCount}
            totalCount={totalCount}
            onReset={resetFilters}
          />
        ) : null}

        {hasGameData && isLftSection ? (
          <MarketFilterBar
            gameSlug={gameSlug}
            statusFilter={marketStatusFilter}
            onStatusFilterChange={setMarketStatusFilter}
            roleFilter={marketRoleFilter}
            onRoleFilterChange={setMarketRoleFilter}
            showStaff={showStaff}
            onShowStaffChange={setShowStaff}
            resultCount={filteredMarketPlayers.length}
          />
        ) : null}
      </div>

      <main className="mx-auto max-w-[1600px] px-4 pb-16 pt-6 sm:px-6">
        <section className="relative overflow-hidden rounded-xl border border-zinc-800/80 bg-gradient-to-r from-zinc-900/70 via-zinc-900/35 to-zinc-950/20 px-4 py-5 sm:px-6">
          <span className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-brand/[0.07] blur-3xl" />
          <span className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-64 rounded-full bg-brand-alt/[0.05] blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/[0.06] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-brand">
                  <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                  {game.regionLabel} / {game.name}
                </span>
                {hasGameData ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
                    <Database className="h-2.5 w-2.5" />
                    Local SQLite
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700/60 bg-zinc-800/30 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                    <Layers className="h-2.5 w-2.5" />
                    UI Framework
                  </span>
                )}
              </div>
              <h1 className="mt-3 text-balance font-display text-2xl font-black tracking-wide text-white sm:text-3xl">
                {game.heroTitle}
              </h1>
              <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-zinc-500 sm:text-xs">
                {game.description}
              </p>
            </div>

            {hasGameData ? (
              <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[460px]">
                <Metric
                  icon={<Shield className="h-3.5 w-3.5" />}
                  label="Teams"
                  value={data.stats.teamCount}
                  tone="brand"
                />
                <Metric
                  icon={<Users className="h-3.5 w-3.5" />}
                  label="Players"
                  value={data.stats.playerCount}
                  tone="zinc"
                />
                <Metric
                  icon={<Activity className="h-3.5 w-3.5" />}
                  label="Active"
                  value={data.stats.activeCount}
                  tone="emerald"
                />
                <Metric
                  icon={<UserRoundSearch className="h-3.5 w-3.5" />}
                  label="LFT / FA"
                  value={data.stats.freeAgentCount}
                  tone="amber"
                />
              </div>
            ) : (
              <div className="grid shrink-0 grid-cols-2 gap-2 lg:w-[460px]">
                <InfoTile label="Region" value={game.regionLabel} />
                <InfoTile label="Theme" value={game.themeName} />
                <InfoTile label="Data" value={game.dataPhase} />
                <InfoTile label="Status" value="UI Ready" accent />
              </div>
            )}
          </div>
        </section>

        <div className="mb-3 mt-7 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-zinc-200">
              {sectionMeta.title}
            </h2>
            <p className="mt-1 max-w-3xl text-[10.5px] text-zinc-600">
              {sectionMeta.description}
            </p>
          </div>
          <span className="rounded-full border border-zinc-800/80 bg-zinc-900/40 px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-zinc-500">
            {!hasGameData || isStandings
              ? `${game.shortName} / ${sectionMeta.hint}`
              : query
                ? `filtered: ${visibleCount}`
                : `${visibleCount} ${COUNT_UNIT[section]}`}
          </span>
        </div>

        {!hasGameData ? (
          <SectionPlaceholder
            icon={game.icon}
            eyebrow={`${game.shortName} / Title preview`}
            title={`${game.name} の${sectionMeta.label}は準備中です`}
            description={game.description}
            phase={game.dataPhase}
            points={[...game.scope, `テーマ: ${game.themeName}`]}
          />
        ) : isStandings ? (
          <SectionPlaceholder
            icon={Trophy}
            eyebrow="Standings / UI Framework"
            title="リーグ順位表は Phase 6 で実装予定"
            description="順位表の表示枠とサブナビゲーションは先行して実装済みです。次フェーズで VCT サーキットポイントや勝敗データを取得し、このテーブルへ接続します。"
            phase="Phase 6"
            points={[
              "リーグ公式順位・勝敗・ポイントの取得",
              "チームカード右上の #1 ランクバッジ",
              "順位順ソートと順位表の連携",
            ]}
          >
            <StandingsSkeleton />
          </SectionPlaceholder>
        ) : hasResults ? (
          section === "transfers" ? (
            <TransferTimeline
              events={filteredTransfers}
              players={data.players}
              onSelectPlayer={setSelectedPlayer}
            />
          ) : isLftSection ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredMarketPlayers.map((player) => (
                <MarketPlayerCard
                  key={player.id}
                  player={player}
                  isFavorite={isPlayerFavorite(data.game.slug, player.id)}
                  onToggleFavorite={() =>
                    togglePlayerFavorite(data.game.slug, player.id)
                  }
                  onSelect={setSelectedPlayer}
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredTeams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  showStaff={showStaff}
                  isFavorite={isFavorite(data.game.slug, team.shortName)}
                  onToggleFavorite={() =>
                    toggleFavorite(data.game.slug, team.shortName)
                  }
                  onSelectTeam={() => setSelectedTeam(team)}
                  onSelectPlayer={setSelectedPlayer}
                />
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800/80 bg-zinc-900/20 px-6 py-20 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800/80 bg-zinc-900/50 text-zinc-600">
              <SearchX className="h-5 w-5" />
            </span>
            <p className="mt-4 font-display text-base font-bold tracking-wide text-zinc-300">
              条件に一致するデータがありません
            </p>
            <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-zinc-600">
              {section === "transfers"
                ? "検索語を短くするか、ステータスフィルターを「すべて」に戻してみてください。データが空の場合は npm run update を実行してください。"
                : section === "lft"
                  ? "現在、条件に一致する LFT / FA 選手は登録されていません。ステータス・ロールフィルターや検索語を確認してください。"
                  : "検索語を短くするか、ステータスフィルターを「すべて」に戻してみてください。"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="mt-4"
            >
              フィルターをリセット
            </Button>
          </div>
        )}

        <footer className="mt-12 flex flex-col gap-2 border-t border-zinc-800/70 pt-5 text-[10px] text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5">
            <Database className="h-3 w-3" />
            完全ローカル動作 / SQLite + Prisma / Next.js App Router
          </p>
          <p className="font-mono text-[9.5px] text-zinc-700">
            Last local update:{" "}
            {hasGameData ? data.lastUpdated ?? "未取得" : "—"}
            <span className="mx-2 text-zinc-800">|</span>
            {gameSlug === "league-of-legends"
              ? "npm run update:lol"
              : gameSlug === "identity-v"
                ? "npm run update:idv"
                : "npm run update:valo"}
          </p>
        </footer>
      </main>

      <PlayerModal
        player={selectedPlayer}
        open={Boolean(selectedPlayer)}
        onOpenChange={(open) => {
          if (!open) setSelectedPlayer(null);
        }}
      />

      <TeamModal
        team={selectedTeam}
        open={Boolean(selectedTeam)}
        onOpenChange={(open) => {
          if (!open) setSelectedTeam(null);
        }}
        onSelectPlayer={(player) => {
          setSelectedTeam(null);
          setSelectedPlayer(player);
        }}
      />
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  tone: "brand" | "zinc" | "emerald" | "amber";
}) {
  const toneClassName = {
    brand: "text-brand border-brand/20 bg-brand/[0.06]",
    zinc: "text-zinc-300 border-zinc-600/40 bg-zinc-700/20",
    emerald: "text-emerald-300 border-emerald-400/15 bg-emerald-400/[0.05]",
    amber: "text-amber-300 border-amber-400/15 bg-amber-400/[0.05]",
  }[tone];

  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-2.5 py-2">
      <p className="flex items-center gap-1 text-[8.5px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
        <span
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded border",
            toneClassName,
          )}
        >
          {icon}
        </span>
        {label}
      </p>
      <p className="mt-1.5 font-display text-xl font-black tracking-wide text-zinc-100">
        {value.toString().padStart(2, "0")}
      </p>
    </div>
  );
}

function InfoTile({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/80 bg-zinc-950/40 px-2.5 py-2">
      <p className="text-[8.5px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
        {label}
      </p>
      <p
        title={value}
        className={cn(
          "mt-1.5 truncate font-display text-[13px] font-bold tracking-wide",
          accent ? "text-brand" : "text-zinc-200",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function StandingsSkeleton() {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-lg border border-zinc-800/80 bg-zinc-950/40"
    >
      <div className="grid grid-cols-[28px_1fr_64px_44px] gap-2 border-b border-zinc-800/80 bg-zinc-900/60 px-3 py-2 text-[8.5px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
        <span>#</span>
        <span>Team</span>
        <span>W-L</span>
        <span>Pts</span>
      </div>
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="grid grid-cols-[28px_1fr_64px_44px] items-center gap-2 border-b border-zinc-800/50 px-3 py-2.5 last:border-b-0"
        >
          <span className="font-mono text-[10px] text-zinc-700">
            {row + 1}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-5 w-5 rounded border border-zinc-800 bg-zinc-900/70" />
            <span className="h-2 w-20 rounded bg-zinc-800/80" />
          </span>
          <span className="font-mono text-[10px] text-zinc-700">—</span>
          <span className="font-mono text-[10px] text-zinc-700">—</span>
        </div>
      ))}
    </div>
  );
}
