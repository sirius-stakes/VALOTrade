"use client";

import { Clock3, SearchX, Star, UserRoundSearch } from "lucide-react";

import { NationalityFlag } from "@/components/nationality-flag";
import { PlayerAvatar } from "@/components/player-avatar";
import { RoleTag, StatusBadge } from "@/components/status-badge";
import { TeamLogo } from "@/components/team-logo";
import type { PlayerDto } from "@/lib/types";
import { cn, formatPeriod } from "@/lib/utils";

type MarketPlayerCardProps = {
  player: PlayerDto;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onSelect: (player: PlayerDto) => void;
};

export function MarketPlayerCard({
  player,
  isFavorite,
  onToggleFavorite,
  onSelect,
}: MarketPlayerCardProps) {
  const latest = player.memberships[0] ?? null;
  const hasCurrentTeam = Boolean(player.currentTeamName);

  return (
    <div
      className={cn(
        "group relative flex w-full flex-col gap-3 overflow-hidden rounded-xl border bg-zinc-900/40 p-4 transition-all duration-200 hover:bg-zinc-900/55",
        player.status === "LFT"
          ? "border-amber-400/20 hover:border-amber-400/40"
          : player.status === "FA"
            ? "border-purple-400/20 hover:border-purple-400/40"
            : "border-zinc-800/80 hover:border-zinc-700/90",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full blur-2xl transition-colors",
          player.status === "LFT"
            ? "bg-amber-400/10"
            : player.status === "FA"
              ? "bg-purple-400/10"
              : "bg-zinc-400/[0.04]",
        )}
      />

      <button
        type="button"
        aria-label={`${player.handle} の詳細を開く`}
        onClick={() => onSelect(player)}
        className="absolute inset-0 z-0 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
      />

      <button
        type="button"
        aria-label={
          isFavorite ? "お気に入りから解除" : "お気に入りに追加"
        }
        title={isFavorite ? "お気に入りから解除" : "お気に入りに追加"}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavorite();
        }}
        className={cn(
          "pointer-events-auto absolute right-3 top-3 z-10 rounded p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
          isFavorite
            ? "text-amber-300 hover:bg-amber-400/10"
            : "text-zinc-700 hover:bg-white/[0.06] hover:text-zinc-300",
        )}
      >
        <Star
          className={cn("h-3.5 w-3.5", isFavorite && "fill-current")}
        />
      </button>

      <div className="relative z-10 flex w-full items-start gap-3 text-left pointer-events-none">
        <PlayerAvatar handle={player.handle} avatarUrl={player.avatarUrl} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 pr-8">
            <NationalityFlag country={player.country} />
            <span className="font-display text-base font-bold tracking-wide text-zinc-100">
              {player.handle}
            </span>
            <StatusBadge status={player.status} />
            {player.currentRole ? <RoleTag role={player.currentRole} /> : null}
          </div>

          <p className="mt-0.5 text-[11px] text-zinc-500">
            {player.realName ?? "本名非公開"}
            {player.regionCode ? ` / ${player.regionCode}` : ""}
          </p>
        </div>
      </div>

      {player.note ? (
        <p className="relative z-10 line-clamp-2 text-[11px] leading-relaxed text-zinc-500 pointer-events-none">
          {player.note}
        </p>
      ) : null}

      {hasCurrentTeam || latest ? (
        <div className="relative z-10 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-2 py-1.5 pointer-events-none">
          <TeamLogo
            logoUrl={player.currentTeamLogoUrl ?? latest?.teamLogoUrl}
            shortName={player.currentTeamShortName ?? latest?.teamShortName}
            accent={player.currentTeamAccent ?? latest?.teamAccent}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-medium text-zinc-300">
              {hasCurrentTeam ? "現所属" : "前所属"}:{" "}
              {player.currentTeamName ?? latest?.teamName}
            </p>
            {!hasCurrentTeam && latest ? (
              <p className="flex items-center gap-1 text-[10px] text-zinc-600">
                <Clock3 className="h-2.5 w-2.5" />
                {formatPeriod(latest.startDate, latest.endDate, latest.isCurrent)}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="relative z-10 flex items-center gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-2 py-1.5 text-[11px] text-zinc-500 pointer-events-none">
          <SearchX className="h-3 w-3" />
          無所属
        </div>
      )}

      <div className="relative z-10 mt-auto flex w-full items-center justify-between rounded-lg border border-zinc-800/70 bg-zinc-950/40 px-2.5 py-1.5 pointer-events-none">
        <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          <UserRoundSearch className="h-3 w-3" />
          {player.status === "LFT"
            ? "移籍先を募集中"
            : player.status === "FA"
              ? "フリーエージェント"
              : player.status === "SUB"
                ? "サブ / リザーブ"
                : player.status === "INACTIVE"
                  ? "休止 / 非アクティブ"
                  : "詳細を確認"}
        </span>
        <span className="text-[10px] text-zinc-500 transition-colors group-hover:text-zinc-300">
          プロフィール →
        </span>
      </div>
    </div>
  );
}
