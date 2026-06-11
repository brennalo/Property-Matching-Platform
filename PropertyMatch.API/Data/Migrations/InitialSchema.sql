-- ============================================================
-- PropertyMatch — Schema v2
-- Run this on a FRESH NeonDB database (drop all tables first).
-- Instructions at bottom of this file.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ─────────────────────────────────────────────────────────────────────
-- Status replaces the old IsActive boolean.
--   Pending  → registered, email not yet verified
--   Verified → email confirmed (tenants can use all features;
--              agents still need admin approval to post listings)
--   Blocked  → banned by admin

CREATE TABLE IF NOT EXISTS "Users" (
    "Id"           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "Email"        VARCHAR(255) NOT NULL UNIQUE,
    "PasswordHash" TEXT NOT NULL,
    "FullName"     VARCHAR(100) NOT NULL,
    "Role"         VARCHAR(20)  NOT NULL DEFAULT 'Tenant',
    "Status"       VARCHAR(20)  NOT NULL DEFAULT 'Pending',
    "CreatedAt"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "VerifiedAt"   TIMESTAMPTZ
);

-- ── Email Verifications ───────────────────────────────────────────────────────
-- Short-lived token sent via Resend email.
-- Deleted once consumed.

CREATE TABLE IF NOT EXISTS "EmailVerifications" (
    "Id"        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "UserId"    UUID NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "Token"     VARCHAR(64) NOT NULL UNIQUE,
    "ExpiresAt" TIMESTAMPTZ NOT NULL,
    "CreatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_verifications_token  ON "EmailVerifications"("Token");
CREATE INDEX IF NOT EXISTS idx_email_verifications_userid ON "EmailVerifications"("UserId");

-- ── Agents ────────────────────────────────────────────────────────────────────
-- UserId IS the primary key — one-to-one with Users.
-- Approval state lives on Users.Status — no redundant status here.

CREATE TABLE IF NOT EXISTS "Agents" (
    "UserId"           UUID PRIMARY KEY REFERENCES "Users"("Id") ON DELETE CASCADE,
    "StripeCustomerId" VARCHAR(255),
    "TokenBalance"     INT         NOT NULL DEFAULT 0,
    "LicenseNumber"    VARCHAR(100)
);

-- ── Listings ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Listings" (
    "Id"             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "AgentId"        UUID NOT NULL REFERENCES "Agents"("UserId") ON DELETE CASCADE,
    "Name"           VARCHAR(300) NOT NULL,
    "Rooms"          INT NOT NULL,
    "Toilets"        INT NOT NULL,
    "Lat"            DOUBLE PRECISION NOT NULL,
    "Lng"            DOUBLE PRECISION NOT NULL,
    "Address"        VARCHAR(500) NOT NULL,
    "ResidencyType"  VARCHAR(30)  NOT NULL,
    "Price"          DECIMAL(12,2) NOT NULL,
    "Status"         VARCHAR(20)  NOT NULL DEFAULT 'Draft',
    "CreatedAt"      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    "SourceUrl"      TEXT,
    "SourcePlatform" VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_listings_status   ON "Listings"("Status");
CREATE INDEX IF NOT EXISTS idx_listings_agent_id ON "Listings"("AgentId");

-- ── Listing Images ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ListingImages" (
    "Id"           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "ListingId"    UUID NOT NULL REFERENCES "Listings"("Id") ON DELETE CASCADE,
    "S3Url"        TEXT NOT NULL,
    "DisplayOrder" INT  NOT NULL DEFAULT 0
);

-- ── Lifestyle Templates ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "LifestyleTemplates" (
    "Id"         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "TenantId"   UUID NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "Name"       VARCHAR(100) NOT NULL,
    "PlaceTypes" TEXT[] NOT NULL DEFAULT '{}',
    "CreatedAt"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Viewing Schedules (composite PK) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "ViewingSchedules" (
    "ListingId"   UUID        NOT NULL REFERENCES "Listings"("Id") ON DELETE CASCADE,
    "ScheduledAt" TIMESTAMPTZ NOT NULL,
    "TenantId"    UUID        NOT NULL REFERENCES "Users"("Id") ON DELETE CASCADE,
    "Status"      VARCHAR(20) NOT NULL DEFAULT 'Pending',
    PRIMARY KEY ("ListingId", "ScheduledAt")
);

-- ── Payments ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Payments" (
    "Id"                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "AgentId"               UUID NOT NULL REFERENCES "Agents"("UserId") ON DELETE CASCADE,
    "ListingId"             UUID REFERENCES "Listings"("Id") ON DELETE SET NULL,
    "StripePaymentIntentId" VARCHAR(255) NOT NULL,
    "StripeSessionId"       VARCHAR(255),
    "Amount"                DECIMAL(10,2) NOT NULL,
    "Status"                VARCHAR(50)   NOT NULL DEFAULT 'pending',
    "CreatedAt"             TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ── EF Migrations History ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId"    VARCHAR(150) NOT NULL PRIMARY KEY,
    "ProductVersion" VARCHAR(32)  NOT NULL
);

-- ── Seed Data ─────────────────────────────────────────────────────────────────
-- Admin (password: Admin@123)
INSERT INTO "Users" ("Id", "Email", "PasswordHash", "FullName", "Role", "Status", "CreatedAt", "VerifiedAt")
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@propertymatch.com',
    '$2a$11$7mXHTxUhI7mp7DwFFxUQWeuj15gFeelxx3TA8vw8hr6E3Nir/jR4G',
    'System Admin',
    'Admin',
    'Verified',
    '2025-01-01T00:00:00Z',
    '2025-01-01T00:00:00Z'
) ON CONFLICT DO NOTHING;

-- Demo Agent user (password: Agent@123)
INSERT INTO "Users" ("Id", "Email", "PasswordHash", "FullName", "Role", "Status", "CreatedAt", "VerifiedAt")
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'agent@propertymatch.com',
    '$2a$11$LQJ8NgROr/tElesIOPluIeSiemdv3h3I/LeFVfY8YuX7uGdR5fybi',
    'Demo Agent',
    'Agent',
    'Verified',
    '2025-01-01T00:00:00Z',
    '2025-01-01T00:00:00Z'
) ON CONFLICT DO NOTHING;

-- Demo Agent record (UserId = PK)
INSERT INTO "Agents" ("UserId")
VALUES ('00000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- 10 seed listings
INSERT INTO "Listings" ("Id","AgentId","Name","Rooms","Toilets","Lat","Lng","Address","ResidencyType","Price","Status","CreatedAt") VALUES
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','Skyline Residences',3,2,3.1478,101.6953,'Jalan Ampang, Kuala Lumpur','Condo',2800,'Active','2025-01-01T00:00:00Z'),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','The Greenfield',4,3,3.0738,101.5183,'Subang Jaya, Selangor','Landed',4200,'Active','2025-01-01T00:00:00Z'),
('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','Casa Mia Studio',1,1,3.1579,101.7123,'Chow Kit, Kuala Lumpur','Studio',1100,'Active','2025-01-01T00:00:00Z'),
('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','Mont Kiara Suites',2,2,3.1720,101.6500,'Mont Kiara, Kuala Lumpur','Condo',3200,'Active','2025-01-01T00:00:00Z'),
('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','Bangsar Bungalow',5,4,3.1310,101.6720,'Bangsar, Kuala Lumpur','Landed',8500,'Active','2025-01-01T00:00:00Z'),
('10000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000002','Petaling Jaya Urban Flat',2,1,3.1073,101.6067,'Section 14, Petaling Jaya','Apartment',1600,'Active','2025-01-01T00:00:00Z'),
('10000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000002','Damansara Heights Manor',4,3,3.1483,101.6393,'Damansara Heights, Kuala Lumpur','Townhouse',5600,'Active','2025-01-01T00:00:00Z'),
('10000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-000000000002','Cheras Link Home',3,2,3.0790,101.7347,'Cheras, Kuala Lumpur','Landed',2300,'Active','2025-01-01T00:00:00Z'),
('10000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-000000000002','KLCC Tower View',2,2,3.1579,101.7123,'KLCC, Kuala Lumpur','Condo',4500,'Active','2025-01-01T00:00:00Z'),
('10000000-0000-0000-0000-000000000010','00000000-0000-0000-0000-000000000002','Sri Hartamas Corner Lot',3,3,3.1680,101.6404,'Sri Hartamas, Kuala Lumpur','Landed',3800,'Active','2025-01-01T00:00:00Z')
ON CONFLICT DO NOTHING;
