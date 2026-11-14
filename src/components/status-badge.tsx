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
        "inline-flex items-center rounded border border-zinc-800/70 bg-zinc-900/40 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-zinc-400",
        className,
      )}
    >
      {role}
    </span>
  );
}
