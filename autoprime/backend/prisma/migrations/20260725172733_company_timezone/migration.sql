-- Adiciona o fuso horário (IANA) de cada empresa. Necessário para interpretar
-- horário de funcionamento, agendamentos, notificações e relatórios no fuso
-- correto da empresa, em vez do fuso do servidor ou do navegador do usuário.
-- "America/Sao_Paulo" é o default apenas para não quebrar empresas já
-- existentes (nenhuma tinha esse conceito antes); cada empresa deve poder
-- ajustar depois via PATCH /companies/me/timezone.

ALTER TABLE "Company" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo';
