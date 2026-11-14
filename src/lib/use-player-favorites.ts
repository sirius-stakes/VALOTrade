"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * 選手のお気に入り（★）を localStorage に保存するフック。
 *
 * キーは `${gameSlug}:${playerId}`。SSR 時の localStorage 参照を避けるため、
 * 初期値は空でマウント後に読み込む（ハイドレーション不整合を防ぐ）。
 */
const STORAGE_KEY = "teamtrade.player-favorites.v1";

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((value): value is string => typeof value === "string");
  } catch {
    return [];
  }
}

function writeFavorites(keys: Iterable<string>) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // ストレージ無効・容量超過時は表示だけ継続する。
  }
}

export function usePlayerFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setFavorites(new Set(readFavorites()));

    const handleStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setFavorites(new Set(readFavorites()));
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const isFavorite = useCallback(
    (gameSlug: string, playerId: string) =>
      favorites.has(`${gameSlug}:${playerId}`),
    [favorites],
  );

  const toggleFavorite = useCallback(
    (gameSlug: string, playerId: string) => {
      const key = `${gameSlug}:${playerId}`;

      setFavorites((previous) => {
        const next = new Set(previous);
        if (next.has(key)) {
          next.delete(key);
        } else {
          next.add(key);
        }
        writeFavorites(next);
        return next;
      });
    },
    [],
  );

  return { favorites, isFavorite, toggleFavorite };
}
