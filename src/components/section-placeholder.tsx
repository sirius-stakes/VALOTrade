import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2 } from "lucide-react";

type SectionPlaceholderProps = {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  phase?: string;
  points?: readonly string[];
  note?: string;
  children?: ReactNode;
};

/**
 * Phase 2-1 で整備した「UI の枠組み」を示すプレースホルダー。
 * データ取得が後続フェーズのセクションや、未対応タイトルで使用する。
 */
export function SectionPlaceholder({
  icon: Icon,
  eyebrow,
  title,
  description,
  phase,
  points,
  note,
  children,
}: SectionPlaceholderProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-zinc-800/80 bg-zinc-900/35">
      <span className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-brand/[0.07] blur-3xl" />
      <span className="pointer-events-none absolute -bottom-24 left-1/4 h-40 w-72 rounded-full bg-brand-alt/[0.04] blur-3xl" />

      <div className="relative px-5 py-8 sm:px-8 sm:py-10">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand/25 bg-brand/[0.07] text-brand">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                {eyebrow}
              </span>
              {phase ? (
                <span className="rounded-full border border-brand/25 bg-brand/[0.06] px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-brand">
                  {phase}
                </span>
              ) : null}
            </div>

            <h3 className="mt-4 font-display text-xl font-black tracking-wide text-white sm:text-2xl">
              {title}
            </h3>
            <p className="mt-2 max-w-xl text-[11.5px] leading-relaxed text-zinc-500 sm:text-xs">
              {description}
            </p>

            {points && points.length > 0 ? (
              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {points.map((point) => (
                  <li
                    key={point}
                    className="flex items-start gap-2 rounded-lg border border-zinc-800/70 bg-zinc-950/30 px-3 py-2 text-[10.5px] leading-relaxed text-zinc-400"
                  >
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand/80" />
                    {point}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {children ? (
            <div className="w-full shrink-0 lg:w-[360px]">{children}</div>
          ) : null}
        </div>

        <div className="mt-7 flex items-start gap-2 border-t border-zinc-800/70 pt-4 text-[10px] leading-relaxed text-zinc-600">
          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400/70" />
          <span>
            {note ??
              "ナビゲーション・テーマ・レイアウト枠は Phase 2-1 で整備済みです。データ取得は後続フェーズで接続します。"}
          </span>
        </div>
      </div>
    </div>
  );
}
