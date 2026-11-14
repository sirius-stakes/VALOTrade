/**
 * 3 タイトルの公式順位表を一括取得・更新するスタンドアロンスクリプト。
 *
 * 実行:
 *   npm run update:standings                  # 全タイトル取得
 *   npm run update:standings -- --game=valorant  # VALORANT のみ
 *   npm run update:standings -- --dry-run     # 取得・解析のみ
 *   npm run update:standings -- --force       # 24 時間キャッシュを無視
 *
 * Liquipedia の利用規約に合わせ、以下を必ず守る:
 *   - 独自の User-Agent（連絡先先入り）と Accept-Encoding: gzip
 *   - リクエスト間は最低 30 秒
 *   - 429 検知時は即座停止
 */

import { PrismaClient } from "@prisma/client";

import {
  fetchAndSaveStandingsForGame,
  MIN_REQUEST_INTERVAL_MS,
  type StandingsOptions,
} from "./lib/standings-fetcher";

process.env.DATABASE_URL ??= "file:./dev.db";

const prisma = new PrismaClient();

const GAME_CONFIG: Record<
  string,
  { label: string; baseUrl: string; apiUrl: string }
> = {
  valorant: {
    label: "VALORANT",
    baseUrl: "https://liquipedia.net/valorant",
    apiUrl: "https://liquipedia.net/valorant/api.php",
  },
  "league-of-legends": {
    label: "League of Legends",
    baseUrl: "https://liquipedia.net/leagueoflegends",
    apiUrl: "https://liquipedia.net/leagueoflegends/api.php",
  },
  "identity-v": {
    label: "Identity V",
    baseUrl: "https://liquipedia.net/identityv",
    apiUrl: "https://liquipedia.net/identityv/api.php",
  },
};

const GAME_SLUGS = Object.keys(GAME_CONFIG);

type CliOptions = StandingsOptions & {
  gameSlug?: string;
};

function parseArgs(argv: string[]): CliOptions {
  const hasFlag = (name: string) => argv.includes(`--${name}`);
  const getOption = (name: string) => {
    const withEquals = argv.find((arg) => arg.startsWith(`--${name}=`));
    if (withEquals) return withEquals.slice(name.length + 3);
    const index = argv.indexOf(`--${name}`);
    if (index >= 0) return argv[index + 1];
    return undefined;
  };

  const delayMs = Math.max(
    MIN_REQUEST_INTERVAL_MS,
    Number.parseInt(
      getOption("delay") ??
        process.env.LIQUIPEDIA_DELAY_MS ??
        `${MIN_REQUEST_INTERVAL_MS}`,
      10,
    ) || MIN_REQUEST_INTERVAL_MS,
  );

  const rawGame = getOption("game")?.toLowerCase();
  const gameSlug =
    rawGame && GAME_SLUGS.includes(rawGame) ? rawGame : undefined;

  return {
    dryRun: hasFlag("dry-run"),
    verbose: hasFlag("verbose"),
    force: hasFlag("force"),
    debug: hasFlag("debug"),
    timeoutMs:
      Number.parseInt(getOption("timeout") ?? "30000", 10) || 30000,
    delayMs,
    gameSlug,
  };
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const targetSlugs = options.gameSlug
    ? [options.gameSlug]
    : GAME_SLUGS;

  console.log("──────────────────────────────────────────────");
  console.log(" Liquipedia 公式順位表 一括更新");
  console.log(` mode       : ${options.dryRun ? "DRY RUN" : "APPLY"}`);
  console.log(
    ` target     : ${targetSlugs.map((slug) => GAME_CONFIG[slug].label).join(" / ")}`,
  );
  console.log(
    ` rate limit : ${options.delayMs}ms (Liquipedia 規約に合わせ最低 ${MIN_REQUEST_INTERVAL_MS}ms)`,
  );
  console.log("──────────────────────────────────────────────");

  const totals: Record<
    string,
    { entriesParsed: number; entriesSaved: number }
  > = {};

  let failed = false;

  for (const slug of targetSlugs) {
    const config = GAME_CONFIG[slug];
    console.log(`\n▶ ${config.label} 順位表を取得します...`);
    try {
      const stats = await fetchAndSaveStandingsForGame(
        prisma,
        config.baseUrl,
        config.apiUrl,
        slug,
        options,
      );
      totals[slug] = {
        entriesParsed: stats.entriesParsed,
        entriesSaved: stats.entriesSaved,
      };
      console.log(
        `  ✅ ${config.label}: 取得 ${stats.entriesParsed} 件 / 保存 ${stats.entriesSaved} 件`,
      );
      if (stats.warnings.length > 0) {
        const limit = options.verbose ? stats.warnings.length : 10;
        for (const warning of stats.warnings.slice(0, limit)) {
          console.log(`    ⚠️  ${warning}`);
        }
        if (stats.warnings.length > limit) {
          console.log(
            `    ⚠️  ... 他 ${stats.warnings.length - limit} 件（--verbose で全件表示）`,
          );
        }
      }
    } catch (error) {
      failed = true;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ❌ ${config.label}: ${message}`);
    }
  }

  console.log("\n──────────────────────────────────────────────");
  console.log(" summary:");
  for (const [slug, result] of Object.entries(totals)) {
    console.log(
      `  ${GAME_CONFIG[slug].label}: parsed=${result.entriesParsed}, saved=${result.entriesSaved}`,
    );
  }
  console.log("──────────────────────────────────────────────");

  if (failed) {
    process.exitCode = 1;
  }
}

run()
  .catch(async (error) => {
    console.error("❌ 順位表更新処理に失敗しました:", error);
    try {
      await prisma.updateLog.create({
        data: {
          source: "liquipedia:standings",
          status: "FAILED",
          message:
            error instanceof Error
              ? error.message.slice(0, 2000)
              : String(error),
          finishedAt: new Date(),
        },
      });
    } catch {
      // DB に接続できない場合はコンソール出力のみ
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
