-- Radar de Receita: registra cada contato feito a partir de uma oportunidade
-- (cliente sumido, no ponto de voltar, falta sem remarcação, upsell). A receita
-- recuperada é calculada na leitura cruzando estes contatos com agendamentos
-- criados depois deles — nenhuma tabela existente é alterada.

-- CreateEnum
CREATE TYPE "OpportunityKind" AS ENUM ('NO_SHOW_RECOVERY', 'WIN_BACK', 'DUE_NOW', 'UPSELL');

-- CreateTable
CREATE TABLE "Outreach" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "createdById" TEXT,
    "kind" "OpportunityKind" NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'WHATSAPP',
    "message" TEXT NOT NULL,
    "estimatedValue" DECIMAL(10,2) NOT NULL,
    "contactedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Outreach_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Outreach_companyId_contactedAt_idx" ON "Outreach"("companyId", "contactedAt");

-- CreateIndex
CREATE INDEX "Outreach_clientId_contactedAt_idx" ON "Outreach"("clientId", "contactedAt");

-- AddForeignKey
ALTER TABLE "Outreach" ADD CONSTRAINT "Outreach_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outreach" ADD CONSTRAINT "Outreach_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outreach" ADD CONSTRAINT "Outreach_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

