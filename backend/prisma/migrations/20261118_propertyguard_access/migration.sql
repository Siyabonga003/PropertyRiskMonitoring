ALTER TABLE "Property" ADD COLUMN "ownerId" TEXT;
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Property_ownerId_idx" ON "Property"("ownerId");

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'PROPERTY_OWNER';

CREATE TABLE "DeviceEnrollment" (
  "deviceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "deviceToken" TEXT NOT NULL,
  "pairingTokenHash" TEXT NOT NULL,
  "firmwareVer" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "claimedAt" TIMESTAMP(3),
  CONSTRAINT "DeviceEnrollment_pkey" PRIMARY KEY ("deviceId")
);
CREATE UNIQUE INDEX "DeviceEnrollment_deviceToken_key" ON "DeviceEnrollment"("deviceToken");
CREATE UNIQUE INDEX "DeviceEnrollment_pairingTokenHash_key" ON "DeviceEnrollment"("pairingTokenHash");

CREATE TABLE "PushToken" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PushToken_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PushToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PushToken_token_key" ON "PushToken"("token");
CREATE INDEX "PushToken_userId_enabled_idx" ON "PushToken"("userId", "enabled");
