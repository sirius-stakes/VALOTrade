"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { StatusFilter } from "@/lib/status";
import { cn } from "@/lib/utils";

type ControlBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  showStatusFilter: boolean;
  placeholder?: string;
  freeAgentCount: number;
  activeCount: number;
  visibleCount: number;
  totalCount: number;
  onReset: () => void;
};

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "すべて" },
  { value: "free", label: "LFT / FAのみ" },
  { value: "active", label: "Activeのみ" },
];

export function ControlBar({
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  showStatusFilter,
  placeholder = "選手名・チーム名・ロールで検索...",
  freeAgentCount,
  activeCount,
  visibleCount,
  totalCount,
  onReset,
}: ControlBarProps) {
  return (
    <div className="border-b border-zinc-800/70 bg-zinc-950/60 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-2.5 px-4 py-3 sm:px-6 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1 lg:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder}
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

        {showStatusFilter ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600 md:flex">
              <SlidersHorizontal className="h-3 w-3" />
              Status
            </span>
            <div
              role="group"
              aria-label="ステータスフィルター"
              className="inline-flex rounded-md border border-zinc-800/80 bg-black/20 p-0.5"
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
                        ? "bg-brand/10 text-brand"
                        : "text-zinc-500 hover:text-zinc-200",
                    )}
                  >
                    {option.label}
                    {count !== null ? (
                      <span
                        className={cn(
                          "font-mono text-[9px]",
                          statusFilter === option.value
                            ? "text-brand/60"
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
        ) : null}

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <span className="ml-auto hidden items-center gap-1 font-mono text-[10px] text-zinc-600 sm:flex lg:ml-2">
            <span className="text-zinc-300">{visibleCount}</span>
            <span>/ {totalCount} 件</span>
          </span>

          <Button
            variant="ghost"
            size="sm"
            className="hidden h-7 px-2 text-[10px] text-zinc-500 hover:text-zinc-200 md:inline-flex"
            onClick={onReset}
          >
            リセット
          </Button>
        </div>
      </div>
    </div>
  );
}
