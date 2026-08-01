"""Seed: cria usuario admin e (opcionalmente) dados de demonstracao.

Uso:
    python scripts/seed.py            # cria admin (senha via ADMIN_PASSWORD ou gerada)
    python scripts/seed.py --demo     # + tickets e documentos de DEMONSTRACAO (sinteticos)
"""

from __future__ import annotations

import argparse
import secrets
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import get_settings  # noqa: E402
from app.core.logging import configure_logging, get_logger  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.infrastructure.database import SessionLocal, init_db  # noqa: E402
from app.infrastructure.repositories import UserRepository  # noqa: E402

logger = get_logger("seed")

DEMO_DOCUMENTS = [
    {
        "title": "Procedimento: disco degraded em RAID MegaRAID",
        "content": (
            "Sintoma: VD em estado Degraded, PD em Failed/UBad. Diagnostico: coletar "
            "'storcli /c0 show all' e SEL. Se disco em predictive failure, abrir RMA e "
            "programar troca com janela. Apos troca, acompanhar rebuild com "
            "'storcli /c0/eall/sall show rebuild'. Nunca remover disco errado: conferir "
            "slot pelo serial. Solucao validada em 34 chamados."
        ),
        "document_type": "procedimento",
        "category": "raid",
        "technology": ["megaraid"],
        "approved": True,
        "success_score": 0.95,
    },
    {
        "title": "Chamado resolvido: erros 429 SlowDown em uploads S3",
        "content": (
            "Cliente reportou falhas intermitentes de upload multipart com HTTP 429 "
            "SlowDown. Causa confirmada: paralelismo de 64 streams acima do rate limit "
            "do endpoint. Solucao: reduzir concorrencia do rclone para 8 "
            "(--transfers 8 --s3-upload-concurrency 4) e habilitar retry exponencial. "
            "Sem erros apos ajuste; validado com o cliente por 72h."
        ),
        "document_type": "chamado_resolvido",
        "category": "object_storage",
        "technology": ["s3", "rclone"],
        "approved": True,
        "success_score": 0.9,
    },
    {
        "title": "Procedimento: VM nao inicia no Proxmox por storage LVM indisponivel",
        "content": (
            "Verificar 'pvesm status' e 'journalctl -u pvedaemon'. Se storage inactive, "
            "checar multipath e conexao iSCSI/NFS. Reativar com 'pvesm set <storage> "
            "--disable 0' apos corrigir o acesso. Validar 'qm start <vmid>' e conferir "
            "logs da VM. Nao forcar start com storage degradado."
        ),
        "document_type": "procedimento",
        "category": "virtualizacao",
        "technology": ["proxmox"],
        "approved": True,
        "success_score": 0.88,
    },
    {
        "title": "RCA: indisponibilidade por superaquecimento em rack",
        "content": (
            "Incidente: desligamentos inesperados de 3 servidores no mesmo rack. Fatos: "
            "SEL registrou eventos thermal trip; sensores acima de 80C; falha em 2 "
            "ventiladores do rack confirmada fisicamente. Causa raiz: falha de "
            "climatizacao do corredor. Acao corretiva: manutencao do CRAC e alarme de "
            "temperatura no Zabbix. Prevencao: inspecao trimestral."
        ),
        "document_type": "rca",
        "category": "hardware",
        "technology": ["ipmi"],
        "approved": True,
        "success_score": 0.92,
    },
]

DEMO_TICKETS = [
    {
        "title": "RAID degraded no servidor srv-db02 apos alerta do monitoramento",
        "description": (
            "monitoramento alertou virtual disk degraded na controladora megaraid do "
            "srv-db02. storcli mostra pd em failed no slot 4. cliente de producao."
        ),
        "customer": "Cliente Exemplo LTDA",
        "product": "servidor dedicado",
    },
    {
        "title": "Uploads para bucket backup-cliente-a falhando com 429",
        "description": (
            "rclone retorna 429 slowdown ao gravar objetos no bucket backup-cliente-a "
            "via endpoint s3. comecou ontem as 22:00, backup noturno impactado."
        ),
        "customer": "Cliente Exemplo LTDA",
        "product": "object storage",
    },
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed do banco.")
    parser.add_argument("--demo", action="store_true", help="Inclui dados de demonstracao")
    args = parser.parse_args()

    configure_logging()
    settings = get_settings()
    init_db()
    db = SessionLocal()
    try:
        users = UserRepository(db)
        admin = users.get_by_email(settings.admin_email)
        if admin is None:
            password = settings.admin_password or secrets.token_urlsafe(12)
            users.create(
                email=settings.admin_email,
                password_hash=hash_password(password),
                role="admin",
                full_name="Administrador",
            )
            if settings.admin_password:
                logger.info("Admin criado: %s (senha via ADMIN_PASSWORD)", settings.admin_email)
            else:
                # Exibida uma unica vez; nao fica em logs estruturados de producao.
                print(f"\n*** Admin criado: {settings.admin_email} | senha: {password} ***\n")
        else:
            logger.info("Admin ja existe: %s", settings.admin_email)

        if args.demo:
            from app.infrastructure.repositories import TicketRepository
            from app.services.classification import classify_ticket
            from app.services.rag import ingest_document

            for doc in DEMO_DOCUMENTS:
                ingest_document(db, source="seed_demo", **doc)
            tickets = TicketRepository(db)
            for item in DEMO_TICKETS:
                classification = classify_ticket(db, f"{item['title']}\n{item['description']}")
                tickets.create(
                    {
                        **item,
                        "severity": classification["severidade"],
                        "urgency": classification["urgencia"],
                        "impact": classification["impacto"],
                        "category": classification["categoria_principal"],
                        "subcategory": classification["subcategoria"],
                        "assigned_team": classification["equipe_recomendada"],
                    }
                )
            logger.info(
                "Demo: %d documentos e %d tickets SINTETICOS criados",
                len(DEMO_DOCUMENTS), len(DEMO_TICKETS),
            )
    finally:
        db.close()


if __name__ == "__main__":
    main()
