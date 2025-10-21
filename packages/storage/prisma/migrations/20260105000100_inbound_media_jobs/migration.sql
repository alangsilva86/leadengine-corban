-- CreateEnum
CREATE TYPE "InboundMediaJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "inbound_media_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "messageExternalId" TEXT,
    "instanceId" TEXT,
    "brokerId" TEXT,
    "mediaType" TEXT,
    "mediaKey" TEXT,
    "directPath" TEXT,
    "status" "InboundMediaJobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextRetryAt" TIMESTAMP(3),
    "lastError" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_media_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inbound_media_jobs_status_nextRetryAt_idx" ON "inbound_media_jobs"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX "inbound_media_jobs_tenantId_status_idx" ON "inbound_media_jobs"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_media_jobs_messageId_key" ON "inbound_media_jobs"("messageId");

-- AddForeignKey
ALTER TABLE "inbound_media_jobs" ADD CONSTRAINT "inbound_media_jobs_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

