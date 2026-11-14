import { Clock3, Terminal } from "lucide-react";

import { GAME_DEFINITIONS, type GameDefinition } from "@/lib/games";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  activeGame: GameDefinition;
  onGameChange: (slug: string) => void;
  lastUpdated: string | null;
  lastUpdateSource: string | null;
};

const TAB_BASE =
  "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] transition-colors";

export function AppHeader({
  activeGame,
  onGameChange,
  lastUpdated,
  lastUpdateSource,
}: AppHeaderProps) {
  const ActiveIcon = activeGame.icon;

  return (
    <header className="border-b border-zinc-800/70 bg-zinc-950/40">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-brand/25 bg-gradient-to-br from-brand/20 to-brand/[0.02] text-brand shadow-lg shadow-brand/20 sm:h-9 sm:w-9">
            <ActiveIcon className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-brand" />
          </span>
          <div className="leading-none">
            <p className="font-display text-[15px] font-black tracking-[0.07em] text-white sm:text-[17px]">
              TEAM<span className="text-brand">TRADE</span>
            </p>
            <p className="mt-1.5 hidden text-[8px] font-medium uppercase tracking-[0.28em] text-zinc-600 sm:block">
              Multi-title roster tracker
            </p>
          </div>
        </div>

        <div className="mx-1 hidden h-9 w-px bg-zinc-800/80 lg:block" />

        <nav
          aria-label="ゲームタイトル切替"
          className="scrollbar-none order-last flex w-full min-w-0 items-center gap-1 overflow-x-auto md:order-none md:w-auto"
        >
          {GAME_DEFINITIONS.map((game) => {
            const active = game.slug === activeGame.slug;

            return (
              <button
                key={game.slug}
                type="button"
                aria-current={active ? "page" : undefined}
                title={`${game.name} に切り替え`}
                onClick={() => onGameChange(game.slug)}
                className={cn(
                  TAB_BASE,
                  active
                    ? "border-brand/30 bg-brand/[0.08] text-white shadow-sm shadow-brand/10"
                    : "border-transparent text-zinc-500 hover:bg-white/[0.03] hover:text-zinc-300",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full transition-opacity",
                    game.dotClassName,
                    active ? "opacity-100" : "opacity-50",
                  )}
                />
                <span className="hidden xl:inline">{game.tabLabel}</span>
                <span className="xl:hidden">{game.compactLabel}</span>
                {!game.hasLocalData ? (
                  <span
                    className={cn(
                      "ml-0.5 hidden rounded border px-1 py-0 text-[7.5px] font-semibold uppercase tracking-[0.08em] sm:inline",
                      active
                        ? "border-brand/25 bg-brand/[0.07] text-brand"
                        : "border-zinc-700/60 bg-zinc-800/40 text-zinc-600",
                    )}
                  >
                    Soon
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-md border border-zinc-800/80 bg-zinc-900/40 px-2 py-1.5 sm:gap-2 sm:px-2.5"
            title={
              lastUpdateSource
                ? `最終更新ソース: ${lastUpdateSource}`
                : "データ未取得"
            }
          >
            <Clock3 className="h-3 w-3 shrink-0 text-zinc-600" />
            <div className="leading-none">
              <p className="hidden text-[8px] font-semibold uppercase tracking-[0.16em] text-zinc-600 sm:block">
                Last synced
              </p>
              <p className="whitespace-nowrap font-mono text-[9px] tracking-tight text-zinc-300 sm:mt-1 sm:text-[10px]">
                {activeGame.hasLocalData ? lastUpdated ?? "未取得" : "—"}
              </p>
            </div>
          </div>

          <div
            className="hidden items-center gap-1.5 rounded-md border border-brand/15 bg-brand/[0.05] px-2.5 py-2 text-[10px] font-medium text-brand/80 xl:flex"
            title="ターミナルで実行するとローカル SQLite を更新します"
          >
            <Terminal className="h-3 w-3 text-brand" />
            <code className="font-mono">npm run update</code>
          </div>
        </div>
      </div>
    </header>
  );
}
