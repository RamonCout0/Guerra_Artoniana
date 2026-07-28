#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Vetoriza o mapa raster de Arton: lê a imagem, classifica cada célula em
água / planície / deserto / floresta / montanha / Tormenta, extrai os
contornos por marching squares, simplifica, suaviza e cospe caminhos SVG.

Saída: publico/js/geografia-arton.js
"""

import colorsys, json, math, sys
from PIL import Image

import os
RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORIGEM = os.path.join(RAIZ, "ferramentas", "mapa-origem-1410.png")
DESTINO = os.path.join(RAIZ, "publico", "js", "geografia-arton.js")

LARGURA_VB = 1000.0
COLUNAS = 660                      # resolução da grade de classificação

# ---------------------------------------------------------------------------
# 1. Carrega e monta a grade
# ---------------------------------------------------------------------------

img = Image.open(ORIGEM).convert("RGB")
LARG_PX, ALT_PX = img.size
ALTURA_VB = LARGURA_VB * ALT_PX / LARG_PX
LINHAS = int(round(COLUNAS * ALT_PX / LARG_PX))

# reduz com média de área — suaviza texturas e hachuras do mapa
pequena = img.resize((COLUNAS, LINHAS), Image.BOX)
px = pequena.load()

def para_vb(cx, cy):
    """célula da grade -> coordenada de viewBox"""
    return (cx * LARGURA_VB / COLUNAS, cy * ALTURA_VB / LINHAS)

# Caixas de legenda, moldura e arte da prancha. O que cai aqui não é
# terreno — é desenho. Cada caixa declara com que terreno preencher,
# escolhido conforme o que a prancha cobre naquele ponto. Difundir a
# partir da borda produzia listras horríveis; declarar é mais honesto.
AGUA, PLANICIE, DESERTO, FLORESTA, MONTANHA, TORMENTA = range(6)

# Cada caixa diz de que lado puxar o terreno. Preencher por continuação
# ("o que havia acima segue descendo") não deixa emenda; declarar uma cor
# fixa desenhava um retângulo visível no meio do mar.
#   'cima'     = copia da célula de cima      (continua para baixo)
#   'baixo'    = copia da célula de baixo     (continua para cima)
#   'esquerda' = copia da célula da esquerda  (continua para a direita)
#   'perto'    = pega o válido mais próximo em qualquer direção
CAIXAS_VB = [
    # sobre o oceano: declarar água some com a emenda, porque a volta toda
    # também é água. Puxar da vizinhança arrastava a costa para dentro do mar.
    (800, 383, 996, 664, AGUA),        # quadro "Aventurando-se"
    (711, 656, 996, 797, AGUA),        # quadro "Voando ou Navegando"
    (  0, 794, 232, 851, AGUA),        # canto sudoeste da faixa, sobre o Mar de Flok

    # sobre terra firme: continuar o terreno vizinho
    (352,   4, 568, 186, 'baixo'),     # título ARTON, brasão e rosa dos ventos
    (566,   4, 792, 120, 'baixo'),     # arte decorativa do topo
    ( 14,   8, 212, 112, 'baixo'),     # tabela de transportes, sobre Vannestuir
    (786,   4, 996, 120, 'baixo'),     # rotas náuticas, sobre as Sanguinárias
    (232, 794,1000, 851, 'cima'),      # faixa dos créditos

    (  0,   0,1000,  10, 'perto'),     # molduras
    (  0, 843,1000, 851, 'perto'),
    (  0,   0,  13, 851, 'perto'),
    (987,   0,1000, 851, 'perto'),
]

def regra_da_caixa(vx, vy):
    """Devolve um terreno fixo (int) ou uma direção de continuação (str)."""
    for x0, y0, x1, y1, regra in CAIXAS_VB:
        if x0 <= vx <= x1 and y0 <= vy <= y1:
            return regra
    return None

# ---------------------------------------------------------------------------
# 2. Classificação por cor
# ---------------------------------------------------------------------------

AGUA, PLANICIE, DESERTO, FLORESTA, MONTANHA, TORMENTA = range(6)
NOMES = {AGUA: "agua", PLANICIE: "planicie", DESERTO: "deserto",
         FLORESTA: "floresta", MONTANHA: "montanha", TORMENTA: "tormenta"}

def classificar(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255.0, g / 255.0, b / 255.0)
    grau = h * 360.0

    # A Tempestade Rubra: vermelho forte e inconfundível
    if s > 0.50 and v > 0.30 and (grau < 22 or grau > 340):
        return TORMENTA
    # Serras: pedra e gelo quase sem cor
    if s < 0.17:
        return MONTANHA
    # Mares: ciano e azul
    if 150 <= grau <= 255:
        return AGUA
    # Areia: amarelo claro
    if 40 <= grau <= 62 and v > 0.72:
        return DESERTO
    # Mata fechada: verde escuro
    if 62 <= grau <= 130 and v < 0.56:
        return FLORESTA
    return PLANICIE

grade = [[None] * COLUNAS for _ in range(LINHAS)]
inventado = [[None] * COLUNAS for _ in range(LINHAS)]    # direção da caixa, se houver
for cy in range(LINHAS):
    for cx in range(COLUNAS):
        vx, vy = para_vb(cx + 0.5, cy + 0.5)
        regra = regra_da_caixa(vx, vy)
        if regra is not None:
            if isinstance(regra, int):
                grade[cy][cx] = regra     # terreno declarado
            else:
                inventado[cy][cx] = regra # continuação, resolvida no passo seguinte
            continue
        grade[cy][cx] = classificar(*px[cx, cy])

# ---------------------------------------------------------------------------
# 3. Preenche os buracos das legendas com o vizinho válido mais próximo
# ---------------------------------------------------------------------------

PASSOS = {'cima': (0, -1), 'baixo': (0, 1), 'esquerda': (-1, 0), 'direita': (1, 0)}

def preencher_buracos():
    """Estende o terreno vizinho por baixo das caixas de legenda."""
    proximos = []
    for cy in range(LINHAS):
        for cx in range(COLUNAS):
            if grade[cy][cx] is not None:
                continue
            direcao = inventado[cy][cx] or 'perto'
            if direcao in PASSOS:
                dx, dy = PASSOS[direcao]
                x, y = cx + dx, cy + dy
                achou = None
                while 0 <= x < COLUNAS and 0 <= y < LINHAS:
                    if grade[y][x] is not None:
                        achou = grade[y][x]
                        break
                    x += dx; y += dy
                if achou is not None:
                    proximos.append((cy, cx, achou))
                    continue
            proximos.append((cy, cx, None))

    for cy, cx, valor in proximos:
        if valor is not None:
            grade[cy][cx] = valor

    # o que sobrou (molduras finas, cantos) recebe o válido mais próximo
    faltando = [(cy, cx) for cy in range(LINHAS) for cx in range(COLUNAS)
                if grade[cy][cx] is None]
    while faltando:
        resolvidos = []
        for cy, cx in faltando:
            for dy, dx in ((-1,0),(1,0),(0,-1),(0,1)):
                y, x = cy + dy, cx + dx
                if 0 <= y < LINHAS and 0 <= x < COLUNAS and grade[y][x] is not None:
                    resolvidos.append((cy, cx, grade[y][x]))
                    break
        if not resolvidos:
            break
        for cy, cx, valor in resolvidos:
            grade[cy][cx] = valor
        faltando = [(cy, cx) for cy in range(LINHAS) for cx in range(COLUNAS)
                    if grade[cy][cx] is None]
    for cy in range(LINHAS):
        for cx in range(COLUNAS):
            if grade[cy][cx] is None:
                grade[cy][cx] = AGUA

preencher_buracos()

def dissolver_emendas(passes=3, raio=9):
    """Estender o terreno coluna a coluna copia a irregularidade da borda de
    origem e vira listra. A cura é suavizar PERPENDICULAR à direção do
    preenchimento: quem foi puxado de cima leva um voto de maioria na
    horizontal, e as listras se fundem em manchas."""
    global grade
    for _ in range(passes):
        nova = [linha[:] for linha in grade]
        for cy in range(LINHAS):
            for cx in range(COLUNAS):
                direcao = inventado[cy][cx]
                if not direcao:
                    continue
                # perpendicular ao preenchimento
                horizontal = direcao in ('cima', 'baixo', 'perto')
                votos = {}
                for d in range(-raio, raio + 1):
                    y = cy if horizontal else cy + d
                    x = cx + d if horizontal else cx
                    if 0 <= y < LINHAS and 0 <= x < COLUNAS:
                        peso = raio + 1 - abs(d)          # vizinho perto pesa mais
                        if not inventado[y][x]:
                            peso *= 3                     # terreno de verdade manda
                        votos[grade[y][x]] = votos.get(grade[y][x], 0) + peso
                if votos:
                    nova[cy][cx] = max(votos, key=votos.get)
        grade = nova

dissolver_emendas()

# ---------------------------------------------------------------------------
# 4. Limpeza: tira ruído de sal e pimenta por voto da vizinhança
# ---------------------------------------------------------------------------

def suavizar_grade(passes=2):
    global grade
    for _ in range(passes):
        nova = [linha[:] for linha in grade]
        for cy in range(LINHAS):
            for cx in range(COLUNAS):
                votos = {}
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        y, x = cy + dy, cx + dx
                        if 0 <= y < LINHAS and 0 <= x < COLUNAS:
                            peso = 2 if (dx == 0 and dy == 0) else 1
                            votos[grade[y][x]] = votos.get(grade[y][x], 0) + peso
                nova[cy][cx] = max(votos, key=votos.get)
        grade = nova

suavizar_grade(2)

# ---------------------------------------------------------------------------
# 5. Marching squares -> anéis fechados
# ---------------------------------------------------------------------------

def mascara(teste):
    return [[1 if teste(grade[cy][cx]) else 0 for cx in range(COLUNAS)]
            for cy in range(LINHAS)]

def dilatar(m, vezes=1):
    for _ in range(vezes):
        nova = [linha[:] for linha in m]
        for cy in range(LINHAS):
            for cx in range(COLUNAS):
                if m[cy][cx]:
                    continue
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        y, x = cy + dy, cx + dx
                        if 0 <= y < LINHAS and 0 <= x < COLUNAS and m[y][x]:
                            nova[cy][cx] = 1
                            break
                    if nova[cy][cx]:
                        break
        m = nova
    return m

def erodir(m, vezes=1):
    for _ in range(vezes):
        nova = [linha[:] for linha in m]
        for cy in range(LINHAS):
            for cx in range(COLUNAS):
                if not m[cy][cx]:
                    continue
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        y, x = cy + dy, cx + dx
                        if not (0 <= y < LINHAS and 0 <= x < COLUNAS) or not m[y][x]:
                            nova[cy][cx] = 0
                            break
                    if not nova[cy][cx]:
                        break
        m = nova
    return m

def abrir(m, r=1):
    """Some com detalhes finos — rios, chuvisco, penínsulas de um pixel."""
    return dilatar(erodir(m, r), r)

def fechar(m, r=1):
    """Tapa furinhos internos."""
    return erodir(dilatar(m, r), r)

def limpar(m, r=1):
    return fechar(abrir(m, r), r)

def subtrair(a, b):
    return [[1 if a[cy][cx] and not b[cy][cx] else 0 for cx in range(COLUNAS)]
            for cy in range(LINHAS)]

# Segmentos de cada um dos 16 casos, em coordenadas de meio-aresta
# (multiplicadas por 2 para permanecerem inteiras).
CIMA, DIREITA, BAIXO, ESQUERDA = (1, 0), (2, 1), (1, 2), (0, 1)
CASOS = {
    1:  [(ESQUERDA, BAIXO)],
    2:  [(BAIXO, DIREITA)],
    3:  [(ESQUERDA, DIREITA)],
    4:  [(DIREITA, CIMA)],
    5:  [(ESQUERDA, CIMA), (DIREITA, BAIXO)],
    6:  [(BAIXO, CIMA)],
    7:  [(ESQUERDA, CIMA)],
    8:  [(CIMA, ESQUERDA)],
    9:  [(CIMA, BAIXO)],
    10: [(CIMA, DIREITA), (BAIXO, ESQUERDA)],
    11: [(CIMA, DIREITA)],
    12: [(DIREITA, ESQUERDA)],
    13: [(DIREITA, BAIXO)],
    14: [(BAIXO, ESQUERDA)],
}

def extrair_aneis(m):
    """Percorre a grade binária e devolve anéis fechados de pontos."""
    ligacoes = {}
    for cy in range(-1, LINHAS):
        for cx in range(-1, COLUNAS):
            def amostra(y, x):
                if 0 <= y < LINHAS and 0 <= x < COLUNAS:
                    return m[y][x]
                return 0
            tl = amostra(cy, cx)
            tr = amostra(cy, cx + 1)
            br = amostra(cy + 1, cx + 1)
            bl = amostra(cy + 1, cx)
            caso = tl * 8 + tr * 4 + br * 2 + bl * 1
            if caso in (0, 15):
                continue
            base_x, base_y = cx * 2 + 1, cy * 2 + 1
            for origem, destino in CASOS[caso]:
                a = (base_x + origem[0], base_y + origem[1])
                b = (base_x + destino[0], base_y + destino[1])
                ligacoes.setdefault(a, []).append(b)

    aneis = []
    while ligacoes:
        inicio = next(iter(ligacoes))
        anel = [inicio]
        atual = inicio
        while True:
            saidas = ligacoes.get(atual)
            if not saidas:
                break
            proximo = saidas.pop()
            if not saidas:
                del ligacoes[atual]
            if proximo == inicio:
                break
            anel.append(proximo)
            atual = proximo
            if len(anel) > 400000:
                break
        if len(anel) >= 8:
            aneis.append(anel)
    return aneis

# ---------------------------------------------------------------------------
# 6. Simplificação e suavização
# ---------------------------------------------------------------------------

def douglas_peucker(pontos, epsilon):
    if len(pontos) < 3:
        return pontos
    ini, fim = pontos[0], pontos[-1]
    dx, dy = fim[0] - ini[0], fim[1] - ini[1]
    norma = math.hypot(dx, dy)
    pior, indice = 0.0, 0
    for i in range(1, len(pontos) - 1):
        p = pontos[i]
        if norma == 0:
            d = math.hypot(p[0] - ini[0], p[1] - ini[1])
        else:
            d = abs(dy * p[0] - dx * p[1] + fim[0] * ini[1] - fim[1] * ini[0]) / norma
        if d > pior:
            pior, indice = d, i
    if pior > epsilon:
        esq = douglas_peucker(pontos[:indice + 1], epsilon)
        dir_ = douglas_peucker(pontos[indice:], epsilon)
        return esq[:-1] + dir_
    return [ini, fim]

def simplificar_anel(anel, epsilon):
    aberto = douglas_peucker(list(anel) + [anel[0]], epsilon)
    if len(aberto) > 1 and aberto[0] == aberto[-1]:
        aberto = aberto[:-1]
    return aberto

def chaikin(pontos, passes=2, tensao=0.25):
    """Arredonda o polígono cortando os cantos — vira uma linha de costa."""
    for _ in range(passes):
        if len(pontos) < 3:
            return pontos
        saida = []
        n = len(pontos)
        for i in range(n):
            p, q = pontos[i], pontos[(i + 1) % n]
            saida.append((p[0] + (q[0] - p[0]) * tensao, p[1] + (q[1] - p[1]) * tensao))
            saida.append((p[0] + (q[0] - p[0]) * (1 - tensao), p[1] + (q[1] - p[1]) * (1 - tensao)))
        pontos = saida
    return pontos

def area_anel(pontos):
    s = 0.0
    n = len(pontos)
    for i in range(n):
        x1, y1 = pontos[i]
        x2, y2 = pontos[(i + 1) % n]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2.0

def meia_aresta_para_vb(p):
    # coordenadas de meia-aresta (x2) -> célula -> viewBox
    cx = (p[0] - 1) / 2.0 + 0.5
    cy = (p[1] - 1) / 2.0 + 0.5
    return (cx * LARGURA_VB / COLUNAS, cy * ALTURA_VB / LINHAS)

def caminho_svg(aneis, epsilon=0.9, suavizacao=2, area_minima=3.0, casas=1):
    """Converte anéis da grade em um único atributo 'd' de SVG."""
    partes = []
    mantidos = 0
    for anel in aneis:
        pontos = [meia_aresta_para_vb(p) for p in anel]
        pontos = simplificar_anel(pontos, epsilon)
        if len(pontos) < 3:
            continue
        if area_anel(pontos) < area_minima:
            continue
        pontos = chaikin(pontos, suavizacao)
        pontos = simplificar_anel(pontos, epsilon * 0.35)
        if len(pontos) < 3:
            continue
        f = lambda v: ("%." + str(casas) + "f") % v
        d = "M" + f(pontos[0][0]) + " " + f(pontos[0][1])
        for x, y in pontos[1:]:
            d += "L" + f(x) + " " + f(y)
        partes.append(d + "Z")
        mantidos += 1
    return " ".join(partes), mantidos

# ---------------------------------------------------------------------------
# 7. Extrai cada camada
# ---------------------------------------------------------------------------

print("grade: %d x %d células (%.2f unidades de viewBox por célula)"
      % (COLUNAS, LINHAS, LARGURA_VB / COLUNAS))

contagem = {}
for linha in grade:
    for v in linha:
        contagem[v] = contagem.get(v, 0) + 1
total = COLUNAS * LINHAS
print("composição do mundo:")
for k in sorted(contagem, key=lambda k: -contagem[k]):
    print("   %-9s %5.1f%%" % (NOMES[k], 100.0 * contagem[k] / total))

camadas = {}

# Água bruta inclui os rios, que são linhas de um ou dois pixels. Abrir
# a máscara deixa só mares, lagos e baías — é essa a linha de costa.
# O que sobra da subtração são os rios, que viram uma camada à parte.
agua_bruta = mascara(lambda v: v == AGUA)
mares = limpar(abrir(agua_bruta, 2), 1)
rios = limpar(subtrair(agua_bruta, dilatar(mares, 1)), 1)

terra = subtrair([[1] * COLUNAS for _ in range(LINHAS)], mares)

camadas["terra"], n = caminho_svg(extrair_aneis(terra),
                                  epsilon=0.7, suavizacao=2, area_minima=6.0)
print("terra:       %3d formas, %6d caracteres" % (n, len(camadas["terra"])))

camadas["mares"], n = caminho_svg(extrair_aneis(mares),
                                  epsilon=0.7, suavizacao=2, area_minima=6.0)
print("mares:       %3d formas, %6d caracteres" % (n, len(camadas["mares"])))

camadas["rios"], n = caminho_svg(extrair_aneis(rios),
                                 epsilon=0.6, suavizacao=1, area_minima=1.2)
print("rios:        %3d formas, %6d caracteres" % (n, len(camadas["rios"])))

for valor, chave, eps, amin, raio in [
        (DESERTO,  "deserto",  1.0, 30.0, 2),
        (FLORESTA, "floresta", 1.0, 22.0, 2),
        (MONTANHA, "montanha", 1.0, 18.0, 2),
        (TORMENTA, "tormenta", 0.9, 14.0, 1)]:
    m = limpar(mascara(lambda v, alvo=valor: v == alvo), raio)
    if chave != "tormenta":
        m = subtrair(m, mares)          # bioma nenhum invade o mar
    camadas[chave], n = caminho_svg(extrair_aneis(m),
                                    epsilon=eps, suavizacao=2, area_minima=amin)
    print("%-12s %3d formas, %6d caracteres" % (chave + ":", n, len(camadas[chave])))

# ---------------------------------------------------------------------------
# 8. Grava o módulo JS
# ---------------------------------------------------------------------------

cabecalho = """/* =============================================================
   GEOGRAFIA DE ARTON — traçado vetorial

   GERADO AUTOMATICAMENTE por ferramentas/vetorizar.py a partir do
   mapa "Arton: O Reinado e terras próximas, circa 1410". Não edite
   à mão: rode o script de novo.

   Cada camada é um atributo "d" de <path> pronto para uso, no mesmo
   espaço de coordenadas do resto do projeto:
       x de 0 a 1000, y de 0 a %.2f
   ============================================================= */

var GeografiaArton = {
  LARGURA: %.1f,
  ALTURA: %.2f,

  /* Área de fato cartográfica. A faixa de cima e as bordas ficam de fora:
     é onde a prancha original traz legendas e arte, e o que se reconstrói
     por baixo delas não é geografia de verdade. */
  RECORTE: { x: 14, y: 76, largura: 972, altura: 764 },
""" % (ALTURA_VB, LARGURA_VB, ALTURA_VB)

corpo = []
for chave in ["terra", "mares", "rios", "deserto", "floresta", "montanha", "tormenta"]:
    corpo.append("  %s: '%s'" % (chave, camadas[chave]))

with open(DESTINO, "w", encoding="utf-8") as f:
    f.write(cabecalho + ",\n".join(corpo) + "\n};\n")

import os
print("\ngravado em %s (%.0f KB)" % (DESTINO, os.path.getsize(DESTINO) / 1024.0))
