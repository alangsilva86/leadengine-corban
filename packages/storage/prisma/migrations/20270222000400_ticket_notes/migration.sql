CREATE TABLE "ticket_notes" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "authorName" TEXT,
  "authorAvatar" TEXT,
  "body" TEXT NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'team',
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ticket_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ticket_notes_visibility_check" CHECK ("visibility" IN ('private', 'team', 'public')),
  CONSTRAINT "ticket_notes_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ticket_notes_tenantId_ticketId_createdAt_idx" ON "ticket_notes"("tenantId", "ticketId", "createdAt");
