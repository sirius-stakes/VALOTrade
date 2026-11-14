"use client";

import type { ReactNode } from "react";
import {
  AtSign,
  CalendarRange,
  ExternalLink,
  Globe2,
  Link2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";

import { PlayerAvatar } from "@/components/player-avatar";
import { NationalityFlag } from "@/components/nationality-flag";
import { RoleTag, StatusBadge } from "@/components/status-badge";
import { TeamLogo } from "@/components/team-logo";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STATUS_META, getTeamAccent } from "@/lib/status";
import type { PlayerDto } from "@/lib/types";
import { cn, formatMonth, formatPeriod } from "@/lib/utils";

type PlayerModalProps = {
  player: PlayerDto | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const linkClassName =
  "inline-flex items-center gap-1.5 rounded-md border border-zinc-700/70 bg-zinc-900/50 px-2.5 py-1.5 text-[11px] font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:bg-zinc-800/60 hover:text-white";

export function PlayerModal({ player, open, onOpenChange }: PlayerModalProps) {
  if (!player) {
    return null;
  }

  const meta = STATUS_META[player.status];
  const current = player.memberships.find((membership) => membership.isCurrent);
  const earliest = player.memberships[player.memberships.length - 1];
  const teamCount = new Set(player.memberships.map((item) => item.teamId)).size;
  const currentAnnouncement = current?.announcementUrl ?? null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby="player-modal-description">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <DialogHeader className="sticky top-0 z-20 overflow-hidden border-b border-zinc-800/70 bg-zinc-950/95 bg-gradient-to-b from-zinc-900/60 to-transparent px-6 pb-6 pt-7 pr-14 backdrop-blur-xl">
            <span
              className={cn(
                "pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-gradient-to-br opacity-20 blur-3xl",
                player.currentTeamAccent
                  ? getTeamAccent(player.currentTeamAccent).gradient
                  : "from-amber-400/40 to-transparent",
              )}
            />
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
              Player Profile
            </p>
            <div className="mt-3 flex items-start gap-4">
              <PlayerAvatar
                handle={player.handle}
                avatarUrl={player.avatarUrl}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <NationalityFlag
                    country={player.country}
                    className="text-sm"
                  />
                  <DialogTitle className="font-display text-3xl font-black tracking-wide text-white">
                    {player.handle}
                  </DialogTitle>
                  <StatusBadge status={player.status} size="md" />
                </div>
                <DialogDescription
                  id="player-modal-description"
                  className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500"
                >
                  <span>{player.realName ?? "本名非公開"}</span>
                  <span className="text-zinc-700">/</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {player.regionCode ?? "JP"}
                  </span>
                  <span className="text-zinc-700">/</span>
                  <span>{meta.description}</span>
                </DialogDescription>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {player.xUrl ? (
                <a
                  href={player.xUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClassName}
                >
                  <AtSign className="h-3.5 w-3.5" />
                  X
                  <ExternalLink className="h-2.5 w-2.5 text-zinc-600" />
                </a>
              ) : null}
              {player.officialUrl ? (
                <a
                  href={player.officialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClassName}
                >
                  <Globe2 className="h-3.5 w-3.5" />
                  公式プロフィール
                  <ExternalLink className="h-2.5 w-2.5 text-zinc-600" />
                </a>
              ) : null}
              {player.currentTeamOfficialUrl ? (
                <a
                  href={player.currentTeamOfficialUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={linkClassName}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  チーム公式HP
                  <ExternalLink className="h-2.5 w-2.5 text-zinc-600" />
                </a>
              ) : null}
              {currentAnnouncement ? (
                <a
                  href={currentAnnouncement}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    linkClassName,
                    "border-brand/25 bg-brand/[0.06] text-brand hover:border-brand/45 hover:bg-brand/[0.1]",
                  )}
                >
                  <Trophy className="h-3.5 w-3.5" />
                  加入発表
                  <ExternalLink className="h-2.5 w-2.5 opacity-70" />
                </a>
              ) : null}
            </div>
          </DialogHeader>

          <div className="space-y-6 px-6 py-6">
            <section className="grid grid-cols-3 gap-2">
              <Stat
                icon={<Users className="h-3.5 w-3.5" />}
                label="所属チーム"
                value={`${teamCount}`}
                suffix="teams"
              />
              <Stat
                icon={<CalendarRange className="h-3.5 w-3.5" />}
                label="キャリア開始"
                value={earliest ? formatMonth(earliest.startDate) : "—"}
              />
              <Stat
                icon={<Sparkles className="h-3.5 w-3.5" />}
                label="現在のロール"
                value={
                  player.currentRole ??
                  current?.role ??
                  player.memberships[0]?.role ??
                  "—"
                }
                small
              />
            </section>

            <section className="rounded-lg border border-zinc-800/70 bg-zinc-900/35 p-3.5">
              <div className="flex items-center gap-3">
                {current ? (
                  <>
                    <TeamLogo
                      logoUrl={current.teamLogoUrl}
                      shortName={current.teamShortName}
                      accent={current.teamAccent}
                      size="md"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                        Current Team
                      </p>
                      <p className="truncate font-display text-base font-bold tracking-wide text-zinc-100">
                        {current.teamName}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {formatPeriod(
                          current.startDate,
                          current.endDate,
                          current.isCurrent,
                        )}{" "}
                        / {current.role}
                      </p>
                    </div>
                    <StatusBadge status={player.status} />
                  </>
                ) : (
                  <>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/[0.06] text-amber-300">
                      <Trophy className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-600">
                        Current Status
                      </p>
                      <p className="font-display text-base font-bold tracking-wide text-zinc-100">
                        {player.status === "LFT"
                          ? "移籍先を募集中"
                          : player.status === "FA"
                            ? "フリーエージェント"
                            : "現在所属なし"}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        {meta.description}
                      </p>
                    </div>
                    <StatusBadge status={player.status} />
                  </>
                )}
              </div>
            </section>

            {player.note ? (
              <p className="rounded-lg border-l-2 border-brand/40 bg-brand/[0.035] px-3.5 py-3 text-xs leading-relaxed text-zinc-400">
                {player.note}
              </p>
            ) : null}

            <section>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-bold uppercase tracking-[0.18em] text-zinc-200">
                    移籍・所属タイムライン
                  </h3>
                  <p className="mt-0.5 text-[11px] text-zinc-600">
                    最新の所属が上。各ブロックから公式発表を確認できます。
                  </p>
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-full border border-zinc-700/70 px-2 py-0.5 font-mono text-[10px] text-zinc-500">
                  {player.memberships.length} records
                </span>
              </div>

              {player.memberships.length > 0 ? (
                <ol className="mt-5">
                  {player.memberships.map((membership, index) => {
                    const accent = getTeamAccent(membership.teamAccent);
                    const isLast = index === player.memberships.length - 1;

                    return (
                      <li
                        key={membership.id}
                        className="relative flex gap-3.5 pb-5 last:pb-0"
                      >
                        {!isLast ? (
                          <span className="absolute bottom-0 left-[21px] top-11 w-px bg-gradient-to-b from-zinc-700/60 via-zinc-800/60 to-transparent" />
                        ) : null}

                        <div className="relative z-10 mt-0.5">
                          <TeamLogo
                            logoUrl={membership.teamLogoUrl}
                            shortName={membership.teamShortName}
                            accent={membership.teamAccent}
                            size="md"
                          />
                          {membership.isCurrent ? (
                            <span
                              className={cn(
                                "absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-zinc-950",
                                accent.line,
                              )}
                            />
                          ) : null}
                        </div>

                        <div
                          className={cn(
                            "min-w-0 flex-1 rounded-lg border p-3 transition-colors",
                            membership.isCurrent
                              ? "border-zinc-700/70 bg-zinc-900/60"
                              : "border-zinc-800/70 bg-zinc-900/25",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate font-display text-sm font-bold tracking-wide text-zinc-100">
                                  {membership.teamName}
                                </span>
                                {membership.isCurrent ? (
                                  <span className="rounded-full border border-emerald-400/25 bg-emerald-400/[0.08] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-300">
                                    Current
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 font-mono text-[10px] tracking-tight text-zinc-500">
                                {formatPeriod(
                                  membership.startDate,
                                  membership.endDate,
                                  membership.isCurrent,
                                )}
                                <span className="mx-1.5 text-zinc-700">/</span>
                                {membership.teamRegionCode}
                              </p>
                            </div>
                            <RoleTag role={membership.role} />
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2 border-t border-zinc-800/60 pt-2">
                            <span className="inline-flex items-center gap-1 text-[10px] text-zinc-600">
                              <Link2 className="h-3 w-3" />
                              {membership.isCurrent ? "現所属" : "過去の所属"}
                            </span>
                            {membership.announcementUrl ? (
                              <a
                                href={membership.announcementUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                              >
                                公式発表
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            ) : (
                              <span className="text-[10px] text-zinc-700">
                                発表リンク未登録
                              </span>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <div className="mt-5 flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-800/80 px-4 py-10 text-center">
                  <CalendarRange className="h-5 w-5 text-zinc-700" />
                  <p className="text-xs text-zinc-600">
                    所属履歴がまだ登録されていません
                  </p>
                </div>
              )}
            </section>
          </div>
        </div>

        <footer className="border-t border-zinc-800/70 bg-zinc-950/40 px-6 py-3">
          <p className="flex items-center gap-1.5 text-[10px] text-zinc-600">
            <ShieldCheck className="h-3 w-3" />
            ローカル SQLite に保存された記録です。外部送信は行いません。
          </p>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  icon,
  label,
  value,
  suffix,
  small,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  suffix?: string;
  small?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-900/35 px-3 py-2.5">
      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-display font-bold tracking-wide text-zinc-200",
          small ? "truncate text-sm" : "text-xl",
        )}
      >
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
