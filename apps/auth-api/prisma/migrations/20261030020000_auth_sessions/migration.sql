-- Additive only: preserve existing users, password hashes, databases and volumes.
-- Fail safely if legacy rows collide; never silently merge or delete identities.
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower("email"));
CREATE TABLE "Session" (
 "id" UUID NOT NULL, "userId" UUID NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3),
 CONSTRAINT "Session_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "RefreshToken" (
 "hash" VARCHAR(64) NOT NULL, "sessionId" UUID NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "usedAt" TIMESTAMP(3),
 CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("hash"),
 CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE "RateBucket" (
 "key" VARCHAR(100) NOT NULL, "count" INTEGER NOT NULL DEFAULT 1, "expiresAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "RateBucket_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX "RefreshToken_sessionId_idx" ON "RefreshToken"("sessionId");
CREATE INDEX "RateBucket_expiresAt_idx" ON "RateBucket"("expiresAt");
