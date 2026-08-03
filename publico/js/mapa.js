/* =============================================================
   MAPA DE ARTON — circa 1410
   É a tela principal: ocupa a página inteira, embaixo da barra.

   O desenho é todo vetorial: costa, rios, desertos, matas, serras e
   Áreas de Tormenta saem de GeografiaArton, traçado a partir da
   prancha original. Por cima vêm os territórios políticos, recortados
   pela linha de costa, as cidades e os seis heróis do grupo.

   Mestre: redesenha fronteiras, cria e renomeia cidades, põe os
           heróis onde a história está agora.
   Jogadores: navegam, buscam e leem.
   ============================================================= */

var MapaArton = (function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var $ = Interface.$, $$ = Interface.$$;
  var esc = Interface.escapar;

  var LARGURA = DadosMapa.LARGURA_VIEWBOX;
  var ALTURA = DadosMapa.ALTURA_VIEWBOX;
  var TIPOS = DadosMapa.TIPOS_CIDADE;
  var CATEGORIAS = DadosMapa.CATEGORIAS;
  var GUERRA = DadosMapa.ESTADOS_GUERRA;
  var RECORTE = (typeof GeografiaArton !== 'undefined' && GeografiaArton.RECORTE) ||
                { x: 0, y: 0, largura: LARGURA, altura: ALTURA };

  /* ---------------- estado ---------------- */

  var dados = DadosMapa.padrao();
  var selecao = null;                 // { tipo: 'nacao'|'cidade'|'token', id }
  var ferramenta = 'selecionar';
  var editandoVertices = false;
  var mostrarRotulos = true;
  var categoriasOcultas = { mar: true };
  var vista = { x: RECORTE.x, y: RECORTE.y, w: RECORTE.largura, h: RECORTE.altura };

  var raiz, svg, palco, defsTokens, defsGuerra;
  var camadaTerritorios, camadaCidades, camadaRotulos, camadaTokens, camadaEdicao;
  var rascunho = [], regua = [], arrasto = null;
  var dedos = {};               // ponteiros ativos, para a pinça
  var pinca = null;             // { distancia, meio }
  var montado = false;
  var tokenEmEdicao = null, fotoEmEdicao = null;
  var momentoVisto = null;      // null = o presente; senão, um id da crônica
  var espiandoNevoa = false;    // o mestre enxergando através da névoa

  /* ---------------- utilidades ---------------- */

  function el(tag, atributos) {
    var n = document.createElementNS(NS, tag);
    if (atributos) {
      Object.keys(atributos).forEach(function (k) {
        if (atributos[k] !== null && atributos[k] !== undefined) {
          n.setAttribute(k, atributos[k]);
        }
      });
    }
    return n;
  }

  function acharNacao(id) {
    var lista = (typeof nacoesEmCena === 'function') ? nacoesEmCena() : dados.nacoes;
    for (var i = 0; i < lista.length; i++) {
      if (lista[i].id === id) return lista[i];
    }
    return null;
  }

  function acharCidade(id) {
    for (var i = 0; i < dados.cidades.length; i++) {
      if (dados.cidades[i].id === id) return dados.cidades[i];
    }
    return null;
  }

  function acharToken(id) {
    for (var i = 0; i < (dados.tokens || []).length; i++) {
      if (dados.tokens[i].id === id) return dados.tokens[i];
    }
    return null;
  }

  function cidadesDe(idNacao) {
    return dados.cidades.filter(function (c) { return c.nacao === idNacao; });
  }

  function novoId(base) {
    var limpo = String(base || 'item').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item';
    var tentativa = limpo, n = 2;
    while (acharNacao(tentativa) || acharCidade(tentativa)) tentativa = limpo + '-' + (n++);
    return tentativa;
  }

  function ehMestre() { return Sincronia.ehMestre(); }
  function salvar() { if (ehMestre() && !vendoOPassado()) Sincronia.salvarMapa(dados); }

  function centroide(pontos) {
    var sx = 0, sy = 0;
    pontos.forEach(function (p) { sx += p[0]; sy += p[1]; });
    return [sx / pontos.length, sy / pontos.length];
  }

  function escalarPoligono(pontos, fator) {
    var c = centroide(pontos);
    return pontos.map(function (p) {
      return [Math.round((c[0] + (p[0] - c[0]) * fator) * 100) / 100,
              Math.round((c[1] + (p[1] - c[1]) * fator) * 100) / 100];
    });
  }

  function distanciaKm(a, b) {
    return Math.sqrt(Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2)) *
           DadosMapa.KM_POR_UNIDADE;
  }

  /* ---------------- estrutura ---------------- */

  var MOLDE =
    '<aside class="lateral">' +
      '<div class="lateral-cabecalho">' +
        '<div class="painel-titulo" style="padding:0 0 6px">' +
          '<span>O grupo</span>' +
          '<span class="discreto so-mestre" data-visivel="nao">clique para posicionar</span>' +
        '</div>' +
        '<div class="tira-tokens" id="tira-tokens"></div>' +
      '</div>' +
      '<div class="lateral-cabecalho">' +
        '<div class="painel-titulo" style="padding:0 0 4px">' +
          '<span>O mundo conhecido</span><span class="discreto" id="mapa-resumo"></span>' +
        '</div>' +
        '<div class="filtros" id="mapa-filtros"></div>' +
      '</div>' +
      '<div class="lateral-corpo" id="mapa-lista"></div>' +
      '<div class="so-mestre lateral-rodape" id="mapa-rodape-mestre" data-visivel="nao">' +
        '<div class="grupo-botoes">' +
          '<button class="botao pequeno" id="mapa-backup">⬇ Backup</button>' +
          '<button class="botao pequeno" id="mapa-restaurar">⬆ Restaurar</button>' +
          '<button class="botao pequeno perigo" id="mapa-padrao">↺ Original</button>' +
        '</div>' +
      '</div>' +
    '</aside>' +

    '<main class="palco" id="mapa-palco">' +
      '<svg id="mapa-svg" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">' +
        '<defs>' +
          '<clipPath id="recorte-prancha"><rect id="recorte-rect"/></clipPath>' +
          '<clipPath id="recorte-terra"><path id="recorte-terra-path"/></clipPath>' +
          '<filter id="halo-costa" x="-10%" y="-10%" width="120%" height="120%">' +
            '<feMorphology operator="dilate" radius="2.6" in="SourceAlpha" result="d"/>' +
            '<feGaussianBlur in="d" stdDeviation="2.2" result="b"/>' +
            '<feFlood flood-color="#8fbcc9" flood-opacity=".75"/>' +
            '<feComposite operator="in" in2="b" result="anel"/>' +
            '<feMerge><feMergeNode in="anel"/><feMergeNode in="SourceGraphic"/></feMerge>' +
          '</filter>' +
          '<pattern id="trama-tormenta" width="6" height="6" patternUnits="userSpaceOnUse" ' +
                   'patternTransform="rotate(45)">' +
            '<rect width="6" height="6" fill="#d22833" fill-opacity=".5"/>' +
            '<line x1="0" y1="0" x2="0" y2="6" stroke="#8c1118" stroke-width="2.2"/>' +
          '</pattern>' +
          '<g id="defs-tokens"></g>' +
          '<g id="defs-guerra"></g>' +
        '</defs>' +
        '<g clip-path="url(#recorte-prancha)">' +
          '<rect id="fundo-mar" class="geo-mar"/>' +
          '<g id="camada-geografia"></g>' +
          '<rect id="veu-noturno"/>' +
          '<g id="camada-territorios" clip-path="url(#recorte-terra)"></g>' +
          '<g id="camada-cidades"></g>' +
          '<g id="camada-rotulos"></g>' +
          '<g id="camada-edicao"></g>' +
          '<g id="camada-tokens"></g>' +
        '</g>' +
      '</svg>' +

      '<div class="gavetas">' +
        '<button class="gaveta-botao" id="gaveta-lista" title="Reinos e grupo">☰</button>' +
        '<button class="gaveta-botao" id="gaveta-ficha" title="Detalhes">ⓘ</button>' +
      '</div>' +

      '<div class="ferramentas">' +
        '<div class="grupo-ferramentas">' +
          '<button class="ferramenta ativa" data-ferramenta="selecionar" title="Navegar (V)">🖐️</button>' +
          '<button class="ferramenta" data-ferramenta="regua" title="Medir distância (R)">📏</button>' +
        '</div>' +
        '<div class="grupo-ferramentas so-mestre" id="mapa-ferramentas-mestre" data-visivel="nao">' +
          '<button class="ferramenta" data-ferramenta="territorio" title="Novo território (T)">✏️</button>' +
          '<button class="ferramenta" data-ferramenta="cidade" title="Nova cidade (C)">📍</button>' +
          '<button class="ferramenta" id="mapa-espiar" title="Espiar através da névoa (N) — só você vê">🌫️</button>' +
        '</div>' +
        '<div class="grupo-ferramentas">' +
          '<button class="ferramenta ativa" id="mapa-rotulos" title="Rótulos (L)">🏷️</button>' +
          '<button class="ferramenta" id="mapa-enquadrar" title="Enquadrar (0)">⤢</button>' +
        '</div>' +
      '</div>' +

      '<div class="legenda-terreno flutuante">' +
        '<span><i style="background:var(--terra)"></i>Campos</span>' +
        '<span><i style="background:var(--deserto)"></i>Deserto</span>' +
        '<span><i style="background:var(--floresta)"></i>Mata</span>' +
        '<span><i style="background:var(--montanha)"></i>Serras</span>' +
        '<span><i style="background:var(--t20-rubro)"></i>Tormenta</span>' +
      '</div>' +

      '<div class="escala-mapa">' +
        '<div class="escala-barra" id="mapa-escala-barra" style="width:80px"></div>' +
        '<div id="mapa-escala-texto">—</div>' +
      '</div>' +
      '<div class="controles-zoom">' +
        '<button class="botao pequeno icone" id="mapa-menos">−</button>' +
        '<span id="mapa-zoom">100%</span>' +
        '<button class="botao pequeno icone" id="mapa-mais">+</button>' +
      '</div>' +
      '<div class="dica-mapa" id="mapa-dica"></div>' +
      '<div class="faixa-edicao" id="faixa-edicao" hidden></div>' +
      '<div class="tarja-cronica" id="tarja-cronica" hidden></div>' +
      '<div class="cronica" id="cronica" hidden></div>' +
    '</main>' +

    '<aside class="lateral direita">' +
      '<div class="lateral-corpo" id="mapa-inspetor"></div>' +
    '</aside>';

  function montar() {
    if (montado) return;
    raiz = $('#mapa-raiz');
    raiz.innerHTML = MOLDE;

    svg = $('#mapa-svg');
    palco = $('#mapa-palco');
    defsTokens = $('#defs-tokens');
    defsGuerra = $('#defs-guerra');
    camadaTerritorios = $('#camada-territorios');
    camadaCidades = $('#camada-cidades');
    camadaRotulos = $('#camada-rotulos');
    camadaTokens = $('#camada-tokens');
    camadaEdicao = $('#camada-edicao');

    var r = $('#recorte-rect');
    r.setAttribute('x', RECORTE.x); r.setAttribute('y', RECORTE.y);
    r.setAttribute('width', RECORTE.largura); r.setAttribute('height', RECORTE.altura);

    [$('#fundo-mar'), $('#veu-noturno')].forEach(function (n) {
      n.setAttribute('x', -50); n.setAttribute('y', -50);
      n.setAttribute('width', LARGURA + 100); n.setAttribute('height', ALTURA + 100);
    });

    desenharGeografia();
    ligarSvg();
    ligarFerramentas();
    ligarBusca();
    ligarBackup();
    ligarModalToken();
    ligarRecortador();

    ligarGavetas();
    Interface.pintarPapel();
    montado = true;
  }

  /* ---------------- gavetas do celular ----------------
     Numa tela estreita as três colunas não caberiam, então as laterais
     viram gavetas que entram por cima do mapa. No computador os botões
     nem aparecem. */
  function ligarGavetas() {
    function alternar(qual) {
      var abrindo = !raiz.classList.contains(qual + '-aberta');
      raiz.classList.remove('lista-aberta', 'ficha-aberta');
      if (abrindo) raiz.classList.add(qual + '-aberta');
      atualizarBotoesGaveta();
    }

    var bl = $('#gaveta-lista'), bf = $('#gaveta-ficha');
    if (bl) bl.addEventListener('click', function () { alternar('lista'); });
    if (bf) bf.addEventListener('click', function () { alternar('ficha'); });

    // tocar no mapa fecha a gaveta aberta
    svg.addEventListener('pointerdown', function () {
      if (raiz.classList.contains('lista-aberta') || raiz.classList.contains('ficha-aberta')) {
        raiz.classList.remove('lista-aberta', 'ficha-aberta');
        atualizarBotoesGaveta();
      }
    }, true);
  }

  function atualizarBotoesGaveta() {
    var bl = $('#gaveta-lista'), bf = $('#gaveta-ficha');
    if (bl) bl.classList.toggle('ativa', raiz.classList.contains('lista-aberta'));
    if (bf) bf.classList.toggle('ativa', raiz.classList.contains('ficha-aberta'));
  }

  /* Selecionar algo no celular abre a ficha sozinho — senão o toque
     parece não ter feito nada. */
  function mostrarFichaNoCelular() {
    if (!raiz || window.innerWidth > 820) return;
    raiz.classList.remove('lista-aberta');
    raiz.classList.add('ficha-aberta');
    atualizarBotoesGaveta();
  }

  /* ---------------- geografia ---------------- */

  function desenharGeografia() {
    var camada = $('#camada-geografia');
    camada.textContent = '';
    if (typeof GeografiaArton === 'undefined') return;
    var G = GeografiaArton;
    $('#recorte-terra-path').setAttribute('d', G.terra || '');

    function por(d, classe, extras) {
      if (!d) return;
      camada.appendChild(el('path', Object.assign({ d: d, class: classe }, extras || {})));
    }
    por(G.terra, 'geo-terra', { filter: 'url(#halo-costa)' });
    por(G.deserto, 'geo-deserto');
    por(G.floresta, 'geo-floresta');
    por(G.montanha, 'geo-montanha');
    por(G.rios, 'geo-rio');
    por(G.terra, 'geo-costa');
    por(G.tormenta, 'geo-tormenta');
  }

  /* ---------------- vista ---------------- */

  function fatorEscala() { return vista.w / LARGURA; }

  function aspecto() {
    if (palco && palco.clientWidth) return palco.clientHeight / palco.clientWidth;
    return RECORTE.altura / RECORTE.largura;
  }

  function aplicarVista() {
    vista.w = Math.max(LARGURA * 0.035, Math.min(RECORTE.largura * 1.15, vista.w));
    vista.h = vista.w * aspecto();
    var folgaX = vista.w * 0.35, folgaY = vista.h * 0.35;
    vista.x = Math.max(RECORTE.x - folgaX,
              Math.min(RECORTE.x + RECORTE.largura - vista.w + folgaX, vista.x));
    vista.y = Math.max(RECORTE.y - folgaY,
              Math.min(RECORTE.y + RECORTE.altura - vista.h + folgaY, vista.y));

    svg.setAttribute('viewBox', vista.x.toFixed(2) + ' ' + vista.y.toFixed(2) + ' ' +
                                vista.w.toFixed(2) + ' ' + vista.h.toFixed(2));
    var z = $('#mapa-zoom');
    if (z) z.textContent = Math.round((RECORTE.largura / vista.w) * 100) + '%';
    atualizarTamanhos();
    atualizarTramas();
    atualizarEscala();
  }

  function atualizarTamanhos() {
    var k = fatorEscala();
    $$('.rotulo-nacao', svg).forEach(function (t) {
      t.setAttribute('font-size', (10.5 * k).toFixed(2));
      t.setAttribute('stroke-width', (3.2 * k).toFixed(2));
    });
    var mostraCidades = k < 0.5;
    $$('.rotulo-cidade', svg).forEach(function (t) {
      t.setAttribute('font-size', (7 * k).toFixed(2));
      t.setAttribute('stroke-width', (2.4 * k).toFixed(2));
      t.style.display = mostraCidades && mostrarRotulos ? '' : 'none';
    });
    $$('.marca-cidade', svg).forEach(function (c) {
      var b = parseFloat(c.getAttribute('data-raio')) || 3;
      c.setAttribute('r', Math.max(1.1, b * Math.max(k, 0.26)).toFixed(2));
    });
    $$('.halo-campanha', svg).forEach(function (c) {
      var b = parseFloat(c.getAttribute('data-raio')) || 3;
      c.setAttribute('r', Math.max(2.2, b * 2 * Math.max(k, 0.26)).toFixed(2));
    });
    /* Alvos de clique confortáveis: antes tinham 6 px e ninguém achava. */
    var porPixelEd = pixelsPorUnidade();
    var rVertice = 6.5 / porPixelEd;
    var rMeio = 7.5 / porPixelEd;
    $$('.vertice', svg).forEach(function (v) { v.setAttribute('r', rVertice.toFixed(2)); });
    $$('.vertice-meio', svg).forEach(function (v) { v.setAttribute('r', rMeio.toFixed(2)); });
    $$('.sinal-meio', svg).forEach(function (t) {
      t.setAttribute('font-size', (13 / porPixelEd).toFixed(2));
      t.setAttribute('y', (parseFloat(t.getAttribute('data-y')) + 4.6 / porPixelEd).toFixed(2));
    });
    $$('.ponto-regua', svg).forEach(function (v) { v.setAttribute('r', (3 * k).toFixed(2)); });
    $$('.texto-regua', svg).forEach(function (t) {
      t.setAttribute('font-size', (10 * k).toFixed(2));
      t.setAttribute('stroke-width', (3.4 * k).toFixed(2));
    });

    atualizarTamanhosTokens();
  }

  /* Quanto o raio pedido em pixels de tela vale em unidades do mapa.
     Antes o raio era preso em unidades do mapa, então o retrato inchava
     conforme você aproximava — o herói acabava maior que o reino. */
  var RAIO_BASE_PX = 18;

  function pixelsPorUnidade() {
    var largura = (palco && palco.clientWidth) ? palco.clientWidth : 900;
    return largura / vista.w;
  }

  function raioTokenPx(tamanho) {
    return Math.max(7, Math.min(110, RAIO_BASE_PX * (tamanho || 1)));
  }

  function raioTokenUnidades(tamanho) {
    return raioTokenPx(tamanho) / pixelsPorUnidade();
  }

  function atualizarTamanhosTokens() {
    $$('.token', svg).forEach(function (grupo) {
      var tamanho = parseFloat(grupo.getAttribute('data-tamanho')) || 1;
      var porPixel = pixelsPorUnidade();
      var raioPx = raioTokenPx(tamanho);
      var r = raioPx / porPixel;
      /* A alça também é medida em pixels de tela: presa em unidades do
         mapa, ela engordava a cada aproximação e tapava o retrato. */
      var punhoPx = Math.max(5, Math.min(11, raioPx * 0.26));
      var cx = parseFloat(grupo.getAttribute('data-x'));
      var cy = parseFloat(grupo.getAttribute('data-y'));

      $$('.token-retrato, .token-aro', grupo).forEach(function (c) {
        c.setAttribute('r', r.toFixed(2));
      });
      $$('.token-aro', grupo).forEach(function (c) {
        c.setAttribute('stroke-width', Math.max(1.2, r * 0.15).toFixed(2));
      });
      $$('.token-inicial', grupo).forEach(function (t) {
        t.setAttribute('font-size', (r * 1.05).toFixed(2));
        t.setAttribute('y', (cy + r * 0.37).toFixed(2));
      });
      $$('.token-nome', grupo).forEach(function (t) {
        t.setAttribute('font-size', (r * 0.6).toFixed(2));
        t.setAttribute('stroke-width', (r * 0.2).toFixed(2));
        t.setAttribute('y', (cy + r * 1.7).toFixed(2));
      });
      // a alça fica na quina de baixo à direita do aro, como um alfinete
      $$('.token-punho', grupo).forEach(function (c) {
        c.setAttribute('cx', (cx + r * 0.707).toFixed(2));
        c.setAttribute('cy', (cy + r * 0.707).toFixed(2));
        c.setAttribute('r', (punhoPx / porPixel).toFixed(2));
      });
      $$('.token-guia', grupo).forEach(function (l) {
        l.setAttribute('x1', cx.toFixed(2)); l.setAttribute('y1', cy.toFixed(2));
        l.setAttribute('x2', (cx + r * 0.707).toFixed(2));
        l.setAttribute('y2', (cy + r * 0.707).toFixed(2));
      });
    });
  }

  function atualizarEscala() {
    var barra = $('#mapa-escala-barra'), texto = $('#mapa-escala-texto');
    if (!barra || !texto || !palco) return;
    var upp = vista.w / (palco.clientWidth || 1);
    var bruto = 80 * upp * DadosMapa.KM_POR_UNIDADE;
    var pot = Math.pow(10, Math.floor(Math.log10(bruto)));
    var bonito = pot;
    [1, 2, 5, 10].forEach(function (p) { if (p * pot <= bruto) bonito = p * pot; });
    barra.style.width = Math.round(bonito / DadosMapa.KM_POR_UNIDADE / upp) + 'px';
    texto.textContent = Math.round(bonito).toLocaleString('pt-BR') + ' km';
  }

  function enquadrar() {
    var a = aspecto();
    var largura = Math.max(RECORTE.largura, RECORTE.altura / a);
    vista = {
      x: RECORTE.x + RECORTE.largura / 2 - largura / 2,
      y: RECORTE.y + RECORTE.altura / 2 - (largura * a) / 2,
      w: largura, h: largura * a
    };
    aplicarVista();
  }

  function voarPara(x, y, larguraDesejada) {
    var alvo = larguraDesejada || LARGURA * 0.2;
    var ini = { x: vista.x, y: vista.y, w: vista.w };
    var fim = { x: x - alvo / 2, y: y - (alvo * aspecto()) / 2, w: alvo };
    var t0 = performance.now();
    function passo(agora) {
      var t = Math.min(1, (agora - t0) / 450);
      var e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      vista.x = ini.x + (fim.x - ini.x) * e;
      vista.y = ini.y + (fim.y - ini.y) * e;
      vista.w = ini.w + (fim.w - ini.w) * e;
      aplicarVista();
      if (t < 1) requestAnimationFrame(passo);
    }
    requestAnimationFrame(passo);
  }

  /* Em alguns casos (toque encerrado, evento sintético) o ponteiro já
     não existe mais e capturar lança. Não é motivo para derrubar nada. */
  function capturarPonteiro(id) {
    try { svg.setPointerCapture(id); } catch (e) { /* segue sem captura */ }
  }

  function coordenadas(evento) {
    var ctm = svg.getScreenCTM();
    if (!ctm) return [0, 0];
    var p = svg.createSVGPoint();
    p.x = evento.clientX; p.y = evento.clientY;
    var m = p.matrixTransform(ctm.inverse());
    return [Math.round(m.x * 100) / 100, Math.round(m.y * 100) / 100];
  }

  /* ---------------- a crônica ----------------
     O mapa guarda só o agora. A crônica dá memória a ele: o mestre
     registra um momento carimbado com a data artoniana, e depois dá
     para percorrer a linha do tempo e ver a guerra acontecer.
     Cada momento guarda apenas o que muda numa guerra — contorno,
     cor, quem manda — e não o texto das fichas, que pesaria à toa. */

  function momentos() {
    if (!Array.isArray(dados.cronica)) dados.cronica = [];
    return dados.cronica;
  }

  function acharMomento(id) {
    for (var i = 0; i < momentos().length; i++) {
      if (momentos()[i].id === id) return momentos()[i];
    }
    return null;
  }

  /* As nações que estão na tela: as de agora, ou as de um momento passado. */
  function nacoesEmCena() {
    if (!momentoVisto) return dados.nacoes;
    var m = acharMomento(momentoVisto);
    return m ? m.nacoes : dados.nacoes;
  }

  function vendoOPassado() { return momentoVisto !== null; }

  /* Pode mexer? Só no presente, e só sendo mestre. */
  function podeEditar() { return ehMestre() && !vendoOPassado(); }

  function registrarMomento() {
    if (!ehMestre()) return;
    var data = (typeof CalendarioJanela !== 'undefined')
      ? CalendarioJanela.dataAtual()
      : { ano: 1410, mes: 3, dia: 5, nimb: false };

    var titulo = prompt('O que aconteceu neste momento?\n\n' +
      'Ex.: "Yudennach cruza a fronteira", "Cerco de Valkaria"',
      'Momento de ' + CalendarioArton.formatarColoquial(data));
    if (titulo === null) return;

    var registro = {
      id: 'm' + Date.now().toString(36),
      data: data,
      rotulo: (titulo || '').trim() || CalendarioArton.formatarColoquial(data),
      criadoEm: Date.now(),
      nacoes: dados.nacoes.map(function (n) {
        return {
          id: n.id, nome: n.nome, cor: n.cor, categoria: n.categoria,
          poligono: JSON.parse(JSON.stringify(n.poligono || [])),
          rotulo: n.rotulo ? { x: n.rotulo.x, y: n.rotulo.y } : null,
          estadoGuerra: n.estadoGuerra || 'neutro',
          controladoPor: n.controladoPor || null,
          conhecido: n.conhecido !== false,
          visivel: n.visivel !== false
        };
      })
    };

    momentos().push(registro);
    momentos().sort(function (a, b) {
      return CalendarioArton.paraAbsoluto(a.data) - CalendarioArton.paraAbsoluto(b.data);
    });
    salvar();
    renderCronica();
    Interface.avisar('Momento registrado: ' + registro.rotulo);
  }

  function verMomento(id) {
    momentoVisto = id;
    selecao = null;
    editandoVertices = false;
    if (montado) {
      desenhar(); renderLista(); renderInspetor(); renderCronica();
      Interface.pintarPapel();
    }
  }

  function voltarAoPresente() {
    if (momentoVisto === null) return;
    momentoVisto = null;
    selecao = null;
    if (montado) {
      desenhar(); renderLista(); renderInspetor(); renderCronica();
      Interface.pintarPapel();
    }
  }

  function apagarMomento(id) {
    var m = acharMomento(id);
    if (!m || !ehMestre()) return;
    if (!confirm('Apagar o momento "' + m.rotulo + '" da crônica?')) return;
    dados.cronica = momentos().filter(function (o) { return o.id !== id; });
    if (momentoVisto === id) voltarAoPresente();
    salvar();
    renderCronica();
  }

  /* Traz um momento de volta para o presente: geometria e domínios
     voltam a valer, o resto da ficha fica como está hoje. */
  function restaurarMomento(id) {
    var m = acharMomento(id);
    if (!m || !ehMestre()) return;
    if (!confirm('Trazer "' + m.rotulo + '" de volta para o presente?\n\n' +
                 'As fronteiras e os domínios de agora serão substituídos pelos daquele dia.')) return;
    m.nacoes.forEach(function (antiga) {
      var atual = acharNacao(antiga.id);
      if (!atual) return;
      atual.poligono = JSON.parse(JSON.stringify(antiga.poligono));
      if (antiga.rotulo) atual.rotulo = { x: antiga.rotulo.x, y: antiga.rotulo.y };
      atual.estadoGuerra = antiga.estadoGuerra;
      atual.controladoPor = antiga.controladoPor;
      atual.conhecido = antiga.conhecido;
      atual.visivel = antiga.visivel;
    });
    momentoVisto = null;
    salvar();
    desenhar(); renderLista(); renderInspetor(); renderCronica();
    Interface.avisar('O mapa voltou a ' + CalendarioArton.formatarColoquial(m.data) + '.');
  }

  function renderCronica() {
    var caixa = $('#cronica');
    if (!caixa) return;
    var lista = momentos();
    var mestre = ehMestre();

    if (!lista.length && !mestre) { caixa.hidden = true; return; }
    caixa.hidden = false;

    var html = '<div class="cronica-inicio">' +
      (mestre ? '<button class="botao pequeno primario" id="cronica-registrar" ' +
                'title="Guarda o mapa de hoje na linha do tempo">📸 Registrar momento</button>' : '') +
      '<span class="cronica-titulo">Crônica da guerra</span></div>';

    html += '<div class="cronica-trilho">';
    if (!lista.length) {
      html += '<span class="cronica-vazia">Nenhum momento registrado ainda. ' +
              'Guarde o mapa de hoje e vá guardando conforme a guerra anda.</span>';
    } else {
      lista.forEach(function (m) {
        var ativo = momentoVisto === m.id;
        html += '<button class="cronica-marco' + (ativo ? ' ativo' : '') + '" data-momento="' +
          esc(m.id) + '" title="' + esc(m.rotulo) + '">' +
          '<span class="marco-ponto"></span>' +
          '<span class="marco-data">' + esc(CalendarioArton.formatarNumerica(m.data)) + '</span>' +
          '<span class="marco-rotulo">' + esc(m.rotulo) + '</span>' +
          '</button>';
      });
      html += '<button class="cronica-marco agora' + (momentoVisto === null ? ' ativo' : '') +
        '" data-momento="" title="Voltar para o mapa de hoje">' +
        '<span class="marco-ponto"></span>' +
        '<span class="marco-data">agora</span>' +
        '<span class="marco-rotulo">O presente</span></button>';
    }
    html += '</div>';

    caixa.innerHTML = html;

    var botaoRegistrar = $('#cronica-registrar', caixa);
    if (botaoRegistrar) botaoRegistrar.addEventListener('click', registrarMomento);

    $$('[data-momento]', caixa).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-momento');
        if (id) verMomento(id); else voltarAoPresente();
      });
    });

    // tarja avisando que o mapa é de outro dia
    var tarja = $('#tarja-cronica');
    if (tarja) {
      var m = momentoVisto ? acharMomento(momentoVisto) : null;
      tarja.hidden = !m;
      if (m) {
        tarja.innerHTML = '<span class="brasao-estado">🕰️</span>' +
          '<span><b>' + esc(m.rotulo) + '</b><br>' +
          'O mapa como estava em ' + esc(CalendarioArton.formatarColoquial(m.data)) +
          ' — nada aqui pode ser alterado.</span>' +
          '<span class="espaco" style="flex:1"></span>' +
          (ehMestre() ? '<button class="botao pequeno" data-restaurar>↩ Trazer para hoje</button>' +
                        '<button class="botao pequeno perigo" data-apagar-momento>Apagar</button>' : '') +
          '<button class="botao pequeno primario" data-presente>Voltar ao presente</button>';
        var r = $('[data-restaurar]', tarja);
        if (r) r.addEventListener('click', function () { restaurarMomento(m.id); });
        var a = $('[data-apagar-momento]', tarja);
        if (a) a.addEventListener('click', function () { apagarMomento(m.id); });
        $('[data-presente]', tarja).addEventListener('click', voltarAoPresente);
      }
    }
  }

  /* ---------------- a névoa ----------------
     O mapa não é onisciente: o que o grupo nunca viu fica velado como
     terra incógnita. O mestre revela conforme viajam, e pode espiar
     por baixo do véu para trabalhar sem revelar nada à mesa. */

  function nacaoVelada(n) {
    if (n.conhecido !== false) return false;
    if (ehMestre() && espiandoNevoa) return false;
    return true;
  }

  function tramaNevoa() {
    return garantirTrama('trama-nevoa', function (id) {
      var p = el('pattern', {
        id: id, width: 7, height: 7, patternUnits: 'userSpaceOnUse',
        patternTransform: 'rotate(45)', class: 'trama-guerra', 'data-passo': 7
      });
      p.appendChild(el('rect', { width: 7, height: 7, class: 'nevoa-fundo' }));
      p.appendChild(el('rect', { width: 2, height: 7, class: 'nevoa-risco', 'data-faixa': 2 }));
      return p;
    });
  }

  /* ---------------- as cores da guerra ---------------- */

  /* Território tomado é pintado com a cor do conquistador listrada sobre
     a do dono antigo — como num mapa de estratégia: dá para ver o que
     mudou de mão sem ler nada. Cada par de cores vira uma trama própria. */
  function idDeTrama(prefixo, a, b) {
    return prefixo + '-' + String(a).replace('#', '') + '-' + String(b).replace('#', '');
  }

  function garantirTrama(id, montar) {
    if (defsGuerra.querySelector('#' + id)) return 'url(#' + id + ')';
    defsGuerra.appendChild(montar(id));
    return 'url(#' + id + ')';
  }

  function tramaConquista(corDono, corAntiga) {
    return garantirTrama(idDeTrama('conq', corDono, corAntiga), function (id) {
      var p = el('pattern', {
        id: id, width: 9, height: 9, patternUnits: 'userSpaceOnUse',
        patternTransform: 'rotate(45)', class: 'trama-guerra', 'data-passo': 9
      });
      p.appendChild(el('rect', { width: 9, height: 9, fill: corDono }));
      p.appendChild(el('rect', { width: 3.4, height: 9, fill: corAntiga, 'data-faixa': 3.4 }));
      return p;
    });
  }

  function tramaRevolta(cor) {
    return garantirTrama(idDeTrama('revolta', cor, 'x'), function (id) {
      var p = el('pattern', {
        id: id, width: 8, height: 8, patternUnits: 'userSpaceOnUse',
        patternTransform: 'rotate(-45)', class: 'trama-guerra', 'data-passo': 8
      });
      p.appendChild(el('rect', { width: 8, height: 8, fill: cor }));
      p.appendChild(el('rect', { width: 2.6, height: 8, fill: '#1a0d0d',
                                 'fill-opacity': .55, 'data-faixa': 2.6 }));
      return p;
    });
  }

  function tramaArrasada(cor) {
    return garantirTrama(idDeTrama('arrasado', cor, 'x'), function (id) {
      var p = el('pattern', {
        id: id, width: 7, height: 7, patternUnits: 'userSpaceOnUse',
        class: 'trama-guerra', 'data-passo': 7
      });
      p.appendChild(el('rect', { width: 7, height: 7, fill: cor, 'fill-opacity': .5 }));
      p.appendChild(el('circle', { cx: 3.5, cy: 3.5, r: 1.2, fill: '#20140f',
                                   'fill-opacity': .6, 'data-faixa': 1.2 }));
      return p;
    });
  }

  function preenchimentoDaNacao(n) {
    if (nacaoVelada(n)) return tramaNevoa();
    var estado = n.estadoGuerra || 'neutro';
    if (estado === 'conquistado' && n.controladoPor && n.controladoPor !== n.id) {
      var dono = acharNacao(n.controladoPor);
      if (dono) return tramaConquista(dono.cor, n.cor);
    }
    if (estado === 'revolta') return tramaRevolta(n.cor);
    if (estado === 'arrasado') return tramaArrasada(n.cor);
    return n.cor;
  }

  /* As tramas vivem em unidades do mapa, então engordariam ao aproximar.
     Aqui elas são reescaladas para manter a mesma listra na tela. */
  function atualizarTramas() {
    if (!defsGuerra) return;
    var porPixel = pixelsPorUnidade();
    $$('.trama-guerra', defsGuerra).forEach(function (p) {
      var passo = parseFloat(p.getAttribute('data-passo')) || 8;
      var lado = passo / porPixel;
      p.setAttribute('width', lado.toFixed(2));
      p.setAttribute('height', lado.toFixed(2));
      $$('[data-faixa]', p).forEach(function (f) {
        var largura = parseFloat(f.getAttribute('data-faixa')) / porPixel;
        if (f.tagName === 'circle') {
          f.setAttribute('cx', (lado / 2).toFixed(2));
          f.setAttribute('cy', (lado / 2).toFixed(2));
          f.setAttribute('r', largura.toFixed(2));
        } else {
          f.setAttribute('width', largura.toFixed(2));
          f.setAttribute('height', lado.toFixed(2));
        }
      });
      $$('rect:not([data-faixa])', p).forEach(function (r) {
        r.setAttribute('width', lado.toFixed(2));
        r.setAttribute('height', lado.toFixed(2));
      });
    });
  }

  /* ---------------- desenho ---------------- */

  function categoriaVisivel(c) { return !categoriasOcultas[c]; }

  function desenhar() {
    if (!montado) return;
    camadaTerritorios.textContent = '';
    camadaCidades.textContent = '';
    camadaRotulos.textContent = '';

    var ordem = { mar: 0, regiao: 1, independente: 2, reinado: 3, tormenta: 4 };
    var nacoes = nacoesEmCena().slice().sort(function (a, b) {
      return (ordem[a.categoria] || 2) - (ordem[b.categoria] || 2);
    });

    defsGuerra.textContent = '';
    nacoes.forEach(function (n) {
      if (n.visivel === false || !categoriaVisivel(n.categoria)) return;
      if (!n.poligono || n.poligono.length < 3) return;
      var velada = nacaoVelada(n);
      var estado = velada ? 'neutro' : (n.estadoGuerra || 'neutro');
      var dono = (!velada && n.controladoPor) ? acharNacao(n.controladoPor) : null;
      camadaTerritorios.appendChild(el('polygon', {
        points: n.poligono.map(function (p) { return p[0] + ',' + p[1]; }).join(' '),
        fill: preenchimentoDaNacao(n),
        stroke: velada ? 'none' : ((estado === 'conquistado' && dono) ? dono.cor : n.cor),
        class: 'territorio categoria-' + n.categoria + ' guerra-' + estado +
               (velada ? ' velado' : '') +
               (n.conhecido === false && !velada ? ' espiado' : '') +
               (selecao && selecao.tipo === 'nacao' && selecao.id === n.id ? ' selecionado' : ''),
        'data-id': n.id
      }));
    });

    if (mostrarRotulos) {
      nacoes.forEach(function (n) {
        if (n.visivel === false || !categoriaVisivel(n.categoria) || !n.rotulo) return;
        var velada = nacaoVelada(n);
        var t = el('text', {
          x: n.rotulo.x, y: n.rotulo.y, 'font-size': 10.5,
          class: 'rotulo-nacao' + (velada ? ' rotulo-velado' : '')
        });
        t.textContent = velada ? 'Terra incógnita' : n.nome;
        camadaRotulos.appendChild(t);
      });
    }

    var cidadesEmCena = vendoOPassado() ? [] : dados.cidades;
    cidadesEmCena.forEach(function (c) {
      var n = acharNacao(c.nacao);
      if (n && (n.visivel === false || !categoriaVisivel(n.categoria))) return;
      if (n && nacaoVelada(n)) return;
      var tipo = TIPOS[c.tipo] || TIPOS.cidade;
      if (c.campanha) {
        camadaCidades.appendChild(el('circle', {
          cx: c.x, cy: c.y, r: tipo.raio * 2, class: 'halo-campanha', 'data-raio': tipo.raio
        }));
      }
      camadaCidades.appendChild(el('circle', {
        cx: c.x, cy: c.y, r: tipo.raio, fill: tipo.cor,
        class: 'marca-cidade' +
               (selecao && selecao.tipo === 'cidade' && selecao.id === c.id ? ' selecionada' : ''),
        'data-id': c.id, 'data-raio': tipo.raio
      }));
      if (mostrarRotulos) {
        var r = el('text', { x: c.x, y: c.y - tipo.raio - 2, class: 'rotulo-cidade', 'font-size': 7 });
        r.textContent = c.nome;
        camadaRotulos.appendChild(r);
      }
    });

    desenharTokens();
    desenharEdicao();
    atualizarTamanhos();
    atualizarTramas();
  }

  /* ---------------- heróis no mapa ---------------- */

  function desenharTokens() {
    if (!montado) return;
    camadaTokens.textContent = '';
    defsTokens.textContent = '';

    if (vendoOPassado()) return;   // os heróis estão no presente
    (dados.tokens || []).forEach(function (t) {
      if (t.visivel === false || t.x === null || t.x === undefined) return;
      var escolhido = selecao && selecao.tipo === 'token' && selecao.id === t.id;
      var grupo = el('g', {
        class: 'token' + (escolhido ? ' selecionado' : ''),
        'data-token': t.id,
        'data-tamanho': t.tamanho || 1,
        'data-x': t.x, 'data-y': t.y
      });

      var preenchimento = t.cor;
      if (t.foto) {
        /* O retrato entra como padrão de preenchimento: assim o círculo
           recorta a foto sozinho, sem precisar de um clipPath por posição. */
        var padrao = el('pattern', {
          id: 'retrato-' + t.id, width: 1, height: 1,
          patternContentUnits: 'objectBoundingBox'
        });
        var img = el('image', { width: 1, height: 1, preserveAspectRatio: 'xMidYMid slice' });
        img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', t.foto);
        img.setAttribute('href', t.foto);
        padrao.appendChild(img);
        defsTokens.appendChild(padrao);
        preenchimento = 'url(#retrato-' + t.id + ')';
      }

      grupo.appendChild(el('circle', {
        cx: t.x, cy: t.y, r: 9, fill: preenchimento,
        class: 'token-retrato', 'data-token': t.id
      }));
      grupo.appendChild(el('circle', {
        cx: t.x, cy: t.y, r: 9, fill: 'none', stroke: t.cor,
        class: 'token-aro', 'data-token': t.id
      }));

      if (!t.foto) {
        var inicial = el('text', {
          x: t.x, y: t.y, class: 'token-inicial', 'font-size': 9
        });
        inicial.textContent = (t.nome || '?').trim().charAt(0).toUpperCase() || '?';
        grupo.appendChild(inicial);
      }

      if (t.nome) {
        var nome = el('text', {
          x: t.x, y: t.y, 'data-y': t.y, class: 'token-nome', 'font-size': 6
        });
        nome.textContent = t.nome;
        grupo.appendChild(nome);
      }

      /* A alça de redimensionar: só aparece no herói selecionado, e só
         para o mestre. Puxe para longe do centro e o retrato cresce. */
      if (escolhido && ehMestre()) {
        grupo.appendChild(el('line', {
          x1: t.x, y1: t.y, x2: t.x, y2: t.y, class: 'token-guia'
        }));
        grupo.appendChild(el('circle', {
          cx: t.x, cy: t.y, r: 3,
          class: 'token-punho', 'data-punho': t.id
        }));
      }

      camadaTokens.appendChild(grupo);
    });
  }

  function renderTira() {
    var caixa = $('#tira-tokens');
    if (!caixa) return;
    caixa.textContent = '';
    var mestre = podeEditar();

    (dados.tokens || []).forEach(function (t) {
      var posto = t.x !== null && t.x !== undefined;
      var item = document.createElement('div');
      item.className = 'token-item' + (posto ? '' : ' fora') +
        (selecao && selecao.tipo === 'token' && selecao.id === t.id ? ' selecionado' : '');
      item.title = t.nome
        ? (posto ? t.nome + ' — clique para ir até ele' : t.nome + ' — fora do mapa')
        : (mestre ? 'Herói vazio — clique para configurar' : 'Herói ainda não definido');

      var retrato = document.createElement('span');
      retrato.className = 'token-retrato-mini';
      retrato.style.borderColor = t.cor;
      if (t.foto) {
        retrato.style.backgroundImage = 'url("' + t.foto + '")';
      } else {
        retrato.style.background = t.cor;
        retrato.textContent = (t.nome || '').trim().charAt(0).toUpperCase() || '·';
      }
      item.appendChild(retrato);

      var nome = document.createElement('span');
      nome.className = 'token-nome-mini';
      nome.textContent = t.nome || '—';
      item.appendChild(nome);

      if (mestre) {
        var editar = document.createElement('button');
        editar.className = 'token-editar';
        editar.textContent = '✎';
        editar.title = 'Nome, foto e cor';
        editar.addEventListener('click', function (e) {
          e.stopPropagation();
          abrirModalToken(t.id);
        });
        item.appendChild(editar);
      }

      item.addEventListener('click', function () {
        if (posto) selecionar('token', t.id, true);
        else if (mestre) {
          if (!t.nome) abrirModalToken(t.id);
          else porNoMapa(t.id);
        }
      });

      caixa.appendChild(item);
    });
  }

  /* Coloca o herói no meio da vista atual, pronto para ser arrastado. */
  function porNoMapa(id) {
    var t = acharToken(id);
    if (!t || !ehMestre()) return;
    t.x = Math.round((vista.x + vista.w / 2) * 10) / 10;
    t.y = Math.round((vista.y + vista.h / 2) * 10) / 10;
    t.visivel = true;
    salvar();
    desenhar(); renderTira();
    selecionar('token', id, false);
    Interface.avisar((t.nome || 'O herói') + ' entrou no mapa. Arraste para posicionar.');
  }

  /* ---------------- foto e recorte ---------------- */

  /* O enquadramento é do mestre, não do algoritmo: ele arrasta e aproxima
     dentro do círculo até achar o rosto. O que sai daqui já é o retrato
     final, pequeno, que a mesa inteira vai baixar. */
  var TELA = 360;          // resolução da área de recorte (o dobro do CSS, para telas densas)
  var SAIDA = 160;         // lado do retrato guardado
  var recorte = null;      // { img, escala, escalaMin, dx, dy, giro }

  function limitarDeslocamento() {
    if (!recorte) return;
    var d = dimensoesDesenhadas();
    var folgaX = Math.max(0, (d.largura - TELA) / 2);
    var folgaY = Math.max(0, (d.altura - TELA) / 2);
    recorte.dx = Math.max(-folgaX, Math.min(folgaX, recorte.dx));
    recorte.dy = Math.max(-folgaY, Math.min(folgaY, recorte.dy));
  }

  /* Com giro de 90° ou 270°, largura e altura trocam de lugar. */
  function dimensoesDesenhadas() {
    var deitado = recorte.giro % 180 !== 0;
    var w = deitado ? recorte.img.naturalHeight : recorte.img.naturalWidth;
    var h = deitado ? recorte.img.naturalWidth : recorte.img.naturalHeight;
    return { largura: w * recorte.escala, altura: h * recorte.escala };
  }

  function escalaMinima() {
    var deitado = recorte.giro % 180 !== 0;
    var w = deitado ? recorte.img.naturalHeight : recorte.img.naturalWidth;
    var h = deitado ? recorte.img.naturalWidth : recorte.img.naturalHeight;
    return Math.max(TELA / w, TELA / h);   // a foto sempre cobre o círculo
  }

  function pintarNoContexto(ctx, lado) {
    var fator = lado / TELA;
    ctx.save();
    ctx.clearRect(0, 0, lado, lado);
    ctx.translate(lado / 2 + recorte.dx * fator, lado / 2 + recorte.dy * fator);
    ctx.rotate(recorte.giro * Math.PI / 180);
    var e = recorte.escala * fator;
    var w = recorte.img.naturalWidth * e;
    var h = recorte.img.naturalHeight * e;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(recorte.img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function desenharRecorte() {
    var tela = $('#token-recorte');
    if (!tela || !recorte) return;
    limitarDeslocamento();
    pintarNoContexto(tela.getContext('2d'), TELA);
  }

  function exportarRecorte() {
    var tela = document.createElement('canvas');
    tela.width = SAIDA; tela.height = SAIDA;
    pintarNoContexto(tela.getContext('2d'), SAIDA);
    var saida = tela.toDataURL('image/webp', 0.82);
    if (saida.indexOf('data:image/webp') !== 0) {     // navegador sem webp
      saida = tela.toDataURL('image/jpeg', 0.85);
    }
    return saida;
  }

  function mostrarRecortador(mostrar) {
    var tela = $('#token-recorte'), mira = $('#token-mira');
    var previa = $('#token-previa'), controles = $('#controles-recorte');
    var dica = $('#dica-recorte');
    if (tela) tela.hidden = !mostrar;
    if (mira) mira.hidden = !mostrar;
    if (previa) previa.hidden = mostrar;
    if (controles) controles.hidden = !mostrar;
    if (dica) dica.hidden = mostrar;
  }

  function abrirRecortador(arquivo, aoFalhar) {
    if (!arquivo || !/^image\//.test(arquivo.type)) {
      aoFalhar('Escolha um arquivo de imagem.');
      return;
    }
    if (arquivo.size > 25 * 1024 * 1024) {
      aoFalhar('Essa imagem é grande demais (máximo 25 MB).');
      return;
    }
    var leitor = new FileReader();
    leitor.onerror = function () { aoFalhar('Não consegui ler o arquivo.'); };
    leitor.onload = function () {
      var img = new Image();
      img.onerror = function () { aoFalhar('Não consegui abrir essa imagem.'); };
      img.onload = function () {
        recorte = { img: img, giro: 0, dx: 0, dy: 0, escala: 1 };
        recorte.escalaMin = escalaMinima();
        recorte.escala = recorte.escalaMin;
        var zoom = $('#token-zoom');
        if (zoom) zoom.value = 100;
        mostrarRecortador(true);
        desenharRecorte();
        aoFalhar('');
      };
      img.src = String(leitor.result);
    };
    leitor.readAsDataURL(arquivo);
  }

  function aplicarZoom(porcento) {
    if (!recorte) return;
    recorte.escala = recorte.escalaMin * (porcento / 100);
    desenharRecorte();
  }

  function ligarRecortador() {
    var tela = $('#token-recorte');
    if (!tela) return;

    var puxando = null;
    tela.addEventListener('pointerdown', function (e) {
      if (!recorte) return;
      puxando = { x: e.clientX, y: e.clientY };
      try { tela.setPointerCapture(e.pointerId); } catch (err) { /* segue sem captura */ }
      tela.classList.add('arrastando');
    });
    tela.addEventListener('pointermove', function (e) {
      if (!puxando || !recorte) return;
      var f = TELA / tela.clientWidth;          // CSS -> pixels da tela
      recorte.dx += (e.clientX - puxando.x) * f;
      recorte.dy += (e.clientY - puxando.y) * f;
      puxando = { x: e.clientX, y: e.clientY };
      desenharRecorte();
    });
    function soltar(e) {
      if (!puxando) return;
      puxando = null;
      tela.classList.remove('arrastando');
      try { tela.releasePointerCapture(e.pointerId); } catch (err) { /* ok */ }
    }
    tela.addEventListener('pointerup', soltar);
    tela.addEventListener('pointercancel', soltar);

    tela.addEventListener('wheel', function (e) {
      if (!recorte) return;
      e.preventDefault();
      var zoom = $('#token-zoom');
      var atual = parseInt(zoom.value, 10);
      var novo = Math.max(100, Math.min(400, atual + (e.deltaY > 0 ? -12 : 12)));
      zoom.value = novo;
      aplicarZoom(novo);
    }, { passive: false });

    var zoom = $('#token-zoom');
    if (zoom) zoom.addEventListener('input', function () {
      aplicarZoom(parseInt(zoom.value, 10));
    });

    var girar = $('#token-girar');
    if (girar) girar.addEventListener('click', function () {
      if (!recorte) return;
      recorte.giro = (recorte.giro + 90) % 360;
      recorte.escalaMin = escalaMinima();
      var z = $('#token-zoom');
      recorte.escala = recorte.escalaMin * (parseInt(z.value, 10) / 100);
      var guardaDx = recorte.dx;
      recorte.dx = -recorte.dy;                 // o enquadramento gira junto
      recorte.dy = guardaDx;
      desenharRecorte();
    });

    var centralizar = $('#token-centralizar');
    if (centralizar) centralizar.addEventListener('click', function () {
      if (!recorte) return;
      recorte.dx = 0; recorte.dy = 0;
      recorte.escala = recorte.escalaMin;
      var z = $('#token-zoom');
      if (z) z.value = 100;
      desenharRecorte();
    });
  }

  function pintarPreviaToken() {
    var previa = $('#token-previa');
    if (!previa || !tokenEmEdicao) return;
    var t = acharToken(tokenEmEdicao);
    var foto = fotoEmEdicao !== null ? fotoEmEdicao : (t ? t.foto : null);
    previa.style.borderColor = t ? t.cor : 'var(--realce)';
    var mira = $('#token-mira');
    if (mira && t) mira.style.borderColor = t.cor;
    /* Sempre backgroundColor, nunca o atalho background: o atalho zera as
       sub-propriedades, e o "cover"/"center" que a folha de estilo dá ao
       .retrato-previa virava inline "auto"/"0% 0%". Como esta prévia é um
       elemento fixo do index.html — não é recriada a cada render, como os
       retratos da tira e da barra —, o estilo velho sobrevivia: quem abria
       um herói sem foto e escolhia uma via o retrato em tamanho natural,
       ladrilhado dentro do círculo. */
    if (foto) {
      previa.style.backgroundImage = 'url("' + foto + '")';
      previa.style.backgroundColor = 'transparent';
      previa.textContent = '';
    } else {
      previa.style.backgroundImage = 'none';
      previa.style.backgroundColor = t ? t.cor : 'var(--realce)';
      var nome = $('#token-nome');
      previa.textContent = ((nome && nome.value) || '').trim().charAt(0).toUpperCase() || '?';
    }
  }

  function abrirModalToken(id) {
    if (!ehMestre()) return;
    var t = acharToken(id);
    if (!t) return;
    tokenEmEdicao = id;
    fotoEmEdicao = null;
    recorte = null;
    mostrarRecortador(false);

    $('#token-nome').value = t.nome || '';
    $('#erro-token').textContent = '';
    $('#token-tirar-mapa').style.display = (t.x === null || t.x === undefined) ? 'none' : '';

    var paleta = $('#token-paleta');
    paleta.textContent = '';
    DadosMapa.CORES_TOKEN.forEach(function (cor) {
      var b = document.createElement('button');
      b.className = 'ficha-cor' + (t.cor === cor ? ' escolhida' : '');
      b.style.background = cor;
      b.type = 'button';
      b.addEventListener('click', function () {
        t.cor = cor;
        $$('.ficha-cor', paleta).forEach(function (o) { o.classList.remove('escolhida'); });
        b.classList.add('escolhida');
        pintarPreviaToken();
      });
      paleta.appendChild(b);
    });

    pintarPreviaToken();
    Interface.abrirModal('modal-token');
  }

  function ligarModalToken() {
    var campoNome = $('#token-nome');
    if (campoNome) campoNome.addEventListener('input', pintarPreviaToken);

    var escolher = $('#token-escolher-foto');
    if (escolher) escolher.addEventListener('click', function () {
      var entrada = document.createElement('input');
      entrada.type = 'file';
      entrada.accept = 'image/*';
      entrada.addEventListener('change', function () {
        var arquivo = entrada.files && entrada.files[0];
        if (!arquivo) return;
        $('#erro-token').textContent = 'Abrindo a imagem…';
        abrirRecortador(arquivo, function (mensagem) {
          $('#erro-token').textContent = mensagem;
        });
      });
      entrada.click();
    });

    var tirar = $('#token-tirar-foto');
    if (tirar) tirar.addEventListener('click', function () {
      fotoEmEdicao = '';
      recorte = null;
      mostrarRecortador(false);
      pintarPreviaToken();
    });

    var cancelar = $('#token-cancelar');
    if (cancelar) cancelar.addEventListener('click', function () {
      tokenEmEdicao = null; fotoEmEdicao = null; recorte = null;
      mostrarRecortador(false);
      Interface.fecharModal('modal-token');
    });

    var tirarMapa = $('#token-tirar-mapa');
    if (tirarMapa) tirarMapa.addEventListener('click', function () {
      var t = acharToken(tokenEmEdicao);
      if (!t) return;
      t.x = null; t.y = null;
      if (selecao && selecao.tipo === 'token' && selecao.id === t.id) selecao = null;
      salvar(); desenhar(); renderTira(); renderInspetor();
      Interface.fecharModal('modal-token');
      Interface.avisar((t.nome || 'O herói') + ' saiu do mapa.');
    });

    var salvarBotao = $('#token-salvar');
    if (salvarBotao) salvarBotao.addEventListener('click', function () {
      var t = acharToken(tokenEmEdicao);
      if (!t) return;
      t.nome = ($('#token-nome').value || '').trim();
      if (recorte) t.foto = exportarRecorte();          // enquadramento novo
      else if (fotoEmEdicao !== null) t.foto = fotoEmEdicao || null;
      tokenEmEdicao = null; fotoEmEdicao = null; recorte = null;
      mostrarRecortador(false);
      salvar(); desenhar(); renderTira(); renderInspetor();
      Interface.fecharModal('modal-token');
      Interface.avisar('Herói atualizado.');
    });
  }

  /* ---------------- edição no mapa ---------------- */

  function atualizarFaixaEdicao() {
    var faixa = $('#faixa-edicao');
    if (!faixa) return;
    var texto = null;
    if (ferramenta === 'territorio') {
      texto = '<b>Desenhando fronteira</b> — clique em cada canto. ' +
              'Duplo clique (ou Enter) fecha o território. Esc cancela.';
    } else if (editandoVertices && selecao && selecao.tipo === 'nacao') {
      var n = acharNacao(selecao.id);
      texto = '<b>Editando ' + esc(n ? n.nome : '') + '</b> — arraste os pontos ' +
              '<i class="amostra-vertice"></i> para mover a fronteira · clique num ' +
              '<i class="amostra-meio">+</i> para criar um ponto novo · ' +
              'Alt + clique num ponto para apagar · arraste de dentro para mover o reino inteiro';
    } else if (ferramenta === 'cidade') {
      texto = '<b>Nova cidade</b> — clique no lugar do mapa.';
    } else if (ferramenta === 'regua') {
      texto = '<b>Régua</b> — clique em dois pontos para medir.';
    }
    faixa.hidden = !texto;
    if (texto) faixa.innerHTML = texto;
  }

  function desenharEdicao() {
    if (!montado) return;
    atualizarFaixaEdicao();
    camadaEdicao.textContent = '';

    if (ferramenta === 'territorio' && rascunho.length) {
      if (rascunho.length >= 2) {
        camadaEdicao.appendChild(el('polygon', {
          points: rascunho.map(function (p) { return p[0] + ',' + p[1]; }).join(' '),
          class: 'linha-previa'
        }));
      }
      rascunho.forEach(function (p) {
        camadaEdicao.appendChild(el('circle', { cx: p[0], cy: p[1], r: 3.2, class: 'vertice' }));
      });
    }

    if (editandoVertices && selecao && selecao.tipo === 'nacao') {
      var n = acharNacao(selecao.id);
      if (n && n.poligono) {
        var pts = n.poligono;
        for (var i = 0; i < pts.length; i++) {
          var prox = pts[(i + 1) % pts.length];
          var mx = (pts[i][0] + prox[0]) / 2, my = (pts[i][1] + prox[1]) / 2;
          camadaEdicao.appendChild(el('circle', {
            cx: mx, cy: my, r: 2.2, class: 'vertice-meio', 'data-inserir': i
          }));
          /* O "+" diz o que o ponto faz. Fica por fora do teste de clique
             para não roubar o alvo do círculo debaixo. */
          var mais = el('text', { x: mx, y: my, 'data-y': my, class: 'sinal-meio', 'font-size': 4 });
          mais.textContent = '+';
          camadaEdicao.appendChild(mais);
        }
        pts.forEach(function (p, i) {
          camadaEdicao.appendChild(el('circle', {
            cx: p[0], cy: p[1], r: 3.2, class: 'vertice', 'data-vertice': i
          }));
        });
      }
    }

    if (regua.length) {
      regua.forEach(function (p) {
        camadaEdicao.appendChild(el('circle', { cx: p[0], cy: p[1], r: 3, class: 'ponto-regua' }));
      });
      if (regua.length === 2) {
        camadaEdicao.appendChild(el('line', {
          x1: regua[0][0], y1: regua[0][1], x2: regua[1][0], y2: regua[1][1], class: 'linha-regua'
        }));
        var km = distanciaKm(regua[0], regua[1]);
        var dias = Math.max(1, Math.round(km / DadosMapa.KM_POR_DIA_DE_VIAGEM));
        var meio = [(regua[0][0] + regua[1][0]) / 2, (regua[0][1] + regua[1][1]) / 2];
        var t = el('text', { x: meio[0], y: meio[1] - 5, class: 'texto-regua', 'font-size': 10 });
        t.textContent = Math.round(km).toLocaleString('pt-BR') + ' km · ' +
                        dias + (dias === 1 ? ' dia' : ' dias') + ' de viagem';
        camadaEdicao.appendChild(t);
      }
    }
    atualizarTamanhos();
  }

  /* ---------------- seleção ---------------- */

  function selecionar(tipo, id, voar) {
    selecao = id ? { tipo: tipo, id: id } : null;
    if (!selecao || selecao.tipo !== 'nacao') editandoVertices = false;
    desenhar();
    renderInspetor();
    renderLista();
    renderTira();
    if (selecao) mostrarFichaNoCelular();

    if (!voar || !selecao) return;
    if (tipo === 'token') {
      var t = acharToken(id);
      if (t && t.x !== null) voarPara(t.x, t.y, LARGURA * 0.12);
    } else if (tipo === 'cidade') {
      var c = acharCidade(id);
      if (c) voarPara(c.x, c.y, LARGURA * 0.14);
    } else {
      var n = acharNacao(id);
      if (n && n.poligono && n.poligono.length) {
        var xs = n.poligono.map(function (p) { return p[0]; });
        var ys = n.poligono.map(function (p) { return p[1]; });
        var lx = Math.max.apply(null, xs) - Math.min.apply(null, xs);
        var ly = Math.max.apply(null, ys) - Math.min.apply(null, ys);
        var c2 = centroide(n.poligono);
        voarPara(c2[0], c2[1], Math.max(lx, ly * (LARGURA / ALTURA)) * 2.3);
      }
    }
  }

  /* ---------------- lista ---------------- */

  function renderFiltros() {
    var caixa = $('#mapa-filtros');
    if (!caixa) return;
    caixa.textContent = '';
    Object.keys(CATEGORIAS)
      .sort(function (a, b) { return CATEGORIAS[a].ordem - CATEGORIAS[b].ordem; })
      .forEach(function (chave) {
        var b = document.createElement('button');
        b.className = 'filtro' + (categoriaVisivel(chave) ? ' ativa' : '');
        b.textContent = CATEGORIAS[chave].rotulo;
        b.addEventListener('click', function () {
          categoriasOcultas[chave] = !categoriasOcultas[chave];
          renderFiltros(); desenhar(); renderLista();
        });
        caixa.appendChild(b);
      });
  }

  function renderLista() {
    var caixa = $('#mapa-lista');
    if (!caixa) return;
    caixa.textContent = '';

    var grupos = {};
    nacoesEmCena().forEach(function (n) {
      if (!categoriaVisivel(n.categoria)) return;
      (grupos[n.categoria] = grupos[n.categoria] || []).push(n);
    });
    var chaves = Object.keys(grupos).sort(function (a, b) {
      return (CATEGORIAS[a] ? CATEGORIAS[a].ordem : 9) - (CATEGORIAS[b] ? CATEGORIAS[b].ordem : 9);
    });

    if (!chaves.length) {
      caixa.innerHTML = '<div class="vazio">Nenhuma categoria visível.<br>Use os filtros acima.</div>';
      return;
    }

    chaves.forEach(function (chave) {
      var grupo = document.createElement('div');
      grupo.className = 'grupo-lista';
      var h = document.createElement('h3');
      h.textContent = (CATEGORIAS[chave] || {}).rotulo || chave;
      grupo.appendChild(h);
      grupos[chave]
        .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); })
        .forEach(function (n) { grupo.appendChild(itemNacao(n)); });
      caixa.appendChild(grupo);
    });

    var resumo = $('#mapa-resumo');
    if (resumo) resumo.textContent = dados.nacoes.length + ' · ' + dados.cidades.length;
  }

  function itemNacao(nacao) {
    var selecionada = selecao && selecao.tipo === 'nacao' && selecao.id === nacao.id;
    var cidades = cidadesDe(nacao.id);
    var expandida = selecionada ||
      (selecao && selecao.tipo === 'cidade' && (acharCidade(selecao.id) || {}).nacao === nacao.id);

    var raizItem = document.createElement('div');
    raizItem.className = 'item-nacao' + (selecionada ? ' selecionada' : '') +
                         (nacao.visivel === false ? ' invisivel' : '');

    var cabeca = document.createElement('div');
    cabeca.className = 'cabeca';

    var pastilha = document.createElement('span');
    pastilha.className = 'pastilha';
    var quemManda = (!nacaoVelada(nacao) && nacao.estadoGuerra === 'conquistado' && nacao.controladoPor)
      ? acharNacao(nacao.controladoPor) : null;
    if (quemManda) {
      // metade da cor de quem tomou, metade da cor de quem perdeu
      pastilha.style.background =
        'linear-gradient(135deg, ' + quemManda.cor + ' 0 55%, ' + nacao.cor + ' 55% 100%)';
    } else if (nacaoVelada(nacao)) {
      pastilha.style.background = 'var(--borda-forte)';
    } else {
      pastilha.style.background = nacao.cor;
    }

    if (nacao.brasao && !nacaoVelada(nacao) && typeof Heraldica !== 'undefined') {
      var mini = document.createElement('span');
      mini.className = 'brasao-mini';
      mini.appendChild(Heraldica.escudo(nacao.brasao, { cor: nacao.cor, nome: nacao.nome }));
      cabeca.appendChild(mini);
    } else {
      cabeca.appendChild(pastilha);
    }

    var velada = nacaoVelada(nacao);
    var nome = document.createElement('span');
    nome.className = 'nome' + (velada ? ' nome-velado' : '');
    nome.textContent = velada ? 'Terra incógnita' : nacao.nome;
    cabeca.appendChild(nome);

    if (nacao.conhecido === false && !velada) {
      var olhoEspiado = document.createElement('span');
      olhoEspiado.className = 'selo-guerra';
      olhoEspiado.textContent = '🌫️';
      olhoEspiado.title = 'Velado para a mesa — você está espiando';
      cabeca.appendChild(olhoEspiado);
    }

    var estado = velada ? 'neutro' : (nacao.estadoGuerra || 'neutro');
    if (estado !== 'neutro') {
      var selo = document.createElement('span');
      selo.className = 'selo-guerra selo-' + estado;
      selo.textContent = GUERRA[estado].icone;
      var dono = nacao.controladoPor ? acharNacao(nacao.controladoPor) : null;
      selo.title = GUERRA[estado].rotulo + (dono ? ' — sob domínio de ' + dono.nome : '');
      cabeca.appendChild(selo);
    }

    if (cidades.length) {
      var cont = document.createElement('span');
      cont.className = 'contagem';
      cont.textContent = cidades.length;
      cabeca.appendChild(cont);
    }

    var olho = document.createElement('button');
    olho.className = 'olho';
    olho.textContent = nacao.visivel === false ? '🚫' : '👁';
    olho.title = nacao.visivel === false ? 'Mostrar no mapa' : 'Ocultar do mapa';
    olho.addEventListener('click', function (e) {
      e.stopPropagation();
      nacao.visivel = nacao.visivel === false;
      salvar(); desenhar(); renderLista();
    });
    cabeca.appendChild(olho);

    cabeca.addEventListener('click', function () { selecionar('nacao', nacao.id, true); });
    raizItem.appendChild(cabeca);

    if (expandida && cidades.length) {
      var lista = document.createElement('div');
      lista.className = 'lista-cidades';
      var pesos = { capital: 0, cidade: 1, fortaleza: 2, vila: 3, ruina: 4, local: 5 };
      cidades.sort(function (a, b) {
        var d = (pesos[a.tipo] || 9) - (pesos[b.tipo] || 9);
        return d !== 0 ? d : a.nome.localeCompare(b.nome, 'pt-BR');
      }).forEach(function (c) {
        var tipo = TIPOS[c.tipo] || TIPOS.cidade;
        var linha = document.createElement('div');
        linha.className = 'item-cidade' +
          (selecao && selecao.tipo === 'cidade' && selecao.id === c.id ? ' selecionada' : '');
        linha.innerHTML = '<span class="ponto" style="background:' + esc(tipo.cor) + '"></span>' +
          '<span>' + esc(c.nome) + (c.campanha ? ' ⚔️' : '') + '</span>' +
          '<span class="rotulo-tipo">' + esc(tipo.rotulo) + '</span>';
        linha.addEventListener('click', function () { selecionar('cidade', c.id, true); });
        lista.appendChild(linha);
      });
      raizItem.appendChild(lista);
    }
    return raizItem;
  }

  /* ---------------- inspetor ---------------- */

  function renderInspetor() {
    var caixa = $('#mapa-inspetor');
    if (!caixa) return;
    if (!selecao) {
      caixa.innerHTML = '<div class="vazio">Clique num território, cidade<br>ou herói para ver os detalhes.</div>';
      return;
    }
    if (selecao.tipo === 'nacao') renderInspetorNacao(caixa, acharNacao(selecao.id));
    else if (selecao.tipo === 'token') renderInspetorToken(caixa, acharToken(selecao.id));
    else renderInspetorCidade(caixa, acharCidade(selecao.id));
  }

  function renderInspetorToken(caixa, t) {
    if (!t) { caixa.innerHTML = ''; return; }
    var onde = localDoPonto([t.x, t.y]);
    var html =
      '<div class="inspetor-topo">' +
        '<span class="retrato-inspetor" style="border-color:' + esc(t.cor) + ';' +
          (t.foto ? 'background-image:url(&quot;' + esc(t.foto) + '&quot;)'
                  : 'background:' + esc(t.cor)) + '">' +
          (t.foto ? '' : esc((t.nome || '?').charAt(0).toUpperCase())) + '</span>' +
        '<div><h2>' + esc(t.nome || 'Herói sem nome') + '</h2>' +
        '<div class="sub">Membro do grupo</div></div>' +
      '</div>' +
      '<dl class="ficha">' +
        (onde.nacao ? '<dt>Território</dt><dd>' + esc(onde.nacao) + '</dd>' : '') +
        (onde.perto ? '<dt>Perto de</dt><dd>' + esc(onde.perto) + '</dd>' : '') +
        '<dt>Posição</dt><dd>' + t.x.toFixed(1) + ' , ' + t.y.toFixed(1) + '</dd>' +
      '</dl>';

    if (podeEditar()) {
      html += '<div class="secao"><h4>Este herói</h4>' +
        '<div class="aviso-edicao">Arraste o retrato para mostrar onde o grupo está. ' +
        'Puxe o alfinete na quina para mudar o tamanho.</div>' +
        '<label class="campo"><span>Tamanho do retrato</span>' +
          '<input type="range" id="token-escala" min="40" max="400" step="5" value="' +
          Math.round((t.tamanho || 1) * 100) + '"></label>' +
        '<div class="grupo-botoes">' +
          '<button class="botao" data-editar-token>✎ Nome, foto e cor</button>' +
          '<button class="botao perigo" data-tirar-token>Tirar do mapa</button>' +
        '</div></div>';
    }
    caixa.innerHTML = html;

    var escala = $('#token-escala', caixa);
    if (escala) escala.addEventListener('input', function () {
      t.tamanho = parseInt(escala.value, 10) / 100;
      desenharTokens(); atualizarTamanhosTokens(); salvar();
    });

    var editar = $('[data-editar-token]', caixa);
    if (editar) editar.addEventListener('click', function () { abrirModalToken(t.id); });
    var tirar = $('[data-tirar-token]', caixa);
    if (tirar) tirar.addEventListener('click', function () {
      t.x = null; t.y = null; selecao = null;
      salvar(); desenhar(); renderTira(); renderInspetor();
    });
  }

  /* Onde, afinal, o herói está? */
  function localDoPonto(p) {
    var saida = { nacao: null, perto: null };
    var idNacao = nacaoQueContem(p);
    if (idNacao) {
      var n = acharNacao(idNacao);
      if (n) saida.nacao = n.nome;
    }
    var melhor = null, menor = Infinity;
    dados.cidades.forEach(function (c) {
      var d = distanciaKm([c.x, c.y], p);
      if (d < menor) { menor = d; melhor = c; }
    });
    if (melhor && menor < 600) {
      saida.perto = melhor.nome + ' (' + Math.round(menor).toLocaleString('pt-BR') + ' km)';
    }
    return saida;
  }

  function renderInspetorNacao(caixa, nacao) {
    if (!nacao) { caixa.innerHTML = ''; return; }
    if (nacaoVelada(nacao)) {
      caixa.innerHTML = '<div class="inspetor-topo">' +
        '<span class="pastilha-grande" style="background:var(--borda-forte)"></span>' +
        '<div><h2>Terra incógnita</h2><div class="sub">ninguém do grupo esteve aqui</div></div></div>' +
        '<div class="texto-notas">Os mapas do Reinado não dizem nada sobre estas terras. ' +
        'Quem sabe alguém na estrada saiba contar.</div>';
      return;
    }
    var mestre = podeEditar();
    var cidades = cidadesDe(nacao.id);
    var capital = nacao.capital ? acharCidade(nacao.capital) : null;

    var html =
      '<div class="inspetor-topo">' +
        '<span class="lugar-brasao" data-brasao-ficha></span>' +
        '<div><h2>' + esc(nacao.nome) + '</h2>' +
        (nacao.nomeOficial ? '<div class="sub">' + esc(nacao.nomeOficial) + '</div>' : '') +
        '</div></div>' +
      (estadoDeGuerraEmTexto(nacao) || '') +
      '<dl class="ficha">' +
        (capital ? '<dt>Capital</dt><dd>' + esc(capital.nome) + '</dd>' : '') +
        (nacao.governo && nacao.governo !== '—' ? '<dt>Governo</dt><dd>' + esc(nacao.governo) + '</dd>' : '') +
        (nacao.regente && nacao.regente !== '—' ? '<dt>Regente</dt><dd>' + esc(nacao.regente) + '</dd>' : '') +
        (nacao.populacao && nacao.populacao !== '—' ? '<dt>População</dt><dd>' + esc(nacao.populacao) + '</dd>' : '') +
        '<dt>Locais</dt><dd>' + cidades.length + '</dd>' +
      '</dl>' +
      (nacao.notas ? '<div class="texto-notas">' + esc(nacao.notas) + '</div>' : '');

    if (mestre) {
      html +=
        '<div class="secao"><h4>Editar território</h4>' +
        '<label class="campo"><span>Nome</span><input type="text" data-editar="nome" value="' + esc(nacao.nome) + '"></label>' +
        '<label class="campo"><span>Nome oficial</span><input type="text" data-editar="nomeOficial" value="' + esc(nacao.nomeOficial || '') + '"></label>' +
        '<div class="linha-campos">' +
          '<label class="campo"><span>Categoria</span><select data-editar="categoria">' +
            Object.keys(CATEGORIAS).map(function (k) {
              return '<option value="' + k + '"' + (nacao.categoria === k ? ' selected' : '') +
                     '>' + esc(CATEGORIAS[k].rotulo) + '</option>';
            }).join('') + '</select></label>' +
          '<label class="campo"><span>Cor</span><input type="color" data-editar="cor" value="' + esc(corHex(nacao.cor)) + '"></label>' +
        '</div>' +
        '<div class="linha-campos">' +
          '<label class="campo"><span>Governo</span><input type="text" data-editar="governo" value="' + esc(nacao.governo || '') + '"></label>' +
          '<label class="campo"><span>População</span><input type="text" data-editar="populacao" value="' + esc(nacao.populacao || '') + '"></label>' +
        '</div>' +
        '<label class="campo"><span>Regente</span><input type="text" data-editar="regente" value="' + esc(nacao.regente || '') + '"></label>' +
        '<label class="campo"><span>Capital</span><select data-editar="capital"><option value="">— nenhuma —</option>' +
          cidades.map(function (c) {
            return '<option value="' + esc(c.id) + '"' + (nacao.capital === c.id ? ' selected' : '') +
                   '>' + esc(c.nome) + '</option>';
          }).join('') + '</select></label>' +
        '<label class="campo"><span>Notas</span><textarea data-editar="notas" rows="5">' + esc(nacao.notas || '') + '</textarea></label>' +
        '</div>' +

        '<div class="secao"><h4>Névoa</h4>' +
        '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:2px 0 8px">' +
          '<input type="checkbox" data-conhecido ' + (nacao.conhecido !== false ? 'checked' : '') + '>' +
          '<span>O grupo conhece esta terra</span></label>' +
        '<div class="aviso-edicao">Desmarcado, o território vira <b>terra incógnita</b> para a mesa: ' +
        'sem nome, sem cor, sem cidades. Use 🌫️ na barra de ferramentas para espiar por baixo ' +
        'sem revelar nada.</div>' +
        '</div>' +

        '<div class="secao"><h4>Estado de guerra</h4>' +
        '<div class="linha-campos">' +
          '<label class="campo"><span>Situação</span><select data-editar="estadoGuerra">' +
            Object.keys(GUERRA).sort(function (a, b) { return GUERRA[a].ordem - GUERRA[b].ordem; })
              .map(function (k) {
                return '<option value="' + k + '"' +
                  ((nacao.estadoGuerra || 'neutro') === k ? ' selected' : '') + '>' +
                  GUERRA[k].icone + ' ' + esc(GUERRA[k].rotulo) + '</option>';
              }).join('') + '</select></label>' +
          '<label class="campo"><span>Sob domínio de</span><select data-editar="controladoPor">' +
            '<option value="">— ninguém —</option>' +
            dados.nacoes.filter(function (o) {
              return o.id !== nacao.id && o.categoria !== 'mar' && o.categoria !== 'tormenta';
            }).sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); })
              .map(function (o) {
                return '<option value="' + esc(o.id) + '"' +
                  (nacao.controladoPor === o.id ? ' selected' : '') + '>' + esc(o.nome) + '</option>';
              }).join('') + '</select></label>' +
        '</div>' +
        '<div class="aviso-edicao">Marque <b>Conquistado</b> e escolha quem tomou a terra: ' +
        'o território passa a ser pintado com as cores do conquistador listradas sobre as ' +
        'do dono antigo.</div>' +
        '</div>' +

        '<div class="secao"><h4>Expansão e fronteiras</h4>' +
        '<div class="aviso-edicao">Ligue o contorno para arrastar os pontos da fronteira. Clique nos pontos claros entre dois vértices para criar um novo; Alt + clique remove.</div>' +
        '<div class="grupo-botoes">' +
          '<button class="botao ' + (editandoVertices ? 'primario' : '') + '" data-acao="vertices">' +
            (editandoVertices ? '✓ Editando' : '✏️ Editar contorno') + '</button>' +
          '<button class="botao" data-acao="expandir">⊕ Expandir</button>' +
          '<button class="botao" data-acao="encolher">⊖ Encolher</button>' +
        '</div>' +
        '<div class="grupo-botoes" style="margin-top:6px">' +
          '<button class="botao" data-acao="rotulo">🏷️ Recolocar rótulo</button>' +
          '<button class="botao perigo" data-acao="apagar">Excluir</button>' +
        '</div></div>';
    }

    if (nacao.brasao) {
      html += '<div class="secao"><h4>Brasão</h4>' +
        '<p class="texto-brasao">' + esc(nacao.brasao) + '</p></div>';
    }

    if (cidades.length) html += '<div class="secao"><h4>Locais</h4><div id="mapa-mini"></div></div>';
    caixa.innerHTML = html;

    // o escudo é desenhado a partir da descrição heráldica do Atlas
    var lugar = $('[data-brasao-ficha]', caixa);
    if (lugar && typeof Heraldica !== 'undefined') {
      lugar.appendChild(Heraldica.escudo(nacao.brasao, { cor: nacao.cor, nome: nacao.nome }));
    } else if (lugar) {
      lugar.style.background = nacao.cor;
    }

    if (cidades.length) {
      var mini = $('#mapa-mini', caixa);
      cidades.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); })
        .forEach(function (c) {
          var tipo = TIPOS[c.tipo] || TIPOS.cidade;
          var linha = document.createElement('div');
          linha.className = 'item-cidade';
          linha.innerHTML = '<span class="ponto" style="background:' + esc(tipo.cor) + '"></span>' +
            '<span>' + esc(c.nome) + (c.campanha ? ' ⚔️' : '') + '</span>' +
            '<span class="rotulo-tipo">' + esc(tipo.rotulo) + '</span>';
          linha.addEventListener('click', function () { selecionar('cidade', c.id, true); });
          mini.appendChild(linha);
        });
    }

    if (mestre) ligarEdicaoNacao(caixa, nacao);
  }

  /* Uma tarja no alto da ficha quando a terra não está em paz. */
  function estadoDeGuerraEmTexto(nacao) {
    var estado = nacao.estadoGuerra || 'neutro';
    if (estado === 'neutro') return '';
    var info = GUERRA[estado] || GUERRA.neutro;
    var dono = nacao.controladoPor ? acharNacao(nacao.controladoPor) : null;
    return '<div class="tarja-guerra tarja-' + estado + '">' +
      '<span class="brasao-estado">' + info.icone + '</span>' +
      '<span><b>' + esc(info.rotulo) + '</b>' +
      (estado === 'conquistado' && dono
        ? '<br>sob domínio de ' + esc(dono.nome)
        : '') + '</span></div>';
  }

  function ligarEdicaoNacao(caixa, nacao) {
    $$('[data-editar]', caixa).forEach(function (campo) {
      var evento = campo.tagName === 'SELECT' || campo.type === 'color' ? 'change' : 'input';
      campo.addEventListener(evento, function () {
        var chave = campo.getAttribute('data-editar');
        nacao[chave] = campo.value;
        salvar(); desenhar(); renderLista();
        if (chave === 'categoria') { renderFiltros(); renderInspetor(); }
      });
    });

    var marcaConhecido = $('[data-conhecido]', caixa);
    if (marcaConhecido) marcaConhecido.addEventListener('change', function () {
      nacao.conhecido = marcaConhecido.checked;
      salvar(); desenhar(); renderLista();
      Interface.avisar(nacao.conhecido
        ? nacao.nome + ' foi revelado à mesa.'
        : nacao.nome + ' sumiu do mapa dos jogadores.');
    });

    var acoes = {
      vertices: function () { editandoVertices = !editandoVertices; desenharEdicao(); renderInspetor(); },
      expandir: function () {
        nacao.poligono = escalarPoligono(nacao.poligono, 1.06);
        salvar(); desenhar();
        Interface.avisar(nacao.nome + ' avança sobre as terras vizinhas.');
      },
      encolher: function () {
        nacao.poligono = escalarPoligono(nacao.poligono, 0.94);
        salvar(); desenhar();
        Interface.avisar(nacao.nome + ' recua suas fronteiras.');
      },
      rotulo: function () {
        var c = centroide(nacao.poligono);
        nacao.rotulo = { x: Math.round(c[0] * 10) / 10, y: Math.round(c[1] * 10) / 10 };
        salvar(); desenhar();
      },
      apagar: function () {
        var q = cidadesDe(nacao.id).length;
        if (!confirm('Excluir "' + nacao.nome + '"?' +
            (q ? '\n\nAs ' + q + ' cidades dele ficarão sem território.' : ''))) return;
        dados.nacoes = dados.nacoes.filter(function (n) { return n.id !== nacao.id; });
        dados.cidades.forEach(function (c) { if (c.nacao === nacao.id) c.nacao = null; });
        selecao = null;
        salvar(); desenhar(); renderLista(); renderInspetor();
      }
    };
    $$('[data-acao]', caixa).forEach(function (b) {
      var a = acoes[b.getAttribute('data-acao')];
      if (a) b.addEventListener('click', a);
    });
  }

  function renderInspetorCidade(caixa, cidade) {
    if (!cidade) { caixa.innerHTML = ''; return; }
    var mestre = podeEditar();
    var tipo = TIPOS[cidade.tipo] || TIPOS.cidade;
    var nacao = acharNacao(cidade.nacao);

    var html =
      '<div class="inspetor-topo">' +
        '<span class="pastilha-grande" style="background:' + esc(tipo.cor) + '"></span>' +
        '<div><h2>' + esc(cidade.nome) + '</h2><div class="sub">' + esc(tipo.rotulo) +
        (nacao ? ' · ' + esc(nacao.nome) : ' · sem território') + '</div></div></div>' +
      (cidade.campanha ? '<div class="aviso-edicao">⚔️ Palco de campanha — é aqui que a história acontece.</div>' : '') +
      (cidade.notas ? '<div class="texto-notas">' + esc(cidade.notas) + '</div>' : '');

    if (mestre) {
      html +=
        '<div class="secao"><h4>Editar local</h4>' +
        '<label class="campo"><span>Nome</span><input type="text" data-editar="nome" value="' + esc(cidade.nome) + '"></label>' +
        '<div class="linha-campos">' +
          '<label class="campo"><span>Tipo</span><select data-editar="tipo">' +
            Object.keys(TIPOS).map(function (k) {
              return '<option value="' + k + '"' + (cidade.tipo === k ? ' selected' : '') +
                     '>' + esc(TIPOS[k].rotulo) + '</option>';
            }).join('') + '</select></label>' +
          '<label class="campo"><span>Território</span><select data-editar="nacao"><option value="">— nenhum —</option>' +
            dados.nacoes.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); })
              .map(function (n) {
                return '<option value="' + esc(n.id) + '"' + (cidade.nacao === n.id ? ' selected' : '') +
                       '>' + esc(n.nome) + '</option>';
              }).join('') + '</select></label>' +
        '</div>' +
        '<label class="campo"><span>Notas</span><textarea data-editar="notas" rows="5">' + esc(cidade.notas || '') + '</textarea></label>' +
        '<label style="display:flex;align-items:center;gap:8px;font-size:13px;margin:10px 0">' +
          '<input type="checkbox" data-campanha ' + (cidade.campanha ? 'checked' : '') + '>' +
          '<span>Palco de campanha ⚔️</span></label>' +
        '<div class="discreto">Arraste o marcador no mapa para reposicionar.</div>' +
        '<div class="grupo-botoes" style="margin-top:10px">' +
          '<button class="botao perigo" data-apagar>Excluir local</button></div>' +
        '</div>';
    }

    caixa.innerHTML = html;
    if (!mestre) return;

    $$('[data-editar]', caixa).forEach(function (campo) {
      var evento = campo.tagName === 'SELECT' ? 'change' : 'input';
      campo.addEventListener(evento, function () {
        var chave = campo.getAttribute('data-editar');
        cidade[chave] = campo.value || (chave === 'nacao' ? null : '');
        salvar(); desenhar(); renderLista();
      });
    });

    var marca = $('[data-campanha]', caixa);
    if (marca) marca.addEventListener('change', function () {
      cidade.campanha = marca.checked;
      salvar(); desenhar(); renderLista(); renderInspetor();
    });

    var apagar = $('[data-apagar]', caixa);
    if (apagar) apagar.addEventListener('click', function () {
      if (!confirm('Excluir "' + cidade.nome + '"?')) return;
      dados.cidades = dados.cidades.filter(function (c) { return c.id !== cidade.id; });
      dados.nacoes.forEach(function (n) { if (n.capital === cidade.id) n.capital = null; });
      selecao = null;
      salvar(); desenhar(); renderLista(); renderInspetor();
    });
  }

  function corHex(cor) {
    if (/^#[0-9a-f]{6}$/i.test(cor)) return cor;
    if (/^#[0-9a-f]{3}$/i.test(cor)) return '#' + cor[1] + cor[1] + cor[2] + cor[2] + cor[3] + cor[3];
    return '#888888';
  }

  /* ---------------- interação ---------------- */

  /* No celular não existe roda do mouse. Dois dedos aproximam e afastam,
     mantendo fixo o ponto no meio deles — é o gesto que todo mundo espera
     de um mapa. */
  function distanciaEntreDedos() {
    var ids = Object.keys(dedos);
    if (ids.length < 2) return null;
    var a = dedos[ids[0]], b = dedos[ids[1]];
    return {
      distancia: Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2)),
      meio: { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }
    };
  }

  function comecarPinca() {
    var medida = distanciaEntreDedos();
    if (!medida || medida.distancia < 8) return;
    // a pinça manda: cancela qualquer arrasto de um dedo só
    arrasto = null;
    svg.classList.remove('arrastando');
    pinca = { distancia: medida.distancia, largura: vista.w };
  }

  function seguirPinca() {
    var medida = distanciaEntreDedos();
    if (!pinca || !medida || medida.distancia < 8) return;
    var antes = coordenadas(medida.meio);
    vista.w = pinca.largura * (pinca.distancia / medida.distancia);
    aplicarVista();
    var depois = coordenadas(medida.meio);
    vista.x += antes[0] - depois[0];
    vista.y += antes[1] - depois[1];
    aplicarVista();
  }

  function ligarSvg() {
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var antes = coordenadas(e);
      vista.w /= Math.exp((e.deltaY > 0 ? 1 : -1) * -0.16);
      aplicarVista();
      var depois = coordenadas(e);
      vista.x += antes[0] - depois[0];
      vista.y += antes[1] - depois[1];
      aplicarVista();
    }, { passive: false });

    svg.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      dedos[e.pointerId] = { x: e.clientX, y: e.clientY };
      if (Object.keys(dedos).length === 2) { comecarPinca(); return; }
      if (pinca) return;
      var alvo = e.target, ponto = coordenadas(e);

      if (ferramenta === 'territorio' && podeEditar()) { rascunho.push(ponto); desenharEdicao(); return; }
      if (ferramenta === 'cidade' && podeEditar()) { criarCidade(ponto); return; }
      if (ferramenta === 'regua') {
        if (regua.length >= 2) regua = [];
        regua.push(ponto); desenharEdicao(); return;
      }

      // --- alça de tamanho do herói ---
      if (alvo.hasAttribute && alvo.hasAttribute('data-punho') && podeEditar()) {
        arrasto = { tipo: 'tamanho', token: acharToken(alvo.getAttribute('data-punho')), moveu: false };
        capturarPonteiro(e.pointerId);
        return;
      }

      // --- herói ---
      if (alvo.hasAttribute && alvo.hasAttribute('data-token')) {
        var idt = alvo.getAttribute('data-token');
        selecionar('token', idt, false);
        if (podeEditar()) {
          arrasto = { tipo: 'token', token: acharToken(idt), moveu: false };
          capturarPonteiro(e.pointerId);
        }
        return;
      }

      if (alvo.classList.contains('vertice') && alvo.hasAttribute('data-vertice')) {
        var i = parseInt(alvo.getAttribute('data-vertice'), 10);
        var n = acharNacao(selecao.id);
        if (e.altKey) {
          if (n.poligono.length > 3) { n.poligono.splice(i, 1); salvar(); desenhar(); }
          else Interface.avisar('Um território precisa de ao menos 3 pontos.', 'erro');
          return;
        }
        arrasto = { tipo: 'vertice', nacao: n, indice: i };
        capturarPonteiro(e.pointerId);
        return;
      }

      if (alvo.classList.contains('vertice-meio')) {
        var apos = parseInt(alvo.getAttribute('data-inserir'), 10);
        var n2 = acharNacao(selecao.id);
        n2.poligono.splice(apos + 1, 0, ponto);
        arrasto = { tipo: 'vertice', nacao: n2, indice: apos + 1 };
        capturarPonteiro(e.pointerId);
        desenhar();
        return;
      }

      if (alvo.classList.contains('marca-cidade')) {
        var id = alvo.getAttribute('data-id');
        selecionar('cidade', id, false);
        if (podeEditar()) {
          arrasto = { tipo: 'cidade', cidade: acharCidade(id), moveu: false };
          capturarPonteiro(e.pointerId);
        }
        return;
      }

      if (alvo.classList.contains('territorio')) {
        var idn = alvo.getAttribute('data-id');
        if (selecao && selecao.tipo === 'nacao' && selecao.id === idn &&
            editandoVertices && podeEditar()) {
          arrasto = { tipo: 'territorio', nacao: acharNacao(idn), anterior: ponto, moveu: false };
          capturarPonteiro(e.pointerId);
          return;
        }
        /* No celular quase toda a tela é território: se o toque numa
           terra já selecionasse, não haveria de onde arrastar o mapa.
           Então o gesto fica em suspenso — andou o dedo, é arrasto;
           soltou parado, é seleção. */
        arrasto = {
          tipo: 'vista', anterior: ponto, moveu: false,
          inicio: { x: e.clientX, y: e.clientY }, talvezSelecione: idn
        };
        svg.classList.add('arrastando');
        capturarPonteiro(e.pointerId);
        return;
      }

      arrasto = { tipo: 'vista', anterior: ponto, moveu: false, inicio: { x: e.clientX, y: e.clientY } };
      svg.classList.add('arrastando');
      capturarPonteiro(e.pointerId);
    });

    svg.addEventListener('pointermove', function (e) {
      if (dedos[e.pointerId]) { dedos[e.pointerId].x = e.clientX; dedos[e.pointerId].y = e.clientY; }
      if (pinca) { seguirPinca(); return; }
      if (ferramenta === 'selecionar' && !arrasto) mostrarDica(e);
      if (!arrasto) return;
      var ponto = coordenadas(e);

      if (arrasto.tipo === 'vista') {
        if (arrasto.inicio && !arrasto.moveu) {
          var andou = Math.abs(e.clientX - arrasto.inicio.x) +
                      Math.abs(e.clientY - arrasto.inicio.y);
          if (andou < 6) return;      // ainda pode ser um toque, não um arrasto
        }
        vista.x += arrasto.anterior[0] - ponto[0];
        vista.y += arrasto.anterior[1] - ponto[1];
        aplicarVista();
        arrasto.anterior = coordenadas(e);
        arrasto.moveu = true;
      } else if (arrasto.tipo === 'vertice') {
        arrasto.nacao.poligono[arrasto.indice] = ponto;
        arrasto.moveu = true; desenhar();
      } else if (arrasto.tipo === 'cidade') {
        arrasto.cidade.x = ponto[0]; arrasto.cidade.y = ponto[1];
        arrasto.moveu = true; desenhar();
      } else if (arrasto.tipo === 'token') {
        arrasto.token.x = ponto[0]; arrasto.token.y = ponto[1];
        arrasto.moveu = true; desenharTokens(); atualizarTamanhosTokens();
      } else if (arrasto.tipo === 'tamanho') {
        var t2 = arrasto.token;
        var distancia = Math.sqrt(Math.pow(ponto[0] - t2.x, 2) + Math.pow(ponto[1] - t2.y, 2));
        var raioPx = distancia * pixelsPorUnidade();
        t2.tamanho = Math.max(0.4, Math.min(4, raioPx / RAIO_BASE_PX));
        arrasto.moveu = true;
        desenharTokens(); atualizarTamanhosTokens();
        var barra = $('#token-escala');
        if (barra) barra.value = Math.round(t2.tamanho * 100);
      } else if (arrasto.tipo === 'territorio') {
        var dx = ponto[0] - arrasto.anterior[0], dy = ponto[1] - arrasto.anterior[1];
        arrasto.nacao.poligono = arrasto.nacao.poligono.map(function (p) {
          return [Math.round((p[0] + dx) * 100) / 100, Math.round((p[1] + dy) * 100) / 100];
        });
        if (arrasto.nacao.rotulo) { arrasto.nacao.rotulo.x += dx; arrasto.nacao.rotulo.y += dy; }
        arrasto.anterior = ponto; arrasto.moveu = true; desenhar();
      }
    });

    function fim(e) {
      delete dedos[e.pointerId];
      if (pinca && Object.keys(dedos).length < 2) {
        pinca = null;
        return;   // largar um dedo encerra a pinça, não vira arrasto
      }
      if (!arrasto) return;
      svg.classList.remove('arrastando');
      try { svg.releasePointerCapture(e.pointerId); } catch (err) { /* ok */ }
      if (arrasto.moveu && arrasto.tipo !== 'vista') {
        salvar();
        if (arrasto.tipo === 'cidade' || arrasto.tipo === 'token' ||
            arrasto.tipo === 'tamanho') renderInspetor();
      }
      var aSelecionar = (!arrasto.moveu && arrasto.talvezSelecione) ? arrasto.talvezSelecione : null;
      arrasto = null;
      if (aSelecionar) selecionar('nacao', aSelecionar, false);
    }
    svg.addEventListener('pointerup', fim);
    svg.addEventListener('pointercancel', fim);

    svg.addEventListener('dblclick', function (e) {
      if (ferramenta === 'territorio' && rascunho.length >= 3) {
        e.preventDefault(); concluirTerritorio();
      }
    });

    svg.addEventListener('pointerleave', function () {
      var d = $('#mapa-dica');
      if (d) d.classList.remove('visivel');
    });
  }

  function mostrarDica(e) {
    var dica = $('#mapa-dica');
    if (!dica) return;
    var alvo = e.target, texto = null;

    if (alvo.hasAttribute && alvo.hasAttribute('data-token')) {
      var t = acharToken(alvo.getAttribute('data-token'));
      if (t) texto = '<strong>' + esc(t.nome || 'Herói') + '</strong><em>membro do grupo</em>';
    } else if (alvo.classList.contains('marca-cidade')) {
      var c = acharCidade(alvo.getAttribute('data-id'));
      if (c) {
        var n = acharNacao(c.nacao);
        texto = '<strong>' + esc(c.nome) + '</strong><em>' +
          esc((TIPOS[c.tipo] || TIPOS.cidade).rotulo) + (n ? ' · ' + esc(n.nome) : '') + '</em>';
      }
    } else if (alvo.classList.contains('territorio')) {
      var na = acharNacao(alvo.getAttribute('data-id'));
      if (na) texto = '<strong>' + esc(na.nome) + '</strong>' +
        (na.nomeOficial ? '<em>' + esc(na.nomeOficial) + '</em>' : '');
    }

    if (!texto) { dica.classList.remove('visivel'); return; }
    dica.innerHTML = texto;
    var caixa = palco.getBoundingClientRect();
    dica.style.left = Math.min(caixa.width - 245, e.clientX - caixa.left + 14) + 'px';
    dica.style.top = (e.clientY - caixa.top + 16) + 'px';
    dica.classList.add('visivel');
  }

  /* ---------------- criação ---------------- */

  function concluirTerritorio() {
    if (rascunho.length < 3) return;
    var nome = prompt('Nome do novo território:', 'Território sem nome');
    if (nome === null) { rascunho = []; desenharEdicao(); return; }
    nome = nome.trim() || 'Território sem nome';
    var c = centroide(rascunho);
    var nova = {
      id: novoId(nome), nome: nome, nomeOficial: '', categoria: 'independente',
      cor: corAleatoria(), capital: null, governo: '', regente: '', populacao: '', notas: '',
      rotulo: { x: Math.round(c[0] * 10) / 10, y: Math.round(c[1] * 10) / 10 },
      poligono: rascunho.slice()
    };
    dados.nacoes.push(nova);
    rascunho = [];
    definirFerramenta('selecionar');
    salvar();
    selecionar('nacao', nova.id, false);
    renderFiltros();
    Interface.avisar('"' + nome + '" tomou seu lugar no mapa.');
  }

  function criarCidade(ponto) {
    var nome = prompt('Nome do novo local:', 'Local sem nome');
    if (nome === null) return;
    nome = nome.trim() || 'Local sem nome';
    var nova = {
      id: novoId(nome), nome: nome, nacao: nacaoQueContem(ponto), tipo: 'cidade',
      x: ponto[0], y: ponto[1], notas: '', campanha: false
    };
    dados.cidades.push(nova);
    definirFerramenta('selecionar');
    salvar();
    selecionar('cidade', nova.id, false);
    Interface.avisar('"' + nome + '" foi fundada.');
  }

  function nacaoQueContem(ponto) {
    var cands = dados.nacoes.filter(function (n) {
      return n.categoria !== 'mar' && n.categoria !== 'tormenta' &&
             n.poligono && n.poligono.length >= 3 && dentroDoPoligono(ponto, n.poligono);
    });
    if (!cands.length) return null;
    cands.sort(function (a, b) { return area(a.poligono) - area(b.poligono); });
    return cands[0].id;
  }

  function dentroDoPoligono(p, poli) {
    var dentro = false;
    for (var i = 0, j = poli.length - 1; i < poli.length; j = i++) {
      var xi = poli[i][0], yi = poli[i][1], xj = poli[j][0], yj = poli[j][1];
      if (((yi > p[1]) !== (yj > p[1])) &&
          (p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi)) dentro = !dentro;
    }
    return dentro;
  }

  function area(poli) {
    var s = 0;
    for (var i = 0, j = poli.length - 1; i < poli.length; j = i++) {
      s += (poli[j][0] + poli[i][0]) * (poli[j][1] - poli[i][1]);
    }
    return Math.abs(s / 2);
  }

  function corAleatoria() {
    var base = ['#9f7f3e', '#7c1f25', '#2e417e', '#5b3a7a', '#b0603a', '#3f6b4a',
                '#4a727f', '#6b3f8f', '#8a5a34', '#2f6b3a'];
    return base[Math.floor(Math.random() * base.length)];
  }

  /* ---------------- ferramentas ---------------- */

  function definirFerramenta(nova) {
    if ((nova === 'territorio' || nova === 'cidade') && !podeEditar()) return;
    ferramenta = nova;
    if (nova !== 'territorio') rascunho = [];
    if (nova !== 'regua') regua = [];
    $$('.ferramenta[data-ferramenta]').forEach(function (b) {
      b.classList.toggle('ativa', b.getAttribute('data-ferramenta') === nova);
    });
    svg.classList.toggle('desenhando', nova === 'territorio' || nova === 'cidade');
    svg.classList.toggle('medindo', nova === 'regua');
    desenharEdicao();
    if (nova === 'territorio') Interface.avisar('Clique nos cantos da fronteira. Duplo clique fecha.');
    else if (nova === 'cidade') Interface.avisar('Clique no mapa para fundar um local.');
    else if (nova === 'regua') Interface.avisar('Clique em dois pontos para medir.');
  }

  function ligarFerramentas() {
    $$('.ferramenta[data-ferramenta]', raiz).forEach(function (b) {
      b.addEventListener('click', function () { definirFerramenta(b.getAttribute('data-ferramenta')); });
    });
    var rot = $('#mapa-rotulos');
    if (rot) rot.addEventListener('click', function () {
      mostrarRotulos = !mostrarRotulos;
      rot.classList.toggle('ativa', mostrarRotulos);
      desenhar();
    });
    var espiar = $('#mapa-espiar');
    if (espiar) espiar.addEventListener('click', function () {
      espiandoNevoa = !espiandoNevoa;
      espiar.classList.toggle('ativa', espiandoNevoa);
      desenhar(); renderLista();
      Interface.avisar(espiandoNevoa
        ? 'Você está vendo através da névoa. A mesa continua sem enxergar.'
        : 'Névoa de volta no lugar.');
    });

    var enq = $('#mapa-enquadrar');
    if (enq) enq.addEventListener('click', enquadrar);
    var mais = $('#mapa-mais'), menos = $('#mapa-menos');
    if (mais) mais.addEventListener('click', function () { vista.w /= 1.35; aplicarVista(); });
    if (menos) menos.addEventListener('click', function () { vista.w *= 1.35; aplicarVista(); });
  }

  /* ---------------- busca ---------------- */

  function ligarBusca() {
    var campo = $('#mapa-busca'), caixa = $('#mapa-resultados');
    if (!campo || !caixa) return;
    function limpar() { caixa.textContent = ''; }
    var normalizar = function (s) {
      return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    };

    campo.addEventListener('input', function () {
      var termo = campo.value.trim();
      limpar();
      if (termo.length < 2) return;
      var alvo = normalizar(termo), achados = [];

      (dados.tokens || []).forEach(function (t) {
        if (t.nome && normalizar(t.nome).indexOf(alvo) >= 0 && t.x !== null) {
          achados.push({ tipo: 'token', id: t.id, nome: t.nome, onde: 'herói', icone: '🛡️' });
        }
      });
      dados.nacoes.forEach(function (n) {
        if (normalizar(n.nome).indexOf(alvo) >= 0 || normalizar(n.nomeOficial || '').indexOf(alvo) >= 0) {
          achados.push({ tipo: 'nacao', id: n.id, nome: n.nome, onde: 'território', icone: '🗺️' });
        }
      });
      dados.cidades.forEach(function (c) {
        if (normalizar(c.nome).indexOf(alvo) >= 0) {
          var n = acharNacao(c.nacao);
          achados.push({ tipo: 'cidade', id: c.id, nome: c.nome, icone: '📍',
                         onde: n ? n.nome : (TIPOS[c.tipo] || TIPOS.cidade).rotulo });
        }
      });

      achados.slice(0, 30).forEach(function (r) {
        var linha = document.createElement('div');
        linha.className = 'resultado';
        linha.innerHTML = '<span>' + r.icone + '</span><span>' + esc(r.nome) +
          '</span><span class="onde">' + esc(r.onde) + '</span>';
        linha.addEventListener('mousedown', function (e) {
          e.preventDefault();
          selecionar(r.tipo, r.id, true);
          campo.value = ''; limpar();
        });
        caixa.appendChild(linha);
      });
    });

    campo.addEventListener('blur', function () { setTimeout(limpar, 160); });
    campo.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); campo.value = ''; limpar(); campo.blur(); }
      if (e.key === 'Enter') {
        var p = caixa.querySelector('.resultado');
        if (p) p.dispatchEvent(new MouseEvent('mousedown'));
      }
    });
  }

  /* ---------------- backup ---------------- */

  function ligarBackup() {
    var baixar = $('#mapa-backup');
    if (baixar) baixar.addEventListener('click', function () {
      var carimbo = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      Armazenamento.exportar('arton-' + carimbo + '.json', {
        aplicacao: 'cronicas-artonianas', versao: 2, salvoEm: new Date().toISOString(),
        mapa: dados, calendario: Sincronia.dadosCalendario()
      });
      Interface.avisar('Backup baixado.');
    });

    var restaurar = $('#mapa-restaurar');
    if (restaurar) restaurar.addEventListener('click', function () {
      Armazenamento.importar(function (pacote) {
        if (!pacote || !pacote.mapa || !pacote.mapa.nacoes) {
          Interface.avisar('Esse arquivo não parece um backup das Crônicas.', 'erro');
          return;
        }
        if (!confirm('Restaurar este backup?\n\nO mapa e o calendário atuais serão substituídos para todo mundo.')) return;
        adotar(pacote.mapa);
        Sincronia.salvarMapa(dados);
        // aqui o diário do backup entra no lugar do atual, de propósito
        if (pacote.calendario) {
          Sincronia.salvarCalendario(pacote.calendario, { substituirNotas: true });
        }
        Sincronia.gravarAgora().then(function () {
          renderFiltros(); desenhar(); renderLista(); renderTira(); renderInspetor();
          Interface.avisar('Backup restaurado.');
        }).catch(function (e) { Interface.avisar(e.message, 'erro'); });
      });
    });

    var padrao = $('#mapa-padrao');
    if (padrao) padrao.addEventListener('click', function () {
      if (!confirm('Voltar o mapa ao estado original de 1410?\n\nTerritórios, cidades e heróis que você criou ou editou serão perdidos. O calendário não é afetado.')) return;
      dados = DadosMapa.padrao();
      selecao = null;
      Sincronia.salvarMapa(dados);
      Sincronia.gravarAgora().catch(function () { /* modo local grava sozinho */ });
      renderFiltros(); desenhar(); renderLista(); renderTira(); renderInspetor();
      Interface.avisar('Mapa restaurado ao original de 1410.');
    });
  }

  /* ---------------- dados ---------------- */

  /* Campos que o código conhece e o estado salvo pode não ter. Sempre que
     um dado novo entra em dados-mapa.js (foi o caso do brasão), quem já
     tinha um mundo salvo ficaria sem ele, porque o estado do servidor
     substitui os dados inteiros. Aqui os campos ausentes são preenchidos
     a partir do padrão sem tocar no que o mestre já escreveu: só entra o
     que falta, nunca o que existe. */
  function completarComOPadrao(mapa) {
    var padrao = DadosMapa.padrao();

    function completar(lista, base) {
      var porId = {};
      base.forEach(function (o) { porId[o.id] = o; });
      lista.forEach(function (salvo) {
        var molde = porId[salvo.id];
        if (!molde) return;
        Object.keys(molde).forEach(function (campo) {
          if (!(campo in salvo)) salvo[campo] = molde[campo];
        });
      });
    }

    completar(mapa.nacoes, padrao.nacoes);
    completar(mapa.cidades, padrao.cidades);
  }

  function adotar(remoto) {
    if (!remoto || !remoto.nacoes || !remoto.cidades) return false;
    dados = remoto;
    completarComOPadrao(dados);
    dados.cidades.forEach(function (c) { if (c.campanha === undefined) c.campanha = false; });
    // estados gravados antes de os tokens existirem
    if (!Array.isArray(dados.tokens) || !dados.tokens.length) {
      dados.tokens = DadosMapa.tokensPadrao();
    }
    dados.tokens.forEach(function (t) { if (!t.tamanho) t.tamanho = 1; });
    // estados salvos antes da guerra e da crônica existirem
    dados.nacoes.forEach(function (n) {
      if (!n.estadoGuerra) n.estadoGuerra = 'neutro';
      if (n.controladoPor === undefined) n.controladoPor = null;
      if (n.conhecido === undefined) n.conhecido = true;
    });
    if (!Array.isArray(dados.cronica)) dados.cronica = [];
    if (momentoVisto && !acharMomento(momentoVisto)) momentoVisto = null;
    return true;
  }

  /* ---------------- teclado ---------------- */

  document.addEventListener('keydown', function (e) {
    if (!montado) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ($$('.fundo-modal').some(function (m) { return !m.hidden; })) return;
    if (typeof CalendarioJanela !== 'undefined' && CalendarioJanela.estaAberto()) return;

    var k = e.key.toLowerCase();
    if (e.key === 'Escape') {
      if (rascunho.length) { rascunho = []; desenharEdicao(); }
      else if (ferramenta !== 'selecionar') definirFerramenta('selecionar');
      else if (selecao) selecionar(null, null);
    } else if (k === 'v') definirFerramenta('selecionar');
    else if (k === 'r') definirFerramenta('regua');
    else if (k === 't') definirFerramenta('territorio');
    else if (k === 'c') definirFerramenta('cidade');
    else if (k === 'l') { var b = $('#mapa-rotulos'); if (b) b.click(); }
    else if (k === 'n') { var e = $('#mapa-espiar'); if (e && ehMestre()) e.click(); }
    else if (k === '0') enquadrar();
    else if (e.key === 'Enter' && ferramenta === 'territorio') concluirTerritorio();
  });

  window.addEventListener('resize', function () { if (montado) aplicarVista(); });

  /* ---------------- início ---------------- */

  function iniciar() {
    if (!adotar(Sincronia.dadosMapa())) dados = DadosMapa.padrao();
    montar();
    renderFiltros();
    desenhar();
    renderLista();
    renderTira();
    renderInspetor();
    renderCronica();
    requestAnimationFrame(enquadrar);

    Sincronia.aoMudar('mapa', function (remoto) {
      if (adotar(remoto)) {
        desenhar(); renderLista(); renderTira(); renderInspetor(); renderCronica();
        Interface.avisar('O mestre alterou o mapa.');
      }
    });

    Interface.quandoPapelMudar(function () {
      if (!ehMestre()) {
        editandoVertices = false;
        if (ferramenta === 'territorio' || ferramenta === 'cidade') definirFerramenta('selecionar');
      }
      renderInspetor(); renderTira(); renderCronica(); desenharEdicao();
    });
  }

  return {
    iniciar: iniciar,
    enquadrar: enquadrar,
    selecionar: selecionar,
    registrarMomento: registrarMomento,
    verMomento: verMomento,
    voltarAoPresente: voltarAoPresente,
    vendoOPassado: vendoOPassado
  };
})();
