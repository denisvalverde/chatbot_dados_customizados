-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "branchId" TEXT;

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "address" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "district" TEXT,
    "zipCode" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "description" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "acceptsAppointments" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_companyId_slug_key" ON "Branch"("companyId", "slug");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Unidades iniciais como rascunho: sem endereço/telefone reais ainda (não
-- inventados), não publicadas e sem agendamento liberado. Um admin completa
-- os dados e publica depois. Idempotente via ON CONFLICT na constraint
-- companyId+slug, para não duplicar em reexecuções.
INSERT INTO "Branch" ("id", "companyId", "name", "slug", "isActive", "isPublished", "acceptsAppointments", "updatedAt")
SELECT gen_random_uuid(), c."id", v."name", v."slug", true, false, false, CURRENT_TIMESTAMP
FROM "Company" c
CROSS JOIN (VALUES
  ('AP Auto Prime Suzano', 'suzano'),
  ('AP Auto Prime São José dos Campos', 'sao-jose-dos-campos'),
  ('AP Auto Prime Mogi das Cruzes', 'mogi-das-cruzes'),
  ('AP Auto Prime São Paulo', 'sao-paulo')
) AS v("name", "slug")
WHERE c."slug" = 'autoprime-demo'
ON CONFLICT ("companyId", "slug") DO NOTHING;
