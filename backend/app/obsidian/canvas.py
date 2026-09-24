"""Geracao do arquivo .canvas (formato JSON nativo do Obsidian Canvas)
para a arquitetura da rede neural (secao 2.4b do prompt).

Formato: https://jsoncanvas.org/ (adotado pelo Obsidian Canvas desde a v1.1).
Gerado por introspeccao do modelo real — mesma fonte de verdade do Mermaid.
"""

from __future__ import annotations

from typing import Any

from app.ml.network import MultiHeadTicketClassifier
from app.obsidian.mermaid import count_parameters, hidden_dim_of

_COLOR_INPUT = "5"    # ciano
_COLOR_TRUNK = "6"    # roxo
_COLOR_HEAD = "4"     # verde
_COLOR_INFO = "1"     # vermelho/laranja (nota informativa)

_NODE_W, _NODE_H = 240, 90
_COL_GAP, _ROW_GAP = 320, 130


def generate_network_canvas(
    model: MultiHeadTicketClassifier, onnx_path: str = ""
) -> dict[str, Any]:
    """Monta o grafo de nos/arestas do Canvas a partir do modelo real."""
    hidden_dim = hidden_dim_of(model)
    total_params = count_parameters(model)
    heads = list(model.MULTICLASS_HEADS) + [model.MULTILABEL_HEAD]

    nodes: list[dict[str, Any]] = [
        {
            "id": "input", "type": "text", "x": 0, "y": 0,
            "width": _NODE_W, "height": _NODE_H, "color": _COLOR_INPUT,
            "text": f"**Entrada**\n{model.input_dim} neuronios\n(embedding do texto)",
        },
        {
            "id": "trunk", "type": "text", "x": _COL_GAP, "y": 0,
            "width": _NODE_W, "height": _NODE_H, "color": _COLOR_TRUNK,
            "text": (
                f"**Tronco compartilhado**\nLinear({model.input_dim}->{hidden_dim})\n"
                f"LayerNorm -> GELU -> Dropout\n+ ResidualBlock({hidden_dim})"
            ),
        },
    ]
    edges: list[dict[str, Any]] = [
        {"id": "e-input-trunk", "fromNode": "input", "fromSide": "right",
         "toNode": "trunk", "toSide": "left"},
    ]

    top = -((len(heads) - 1) * _ROW_GAP) / 2
    for index, head_name in enumerate(heads):
        node_id = f"head-{head_name}"
        size = model.head_sizes[head_name]
        kind = "multilabel/sigmoid" if head_name == model.MULTILABEL_HEAD else "multiclasse/softmax"
        nodes.append(
            {
                "id": node_id, "type": "text",
                "x": 2 * _COL_GAP, "y": top + index * _ROW_GAP,
                "width": _NODE_W, "height": _NODE_H, "color": _COLOR_HEAD,
                "text": f"**{head_name}**\n{hidden_dim} -> {size}\n({kind})",
            }
        )
        edges.append(
            {"id": f"e-trunk-{head_name}", "fromNode": "trunk", "fromSide": "right",
             "toNode": node_id, "toSide": "left"}
        )

    info_text = (
        f"**{total_params:,}** parametros treinaveis.".replace(",", ".")
        + "\n\nArquitetura gerada automaticamente por introspecao do checkpoint."
    )
    if onnx_path:
        info_text += (
            f"\n\nModelo exportado em ONNX:\n`{onnx_path}`\n\n"
            "Abra em https://netron.app para inspecionar os pesos reais."
        )
    nodes.append(
        {
            "id": "info", "type": "text",
            "x": _COL_GAP // 2, "y": _NODE_H + 60,
            "width": _NODE_W * 2, "height": _NODE_H + 20, "color": _COLOR_INFO,
            "text": info_text,
        }
    )

    return {"nodes": nodes, "edges": edges}
