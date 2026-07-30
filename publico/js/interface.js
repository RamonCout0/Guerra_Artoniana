/* =============================================================
   INTERFACE — peças compartilhadas entre o mapa e o calendário:
   barra do topo, relógio, login do mestre e avisos flutuantes.
   ============================================================= */

var Interface = (function () {
  'use strict';

  function $(seletor, raiz) { return (raiz || document).querySelector(seletor); }
  function $$(seletor, raiz) {
    return Array.prototype.slice.call((raiz || document).querySelectorAll(seletor));
  }

  function escapar(texto) {
    return String(texto === null || texto === undefined ? '' : texto)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function criar(tag, atributos, filhos) {
    var el = document.createElement(tag);
    if (atributos) {
      Object.keys(atributos).forEach(function (k) {
        if (k === 'class') el.className = atributos[k];
        else if (k === 'texto') el.textContent = atributos[k];
        else if (k === 'html') el.innerHTML = atributos[k];
        else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), atributos[k]);
        else if (atributos[k] !== null && atributos[k] !== undefined) {
          el.setAttribute(k, atributos[k]);
        }
      });
    }
    (filhos || []).forEach(function (f) {
      el.appendChild(typeof f === 'string' ? document.createTextNode(f) : f);
    });
    return el;
  }

  /* ---------- Avisos flutuantes ---------- */

  var temporizadorAviso = null;

  function avisar(texto, tipo) {
    var caixa = $('#aviso');
    if (!caixa) return;
    caixa.textContent = texto;
    caixa.classList.toggle('erro-aviso', tipo === 'erro');
    caixa.classList.add('visivel');
    if (temporizadorAviso) clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(function () {
      caixa.classList.remove('visivel');
    }, tipo === 'erro' ? 5000 : 2600);
  }

  /* ---------- Modais ---------- */

  function abrirModal(id) {
    var m = document.getElementById(id);
    if (!m) return;
    m.hidden = false;
    var primeiro = m.querySelector('input, select, textarea, button');
    if (primeiro) setTimeout(function () { primeiro.focus(); }, 30);
  }

  function fecharModal(id) {
    var m = document.getElementById(id);
    if (m) m.hidden = true;
  }

  function ligarModais() {
    $$('.fundo-modal').forEach(function (fundo) {
      fundo.addEventListener('mousedown', function (e) {
        if (e.target === fundo) fundo.hidden = true;
      });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        var aberto = $$('.fundo-modal').filter(function (m) { return !m.hidden; });
        if (aberto.length) { aberto[aberto.length - 1].hidden = true; e.stopPropagation(); }
      }
    });
  }

  /* ---------- Relógio e fase do dia ---------- */

  var ASTROS = { amanhecer: '🌅', dia: '☀️', anoitecer: '🌆', noite: '🌙' };

  function ligarFaseDoDia() {
    var caixa = $('#fase-dia');
    if (!caixa) return;

    function pintar() {
      var e = Tema.estado();
      var astro = $('#fase-astro');
      var relogio = $('#fase-relogio');
      var rotulo = $('#fase-rotulo');
      if (astro) astro.textContent = ASTROS[e.fase] || '☀️';
      if (relogio) {
        relogio.textContent = e.agora.toLocaleTimeString('pt-BR', {
          hour: '2-digit', minute: '2-digit'
        });
      }
      if (rotulo) {
        rotulo.textContent = e.modo === 'auto' ? e.rotulo : e.rotulo + ' (fixo)';
      }
      caixa.title = e.modo === 'auto'
        ? 'Seguindo o relógio do seu computador. Clique para fixar o tema; segure Shift para configurar.'
        : 'Tema fixo em ' + e.rotulo.toLowerCase() + '. Clique para continuar alternando.';
    }

    caixa.addEventListener('click', function (e) {
      if (e.shiftKey) { abrirConfigTema(); return; }
      Tema.alternarModo();
      pintar();
    });

    caixa.addEventListener('contextmenu', function (e) {
      e.preventDefault();
      abrirConfigTema();
    });

    Tema.aoMudar(pintar);
    setInterval(pintar, 1000);
    pintar();
  }

  function abrirConfigTema() {
    var c = Tema.obterConfig();
    var modo = $('#config-modo'), nascer = $('#config-nascer'), ocaso = $('#config-ocaso');
    if (modo) modo.value = c.modo;
    if (nascer) nascer.value = c.nascer;
    if (ocaso) ocaso.value = c.ocaso;
    abrirModal('modal-config');
  }

  function ligarConfigTema() {
    var modo = $('#config-modo'), nascer = $('#config-nascer'), ocaso = $('#config-ocaso');
    function aplicar() {
      Tema.definirConfig({
        modo: modo ? modo.value : undefined,
        nascer: nascer ? nascer.value : undefined,
        ocaso: ocaso ? ocaso.value : undefined
      });
      var c = Tema.obterConfig();
      if (nascer) nascer.value = c.nascer;
      if (ocaso) ocaso.value = c.ocaso;
    }
    [modo, nascer, ocaso].forEach(function (el) {
      if (el) el.addEventListener('change', aplicar);
    });
    var fechar = $('#fechar-config');
    if (fechar) fechar.addEventListener('click', function () { fecharModal('modal-config'); });
  }

  /* ---------- Sessão do mestre ---------- */

  var aoMudarPapel = [];

  function pintarPapel() {
    var mestre = Sincronia.ehMestre();
    var online = Sincronia.estaOnline();

    var emblema = $('#emblema-papel');
    if (emblema) {
      emblema.textContent = mestre ? '⚜ Mestre' : '👁 Modo leitura';
      emblema.className = 'emblema ' + (mestre ? 'mestre' : 'leitura');
    }

    var conexao = $('#emblema-conexao');
    if (conexao) {
      if (online) {
        conexao.hidden = true;
      } else {
        conexao.hidden = false;
        conexao.textContent = '⚠ Local (sem servidor)';
        conexao.className = 'emblema desconectado';
      }
    }

    var botao = $('#botao-sessao');
    if (botao) {
      if (!online) {
        botao.hidden = true;
      } else {
        botao.hidden = false;
        botao.textContent = mestre
          ? 'Sair'
          : (Sincronia.portaoFechado() ? 'Sou o mestre' : 'Entrar como mestre');
      }
    }

    $$('.so-mestre').forEach(function (el) {
      el.setAttribute('data-visivel', mestre ? 'sim' : 'nao');
    });

    pintarIdentidade();

    aoMudarPapel.forEach(function (cb) {
      try { cb(mestre); } catch (e) { console.error(e); }
    });
  }

  function ligarSessao() {
    var botao = $('#botao-sessao');
    if (botao) {
      botao.addEventListener('click', function () {
        if (Sincronia.ehMestre()) {
          Sincronia.sair()
            .then(function () { avisar('Você saiu. Agora está em modo leitura.'); })
            .catch(function (e) { avisar(e.message, 'erro'); });
        } else {
          var erro = $('#erro-login');
          if (erro) erro.textContent = '';
          var campo = $('#senha-mestre');
          if (campo) campo.value = '';
          abrirModal('modal-login');
        }
      });
    }

    var confirmar = $('#confirmar-login');
    var campoSenha = $('#senha-mestre');

    function tentarEntrar() {
      var erro = $('#erro-login');
      var senha = campoSenha ? campoSenha.value : '';
      if (!senha) { if (erro) erro.textContent = 'Digite a senha.'; return; }
      if (confirmar) confirmar.disabled = true;
      Sincronia.entrar(senha)
        .then(function () {
          fecharModal('modal-login');
          avisar('Bem-vindo, mestre. O mundo é seu.');
        })
        .catch(function (e) {
          if (erro) erro.textContent = e.message || 'Não foi possível entrar.';
        })
        .then(function () {
          if (confirmar) confirmar.disabled = false;
        });
    }

    if (confirmar) confirmar.addEventListener('click', tentarEntrar);
    if (campoSenha) {
      campoSenha.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') tentarEntrar();
      });
    }

    var cancelar = $('#cancelar-login');
    if (cancelar) cancelar.addEventListener('click', function () { fecharModal('modal-login'); });

    Sincronia.aoMudar('sessao', pintarPapel);
    Sincronia.aoMudar('conexao', function (info) {
      pintarPapel();
      if (info && info.erro) avisar(info.erro, 'erro');
    });
  }

  function quandoPapelMudar(callback) {
    aoMudarPapel.push(callback);
  }

  /* ---------- Quem está olhando ----------
     O mestre é o mestre. Os jogadores dizem qual herói são, e é isso
     que assina o diário. Fica guardado só no navegador de cada um. */

  var CHAVE_EU = 'euSou';
  var ouvintesIdentidade = [];

  function quemEuSou() {
    if (Sincronia.ehMestre()) return 'mestre';
    return Armazenamento.ler(CHAVE_EU, null);
  }

  function definirQuemEuSou(id) {
    if (id) Armazenamento.gravar(CHAVE_EU, id);
    else Armazenamento.apagar(CHAVE_EU);
    ouvintesIdentidade.forEach(function (cb) {
      try { cb(quemEuSou()); } catch (e) { console.error(e); }
    });
    pintarIdentidade();
  }

  function quandoIdentidadeMudar(cb) { ouvintesIdentidade.push(cb); }

  /* Os heróis vêm do mapa, que é quem guarda o grupo. */
  function herois() {
    var mapa = Sincronia.dadosMapa();
    var lista = (mapa && mapa.tokens) || (typeof DadosMapa !== 'undefined' ? DadosMapa.tokensPadrao() : []);
    return lista.filter(function (t) { return t.nome; });
  }

  function heroiPorId(id) {
    var achado = null;
    herois().forEach(function (t) { if (t.id === id) achado = t; });
    return achado;
  }

  function pintarIdentidade() {
    var caixa = $('#quem-sou');
    if (!caixa) return;
    if (Sincronia.ehMestre()) { caixa.hidden = true; return; }

    var lista = herois();
    if (!lista.length) { caixa.hidden = true; return; }
    caixa.hidden = false;

    var eu = heroiPorId(quemEuSou());
    caixa.innerHTML = eu
      ? '<span class="retrato-mini" style="border-color:' + escapar(eu.cor) + ';' +
        (eu.foto ? 'background-image:url(&quot;' + escapar(eu.foto) + '&quot;)'
                 : 'background:' + escapar(eu.cor)) + '">' +
        (eu.foto ? '' : escapar(eu.nome.charAt(0).toUpperCase())) + '</span>' +
        '<span class="quem-nome">' + escapar(eu.nome) + '</span>'
      : '<span class="retrato-mini vazio">?</span><span class="quem-nome">Quem é você?</span>';
  }

  function abrirEscolhaDeHeroi() {
    var lista = herois();
    var caixa = $('#escolha-herois');
    if (!caixa) return;
    caixa.innerHTML = '';
    if (!lista.length) {
      caixa.innerHTML = '<div class="vazio">O mestre ainda não montou o grupo.</div>';
    }
    var eu = quemEuSou();
    lista.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'cartao-heroi' + (eu === t.id ? ' escolhido' : '');
      b.type = 'button';
      b.innerHTML = '<span class="retrato-medio" style="border-color:' + escapar(t.cor) + ';' +
        (t.foto ? 'background-image:url(&quot;' + escapar(t.foto) + '&quot;)'
                : 'background:' + escapar(t.cor)) + '">' +
        (t.foto ? '' : escapar(t.nome.charAt(0).toUpperCase())) + '</span>' +
        '<span class="nome-heroi">' + escapar(t.nome) + '</span>';
      b.addEventListener('click', function () {
        definirQuemEuSou(t.id);
        fecharModal('modal-quem');
        avisar('Você é ' + t.nome + '. O diário vai assinar por você.');
      });
      caixa.appendChild(b);
    });

    var espectador = document.createElement('button');
    espectador.className = 'cartao-heroi' + (!quemEuSou() ? ' escolhido' : '');
    espectador.type = 'button';
    espectador.innerHTML = '<span class="retrato-medio vazio">👁</span>' +
      '<span class="nome-heroi">Só assistindo</span>';
    espectador.addEventListener('click', function () {
      definirQuemEuSou(null);
      fecharModal('modal-quem');
    });
    caixa.appendChild(espectador);

    abrirModal('modal-quem');
  }

  function ligarIdentidade() {
    var caixa = $('#quem-sou');
    if (caixa) caixa.addEventListener('click', abrirEscolhaDeHeroi);
    var fechar = $('#fechar-quem');
    if (fechar) fechar.addEventListener('click', function () { fecharModal('modal-quem'); });
    Sincronia.aoMudar('mapa', pintarIdentidade);
    Sincronia.aoMudar('sessao', pintarIdentidade);
  }

  /* ---------- A porta ---------- */

  /* Com a mesa fechada, nada é carregado antes da senha. A porta some
     sozinha quando alguém entra, seja como jogador ou como mestre. */
  function ligarPortao() {
    var portao = $('#portao');
    if (!portao) return;

    function atualizar() {
      var trancado = Sincronia.estaOnline() && !Sincronia.entrou();
      portao.hidden = !trancado;
      document.body.classList.toggle('trancado', trancado);
      if (trancado) {
        var campo = $('#portao-senha');
        if (campo && document.activeElement !== campo) setTimeout(function () { campo.focus(); }, 60);
      }
    }

    function tentar() {
      var campo = $('#portao-senha');
      var erro = $('#portao-erro');
      var botao = $('#portao-entrar');
      var senha = campo ? campo.value : '';
      if (!senha) { if (erro) erro.textContent = 'Digite a senha.'; return; }
      if (botao) { botao.disabled = true; botao.textContent = 'Abrindo…'; }
      Sincronia.entrar(senha)
        .then(function (nivel) {
          if (campo) campo.value = '';
          if (erro) erro.textContent = '';
          atualizar();
          avisar(nivel === 'mestre'
            ? 'Bem-vindo, mestre. O mundo é seu.'
            : 'Bem-vindo a Arton.');
        })
        .catch(function (e) {
          if (erro) erro.textContent = e.message || 'Não foi possível entrar.';
        })
        .then(function () {
          if (botao) { botao.disabled = false; botao.textContent = 'Entrar'; }
        });
    }

    var botao = $('#portao-entrar');
    if (botao) botao.addEventListener('click', tentar);
    var campo = $('#portao-senha');
    if (campo) campo.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') tentar();
    });

    Sincronia.aoMudar('sessao', atualizar);
    Sincronia.aoMudar('conexao', atualizar);
    atualizar();
  }

  /* ---------- Início ---------- */

  function iniciar() {
    Tema.iniciar();
    ligarModais();
    ligarFaseDoDia();
    ligarConfigTema();
    ligarSessao();
    ligarIdentidade();
    ligarPortao();
    return Sincronia.iniciar().then(function (estado) {
      pintarPapel();
      pintarIdentidade();
      return estado;
    });
  }

  return {
    $: $, $$: $$,
    criar: criar,
    escapar: escapar,
    avisar: avisar,
    abrirModal: abrirModal,
    fecharModal: fecharModal,
    abrirConfigTema: abrirConfigTema,
    pintarPapel: pintarPapel,
    quandoPapelMudar: quandoPapelMudar,
    quemEuSou: quemEuSou,
    definirQuemEuSou: definirQuemEuSou,
    quandoIdentidadeMudar: quandoIdentidadeMudar,
    herois: herois,
    heroiPorId: heroiPorId,
    abrirEscolhaDeHeroi: abrirEscolhaDeHeroi,
    pintarIdentidade: pintarIdentidade,
    iniciar: iniciar
  };
})();
