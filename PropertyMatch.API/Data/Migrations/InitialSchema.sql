-- PropertyMatch Initial Migration
-- Run manually on NeonDB if EF auto-migration is not used
-- Or let Program.cs run dbCtx.Database.Migrate() on startup

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS "Users" (
    "Id"           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Email"        VARCHAR(255) NOT NULL UNIQUE,
    "PasswordHash" TEXT NOT NULL,
    "FullName"     VARCHAR(100) NOT NULL,
    "Role"         VARCHAR(20) NOT NULL DEFAULT 'Tenant',
    "CreatedAt"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "IsActive"     BOOLEAN NOT NULL DEFAULT TRUE
);

-- Agents
CREATE TABLE IF NOT EXISTS "Agents" (
    "Id"               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "UserId"           UUID NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "StripeCustomerId" VARCHAR(255),
    "Status"           VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "VerifiedAt"       TIMESTAMPTZ,
    UNIQUE("UserId")
);

-- Listings
CREATE TABLE IF NOT EXISTS "Listings" (
    "Id"             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "AgentId"        UUID NOT NULL REFERENCES "Agents"("Id") ON DELETE CASCADE,
    "Name"           VARCHAR(300) NOT NULL,
    "Rooms"          INT NOT NULL,
    "Toilets"        INT NOT NULL,
    "Lat"            DOUBLE PRECISION NOT NULL,
    "Lng"            DOUBLE PRECISION NOT NULL,
    "Address"        VARCHAR(500) NOT NULL,
    "ResidencyType"  VARCHAR(30) NOT NULL,
    "Price"          DECIMAL(12,2) NOT NULL,
    "Status"         VARCHAR(20) NOT NULL DEFAULT 'Draft',
    "CreatedAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "SourceUrl"      TEXT,
    "SourcePlatform" VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_listings_status   ON "Listings"("Status");
CREATE INDEX IF NOT EXISTS idx_listings_agent_id ON "Listings"("AgentId");

-- Listing images
CREATE TABLE IF NOT EXISTS "ListingImages" (
    "Id"           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ListingId"    UUID NOT NULL REFERENCES "Listings"("Id") ON DELETE CASCADE,
    "S3Url"        TEXT NOT NULL,
    "DisplayOrder" INT NOT NULL DEFAULT 0
);

-- Lifestyle templates (PlaceTypes as text array)
CREATE TABLE IF NOT EXISTS "LifestyleTemplates" (
    "Id"         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "TenantId"   UUID NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "Name"       VARCHAR(100) NOT NULL,
    "PlaceTypes" TEXT[] NOT NULL DEFAULT '{}',
    "CreatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Viewing schedules (composite PK)
CREATE TABLE IF NOT EXISTS "ViewingSchedules" (
    "ListingId"   UUID NOT NULL REFERENCES "Listings"("Id") ON DELETE CASCADE,
    "ScheduledAt" TIMESTAMPTZ NOT NULL,
    "TenantId"    UUID NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "Status"      VARCHAR(20) NOT NULL DEFAULT 'Pending',
    PRIMARY KEY ("ListingId", "ScheduledAt")
);

-- Payments
CREATE TABLE IF NOT EXISTS "Payments" (
    "Id"                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "AgentId"                UUID NOT NULL REFERENCES "Agents"("Id") ON DELETE CASCADE,
    "ListingId"              UUID REFERENCES "Listings"("Id") ON DELETE SET NULL,
    "StripePaymentIntentId"  VARCHAR(255) NOT NULL,
    "StripeSessionId"        VARCHAR(255),
    "Amount"                 DECIMAL(10,2) NOT NULL,
    "Status"                 VARCHAR(50) NOT NULL DEFAULT 'pending',
    "CreatedAt"              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- EF migrations history table (required for EF Core)
CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId"    VARCHAR(150) NOT NULL PRIMARY KEY,
    "ProductVersion" VARCHAR(32)  NOT NULL
);
