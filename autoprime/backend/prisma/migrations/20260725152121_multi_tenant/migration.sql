-- Multi-tenant: adiciona Company e escopa todas as entidades de negócio por
-- companyId. Escrita à mão (a partir do diff gerado pelo Prisma) para
-- preservar dados já existentes: as linhas atuais são atribuídas à empresa
-- "AutoPrime Demo" em vez de simplesmente falhar por violação de NOT NULL.

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- Empresa padrão que recebe todos os dados já existentes no banco.
INSERT INTO "Company" ("id", "name", "slug", "active", "createdAt", "updatedAt")
VALUES ('00000000-0000-0000-0000-000000000001', 'AutoPrime Demo', 'autoprime-demo', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- DropIndex (serão recriados como índices/constraints compostos com companyId)
DROP INDEX "Appointment_startAt_endAt_idx";
DROP INDEX "Client_document_idx";
DROP INDEX "Client_document_key";
DROP INDEX "Coupon_code_key";
DROP INDEX "Product_sku_idx";
DROP INDEX "Product_sku_key";
DROP INDEX "Service_category_idx";
DROP INDEX "ServiceOrder_status_idx";
DROP INDEX "Transaction_type_occurredAt_idx";

-- AlterTable: adiciona companyId ainda anulável, para poder popular antes de exigir NOT NULL
ALTER TABLE "Appointment" ADD COLUMN "companyId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Client" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Coupon" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Employee" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Product" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Service" ADD COLUMN "companyId" TEXT;
ALTER TABLE "ServiceOrder" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Transaction" ADD COLUMN "companyId" TEXT;
ALTER TABLE "User" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Vehicle" ADD COLUMN "companyId" TEXT;

-- Backfill: todas as linhas existentes pertencem à empresa padrão criada acima.
UPDATE "User" SET "companyId" = '00000000-0000-0000-0000-000000000001' WHERE "companyId" IS NULL;
UPDATE "Client" SET "companyId" = '00000000-0000-0000-0000-000000000001' WHERE "companyId" IS NULL;
UPDATE "Employee" SET "companyId" = '00000000-0000-0000-0000-000000000001' WHERE "companyId" IS NULL;
UPDATE "Vehicle" SET "companyId" = '00000000-0000-0000-0000-000000000001' WHERE "companyId" IS NULL;
UPDATE "Service" SET "companyId" = '00000000-0000-0000-0000-000000000001' WHERE "companyId" IS NULL;
UPDATE "Appointment" SET "companyId" = '00000000-0000-0000-0000-000000000001' WHERE "companyId" IS NULL;
UPDATE "ServiceOrder" SET "companyId" = '00000000-0000-0000-0000-000000000001' WHERE "companyId" IS NULL;
UPDATE "Transaction" SET "companyId" = '00000000-0000-0000-0000-000000000001' WHERE "companyId" IS NULL;
UPDATE "Product" SET "companyId" = '00000000-0000-0000-0000-000000000001' WHERE "companyId" IS NULL;
UPDATE "Supplier" SET "companyId" = '00000000-0000-0000-0000-000000000001' WHERE "companyId" IS NULL;
UPDATE "Coupon" SET "companyId" = '00000000-0000-0000-0000-000000000001' WHERE "companyId" IS NULL;

-- Agora que todas as linhas têm companyId, aplica NOT NULL onde o schema exige
-- (User e AuditLog continuam anuláveis: User.companyId é nulo apenas para SUPER_ADMIN).
ALTER TABLE "Appointment" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Client" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Coupon" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Service" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "ServiceOrder" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Supplier" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Transaction" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Vehicle" ALTER COLUMN "companyId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "Appointment_companyId_startAt_endAt_idx" ON "Appointment"("companyId", "startAt", "endAt");
CREATE INDEX "AuditLog_companyId_idx" ON "AuditLog"("companyId");
CREATE INDEX "Client_companyId_idx" ON "Client"("companyId");
CREATE UNIQUE INDEX "Client_companyId_document_key" ON "Client"("companyId", "document");
CREATE INDEX "Coupon_companyId_idx" ON "Coupon"("companyId");
CREATE UNIQUE INDEX "Coupon_companyId_code_key" ON "Coupon"("companyId", "code");
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");
CREATE INDEX "Product_companyId_idx" ON "Product"("companyId");
CREATE UNIQUE INDEX "Product_companyId_sku_key" ON "Product"("companyId", "sku");
CREATE INDEX "Service_companyId_category_idx" ON "Service"("companyId", "category");
CREATE INDEX "ServiceOrder_companyId_status_idx" ON "ServiceOrder"("companyId", "status");
CREATE INDEX "Supplier_companyId_idx" ON "Supplier"("companyId");
CREATE INDEX "Transaction_companyId_type_occurredAt_idx" ON "Transaction"("companyId", "type", "occurredAt");
CREATE INDEX "User_companyId_idx" ON "User"("companyId");
CREATE INDEX "Vehicle_companyId_idx" ON "Vehicle"("companyId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Service" ADD CONSTRAINT "Service_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
