/* =============================================================
   HERÁLDICA DE ARTON

   O Atlas de Arton descreve os brasões em linguagem heráldica de
   verdade — "de púrpura uma torre de ouro", "gironado de azul e
   prata, duas cimitarras passadas em aspa". Este módulo lê essa
   descrição e desenha o escudo em SVG.

   Não é um brasonador completo: cobre os esmaltes, as partições
   mais comuns, as peças geométricas e um punhado de figuras. O que
   não reconhece vira um escudo liso com a inicial da nação, que já
   é melhor do que nada.
   ============================================================= */

var Heraldica = (function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  /* ---------- esmaltes ----------
     Os metais e as cores da heráldica, no tom do Tormenta20. */
  var ESMALTES = {
    'ouro':     '#c9a227',
    'prata':    '#eceae4',
    'vermelho': '#b02a29',
    'azul':     '#2b4a8b',
    'verde':    '#2f6b3a',
    'negro':    '#241c1a',
    'púrpura':  '#6b3f8f',
    'purpura':  '#6b3f8f'
  };

  /* Escudo francês antigo — o formato mais comum nas pranchas do Atlas. */
  var ESCUDO = 'M6 4 H94 V52 C94 76 74 92 50 99 C26 92 6 76 6 52 Z';

  /* ---------- vocabulário ---------- */

  var PARTICOES = {
    'talhado':   'talhado',    // faixa diagonal, do canto superior direito
    'cortado':   'cortado',    // metade de cima / metade de baixo
    'partido':   'partido',    // metade esquerda / metade direita
    'gironado':  'gironado',   // oito setores alternados
    'esquartelado': 'esquartelado'
  };

  var PECAS = ['banda', 'faixa', 'aspa', 'palo', 'cruz', 'chefe', 'campanha',
               'orla', 'bordadura', 'frete', 'escudete'];

  /* Figuras que sabemos desenhar, em silhueta simples. */
  var FIGURAS = {
    'torre': 'torre', 'castelo': 'castelo',
    'cavalo': 'cavalo', 'leopardo': 'felino', 'leões': 'felino', 'leão': 'felino',
    'raposas': 'raposa', 'raposa': 'raposa',
    'dragão': 'dragao', 'touro': 'touro',
    'espadas': 'espada', 'espada': 'espada',
    'cimitarras': 'cimitarra', 'cimitarra': 'cimitarra',
    'crescente': 'crescente', 'estrela': 'estrela', 'estrelas': 'estrela',
    'besante': 'besante', 'besantes': 'besante',
    'anelete': 'anelete', 'roda': 'roda',
    'livro': 'livro', 'balança': 'balanca',
    'dríades': 'driade', 'dríade': 'driade', 'árvore': 'arvore',
    'águia': 'ave', 'sol': 'sol', 'estátua': 'estatua'
  };

  /* ---------- leitura do brasão ---------- */

  function semAcento(t) {
    return String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function acharEsmalte(trecho) {
    var achado = null;
    Object.keys(ESMALTES).forEach(function (nome) {
      if (achado) return;
      if (semAcento(trecho).indexOf(semAcento(nome)) >= 0) achado = nome;
    });
    return achado;
  }

  function ler(brasao) {
    var t = String(brasao || '');
    var plano = semAcento(t);
    var leitura = {
      campo: null, campo2: null, particao: null,
      peca: null, esmaltePeca: null,
      figura: null, esmalteFigura: null,
      texto: t
    };

    // partição: "talhado de prata e azul", "gironado de azul e prata"
    Object.keys(PARTICOES).forEach(function (nome) {
      if (leitura.particao) return;
      var re = new RegExp(semAcento(nome) + '(?:\\s+\\w+)?\\s+de\\s+([a-zç]+)\\s+e\\s+([a-zç]+)');
      var m = plano.match(re);
      if (m) {
        var a = acharEsmalte(m[1]), b = acharEsmalte(m[2]);
        if (a && b) { leitura.particao = nome; leitura.campo = a; leitura.campo2 = b; }
      }
    });

    // campo simples: o primeiro "de <esmalte>"
    if (!leitura.campo) {
      var mc = plano.match(/^de\s+([a-zç]+)/);
      if (mc) leitura.campo = acharEsmalte(mc[1]);
    }
    if (!leitura.campo) leitura.campo = acharEsmalte(plano) || 'prata';

    // peça geométrica e o esmalte dela
    PECAS.forEach(function (nome) {
      if (leitura.peca) return;
      var re = new RegExp('(?:uma?|dois|duas)?\\s*' + semAcento(nome) +
                          '(?:\\s+\\w+){0,2}?\\s+de\\s+([a-zç]+)');
      var m = plano.match(re);
      if (m) { leitura.peca = nome; leitura.esmaltePeca = acharEsmalte(m[1]); }
      else if (plano.indexOf(semAcento(nome)) >= 0) { leitura.peca = nome; }
    });

    // figura
    Object.keys(FIGURAS).forEach(function (palavra) {
      if (leitura.figura) return;
      if (plano.indexOf(semAcento(palavra)) >= 0) {
        leitura.figura = FIGURAS[palavra];
        var re = new RegExp(semAcento(palavra) + '(?:\\s+\\w+){0,3}?\\s+de\\s+([a-zç]+)');
        var m = plano.match(re);
        if (m) leitura.esmalteFigura = acharEsmalte(m[1]);
      }
    });

    // quantidade, para figuras repetidas
    var quantos = plano.match(/\b(dois|duas|tr[eê]s|quatro|cinco|dez)\b/);
    leitura.quantidade = quantos
      ? ({ dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, dez: 10 })[semAcento(quantos[1])] || 1
      : 1;

    return leitura;
  }

  /* ---------- desenho ---------- */

  function el(tag, atrs) {
    var n = document.createElementNS(NS, tag);
    Object.keys(atrs || {}).forEach(function (k) {
      if (atrs[k] !== null && atrs[k] !== undefined) n.setAttribute(k, atrs[k]);
    });
    return n;
  }

  function cor(nome, alternativa) {
    return ESMALTES[nome] || alternativa || '#8a8177';
  }

  function desenharCampo(g, leitura, idRecorte) {
    var base = cor(leitura.campo);
    if (!leitura.particao) {
      g.appendChild(el('rect', { x: 0, y: 0, width: 100, height: 100, fill: base }));
      return;
    }
    var segunda = cor(leitura.campo2, base);
    g.appendChild(el('rect', { x: 0, y: 0, width: 100, height: 100, fill: base }));

    if (leitura.particao === 'cortado') {
      g.appendChild(el('rect', { x: 0, y: 50, width: 100, height: 50, fill: segunda }));
    } else if (leitura.particao === 'partido') {
      g.appendChild(el('rect', { x: 50, y: 0, width: 50, height: 100, fill: segunda }));
    } else if (leitura.particao === 'talhado') {
      g.appendChild(el('polygon', { points: '100,0 100,100 0,100', fill: segunda }));
    } else if (leitura.particao === 'esquartelado') {
      g.appendChild(el('rect', { x: 50, y: 0, width: 50, height: 50, fill: segunda }));
      g.appendChild(el('rect', { x: 0, y: 50, width: 50, height: 50, fill: segunda }));
    } else if (leitura.particao === 'gironado') {
      for (var i = 0; i < 8; i += 2) {
        var a1 = (i * 45 - 90) * Math.PI / 180, a2 = ((i + 1) * 45 - 90) * Math.PI / 180;
        g.appendChild(el('polygon', {
          points: '50,50 ' + (50 + 120 * Math.cos(a1)) + ',' + (50 + 120 * Math.sin(a1)) +
                  ' ' + (50 + 120 * Math.cos(a2)) + ',' + (50 + 120 * Math.sin(a2)),
          fill: segunda
        }));
      }
    }
  }

  function desenharPeca(g, leitura) {
    if (!leitura.peca) return;
    var c = cor(leitura.esmaltePeca, '#eceae4');
    var p = leitura.peca;

    if (p === 'banda') {
      g.appendChild(el('polygon', { points: '0,22 22,0 100,66 78,88', fill: c }));
    } else if (p === 'faixa') {
      g.appendChild(el('rect', { x: 0, y: 38, width: 100, height: 24, fill: c }));
    } else if (p === 'palo') {
      g.appendChild(el('rect', { x: 38, y: 0, width: 24, height: 100, fill: c }));
    } else if (p === 'cruz') {
      g.appendChild(el('rect', { x: 0, y: 38, width: 100, height: 24, fill: c }));
      g.appendChild(el('rect', { x: 38, y: 0, width: 24, height: 100, fill: c }));
    } else if (p === 'aspa') {
      g.appendChild(el('polygon', { points: '0,10 12,0 100,80 88,96', fill: c }));
      g.appendChild(el('polygon', { points: '100,10 88,0 0,80 12,96', fill: c }));
    } else if (p === 'chefe') {
      g.appendChild(el('rect', { x: 0, y: 0, width: 100, height: 26, fill: c }));
    } else if (p === 'campanha') {
      g.appendChild(el('rect', { x: 0, y: 74, width: 100, height: 26, fill: c }));
    } else if (p === 'orla' || p === 'bordadura') {
      g.appendChild(el('path', {
        d: ESCUDO, fill: 'none', stroke: c, 'stroke-width': 11
      }));
    } else if (p === 'frete') {
      for (var i = -100; i < 200; i += 26) {
        g.appendChild(el('line', { x1: i, y1: 0, x2: i + 100, y2: 100, stroke: c, 'stroke-width': 5 }));
        g.appendChild(el('line', { x1: i, y1: 100, x2: i + 100, y2: 0, stroke: c, 'stroke-width': 5 }));
      }
    } else if (p === 'escudete') {
      g.appendChild(el('path', {
        d: 'M32 30 H68 V52 C68 64 58 72 50 76 C42 72 32 64 32 52 Z', fill: c
      }));
    }
  }

  /* ---------- o bestiário ----------
     Antes todas as feras dividiam uma silhueta só, então cavalo, raposa,
     dragão e touro saíam idênticos — o brasão não dizia nada. Aqui cada
     uma tem o seu desenho. Não é gravura de armorial: é silhueta legível
     a trinta pixels, que é o tamanho em que elas realmente aparecem.
     Todas olham para a destra (a esquerda de quem vê), como manda a
     heráldica. */
  var FERAS = {

    cavalo: function (g, c) {
      perna(g, c, -10, 3, 14, 3.6);
      perna(g, c, -3.5, 4, 13, 3.4);
      perna(g, c, 6, 3, 14, 3.6);
      perna(g, c, 12, 4, 13, 3.4);
      g.appendChild(el('ellipse', { cx: 2, cy: -2, rx: 13, ry: 6.4, fill: c }));
      // pescoço arqueado e cabeça
      g.appendChild(el('path', {
        d: 'M-7 -5 C-13 -8 -16 -13 -15 -18 L-10 -19 L-7 -12 L-2 -7 Z', fill: c
      }));
      g.appendChild(el('path', { d: 'M-15 -18 L-20 -19 L-20 -15 L-13 -13 Z', fill: c }));
      // crina e cauda
      g.appendChild(el('path', { d: 'M-9 -16 L-4 -9 L-1 -12 L-6 -18 Z', fill: c }));
      g.appendChild(el('path', {
        d: 'M14 -6 C19 -8 21 0 18 8 L14 6 C16 1 15 -3 12 -3 Z', fill: c
      }));
    },

    raposa: function (g, c) {
      perna(g, c, -8, 3, 9, 3);
      perna(g, c, -3, 3, 9, 3);
      perna(g, c, 5, 3, 9, 3);
      perna(g, c, 9, 3, 9, 3);
      g.appendChild(el('ellipse', { cx: 1, cy: -1, rx: 11, ry: 4.6, fill: c }));
      // focinho pontudo e orelhas em pé
      g.appendChild(el('path', { d: 'M-8 -3 L-19 -6 L-11 -9 L-6 -6 Z', fill: c }));
      g.appendChild(el('path', { d: 'M-11 -8 L-13 -15 L-8 -11 Z', fill: c }));
      g.appendChild(el('path', { d: 'M-7 -8 L-8 -15 L-3 -10 Z', fill: c }));
      // a cauda farta, que é a marca da raposa
      g.appendChild(el('path', {
        d: 'M10 -2 C17 -5 20 -12 17 -17 C15 -12 13 -8 8 -6 Z', fill: c
      }));
    },

    touro: function (g, c) {
      perna(g, c, -10, 4, 12, 4.4);
      perna(g, c, -4, 5, 11, 4.2);
      perna(g, c, 6, 4, 12, 4.4);
      perna(g, c, 11, 5, 11, 4.2);
      g.appendChild(el('ellipse', { cx: 2, cy: -2, rx: 14, ry: 7.6, fill: c }));
      // cabeça baixa e maciça
      g.appendChild(el('path', { d: 'M-10 -4 L-19 -6 L-19 2 L-11 3 Z', fill: c }));
      // os chifres
      g.appendChild(el('path', {
        d: 'M-17 -6 C-20 -12 -16 -15 -12 -14 L-13 -11 C-15 -11 -16 -9 -15 -6 Z', fill: c
      }));
      g.appendChild(el('path', {
        d: 'M-12 -7 C-10 -13 -5 -14 -2 -11 L-4 -9 C-6 -10 -8 -9 -9 -6 Z', fill: c
      }));
      g.appendChild(el('path', { d: 'M15 -5 C19 -3 19 6 16 10 L14 8 C16 4 15 0 13 -2 Z', fill: c }));
    },

    felino: function (g, c) {
      perna(g, c, -9, 3, 12, 3.4);
      perna(g, c, -3, 4, 11, 3.2);
      perna(g, c, 6, 3, 12, 3.4);
      perna(g, c, 11, 4, 11, 3.2);
      g.appendChild(el('ellipse', { cx: 2, cy: -2, rx: 13, ry: 6, fill: c }));
      g.appendChild(el('circle', { cx: -12, cy: -7, r: 6, fill: c }));
      // juba
      g.appendChild(el('path', {
        d: 'M-12 -14 L-8 -10 L-12 -1 L-18 -2 L-19 -9 Z', fill: c
      }));
      // cauda erguida sobre o dorso
      g.appendChild(el('path', {
        d: 'M14 -5 C20 -8 21 -16 16 -19 L15 -15 C18 -13 17 -8 12 -6 Z', fill: c
      }));
    },

    dragao: function (g, c) {
      // rampante: ergue-se sobre as patas traseiras
      g.appendChild(el('path', {
        d: 'M-2 16 L-4 4 C-6 -2 -4 -9 2 -13 L6 -10 C2 -7 1 -2 3 3 L4 16 Z', fill: c
      }));
      // asa aberta, o traço que diz "dragão"
      g.appendChild(el('path', {
        d: 'M2 -8 L16 -18 L14 -10 L19 -12 L15 -3 L18 -3 L10 5 L3 0 Z', fill: c
      }));
      // cabeça com focinho e crista
      g.appendChild(el('path', { d: 'M2 -13 L-8 -17 L-2 -20 L4 -18 Z', fill: c }));
      g.appendChild(el('path', { d: 'M3 -18 L6 -22 L8 -17 Z', fill: c }));
      // patas dianteiras erguidas
      g.appendChild(el('path', { d: 'M-4 -8 L-12 -6 L-11 -2 L-3 -4 Z', fill: c }));
      // cauda enrolada
      g.appendChild(el('path', {
        d: 'M-3 12 C-11 12 -15 6 -12 1 L-9 3 C-11 6 -8 9 -3 8 Z', fill: c
      }));
    },

    ave: function (g, c) {
      // águia de asas abertas, simétrica
      g.appendChild(el('path', {
        d: 'M0 -9 L-9 -16 L-8 -10 L-16 -15 L-14 -8 L-20 -10 L-16 -2 L-10 -1 L-2 -3 Z', fill: c
      }));
      g.appendChild(el('path', {
        d: 'M0 -9 L9 -16 L8 -10 L16 -15 L14 -8 L20 -10 L16 -2 L10 -1 L2 -3 Z', fill: c
      }));
      g.appendChild(el('path', { d: 'M-4 -6 L4 -6 L3 8 L0 12 L-3 8 Z', fill: c }));
      g.appendChild(el('circle', { cx: 0, cy: -12, r: 4.2, fill: c }));
      g.appendChild(el('path', { d: 'M0 -13 L-6 -11 L0 -9 Z', fill: c }));
      g.appendChild(el('path', { d: 'M-4 10 L4 10 L2 18 L-2 18 Z', fill: c }));
    },

    estatua: function (g, c) {
      // figura de pé sobre pedestal
      g.appendChild(el('rect', { x: -12, y: 13, width: 24, height: 5, fill: c }));
      g.appendChild(el('rect', { x: -9, y: 10, width: 18, height: 3, fill: c }));
      g.appendChild(el('path', { d: 'M-7 10 L-4 -4 L4 -4 L7 10 Z', fill: c }));
      g.appendChild(el('circle', { cx: 0, cy: -9, r: 4.6, fill: c }));
      // braço erguido, como a estátua de Valkaria
      g.appendChild(el('path', { d: 'M3 -3 L11 -16 L14 -14 L6 -1 Z', fill: c }));
      g.appendChild(el('path', { d: 'M-3 -3 L-10 3 L-12 0 L-5 -5 Z', fill: c }));
    },

    castelo: function (g, c, leitura) {
      // muralha com ameias entre duas torres
      g.appendChild(el('rect', { x: -9, y: -2, width: 18, height: 16, fill: c }));
      for (var i = 0; i < 3; i++) {
        g.appendChild(el('rect', { x: -9 + i * 7, y: -6, width: 4, height: 4, fill: c }));
      }
      [-15, 9].forEach(function (x) {
        g.appendChild(el('rect', { x: x, y: -8, width: 6, height: 22, fill: c }));
        g.appendChild(el('rect', { x: x - 1, y: -12, width: 3, height: 4, fill: c }));
        g.appendChild(el('rect', { x: x + 4, y: -12, width: 3, height: 4, fill: c }));
      });
      // o portão, vazado na cor do campo
      g.appendChild(el('path', {
        d: 'M-3.5 14 L-3.5 5 A3.5 3.5 0 0 1 3.5 5 L3.5 14 Z', fill: cor(leitura.campo)
      }));
    },

    driade: function (g, c) {
      // duas dríades adossadas, unidas pela cintura a uma árvore
      g.appendChild(el('rect', { x: -2, y: 0, width: 4, height: 16, fill: c }));
      g.appendChild(el('circle', { cx: 0, cy: -8, r: 10, fill: c }));
      [-1, 1].forEach(function (lado) {
        g.appendChild(el('path', {
          d: 'M' + (lado * 3) + ' 2 L' + (lado * 9) + ' 3 L' + (lado * 8) + ' 15 L' +
             (lado * 3) + ' 15 Z', fill: c
        }));
        g.appendChild(el('circle', { cx: lado * 8, cy: -2, r: 3.6, fill: c }));
        g.appendChild(el('path', {
          d: 'M' + (lado * 9) + ' 3 L' + (lado * 15) + ' -6 L' + (lado * 17) + ' -3 L' +
             (lado * 11) + ' 6 Z', fill: c
        }));
      });
    },

    arvore: function (g, c) {
      g.appendChild(el('rect', { x: -2.5, y: 0, width: 5, height: 17, fill: c }));
      g.appendChild(el('circle', { cx: 0, cy: -7, r: 13, fill: c }));
      g.appendChild(el('path', { d: 'M-2 4 L-9 -1 L-8 2 L-2 7 Z', fill: c }));
      g.appendChild(el('path', { d: 'M2 4 L9 -1 L8 2 L2 7 Z', fill: c }));
    }
  };

  /* Perna de bicho: um retângulo com casco, repetido quatro vezes. */
  function perna(g, c, x, y, altura, largura) {
    g.appendChild(el('rect', { x: x, y: y, width: largura, height: altura, fill: c }));
    g.appendChild(el('rect', {
      x: x - 0.6, y: y + altura - 2, width: largura + 1.2, height: 2, fill: c
    }));
  }

  /* Silhuetas simples — sugerem a figura sem tentar ser gravura. */
  function desenharFigura(g, leitura) {
    if (!leitura.figura) return;
    var c = cor(leitura.esmalteFigura, leitura.campo === 'prata' ? '#b02a29' : '#eceae4');
    var f = leitura.figura;
    var grupo = el('g', { fill: c, stroke: 'none' });

    function posicoes(n) {
      if (n <= 1) return [[50, 48, 1]];
      if (n === 2) return [[34, 46, .78], [66, 46, .78]];
      if (n === 3) return [[50, 30, .6], [34, 60, .6], [66, 60, .6]];
      var saida = [];
      for (var i = 0; i < Math.min(n, 10); i++) {
        saida.push([26 + (i % 3) * 24, 26 + Math.floor(i / 3) * 22, .42]);
      }
      return saida;
    }

    var alvos = (f === 'besante' || f === 'estrela' || f === 'anelete' || f === 'espada' ||
                 f === 'cimitarra' || f === 'raposa')
      ? posicoes(leitura.quantidade) : posicoes(1);

    alvos.forEach(function (pos) {
      var x = pos[0], y = pos[1], k = pos[2];
      var sub = el('g', { transform: 'translate(' + x + ',' + y + ') scale(' + k + ')' });

      if (f === 'besante') {
        sub.appendChild(el('circle', { cx: 0, cy: 0, r: 13 }));
      } else if (f === 'anelete') {
        sub.appendChild(el('circle', { cx: 0, cy: 0, r: 13, fill: 'none', stroke: c, 'stroke-width': 5 }));
      } else if (f === 'estrela') {
        sub.appendChild(el('path', { d: estrela(8, 15, 6) }));
      } else if (f === 'sol') {
        sub.appendChild(el('path', { d: estrela(12, 18, 9) }));
      } else if (f === 'crescente') {
        sub.appendChild(el('path', {
          d: 'M0 -16 A16 16 0 1 0 0 16 A12 12 0 1 1 0 -16 Z'
        }));
      } else if (f === 'torre') {
        sub.appendChild(el('path', {
          d: 'M-15 18 V-6 H-11 V-12 H-6 V-6 H-3 V-12 H3 V-6 H6 V-12 H11 V-6 H15 V18 Z'
        }));
        sub.appendChild(el('rect', { x: -4, y: 4, width: 8, height: 14, fill: cor(leitura.campo) }));
      } else if (f === 'espada' || f === 'cimitarra') {
        sub.appendChild(el('path', {
          d: f === 'espada'
            ? 'M-2.5 -20 H2.5 V6 H7 V10 H2.5 V20 H-2.5 V10 H-7 V6 H-2.5 Z'
            : 'M-3 20 C-3 4 2 -10 9 -20 L12 -17 C7 -7 3 5 3 20 Z'
        }));
      } else if (f === 'roda') {
        sub.appendChild(el('circle', { cx: 0, cy: 0, r: 16, fill: 'none', stroke: c, 'stroke-width': 4 }));
        for (var a = 0; a < 8; a++) {
          var ang = a * Math.PI / 4;
          sub.appendChild(el('line', {
            x1: 0, y1: 0, x2: 16 * Math.cos(ang), y2: 16 * Math.sin(ang),
            stroke: c, 'stroke-width': 3
          }));
        }
      } else if (f === 'livro') {
        sub.appendChild(el('path', { d: 'M-18 -10 H-1 V12 H-18 Z M1 -10 H18 V12 H1 Z' }));
      } else if (f === 'balanca') {
        sub.appendChild(el('rect', { x: -1.5, y: -18, width: 3, height: 30 }));
        sub.appendChild(el('rect', { x: -16, y: -14, width: 32, height: 3 }));
        sub.appendChild(el('path', { d: 'M-20 -11 L-10 -11 L-15 -2 Z M10 -11 L20 -11 L15 -2 Z' }));
      } else if (f === 'arvore') {
        sub.appendChild(el('rect', { x: -2.5, y: 0, width: 5, height: 18 }));
        sub.appendChild(el('circle', { cx: 0, cy: -6, r: 14 }));
      } else if (FERAS[f]) {
        FERAS[f](sub, c, leitura);
      }
      grupo.appendChild(sub);
    });

    g.appendChild(grupo);
  }

  function estrela(pontas, raioFora, raioDentro) {
    var d = '';
    for (var i = 0; i < pontas * 2; i++) {
      var r = i % 2 ? raioDentro : raioFora;
      var a = (i * Math.PI / pontas) - Math.PI / 2;
      d += (i ? 'L' : 'M') + (r * Math.cos(a)).toFixed(1) + ' ' + (r * Math.sin(a)).toFixed(1);
    }
    return d + 'Z';
  }

  /* ---------- API ---------- */

  var contador = 0;

  /* Devolve um <svg> pronto com o escudo. Se o brasão não for
     reconhecido, cai num escudo liso com a inicial. */
  function escudo(brasao, alternativa) {
    contador++;
    var id = 'escudo-' + contador;
    var svg = el('svg', {
      viewBox: '0 0 100 104', class: 'brasao',
      xmlns: NS, 'aria-hidden': 'true'
    });

    var defs = el('defs', {});
    var recorte = el('clipPath', { id: id });
    recorte.appendChild(el('path', { d: ESCUDO }));
    defs.appendChild(recorte);
    svg.appendChild(defs);

    var dentro = el('g', { 'clip-path': 'url(#' + id + ')' });

    if (brasao) {
      var leitura = ler(brasao);
      desenharCampo(dentro, leitura, id);
      desenharPeca(dentro, leitura);
      desenharFigura(dentro, leitura);
    } else {
      dentro.appendChild(el('rect', {
        x: 0, y: 0, width: 100, height: 100,
        fill: (alternativa && alternativa.cor) || '#8a8177'
      }));
      if (alternativa && alternativa.nome) {
        var letra = el('text', {
          x: 50, y: 62, 'text-anchor': 'middle', class: 'brasao-inicial'
        });
        letra.textContent = alternativa.nome.charAt(0).toUpperCase();
        dentro.appendChild(letra);
      }
    }

    svg.appendChild(dentro);
    svg.appendChild(el('path', { d: ESCUDO, class: 'brasao-contorno' }));
    return svg;
  }

  return {
    escudo: escudo,
    ler: ler,
    ESMALTES: ESMALTES
  };
})();
