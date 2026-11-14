"use client";

import type { ReactNode } from "react";
import {
  ExternalLink,
  Globe2,
  MapPin,
  Medal,
  Swords,
  Trophy,
  Users,
} from "lucide-react";

import { NationalityFlag } from "@/components/nationality-flag";
import { PlayerAvatar } from "@/components/player-avatar";
import { RoleTag, StatusBadge } from "@/components/status-badge";
import { TeamLogo } from "@/components/team-logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getTeamAccent } from "@/lib/status";
import type { PlayerDto, TeamDto } from "@/lib/types";
import { cn } from "@/lib/utils";

type TeamModalProps = {
  team: TeamDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPlayer?: (player: PlayerDto) => void;
};

const linkClassName =
  "inline-flex items-center gap-1.5 rounded-md border border-zinc-700/70 bg-zinc-900/50 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-white";

export function TeamModal({
  team,
  open,
  onOpenChange,
  onSelectPlayer,
}: TeamModalProps) {
  if (!team) {
    return null;
  }

  const accent = getTeamAccent(team.accent);
  const hasAchievements = team.achievements.length > 0;
  const recentMatches = team.matches.filter(
    (match) => match.status === "RECENT",
  );
  const upcomingMatches = team.matches.filter(
    (match) => match.status === "UPCOMING",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-hidden p-0 sm:max-w-2xl"
        aria-describedby="team-modal-description"
      >
        <div className="flex max-h-[90vh] flex-col">
          <DialogHeader className="relative overflow-hidden border-b border-zinc-800/70 bg-zinc-950/95 px-6 pb-6 pt-7 pr-14">
            <span
              className={cn(
                "pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-gradient-to-br opacity-20 blur-3xl",
                accent.gradient,
              )}
            />
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
              Team Profile
            </p>
            <div className="mt-3 flex items-start gap-4">
              <TeamLogo
                logoUrl={team.logoUrl}
                shortName={team.shortName}
                accent={team.accent}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <DialogTitle className="font-display text-3xl font-black tracking-wide text-white">
                  {team.name}
                </DialogTitle>
                <DialogDescription
                  id="team-modal-description"
                  className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500"
                >
                  <span className="font-medium uppercase tracking-wider">
                    {team.shortName}
                  </span>
                  <span className="text-zinc-700">/</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {team.regionName} ({team.regionCode})
                  </span>
                  {team.importCount > 0 ? (
                    <>
                      <span className="text-zinc-700">/</span>
                      <span className="inline-flex items-center gap-1 text-sky-300">
                        <Globe2 className="h-3 w-3" />
                        Import {team.importCount}
                      </span>
                    </>
                  ) : null}
                </DialogDescription>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {team.officialUrl ? (
                    <a
                      href={team.officialUrl}
                      target="_blank"
                      rel="noreferrer"
                      className={linkClassName}
                    >
                      <Globe2 className="h-3.5 w-3.5" />
                      公式サイト
                      <ExternalLink className="h-2.5 w-2.5 text-zinc-600" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-6">
            {team.description ? (
              <p className="text-[11px] leading-relaxed text-zinc-400">
                {team.description}
              </p>
            ) : null}

            <section className="grid grid-cols-3 gap-2">
              <Stat
                icon={<Users className="h-3.5 w-3.5" />}
                label="Roster"
                value={`${team.playerCount}`}
                suffix="players"
              />
              <Stat
                icon={<Globe2 className="h-3.5 w-3.5" />}
                label="Import"
                value={`${team.importCount}`}
                suffix="imports"
              />
              <Stat
                icon={<Users className="h-3.5 w-3.5" />}
                label="Staff"
                value={`${team.staff.length}`}
                suffix="staff"
              />
            </section>

            <section>
              <SectionHeader
                icon={<Users className="h-3.5 w-3.5" />}
                title="現在のロスター"
                count={team.players.length + team.staff.length}
              />
              <div className="mt-3 space-y-1">
                {team.players.length > 0 ? (
                  team.players.map((player) => (
                    <RosterRow
                      key={player.id}
                      player={player}
                      onSelect={onSelectPlayer}
                    />
                  ))
                ) : (
                  <EmptyRow message="該当する選手がいません" />
                )}

                {team.staff.length > 0 ? (
                  <div className="mt-2 border-t border-zinc-800/60 pt-2">
                    <p className="px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                      Staff
                    </p>
                    {team.staff.map((member) => (
                      <RosterRow
                        key={member.id}
                        player={member}
                        onSelect={onSelectPlayer}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            </section>

            <section>
              <SectionHeader
                icon={<Medal className="h-3.5 w-3.5" />}
                title="過去大会実績"
                count={team.achievements.length}
              />
              {hasAchievements ? (
                <ol className="mt-3 space-y-2">
                  {team.achievements.map((achievement) => (
                    <li
                      key={achievement.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-800/70 bg-zinc-900/35 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-bold text-zinc-200">
                          {achievement.tournament}
                        </p>
                        <p className="text-[10px] text-zinc-600">
                          {achievement.tier} · {achievement.date}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full border border-amber-400/20 bg-amber-400/[0.06] px-2 py-0.5 text-[10px] font-bold text-amber-300">
                        {achievement.placement}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <FrameworkPlaceholder
                  icon={Trophy}
                  title="大会実績は Phase 4-4 で取得予定"
                  description="チーム詳細モーダルへの表示枠を先行実装しています。次フェーズで Liquipedia から過去大会実績を取得し、このセクションへ接続します。"
                />
              )}
            </section>

            <section>
              <SectionHeader
                icon={<Swords className="h-3.5 w-3.5" />}
                title="直近・次戦"
                count={team.matches.length}
              />
              {recentMatches.length > 0 || upcomingMatches.length > 0 ? (
                <div className="mt-3 space-y-4">
                  {recentMatches.length > 0 ? (
                    <MatchGroup title="直近試合結果" matches={recentMatches} />
                  ) : null}
                  {upcomingMatches.length > 0 ? (
                    <MatchGroup
                      title="次戦予定"
                      matches={upcomingMatches}
                    />
                  ) : null}
                </div>
              ) : (
                <FrameworkPlaceholder
                  icon={Swords}
                  title="試合情報は Phase 4-4 で取得予定"
                  description="チーム詳細モーダルへの表示枠を先行実装しています。次フェーズで Liquipedia から直近試合結果・次戦予定を取得し、このセクションへ接続します。"
                />
              )}
            </section>
          </div>

          <footer className="border-t border-zinc-800/70 bg-zinc-950/40 px-6 py-3">
            <p className="flex items-center gap-1.5 text-[10px] text-zinc-600">
              <Globe2 className="h-3 w-3" />
              ローカル SQLite に保存されたチーム記録です。外部送信は行いません。
            </p>
          </footer>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeader({
  icon,
  title,
  count,
}: {
  icon: ReactNode;
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-[0.18em] text-zinc-200">
        {icon}
        {title}
      </h3>
      <span className="shrink-0 rounded-full border border-zinc-700/70 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
        {count}
      </span>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  suffix,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/35 px-3 py-2.5">
      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
        {icon}
        {label}
      </p>
      <p className="mt-1 font-display text-xl font-bold tracking-wide text-zinc-200">
        {value}
        {suffix ? (
          <span className="ml-1 text-[9px] font-medium uppercase tracking-wider text-zinc-600">
            {suffix}
          </span>
        ) : null}
      </p>
    </div>
  );
}

function RosterRow({
  player,
  onSelect,
}: {
  player: PlayerDto;
  onSelect?: (player: PlayerDto) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(player)}
      disabled={!onSelect}
      aria-label={
        onSelect ? `${player.handle} の詳細を開く` : `${player.handle}`
      }
      className={cn(
        "group/player flex w-full items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors",
        onSelect
          ? "hover:border-zinc-700/60 hover:bg-zinc-800/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
          : "cursor-default",
      )}
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
        </div>
      </div>
      <StatusBadge status={player.status} />
    </button>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-zinc-800/80 bg-zinc-900/20 px-4 py-6 text-center">
      <p className="text-xs text-zinc-600">{message}</p>
    </div>
  );
}

function FrameworkPlaceholder({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="mt-3 flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-800/80 bg-zinc-900/20 px-4 py-8 text-center">
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-800/80 bg-zinc-900/50 text-zinc-600">
        <Icon className="h-4 w-4" />
      </span>
      <p className="text-xs font-bold text-zinc-500">{title}</p>
      <p className="max-w-sm text-[10.5px] leading-relaxed text-zinc-600">
        {description}
      </p>
    </div>
  );
}

function MatchGroup({
  title,
  matches,
}: {
  title: string;
  matches: Array<{
    id: string;
    opponentTeamName: string;
    opponentTeamShortName: string | null;
    opponentTeamLogoUrl: string | null;
    isWin: boolean | null;
    score: string | null;
    date: string;
    streamUrl: string | null;
  }>;
}) {
  return (
    <div>
      <p className="px-2 text-[9px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
        {title}
      </p>
      <ol className="mt-1.5 space-y-1.5">
        {matches.map((match) => (
          <li
            key={match.id}
            className="flex items-center gap-3 rounded-lg border border-zinc-800/70 bg-zinc-900/35 px-3 py-2"
          >
            <TeamLogo
              logoUrl={match.opponentTeamLogoUrl}
              shortName={match.opponentTeamShortName ?? "??"}
              accent="violet"
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-bold text-zinc-200">
                vs {match.opponentTeamName}
              </p>
              <p className="text-[10px] text-zinc-600">{match.date}</p>
            </div>
            {match.isWin !== null ? (
              <span
                className={cn(
                  "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                  match.isWin
                    ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300"
                    : "border-rose-400/20 bg-rose-400/[0.08] text-rose-300",
                )}
              >
                {match.isWin ? "WIN" : "LOSS"}
              </span>
            ) : null}
            {match.score ? (
              <span className="shrink-0 font-mono text-[10px] text-zinc-400">
                {match.score}
              </span>
            ) : null}
            {match.streamUrl ? (
              <a
                href={match.streamUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded p-1 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
                aria-label="配信 / VOD を見る"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
