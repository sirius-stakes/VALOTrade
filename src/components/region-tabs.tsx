"use client";

import { cn } from "@/lib/utils";

export type RegionTab = "all" | string;

type RegionTabsProps = {
  regions: string[];
  active: RegionTab;
  onChange: (region: RegionTab) => void;
};

export function RegionTabs({ regions, active, onChange }: RegionTabsProps) {
  const tabs = ["all", ...regions];

  return (
    <div className="border-b border-zinc-800/70 bg-zinc-950/50">
      <div className="mx-auto flex max-w-[1600px] items-center gap-1 px-4 py-2 sm:px-6">
        <span className="mr-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
          Region
        </span>
        {tabs.map((region) => {
          const isActive = active === region;
          const label = region === "all" ? "All" : region;

          return (
            <button
              key={region}
              type="button"
              aria-pressed={isActive}
              onClick={() => onChange(region)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[10.5px] font-medium transition-colors",
                isActive
                  ? "bg-brand/10 text-brand"
                  : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
