import type { PlayerStatus, TransferType } from "@prisma/client";

export type StatusFilter = "all" | "free" | "active";

export const PLAYER_STATUS_ORDER: PlayerStatus[] = [
  "ACTIVE",
  "SUB",
  "LFT",
  "FA",
  "INACTIVE",
];

export const STATUS_META: Record<
  PlayerStatus,
  {
    label: string;
    description: string;
    badgeClassName: string;
    dotClassName: string;
    glowClassName: string;
  }
> = {
  ACTIVE: {
    label: "Active",
    description: "チームと契約中・稼働中",
    badgeClassName:
      "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    dotClassName: "bg-emerald-400",
    glowClassName: "shadow-[0_0_12px_-2px_rgba(52,211,153,0.7)]",
  },
  SUB: {
    label: "Sub / Reserve",
    description: "サブ・リザーブ契約",
    badgeClassName: "border-slate-400/25 bg-slate-400/10 text-slate-300",
    dotClassName: "bg-slate-400",
    glowClassName: "",
  },
  LFT: {
    label: "LFT",
    description: "Looking For Team / 移籍先募集中",
    badgeClassName: "border-amber-400/35 bg-amber-400/10 text-amber-300",
    dotClassName: "bg-amber-400",
    glowClassName: "shadow-[0_0_12px_-2px_rgba(251,191,36,0.75)]",
  },
  FA: {
    label: "FA",
    description: "Free Agent / フリーエージェント",
    badgeClassName:
      "border-purple-400/35 bg-purple-400/10 text-purple-300",
    dotClassName: "bg-purple-400",
    glowClassName: "shadow-[0_0_12px_-2px_rgba(192,132,252,0.7)]",
  },
  INACTIVE: {
    label: "Inactive",
    description: "休止・引退など",
    badgeClassName: "border-zinc-600/40 bg-zinc-800/60 text-zinc-400",
    dotClassName: "bg-zinc-500",
    glowClassName: "",
  },
};

export const TRANSFER_META: Record<
  TransferType,
  {
    label: string;
    description: string;
    badgeClassName: string;
    dotClassName: string;
    lineClassName: string;
  }
> = {
  JOIN: {
    label: "加入",
    description: "チームへ加入",
    badgeClassName:
      "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    dotClassName: "bg-emerald-400",
    lineClassName: "from-emerald-400/60",
  },
  TRANSFER: {
    label: "移籍",
    description: "チーム間の移籍",
    badgeClassName: "border-sky-400/30 bg-sky-400/10 text-sky-300",
    dotClassName: "bg-sky-400",
    lineClassName: "from-sky-400/60",
  },
  LEAVE: {
    label: "退団",
    description: "チームから離脱",
    badgeClassName: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    dotClassName: "bg-amber-400",
    lineClassName: "from-amber-400/60",
  },
  LFT: {
    label: "LFT",
    description: "移籍先募集中",
    badgeClassName: "border-amber-400/35 bg-amber-400/10 text-amber-300",
    dotClassName: "bg-amber-400",
    lineClassName: "from-amber-400/60",
  },
  FA: {
    label: "FA",
    description: "フリーエージェント",
    badgeClassName:
      "border-purple-400/35 bg-purple-400/10 text-purple-300",
    dotClassName: "bg-purple-400",
    lineClassName: "from-purple-400/60",
  },
  INACTIVE: {
    label: "Inactive",
    description: "休止・稼働停止",
    badgeClassName: "border-zinc-600/40 bg-zinc-800/60 text-zinc-400",
    dotClassName: "bg-zinc-500",
    lineClassName: "from-zinc-500/60",
  },
  RETIRE: {
    label: "引退",
    description: "現役引退",
    badgeClassName: "border-zinc-600/40 bg-zinc-800/60 text-zinc-400",
    dotClassName: "bg-zinc-500",
    lineClassName: "from-zinc-500/60",
  },
  OTHER: {
    label: "更新",
    description: "その他のロスター更新",
    badgeClassName: "border-slate-400/25 bg-slate-400/10 text-slate-300",
    dotClassName: "bg-slate-400",
    lineClassName: "from-slate-400/60",
  },
};

export const ROLE_ORDER = [
  "IGL",
  "Duelist",
  "Initiator",
  "Controller",
  "Sentinel",
  "Flex",
  "Coach",
  "Analyst",
  "Manager",
  "Staff",
] as const;

export function roleRank(role: string) {
  const index = ROLE_ORDER.findIndex(
    (candidate) => candidate.toLowerCase() === role.toLowerCase(),
  );
  return index === -1 ? ROLE_ORDER.length : index;
}

export const TEAM_ACCENTS: Record<
  string,
  { gradient: string; ring: string; text: string; line: string }
> = {
  violet: {
    gradient: "from-violet-500/35 via-fuchsia-500/20 to-transparent",
    ring: "ring-violet-400/30",
    text: "text-violet-200",
    line: "bg-violet-400",
  },
  red: {
    gradient: "from-red-500/35 via-rose-500/20 to-transparent",
    ring: "ring-red-400/30",
    text: "text-red-200",
    line: "bg-red-400",
  },
  amber: {
    gradient: "from-amber-400/35 via-orange-500/20 to-transparent",
    ring: "ring-amber-400/30",
    text: "text-amber-200",
    line: "bg-amber-400",
  },
  pink: {
    gradient: "from-pink-500/35 via-rose-500/20 to-transparent",
    ring: "ring-pink-400/30",
    text: "text-pink-200",
    line: "bg-pink-400",
  },
  cyan: {
    gradient: "from-cyan-400/35 via-sky-500/20 to-transparent",
    ring: "ring-cyan-400/30",
    text: "text-cyan-200",
    line: "bg-cyan-400",
  },
  gold: {
    gradient: "from-yellow-400/35 via-amber-500/20 to-transparent",
    ring: "ring-yellow-400/30",
    text: "text-yellow-200",
    line: "bg-yellow-400",
  },
  orange: {
    gradient: "from-orange-500/35 via-red-500/20 to-transparent",
    ring: "ring-orange-400/30",
    text: "text-orange-200",
    line: "bg-orange-400",
  },
  emerald: {
    gradient: "from-emerald-400/35 via-teal-500/20 to-transparent",
    ring: "ring-emerald-400/30",
    text: "text-emerald-200",
    line: "bg-emerald-400",
  },
};

export function getTeamAccent(accent: string | null | undefined) {
  return TEAM_ACCENTS[accent ?? ""] ?? TEAM_ACCENTS.violet;
}
