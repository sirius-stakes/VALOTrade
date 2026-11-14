import type { PlayerStatus } from "@prisma/client";

import { STATUS_META } from "@/lib/status";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  status: PlayerStatus;
  size?: "sm" | "md";
  className?: string;
};

export function StatusBadge({
  status,
  size = "sm",
  className,
}: StatusBadgeProps) {
  const meta = STATUS_META[status];

  return (
    <span
      title={meta.description}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold uppercase tracking-wider",
        meta.badgeClassName,
        meta.glowClassName,
        size === "sm"
          ? "px-2 py-0.5 text-[9.5px]"
          : "px-2.5 py-1 text-[11px]",
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          meta.dotClassName,
          status === "LFT" && "animate-pulse-soft",
        )}
      />
      {meta.label}
    </span>
  );
}

const ROLE_COLORS: Record<string, string> = {
  Duelist:
    "border-rose-400/25 bg-rose-400/[0.08] text-rose-300",
  Initiator:
    "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300",
  Controller:
    "border-sky-400/25 bg-sky-400/[0.08] text-sky-300",
  Sentinel:
    "border-amber-400/25 bg-amber-400/[0.08] text-amber-300",
  Flex: "border-violet-400/25 bg-violet-400/[0.08] text-violet-300",
  IGL: "border-fuchsia-400/25 bg-fuchsia-400/[0.08] text-fuchsia-300",
  Top: "border-red-400/25 bg-red-400/[0.08] text-red-300",
  Jungle: "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-300",
  Mid: "border-amber-400/25 bg-amber-400/[0.08] text-amber-300",
  Bot: "border-sky-400/25 bg-sky-400/[0.08] text-sky-300",
  ADC: "border-sky-400/25 bg-sky-400/[0.08] text-sky-300",
  Support: "border-violet-400/25 bg-violet-400/[0.08] text-violet-300",
  Coach:
    "border-zinc-500/30 bg-zinc-500/[0.08] text-zinc-300",
  Manager:
    "border-zinc-600/30 bg-zinc-600/[0.08] text-zinc-400",
  Analyst:
    "border-zinc-600/30 bg-zinc-600/[0.08] text-zinc-400",
};

function roleClassName(role: string) {
  const normalized = role.trim();
  return (
    ROLE_COLORS[normalized] ??
    ROLE_COLORS[
      Object.keys(ROLE_COLORS).find(
        (key) => key.toLowerCase() === normalized.toLowerCase(),
      ) ?? ""
    ] ??
    "border-zinc-700/50 bg-zinc-800/30 text-zinc-400"
  );
}

export function RoleTag({
  role,
  className,
}: {
  role: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium tracking-wide",
        roleClassName(role),
        className,
      )}
    >
      {role}
    </span>
  );
}
