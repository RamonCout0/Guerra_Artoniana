/* =============================================================
   TEMA DIA/NOITE
   O mapa e o calendário escurecem e clareiam junto com o relógio
   real do usuário (fuso do sistema, não o do jogo).

   Aplica no <html>:
     data-tema = "claro" | "escuro"
     data-fase = "amanhecer" | "dia" | "anoitecer" | "noite"

   A configuração é compartilhada entre as duas telas.
   ============================================================= */

var Tema = (function () {
  'use strict';

  var CHAVE = 'tema';
  var PADRAO = {
    modo: 'auto',   // 'auto' | 'dia' | 'noite'
    nascer: 6,      // hora do nascer do sol (0-23)
    ocaso: 18       // hora do pôr do sol (0-23)
  };

  var config = Object.assign({}, PADRAO, Armazenamento.ler(CHAVE, {}));
  var ouvintes = [];
  var faseAtual = null;
  var temporizador = null;

  function salvar() {
    Armazenamento.gravar(CHAVE, config);
  }

  function obterConfig() {
    return Object.assign({}, config);
  }

  function definirConfig(novo) {
    if (novo.modo !== undefined) config.modo = novo.modo;
    if (novo.nascer !== undefined) config.nascer = limitarHora(novo.nascer);
    if (novo.ocaso !== undefined) config.ocaso = limitarHora(novo.ocaso);
    if (config.ocaso <= config.nascer) config.ocaso = Math.min(23, config.nascer + 1);
    salvar();
    aplicar(true);
  }

  function limitarHora(h) {
    h = Number(h);
    if (isNaN(h)) return 0;
    return Math.max(0, Math.min(23, Math.round(h)));
  }

  /* Fase do dia segundo o relógio local do usuário */
  function calcularFase(agora) {
    if (config.modo === 'dia') return 'dia';
    if (config.modo === 'noite') return 'noite';
    var hora = agora.getHours() + agora.getMinutes() / 60;
    var nascer = config.nascer, ocaso = config.ocaso;
    if (hora >= nascer - 1 && hora < nascer + 1) return 'amanhecer';
    if (hora >= nascer + 1 && hora < ocaso - 1) return 'dia';
    if (hora >= ocaso - 1 && hora < ocaso + 1) return 'anoitecer';
    return 'noite';
  }

  function ehEscuro(fase) {
    return fase === 'noite' || fase === 'anoitecer';
  }

  var ROTULOS = {
    amanhecer: 'Amanhecer',
    dia: 'Dia',
    anoitecer: 'Anoitecer',
    noite: 'Noite'
  };

  /* Quanto falta, em minutos, para a próxima virada de fase */
  function minutosAteProximaFase(agora) {
    if (config.modo !== 'auto') return 60;
    var minutosAgora = agora.getHours() * 60 + agora.getMinutes();
    var marcos = [
      (config.nascer - 1) * 60,
      (config.nascer + 1) * 60,
      (config.ocaso - 1) * 60,
      (config.ocaso + 1) * 60
    ].map(function (m) { return ((m % 1440) + 1440) % 1440; })
     .sort(function (a, b) { return a - b; });
    for (var i = 0; i < marcos.length; i++) {
      if (marcos[i] > minutosAgora) return marcos[i] - minutosAgora;
    }
    return 1440 - minutosAgora + marcos[0];
  }

  function aplicar(forcar) {
    var agora = new Date();
    var fase = calcularFase(agora);
    if (fase === faseAtual && !forcar) return fase;
    faseAtual = fase;
    var raiz = document.documentElement;
    raiz.setAttribute('data-fase', fase);
    raiz.setAttribute('data-tema', ehEscuro(fase) ? 'escuro' : 'claro');
    var info = estado();
    for (var i = 0; i < ouvintes.length; i++) {
      try { ouvintes[i](info); } catch (e) { console.error(e); }
    }
    return fase;
  }

  function estado() {
    var agora = new Date();
    return {
      fase: faseAtual || calcularFase(agora),
      rotulo: ROTULOS[faseAtual || calcularFase(agora)],
      escuro: ehEscuro(faseAtual || calcularFase(agora)),
      modo: config.modo,
      nascer: config.nascer,
      ocaso: config.ocaso,
      agora: agora,
      minutosAteProximaFase: minutosAteProximaFase(agora)
    };
  }

  function aoMudar(callback) {
    ouvintes.push(callback);
    if (faseAtual) callback(estado());
    return function () {
      var i = ouvintes.indexOf(callback);
      if (i >= 0) ouvintes.splice(i, 1);
    };
  }

  function alternarModo() {
    var ordem = ['auto', 'dia', 'noite'];
    var i = ordem.indexOf(config.modo);
    definirConfig({ modo: ordem[(i + 1) % ordem.length] });
    return config.modo;
  }

  function iniciar() {
    aplicar(true);
    if (temporizador) clearInterval(temporizador);
    temporizador = setInterval(function () { aplicar(false); }, 20000);
    // Se outra aba mudar a configuração, acompanha
    window.addEventListener('storage', function (e) {
      if (e.key === 'artoniana:' + CHAVE) {
        config = Object.assign({}, PADRAO, Armazenamento.ler(CHAVE, {}));
        aplicar(true);
      }
    });
  }

  return {
    iniciar: iniciar,
    aplicar: aplicar,
    estado: estado,
    aoMudar: aoMudar,
    obterConfig: obterConfig,
    definirConfig: definirConfig,
    alternarModo: alternarModo,
    ROTULOS: ROTULOS
  };
})();
