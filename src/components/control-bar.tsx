"use client";

import {
  ArrowLeftRight,
  LayoutGrid,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StatusFilter, ViewMode } from "@/lib/status";
import { cn } from "@/lib/utils";

type ControlBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  view: ViewMode;
  onViewChange: (value: ViewMode) => void;
  freeAgentCount: number;
  activeCount: number;
  visibleCount: number;
  totalCount: number;
};

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "free", label: "LFT / FAのみ" },
  { value: "active", label: "Activeのみ" },
];

const VIEW_OPTIONS: Array<{
  value: ViewMode;
  label: string;
  shortLabel: string;
  icon: typeof LayoutGrid;
}> = [
  {
    value: "teams",
    label: "チーム別ロスター表示",
    shortLabel: "チーム別",
    icon: LayoutGrid,
  },
  {
    value: "transfers",
    label: "直近の移籍タイムライン表示",
    shortLabel: "移籍履歴",
    icon: ArrowLeftRight,
  },
];

export function ControlBar({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  view,
  onViewChange,
  freeAgentCount,
  activeCount,
  visibleCount,
  totalCount,
}: ControlBarProps) {
  return (
    <div className="border-b border-white/[0.05] bg-[#070a0f]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2.5 px-4 py-3 sm:px-6 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1 lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="選手名・チーム名・ロールで検索..."
            aria-label="選手名・チーム名で検索"
            className="h-9 pl-9 pr-9 text-[12px]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="検索をクリア"
              className="absolute right-2 top-1/2 rounded p-1 text-zinc-600 transition-colors hover:bg-white/[0.06] hover:text-zinc-200"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600 md:flex">
            <SlidersHorizontal className="h-3 w-3" />
            Status
          </span>
          <div
            role="group"
            aria-label="ステータスフィルター"
            className="inline-flex rounded-md border border-white/[0.08] bg-black/20 p-0.5"
          >
            {STATUS_OPTIONS.map((option) => {
              const count =
                option.value === "free"
                  ? freeAgentCount
                  : option.value === "active"
                    ? activeCount
                    : null;

              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={statusFilter === option.value}
                  onClick={() => onStatusFilterChange(option.value)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded px-2.5 text-[10.5px] font-medium transition-colors",
                    statusFilter === option.value
                      ? "bg-white/[0.09] text-white shadow-sm"
                      : "text-zinc-500 hover:text-zinc-200",
                  )}
                >
                  {option.label}
                  {count !== null ? (
                    <span
                      className={cn(
                        "font-mono text-[9px]",
                        statusFilter === option.value
                          ? "text-zinc-400"
                          : "text-zinc-700",
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <div
            role="group"
            aria-label="表示モード"
            className="inline-flex rounded-md border border-white/[0.08] bg-black/20 p-0.5"
          >
            {VIEW_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={view === option.value}
                  onClick={() => onViewChange(option.value)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[10.5px] font-medium transition-colors",
                    view === option.value
                      ? "bg-red-400/[0.12] text-red-200"
                      : "text-zinc-500 hover:text-zinc-200",
                  )}
                >
                  <Icon className="h-3 w-3" />
                  <span className="hidden xl:inline">{option.label}</span>
                  <span className="xl:hidden">{option.shortLabel}</span>
                </button>
              );
            })}
          </div>

          <span className="ml-auto hidden items-center gap-1 font-mono text-[10px] text-zinc-600 sm:flex lg:ml-2">
            <span className="text-zinc-300">{visibleCount}</span>
            <span>/ {totalCount} 件</span>
          </span>

          <Button
            variant="ghost"
            size="sm"
            className="hidden h-7 px-2 text-[10px] text-zinc-500 hover:text-zinc-200 md:inline-flex"
            onClick={() => {
              onQueryChange("");
              onStatusFilterChange("all");
              onViewChange("teams");
            }}
          >
            リセット
          </Button>
        </div>
      </div>
    </div>
  );
}
