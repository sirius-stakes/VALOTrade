-- AlterTable
ALTER TABLE "Player" ADD COLUMN "nationality" TEXT DEFAULT 'JP';
ALTER TABLE "Player" ADD COLUMN "role" TEXT;
ALTER TABLE "Player" ADD COLUMN "staffCategory" TEXT;

-- CreateTable
CREATE TABLE "Standing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "regionId" TEXT,
    "teamId" TEXT,
    "season" TEXT,
    "split" TEXT,
    "rank" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER,
    "tiebreaker" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Standing_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Standing_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Standing_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamAchievement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "tournament" TEXT NOT NULL,
    "placement" TEXT NOT NULL,
    "prize" TEXT,
    "date" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceTitle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamAchievement_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TeamMatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "teamId" TEXT NOT NULL,
    "opponentTeamName" TEXT NOT NULL,
    "opponentTeamShortName" TEXT,
    "opponentTeamLogoUrl" TEXT,
    "isWin" BOOLEAN,
    "score" TEXT,
    "date" TEXT NOT NULL,
    "streamUrl" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TeamMatch_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Standing_gameId_idx" ON "Standing"("gameId");

-- CreateIndex
CREATE INDEX "Standing_regionId_idx" ON "Standing"("regionId");

-- CreateIndex
CREATE INDEX "Standing_teamId_idx" ON "Standing"("teamId");

-- CreateIndex
CREATE INDEX "Standing_gameId_season_split_rank_idx" ON "Standing"("gameId", "season", "split", "rank");

-- CreateIndex
CREATE INDEX "TeamAchievement_teamId_idx" ON "TeamAchievement"("teamId");

-- CreateIndex
CREATE INDEX "TeamAchievement_teamId_date_idx" ON "TeamAchievement"("teamId", "date");

-- CreateIndex
CREATE INDEX "TeamMatch_teamId_idx" ON "TeamMatch"("teamId");

-- CreateIndex
CREATE INDEX "TeamMatch_teamId_status_date_idx" ON "TeamMatch"("teamId", "status", "date");

-- CreateIndex
CREATE INDEX "Player_staffCategory_idx" ON "Player"("staffCategory");
