"""Integracao com Obsidian: exporta o conhecimento da plataforma como um
vault de notas Markdown interligadas (o "cerebro"), incluindo a
visualizacao da arquitetura da rede neural.

Todo o modulo e opcional e desacoplado do core da aplicacao: quando
OBSIDIAN_VAULT_PATH nao esta configurado, toda funcao aqui vira um no-op
silencioso — a API nunca depende desta integracao para funcionar.
"""
