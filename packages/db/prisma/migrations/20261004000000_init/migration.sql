-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT,
    "auth_provider" TEXT NOT NULL DEFAULT 'wallet',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "address" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "did" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ(6),

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "headline" TEXT NOT NULL DEFAULT '',
    "summary" TEXT NOT NULL DEFAULT '',
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "slug" CITEXT,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "evidence_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "org" TEXT NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "event" TEXT,
    "year" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_roles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "community" TEXT NOT NULL,
    "role" TEXT,
    "status" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "sha256" BYTEA NOT NULL,
    "mime_type" TEXT,
    "size_bytes" BIGINT,
    "ai_type" TEXT,
    "ai_confidence" DECIMAL(3,2),
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "evidence_id" UUID NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,

    CONSTRAINT "evidence_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_blobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ciphertext" BYTEA NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_blobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issuers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "did" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "domain" TEXT,
    "accreditation" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "api_key_hash" BYTEA,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issuers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "issuer_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "evidence_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "decided_at" TIMESTAMPTZ(6),
    "draft_vc" JSONB,
    "draft_credential_id" UUID,
    "draft_status_index" INTEGER,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "issuer_id" UUID NOT NULL,
    "subject_user_id" UUID NOT NULL,
    "type" TEXT[],
    "vc_json" JSONB NOT NULL,
    "vc_hash" BYTEA NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6),

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credential_status" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "credential_id" UUID NOT NULL,
    "status_list_index" INTEGER NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMPTZ(6),
    "reason" TEXT,

    CONSTRAINT "credential_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chain_anchors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "credential_id" UUID NOT NULL,
    "tx_hash" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "block_number" BIGINT,
    "contract_address" TEXT NOT NULL,
    "anchor_hash" BYTEA NOT NULL,
    "anchored_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chain_anchors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT false,
    "granted_at" TIMESTAMPTZ(6),
    "withdrawn_at" TIMESTAMPTZ(6),

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "actor_type" TEXT,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" UUID,
    "before" JSONB,
    "after" JSONB,
    "ip" INET,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "siwe_nonces" (
    "nonce" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "siwe_nonces_pkey" PRIMARY KEY ("nonce")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" BYTEA NOT NULL,
    "address" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_did_key" ON "wallets"("did");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_user_id_address_chain_id_key" ON "wallets"("user_id", "address", "chain_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_slug_key" ON "profiles"("slug");

-- CreateIndex
CREATE INDEX "evidence_links_entity_type_entity_id_idx" ON "evidence_links"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "issuers_did_key" ON "issuers"("did");

-- CreateIndex
CREATE UNIQUE INDEX "issuers_address_key" ON "issuers"("address");

-- CreateIndex
CREATE INDEX "verification_requests_issuer_id_state_idx" ON "verification_requests"("issuer_id", "state");

-- CreateIndex
CREATE UNIQUE INDEX "credential_status_credential_id_key" ON "credential_status"("credential_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievements" ADD CONSTRAINT "achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_roles" ADD CONSTRAINT "community_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_links" ADD CONSTRAINT "evidence_links_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_issuer_id_fkey" FOREIGN KEY ("issuer_id") REFERENCES "issuers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_subject_user_id_fkey" FOREIGN KEY ("subject_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credential_status" ADD CONSTRAINT "credential_status_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chain_anchors" ADD CONSTRAINT "chain_anchors_credential_id_fkey" FOREIGN KEY ("credential_id") REFERENCES "credentials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- audit_logs is append-only: reject UPDATE and DELETE at the database level.
CREATE FUNCTION "audit_logs_append_only"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_logs_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "audit_logs_append_only"();
