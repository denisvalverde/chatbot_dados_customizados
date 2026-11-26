#!/usr/bin/env python3
"""Sintetiza uma trilha de apoio para "O Relojoeiro" (piano + tic de relógio), sincronizada com shots.json.

Estrutura (segue os atos do roteiro):
  Ato 1  planos 1-7    tic lento + notas esparsas de piano (Lá menor), misterioso
  Ato 2  planos 8-21   arpejo constante; cada presente (planos 9,11,13,14,16,18) ganha um sino âmbar
  Ato 3  planos 22-26  só o tic e um grave suave: o silêncio que "dói"
  Ato 4  planos 27-30  acordes cheios e crescendo (Dó maior), tics em coro, final sustentado

É uma trilha-guia gerada por código. Para o resultado final, substitua por uma trilha feita em
Suno/ElevenLabs Music, mantendo os mesmos pontos de virada (veja os tempos impressos).

Uso: python3 gerar_trilha.py            -> audio/trilha.wav
"""
import json
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
SR = 44100


def nota_hz(nome):
    nomes = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
    n, o = nome[:-1], int(nome[-1])
    semi = nomes[n[0]] + (1 if "#" in n else 0)
    return 440.0 * 2 ** ((semi - 9 + 12 * (o - 4)) / 12)


def piano(freq, dur, vel=1.0):
    t = np.arange(int(SR * dur)) / SR
    y = np.zeros_like(t)
    for h in range(1, 8):
        y += (1.0 / h ** 1.3) * np.sin(2 * np.pi * freq * h * (1 + 0.0004 * h * h) * t)
    env = np.exp(-t / (0.35 + 1.4 / (1 + freq / 220))) * (1 - np.exp(-t / 0.004))
    return y * env * vel * 0.3


def pad(freq, dur, vel=1.0):
    t = np.arange(int(SR * dur)) / SR
    y = sum(np.sin(2 * np.pi * freq * k * t + k) / k for k in (1, 2, 3)) * 0.2
    env = np.minimum(t / 1.6, 1) * np.minimum((dur - t) / 1.6, 1)
    return y * env * vel


def tic(alto=True, vel=1.0):
    n = int(SR * 0.06)
    t = np.arange(n) / SR
    f = 2100 if alto else 1500
    y = (np.sin(2 * np.pi * f * t) * 0.6 + np.random.RandomState(7).randn(n) * 0.25) * np.exp(-t / 0.008)
    return y * vel * 0.5


def sino(freq, dur=2.5, vel=1.0):
    t = np.arange(int(SR * dur)) / SR
    y = sum(a * np.sin(2 * np.pi * freq * m * t) for m, a in ((1, 1), (2.76, 0.4), (5.4, 0.15)))
    return y * np.exp(-t / 0.9) * (1 - np.exp(-t / 0.003)) * vel * 0.18


def main():
    cfg = json.loads((HERE / "shots.json").read_text(encoding="utf-8"))
    durs = {p["id"]: p["dur"] for p in cfg["planos"]}
    inicio = {}
    acc = 0.0
    for i in sorted(durs):
        inicio[i] = acc
        acc += durs[i]
    total = acc
    buf = np.zeros((int(SR * (total + 4)), 2))

    def mix(sinal, t0, pan=0.5, g=1.0):
        i = int(t0 * SR)
        n = min(len(sinal), len(buf) - i)
        if n <= 0:
            return
        buf[i:i + n, 0] += sinal[:n] * g * (1 - pan) * 1.4
        buf[i:i + n, 1] += sinal[:n] * g * pan * 1.4

    # tic-tac a cada segundo; some na virada e volta em coro
    t_ato3, t_ato4 = inicio[22], inicio[27]
    for s in range(int(total)):
        g = 0.5
        if t_ato3 <= s < t_ato4:
            g = 0.35
        if s >= t_ato4:
            g = 0.7 + 0.5 * (s - t_ato4) / (total - t_ato4)
        if s < 2:
            g = 0.3
        mix(tic(s % 2 == 0), s, 0.5, g)

    acordes = {  # (baixo, tríade em arpejo)
        "Am": ("A2", ["A3", "C4", "E4", "A4", "E4", "C4"]),
        "F": ("F2", ["F3", "A3", "C4", "F4", "C4", "A3"]),
        "C": ("C3", ["C4", "E4", "G4", "C5", "G4", "E4"]),
        "G": ("G2", ["G3", "B3", "D4", "G4", "D4", "B3"]),
    }
    prog = ["Am", "F", "C", "G"]

    # Ato 1: notas esparsas
    t = 0.5
    k = 0
    while t < inicio[8]:
        c = prog[(k // 2) % 4]
        mix(piano(nota_hz(acordes[c][1][k % 3 + 1]), 3.0, 0.7), t, 0.4)
        if k % 4 == 0:
            mix(piano(nota_hz(acordes[c][0]), 4.0, 0.8), t, 0.5)
        t += 2.0
        k += 1

    # Ato 2: arpejo, ganhando intensidade
    t, k = inicio[8], 0
    while t < inicio[22] - 0.01:
        compasso = int((t - inicio[8]) // 3.0)
        c = prog[compasso % 4]
        nota = acordes[c][1][k % 6]
        prog_i = (t - inicio[8]) / (inicio[22] - inicio[8])
        mix(piano(nota_hz(nota), 1.6, 0.55 + 0.5 * prog_i), t, 0.3 + 0.4 * ((k % 6) / 5))
        if k % 6 == 0:
            mix(piano(nota_hz(acordes[c][0]), 3.0, 0.9), t, 0.5)
        t += 0.5
        k += 1
    for p in (9, 11, 13, 14, 16, 18):  # presentes: sino âmbar
        for j, n in enumerate(("E5", "B5", "G5")):
            mix(sino(nota_hz(n)), inicio[p] + 0.15 + 0.12 * j, 0.6, 0.9)
    mix(piano(nota_hz("D5"), 4, 0.5), inicio[17], 0.5)  # plantio da virada: nota solitária e dissonante
    mix(piano(nota_hz("G#4"), 4, 0.35), inicio[17] + 0.2, 0.4)

    # Ato 3: só grave suave + uma nota a cada 4 s
    mix(pad(nota_hz("A2"), inicio[27] - inicio[22] + 2, 0.5), inicio[22], 0.5)
    for j, n in enumerate(("E4", "A3", "C4", "A3")):
        mix(piano(nota_hz(n), 4.5, 0.4), inicio[22] + 1 + 4 * j, 0.5)

    # Ato 4: acordes cheios, crescendo
    ordem = ["C", "G", "Am", "F"]
    for j, c in enumerate(ordem):
        t0 = inicio[27] + 4 * j
        baixo, arp = acordes[c]
        for n in arp[:3] + [arp[3]]:
            mix(pad(nota_hz(n), 4.5, 0.7 + 0.2 * j), t0, 0.5)
        mix(piano(nota_hz(baixo), 4, 1.0), t0, 0.5)
        for q in range(8):
            mix(piano(nota_hz(arp[q % 6]), 1.4, 0.8 + 0.1 * j), t0 + q * 0.5, 0.25 + 0.5 * (q % 2))
    for j, n in enumerate(("C4", "E4", "G4", "C5")):
        mix(pad(nota_hz(n), 6, 0.9), total - 4, 0.5)

    buf = buf[: int(SR * total)]
    buf /= max(1e-9, np.abs(buf).max()) / 0.85
    saida = HERE / "audio" / "trilha.wav"
    saida.parent.mkdir(exist_ok=True)
    with wave.open(str(saida), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((buf * 32767).astype("<i2").tobytes())
    print(f"Trilha: {saida}  ({total:.0f}s)")
    print(f"Pontos de virada: presentes {[round(inicio[p], 1) for p in (9, 11, 13, 14, 16, 18)]}, "
          f"plantio {inicio[17]}s, silêncio {inicio[22]}s, crescendo {inicio[27]}s")


if __name__ == "__main__":
    main()
