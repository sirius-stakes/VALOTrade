import type { PlayerStatus } from "@prisma/client";

/**
 * ロスター表示・取得の対象となる役職かどうか。
 * 選手（Player / Duelist / IGL など）とコーチ（Coach / Head Coach など）のみを対象とし、
 * Manager / Analyst / Streamer / CEO / Director などのスタッフは除外する。
 */

const PLAYER_ROLE_PATTERN =
  /player|duelist|initiator|controller|sentinel|flex|\bigl\b|stand-?in|substitute|reserve|bench/i;

const COACH_ROLE_PATTERN = /coach/i;

export function isCoachRole(role: string | null | undefined) {
  return Boolean(role && COACH_ROLE_PATTERN.test(role));
}

export function isPlayerRole(role: string | null | undefined) {
  if (!role) return true;
  return !isCoachRole(role) && PLAYER_ROLE_PATTERN.test(role);
}

export function isRosterRole(role: string | null | undefined) {
  return isCoachRole(role) || isPlayerRole(role);
}

/** チームカード内の並び順: Active → Sub → LFT/FA/Inactive → Coach。 */
export function rosterPriority(
  role: string | null | undefined,
  status: PlayerStatus,
) {
  if (isCoachRole(role)) return 4;

  switch (status) {
    case "ACTIVE":
      return 0;
    case "SUB":
      return 1;
    case "LFT":
    case "FA":
    case "INACTIVE":
      return 2;
    default:
      return 3;
  }
}
