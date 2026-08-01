"""Rede neural MLP para classificacao multiclasse de texto vetorizado.

Justificativa da arquitetura: com entradas TF-IDF (vetores esparsos de alta
dimensao), um MLP raso com regularizacao forte (dropout + weight decay +
batch normalization) atinge excelente desempenho em classificacao de textos
curtos, com custo de treino/inferencia muito menor que transformers ou RNNs.
"""

from __future__ import annotations

import torch
from torch import nn


class MLPClassifier(nn.Module):
    """MLP configuravel: [input] -> hidden_dims -> [num_classes] (logits)."""

    def __init__(
        self,
        input_dim: int,
        num_classes: int,
        hidden_dims: list[int] | None = None,
        dropout: float = 0.3,
        batch_norm: bool = True,
    ) -> None:
        super().__init__()
        if input_dim < 1 or num_classes < 2:
            raise ValueError(
                f"Dimensoes invalidas: input_dim={input_dim}, num_classes={num_classes}"
            )
        hidden_dims = hidden_dims or [256, 128]
        self.input_dim = input_dim
        self.num_classes = num_classes

        layers: list[nn.Module] = []
        previous = input_dim
        for hidden in hidden_dims:
            layers.append(nn.Linear(previous, hidden))
            if batch_norm:
                layers.append(nn.BatchNorm1d(hidden))
            layers.append(nn.ReLU())
            layers.append(nn.Dropout(dropout))
            previous = hidden
        layers.append(nn.Linear(previous, num_classes))
        self.network = nn.Sequential(*layers)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Retorna os logits (sem softmax; CrossEntropyLoss aplica log-softmax)."""
        return self.network(x)

    @torch.no_grad()
    def predict_proba(self, x: torch.Tensor) -> torch.Tensor:
        """Retorna probabilidades por classe via softmax."""
        self.eval()
        return torch.softmax(self.forward(x), dim=-1)
