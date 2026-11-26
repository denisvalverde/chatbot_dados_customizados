#!/usr/bin/env python3
"""Monta o vídeo "O Relojoeiro" a partir dos clipes gerados por IA.

Uso rápido:
    python3 montar.py --rascunho          # prévia leve (540x960)
    python3 montar.py                     # exportação final (1080x1920)

Convenções:
  * clipes em  clips/p01.mp4 ... p30.mp4  (também aceita p07_tomada2.mp4, .mov, .webm,
    ou imagem .jpg/.png, que vira zoom lento)
  * música em  audio/trilha.mp3 (ou .wav/.m4a)  e voz opcional em audio/voz.mp3
  * durações e legendas vêm de shots.json
Plano sem clipe vira um cartão escuro "Pxx sem clipe", para você ver o ritmo já na primeira montagem.
"""
import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
VIDEO_EXT = {".mp4", ".mov", ".webm", ".mkv", ".m4v"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}
AUDIO_EXT = [".mp3", ".wav", ".m4a", ".aac", ".ogg"]
FONT_FILES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
]


def run(cmd, cwd=None):
    r = subprocess.run([str(c) for c in cmd], capture_output=True, text=True, cwd=cwd)
    if r.returncode:
        sys.exit("ffmpeg falhou:\n" + " ".join(str(c) for c in cmd) + "\n" + r.stderr[-2500:])


def achar_clipe(pasta: Path, n: int):
    base = f"p{n:02d}"
    candidatos = sorted(
        p for p in pasta.glob(base + "*")
        if (p.stem == base or p.stem.startswith(base + "_")) and p.suffix.lower() in VIDEO_EXT | IMAGE_EXT
    )
    # prefere vídeo a imagem; entre vídeos, ordem alfabética (p07.mp4 antes de p07_tomada2.mp4)
    candidatos.sort(key=lambda p: (p.suffix.lower() in IMAGE_EXT, p.stem != base, p.name))
    return candidatos[0] if candidatos else None


def achar_audio(pasta: Path, nome: str):
    for ext in AUDIO_EXT:
        p = pasta / (nome + ext)
        if p.exists():
            return p
    return None


def ass_tempo(s: float) -> str:
    cs = int(round(s * 100))
    return f"{cs // 360000}:{(cs // 6000) % 60:02d}:{(cs // 100) % 60:02d}.{cs % 100:02d}"


def gerar_ass(planos, cfg_leg, largura, altura, destino: Path):
    cab = (
        "[Script Info]\nScriptType: v4.00+\nWrapStyle: 0\n"
        f"PlayResX: {largura}\nPlayResY: {altura}\n\n"
        "[V4+ Styles]\n"
        "Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,"
        "Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\n"
        f"Style: Default,{cfg_leg['fonte']},{cfg_leg['tamanho']},&H00FFFFFF,&H000000FF,&H00000000,&H90000000,"
        f"-1,0,0,0,100,100,0,0,1,4,2,2,90,90,{cfg_leg['margem_inferior']},1\n\n"
        "[Events]\nFormat: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n"
    )
    linhas, t = [], 0.0
    for p in planos:
        if p.get("caption"):
            texto = p["caption"].replace("\n", "\\N")
            linhas.append(
                f"Dialogue: 0,{ass_tempo(t + 0.15)},{ass_tempo(t + p['dur'] - 0.1)},Default,,0,0,0,,"
                f"{{\\fad(250,250)}}{texto}\n"
            )
        t += p["dur"]
    destino.write_text(cab + "".join(linhas), encoding="utf-8")


def segmento(plano, clipe, largura, altura, fps, destino: Path, fonte_arquivo):
    n, dur = plano["id"], plano["dur"]
    comum = f"scale={largura}:{altura}:force_original_aspect_ratio=increase,crop={largura}:{altura},setsar=1,fps={fps},format=yuv420p"
    saida = ["-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "17", "-pix_fmt", "yuv420p", "-r", str(fps), destino]
    if clipe is None:
        txt = ""
        if fonte_arquivo:
            fonte = fonte_arquivo.replace(":", "\\:")
            txt = f",drawtext=fontfile='{fonte}':text='P{n:02d} sem clipe':fontcolor=white@0.6:fontsize={largura // 9}:x=(w-text_w)/2:y=h*0.15"
        run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"color=c=0x0b1a24:s={largura}x{altura}:r={fps}:d={dur}",
             "-vf", "format=yuv420p" + txt, "-t", dur] + saida)
    elif clipe.suffix.lower() in IMAGE_EXT:
        gx, gy = int(largura * 1.5) // 2 * 2, int(altura * 1.5) // 2 * 2
        zoom = (f"scale={gx}:{gy}:force_original_aspect_ratio=increase,crop={gx}:{gy},"
                f"zoompan=z='min(1+0.0006*on,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={largura}x{altura}:fps={fps},"
                "setsar=1,format=yuv420p")
        run(["ffmpeg", "-y", "-v", "error", "-loop", "1", "-framerate", fps, "-i", clipe, "-vf", zoom, "-t", dur] + saida)
    else:
        ss = plano.get("ss", 0)
        # tpad congela o último quadro se o clipe for mais curto que o plano
        run(["ffmpeg", "-y", "-v", "error", "-ss", ss, "-i", clipe,
             "-vf", comum + ",tpad=stop_mode=clone:stop_duration=10", "-t", dur] + saida)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--clips", default=str(HERE / "clips"))
    ap.add_argument("--musica", default=None, help="arquivo de música (padrão: audio/trilha.*)")
    ap.add_argument("--voz", default=None, help="arquivo de voz (padrão: audio/voz.*, opcional)")
    ap.add_argument("--saida", default=None)
    ap.add_argument("--rascunho", action="store_true", help="exporta em 540x960, mais rápido")
    ap.add_argument("--sem-legendas", action="store_true")
    ap.add_argument("--manifesto", default=str(HERE / "shots.json"))
    a = ap.parse_args()

    if not shutil.which("ffmpeg"):
        sys.exit("ffmpeg não encontrado. Instale com: apt install ffmpeg | brew install ffmpeg")

    cfg = json.loads(Path(a.manifesto).read_text(encoding="utf-8"))
    planos = cfg["planos"]
    fps = cfg["fps"]
    escala = 0.5 if a.rascunho else 1.0
    largura, altura = int(cfg["largura"] * escala), int(cfg["altura"] * escala)
    total = sum(p["dur"] for p in planos)
    saida = Path(a.saida) if a.saida else HERE / ("saida_rascunho.mp4" if a.rascunho else "saida_final.mp4")
    clips_dir = Path(a.clips)
    fonte_arquivo = next((f for f in FONT_FILES if Path(f).exists()), None)

    musica = Path(a.musica) if a.musica else achar_audio(HERE / "audio", "trilha")
    voz = Path(a.voz) if a.voz else achar_audio(HERE / "audio", "voz")

    faltando = []
    with tempfile.TemporaryDirectory(prefix="relojoeiro_") as tmp_s:
        tmp = Path(tmp_s)
        lista = []
        for p in planos:
            clipe = achar_clipe(clips_dir, p["id"])
            if clipe is None:
                faltando.append(p["id"])
            seg = tmp / f"seg{p['id']:02d}.mp4"
            segmento(p, clipe, largura, altura, fps, seg, fonte_arquivo)
            lista.append(f"file '{seg}'\n")
            print(f"  plano {p['id']:02d} ({p['dur']}s) <- {clipe.name if clipe else 'SEM CLIPE'}")
        (tmp / "lista.txt").write_text("".join(lista))

        cmd = ["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", "lista.txt"]
        filtros = []
        vlabel = "0:v"
        if not a.sem_legendas and any(p.get("caption") for p in planos):
            # a grade do ASS é sempre a final (1080x1920); o filtro escala para o rascunho
            gerar_ass(planos, cfg["legenda"], cfg["largura"], cfg["altura"], tmp / "legendas.ass")
            filtros.append("[0:v]ass=legendas.ass[v]")
            vlabel = "v"

        idx, rotulos = 1, []
        m = cfg["musica"]
        if musica:
            cmd += ["-stream_loop", "-1", "-i", musica]
            ini = sum(p["dur"] for p in planos if p["id"] < m["abaixar_planos"][0])
            fim = sum(p["dur"] for p in planos if p["id"] <= m["abaixar_planos"][1])
            filtros.append(
                f"[{idx}:a]atrim=0:{total},asetpts=PTS-STARTPTS,volume={m['volume']},"
                f"volume='if(between(t,{ini},{fim}),{m['ganho_abaixado']},1)':eval=frame,"
                f"afade=t=in:d={m['fade_in']},afade=t=out:st={total - m['fade_out']}:d={m['fade_out']}[mus]"
            )
            rotulos.append("[mus]")
            idx += 1
        if voz:
            cmd += ["-i", voz]
            filtros.append(f"[{idx}:a]atrim=0:{total},asetpts=PTS-STARTPTS[vo]")
            rotulos.append("[vo]")
            idx += 1
        if len(rotulos) == 2:
            filtros.append("[mus][vo]amix=inputs=2:normalize=0[a]")
            alabel = "[a]"
        elif rotulos:
            alabel = rotulos[0]
        else:
            alabel = None
            print("  (aviso) sem música em audio/trilha.* — o vídeo sai mudo")

        if filtros:
            cmd += ["-filter_complex", ";".join(filtros)]
        cmd += ["-map", f"[{vlabel}]" if vlabel == "v" else "0:v"]
        if alabel:
            cmd += ["-map", alabel, "-c:a", "aac", "-b:a", "192k"]
        cmd += ["-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p",
                "-movflags", "+faststart", "-t", total, saida.resolve()]
        run(cmd, cwd=tmp)

    print(f"\nPronto: {saida}  ({largura}x{altura}, {total}s)")
    if faltando:
        print("Planos ainda sem clipe:", ", ".join(f"P{n:02d}" for n in faltando))


if __name__ == "__main__":
    main()
