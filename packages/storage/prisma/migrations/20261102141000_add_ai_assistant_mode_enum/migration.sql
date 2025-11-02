-- Add AI assistant mode enum and align ai_configs.defaultMode type
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AiAssistantMode') THEN
    CREATE TYPE "AiAssistantMode" AS ENUM ('IA_AUTO', 'COPILOTO', 'HUMANO');
  END IF;
END $$;

ALTER TABLE "ai_configs" ALTER COLUMN "defaultMode" DROP DEFAULT;
ALTER TABLE "ai_configs"
  ALTER COLUMN "defaultMode" TYPE "AiAssistantMode"
  USING "defaultMode"::"AiAssistantMode";
ALTER TABLE "ai_configs" ALTER COLUMN "defaultMode" SET DEFAULT 'COPILOTO';
