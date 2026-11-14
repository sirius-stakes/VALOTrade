"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  Database,
  Shield,
  SearchX,
  UserRoundSearch,
  Users,
} from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { ControlBar } from "@/components/control-bar";
import { FreeAgentCard } from "@/components/free-agent-card";
import { PlayerModal } from "@/components/player-modal";
import { TeamCard } from "@/components/team-card";
import { TransferTimeline } from "@/components/transfer-timeline";
import { Button } from "@/components/ui/button";
import type { StatusFilter, ViewMode } from "@/lib/status";
import type { DashboardData, PlayerDto } from "@/lib/types";
import { cn } from "@/lib/utils";

type DashboardProps = {
  data: DashboardData;
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

export function Dashboard({ data }: DashboardProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [view, setView] = useState<ViewMode>("teams");
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerDto | null>(null);

  const normalizedQuery = query.trim().toLowerCase();

  const handleStatusFilterChange = (next: StatusFilter) => {
    setStatusFilter(next);
  };

  const handleViewChange = (next: ViewMode) => {
    setView(next);
  };

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setView("teams");
  };

  const filteredTeams = useMemo(() => {
    return data.teams
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
          if (statusFilter === "free") {
            return false;
          }
          return (
            normalizedQuery.length === 0 ||
            teamMatches ||
            playerMatchesQuery(player, normalizedQuery)
          );
        });

        return { ...team, players };
      })
      .filter((team) => team.players.length > 0);
  }, [data.teams, normalizedQuery, statusFilter]);

  const filteredFreeAgents = useMemo(() => {
    if (statusFilter === "active") return [];

    return data.freeAgents.filter(
      (player) =>
        normalizedQuery.length === 0 ||
        playerMatchesQuery(player, normalizedQuery),
    );
  }, [data.freeAgents, normalizedQuery, statusFilter]);

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

  const showsFreeAgentList = view === "teams" && statusFilter === "free";

  const visibleCount =
    view === "transfers"
      ? filteredTransfers.length
      : showsFreeAgentList
        ? filteredFreeAgents.length
        : filteredTeams.reduce((total, team) => total + team.players.length, 0);
  const totalCount =
    view === "transfers"
      ? data.transfers.length
      : showsFreeAgentList
        ? data.freeAgents.length
        : data.stats.playerCount;
  const hasResults = visibleCount > 0;

  return (
    <div className="relative min-h-screen">
      <div className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#070a0f]/85 backdrop-blur-xl">
        <AppHeader
          lastUpdated={data.lastUpdated}
          lastUpdateSource={data.lastUpdateSource}
        />
        <ControlBar
          query={query}
          onQueryChange={setQuery}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          view={view}
          onViewChange={handleViewChange}
          freeAgentCount={data.stats.freeAgentCount}
          activeCount={data.stats.activeCount}
          visibleCount={visibleCount}
          totalCount={totalCount}
        />
      </div>

      <main className="mx-auto max-w-[1600px] px-4 pb-16 pt-6 sm:px-6">
        <section className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-r from-white/[0.035] via-white/[0.015] to-transparent px-4 py-5 sm:px-6">
          <span className="pointer-events-none absolute -right-24 -top-32 h-72 w-72 rounded-full bg-red-500/[0.07] blur-3xl" />
          <span className="pointer-events-none absolute bottom-0 left-1/3 h-32 w-64 rounded-full bg-violet-500/[0.04] blur-3xl" />

          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/20 bg-red-400/[0.06] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-red-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                  Japan / VALORANT
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-300/80">
                  <Database className="h-2.5 w-2.5" />
                  Local SQLite
                </span>
              </div>
              <h1 className="mt-3 text-balance font-display text-2xl font-black tracking-wide text-white sm:text-3xl">
                プロチーム移籍・ロスター追跡
              </h1>
              <p className="mt-1.5 max-w-2xl text-[11px] leading-relaxed text-zinc-500 sm:text-xs">
                ZETA DIVISION / DetonatioN FocusMe / FENNEL / QTnet
                DISCONNECT の4チームに限定し、ロスター、LFT / FA
                選手、移籍・契約の履歴をひとつのダッシュボードで追跡。データは外部クラウドに送信されません。
              </p>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-4 lg:w-[460px]">
              <Metric
                icon={<Shield className="h-3.5 w-3.5" />}
                label="Teams"
                value={data.stats.teamCount}
                tone="violet"
              />
              <Metric
                icon={<Users className="h-3.5 w-3.5" />}
                label="Players"
                value={data.stats.playerCount}
                tone="slate"
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
          </div>
        </section>

        <div className="mb-3 mt-7 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-zinc-200">
              {view === "transfers"
                ? "直近の移籍タイムライン"
                : showsFreeAgentList
                  ? "LFT / FA 選手一覧"
                  : "チーム別ロスター"}
            </h2>
            <p className="mt-1 text-[10.5px] text-zinc-600">
              {view === "transfers"
                ? "Liquipedia から取得した加入・移籍・退団・LFT / FA を新しい順に表示。選手名をクリックすると経歴が開きます。"
                : showsFreeAgentList
                  ? "移籍先を探している選手。カードをクリックして経歴を確認できます。"
                  : "選手名をクリックすると移籍・所属タイムラインが開きます。"}
            </p>
          </div>
          <span className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 font-mono text-[9.5px] uppercase tracking-wider text-zinc-500">
            {query
              ? `filtered: ${visibleCount}`
              : `${visibleCount} ${view === "transfers" ? "events" : "players"}`}
          </span>
        </div>

        {hasResults ? (
          view === "transfers" ? (
            <TransferTimeline
              events={filteredTransfers}
              players={data.players}
              onSelectPlayer={setSelectedPlayer}
            />
          ) : showsFreeAgentList ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredFreeAgents.map((player) => (
                <FreeAgentCard
                  key={player.id}
                  player={player}
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
                  onSelectPlayer={setSelectedPlayer}
                />
              ))}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-white/[0.012] px-6 py-20 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.03] text-zinc-600">
              <SearchX className="h-5 w-5" />
            </span>
            <p className="mt-4 font-display text-base font-bold tracking-wide text-zinc-300">
              条件に一致するデータがありません
            </p>
            <p className="mt-1 max-w-sm text-[11px] leading-relaxed text-zinc-600">
              {view === "transfers"
                ? "検索語を短くするか、ステータスフィルターを「すべて」に戻してみてください。データが空の場合は npm run update を実行してください。"
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

        <footer className="mt-12 flex flex-col gap-2 border-t border-white/[0.05] pt-5 text-[10px] text-zinc-600 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5">
            <Database className="h-3 w-3" />
            完全ローカル動作 / SQLite + Prisma / Next.js App Router
          </p>
          <p className="font-mono text-[9.5px] text-zinc-700">
            Last local update: {data.lastUpdated ?? "未取得"}
            <span className="mx-2 text-zinc-800">|</span>
            npm run update
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
  tone: "violet" | "slate" | "emerald" | "amber";
}) {
  const toneClassName = {
    violet: "text-violet-300 border-violet-400/15 bg-violet-400/[0.06]",
    slate: "text-slate-300 border-slate-400/15 bg-slate-400/[0.05]",
    emerald: "text-emerald-300 border-emerald-400/15 bg-emerald-400/[0.05]",
    amber: "text-amber-300 border-amber-400/15 bg-amber-400/[0.05]",
  }[tone];

  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2">
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
