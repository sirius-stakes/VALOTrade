-- CreateTable
CREATE TABLE "TransferEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT,
    "playerHandle" TEXT NOT NULL,
    "fromTeamName" TEXT,
    "toTeamName" TEXT,
    "role" TEXT,
    "type" TEXT NOT NULL DEFAULT 'OTHER',
    "eventDate" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "sourceTitle" TEXT,
    "rawText" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TransferEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TransferEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TransferEvent_dedupeKey_key" ON "TransferEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "TransferEvent_gameId_eventDate_idx" ON "TransferEvent"("gameId", "eventDate");

-- CreateIndex
CREATE INDEX "TransferEvent_playerId_idx" ON "TransferEvent"("playerId");

-- CreateIndex
CREATE INDEX "TransferEvent_type_idx" ON "TransferEvent"("type");
