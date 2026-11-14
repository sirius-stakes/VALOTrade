import { readFile } from "node:fs/promises";

import { PrismaClient, type PlayerStatus } from "@prisma/client";

import { TEAM_SOURCES, type TeamSource } from "./sources";
import {
  parseRosterHtml,
  type ParsedAnnouncement,
  type ParsedPlayer,
} from "./lib/roster-parser";

process.env.DATABASE_URL ??= "file:./dev.db";

const prisma = new PrismaClient();
const args = process.argv.slice(2);

type SourceResult = {
  sourceId: string;
  teamName: string;
  url: string;
  fetched: boolean;
  parsed: number;
  applied: number;
  changes: string[];
  warnings: string[];
  error?: string;
};

function hasFlag(name: string) {
  return args.includes(`--${name}`);
}

function getOption(name: string) {
  const withEquals = args.find((argument) =>
    argument.startsWith(`--${name}=`),
  );
  if (withEquals) return withEquals.slice(name.length + 3);

  const index = args.indexOf(`--${name}`);
  if (index >= 0) return args[index + 1];
  return undefined;
}

const dryRun = hasFlag("dry-run");
const prune = hasFlag("prune");
const verbose = hasFlag("verbose");
const fixturePath = getOption("fixture");
const timeoutMs = Number.parseInt(getOption("timeout") ?? "15000", 10);

function getSourceList() {
  const sourceId = getOption("source");
  if (!sourceId) return TEAM_SOURCES;

  const source = TEAM_SOURCES.find(
    (candidate) =>
      candidate.id.toLowerCase() === sourceId.toLowerCase() ||
      candidate.teamShortName.toLowerCase() === sourceId.toLowerCase(),
  );

  if (!source) {
    throw new Error(
      `不明なソース: ${sourceId} / 利用可能: ${TEAM_SOURCES.map(
        (candidate) => candidate.id,
      ).join(", ")}`,
    );
  }

  return [source];
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function previousMonth() {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() - 1);
  return date.toISOString().slice(0, 7);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function fetchPage(source: TeamSource) {
  if (fixturePath) {
    return await readFile(fixturePath, "utf8");
  }

  const response = await fetch(source.rosterUrl, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "User-Agent":
        "VALO-ROSTER-JP/0.1 (local roster tracker; +http://localhost:3000)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "ja,en;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} ${response.statusText} (${source.rosterUrl})`,
    );
  }

  return await response.text();
}

function announcementMap(announcements: ParsedAnnouncement[]) {
  const map = new Map<string, string>();
  for (const announcement of announcements) {
    if (!announcement.playerHandle) continue;
    map.set(announcement.playerHandle.toLowerCase(), announcement.url);
  }
  return map;
}

function membershipRole(player: ParsedPlayer) {
  return player.role?.trim() || "Member";
}

async function applyPlayer(
  gameId: string,
  regionId: string,
  teamId: string,
  source: TeamSource,
  player: ParsedPlayer,
  announcements: Map<string, string>,
  result: SourceResult,
) {
  const handle = player.handle.trim();
  if (!handle) return;

  const announcementUrl =
    player.announcementUrl ?? announcements.get(handle.toLowerCase());
  const role = membershipRole(player);
  const startDate = player.startDate ?? currentMonth();
  const isFreeStatus =
    player.status === "LFT" ||
    player.status === "FA" ||
    player.status === "INACTIVE";

  const existing = await prisma.player.findUnique({
    where: { gameId_handle: { gameId, handle } },
    include: {
      memberships: {
        where: { isCurrent: true },
      },
    },
  });

  if (!existing) {
    result.changes.push(
      `${dryRun ? "[dry-run] " : ""}選手を新規作成: ${handle} (${player.status}, ${role})`,
    );
    if (dryRun) return;

    const created = await prisma.player.create({
      data: {
        gameId,
        regionId,
        handle,
        realName: player.realName,
        status: player.status,
        note: player.note,
        xUrl: player.xUrl,
        country: "JP",
      },
    });

    if (!isFreeStatus) {
      await prisma.membershipHistory.create({
        data: {
          playerId: created.id,
          teamId,
          role,
          startDate,
          isCurrent: true,
          announcementUrl,
          sourceNote: `update:${source.id}`,
        },
      });
    }

    result.applied += 1;
    return;
  }

  const updates: {
    status: PlayerStatus;
    realName?: string;
    note?: string;
    xUrl?: string;
  } = { status: player.status };

  if (player.realName) updates.realName = player.realName;
  if (player.note) updates.note = player.note;
  if (player.xUrl) updates.xUrl = player.xUrl;

  result.changes.push(
    `${dryRun ? "[dry-run] " : ""}選手を更新: ${handle} status=${player.status}${
      player.role ? ` role=${player.role}` : ""
    }`,
  );

  if (!dryRun) {
    await prisma.player.update({
      where: { id: existing.id },
      data: updates,
    });
  }

  const current = existing.memberships[0] ?? null;

  if (isFreeStatus) {
    if (current) {
      result.changes.push(
        `${dryRun ? "[dry-run] " : ""}現所属を終了: ${handle} / ${
          source.teamShortName
        }`,
      );
      if (!dryRun) {
        await prisma.membershipHistory.update({
          where: { id: current.id },
          data: {
            isCurrent: false,
            endDate: previousMonth(),
            sourceNote: `update:${source.id}`,
          },
        });
      }
    }
    result.applied += 1;
    return;
  }

  if (!current) {
    result.changes.push(
      `${dryRun ? "[dry-run] " : ""}所属履歴を追加: ${handle} -> ${
        source.teamShortName
      } (${startDate})`,
    );
    if (!dryRun) {
      await prisma.membershipHistory.create({
        data: {
          playerId: existing.id,
          teamId,
          role,
          startDate,
          isCurrent: true,
          announcementUrl,
          sourceNote: `update:${source.id}`,
        },
      });
    }
    result.applied += 1;
    return;
  }

  if (current.teamId !== teamId) {
    result.changes.push(
      `${dryRun ? "[dry-run] " : ""}移籍を検出: ${handle} ${
        current.teamId
      } -> ${source.teamShortName} (${startDate})`,
    );
    if (!dryRun) {
      await prisma.$transaction([
        prisma.membershipHistory.update({
          where: { id: current.id },
          data: {
            isCurrent: false,
            endDate: previousMonth(),
            sourceNote: `update:${source.id}`,
          },
        }),
        prisma.membershipHistory.create({
          data: {
            playerId: existing.id,
            teamId,
            role,
            startDate,
            isCurrent: true,
            announcementUrl,
            sourceNote: `update:${source.id}`,
          },
        }),
      ]);
    }
    result.applied += 1;
    return;
  }

  if (player.role || announcementUrl) {
    result.changes.push(
      `${dryRun ? "[dry-run] " : ""}現所属を更新: ${handle} (${role})`,
    );
    if (!dryRun) {
      await prisma.membershipHistory.update({
        where: { id: current.id },
        data: {
          role: player.role ? role : undefined,
          announcementUrl: announcementUrl ?? undefined,
          sourceNote: `update:${source.id}`,
        },
      });
    }
    result.applied += 1;
  }
}

async function applyRoster(
  source: TeamSource,
  html: string,
  result: SourceResult,
) {
  const parsed = parseRosterHtml(html);
  result.parsed = parsed.players.length;
  result.warnings.push(...parsed.warnings);

  if (parsed.players.length === 0) {
    return;
  }

  const game = await prisma.game.findUnique({
    where: { slug: "valorant" },
  });

  if (!game) {
    throw new Error(
      "VALORANT のゲームデータがありません。先に npm run db:seed を実行してください。",
    );
  }

  let region = await prisma.region.findUnique({
    where: { code: source.regionCode },
  });

  if (!region) {
    result.changes.push(
      `${dryRun ? "[dry-run] " : ""}地域を作成: ${source.regionCode}`,
    );
    if (dryRun) return;
    region = await prisma.region.create({
      data: { code: source.regionCode, name: "日本", sortOrder: 0 },
    });
  }

  let team = await prisma.team.findUnique({
    where: {
      gameId_shortName: {
        gameId: game.id,
        shortName: source.teamShortName,
      },
    },
  });

  if (!team) {
    result.changes.push(
      `${dryRun ? "[dry-run] " : ""}チームを作成: ${source.teamName}`,
    );
    if (dryRun) return;
    team = await prisma.team.create({
      data: {
        gameId: game.id,
        regionId: region.id,
        name: source.teamName,
        shortName: source.teamShortName,
        logoUrl: source.logoUrl,
        officialUrl: source.officialUrl,
        accent: source.accent,
      },
    });
  }

  const announcements = announcementMap(parsed.announcements);

  for (const player of parsed.players) {
    await applyPlayer(
      game.id,
      region.id,
      team.id,
      source,
      player,
      announcements,
      result,
    );
  }

  if (prune) {
    const parsedHandles = new Set(
      parsed.players.map((player) => player.handle.toLowerCase()),
    );
    const currentMemberships = await prisma.membershipHistory.findMany({
      where: { teamId: team.id, isCurrent: true },
      include: { player: true },
    });
    const missing = currentMemberships.filter(
      (membership) =>
        !parsedHandles.has(membership.player.handle.toLowerCase()),
    );

    for (const membership of missing) {
      result.changes.push(
        `${dryRun ? "[dry-run] " : ""}ロスター外のためLFT化: ${
          membership.player.handle
        }`,
      );
      if (!dryRun) {
        await prisma.$transaction([
          prisma.membershipHistory.update({
            where: { id: membership.id },
            data: {
              isCurrent: false,
              endDate: previousMonth(),
              sourceNote: `update:${source.id}:prune`,
            },
          }),
          prisma.player.update({
            where: { id: membership.playerId },
            data: { status: "LFT" },
          }),
        ]);
      }
      result.applied += 1;
    }
  } else {
    const parsedHandles = new Set(
      parsed.players.map((player) => player.handle.toLowerCase()),
    );
    const currentMemberships = await prisma.membershipHistory.findMany({
      where: { teamId: team.id, isCurrent: true },
      include: { player: true },
    });
    const missing = currentMemberships
      .filter(
        (membership) =>
          !parsedHandles.has(membership.player.handle.toLowerCase()),
      )
      .map((membership) => membership.player.handle);

    if (missing.length > 0) {
      result.warnings.push(
        `公式ページのロスターに見つからない選手: ${missing.join(
          ", ",
        )}（--prune を付けると LFT 化します）`,
      );
    }
  }
}

async function main() {
  const sources = getSourceList();

  if (fixturePath && sources.length > 1) {
    console.log(
      `ℹ️  --fixture 指定のため ${sources[0].teamShortName} のローカル HTML のみ解析します。`,
    );
    sources.splice(1);
  }

  console.log("──────────────────────────────────────────────");
  console.log(" VALO-ROSTER JP / local roster update");
  console.log(
    ` mode: ${dryRun ? "DRY RUN (DB書き込みなし)" : "APPLY"} / prune: ${
      prune ? "ON" : "OFF"
    } / sources: ${sources.length}`,
  );
  if (fixturePath) console.log(` fixture: ${fixturePath}`);
  console.log("──────────────────────────────────────────────");

  const updateLog = dryRun
    ? null
    : await prisma.updateLog.create({
        data: {
          source: "update-roster",
          status: "RUNNING",
          message: `${sources.length} sources`,
        },
      });

  const results: SourceResult[] = [];

  for (const [index, source] of sources.entries()) {
    const result: SourceResult = {
      sourceId: source.id,
      teamName: source.teamName,
      url: fixturePath ?? source.rosterUrl,
      fetched: false,
      parsed: 0,
      applied: 0,
      changes: [],
      warnings: [],
    };

    try {
      console.log(
        `\n[${index + 1}/${sources.length}] ${source.teamName} を取得中...`,
      );
      const html = await fetchPage(source);
      result.fetched = true;

      await applyRoster(source, html, result);
      results.push(result);

      const statusLabel =
        result.parsed > 0 ? `${result.parsed} players` : "no roster";
      console.log(
        `  ${result.parsed > 0 ? "✅" : "⚠️"} ${statusLabel} / ${
          result.applied
        } changes`,
      );

      if (verbose) {
        for (const change of result.changes) console.log(`    - ${change}`);
      }
      for (const warning of result.warnings) {
        console.log(`    ⚠️  ${warning}`);
      }
    } catch (error) {
      result.error =
        error instanceof Error ? error.message : String(error);
      results.push(result);
      console.error(`  ❌ ${result.error}`);
    }

    if (!fixturePath && index < sources.length - 1) {
      await sleep(700);
    }
  }

  const successful = results.filter(
    (result) => result.fetched && result.parsed > 0 && !result.error,
  ).length;
  const failed = results.filter((result) => result.error).length;
  const noRoster = results.filter(
    (result) => result.fetched && result.parsed === 0 && !result.error,
  ).length;

  let status: "SUCCESS" | "PARTIAL" | "FAILED";
  if (successful === results.length) {
    status = "SUCCESS";
  } else if (successful === 0) {
    // 取得できてもロスターを 1 件も特定できなかった場合は「更新失敗」扱い。
    // ヘッダーの Updated は SUCCESS / PARTIAL のみを参照する。
    status = "FAILED";
  } else {
    status = "PARTIAL";
  }

  const message = results
    .map((result) => {
      if (result.error) return `${result.teamName}: ERROR (${result.error})`;
      if (result.parsed === 0) return `${result.teamName}: no roster`;
      return `${result.teamName}: ${result.parsed} parsed / ${result.applied} applied`;
    })
    .join(" | ");

  console.log("\n──────────────────────────────────────────────");
  console.log(
    ` summary: ${status} / success=${successful} no-roster=${noRoster} failed=${failed}`,
  );
  console.log(` ${dryRun ? "DB writes skipped (dry-run)" : "updateLog saved"}`);
  console.log("──────────────────────────────────────────────");

  if (updateLog) {
    await prisma.updateLog.update({
      where: { id: updateLog.id },
      data: {
        status,
        message: message.slice(0, 2000),
        finishedAt: new Date(),
      },
    });
  }

  if (status === "FAILED") {
    process.exitCode = 1;
  }
}

main()
  .catch(async (error) => {
    console.error("❌ 更新処理に失敗しました:", error);
    try {
      await prisma.updateLog.create({
        data: {
          source: "update-roster",
          status: "FAILED",
          message:
            error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
        },
      });
    } catch {
      // DB に接続できない場合はログ保存も失敗するため、コンソール出力のみ
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
