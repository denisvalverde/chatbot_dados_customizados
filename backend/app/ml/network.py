"""Rede neural multi-head para classificacao de chamados (secao 4.2).

Arquitetura (conforme especificacao):
    Embedding textual -> Linear -> LayerNorm -> GELU -> Dropout
        -> Residual Block -> cabecas: categoria, subcategoria, severidade,
           equipe, risco (multiclasse) + tecnologias (multilabel).
"""

from __future__ import annotations

import torch
from torch import nn


class ResidualBlock(nn.Module):
    """Bloco residual: x + f(x) com LayerNorm/GELU/Dropout."""

    def __init__(self, dim: int, dropout: float) -> None:
        super().__init__()
        self.block = nn.Sequential(
            nn.Linear(dim, dim),
            nn.LayerNorm(dim),
            nn.GELU(),
            nn.Dropout(dropout),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x + self.block(x)


class MultiHeadTicketClassifier(nn.Module):
    """Tronco compartilhado + cabecas por tarefa."""

    MULTICLASS_HEADS = ("categoria", "subcategoria", "severidade", "equipe", "risco")
    MULTILABEL_HEAD = "tecnologias"

    def __init__(
        self,
        input_dim: int,
        head_sizes: dict[str, int],
        hidden_dim: int = 256,
        dropout: float = 0.2,
    ) -> None:
        super().__init__()
        missing = set(self.MULTICLASS_HEADS) | {self.MULTILABEL_HEAD}
        missing -= set(head_sizes)
        if missing:
            raise ValueError(f"head_sizes incompleto; faltam: {sorted(missing)}")
        self.input_dim = input_dim
        self.head_sizes = dict(head_sizes)
        self.trunk = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            ResidualBlock(hidden_dim, dropout),
        )
        self.heads = nn.ModuleDict(
            {name: nn.Linear(hidden_dim, size) for name, size in head_sizes.items()}
        )

    def forward(self, x: torch.Tensor) -> dict[str, torch.Tensor]:
        """Retorna logits por cabeca."""
        features = self.trunk(x)
        return {name: head(features) for name, head in self.heads.items()}

    @torch.no_grad()
    def predict(self, x: torch.Tensor) -> dict[str, torch.Tensor]:
        """Probabilidades: softmax nas multiclasse, sigmoid na multilabel."""
        self.eval()
        logits = self.forward(x)
        output: dict[str, torch.Tensor] = {}
        for name in self.MULTICLASS_HEADS:
            output[name] = torch.softmax(logits[name], dim=-1)
        output[self.MULTILABEL_HEAD] = torch.sigmoid(logits[self.MULTILABEL_HEAD])
        return output


class OnnxWrapper(nn.Module):
    """Envelopa o modelo para exportar saidas em tupla ordenada (ONNX)."""

    def __init__(self, model: MultiHeadTicketClassifier) -> None:
        super().__init__()
        self.model = model
        self.order = list(model.MULTICLASS_HEADS) + [model.MULTILABEL_HEAD]

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, ...]:
        logits = self.model(x)
        return tuple(logits[name] for name in self.order)
