# Prompt para o Claude Code local — montar a versão final de "O Relojoeiro"

Troque `[PASTA_DOS_DOWNLOADS]` pelo caminho da pasta com os vídeos baixados do Flow e cole tudo abaixo no Claude Code, dentro de uma pasta de trabalho vazia.

```
Quero montar a versão final do vídeo "O Relojoeiro" (vertical 9:16, 102 s) a partir dos clipes que baixei do Google Flow. O kit de montagem já existe no GitHub.

PASSO 1 — Preparar
- Clone https://github.com/denisvalverde/chatbot_dados_customizados e faça checkout da branch `ccr-00a13776-4zjg3n`.
- Leia videos/relojoeiro/roteiro.md (lista dos 30 planos, com descrição e duração), videos/relojoeiro/montagem/LEIA-ME.md e videos/relojoeiro/montagem/shots.json.
- Confirme que tenho ffmpeg, python3 e numpy; se faltar algo, me diga o comando de instalação antes de continuar.

PASSO 2 — Identificar os clipes
Meus downloads estão em: [PASTA_DOS_DOWNLOADS]
- Os arquivos do Flow NÃO vêm numerados por plano. O nome termina com um id de 8 caracteres (ex.: ..._61e0cc4a) e o mesmo clipe pode aparecer várias vezes (em 720p e em 1080p, ou repetido em downloads diferentes). Agrupe pelo id: use a versão de MAIOR resolução e ignore as cópias.
- Para cada clipe único, extraia quadros com ffmpeg (1 por segundo), OLHE as imagens e compare com a descrição dos planos do roteiro.md para decidir a qual plano ele pertence. Muitos clipes têm tomadas alternativas do mesmo plano; mantenha a melhor (personagens coerentes com os outros planos, cena correta, sem erro visual) e guarde as outras como tomadas reserva.
- Copie para videos/relojoeiro/montagem/clips/ com o nome pNN.mp4 (p01.mp4 ... p30.mp4); reservas como pNN_tomada2.mp4.
- Alguns clipes saem da cena errada (por exemplo, um clipe de rua que começa ou vive no hospital). Se um clipe não corresponde a nenhum plano, não o use e me avise.
- Antes de continuar, me mostre uma tabela: plano → arquivo escolhido → motivo, e a lista de planos SEM clipe. Pode seguir sem esperar minha resposta, mas deixe a tabela no relatório final.

PASSO 3 — Ajustar o início de cada clipe
- O Flow costuma começar o clipe com restos da cena anterior (uma dissolvência de 2 a 3 s). Para cada clipe, ache o primeiro quadro limpo e ponha o campo "ss" (em segundos) do plano em shots.json. Garanta ss + duração do plano <= duração do clipe (~7,9 s).
- Valores já usados com os clipes que gerei antes (ajuste se os seus forem diferentes): plano 2 ss=3.0; plano 3 ss=1.5; plano 5 ss=2.2; plano 6 ss=3.0; plano 7 ss=2.2; plano 14 ss=2.0.
- Se um plano só tiver imagem (p01.jpg, p24.jpg, p29.jpg), o script faz um zoom lento. Se tiver clipe .mp4, o script usa o vídeo.

PASSO 4 — Trilha
- Se existir audio/trilha.mp3 (ou .wav), use. Senão rode `python3 gerar_trilha.py` (gera audio/trilha.wav, trilha-guia de piano e tic de relógio com virada em 67 s e final em 86 s).

PASSO 5 — Montar e conferir
- Rode `python3 montar.py --rascunho` e confira os quadros do começo de cada plano (extraia com ffmpeg e olhe). Corrija ss, escolha de tomada ou duração onde houver restos de outra cena, saltos ou erro visual.
- Rode `python3 montar.py` para a exportação final em 1080x1920 (saida_final.mp4). Confirme: 102 s, 1080x1920, 30 fps, legendas acima da zona de interface do TikTok, música abaixando nos planos 23 a 26.

PASSO 6 — Relatório
Entregue: o caminho do saida_final.mp4; a tabela plano → arquivo; os planos ainda sem clipe (aparecem como cartão "Pxx sem clipe"); e o que destoa do resto (estilo 2D vs 3D, rosto da Lia que muda entre planos, watermark ou texto no vídeo), por número de plano, para eu decidir o que refazer.

REGRAS
- Não invente nem finja cenas que faltam: plano sem clipe fica como cartão e vai para o relatório.
- Não suba os vídeos para nenhum serviço e não faça commit de arquivos .mp4 (estão no .gitignore).
- Não altere roteiro.md nem prompts_flow.md.
```
