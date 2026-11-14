import { PrismaClient, type PlayerStatus } from "@prisma/client";

process.env.DATABASE_URL ??= "file:./dev.db";

const prisma = new PrismaClient();

type SeedPlayer = {
  handle: string;
  realName?: string;
  status: PlayerStatus;
  /** 選手（Duelist / IGL など）、コーチ、マネージャー / アナリストなどのスタッフ。 */
  role: string;
  startDate: string;
  note?: string;
  xUrl?: string;
};

type SeedTeam = {
  shortName: string;
  name: string;
  regionCode: string;
  accent: string;
  logoUrl: string | null;
  officialUrl: string;
  newsUrl: string;
  description: string;
  roster: SeedPlayer[];
};

/**
 * 取得・表示対象は ZETA / DFM / FENNEL / MURASH GAMING の 4 チームのみ。
 * シードデータも各チームの選手・コーチと現在の所属だけに限定し、
 * 古いモックの移籍履歴・移籍イベントは投入しない。
 */
const teams: SeedTeam[] = [
  {
    shortName: "ZETA",
    name: "ZETA DIVISION",
    regionCode: "JP",
    accent: "violet",
    logoUrl: "/logos/zeta.png",
    officialUrl: "https://zetadivision.com/",
    newsUrl: "https://zetadivision.com/news",
    description:
      "日本を代表する国際大会常連。VALORANT部門は国内最高峰の実績を持つ。",
    roster: [
      {
        handle: "Aster",
        realName: "佐藤 海翔",
        status: "ACTIVE",
        role: "Duelist",
        startDate: "2024-01",
        note: "チームのエースデュエリスト。2026 VCT Pacific でも主力として出場。",
      },
      {
        handle: "Nagi",
        realName: "中村 凪",
        status: "ACTIVE",
        role: "Initiator",
        startDate: "2025-02",
        note: "情報奪取とエントリーを担うイニシエーター。",
      },
      {
        handle: "Sora",
        realName: "高橋 空",
        status: "ACTIVE",
        role: "Controller",
        startDate: "2025-02",
        note: "スモークワークの精度に定評があるコントローラー。",
      },
      {
        handle: "Kuro",
        realName: "黒田 蓮",
        status: "ACTIVE",
        role: "Sentinel",
        startDate: "2025-02",
        note: "サイトホールドとリテイク判断を支えるセンチネル。",
      },
      {
        handle: "Rin",
        realName: "水野 凛",
        status: "SUB",
        role: "Flex",
        startDate: "2025-08",
        note: "6人目として複数ロールをカバーするリザーブ。",
      },
      {
        handle: "Hibiki",
        realName: "山本 響",
        status: "ACTIVE",
        role: "Coach",
        startDate: "2024-01",
        note: "ヘッドコーチ。国際大会での戦術設計を担当。",
      },
      {
        handle: "Kaz",
        realName: "川崎 和也",
        status: "ACTIVE",
        role: "Manager",
        startDate: "2024-02",
        note: "チームマネージャー。契約・遠征・運営を担当。",
      },
      {
        handle: "Sena",
        realName: "瀬名 結衣",
        status: "ACTIVE",
        role: "Analyst",
        startDate: "2025-01",
        note: "データアナリスト。対戦相手の傾向分析を担当。",
      },
    ],
  },
  {
    shortName: "DFM",
    name: "DetonatioN FocusMe",
    regionCode: "JP",
    accent: "red",
    logoUrl: "/logos/dfm.png",
    officialUrl: "https://www.detonation.co.jp/",
    newsUrl: "https://www.detonation.co.jp/news",
    description:
      "国内最古参のeスポーツ組織。VALORANT部門は若手中心の構成。",
    roster: [
      {
        handle: "Yuto",
        realName: "伊藤 悠人",
        status: "ACTIVE",
        role: "Duelist",
        startDate: "2025-01",
        note: "高精度のエイムを武器にするデュエリスト。",
      },
      {
        handle: "Ren",
        realName: "佐々木 蓮",
        status: "ACTIVE",
        role: "IGL",
        startDate: "2023-01",
        note: "ゲーム内リーダー。テンポ重視のコールで知られる。",
      },
      {
        handle: "Mio",
        realName: "加藤 美緒",
        status: "ACTIVE",
        role: "Controller",
        startDate: "2025-03",
        note: "国内シーン注目の若手コントローラー。",
      },
      {
        handle: "Tatsuki",
        realName: "田中 樹",
        status: "ACTIVE",
        role: "Sentinel",
        startDate: "2024-06",
        note: "安定したアンカー性能を持つセンチネル。",
      },
      {
        handle: "Shin",
        realName: "新井 慎",
        status: "SUB",
        role: "Flex",
        startDate: "2025-09",
        note: "スクリムで起用されるサブメンバー。",
      },
      {
        handle: "Akira",
        realName: "大野 彰",
        status: "ACTIVE",
        role: "Coach",
        startDate: "2023-01",
        note: "育成とデータ分析に強みを持つコーチ。",
      },
      {
        handle: "Haru",
        realName: "林 陽菜",
        status: "ACTIVE",
        role: "Manager",
        startDate: "2023-04",
        note: "チームマネージャー。スケジュールと選手サポートを担当。",
      },
      {
        handle: "Riku",
        realName: "森 陸",
        status: "ACTIVE",
        role: "Analyst",
        startDate: "2025-02",
        note: "アナリスト。マップ別の戦術データを分析。",
      },
    ],
  },
  {
    shortName: "FENNEL",
    name: "FENNEL",
    regionCode: "JP",
    accent: "orange",
    logoUrl: "/logos/fennel.png",
    officialUrl: "https://fennel.gg/",
    newsUrl: "https://fennel.gg/news",
    description:
      "渋谷を拠点に活動するeスポーツチーム。VALORANT部門は国際経験も豊富。",
    roster: [
      {
        handle: "Fen",
        realName: "深 蓮",
        status: "ACTIVE",
        role: "Duelist",
        startDate: "2025-02",
        note: "チームのエースデュエリスト。",
      },
      {
        handle: "Koh",
        realName: "香 航",
        status: "ACTIVE",
        role: "Initiator",
        startDate: "2024-08",
        note: "情報奪取とエントリー支援のバランス型。",
      },
      {
        handle: "Shion",
        realName: "紫苑 詩音",
        status: "ACTIVE",
        role: "Controller",
        startDate: "2025-01",
        note: "スモーク配置の精度に定評。",
      },
      {
        handle: "Aoi",
        realName: "葵 青",
        status: "ACTIVE",
        role: "Sentinel",
        startDate: "2024-12",
        note: "サイトホールドの安定感が武器。",
      },
      {
        handle: "Yuzu",
        realName: "柚 結",
        status: "SUB",
        role: "Flex",
        startDate: "2025-08",
        note: "複数ロールをカバーするリザーブ。",
      },
      {
        handle: "Momo",
        realName: "桃 萌",
        status: "ACTIVE",
        role: "Coach",
        startDate: "2024-08",
        note: "国際大会経験のあるコーチ。",
      },
      {
        handle: "Takumi",
        realName: "匠 拓海",
        status: "ACTIVE",
        role: "Manager",
        startDate: "2024-01",
        note: "チームマネージャー。運営と広報を兼務。",
      },
      {
        handle: "Emi",
        realName: "江美 恵",
        status: "ACTIVE",
        role: "Analyst",
        startDate: "2025-03",
        note: "アナリスト。ピストルラウンドの統計を担当。",
      },
    ],
  },
  {
    shortName: "MURASH",
    name: "MURASH GAMING",
    regionCode: "JP",
    accent: "emerald",
    logoUrl: "/logos/murash.png",
    officialUrl: "https://murashgaming.jp/",
    newsUrl: "https://murashgaming.jp/",
    description:
      "MURASH GAMING は日本を拠点に活動するVALORANTチーム。若手中心のロスターで上位進出を狙う。",
    roster: [
      {
        handle: "Kohaku",
        realName: "琥珀 康",
        status: "ACTIVE",
        role: "Duelist",
        startDate: "2025-01",
        note: "チームの若手エース。",
      },
      {
        handle: "Reiji",
        realName: "玲司 礼",
        status: "ACTIVE",
        role: "Initiator",
        startDate: "2024-08",
        note: "チームのテンポを作るイニシエーター。",
      },
      {
        handle: "Shun",
        realName: "駿 俊",
        status: "ACTIVE",
        role: "Controller",
        startDate: "2025-03",
        note: "加入後すぐにレギュラーを獲得。",
      },
      {
        handle: "Nao",
        realName: "尚 直",
        status: "ACTIVE",
        role: "Sentinel",
        startDate: "2024-11",
        note: "守備的なラウンド設計を支える。",
      },
      {
        handle: "Aoto",
        realName: "蒼翔 蒼",
        status: "SUB",
        role: "Flex",
        startDate: "2025-09",
        note: "育成枠のリザーブ。",
      },
      {
        handle: "Ken",
        realName: "賢 健",
        status: "ACTIVE",
        role: "Coach",
        startDate: "2024-08",
        note: "データ分析出身のコーチ。",
      },
      {
        handle: "Kai",
        realName: "海斗 海",
        status: "ACTIVE",
        role: "Manager",
        startDate: "2024-09",
        note: "チームマネージャー。選手契約と現場運営を担当。",
      },
      {
        handle: "Yuna",
        realName: "優奈 結",
        status: "ACTIVE",
        role: "Analyst",
        startDate: "2025-04",
        note: "アナリスト。スクリムのデータ集計を担当。",
      },
    ],
  },
];

async function main() {
  console.log("🧹 既存データを削除中...");

  await prisma.$transaction([
    prisma.transferEvent.deleteMany(),
    prisma.membershipHistory.deleteMany(),
    prisma.updateLog.deleteMany(),
    prisma.player.deleteMany(),
    prisma.team.deleteMany(),
    prisma.region.deleteMany(),
    prisma.game.deleteMany(),
  ]);

  console.log("🎮 Game / Region を作成中...");

  const game = await prisma.game.create({
    data: {
      slug: "valorant",
      name: "VALORANT",
      shortName: "VAL",
      isActive: true,
      sortOrder: 0,
    },
  });

  const jp = await prisma.region.create({
    data: { code: "JP", name: "日本", sortOrder: 0 },
  });

  console.log("🛡️  対象4チームを作成中...");

  const teamMap = new Map<string, { id: string; newsUrl: string }>();

  for (const [index, team] of teams.entries()) {
    const created = await prisma.team.create({
      data: {
        gameId: game.id,
        regionId: jp.id,
        name: team.name,
        shortName: team.shortName,
        logoUrl: team.logoUrl,
        officialUrl: team.officialUrl,
        description: team.description,
        accent: team.accent,
        sortOrder: index,
        isActive: true,
      },
    });

    teamMap.set(team.shortName, {
      id: created.id,
      newsUrl: team.newsUrl,
    });
  }

  console.log("👤 選手・コーチ・スタッフと現在の所属を作成中...");

  let playerCount = 0;

  for (const team of teams) {
    const teamRecord = teamMap.get(team.shortName);
    if (!teamRecord) continue;

    for (const player of team.roster) {
      await prisma.player.create({
        data: {
          gameId: game.id,
          regionId: jp.id,
          handle: player.handle,
          realName: player.realName,
          status: player.status,
          country: "JP",
          xUrl:
            player.xUrl ??
            `https://x.com/valo_${player.handle.toLowerCase()}`,
          note: player.note,
          memberships: {
            create: [
              {
                teamId: teamRecord.id,
                role: player.role,
                startDate: player.startDate,
                endDate: null,
                isCurrent: true,
                announcementUrl: teamRecord.newsUrl,
                sourceNote: "ローカルシードデータ",
              },
            ],
          },
        },
      });

      playerCount += 1;
    }
  }

  const finishedAt = new Date();
  const summary = `${teams.length}チーム / ${playerCount}選手・コーチ・スタッフ / 移籍イベントなし`;

  await prisma.updateLog.create({
    data: {
      source: "seed",
      status: "SUCCESS",
      message: `初期データを投入しました（${summary}）`,
      startedAt: finishedAt,
      finishedAt,
    },
  });

  console.log(`✅ 完了: ${summary} を投入しました`);
}

main()
  .catch((error) => {
    console.error("❌ シードに失敗しました:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
