/* =============================================================
   SINCRONIA
   Conversa com o servidor: quem é mestre, qual o estado do mundo
   e como gravá-lo.

   - Mestre autenticado: pode gravar. As alterações vão para o
     servidor com um pequeno atraso, agrupadas.
   - Jogadores: modo leitura. Ficam consultando o carimbo de tempo
     e recarregam sozinhos quando o mestre mexe em algo.
   - Sem servidor (arquivo aberto direto no navegador): cai para o
     localStorage e libera a edição, para dar pra testar offline.
   ============================================================= */

var Sincronia = (function () {
  'use strict';

  var INTERVALO_SONDAGEM = 6000;   // ms entre consultas dos jogadores
  var ATRASO_GRAVACAO = 700;       // ms de agrupamento antes de gravar

  var estado = {
    online: false,
    mestre: false,
    atualizadoEm: 0,
    mapa: null,
    calendario: null
  };

  var ouvintes = { mapa: [], calendario: [], sessao: [], conexao: [] };
  var pendente = { mapa: null, calendario: null };
  var temporizadorGravacao = null;
  var temporizadorSondagem = null;
  var gravando = false;

  /* ---------------- utilidades ---------------- */

  function emitir(canal, dados) {
    (ouvintes[canal] || []).forEach(function (cb) {
      try { cb(dados); } catch (e) { console.error(e); }
    });
  }

  function aoMudar(canal, callback) {
    if (!ouvintes[canal]) ouvintes[canal] = [];
    ouvintes[canal].push(callback);
    return function () {
      var i = ouvintes[canal].indexOf(callback);
      if (i >= 0) ouvintes[canal].splice(i, 1);
    };
  }

  function pedir(rota, opcoes) {
    opcoes = opcoes || {};
    opcoes.credentials = 'same-origin';
    opcoes.headers = Object.assign(
      { 'Content-Type': 'application/json' }, opcoes.headers || {}
    );
    return fetch(rota, opcoes).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (corpo) {
        if (!r.ok) {
          var e = new Error(corpo.erro || ('Erro ' + r.status));
          e.status = r.status;
          throw e;
        }
        return corpo;
      });
    });
  }

  /* ---------------- modo local (sem servidor) ---------------- */

  function carregarLocal() {
    estado.online = false;
    estado.mestre = true;
    estado.mapa = Armazenamento.ler('mapa', null);
    estado.calendario = Armazenamento.ler('calendario', null);
    estado.atualizadoEm = Date.now();
  }

  function gravarLocal() {
    if (pendente.mapa) Armazenamento.gravar('mapa', pendente.mapa);
    if (pendente.calendario) Armazenamento.gravar('calendario', pendente.calendario);
    pendente.mapa = null;
    pendente.calendario = null;
  }

  /* ---------------- ciclo de vida ---------------- */

  function iniciar() {
    return pedir('/api/estado')
      .then(function (resposta) {
        estado.online = true;
        estado.mestre = !!resposta.mestre;
        estado.atualizadoEm = resposta.atualizadoEm || 0;
        estado.mapa = resposta.mapa || null;
        estado.calendario = resposta.calendario || null;
        emitir('conexao', { online: true });
        emitir('sessao', { mestre: estado.mestre, online: true });
        sondar();
        return estado;
      })
      .catch(function () {
        carregarLocal();
        emitir('conexao', { online: false });
        emitir('sessao', { mestre: true, online: false });
        return estado;
      });
  }

  /* Os jogadores (e o mestre em outra aba) consultam o carimbo de
     tempo. Só baixam o estado inteiro quando algo mudou de verdade. */
  function sondar() {
    if (temporizadorSondagem) clearTimeout(temporizadorSondagem);
    temporizadorSondagem = setTimeout(function () {
      if (!estado.online || gravando || temporizadorGravacao) { sondar(); return; }
      if (document.hidden) { sondar(); return; }
      pedir('/api/estado?desde=' + estado.atualizadoEm)
        .then(function (resposta) {
          if (resposta.mestre !== undefined && resposta.mestre !== estado.mestre) {
            estado.mestre = !!resposta.mestre;
            emitir('sessao', { mestre: estado.mestre, online: true });
          }
          if (!resposta.semMudanca) {
            estado.atualizadoEm = resposta.atualizadoEm || Date.now();
            if (resposta.mapa !== undefined) {
              estado.mapa = resposta.mapa;
              emitir('mapa', estado.mapa);
            }
            if (resposta.calendario !== undefined) {
              estado.calendario = resposta.calendario;
              emitir('calendario', estado.calendario);
            }
          }
          sondar();
        })
        .catch(function () {
          estado.online = false;
          emitir('conexao', { online: false });
          setTimeout(function () {
            pedir('/api/versao').then(function () {
              estado.online = true;
              emitir('conexao', { online: true });
              sondar();
            }).catch(function () { sondar(); });
          }, 4000);
        });
    }, INTERVALO_SONDAGEM);
  }

  /* ---------------- autenticação ---------------- */

  function entrar(senha) {
    return pedir('/api/login', {
      method: 'POST',
      body: JSON.stringify({ senha: senha })
    }).then(function () {
      estado.mestre = true;
      emitir('sessao', { mestre: true, online: true });
      return true;
    });
  }

  function sair() {
    return pedir('/api/logout', { method: 'POST' }).then(function () {
      estado.mestre = false;
      emitir('sessao', { mestre: false, online: true });
      return true;
    });
  }

  /* ---------------- gravação ---------------- */

  function agendarGravacao() {
    if (temporizadorGravacao) clearTimeout(temporizadorGravacao);
    temporizadorGravacao = setTimeout(function () {
      temporizadorGravacao = null;
      executarGravacao();
    }, ATRASO_GRAVACAO);
  }

  function executarGravacao() {
    if (!pendente.mapa && !pendente.calendario) return Promise.resolve();

    if (!estado.online) {
      gravarLocal();
      return Promise.resolve();
    }
    if (!estado.mestre) {
      pendente.mapa = null;
      pendente.calendario = null;
      return Promise.reject(new Error('Modo leitura: só o mestre pode gravar.'));
    }

    var carga = {};
    if (pendente.mapa) carga.mapa = pendente.mapa;
    if (pendente.calendario) carga.calendario = pendente.calendario;
    pendente.mapa = null;
    pendente.calendario = null;
    gravando = true;

    return pedir('/api/estado', { method: 'PUT', body: JSON.stringify(carga) })
      .then(function (resposta) {
        gravando = false;
        estado.atualizadoEm = resposta.atualizadoEm || Date.now();
        if (carga.mapa) estado.mapa = carga.mapa;
        if (carga.calendario) estado.calendario = carga.calendario;
        emitir('conexao', { online: true, gravado: true });
      })
      .catch(function (e) {
        gravando = false;
        if (e.status === 403) {
          estado.mestre = false;
          emitir('sessao', { mestre: false, online: true });
        }
        emitir('conexao', { online: estado.online, erro: e.message });
        throw e;
      });
  }

  function salvarMapa(dados) {
    pendente.mapa = dados;
    if (!estado.online) { gravarLocal(); return; }
    agendarGravacao();
  }

  function salvarCalendario(dados) {
    pendente.calendario = dados;
    if (!estado.online) { gravarLocal(); return; }
    agendarGravacao();
  }

  function gravarAgora() {
    if (temporizadorGravacao) { clearTimeout(temporizadorGravacao); temporizadorGravacao = null; }
    return executarGravacao();
  }

  function reiniciar(alvo) {
    if (!estado.online) {
      if (alvo === 'mapa' || alvo === 'tudo') Armazenamento.apagar('mapa');
      if (alvo === 'calendario' || alvo === 'tudo') Armazenamento.apagar('calendario');
      return Promise.resolve();
    }
    return pedir('/api/reiniciar', {
      method: 'POST',
      body: JSON.stringify({ alvo: alvo })
    });
  }

  /* Garante que nada se perca ao fechar a aba */
  window.addEventListener('beforeunload', function () {
    if (temporizadorGravacao && estado.online && estado.mestre) {
      var carga = {};
      if (pendente.mapa) carga.mapa = pendente.mapa;
      if (pendente.calendario) carga.calendario = pendente.calendario;
      try {
        navigator.sendBeacon('/api/estado',
          new Blob([JSON.stringify(carga)], { type: 'application/json' }));
      } catch (e) { /* melhor esforço */ }
    }
  });

  return {
    iniciar: iniciar,
    entrar: entrar,
    sair: sair,
    salvarMapa: salvarMapa,
    salvarCalendario: salvarCalendario,
    gravarAgora: gravarAgora,
    reiniciar: reiniciar,
    aoMudar: aoMudar,
    ehMestre: function () { return estado.mestre; },
    estaOnline: function () { return estado.online; },
    dadosMapa: function () { return estado.mapa; },
    dadosCalendario: function () { return estado.calendario; }
  };
})();
