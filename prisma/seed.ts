import {
  PrismaClient,
  type PlayerStatus,
  type TransferType,
} from "@prisma/client";

process.env.DATABASE_URL ??= "file:./dev.db";

const prisma = new PrismaClient();

type SeedHistory = {
  team: string;
  role: string;
  startDate: string;
  endDate: string;
  announcementUrl?: string;
};

type SeedPlayer = {
  handle: string;
  realName?: string;
  status: PlayerStatus;
  role?: string;
  startDate?: string;
  note?: string;
  xUrl?: string;
  history?: SeedHistory[];
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

type SeedFreeAgent = SeedPlayer & {
  regionCode: string;
  history: SeedHistory[];
};

/**
 * 取得・表示対象は ZETA / DFM / FENNEL / QTnet DISCONNECT の 4 チームのみ。
 * 初期データ内の所属履歴・移籍も、この 4 チームの範囲内だけで構成する。
 */
const teams: SeedTeam[] = [
  {
    shortName: "ZETA",
    name: "ZETA DIVISION",
    regionCode: "JP",
    accent: "violet",
    logoUrl: "/logos/zeta.svg",
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
        history: [
          {
            team: "DFM",
            role: "Duelist",
            startDate: "2022-04",
            endDate: "2023-12",
          },
        ],
      },
      {
        handle: "Nagi",
        realName: "中村 凪",
        status: "ACTIVE",
        role: "Initiator",
        startDate: "2025-02",
        note: "情報奪取とエントリーを担うイニシエーター。",
        history: [
          {
            team: "FENNEL",
            role: "Initiator",
            startDate: "2023-01",
            endDate: "2025-01",
          },
        ],
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
        history: [
          {
            team: "QTD",
            role: "Sentinel",
            startDate: "2023-06",
            endDate: "2025-01",
          },
        ],
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
    ],
  },
  {
    shortName: "DFM",
    name: "DetonatioN FocusMe",
    regionCode: "JP",
    accent: "red",
    logoUrl: "/logos/dfm.svg",
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
        history: [
          {
            team: "FENNEL",
            role: "Duelist",
            startDate: "2023-03",
            endDate: "2024-12",
          },
        ],
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
    ],
  },
  {
    shortName: "FENNEL",
    name: "FENNEL",
    regionCode: "JP",
    accent: "orange",
    logoUrl: null,
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
        note: "ZETAから移籍したエース。",
        history: [
          {
            team: "ZETA",
            role: "Duelist",
            startDate: "2022-05",
            endDate: "2025-01",
          },
        ],
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
    ],
  },
  {
    shortName: "QTD",
    name: "QTnet DISCONNECT",
    regionCode: "JP",
    accent: "emerald",
    logoUrl: null,
    officialUrl: "https://qtdig.com/",
    newsUrl: "https://qtdig.com/news",
    description:
      "QTnet が運営する国内チーム。若手中心のロスターで上位進出を狙う。",
    roster: [
      {
        handle: "Kohaku",
        realName: "琥珀 康",
        status: "ACTIVE",
        role: "Duelist",
        startDate: "2025-01",
        note: "DFMから移籍した若手エース。",
        history: [
          {
            team: "DFM",
            role: "Duelist",
            startDate: "2023-03",
            endDate: "2024-12",
          },
        ],
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
    ],
  },
];

/**
 * LFT / FA / 休止選手も、必ず上記 4 チームのいずれかに在籍していた選手だけを登録する。
 */
const freeAgents: SeedFreeAgent[] = [
  {
    handle: "Rui",
    realName: "塚本 塁",
    status: "LFT",
    regionCode: "JP",
    note: "2026年8月にZETAを退団。DuelistとしてLFT中。",
    history: [
      {
        team: "ZETA",
        role: "Duelist",
        startDate: "2023-01",
        endDate: "2026-08",
        announcementUrl: "https://zetadivision.com/news",
      },
      {
        team: "DFM",
        role: "Duelist",
        startDate: "2021-06",
        endDate: "2022-12",
        announcementUrl: "https://www.detonation.co.jp/news",
      },
    ],
  },
  {
    handle: "Miyu",
    realName: "宮本 美優",
    status: "LFT",
    regionCode: "JP",
    note: "2026年9月にFENNELを退団。IGL経験のあるController。",
    history: [
      {
        team: "FENNEL",
        role: "Controller",
        startDate: "2022-04",
        endDate: "2026-09",
        announcementUrl: "https://fennel.gg/news",
      },
    ],
  },
  {
    handle: "Toya",
    realName: "遠谷 東也",
    status: "LFT",
    regionCode: "JP",
    note: "2026年8月にDFMを退団。Sentinel / Flexとして活動中。",
    history: [
      {
        team: "DFM",
        role: "Sentinel",
        startDate: "2023-02",
        endDate: "2026-08",
        announcementUrl: "https://www.detonation.co.jp/news",
      },
      {
        team: "QTD",
        role: "Flex",
        startDate: "2021-09",
        endDate: "2023-01",
        announcementUrl: "https://qtdig.com/news",
      },
    ],
  },
  {
    handle: "Sho",
    realName: "庄司 翔",
    status: "FA",
    regionCode: "JP",
    note: "2026年9月にDFMとの契約を終了。フリーエージェント。",
    history: [
      {
        team: "DFM",
        role: "Initiator",
        startDate: "2021-01",
        endDate: "2026-09",
        announcementUrl: "https://www.detonation.co.jp/news",
      },
      {
        team: "ZETA",
        role: "Initiator",
        startDate: "2020-05",
        endDate: "2020-12",
        announcementUrl: "https://zetadivision.com/news",
      },
    ],
  },
  {
    handle: "Hana",
    realName: "花村 華",
    status: "FA",
    regionCode: "JP",
    note: "2026年10月にFENNELを退団。Flexとして移籍先を探索中。",
    history: [
      {
        team: "FENNEL",
        role: "Flex",
        startDate: "2022-06",
        endDate: "2026-10",
        announcementUrl: "https://fennel.gg/news",
      },
      {
        team: "QTD",
        role: "Initiator",
        startDate: "2021-02",
        endDate: "2022-05",
        announcementUrl: "https://qtdig.com/news",
      },
    ],
  },
  {
    handle: "Kiri",
    realName: "桐生 霧",
    status: "INACTIVE",
    regionCode: "JP",
    note: "2025年6月に現役引退。現在はストリーマーとして活動。",
    history: [
      {
        team: "QTD",
        role: "Controller",
        startDate: "2022-01",
        endDate: "2025-06",
        announcementUrl: "https://qtdig.com/news",
      },
    ],
  },
];

type SeedTransferEvent = {
  gameId: string;
  playerId: string;
  playerHandle: string;
  fromTeamName?: string | null;
  toTeamName?: string | null;
  role?: string | null;
  type: TransferType;
  eventDate: string;
  sourceUrl?: string | null;
  sourceTitle?: string | null;
  rawText?: string | null;
  dedupeKey: string;
};

const seededTransferEvents: SeedTransferEvent[] = [];
const seededTransferKeys = new Set<string>();

/** YYYY-MM をタイムライン用の YYYY-MM-01 に変換する。 */
function monthToDate(value: string) {
  return /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : value;
}

function registerTransferEvent(input: {
  gameId: string;
  playerId: string;
  playerHandle: string;
  fromTeamName?: string | null;
  toTeamName?: string | null;
  role?: string | null;
  type: TransferType;
  eventDate: string;
  sourceUrl?: string | null;
  rawText?: string | null;
}) {
  const eventDate = monthToDate(input.eventDate);
  const dedupeKey = [
    "seed",
    input.playerHandle,
    input.type,
    eventDate,
    input.fromTeamName ?? "",
    input.toTeamName ?? "",
    input.role ?? "",
  ]
    .join("|")
    .toLowerCase();

  if (seededTransferKeys.has(dedupeKey)) return;
  seededTransferKeys.add(dedupeKey);

  seededTransferEvents.push({
    ...input,
    eventDate,
    sourceTitle: "ローカルシードデータ",
    dedupeKey,
  });
}

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

  const [jp, kr] = await Promise.all([
    prisma.region.create({
      data: { code: "JP", name: "日本", sortOrder: 0 },
    }),
    prisma.region.create({
      data: { code: "KR", name: "韓国", sortOrder: 1 },
    }),
  ]);

  const regionMap = new Map<string, string>([
    [jp.code, jp.id],
    [kr.code, kr.id],
  ]);

  console.log("🛡️  対象4チームを作成中...");

  const teamMap = new Map<
    string,
    { id: string; newsUrl: string; name: string }
  >();

  for (const [index, team] of teams.entries()) {
    const created = await prisma.team.create({
      data: {
        gameId: game.id,
        regionId: regionMap.get(team.regionCode) ?? jp.id,
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
      name: created.name,
    });
  }

  console.log("👤 プレイヤーと所属履歴を作成中...");

  let playerCount = 0;

  for (const team of teams) {
    const teamRecord = teamMap.get(team.shortName);
    if (!teamRecord) continue;

    for (const player of team.roster) {
      const currentStart = player.startDate ?? "2025-01";
      const role = player.role ?? "Flex";

      const created = await prisma.player.create({
        data: {
          gameId: game.id,
          regionId: regionMap.get(team.regionCode) ?? jp.id,
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
                role,
                startDate: currentStart,
                endDate: null,
                isCurrent: true,
                announcementUrl: teamRecord.newsUrl,
                sourceNote: "ローカルシードデータ",
              },
              ...(player.history ?? []).map((history) => {
                const previousTeam = teamMap.get(history.team);
                if (!previousTeam) {
                  throw new Error(
                    `履歴チームが見つかりません: ${history.team} (${player.handle})`,
                  );
                }
                return {
                  teamId: previousTeam.id,
                  role: history.role,
                  startDate: history.startDate,
                  endDate: history.endDate,
                  isCurrent: false,
                  announcementUrl:
                    history.announcementUrl ?? previousTeam.newsUrl,
                  sourceNote: "ローカルシードデータ",
                };
              }),
            ],
          },
        },
      });

      registerTransferEvent({
        gameId: game.id,
        playerId: created.id,
        playerHandle: player.handle,
        toTeamName: teamRecord.name,
        role,
        type: "JOIN",
        eventDate: currentStart,
        sourceUrl: teamRecord.newsUrl,
        rawText: `${player.handle} joins ${teamRecord.name}`,
      });

      for (const history of player.history ?? []) {
        const previousTeam = teamMap.get(history.team);
        if (!previousTeam) continue;

        registerTransferEvent({
          gameId: game.id,
          playerId: created.id,
          playerHandle: player.handle,
          toTeamName: previousTeam.name,
          role: history.role,
          type: "JOIN",
          eventDate: history.startDate,
          sourceUrl: history.announcementUrl ?? previousTeam.newsUrl,
          rawText: `${player.handle} joins ${previousTeam.name}`,
        });
        registerTransferEvent({
          gameId: game.id,
          playerId: created.id,
          playerHandle: player.handle,
          fromTeamName: previousTeam.name,
          role: history.role,
          type: "LEAVE",
          eventDate: history.endDate,
          sourceUrl: history.announcementUrl ?? previousTeam.newsUrl,
          rawText: `${player.handle} leaves ${previousTeam.name}`,
        });
      }

      playerCount += 1;
    }
  }

  for (const player of freeAgents) {
    const created = await prisma.player.create({
      data: {
        gameId: game.id,
        regionId: regionMap.get(player.regionCode) ?? jp.id,
        handle: player.handle,
        realName: player.realName,
        status: player.status,
        country: "JP",
        xUrl:
          player.xUrl ??
          `https://x.com/valo_${player.handle.toLowerCase()}`,
        note: player.note,
        memberships: {
          create: player.history.map((history) => {
            const previousTeam = teamMap.get(history.team);
            if (!previousTeam) {
              throw new Error(
                `履歴チームが見つかりません: ${history.team} (${player.handle})`,
              );
            }
            return {
              teamId: previousTeam.id,
              role: history.role,
              startDate: history.startDate,
              endDate: history.endDate,
              isCurrent: false,
              announcementUrl:
                history.announcementUrl ?? previousTeam.newsUrl,
              sourceNote: "ローカルシードデータ",
            };
          }),
        },
      },
    });

    const latestHistory = [...player.history].sort((a, b) =>
      b.endDate.localeCompare(a.endDate),
    )[0];

    for (const history of player.history) {
      const previousTeam = teamMap.get(history.team);
      if (!previousTeam) continue;

      registerTransferEvent({
        gameId: game.id,
        playerId: created.id,
        playerHandle: player.handle,
        toTeamName: previousTeam.name,
        role: history.role,
        type: "JOIN",
        eventDate: history.startDate,
        sourceUrl: history.announcementUrl ?? previousTeam.newsUrl,
        rawText: `${player.handle} joins ${previousTeam.name}`,
      });

      // 最新の所属は、直後の LFT / FA / INACTIVE イベントが退団も表すため
      // LEAVE を重複登録しない。
      if (history === latestHistory) continue;

      registerTransferEvent({
        gameId: game.id,
        playerId: created.id,
        playerHandle: player.handle,
        fromTeamName: previousTeam.name,
        role: history.role,
        type: "LEAVE",
        eventDate: history.endDate,
        sourceUrl: history.announcementUrl ?? previousTeam.newsUrl,
        rawText: `${player.handle} leaves ${previousTeam.name}`,
      });
    }

    if (latestHistory) {
      const previousTeam = teamMap.get(latestHistory.team);
      registerTransferEvent({
        gameId: game.id,
        playerId: created.id,
        playerHandle: player.handle,
        fromTeamName: previousTeam?.name ?? latestHistory.team,
        role: latestHistory.role,
        type:
          player.status === "FA"
            ? "FA"
            : player.status === "INACTIVE"
              ? "INACTIVE"
              : "LFT",
        eventDate: latestHistory.endDate,
        sourceUrl:
          latestHistory.announcementUrl ?? previousTeam?.newsUrl ?? null,
        rawText: `${player.handle} is ${player.status}`,
      });
    }

    playerCount += 1;
  }

  if (seededTransferEvents.length > 0) {
    await prisma.transferEvent.createMany({
      data: seededTransferEvents,
    });
  }

  const finishedAt = new Date();
  const lftFaCount = freeAgents.filter(
    (player) => player.status === "LFT" || player.status === "FA",
  ).length;
  const inactiveCount = freeAgents.filter(
    (player) => player.status === "INACTIVE",
  ).length;
  const seedSummary = `${teams.length}チーム / ${playerCount}選手 / LFT・FA ${lftFaCount}名 / 休止 ${inactiveCount}名 / ${seededTransferEvents.length}移籍イベント`;
  await prisma.updateLog.create({
    data: {
      source: "seed",
      status: "SUCCESS",
      message: `初期モックデータを投入しました（${seedSummary}）`,
      startedAt: finishedAt,
      finishedAt,
    },
  });

  console.log(`✅ 完了: ${seedSummary} を投入しました`);
}

main()
  .catch((error) => {
    console.error("❌ シードに失敗しました:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
