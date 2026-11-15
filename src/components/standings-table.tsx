"use client";

import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";

import { TeamLogo } from "@/components/team-logo";
import { Badge } from "@/components/ui/badge";
import type { StandingDto, TeamDto } from "@/lib/types";
import { cn } from "@/lib/utils";

type StandingsTableProps = {
  standings: StandingDto[];
  teams: TeamDto[];
  gameSlug: string;
  onSelectTeam: (team: TeamDto) => void;
};

function parseSeason(value: string): number {
  const match = /\b(\d{4})\b/.exec(value);
  return match ? Number.parseInt(match[1], 10) : 0;
}

function getSplitPriority(split: string, stage: string | null): number {
  const value = `${split} ${stage ?? ""}`.toLowerCase();
  if (value.includes("stage 2")) return 10;
  if (value.includes("summer")) return 9;
  if (value.includes("split 2")) return 8;
  if (value.includes("stage 1")) return 7;
  if (value.includes("spring")) return 6;
  if (value.includes("split 1")) return 5;
  if (value.includes("circuit points")) return 4;
  if (value.includes("regular season")) return 3;
  return 0;
}

function rankHighlightClass(rank: number): string {
  if (rank === 1) {
    return "border-yellow-500/30 bg-yellow-500/[0.12] text-yellow-200 shadow-[inset_0_0_16px_-6px_rgba(234,179,8,0.25)]";
  }
  if (rank === 2) {
    return "border-slate-300/25 bg-slate-300/[0.10] text-slate-200";
  }
  if (rank === 3) {
    return "border-orange-500/30 bg-orange-500/[0.12] text-orange-200";
  }
  return "border-zinc-800/60 bg-zinc-900/30 text-zinc-300";
}

export function StandingsTable({
  standings,
  teams,
  gameSlug,
  onSelectTeam,
}: StandingsTableProps) {
  const teamMap = useMemo(() => {
    const map = new Map<string, TeamDto>();
    for (const team of teams) {
      map.set(team.id, team);
    }
    return map;
  }, [teams]);

  const grouped = useMemo(() => {
    const byRegion = new Map<string, StandingDto[]>();
    for (const standing of standings) {
      const region = standing.regionCode ?? "Unknown";
      const list = byRegion.get(region) ?? [];
      list.push(standing);
      byRegion.set(region, list);
    }

    const result: {
      regionCode: string;
      stages: { key: string; label: string; standings: StandingDto[] }[];
    }[] = [];

    for (const [regionCode, list] of byRegion) {
      const byStage = new Map<string, StandingDto[]>();
      for (const standing of list) {
        const key = `${standing.season}|${standing.split}|${standing.stage ?? ""}`;
        const group = byStage.get(key) ?? [];
        group.push(standing);
        byStage.set(key, group);
      }

      const stages = Array.from(byStage.entries())
        .map(([key, group]) => ({
          key,
          label: `${group[0].season} ${group[0].split}${group[0].stage && group[0].stage !== group[0].split ? ` / ${group[0].stage}` : ""}`,
          standings: group.sort((a, b) => a.rank - b.rank),
        }))
        .sort((a, b) => {
          const [seasonA, splitA, stageA] = a.key.split("|");
          const [seasonB, splitB, stageB] = b.key.split("|");
          const seasonDiff = parseSeason(seasonB) - parseSeason(seasonA);
          if (seasonDiff !== 0) return seasonDiff;
          const priorityDiff =
            getSplitPriority(splitB, stageB || null) -
            getSplitPriority(splitA, stageA || null);
          if (priorityDiff !== 0) return priorityDiff;
          return a.standings[0].rank - b.standings[0].rank;
        });

      result.push({ regionCode, stages });
    }

    return result.sort((a, b) => a.regionCode.localeCompare(b.regionCode));
  }, [standings]);

  const [selectedRegion, setSelectedRegion] = useState<string>(() => {
    return grouped[0]?.regionCode ?? "";
  });

  const activeRegion = useMemo(() => {
    return (
      grouped.find((group) => group.regionCode === selectedRegion) ??
      grouped[0] ??
      null
    );
  }, [grouped, selectedRegion]);

  const [selectedStageKey, setSelectedStageKey] = useState<string>(() => {
    return activeRegion?.stages[0]?.key ?? "";
  });

  const activeStage = useMemo(() => {
    if (!activeRegion) return null;
    return (
      activeRegion.stages.find((stage) => stage.key === selectedStageKey) ??
      activeRegion.stages[0] ??
      null
    );
  }, [activeRegion, selectedStageKey]);

  if (standings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800/80 bg-zinc-900/20 px-6 py-20 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-zinc-800/80 bg-zinc-900/50 text-zinc-600">
          <Trophy className="h-5 w-5" />
        </span>
        <p className="mt-4 font-display text-base font-bold tracking-wide text-zinc-300">
          順位表データは登録されていません
        </p>
        <p className="mt-1 max-w-md text-[11px] leading-relaxed text-zinc-600">
          現在、順位表データは登録されていません（
          <code className="rounded bg-zinc-900 px-1 py-0.5 text-zinc-500">
            npm run update:standings
          </code>{" "}
          または各タイトルの{" "}
          <code className="rounded bg-zinc-900 px-1 py-0.5 text-zinc-500">
            npm run update:{gameSlug === "league-of-legends" ? "lol" : gameSlug === "identity-v" ? "idv" : "valo"}
          </code>{" "}
          で取得できます）。
        </p>
      </div>
    );
  }

  const showRegionTabs = grouped.length > 1;
  const showStageTabs = (activeRegion?.stages.length ?? 0) > 1;

  return (
    <div className="space-y-4">
      {showRegionTabs ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
            Region
          </span>
          <div
            role="group"
            aria-label="順位表リージョン"
            className="inline-flex rounded-md border border-zinc-800/80 bg-black/20 p-0.5"
          >
            {grouped.map((group) => (
              <button
                key={group.regionCode}
                type="button"
                aria-pressed={selectedRegion === group.regionCode}
                onClick={() => {
                  setSelectedRegion(group.regionCode);
                  setSelectedStageKey(group.stages[0]?.key ?? "");
                }}
                className={cn(
                  "inline-flex h-7 items-center rounded px-2.5 text-[10.5px] font-medium transition-colors",
                  selectedRegion === group.regionCode
                    ? "bg-brand/10 text-brand"
                    : "text-zinc-500 hover:text-zinc-200",
                )}
              >
                {group.regionCode}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showStageTabs && activeRegion ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
            Stage / Split
          </span>
          <div
            role="group"
            aria-label="順位表ステージ"
            className="inline-flex rounded-md border border-zinc-800/80 bg-black/20 p-0.5"
          >
            {activeRegion.stages.map((stage) => (
              <button
                key={stage.key}
                type="button"
                aria-pressed={selectedStageKey === stage.key}
                onClick={() => setSelectedStageKey(stage.key)}
                className={cn(
                  "inline-flex h-7 items-center rounded px-2.5 text-[10.5px] font-medium transition-colors",
                  selectedStageKey === stage.key
                    ? "bg-brand/10 text-brand"
                    : "text-zinc-500 hover:text-zinc-200",
                )}
              >
                {stage.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {activeStage ? (
        <div className="overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-950/40">
          <div className="border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-brand" />
              <h3 className="font-display text-xs font-bold tracking-wide text-zinc-200">
                {activeRegion?.regionCode}
              </h3>
              <Badge variant="outline" className="text-[9px]">
                {activeStage.label}
              </Badge>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-zinc-900/40 text-[9px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  <th className="w-16 px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">Team</th>
                  <th className="w-24 px-4 py-2.5">W - L</th>
                  <th className="w-28 px-4 py-2.5">Pts / Diff</th>
                  <th className="w-24 px-4 py-2.5">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {activeStage.standings.map((standing) => {
                  const team = standing.teamId
                    ? teamMap.get(standing.teamId)
                    : null;
                  const totalGames = standing.wins + standing.losses;
                  const winRate =
                    totalGames > 0
                      ? `${Math.round((standing.wins / totalGames) * 100)}%`
                      : "—";

                  return (
                    <tr
                      key={standing.id}
                      className="border-b border-zinc-800/50 transition-colors last:border-b-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-2.5 align-middle">
                        <span
                          className={cn(
                            "inline-flex h-6 w-6 items-center justify-center rounded border font-mono text-[10px] font-bold",
                            rankHighlightClass(standing.rank),
                          )}
                        >
                          {standing.rank}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        {team ? (
                          <button
                            type="button"
                            onClick={() => onSelectTeam(team)}
                            className="group flex items-center gap-2.5 rounded-md text-left transition-colors hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
                          >
                            <TeamLogo
                              logoUrl={team.logoUrl}
                              shortName={team.shortName}
                              accent={team.accent}
                              size="sm"
                            />
                            <span className="font-display text-[13px] font-semibold tracking-wide text-zinc-200 group-hover:text-white">
                              {team.name}
                            </span>
                          </button>
                        ) : (
                          <span className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800/80 bg-zinc-900 text-[10px] font-bold text-zinc-600">
                              ?
                            </span>
                            <span className="text-[13px] text-zinc-400">
                              {standing.teamName}
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        <span className="font-mono text-[12px] text-zinc-300">
                          {standing.wins} - {standing.losses}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        <div className="flex flex-col gap-0.5">
                          {standing.points !== null ? (
                            <span className="font-mono text-[11px] text-zinc-300">
                              {standing.points} pts
                            </span>
                          ) : null}
                          {standing.differential !== null ? (
                            <span
                              className={cn(
                                "font-mono text-[10px]",
                                standing.differential > 0
                                  ? "text-emerald-400"
                                  : standing.differential < 0
                                    ? "text-red-400"
                                    : "text-zinc-500",
                              )}
                            >
                              {standing.differential > 0 ? "+" : ""}
                              {standing.differential} diff
                            </span>
                          ) : (
                            <span className="font-mono text-[10px] text-zinc-600">
                              —
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        <span className="font-mono text-[11px] text-zinc-400">
                          {winRate}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
