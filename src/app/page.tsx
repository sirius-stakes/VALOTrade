import { Dashboard } from "@/components/dashboard";
import { SetupScreen } from "@/components/setup-screen";
import { getDashboardData } from "@/lib/roster";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  try {
    const data = await getDashboardData();

    if (!data) {
      return (
        <SetupScreen message="VALORANT のゲームデータがまだ登録されていません。npm run db:seed を実行してください。" />
      );
    }

    return <Dashboard data={data} />;
  } catch (error) {
    console.error("[VALO-ROSTER] dashboard data load failed:", error);
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
