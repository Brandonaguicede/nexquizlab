CREATE TABLE "Quiz" (
 "id" UUID NOT NULL, "ownerId" UUID NOT NULL, "title" VARCHAR(160) NOT NULL,
 "description" VARCHAR(2000) NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3), CONSTRAINT "Quiz_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Quiz_title_nonempty" CHECK (length(btrim("title")) > 0)
);
CREATE TABLE "ImageAsset" (
 "id" UUID NOT NULL, "ownerId" UUID NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "detachedAt" TIMESTAMP(3), CONSTRAINT "ImageAsset_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Question" (
 "id" UUID NOT NULL, "quizId" UUID NOT NULL, "prompt" VARCHAR(2000) NOT NULL, "correctAnswer" BOOLEAN NOT NULL,
 "position" INTEGER, "imageId" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3), CONSTRAINT "Question_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Question_prompt_nonempty" CHECK (length(btrim("prompt")) > 0),
 CONSTRAINT "Question_position_nonnegative" CHECK ("position" IS NULL OR "position" >= 0),
 CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "Question_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "ImageAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "Quiz_ownerId_deletedAt_updatedAt_id_idx" ON "Quiz"("ownerId", "deletedAt", "updatedAt" DESC, "id");
CREATE UNIQUE INDEX "Question_quizId_position_key" ON "Question"("quizId", "position");
CREATE UNIQUE INDEX "Question_imageId_key" ON "Question"("imageId");
CREATE INDEX "ImageAsset_createdAt_idx" ON "ImageAsset"("createdAt");
