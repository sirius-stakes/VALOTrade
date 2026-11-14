import { Dashboard } from "@/components/dashboard";
import { SetupScreen } from "@/components/setup-screen";
import { GAME_DEFINITIONS } from "@/lib/games";
import { getDashboardData } from "@/lib/roster";
import type { DashboardData } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const dataMap: Record<string, DashboardData> = {};

    for (const game of GAME_DEFINITIONS.filter((g) => g.hasLocalData)) {
      const data = await getDashboardData(game.slug);
      if (data) {
        dataMap[game.slug] = data;
      }
    }

    const defaultGame = GAME_DEFINITIONS.find((g) => g.hasLocalData);

    if (!defaultGame || Object.keys(dataMap).length === 0) {
      return (
        <SetupScreen message="ゲームデータがまだ登録されていません。npm run db:seed または各タイトルの update コマンドを実行してください。" />
      );
    }

    return <Dashboard dataMap={dataMap} initialGameSlug={defaultGame.slug} />;
  } catch (error) {
    console.error("[TEAMTRADE] dashboard data load failed:", error);
    return (
      <SetupScreen
        message={
          error instanceof Error
            ? error.message
            : "データベースの読み込みに失敗しました。"
        }
      />
    );
  }
}
