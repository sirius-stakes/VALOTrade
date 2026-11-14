import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** YYYY-MM -> YYYY.MM（画面表示用） */
export function formatMonth(value: string | null | undefined) {
  if (!value) return "現在";
  return value.replace("-", ".");
}

/** YYYY-MM-DD / YYYY-MM -> YYYY.MM.DD（移籍タイムライン用） */
export function formatEventDate(value: string | null | undefined) {
  if (!value) return "日付不明";
  return value.replace(/-/g, ".");
}

/** 所属期間を 2024.03 - 2025.10 / 2025.10 - 現在 の形式に整形 */
export function formatPeriod(startDate: string, endDate: string | null, isCurrent: boolean) {
  return `${formatMonth(startDate)} - ${isCurrent || !endDate ? "現在" : formatMonth(endDate)}`;
}

/** ローカル DB の更新日時を Asia/Tokyo で表示 */
export function formatUpdatedAt(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")}`;
}

/** 名前のイニシャル（モノグラム用） */
export function getInitials(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "?";
  return trimmed.slice(0, 2).toUpperCase();
}
