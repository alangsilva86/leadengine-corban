ALTER TYPE "WhatsAppInstanceStatus" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "WhatsAppInstanceStatus" ADD VALUE IF NOT EXISTS 'failed';

-- O default será atualizado em uma migration separada, para garantir que o
-- Postgres reconheça os novos valores do enum antes do ALTER TABLE.
