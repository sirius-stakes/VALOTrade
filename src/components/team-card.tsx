"use client";

import {
  ChevronRight,
  ExternalLink,
  Shield,
  Users,
} from "lucide-react";

import { RoleTag, StatusBadge } from "@/components/status-badge";
import { PlayerAvatar } from "@/components/player-avatar";
import { TeamLogo } from "@/components/team-logo";
import { Badge } from "@/components/ui/badge";
import { getTeamAccent } from "@/lib/status";
import type { PlayerDto, TeamDto } from "@/lib/types";
import { cn } from "@/lib/utils";

type TeamCardProps = {
  team: TeamDto;
  onSelectPlayer: (player: PlayerDto) => void;
};

export function TeamCard({ team, onSelectPlayer }: TeamCardProps) {
  const accent = getTeamAccent(team.accent);

  return (
    <article className="group/card relative flex flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.045] to-white/[0.012] shadow-[0_14px_40px_-24px_rgba(0,0,0,0.9)] transition-colors duration-200 hover:border-white/[0.14]">
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-gradient-to-br opacity-[0.09] blur-2xl",
          accent.gradient,
        )}
      />

      <header className="relative flex items-start gap-3 px-4 pb-3 pt-4">
        <TeamLogo
          logoUrl={team.logoUrl}
          shortName={team.shortName}
          accent={team.accent}
          size="card"
        />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start gap-2">
            <h2 className="min-w-0 flex-1 truncate font-display text-[17px] font-bold tracking-wide text-zinc-50">
              {team.name}
            </h2>
            {team.officialUrl ? (
              <a
                href={team.officialUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`${team.name} 公式サイト`}
                className="mt-0.5 rounded p-1 text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
                onClick={(event) => event.stopPropagation()}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge className="border-white/10 bg-white/[0.04] text-zinc-400">
              {team.regionCode}
            </Badge>
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">
              {team.shortName}
            </span>
          </div>
        </div>
      </header>

      {team.description ? (
        <p className="line-clamp-2 px-4 pb-3 text-[11px] leading-relaxed text-zinc-500">
          {team.description}
        </p>
      ) : null}

      <div className="relative flex-1 space-y-0.5 px-2 pb-2">
        {team.players.length > 0 ? (
          team.players.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onSelectPlayer(player)}
              aria-label={`${player.handle} の詳細を開く`}
              className="group/player flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-white/[0.06] hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30"
            >
              <PlayerAvatar handle={player.handle} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="truncate text-[13px] font-semibold text-zinc-200 transition-colors group-hover/player:text-white">
                    {player.handle}
                  </span>
                  {player.realName ? (
                    <span className="hidden truncate text-[10px] text-zinc-600 xl:inline">
                      {player.realName}
                    </span>
                  ) : null}
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <RoleTag role={player.currentRole ?? "Member"} />
                  <span className="truncate text-[10px] text-zinc-600">
                    {player.memberships.length > 1
                      ? `${player.memberships.length} teams`
                      : "New"}
                  </span>
                </div>
              </div>
              <StatusBadge status={player.status} />
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-700 transition-transform group-hover/player:translate-x-0.5 group-hover/player:text-zinc-400" />
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <Shield className="h-5 w-5 text-zinc-700" />
            <p className="text-xs text-zinc-600">該当する選手がいません</p>
          </div>
        )}
      </div>

      <footer className="mt-auto flex items-center justify-between border-t border-white/[0.06] px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          <Users className="h-3 w-3" />
          {team.players.length} players
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-700">
          Roster
        </span>
      </footer>
    </article>
  );
}
