"use client";

import {
  ChevronRight,
  ExternalLink,
  Globe2,
  Shield,
  Star,
  UserCog,
  Users,
} from "lucide-react";

import { NationalityFlag } from "@/components/nationality-flag";
import { RoleTag, StatusBadge } from "@/components/status-badge";
import { PlayerAvatar } from "@/components/player-avatar";
import { TeamLogo } from "@/components/team-logo";
import { Badge } from "@/components/ui/badge";
import { getTeamAccent } from "@/lib/status";
import type { PlayerDto, TeamDto } from "@/lib/types";
import { cn } from "@/lib/utils";

type TeamCardProps = {
  team: TeamDto;
  showStaff: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onSelectTeam?: () => void;
  onSelectPlayer: (player: PlayerDto) => void;
};

export function TeamCard({
  team,
  showStaff,
  isFavorite,
  onToggleFavorite,
  onSelectTeam,
  onSelectPlayer,
}: TeamCardProps) {
  const accent = getTeamAccent(team.accent);
  const importHandles = team.importPlayers
    .map((player) => player.handle)
    .join(", ");

  return (
    <article
      className={cn(
        "group/card relative flex flex-col overflow-hidden rounded-xl border bg-zinc-900/40 shadow-[0_16px_44px_-30px_rgba(0,0,0,1)] transition-colors duration-200 hover:bg-zinc-900/55",
        isFavorite
          ? "border-amber-400/30 hover:border-amber-400/45"
          : "border-zinc-800/80 hover:border-zinc-700/90",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px opacity-70",
          accent.line,
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-gradient-to-br opacity-[0.07] blur-2xl",
          accent.gradient,
        )}
      />

      <header className="relative flex items-start gap-3 px-4 pb-3 pt-4">
        <button
          type="button"
          onClick={onSelectTeam}
          disabled={!onSelectTeam}
          aria-label={onSelectTeam ? `${team.name} の詳細を開く` : undefined}
          className={cn(
            "shrink-0 transition-opacity",
            onSelectTeam
              ? "cursor-pointer hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
              : "cursor-default",
          )}
        >
          <TeamLogo
            logoUrl={team.logoUrl}
            shortName={team.shortName}
            accent={team.accent}
            size="card"
          />
        </button>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={onSelectTeam}
              disabled={!onSelectTeam}
              className={cn(
                "min-w-0 flex-1 text-left",
                onSelectTeam
                  ? "cursor-pointer transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                  : "cursor-default",
              )}
            >
              <h2 className="truncate font-display text-[17px] font-bold tracking-wide text-zinc-50">
                {team.name}
              </h2>
            </button>
            <button
              type="button"
              aria-pressed={isFavorite}
              aria-label={
                isFavorite
                  ? `${team.name} のお気に入りを解除`
                  : `${team.name} をお気に入りに追加`
              }
              title={isFavorite ? "お気に入りから外す" : "お気に入りに追加"}
              onClick={onToggleFavorite}
              className={cn(
                "mt-0.5 rounded p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
                isFavorite
                  ? "text-amber-300 hover:bg-amber-400/10"
                  : "text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-200",
              )}
            >
              <Star
                className={cn("h-3.5 w-3.5", isFavorite && "fill-current")}
              />
            </button>
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
            <Badge className="border-zinc-700/70 bg-zinc-800/40 text-zinc-400">
              {team.regionCode}
            </Badge>
            <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-zinc-600">
              {team.shortName}
            </span>
            {team.importCount > 0 ? (
              <Badge
                title={
                  importHandles
                    ? `Import: ${importHandles}`
                    : "Import players"
                }
                className="gap-1 border-sky-400/25 bg-sky-400/[0.07] text-sky-300"
              >
                <Globe2 className="h-2.5 w-2.5" />
                Import {team.importCount}
              </Badge>
            ) : null}
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
            <RosterRow
              key={player.id}
              player={player}
              onSelect={onSelectPlayer}
            />
          ))
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-6 text-center">
            <Shield className="h-5 w-5 text-zinc-700" />
            <p className="text-xs text-zinc-600">該当する選手がいません</p>
          </div>
        )}

        {showStaff ? (
          team.staff.length > 0 ? (
            <div className="mt-1 border-t border-zinc-800/60 pt-1.5">
              <p className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                <UserCog className="h-3 w-3" />
                Staff
                <span className="font-mono text-[9px] tracking-normal text-zinc-700">
                  {team.staff.length}
                </span>
              </p>
              {team.staff.map((member) => (
                <RosterRow
                  key={member.id}
                  player={member}
                  onSelect={onSelectPlayer}
                />
              ))}
            </div>
          ) : (
            <p className="px-3 pb-1 pt-2 text-[10px] text-zinc-700">
              マネージャー・アナリストの登録はありません
            </p>
          )
        ) : null}
      </div>

      <footer className="mt-auto flex items-center justify-between gap-2 border-t border-zinc-800/70 bg-zinc-950/30 px-4 py-2.5">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          <Users className="h-3 w-3" />
          {team.players.length} members
          {showStaff ? (
            <span className="text-zinc-700">
              + {team.staff.length} staff
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-700">
          {isFavorite ? "Pinned" : "Roster"}
        </span>
      </footer>
    </article>
  );
}

function RosterRow({
  player,
  onSelect,
}: {
  player: PlayerDto;
  onSelect: (player: PlayerDto) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(player)}
      aria-label={`${player.handle} の詳細を開く`}
      className="group/player flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-zinc-700/60 hover:bg-zinc-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
    >
      <PlayerAvatar handle={player.handle} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <NationalityFlag country={player.country} />
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
  );
}
