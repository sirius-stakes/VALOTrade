"use client";

import {
  DASHBOARD_SECTIONS,
  type DashboardSection,
  type GameDefinition,
} from "@/lib/games";
import { cn } from "@/lib/utils";

type SectionNavProps = {
  game: GameDefinition;
  section: DashboardSection;
  onSectionChange: (section: DashboardSection) => void;
  counts?: Partial<Record<DashboardSection, number>>;
};

export function SectionNav({
  game,
  section,
  onSectionChange,
  counts,
}: SectionNavProps) {
  return (
    <div className="border-b border-zinc-800/70 bg-zinc-950/50">
      <div className="scrollbar-none mx-auto flex max-w-[1600px] items-center gap-0.5 overflow-x-auto px-2 sm:px-4">
        <nav
          aria-label="サブナビゲーション"
          className="flex min-w-0 items-center"
        >
          {DASHBOARD_SECTIONS.map((item) => {
            const active = section === item.key;
            const count = counts?.[item.key];
            const Icon = item.icon;

            return (
              <button
                key={item.key}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => onSectionChange(item.key)}
                className={cn(
                  "group relative inline-flex h-11 shrink-0 items-center gap-1.5 px-2.5 text-[11px] font-semibold tracking-wide transition-colors sm:gap-2 sm:px-3.5",
                  active
                    ? "text-white"
                    : "text-zinc-500 hover:text-zinc-200",
                )}
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5 transition-colors",
                    active
                      ? "text-brand"
                      : "text-zinc-600 group-hover:text-zinc-400",
                  )}
                />
                <span className="whitespace-nowrap">{item.label}</span>
                <span
                  className={cn(
                    "hidden font-mono text-[8px] uppercase tracking-[0.16em] transition-colors lg:inline",
                    active ? "text-zinc-500" : "text-zinc-700",
                  )}
                >
                  {item.hint}
                </span>

                {item.badge ? (
                  <span
                    className={cn(
                      "hidden rounded border px-1 py-0 font-mono text-[7.5px] font-semibold uppercase tracking-[0.08em] md:inline-flex",
                      active
                        ? "border-brand/25 bg-brand/[0.07] text-brand"
                        : "border-zinc-700/60 bg-zinc-800/40 text-zinc-600",
                    )}
                  >
                    {item.badge}
                  </span>
                ) : null}

                {typeof count === "number" ? (
                  <span
                    className={cn(
                      "rounded px-1 font-mono text-[8.5px] transition-colors",
                      active
                        ? "bg-brand/10 text-brand"
                        : "bg-white/[0.03] text-zinc-600",
                    )}
                  >
                    {count}
                  </span>
                ) : null}

                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-2 bottom-0 h-[2px] rounded-full transition-opacity",
                    active
                      ? "bg-brand opacity-100 shadow-sm shadow-brand/50"
                      : "opacity-0",
                  )}
                />
              </button>
            );
          })}
        </nav>

        <div className="ml-auto hidden shrink-0 items-center gap-2 pl-4 lg:flex">
          <span className="flex -space-x-0.5" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            <span className="h-1.5 w-1.5 rounded-full bg-brand-alt" />
          </span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
            {game.regionLabel}
          </span>
          <span className="text-zinc-800">/</span>
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            {game.themeName}
          </span>
        </div>
      </div>
    </div>
  );
}
