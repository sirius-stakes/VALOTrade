import { getCountryMeta } from "@/lib/nationality";
import { cn } from "@/lib/utils";

type NationalityFlagProps = {
  country: string | null | undefined;
  /** ISO コードも併記する */
  withCode?: boolean;
  className?: string;
};

/**
 * `Player.country`（"Japan" / "South Korea" など）を絵文字国旗として表示する。
 * 未知の国名は何も描画せず、レイアウトを崩さない。
 */
export function NationalityFlag({
  country,
  withCode = false,
  className,
}: NationalityFlagProps) {
  const meta = getCountryMeta(country);
  if (!meta) return null;

  return (
    <span
      title={meta.label}
      aria-label={`国籍: ${meta.label}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 text-[11px] leading-none",
        className,
      )}
    >
      <span aria-hidden className="text-[12px] leading-none">
        {meta.flag}
      </span>
      {withCode ? (
        <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
          {meta.code}
        </span>
      ) : null}
    </span>
  );
}
