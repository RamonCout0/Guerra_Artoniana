/* =============================================================
   TESTES DE FUMAÇA — Crônicas Artonianas
   Sobe o servidor de verdade numa porta livre, com uma pasta de
   dados temporária, e verifica o que não pode quebrar em silêncio.

   Sem framework e sem dependência: `npm test`.

   Não é uma suíte completa — é a rede que pega as regressões que
   já custaram caro: o crash pela URL, o diário sendo sobrescrito
   pelo mestre, a senha do mestre virando opcional.
   ============================================================= */

'use strict';

var http = require('http');
var fs = require('fs');
var os = require('os');
var path = require('path');
var { spawn } = require('child_process');

var RAIZ = path.join(__dirname, '..');
var SENHA_MESTRE = 'senha-de-teste-mestre';
var SENHA_JOGADOR = 'senha-de-teste-mesa';

var passou = 0;
var falhou = [];

function conferir(descricao, condicao, detalhe) {
  if (condicao) {
    passou++;
    console.log('  ✓ ' + descricao);
  } else {
    falhou.push(descricao + (detalhe ? ' — ' + detalhe : ''));
    console.log('  ✗ ' + descricao + (detalhe ? '\n      ' + detalhe : ''));
  }
}

function secao(nome) {
  console.log('\n' + nome);
}

/* ---------------- utilidades ---------------- */

function esperar(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function pastaTemporaria() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'artoniana-teste-'));
}

/* Sobe o servidor e espera ele responder. Devolve o processo, a porta e
   o que ele escreveu na saída — os testes de configuração leem isso. */
function subirServidor(porta, ambiente) {
  var pasta = pastaTemporaria();
  var filho = spawn(process.execPath, [path.join(RAIZ, 'servidor.js')], {
    cwd: RAIZ,
    env: Object.assign({}, process.env, {
      PORT: String(porta),
      DADOS_DIR: pasta,
      DATABASE_URL: '',
      SENHA_MESTRE: SENHA_MESTRE,
      SENHA_JOGADOR: SENHA_JOGADOR,
      NODE_ENV: '',
      RAILWAY_ENVIRONMENT: '',
      RAILWAY_ENVIRONMENT_NAME: '',
      RAILWAY_PROJECT_ID: ''
    }, ambiente || {})
  });

  var saida = '';
  filho.stdout.on('data', function (d) { saida += d; });
  filho.stderr.on('data', function (d) { saida += d; });

  var encerrou = new Promise(function (resolve) {
    filho.on('exit', function (codigo) { resolve(codigo); });
  });

  return {
    processo: filho,
    porta: porta,
    pasta: pasta,
    encerrou: encerrou,
    saida: function () { return saida; }
  };
}

/* Bate na porta até o servidor responder — mais confiável que dormir. */
function aguardarDePe(porta, tentativas) {
  tentativas = tentativas === undefined ? 60 : tentativas;
  return pedir(porta, 'GET', '/api/sessao')
    .catch(function (e) {
      if (tentativas <= 0) throw e;
      return esperar(100).then(function () { return aguardarDePe(porta, tentativas - 1); });
    });
}

function pedir(porta, metodo, caminho, opcoes) {
  opcoes = opcoes || {};
  return new Promise(function (resolve, reject) {
    var corpo = opcoes.corpo === undefined ? null
      : Buffer.from(JSON.stringify(opcoes.corpo), 'utf8');

    var cabecalhos = Object.assign({}, opcoes.cabecalhos || {});
    if (corpo) {
      cabecalhos['Content-Type'] = 'application/json';
      cabecalhos['Content-Length'] = corpo.length;
    }
    if (opcoes.cookie) cabecalhos['Cookie'] = opcoes.cookie;

    var req = http.request(
      { host: '127.0.0.1', port: porta, method: metodo, path: caminho, headers: cabecalhos },
      function (res) {
        var pedacos = [];
        res.on('data', function (p) { pedacos.push(p); });
        res.on('end', function () {
          var cru = Buffer.concat(pedacos);
          var texto = cru.toString('utf8');
          var json = null;
          try { json = JSON.parse(texto); } catch (e) { /* nem toda rota é json */ }
          resolve({
            status: res.statusCode,
            cabecalhos: res.headers,
            bytes: cru.length,
            texto: texto,
            json: json,
            cookie: (res.headers['set-cookie'] || [])[0]
          });
        });
      }
    );
    req.on('error', reject);
    if (corpo) req.write(corpo);
    req.end();
  });
}

/* Recorta só o par nome=valor do Set-Cookie, para reenviar. */
function cookieDe(resposta) {
  return resposta.cookie ? String(resposta.cookie).split(';')[0] : '';
}

function entrar(porta, senha) {
  return pedir(porta, 'POST', '/api/login', { corpo: { senha: senha } });
}

/* ---------------- os testes ---------------- */

function testarServidor(porta) {
  var servidor = subirServidor(porta);
  var cookieMestre = '';
  var cookieJogador = '';

  return aguardarDePe(porta).then(function () {

    secao('A porta e as senhas');

    return entrar(porta, 'senha-errada').then(function (r) {
      conferir('senha errada é recusada', r.status === 401, 'veio ' + r.status);

      return entrar(porta, SENHA_JOGADOR);
    }).then(function (r) {
      cookieJogador = cookieDe(r);
      conferir('a senha da mesa entra como jogador',
        r.status === 200 && r.json.nivel === 'jogador', JSON.stringify(r.json));
      conferir('o cookie do jogador é HttpOnly',
        /HttpOnly/i.test(r.cookie || ''), r.cookie);

      return entrar(porta, SENHA_MESTRE);
    }).then(function (r) {
      cookieMestre = cookieDe(r);
      conferir('a senha do mestre entra como mestre',
        r.status === 200 && r.json.mestre === true, JSON.stringify(r.json));

      return pedir(porta, 'GET', '/api/estado');
    }).then(function (r) {
      conferir('sem cookie nenhum, a mesa fechada não entrega o estado',
        r.status === 401, 'veio ' + r.status);

      return pedir(porta, 'PUT', '/api/estado', {
        cookie: cookieJogador,
        corpo: { mapa: { nacoes: [], invasao: true } }
      });
    }).then(function (r) {
      conferir('jogador não grava o mundo', r.status === 403, 'veio ' + r.status);

      /* ---- o crash ---- */
      secao('A URL malformada (era um crash)');

      return pedir(porta, 'GET', '/%');
    }).then(function (r) {
      conferir('um "%" solto responde 400', r.status === 400, 'veio ' + r.status);
      return esperar(150).then(function () { return pedir(porta, 'GET', '/api/sessao'); });
    }).then(function (r) {
      conferir('e o servidor continua de pé depois disso', r.status === 200,
        'veio ' + r.status);

      return pedir(porta, 'GET', '/../servidor.js');
    }).then(function (r) {
      conferir('não dá para sair da pasta pública',
        r.status === 404 || r.status === 403, 'veio ' + r.status);

      /* ---- compressão ---- */
      secao('A compressão');

      return pedir(porta, 'GET', '/js/mapa.js', {
        cabecalhos: { 'Accept-Encoding': 'gzip' }
      });
    }).then(function (r) {
      conferir('o JS grande vem comprimido',
        r.cabecalhos['content-encoding'] === 'gzip',
        'content-encoding: ' + r.cabecalhos['content-encoding']);
      conferir('e bem menor que o original',
        r.bytes < fs.statSync(path.join(RAIZ, 'publico/js/mapa.js')).size / 2,
        r.bytes + ' bytes');
      conferir('com Vary: Accept-Encoding',
        /accept-encoding/i.test(r.cabecalhos['vary'] || ''), r.cabecalhos['vary']);

      return pedir(porta, 'GET', '/js/mapa.js');
    }).then(function (r) {
      conferir('sem Accept-Encoding vem cru mesmo',
        !r.cabecalhos['content-encoding'], r.cabecalhos['content-encoding']);
      conferir('e o conteúdo continua legível',
        r.texto.indexOf('MapaArton') >= 0);

      /* ---- o diário ---- */
      secao('O diário não some quando o mestre grava');

      // o mestre põe um herói no mapa (o servidor só aceita autor que existe)
      return pedir(porta, 'PUT', '/api/estado', {
        cookie: cookieMestre,
        corpo: {
          mapa: { tokens: [{ id: 'heroi-1', nome: 'Lady Ayleth', cor: '#d22833' }] },
          calendario: { versao: 1, dataAtual: { ano: 1410, mes: 3, dia: 5 }, notas: {} }
        }
      });
    }).then(function (r) {
      conferir('o mestre grava o mundo', r.status === 200, JSON.stringify(r.json));

      // um jogador escreve no diário
      return pedir(porta, 'POST', '/api/diario', {
        cookie: cookieJogador,
        corpo: { chave: '1410-3-5', autor: 'heroi-1', texto: 'Cruzamos o Rio Mahalcaia.' }
      });
    }).then(function (r) {
      conferir('o jogador escreve no diário', r.status === 200, JSON.stringify(r.json));

      /* Aqui está o bug que existia: o mestre manda o calendário com a
         cópia velha das notas, de antes da entrada do jogador. */
      return pedir(porta, 'PUT', '/api/estado', {
        cookie: cookieMestre,
        corpo: {
          calendario: { versao: 1, dataAtual: { ano: 1410, mes: 3, dia: 6 }, notas: {} }
        }
      });
    }).then(function (r) {
      conferir('o mestre move o tempo', r.status === 200, JSON.stringify(r.json));
      return pedir(porta, 'GET', '/api/estado', { cookie: cookieMestre });
    }).then(function (r) {
      var notas = (r.json.calendario && r.json.calendario.notas) || {};
      var entrada = notas['1410-3-5'] && notas['1410-3-5']['heroi-1'];
      conferir('a entrada do jogador sobreviveu',
        entrada === 'Cruzamos o Rio Mahalcaia.', JSON.stringify(notas));
      conferir('e a data nova do mestre valeu',
        r.json.calendario.dataAtual.dia === 6,
        JSON.stringify(r.json.calendario.dataAtual));

      return pedir(porta, 'POST', '/api/diario', {
        cookie: cookieJogador,
        corpo: { chave: '1410-3-5', autor: 'nao-existe', texto: 'oi' }
      });
    }).then(function (r) {
      conferir('não dá para assinar como herói inexistente',
        r.status === 403, 'veio ' + r.status);

      return pedir(porta, 'POST', '/api/diario', {
        cookie: cookieJogador,
        corpo: { chave: 'nao-e-um-dia', autor: 'heroi-1', texto: 'oi' }
      });
    }).then(function (r) {
      conferir('dia inválido é recusado', r.status === 400, 'veio ' + r.status);

      return pedir(porta, 'POST', '/api/diario', {
        cookie: cookieJogador,
        corpo: { chave: '1410-3-5', autor: 'mestre', texto: 'oi' }
      });
    }).then(function (r) {
      conferir('jogador não escreve como mestre', r.status === 403, 'veio ' + r.status);

      /* ---- a trava otimista ---- */
      secao('A trava otimista');

      return pedir(porta, 'GET', '/api/estado', { cookie: cookieMestre });
    }).then(function (r) {
      var versaoAtual = r.json.versao;
      conferir('o estado traz a revisão', typeof versaoAtual === 'number', String(versaoAtual));

      return pedir(porta, 'PUT', '/api/estado', {
        cookie: cookieMestre,
        corpo: { baseVersao: versaoAtual - 1, mapa: { nacoes: [] } }
      }).then(function (conflito) {
        conferir('gravar a partir de uma revisão velha dá 409',
          conflito.status === 409, 'veio ' + conflito.status);

        // o grupo continua no mapa: o diário do teste seguinte assina por ele
        return pedir(porta, 'PUT', '/api/estado', {
          cookie: cookieMestre,
          corpo: {
            baseVersao: versaoAtual,
            mapa: {
              nacoes: [], marca: 'ok',
              tokens: [{ id: 'heroi-1', nome: 'Lady Ayleth', cor: '#d22833' }]
            }
          }
        });
      });
    }).then(function (r) {
      conferir('gravar a partir da revisão certa passa', r.status === 200,
        JSON.stringify(r.json));

      // o diário não pode empurrar a revisão, senão vira conflito falso
      return pedir(porta, 'GET', '/api/estado', { cookie: cookieMestre })
        .then(function (antes) {
          return esperar(5).then(function () {
            return pedir(porta, 'POST', '/api/diario', {
              cookie: cookieJogador,
              corpo: { chave: '1410-3-7', autor: 'heroi-1', texto: 'Acampamos.' }
            });
          }).then(function (escrita) {
            conferir('a escrita do diário passou', escrita.status === 200,
              JSON.stringify(escrita.json));
            return pedir(porta, 'GET', '/api/estado', { cookie: cookieMestre });
          }).then(function (depois) {
            conferir('escrever no diário não muda a revisão',
              depois.json.versao === antes.json.versao,
              antes.json.versao + ' → ' + depois.json.versao);
            conferir('mas move o carimbo de tempo',
              depois.json.atualizadoEm > antes.json.atualizadoEm);
          });
        });

    }).then(function () {

      /* ---- marcações ---- */
      secao('As marcações do mapa');

      // o jogador finca uma marcação sua
      return pedir(porta, 'POST', '/api/marcacao', {
        cookie: cookieJogador,
        corpo: {
          acao: 'salvar', autor: 'heroi-1',
          marcacao: {
            id: 'mc-do-jogador', tipo: 'circulo', x: 300, y: 400,
            raioKm: 250, rotulo: 'onde caiu o meteoro', cor: '#d22833'
          }
        }
      });
    }).then(function (r) {
      conferir('o jogador finca uma marcação', r.status === 200, JSON.stringify(r.json));
      conferir('e ela volta assinada por ele',
        r.json.marcacao && r.json.marcacao.autor === 'heroi-1', JSON.stringify(r.json.marcacao));

      return pedir(porta, 'POST', '/api/marcacao', {
        cookie: cookieMestre,
        corpo: {
          acao: 'salvar', autor: 'mestre',
          marcacao: {
            id: 'mc-do-mestre', tipo: 'retangulo', x: 100, y: 120,
            larguraKm: 400, alturaKm: 200, rotulo: 'frente de batalha', cor: '#2e417e'
          }
        }
      });
    }).then(function (r) {
      conferir('o mestre finca a dele', r.status === 200, JSON.stringify(r.json));

      /* O ponto do exercício: o mestre grava o mapa com a cópia velha,
         sem a marcação que o jogador acabou de fazer. */
      return pedir(porta, 'GET', '/api/estado', { cookie: cookieMestre })
        .then(function (antes) {
          return pedir(porta, 'PUT', '/api/estado', {
            cookie: cookieMestre,
            corpo: {
              baseVersao: antes.json.versao,
              mapa: {
                nacoes: [], cidades: [],
                tokens: [{ id: 'heroi-1', nome: 'Lady Ayleth', cor: '#d22833' }],
                marcacoes: []          // a cópia velha do mestre não tem nenhuma
              }
            }
          });
        });
    }).then(function (r) {
      conferir('o mestre grava o mapa sem as marcações', r.status === 200, JSON.stringify(r.json));
      return pedir(porta, 'GET', '/api/estado', { cookie: cookieMestre });
    }).then(function (r) {
      var marcas = (r.json.mapa && r.json.mapa.marcacoes) || [];
      var doJogador = marcas.filter(function (m) { return m.id === 'mc-do-jogador'; })[0];
      var doMestre = marcas.filter(function (m) { return m.id === 'mc-do-mestre'; })[0];

      conferir('a marcação do jogador sobreviveu',
        !!doJogador && doJogador.rotulo === 'onde caiu o meteoro', JSON.stringify(marcas));
      conferir('e a do mestre saiu, porque ele mandou o mapa sem ela',
        !doMestre, JSON.stringify(marcas));

      // validação
      return pedir(porta, 'POST', '/api/marcacao', {
        cookie: cookieJogador,
        corpo: {
          acao: 'salvar', autor: 'heroi-1',
          marcacao: { id: 'mc-torta', tipo: 'trapezio', x: 1, y: 1 }
        }
      });
    }).then(function (r) {
      conferir('forma desconhecida é recusada', r.status === 400, 'veio ' + r.status);

      return pedir(porta, 'POST', '/api/marcacao', {
        cookie: cookieJogador,
        corpo: {
          acao: 'salvar', autor: 'heroi-1',
          marcacao: { id: 'mc-gigante', tipo: 'circulo', x: 1, y: 1, raioKm: 999999 }
        }
      });
    }).then(function (r) {
      conferir('raio absurdo é recusado', r.status === 400, 'veio ' + r.status);

      return pedir(porta, 'POST', '/api/marcacao', {
        cookie: cookieJogador,
        corpo: {
          acao: 'salvar', autor: 'nao-existe',
          marcacao: { id: 'mc-fantasma', tipo: 'alfinete', x: 1, y: 1 }
        }
      });
    }).then(function (r) {
      conferir('herói inexistente não marca o mapa', r.status === 403, 'veio ' + r.status);

      return pedir(porta, 'POST', '/api/marcacao', {
        cookie: cookieJogador,
        corpo: {
          acao: 'salvar', autor: 'heroi-1',
          marcacao: { id: 'mc-do-mestre-2', tipo: 'alfinete', x: 5, y: 5 }
        }
      }).then(function () {
        // o jogador tenta editar a marcação de outro dono
        return pedir(porta, 'POST', '/api/marcacao', {
          cookie: cookieJogador,
          corpo: {
            acao: 'salvar', autor: 'heroi-1',
            marcacao: { id: 'mc-do-jogador', tipo: 'circulo', x: 9, y: 9, raioKm: 10 }
          }
        });
      });
    }).then(function (r) {
      conferir('o dono edita a própria marcação', r.status === 200, JSON.stringify(r.json));

      // o mestre modera: apaga a do jogador
      return pedir(porta, 'POST', '/api/marcacao', {
        cookie: cookieMestre,
        corpo: { acao: 'apagar', autor: 'mestre', id: 'mc-do-jogador' }
      });
    }).then(function (r) {
      conferir('o mestre apaga a marcação de um jogador', r.status === 200, JSON.stringify(r.json));
      return pedir(porta, 'GET', '/api/estado', { cookie: cookieMestre });
    }).then(function (r) {
      var marcas = (r.json.mapa && r.json.mapa.marcacoes) || [];
      conferir('e ela sumiu mesmo',
        !marcas.filter(function (m) { return m.id === 'mc-do-jogador'; }).length,
        JSON.stringify(marcas.map(function (m) { return m.id; })));

      return pedir(porta, 'POST', '/api/marcacao', {
        cookie: cookieJogador,
        corpo: { acao: 'apagar', autor: 'heroi-1', id: 'nao-existe' }
      });
    }).then(function (r) {
      conferir('apagar o que não existe dá 404', r.status === 404, 'veio ' + r.status);

    }).then(function () {

      /* ---- logout ---- */
      secao('Sair derruba a sessão de verdade');

      return pedir(porta, 'POST', '/api/logout', { cookie: cookieMestre });
    }).then(function (r) {
      conferir('o logout responde ok', r.status === 200, 'veio ' + r.status);
      return pedir(porta, 'GET', '/api/sessao', { cookie: cookieMestre });
    }).then(function (r) {
      conferir('o cookie de mestre antigo não vale mais',
        r.json.mestre === false, JSON.stringify(r.json));

    }).then(function () {
      servidor.processo.kill();
      return servidor.encerrou;
    });

  }).catch(function (e) {
    servidor.processo.kill();
    throw e;
  });
}

/* Este roda separado: o servidor tem de se recusar a subir. */
function testarSenhaObrigatoriaEmProducao(porta) {
  secao('Em produção, sem SENHA_MESTRE, não sobe');

  var servidor = subirServidor(porta, {
    NODE_ENV: 'production',
    SENHA_MESTRE: ''
  });

  return servidor.encerrou.then(function (codigo) {
    conferir('o processo sai com erro', codigo === 1, 'código ' + codigo);
    conferir('e diz o porquê',
      servidor.saida().indexOf('SENHA_MESTRE') >= 0, servidor.saida().slice(0, 200));
  });
}

/* ---------------- execução ---------------- */

console.log('\nCrônicas Artonianas — testes de fumaça');

testarServidor(3311)
  .then(function () { return testarSenhaObrigatoriaEmProducao(3312); })
  .then(function () {
    console.log('\n' + '-'.repeat(50));
    if (falhou.length) {
      console.log(passou + ' passaram, ' + falhou.length + ' falharam:\n');
      falhou.forEach(function (f) { console.log('  ✗ ' + f); });
      console.log('');
      process.exit(1);
    }
    console.log('Tudo certo: ' + passou + ' verificações.\n');
    process.exit(0);
  })
  .catch(function (e) {
    console.error('\nOs testes não chegaram ao fim:', (e && e.stack) || e);
    process.exit(1);
  });
