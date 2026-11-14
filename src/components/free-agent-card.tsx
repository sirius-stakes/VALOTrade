"use client";

import { ArrowUpRight, Clock3, UserRoundSearch } from "lucide-react";

import { PlayerAvatar } from "@/components/player-avatar";
import { RoleTag, StatusBadge } from "@/components/status-badge";
import { TeamLogo } from "@/components/team-logo";
import type { PlayerDto } from "@/lib/types";
import { cn, formatPeriod } from "@/lib/utils";

type FreeAgentCardProps = {
  player: PlayerDto;
  onSelect: (player: PlayerDto) => void;
};

export function FreeAgentCard({ player, onSelect }: FreeAgentCardProps) {
  const latest = player.memberships[0] ?? null;
  const isLft = player.status === "LFT";

  return (
    <button
      type="button"
      onClick={() => onSelect(player)}
      className={cn(
        "group relative flex w-full items-start gap-3 overflow-hidden rounded-xl border bg-zinc-900/40 p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
        isLft
          ? "border-amber-400/20 hover:border-amber-400/40 hover:bg-zinc-900/55"
          : "border-purple-400/20 hover:border-purple-400/40 hover:bg-zinc-900/55",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full blur-2xl",
          isLft ? "bg-amber-400/10" : "bg-purple-400/10",
        )}
      />

      <PlayerAvatar handle={player.handle} size="md" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-base font-bold tracking-wide text-zinc-100">
            {player.handle}
          </span>
          <StatusBadge status={player.status} />
          {latest?.role ? <RoleTag role={latest.role} /> : null}
        </div>

        <p className="mt-0.5 text-[11px] text-zinc-500">
          {player.realName ?? "本名非公開"}
          {player.regionCode ? ` / ${player.regionCode}` : ""}
        </p>

        {player.note ? (
          <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
            {player.note}
          </p>
        ) : null}

        {latest ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-2 py-1.5">
            <TeamLogo
              logoUrl={latest.teamLogoUrl}
              shortName={latest.teamShortName}
              accent={latest.teamAccent}
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-zinc-300">
                前所属: {latest.teamName}
              </p>
              <p className="flex items-center gap-1 text-[10px] text-zinc-600">
                <Clock3 className="h-2.5 w-2.5" />
                {formatPeriod(latest.startDate, latest.endDate, latest.isCurrent)}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
            <UserRoundSearch className="h-3 w-3" />
            {player.status === "LFT"
              ? "移籍先を募集中"
              : "フリーエージェント"}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 transition-colors group-hover:text-zinc-300">
            詳細
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </button>
  );
}
