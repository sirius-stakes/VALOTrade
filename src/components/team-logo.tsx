import { getTeamAccent } from "@/lib/status";
import { cn, getInitials } from "@/lib/utils";

type TeamLogoProps = {
  logoUrl?: string | null;
  shortName: string;
  accent?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  sm: "h-8 w-8 rounded-lg text-[10px]",
  md: "h-11 w-11 rounded-xl text-xs",
  lg: "h-14 w-14 rounded-2xl text-sm",
};

export function TeamLogo({
  logoUrl,
  shortName,
  accent,
  size = "md",
  className,
}: TeamLogoProps) {
  const accentMeta = getTeamAccent(accent);

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-white/10 bg-[#0b1018] ring-1",
        accentMeta.ring,
        SIZE_CLASS[size],
        className,
      )}
    >
      {logoUrl ? (
        // ローカル /public/logos 配下の SVG のみを想定
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${shortName} logo`}
          className="h-full w-full object-cover"
        />
      ) : (
        <>
          <span
            className={cn(
              "absolute inset-0 bg-gradient-to-br opacity-70",
              accentMeta.gradient,
            )}
          />
          <span
            className={cn(
              "relative font-display font-black tracking-tight",
              accentMeta.text,
            )}
          >
            {getInitials(shortName)}
          </span>
        </>
      )}
    </span>
  );
}
