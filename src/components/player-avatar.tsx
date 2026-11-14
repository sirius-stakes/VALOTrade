import { cn } from "@/lib/utils";

const GRADIENTS = [
  "from-violet-500/40 to-fuchsia-500/10 text-violet-100",
  "from-cyan-500/40 to-sky-500/10 text-cyan-100",
  "from-rose-500/40 to-orange-500/10 text-rose-100",
  "from-emerald-500/40 to-teal-500/10 text-emerald-100",
  "from-amber-500/40 to-yellow-500/10 text-amber-100",
  "from-indigo-500/40 to-purple-500/10 text-indigo-100",
];

function gradientFor(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}

type PlayerAvatarProps = {
  handle: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  sm: "h-8 w-8 text-[10px]",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-xl",
};

export function PlayerAvatar({
  handle,
  avatarUrl,
  size = "sm",
  className,
}: PlayerAvatarProps) {
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br font-display font-black uppercase tracking-tight",
        gradientFor(handle),
        SIZE_CLASS[size],
        className,
      )}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="relative drop-shadow">
          {handle.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}
