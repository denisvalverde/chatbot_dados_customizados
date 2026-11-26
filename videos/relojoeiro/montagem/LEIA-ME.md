# Montagem do vídeo "O Relojoeiro"

Kit para transformar os clipes gerados por IA (um por plano) no vídeo final 9:16 de ~102 s:
cortes nas durações, legendas, música (com volume que cai na virada) e exportação.

## Requisitos
- `ffmpeg` com libass e freetype (padrão em Linux/Mac). Python 3.9+.

## Passo a passo
1. **Gere os clipes** seguindo `../roteiro.md` e salve em `clips/` com o número do plano:
   `p01.mp4`, `p02.mp4` ... `p30.mp4`.
   - Várias tomadas do mesmo plano: `p07_tomada1.mp4`, `p07_tomada2.mp4` (o script usa a primeira em ordem alfabética; renomeie a escolhida para `p07.mp4`).
   - Aceita `.mp4 .mov .webm` e também imagem (`.jpg .png`), que vira zoom lento.
   - Clipe mais **curto** que o plano: congela o último quadro. Mais **longo**: usa o começo. Para pular o início, ponha `"ss": 1.5` no plano em `shots.json`.
2. **Música:** salve em `audio/trilha.mp3` (pode ser `.wav`/`.m4a`). Ela entra em fade, repete se for curta, abaixa nos planos 23 a 26 (a virada) e termina em fade.
3. **Voz (opcional):** `audio/voz.mp3`, já sincronizada com o vídeo.
4. **Prévia rápida:** `python3 montar.py --rascunho` gera `saida_rascunho.mp4` em 540x960.
5. **Final:** `python3 montar.py` gera `saida_final.mp4` em 1080x1920, 30 fps.

Planos sem clipe aparecem como cartão escuro "Pxx sem clipe". Dá para montar e conferir o ritmo mesmo com o vídeo incompleto; o script lista no fim o que ainda falta.

## Ajustes em `shots.json`
- `planos[].dur`: duração de cada plano. `planos[].caption`: legenda (vazio = sem legenda).
- `musica.volume`, `fade_in`, `fade_out`, `abaixar_planos` e `ganho_abaixado`.
- `legenda.fonte` (no Mac/Windows use `Arial`), `tamanho` e `margem_inferior`. A margem de 330 mantém o texto acima da área de interface do TikTok.

## Opções do script
`--rascunho`, `--sem-legendas`, `--clips PASTA`, `--musica ARQ`, `--voz ARQ`, `--saida ARQ`, `--manifesto ARQ`.

## Observação
`clips/`, `audio/` e `saida_*.mp4` estão no `.gitignore` (arquivos pesados). Guarde-os fora do Git.
