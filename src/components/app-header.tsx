import { Clock3, Crosshair, Terminal } from "lucide-react";

import { cn } from "@/lib/utils";

type AppHeaderProps = {
  lastUpdated: string | null;
  lastUpdateSource: string | null;
};

const TAB_BASE =
  "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors";

export function AppHeader({
  lastUpdated,
  lastUpdateSource,
}: AppHeaderProps) {
  return (
    <header className="border-b border-white/[0.06]">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 sm:px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/25 bg-gradient-to-br from-red-500/20 to-red-500/[0.03] text-red-400 shadow-[0_0_24px_-6px_rgba(248,113,113,0.45)] sm:h-9 sm:w-9">
            <Crosshair className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-red-400" />
          </span>
          <div className="leading-none">
            <p className="font-display text-[15px] font-black tracking-[0.07em] text-white sm:text-[17px]">
              VALO<span className="text-red-500">-</span>ROSTER{" "}
              <span className="text-red-400">JP</span>
            </p>
            <p className="mt-1.5 hidden text-[8px] font-medium uppercase tracking-[0.3em] text-zinc-600 sm:block">
              Esports roster tracker
            </p>
          </div>
        </div>

        <div className="mx-1 hidden h-9 w-px bg-white/[0.07] lg:block" />

        <nav
          aria-label="タイトル切替"
          className="scrollbar-none order-last flex w-full min-w-0 items-center gap-1 overflow-x-auto md:order-none md:w-auto"
        >
          <button
            type="button"
            aria-current="page"
            className={cn(
              TAB_BASE,
              "bg-white/[0.07] text-white shadow-inner shadow-white/[0.03]",
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.9)]" />
            VALORANT
          </button>
          <span className="ml-1 rounded border border-white/[0.07] bg-white/[0.025] px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
            JP
          </span>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div
            className="flex items-center gap-1.5 rounded-md border border-white/[0.07] bg-white/[0.025] px-2 py-1.5 sm:gap-2 sm:px-2.5"
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
                {lastUpdated ?? "未取得"}
              </p>
            </div>
          </div>

          <div
            className="hidden items-center gap-1.5 rounded-md border border-red-400/15 bg-red-400/[0.05] px-2.5 py-2 text-[10px] font-medium text-red-200/80 xl:flex"
            title="ターミナルで実行するとローカル SQLite を更新します"
          >
            <Terminal className="h-3 w-3 text-red-400" />
            <code className="font-mono">npm run update</code>
          </div>
        </div>
      </div>
    </header>
  );
}
