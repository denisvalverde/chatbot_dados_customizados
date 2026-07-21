# Manual do Usuário (Cliente) — AutoPrime

## 1. Criando sua conta

Use o endpoint `POST /api/v1/auth/register` (ou peça para a loja cadastrar você pelo
painel — menu Clientes → "+ Novo cliente"). É necessário aceitar o uso dos seus
dados (LGPD) no cadastro.

## 2. Cadastrando seu veículo

Depois de logado, cadastre seu veículo (marca, modelo, ano, cor, placa) — isso é
feito hoje pela loja no painel administrativo (menu Veículos, via API
`POST /api/v1/vehicles`); uma tela de autoatendimento do cliente é prevista para a
fase 2 deste projeto.

## 3. Agendando um serviço

1. Escolha um ou mais serviços do catálogo (`GET /api/v1/services`, público).
2. Escolha data e horário. O sistema soma a duração dos serviços escolhidos e
   verifica automaticamente se não há conflito com a equipe.
3. Você recebe uma confirmação por e-mail assim que o agendamento é criado.

## 4. Acompanhando o atendimento

Sua Ordem de Serviço (OS) passa pelos status **Aberta → Em andamento → Concluída →
Entregue**. Fotos de antes/depois e o checklist executado ficam registrados na OS
(`GET /api/v1/service-orders/:id`).

## 5. Pagamento

No fechamento da OS, é possível gerar uma cobrança:

- **PIX**: um código "copia e cola" é gerado no padrão oficial do Banco Central —
  escaneável em qualquer banco. A confirmação do pagamento é feita pela loja
  (conciliação manual nesta versão).
- **Cartão / dinheiro**: registrados pela loja no momento do pagamento.

## 6. Cancelamento e remarcação

Um agendamento pode ser cancelado (`PATCH /appointments/:id/cancel`) ou remarcado
(`PATCH /appointments/:id/reschedule`) enquanto não estiver concluído.
