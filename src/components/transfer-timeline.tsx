"use client";

import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  ArrowRight,
  ExternalLink,
  LogIn,
  LogOut,
  PauseCircle,
  RefreshCw,
  Sparkles,
  UserRoundSearch,
  UserX,
} from "lucide-react";
import type { TransferType } from "@prisma/client";

import { PlayerAvatar } from "@/components/player-avatar";
import { RoleTag, StatusBadge } from "@/components/status-badge";
import { TRANSFER_META } from "@/lib/status";
import type { PlayerDto, TransferEventDto } from "@/lib/types";
import { cn, formatEventDate } from "@/lib/utils";

type TransferTimelineProps = {
  events: TransferEventDto[];
  players: PlayerDto[];
  onSelectPlayer: (player: PlayerDto) => void;
};

const EVENT_ICONS: Record<TransferType, LucideIcon> = {
  JOIN: LogIn,
  TRANSFER: ArrowLeftRight,
  LEAVE: LogOut,
  LFT: UserRoundSearch,
  FA: Sparkles,
  INACTIVE: PauseCircle,
  RETIRE: UserX,
  OTHER: RefreshCw,
};

export function TransferTimeline({
  events,
  players,
  onSelectPlayer,
}: TransferTimelineProps) {
  const playerMap = new Map(players.map((player) => [player.id, player]));

  return (
    <div className="mx-auto max-w-4xl">
      <ol className="relative ml-[7px] border-l border-white/[0.08] sm:ml-3">
        {events.map((event) => {
          const meta = TRANSFER_META[event.type];
          const Icon = EVENT_ICONS[event.type];
          const player = event.playerId
            ? playerMap.get(event.playerId) ?? null
            : null;

          return (
            <li key={event.id} className="relative pb-3.5 pl-5 sm:pl-7">
              <span
                className={cn(
                  "absolute -left-[5px] top-6 h-[9px] w-[9px] rounded-full ring-4 ring-[#070a0f]",
                  meta.dotClassName,
                  (event.type === "LFT" || event.type === "FA") &&
                    "animate-pulse-soft",
                )}
              />
              <span
                className={cn(
                  "pointer-events-none absolute bottom-0 left-0 top-8 w-px bg-gradient-to-b to-transparent",
                  meta.lineClassName,
                )}
              />

              <article className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-white/[0.012] px-3.5 py-3 transition-colors hover:border-white/[0.14] sm:px-4">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider",
                      meta.badgeClassName,
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </span>
                  <time
                    dateTime={event.eventDate}
                    className="font-mono text-[10.5px] tracking-tight text-zinc-500"
                  >
                    {formatEventDate(event.eventDate)}
                  </time>
                  {event.role ? <RoleTag role={event.role} /> : null}
                  <span className="ml-auto hidden text-[9px] font-medium uppercase tracking-[0.16em] text-zinc-700 sm:inline">
                    {event.sourceTitle?.slice(0, 28) ?? "Liquipedia"}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <PlayerAvatar handle={event.playerHandle} size="sm" />

                  <div className="min-w-0">
                    {player ? (
                      <button
                        type="button"
                        onClick={() => onSelectPlayer(player)}
                        className="group/player inline-flex items-center gap-1 text-left font-display text-[15px] font-bold tracking-wide text-zinc-100 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/30"
                      >
                        {event.playerHandle}
                        <ArrowRight className="h-3 w-3 -translate-x-1 text-zinc-600 opacity-0 transition-all group-hover/player:translate-x-0 group-hover/player:opacity-100" />
                      </button>
                    ) : (
                      <p className="font-display text-[15px] font-bold tracking-wide text-zinc-100">
                        {event.playerHandle}
                      </p>
                    )}
                    <p className="truncate text-[10.5px] text-zinc-600">
                      {event.playerRealName ?? "Liquipedia 登録選手"}
                    </p>
                  </div>

                  <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
                    <TeamChip name={event.fromTeamName} muted />
                    <ArrowRight className="h-3 w-3 shrink-0 text-zinc-600" />
                    <TeamChip
                      name={event.toTeamName}
                      fallback={meta.label}
                      fallbackClassName={meta.badgeClassName}
                    />
                    {event.playerStatus ? (
                      <StatusBadge
                        status={event.playerStatus}
                        className="ml-1 hidden sm:inline-flex"
                      />
                    ) : null}
                  </div>
                </div>

                {event.sourceUrl ? (
                  <div className="mt-2 flex items-center justify-end border-t border-white/[0.04] pt-2">
                    <a
                      href={event.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] text-zinc-600 transition-colors hover:text-zinc-300"
                    >
                      公式発表 / 出典
                      <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                ) : null}
              </article>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TeamChip({
  name,
  fallback,
  fallbackClassName,
  muted = false,
}: {
  name: string | null;
  fallback?: string;
  fallbackClassName?: string;
  muted?: boolean;
}) {
  const label = name ?? fallback ?? "—";

  return (
    <span
      className={cn(
        "max-w-[150px] truncate rounded-md border px-2 py-1 text-[10.5px] font-medium",
        name
          ? muted
            ? "border-white/[0.07] bg-black/20 text-zinc-500"
            : "border-white/[0.12] bg-white/[0.045] text-zinc-200"
          : cn(
              "border-white/[0.08] bg-white/[0.02] text-zinc-500",
              fallbackClassName,
            ),
      )}
      title={label}
    >
      {label}
    </span>
  );
}
