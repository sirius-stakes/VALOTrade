import type { PlayerStatus } from "@prisma/client";

/**
 * ロスター表示・取得の対象となる役職かどうか。
 * Phase 2-2 以降は選手・コーチに加えて、マネージャー / アナリストなどの
 * スタッフも DB に保存し、UI 側のトグルで表示を切り替える。
 */

export type RosterCategory = "PLAYER" | "COACH" | "STAFF";

const PLAYER_ROLE_PATTERN =
  /player|duelist|initiator|controller|sentinel|flex|\bigl\b|stand-?in|substitute|reserve|bench/i;

const COACH_ROLE_PATTERN = /coach/i;

const STAFF_ROLE_PATTERN =
  /manager|analyst|director|\bceo\b|owner|streamer|content\s*creator|creator|content|social|operations|psychologist|nutritionist|strategist|head\s+of/i;

export function isCoachRole(role: string | null | undefined) {
  return Boolean(role && COACH_ROLE_PATTERN.test(role));
}

export function isStaffRole(role: string | null | undefined) {
  if (!role || isCoachRole(role)) return false;
  return STAFF_ROLE_PATTERN.test(role);
}

export function isPlayerRole(role: string | null | undefined) {
  if (!role) return true;
  return (
    !isCoachRole(role) && !isStaffRole(role) && PLAYER_ROLE_PATTERN.test(role)
  );
}

/** 取得対象（選手・コーチ・スタッフ）かどうか。 */
export function isRosterRole(role: string | null | undefined) {
  return isCoachRole(role) || isPlayerRole(role) || isStaffRole(role);
}

/** 移籍タイムライン・LFT 市場など、競技ロスターとして扱う役職かどうか。 */
export function isCompetitiveRole(role: string | null | undefined) {
  return isCoachRole(role) || isPlayerRole(role);
}

export function getRosterCategory(
  role: string | null | undefined,
): RosterCategory {
  if (isCoachRole(role)) return "COACH";
  if (isStaffRole(role)) return "STAFF";
  return "PLAYER";
}

const STREAMER_LIKE_PATTERN = /streamer|content\s*creator|creator/i;

/**
 * ストリーマー / コンテンツクリエイター系の役職かどうか。
 * UI 側でデフォルト非表示にするスタッフ判定の二重ガードとして使用する。
 */
export function isStreamerLikeRole(role: string | null | undefined) {
  if (!role) return false;
  return STREAMER_LIKE_PATTERN.test(role);
}

/** チームカード内の並び順: Active → Sub → LFT/FA/Inactive → Coach → Staff。 */
export function rosterPriority(
  role: string | null | undefined,
  status: PlayerStatus,
) {
  const category = getRosterCategory(role);
  if (category === "STAFF") return 5;
  if (category === "COACH") return 4;

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
