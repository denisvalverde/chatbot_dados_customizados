"""Introspeccao da rede neural real -> diagrama Mermaid (secao 2.4a do prompt).

Nunca hardcoda numeros de camadas: le a estrutura do checkpoint/instancia
real do MultiHeadTicketClassifier, para o diagrama nunca ficar desatualizado
se a arquitetura mudar.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import torch

from app.core.exceptions import ModelNotReadyError
from app.ml.network import MultiHeadTicketClassifier


def load_model_from_checkpoint(path: str | Path) -> tuple[MultiHeadTicketClassifier, dict[str, Any]]:
    """Carrega um checkpoint apenas para fins de introspeccao/visualizacao.

    Nao valida compatibilidade de embedder (diferente de NeuralPredictor):
    aqui so nos interessa a ARQUITETURA salva, nao rodar inferencia real.
    """
    checkpoint_path = Path(path)
    if not checkpoint_path.exists():
        raise ModelNotReadyError(f"Checkpoint nao encontrado: {checkpoint_path}")
    state = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    # deriva a dimensao oculta real dos pesos salvos, em vez de assumir o
    # padrao da classe — a visualizacao deve refletir o checkpoint real
    # mesmo que ele tenha sido treinado com um hidden_dim customizado.
    hidden_dim = int(state["state_dict"]["trunk.0.weight"].shape[0])
    model = MultiHeadTicketClassifier(
        input_dim=state["input_dim"], head_sizes=state["head_sizes"], hidden_dim=hidden_dim
    )
    model.load_state_dict(state["state_dict"])
    model.eval()
    return model, state


def count_parameters(model: MultiHeadTicketClassifier) -> int:
    """Total de parametros treinaveis (mesma logica usada no neural-network standalone)."""
    return sum(p.numel() for p in model.parameters() if p.requires_grad)


def hidden_dim_of(model: MultiHeadTicketClassifier) -> int:
    """Le a dimensao oculta a partir da primeira camada Linear real do tronco."""
    first_linear = model.trunk[0]
    return int(first_linear.out_features)


def generate_network_mermaid(model: MultiHeadTicketClassifier) -> str:
    """Gera um diagrama Mermaid (graph LR) por introspeccao do modelo real."""
    hidden_dim = hidden_dim_of(model)
    dropout = model.trunk[3].p  # nn.Dropout na posicao 3 do tronco
    total_params = count_parameters(model)

    lines = [
        "```mermaid",
        "graph LR",
        f'    IN["Entrada<br/>{model.input_dim} neuronios<br/>(embedding do texto)"]',
        f'    L1["Linear<br/>{model.input_dim} -> {hidden_dim}"]',
        f'    LN1["LayerNorm({hidden_dim})"]',
        '    ACT1["GELU"]',
        f'    DROP1["Dropout({dropout})"]',
        f'    RES["ResidualBlock({hidden_dim})<br/>x + Linear-LayerNorm-GELU-Dropout"]',
        "    IN --> L1 --> LN1 --> ACT1 --> DROP1 --> RES",
    ]
    for name in model.MULTICLASS_HEADS:
        size = model.head_sizes[name]
        node_id = f"H_{name}"
        lines.append(f'    RES --> {node_id}["{name}<br/>{hidden_dim} -> {size}<br/>(softmax)"]')
    ml_name = model.MULTILABEL_HEAD
    ml_size = model.head_sizes[ml_name]
    lines.append(
        f'    RES --> H_{ml_name}["{ml_name}<br/>{hidden_dim} -> {ml_size}<br/>(sigmoid, multilabel)"]'
    )
    lines.append("```")

    total_params_br = f"{total_params:,}".replace(",", ".")
    header = (
        f"**{total_params_br}** parametros treinaveis "
        f"(dimensao de entrada {model.input_dim}, camada oculta {hidden_dim})."
    )
    return header + "\n\n" + "\n".join(lines)
