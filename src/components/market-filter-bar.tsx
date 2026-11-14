"use client";

import { Filter, UserCog } from "lucide-react";

import { cn } from "@/lib/utils";

export type MarketStatusFilter =
  | "all"
  | "lft"
  | "fa"
  | "inactive-bench";

export type MarketRoleFilter =
  | "all"
  | "Duelist"
  | "Initiator"
  | "Controller"
  | "Sentinel"
  | "Flex"
  | "Coach";

const STATUS_OPTIONS: Array<{
  value: MarketStatusFilter;
  label: string;
}> = [
  { value: "all", label: "すべて" },
  { value: "lft", label: "LFT" },
  { value: "fa", label: "FA" },
  { value: "inactive-bench", label: "Inactive・Bench" },
];

const ROLE_OPTIONS: Array<{ value: MarketRoleFilter; label: string }> = [
  { value: "all", label: "All Roles" },
  { value: "Duelist", label: "Duelist" },
  { value: "Initiator", label: "Initiator" },
  { value: "Controller", label: "Controller" },
  { value: "Sentinel", label: "Sentinel" },
  { value: "Flex", label: "Flex" },
  { value: "Coach", label: "Coach" },
];

type MarketFilterBarProps = {
  statusFilter: MarketStatusFilter;
  onStatusFilterChange: (value: MarketStatusFilter) => void;
  roleFilter: MarketRoleFilter;
  onRoleFilterChange: (value: MarketRoleFilter) => void;
  showStaff: boolean;
  onShowStaffChange: (value: boolean) => void;
  resultCount: number;
};

export function MarketFilterBar({
  statusFilter,
  onStatusFilterChange,
  roleFilter,
  onRoleFilterChange,
  showStaff,
  onShowStaffChange,
  resultCount,
}: MarketFilterBarProps) {
  return (
    <div className="border-b border-zinc-800/70 bg-zinc-950/40">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded border border-zinc-800/80 bg-zinc-900/50 text-zinc-600">
              <Filter className="h-3 w-3" />
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Status
            </span>
          </div>
          <div
            role="group"
            aria-label="ステータスフィルター"
            className="inline-flex flex-wrap gap-1.5"
          >
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={statusFilter === option.value}
                onClick={() => onStatusFilterChange(option.value)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10.5px] font-medium transition-colors",
                  statusFilter === option.value
                    ? "border-brand/30 bg-brand/[0.08] text-brand"
                    : "border-zinc-800/80 bg-black/20 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
              Role
            </span>
          </div>
          <div
            role="group"
            aria-label="ロールフィルター"
            className="inline-flex flex-wrap gap-1.5"
          >
            {ROLE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={roleFilter === option.value}
                onClick={() => onRoleFilterChange(option.value)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[10.5px] font-medium transition-colors",
                  roleFilter === option.value
                    ? "border-brand/30 bg-brand/[0.08] text-brand"
                    : "border-zinc-800/80 bg-black/20 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 lg:justify-end">
          <button
            type="button"
            role="switch"
            aria-checked={showStaff}
            aria-label="マネージャー・アナリスト・ストリーマー等を表示"
            onClick={() => onShowStaffChange(!showStaff)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-2 rounded-md border px-2.5 text-[10.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30",
              showStaff
                ? "border-brand/30 bg-brand/[0.08] text-brand"
                : "border-zinc-800/80 bg-black/20 text-zinc-500 hover:text-zinc-200",
            )}
          >
            <UserCog className="h-3.5 w-3.5" />
            <span className="whitespace-nowrap">スタッフ等を表示</span>
            <span
              aria-hidden
              className={cn(
                "relative ml-0.5 inline-flex h-3.5 w-6 shrink-0 items-center rounded-full transition-colors",
                showStaff ? "bg-brand/60" : "bg-zinc-700",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white transition-transform",
                  showStaff ? "translate-x-3" : "translate-x-0.5",
                )}
              />
            </span>
          </button>

          <span className="font-mono text-[10px] text-zinc-600">
            <span className="text-zinc-300">{resultCount}</span> 件
          </span>
        </div>
      </div>
    </div>
  );
}
