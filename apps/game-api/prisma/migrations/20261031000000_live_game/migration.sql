-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('LOBBY', 'QUESTION_OPEN', 'QUESTION_CLOSED', 'FINISHED', 'CANCELLED');

-- CreateTable
CREATE TABLE "GameSession" (
    "id" UUID NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "hostId" UUID NOT NULL,
    "sourceQuizId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "status" "GameStatus" NOT NULL DEFAULT 'LOBBY',
    "questionSeconds" INTEGER NOT NULL,
    "maxParticipants" INTEGER NOT NULL,
    "currentPosition" INTEGER,
    "openedAt" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameQuestion" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "sourceQuestionId" UUID,
    "position" INTEGER NOT NULL,
    "prompt" VARCHAR(2000) NOT NULL,
    "correctAnswer" BOOLEAN NOT NULL,
    "imageId" UUID,

    CONSTRAINT "GameQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameImage" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" VARCHAR(100) NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" UUID NOT NULL,
    "gameQuestionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "value" BOOLEAN NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Answer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameResult" (
    "sessionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("sessionId","participantId")
);

-- CreateIndex
CREATE INDEX "GameSession_hostId_status_createdAt_idx" ON "GameSession"("hostId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "GameSession_status_deadline_idx" ON "GameSession"("status", "deadline");

-- CreateIndex
CREATE UNIQUE INDEX "GameQuestion_imageId_key" ON "GameQuestion"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "GameQuestion_sessionId_position_key" ON "GameQuestion"("sessionId", "position");

-- CreateIndex
CREATE INDEX "GameImage_sessionId_idx" ON "GameImage"("sessionId");

-- CreateIndex
CREATE INDEX "Participant_userId_joinedAt_idx" ON "Participant"("userId", "joinedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Participant_sessionId_userId_key" ON "Participant"("sessionId", "userId");

-- CreateIndex
CREATE INDEX "Answer_participantId_idx" ON "Answer"("participantId");

-- CreateIndex
CREATE UNIQUE INDEX "Answer_gameQuestionId_participantId_key" ON "Answer"("gameQuestionId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "GameResult_participantId_key" ON "GameResult"("participantId");

-- CreateIndex
CREATE INDEX "GameResult_sessionId_rank_idx" ON "GameResult"("sessionId", "rank");

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_sourceQuizId_fkey" FOREIGN KEY ("sourceQuizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameQuestion" ADD CONSTRAINT "GameQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameQuestion" ADD CONSTRAINT "GameQuestion_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "GameImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameImage" ADD CONSTRAINT "GameImage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_gameQuestionId_fkey" FOREIGN KEY ("gameQuestionId") REFERENCES "GameQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Answer" ADD CONSTRAINT "Answer_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GameSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Join codes are unique only among sessions that can still be joined (not expressible in Prisma schema).
CREATE UNIQUE INDEX "GameSession_active_code_key" ON "GameSession"("code") WHERE "status" NOT IN ('FINISHED', 'CANCELLED');

-- Domain invariants mirrored in the database.
ALTER TABLE "GameSession"
 ADD CONSTRAINT "GameSession_code_format" CHECK ("code" ~ '^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$'),
 ADD CONSTRAINT "GameSession_title_nonempty" CHECK (length(btrim("title")) > 0),
 ADD CONSTRAINT "GameSession_questionSeconds_range" CHECK ("questionSeconds" BETWEEN 5 AND 120),
 ADD CONSTRAINT "GameSession_maxParticipants_range" CHECK ("maxParticipants" BETWEEN 1 AND 500),
 ADD CONSTRAINT "GameSession_currentPosition_nonnegative" CHECK ("currentPosition" IS NULL OR "currentPosition" >= 0),
 ADD CONSTRAINT "GameSession_version_nonnegative" CHECK ("version" >= 0),
 ADD CONSTRAINT "GameSession_open_has_deadline" CHECK ("status" <> 'QUESTION_OPEN' OR ("currentPosition" IS NOT NULL AND "openedAt" IS NOT NULL AND "deadline" IS NOT NULL));
ALTER TABLE "GameQuestion"
 ADD CONSTRAINT "GameQuestion_position_nonnegative" CHECK ("position" >= 0),
 ADD CONSTRAINT "GameQuestion_prompt_nonempty" CHECK (length(btrim("prompt")) > 0);
ALTER TABLE "Participant" ADD CONSTRAINT "Participant_displayName_nonempty" CHECK (length(btrim("displayName")) > 0);
ALTER TABLE "GameResult"
 ADD CONSTRAINT "GameResult_score_nonnegative" CHECK ("score" >= 0 AND "correctCount" >= 0),
 ADD CONSTRAINT "GameResult_rank_positive" CHECK ("rank" >= 1);
