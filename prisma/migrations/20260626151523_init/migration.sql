-- CreateTable
CREATE TABLE "Instance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "session" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "InstanceSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "typingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "typingMsPerChar" INTEGER NOT NULL DEFAULT 10,
    "audioActionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "audioUseDuration" BOOLEAN NOT NULL DEFAULT true,
    "audioFixedSeconds" INTEGER NOT NULL DEFAULT 3,
    "videoActionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "videoUseDuration" BOOLEAN NOT NULL DEFAULT true,
    "videoFixedSeconds" INTEGER NOT NULL DEFAULT 5,
    "photoActionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "photoFixedSeconds" INTEGER NOT NULL DEFAULT 2,
    "documentActionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "documentFixedSeconds" INTEGER NOT NULL DEFAULT 2,
    CONSTRAINT "InstanceSettings_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Webhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instanceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Webhook_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InstanceSettings_instanceId_key" ON "InstanceSettings"("instanceId");
