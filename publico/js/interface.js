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
        botao.textContent = mestre ? 'Sair' : 'Entrar como mestre';
      }
    }

    $$('.so-mestre').forEach(function (el) {
      el.setAttribute('data-visivel', mestre ? 'sim' : 'nao');
    });

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

  /* ---------- Início ---------- */

  function iniciar() {
    Tema.iniciar();
    ligarModais();
    ligarFaseDoDia();
    ligarConfigTema();
    ligarSessao();
    return Sincronia.iniciar().then(function (estado) {
      pintarPapel();
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
    iniciar: iniciar
  };
})();
