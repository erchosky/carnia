-- Keep the persisted PostgreSQL enum aligned with QuestionCategory in schema.prisma.
-- These values are used by seed-questions-new-categories.ts.
ALTER TYPE "QuestionCategory" ADD VALUE IF NOT EXISTS 'LIGHTING';
ALTER TYPE "QuestionCategory" ADD VALUE IF NOT EXISTS 'SAFETY_SYSTEMS';
ALTER TYPE "QuestionCategory" ADD VALUE IF NOT EXISTS 'ROAD_USE';
ALTER TYPE "QuestionCategory" ADD VALUE IF NOT EXISTS 'CARGO';
ALTER TYPE "QuestionCategory" ADD VALUE IF NOT EXISTS 'RISK_FACTORS';
ALTER TYPE "QuestionCategory" ADD VALUE IF NOT EXISTS 'VULNERABLE_USERS';
ALTER TYPE "QuestionCategory" ADD VALUE IF NOT EXISTS 'ADVERSE_CONDITIONS';
