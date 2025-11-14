-- CreateTable
CREATE TABLE "agreements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "type" TEXT,
    "segment" TEXT,
    "description" TEXT,
    "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "products" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_tables" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" TIMESTAMP(3),
    "effectiveTo" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreement_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_windows" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "tableId" TEXT,
    "label" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreement_windows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_rates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "tableId" TEXT,
    "windowId" TEXT,
    "product" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "termMonths" INTEGER,
    "coefficient" DECIMAL(12, 6),
    "monthlyRate" DECIMAL(12, 6),
    "annualRate" DECIMAL(12, 6),
    "tacPercentage" DECIMAL(12, 6),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreement_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_history" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "windowId" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agreement_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agreement_import_jobs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agreementId" TEXT,
    "source" TEXT,
    "fileKey" TEXT,
    "fileName" TEXT,
    "checksum" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "processedRows" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agreement_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agreements_tenantId_slug_key" ON "agreements"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "agreements_tenantId_status_idx" ON "agreements"("tenantId", "status");

-- CreateIndex
CREATE INDEX "agreement_tables_tenantId_agreementId_idx" ON "agreement_tables"("tenantId", "agreementId");

-- CreateIndex
CREATE UNIQUE INDEX "agreement_tables_unique_idx" ON "agreement_tables"("tenantId", "agreementId", "name", "product", "modality", "version");

-- CreateIndex
CREATE INDEX "agreement_windows_tenantId_agreementId_idx" ON "agreement_windows"("tenantId", "agreementId");

-- CreateIndex
CREATE INDEX "agreement_windows_tenantId_tableId_idx" ON "agreement_windows"("tenantId", "tableId");

-- CreateIndex
CREATE INDEX "agreement_rates_tenantId_agreementId_idx" ON "agreement_rates"("tenantId", "agreementId");

-- CreateIndex
CREATE INDEX "agreement_rates_tenantId_windowId_idx" ON "agreement_rates"("tenantId", "windowId");

-- CreateIndex
CREATE INDEX "agreement_rates_tenantId_tableId_idx" ON "agreement_rates"("tenantId", "tableId");

-- CreateIndex
CREATE UNIQUE INDEX "agreement_rates_unique_idx" ON "agreement_rates"("tenantId", "agreementId", "product", "modality", "termMonths", "windowId", "tableId");

-- CreateIndex
CREATE INDEX "agreement_history_tenantId_agreementId_createdAt_idx" ON "agreement_history"("tenantId", "agreementId", "createdAt");

-- CreateIndex
CREATE INDEX "agreement_import_jobs_tenantId_status_idx" ON "agreement_import_jobs"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "agreements" ADD CONSTRAINT "agreements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_tables" ADD CONSTRAINT "agreement_tables_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_tables" ADD CONSTRAINT "agreement_tables_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_windows" ADD CONSTRAINT "agreement_windows_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_windows" ADD CONSTRAINT "agreement_windows_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_windows" ADD CONSTRAINT "agreement_windows_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "agreement_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_rates" ADD CONSTRAINT "agreement_rates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_rates" ADD CONSTRAINT "agreement_rates_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_rates" ADD CONSTRAINT "agreement_rates_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "agreement_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_rates" ADD CONSTRAINT "agreement_rates_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "agreement_windows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_history" ADD CONSTRAINT "agreement_history_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_history" ADD CONSTRAINT "agreement_history_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_history" ADD CONSTRAINT "agreement_history_windowId_fkey" FOREIGN KEY ("windowId") REFERENCES "agreement_windows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_import_jobs" ADD CONSTRAINT "agreement_import_jobs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agreement_import_jobs" ADD CONSTRAINT "agreement_import_jobs_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "agreements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
