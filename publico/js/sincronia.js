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
    nivel: null,            // 'mestre' | 'jogador' | null (sem senha ainda)
    portaoFechado: false,   // a mesa exige senha para entrar?
    versao: 0,              // revisão do mundo, para a trava otimista
    atualizadoEm: 0,
    mapa: null,
    calendario: null
  };

  var ouvintes = { mapa: [], calendario: [], sessao: [], conexao: [] };
  var pendente = { mapa: null, calendario: null, substituirNotas: false };
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
          e.corpo = corpo;
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
    estado.nivel = 'mestre';
    estado.mapa = Armazenamento.ler('mapa', null);
    estado.calendario = Armazenamento.ler('calendario', null);
    estado.atualizadoEm = Date.now();
  }

  function gravarLocal() {
    if (pendente.mapa) Armazenamento.gravar('mapa', pendente.mapa);
    if (pendente.calendario) Armazenamento.gravar('calendario', pendente.calendario);
    limparPendente();
  }

  function limparPendente() {
    pendente.mapa = null;
    pendente.calendario = null;
    pendente.substituirNotas = false;
    pendente.substituirMarcacoes = false;
  }

  /* ---------------- ciclo de vida ---------------- */

  function iniciar() {
    return pedir('/api/sessao')
      .then(function (sessao) {
        estado.online = true;
        estado.nivel = sessao.nivel || null;
        estado.portaoFechado = !!sessao.portaoFechado;
        estado.mestre = !!sessao.mestre;
        if (!estado.nivel) {
          // a mesa é fechada e ainda não temos senha: nada é carregado
          emitir('conexao', { online: true });
          emitir('sessao', { mestre: false, nivel: null, online: true, portaoFechado: true });
          return estado;
        }
        return carregarEstado();
      })
      .catch(function () {
        carregarLocal();
        emitir('conexao', { online: false });
        emitir('sessao', { mestre: true, nivel: 'mestre', online: false });
        return estado;
      });
  }

  function carregarEstado() {
    return pedir('/api/estado')
      .then(function (resposta) {
        estado.online = true;
        estado.mestre = !!resposta.mestre;
        if (resposta.nivel) estado.nivel = resposta.nivel;
        estado.versao = resposta.versao || 0;
        estado.atualizadoEm = resposta.atualizadoEm || 0;
        estado.mapa = resposta.mapa || null;
        estado.calendario = resposta.calendario || null;
        emitir('conexao', { online: true });
        emitir('sessao', { mestre: estado.mestre, nivel: estado.nivel, online: true });
        emitir('mapa', estado.mapa);
        emitir('calendario', estado.calendario);
        sondar();
        return estado;
      });
  }

  /* Os jogadores (e o mestre em outra aba) consultam o carimbo de
     tempo. Só baixam o estado inteiro quando algo mudou de verdade. */
  function sondar() {
    if (temporizadorSondagem) clearTimeout(temporizadorSondagem);
    temporizadorSondagem = setTimeout(function () {
      if (!estado.online || !estado.nivel || gravando || temporizadorGravacao) { sondar(); return; }
      if (document.hidden) { sondar(); return; }
      pedir('/api/estado?desde=' + estado.atualizadoEm)
        .then(function (resposta) {
          if (resposta.mestre !== undefined && resposta.mestre !== estado.mestre) {
            estado.mestre = !!resposta.mestre;
            emitir('sessao', { mestre: estado.mestre, online: true });
          }
          if (resposta.versao) estado.versao = resposta.versao;
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
    }).then(function (resposta) {
      var antes = estado.nivel;
      estado.nivel = resposta.nivel || 'jogador';
      estado.mestre = !!resposta.mestre;
      emitir('sessao', { mestre: estado.mestre, nivel: estado.nivel, online: true });
      // quem acabou de atravessar a porta ainda não tem o mundo carregado
      if (!antes) return carregarEstado().then(function () { return estado.nivel; });
      return estado.nivel;
    });
  }

  function sair() {
    return pedir('/api/logout', { method: 'POST' }).then(function () {
      estado.mestre = false;
      estado.nivel = estado.portaoFechado ? null : 'jogador';
      emitir('sessao', { mestre: false, nivel: estado.nivel, online: true });
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
      limparPendente();
      return Promise.reject(new Error('Modo leitura: só o mestre pode gravar.'));
    }

    var carga = { baseVersao: estado.versao };
    if (pendente.mapa) carga.mapa = pendente.mapa;
    if (pendente.calendario) carga.calendario = pendente.calendario;
    if (pendente.substituirNotas) carga.substituirNotas = true;
    if (pendente.substituirMarcacoes) carga.substituirMarcacoes = true;
    limparPendente();
    gravando = true;

    return pedir('/api/estado', { method: 'PUT', body: JSON.stringify(carga) })
      .then(function (resposta) {
        gravando = false;
        estado.versao = resposta.versao || estado.versao;
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
        /* Conflito: o mundo andou em outro lugar. Melhor recarregar e
           avisar do que gravar por cima do que o outro escreveu. */
        if (e.status === 409) {
          emitir('conexao', {
            online: true,
            erro: 'O mundo mudou em outra aba ou aparelho. Recarreguei — refaça a última alteração.'
          });
          return carregarEstado().then(function () { throw e; });
        }
        emitir('conexao', { online: estado.online, erro: e.message });
        throw e;
      });
  }

  /* opcoes.substituirMarcacoes troca também as marcações dos jogadores —
     só a restauração de backup faz isso. No dia a dia elas ficam com o
     servidor, como as notas do diário. */
  function salvarMapa(dados, opcoes) {
    pendente.mapa = dados;
    if (opcoes && opcoes.substituirMarcacoes) pendente.substituirMarcacoes = true;
    if (!estado.online) { gravarLocal(); return; }
    agendarGravacao();
  }

  /* opcoes.substituirNotas troca o diário inteiro — só a restauração de
     backup faz isso. No dia a dia as notas ficam com o servidor, que é
     quem tem a versão de verdade (veja mesclarCalendario no servidor). */
  function salvarCalendario(dados, opcoes) {
    pendente.calendario = dados;
    if (opcoes && opcoes.substituirNotas) pendente.substituirNotas = true;
    if (!estado.online) { gravarLocal(); return; }
    agendarGravacao();
  }

  function gravarAgora() {
    if (temporizadorGravacao) { clearTimeout(temporizadorGravacao); temporizadorGravacao = null; }
    return executarGravacao();
  }

  /* O diário tem porta própria: é a única coisa que um jogador grava.
     Vai direto, sem passar pelo agrupamento do estado do mestre. */
  function salvarEntradaDiario(chave, autor, texto) {
    if (!estado.online) {
      var local = Armazenamento.ler('calendario', null) || { notas: {} };
      if (!local.notas) local.notas = {};
      var doDia = local.notas[chave];
      if (typeof doDia === 'string') doDia = { mestre: doDia };
      if (!doDia) doDia = {};
      if (String(texto).trim()) doDia[autor] = String(texto).trim();
      else delete doDia[autor];
      if (Object.keys(doDia).length) local.notas[chave] = doDia;
      else delete local.notas[chave];
      Armazenamento.gravar('calendario', local);
      return Promise.resolve();
    }
    return pedir('/api/diario', {
      method: 'POST',
      body: JSON.stringify({ chave: chave, autor: autor, texto: texto })
    }).then(function (r) {
      estado.atualizadoEm = r.atualizadoEm || estado.atualizadoEm;
      return r;
    });
  }

  /* As marcações têm porta própria, como o diário: é a outra coisa que um
     jogador grava. Vai direto, sem passar pelo agrupamento do mestre. */
  function salvarMarcacao(marcacao, autor) {
    if (!estado.online) {
      var local = Armazenamento.ler('mapa', null);
      if (!local) return Promise.reject(new Error('Nada salvo ainda.'));
      if (!Array.isArray(local.marcacoes)) local.marcacoes = [];
      var achou = false;
      local.marcacoes = local.marcacoes.map(function (m) {
        if (m.id !== marcacao.id) return m;
        achou = true;
        return marcacao;
      });
      if (!achou) local.marcacoes.push(marcacao);
      Armazenamento.gravar('mapa', local);
      return Promise.resolve({ marcacao: marcacao });
    }
    return pedir('/api/marcacao', {
      method: 'POST',
      body: JSON.stringify({ acao: 'salvar', autor: autor, marcacao: marcacao })
    }).then(function (r) {
      estado.atualizadoEm = r.atualizadoEm || estado.atualizadoEm;
      return r;
    });
  }

  function apagarMarcacao(id, autor) {
    if (!estado.online) {
      var local = Armazenamento.ler('mapa', null);
      if (!local || !Array.isArray(local.marcacoes)) return Promise.resolve({});
      local.marcacoes = local.marcacoes.filter(function (m) { return m.id !== id; });
      Armazenamento.gravar('mapa', local);
      return Promise.resolve({});
    }
    return pedir('/api/marcacao', {
      method: 'POST',
      body: JSON.stringify({ acao: 'apagar', autor: autor, id: id })
    }).then(function (r) {
      estado.atualizadoEm = r.atualizadoEm || estado.atualizadoEm;
      return r;
    });
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
      var carga = { baseVersao: estado.versao };
      if (pendente.mapa) carga.mapa = pendente.mapa;
      if (pendente.calendario) carga.calendario = pendente.calendario;
      if (pendente.substituirNotas) carga.substituirNotas = true;
    if (pendente.substituirMarcacoes) carga.substituirMarcacoes = true;
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
    salvarEntradaDiario: salvarEntradaDiario,
    salvarMarcacao: salvarMarcacao,
    apagarMarcacao: apagarMarcacao,
    gravarAgora: gravarAgora,
    reiniciar: reiniciar,
    aoMudar: aoMudar,
    ehMestre: function () { return estado.mestre; },
    nivel: function () { return estado.nivel; },
    entrou: function () { return estado.nivel !== null; },
    portaoFechado: function () { return estado.portaoFechado; },
    estaOnline: function () { return estado.online; },
    dadosMapa: function () { return estado.mapa; },
    dadosCalendario: function () { return estado.calendario; }
  };
})();
