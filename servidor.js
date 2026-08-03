/* =============================================================
   SERVIDOR — Crônicas Artonianas
   Node.js puro (a única dependência é o driver do Postgres, banco.js).
   Pronto para o Railway.

   - Serve os arquivos estáticos de ./publico
   - Guarda o estado compartilhado (mapa + calendário) no Postgres
     (DATABASE_URL) ou, sem banco configurado, num arquivo local
   - Só o mestre, autenticado por senha, pode gravar
   - Jogadores acessam a mesma URL e enxergam tudo em modo leitura

   Variáveis de ambiente:
     PORT          porta HTTP (o Railway define sozinho)
     SENHA_MESTRE  senha do mestre                  (padrão: "mestre")
     SENHA_JOGADOR senha da mesa; sem ela, ninguém entra. Se ficar vazia,
                   o link é aberto a qualquer pessoa (como era antes).
     SEGREDO       segredo para assinar o cookie    (padrão: derivado da senha)
     DATABASE_URL  conexão do Postgres; sem ela, cai para o arquivo local
     DADOS_DIR     pasta do arquivo local, sem DATABASE_URL (padrão: ./dados)
   ============================================================= */

'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var crypto = require('crypto');
var Banco = require('./banco.js');

var PORTA = parseInt(process.env.PORT, 10) || 3000;
var SENHA_MESTRE = process.env.SENHA_MESTRE || 'mestre';
var SENHA_JOGADOR = process.env.SENHA_JOGADOR || '';
var PORTAO_FECHADO = SENHA_JOGADOR.length > 0;   // exige senha até para olhar
var SEGREDO = process.env.SEGREDO ||
  crypto.createHash('sha256').update('artoniana:' + SENHA_MESTRE).digest('hex');
var DADOS_DIR = process.env.DADOS_DIR || path.join(__dirname, 'dados');
var ARQUIVO_ESTADO = path.join(DADOS_DIR, 'estado.json');
var RAIZ_PUBLICA = path.join(__dirname, 'publico');
var DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000;  // 30 dias
var DATABASE_URL = process.env.DATABASE_URL || '';
var USANDO_POSTGRES = DATABASE_URL.length > 0;

/* Publicado é diferente de rodando na sua máquina: o link do Railway é
   público, e a senha de exemplo abriria o mundo para quem chutasse
   primeiro. Aqui o servidor prefere não subir a subir aberto. */
var EM_PRODUCAO = process.env.NODE_ENV === 'production' ||
                  !!process.env.RAILWAY_ENVIRONMENT ||
                  !!process.env.RAILWAY_ENVIRONMENT_NAME ||
                  !!process.env.RAILWAY_PROJECT_ID;

if (EM_PRODUCAO && !process.env.SENHA_MESTRE) {
  console.error('');
  console.error('  ⛔  SENHA_MESTRE não está definida.');
  console.error('');
  console.error('      Sem ela o servidor usaria a senha de exemplo ("mestre") e');
  console.error('      qualquer pessoa com o link poderia editar o mundo inteiro.');
  console.error('      Defina SENHA_MESTRE nas variáveis do projeto e publique de novo.');
  console.error('');
  process.exit(1);
}

/* ------------------------------------------------------------------
   Estado — em Postgres (DATABASE_URL definida) ou em disco (fallback
   para rodar local sem banco nenhum).

   Duas contagens, de propósito:
     versao        sobe quando o mestre grava o mundo. É ela que a trava
                   otimista compara, então o diário não pode mexer nela —
                   senão cada anotação de jogador viraria um conflito falso.
     atualizadoEm  sobe a cada alteração de qualquer tipo. É o carimbo que
                   os clientes ficam consultando para saber se vale baixar.

   epocaMestre sobe quando o mestre sai, derrubando os cookies já emitidos.
   ------------------------------------------------------------------ */

var estado = {
  versao: 1,
  atualizadoEm: 0,
  mapa: null,
  calendario: null,
  epocaMestre: 1
};

function garantirPasta() {
  try {
    fs.mkdirSync(DADOS_DIR, { recursive: true });
  } catch (e) {
    console.error('Não consegui criar a pasta de dados:', e.message);
  }
}

/* Carrega o estado inicial e só então libera o servidor para ouvir a
   porta — devolve uma promise nos dois modos. */
function iniciarEstado() {
  if (USANDO_POSTGRES) {
    return Banco.iniciar(DATABASE_URL, ARQUIVO_ESTADO).then(function (carregado) {
      estado = carregado;
      console.log('Estado carregado do Postgres.');
    });
  }
  garantirPasta();
  try {
    var bruto = fs.readFileSync(ARQUIVO_ESTADO, 'utf8');
    var lido = JSON.parse(bruto);
    estado = {
      versao: lido.versao || 1,
      atualizadoEm: lido.atualizadoEm || Date.now(),
      mapa: lido.mapa || null,
      calendario: lido.calendario || null,
      epocaMestre: lido.epocaMestre || 1
    };
    console.log('Estado carregado de ' + ARQUIVO_ESTADO);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('Estado ilegível, começando do zero:', e.message);
    else console.log('Nenhum estado salvo ainda — os clientes usarão o padrão embutido.');
  }
  return Promise.resolve();
}

function persistirEstadoAgora() {
  if (USANDO_POSTGRES) {
    return Banco.salvarEstado(estado).catch(function (e) {
      console.error('Falha ao gravar o estado no Postgres:', e.message);
    });
  }
  garantirPasta();
  var temporario = ARQUIVO_ESTADO + '.tmp';
  try {
    fs.writeFileSync(temporario, JSON.stringify(estado), 'utf8');
    fs.renameSync(temporario, ARQUIVO_ESTADO);
  } catch (e) {
    console.error('Falha ao gravar o estado:', e.message);
  }
  return Promise.resolve();
}

var gravacaoPendente = null;

function salvarEstado() {
  // agrupa gravações próximas para não castigar o banco/disco
  if (gravacaoPendente) clearTimeout(gravacaoPendente);
  gravacaoPendente = setTimeout(function () {
    gravacaoPendente = null;
    persistirEstadoAgora();
  }, 250);
}

/* O mestre gravou o mundo: a revisão anda, e quem estava editando a
   partir da revisão anterior vai levar um 409 em vez de sobrescrever. */
function registrarMudancaDoMestre() {
  estado.versao = (estado.versao || 1) + 1;
  estado.atualizadoEm = Date.now();
  salvarEstado();
}

/* O diário é de outra natureza: mexe só nas notas, que o mestre nunca
   grava por /api/estado. Move o carimbo, não a revisão. */
function registrarMudancaDoDiario() {
  estado.atualizadoEm = Date.now();
  salvarEstado();
}

/* O calendário que o mestre manda vem sem as notas — ele está sempre com
   uma cópia de até seis segundos atrás, e devolvê-la apagaria o que os
   jogadores acabaram de escrever. As notas do servidor mandam. Só a
   restauração de um backup pede explicitamente para trocá-las. */
function mesclarCalendario(atual, novo, substituirNotas) {
  if (!novo || typeof novo !== 'object') return novo;
  var saida = {};
  Object.keys(novo).forEach(function (chave) { saida[chave] = novo[chave]; });
  if (!substituirNotas) {
    var guardadas = atual && atual.notas;
    saida.notas = guardadas || novo.notas || {};
  }
  return saida;
}

/* ------------------------------------------------------------------
   Sessão do mestre (cookie assinado)
   ------------------------------------------------------------------ */

function assinar(valor) {
  return crypto.createHmac('sha256', SEGREDO).update(valor).digest('hex').slice(0, 32);
}

/* A época que vale para cada nível. Só a do mestre anda — os jogadores
   dividem uma senha só, então revogar um revogaria a mesa inteira sem
   ganhar nada em troca. */
function epocaDoNivel(nivel) {
  return nivel === 'mestre' ? (estado.epocaMestre || 1) : 1;
}

function criarToken(nivel) {
  var expira = Date.now() + DURACAO_SESSAO_MS;
  var corpo = nivel + '.' + epocaDoNivel(nivel) + '.' + expira;
  return corpo + '.' + assinar(corpo);
}

/* Devolve 'mestre', 'jogador' ou null.

   O token carrega a época em que nasceu. Quando o mestre sai, a época
   avança e todo cookie de mestre já emitido morre junto — antes o "Sair"
   só pedia ao navegador que esquecesse o cookie, e uma cópia dele valia
   por trinta dias. Cookies do formato antigo (sem época) não passam:
   quem tinha sessão aberta entra uma vez de novo. */
function nivelDoToken(token) {
  if (!token) return null;
  var partes = token.split('.');
  if (partes.length !== 4) return null;
  var nivel = partes[0];
  if (nivel !== 'mestre' && nivel !== 'jogador') return null;
  var corpo = nivel + '.' + partes[1] + '.' + partes[2];
  if (!comparacaoSegura(assinar(corpo), partes[3])) return null;
  if (parseInt(partes[2], 10) <= Date.now()) return null;
  if (parseInt(partes[1], 10) !== epocaDoNivel(nivel)) return null;
  return nivel;
}

/* Compara pelo resumo: dá sempre o mesmo tamanho, então nem o tempo
   nem o comprimento da resposta contam quantos caracteres tem a senha. */
function confereCom(tentativa, alvo) {
  var a = crypto.createHash('sha256').update(String(tentativa)).digest();
  var b = crypto.createHash('sha256').update(String(alvo)).digest();
  return crypto.timingSafeEqual(a, b);
}

/* Qual porta a senha abre: a do mestre, a da mesa, ou nenhuma. */
function nivelDaSenha(tentativa) {
  if (confereCom(tentativa, SENHA_MESTRE)) return 'mestre';
  if (PORTAO_FECHADO && confereCom(tentativa, SENHA_JOGADOR)) return 'jogador';
  return null;
}

function comparacaoSegura(a, b) {
  var ba = Buffer.from(String(a));
  var bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/* O cabeçalho pode chegar como "https,http" quando passa por mais de um salto. */
function protocoloHttps(req) {
  var proto = req.headers['x-forwarded-proto'];
  if (!proto) return false;
  return String(proto).split(',')[0].trim().toLowerCase() === 'https';
}

function lerCookies(req) {
  var cru = req.headers.cookie || '';
  var saida = {};
  cru.split(';').forEach(function (parte) {
    var i = parte.indexOf('=');
    if (i < 0) return;
    saida[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim());
  });
  return saida;
}

/* Sem SENHA_JOGADOR configurada o link é aberto, como antes: quem chega
   entra como jogador. Com ela, quem não tem cookie não passa da porta. */
function nivelDoPedido(req) {
  var nivel = nivelDoToken(lerCookies(req).artoniana_mestre);
  if (nivel) return nivel;
  return PORTAO_FECHADO ? null : 'jogador';
}

function ehMestre(req) {
  return nivelDoPedido(req) === 'mestre';
}

/* Atrás do proxy do Railway todas as conexões vêm do mesmo endereço, então
   req.socket.remoteAddress é igual para a mesa inteira. Sem olhar o
   X-Forwarded-For, dez erros de senha de qualquer pessoa trancariam todo
   mundo por quinze minutos — inclusive o mestre. */
function ipDoPedido(req) {
  var encaminhado = req.headers['x-forwarded-for'];
  if (encaminhado) {
    var primeiro = String(encaminhado).split(',')[0].trim();
    if (primeiro) return primeiro;
  }
  return req.socket.remoteAddress || 'desconhecido';
}

/* Freio contra força bruta na senha, em duas camadas:
   - por IP, apertado: quem erra muito para de tentar
   - global, folgado: como o X-Forwarded-For pode ser forjado, existe um
     teto geral que segura uma enxurrada sem trancar a mesa por acidente */
var JANELA_MS = 15 * 60 * 1000;
var LIMITE_POR_IP = 10;
var LIMITE_GLOBAL = 60;

var tentativas = {};
var geral = { contagem: 0, desde: 0 };

function podeTentar(ip) {
  var agora = Date.now();
  if (agora - geral.desde > JANELA_MS) geral = { contagem: 0, desde: agora };
  if (geral.contagem >= LIMITE_GLOBAL) return false;

  var registro = tentativas[ip];
  if (!registro || agora - registro.desde > JANELA_MS) {
    tentativas[ip] = { contagem: 0, desde: agora };
    return true;
  }
  return registro.contagem < LIMITE_POR_IP;
}

/* Tira só as janelas já vencidas. Zerar a tabela inteira ao encher,
   como era antes, perdoava justamente quem estava no meio do ataque. */
function limparVencidos(tabela, janelaMs) {
  var agora = Date.now();
  Object.keys(tabela).forEach(function (chave) {
    if (agora - tabela[chave].desde > janelaMs) delete tabela[chave];
  });
}

function registrarFalha(ip) {
  if (tentativas[ip]) tentativas[ip].contagem++;
  geral.contagem++;
  // não deixa a tabela crescer sem fim; o teto global segura o resto
  if (Object.keys(tentativas).length > 5000) limparVencidos(tentativas, JANELA_MS);
  if (Object.keys(tentativas).length > 5000) tentativas = {};
}

/* Freio leve no diário: ninguém precisa escrever mais que isso por minuto. */
var escritas = {};
function podeEscreverDiario(ip) {
  var agora = Date.now();
  var r = escritas[ip];
  if (!r || agora - r.desde > 60 * 1000) { escritas[ip] = { contagem: 0, desde: agora }; return true; }
  return r.contagem < 30;
}
function registrarEscrita(ip) {
  if (escritas[ip]) escritas[ip].contagem++;
  if (Object.keys(escritas).length > 5000) limparVencidos(escritas, 60 * 1000);
  if (Object.keys(escritas).length > 5000) escritas = {};
}

/* ------------------------------------------------------------------
   Utilidades HTTP
   ------------------------------------------------------------------ */

function aceitaGzip(req) {
  return /(^|,)\s*gzip\s*(;|,|$)/i.test(
    String((req && req.headers && req.headers['accept-encoding']) || '')
  );
}

function responderJson(res, codigo, objeto, cabecalhos) {
  var corpo = Buffer.from(JSON.stringify(objeto), 'utf8');
  var h = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Vary': 'Accept-Encoding'
  };
  if (cabecalhos) Object.keys(cabecalhos).forEach(function (k) { h[k] = cabecalhos[k]; });

  function enviarCru() {
    h['Content-Length'] = corpo.length;
    res.writeHead(codigo, h);
    res.end(corpo);
  }

  // O estado inteiro passa fácil de cem quilobytes e é baixado toda vez
  // que o mestre mexe em algo. Resposta curta não paga a compressão.
  if (corpo.length <= 1024 || !aceitaGzip(res.req)) return enviarCru();

  zlib.gzip(corpo, function (erro, comprimido) {
    if (erro || res.writableEnded) return erro ? enviarCru() : undefined;
    h['Content-Encoding'] = 'gzip';
    h['Content-Length'] = comprimido.length;
    res.writeHead(codigo, h);
    res.end(comprimido);
  });
}

var LIMITE_CORPO = 12 * 1024 * 1024;   // 12 MB

function lerCorpo(req, aoTerminar) {
  var pedacos = [];
  var tamanho = 0;
  var encerrado = false;

  function terminar(erro, valor) {
    if (encerrado) return;
    encerrado = true;
    aoTerminar(erro, valor);
  }

  req.on('data', function (p) {
    if (encerrado) return;
    tamanho += p.length;
    if (tamanho > LIMITE_CORPO) {
      // antes o pedido era destruído em silêncio e o cliente ficava
      // esperando uma resposta que nunca vinha
      var estouro = new Error('Corpo grande demais.');
      estouro.grandeDemais = true;
      terminar(estouro);
      req.destroy();
      return;
    }
    pedacos.push(p);
  });
  req.on('end', function () {
    try {
      var texto = Buffer.concat(pedacos).toString('utf8');
      terminar(null, texto ? JSON.parse(texto) : {});
    } catch (e) {
      terminar(e);
    }
  });
  req.on('error', function (e) { terminar(e); });
}

/* Resposta de erro comum a quem manda um corpo inválido. */
function recusarCorpo(res, erro, mensagem) {
  if (erro && erro.grandeDemais) {
    return responderJson(res, 413, { erro: 'Isso é grande demais para uma gravação só.' });
  }
  return responderJson(res, 400, { erro: mensagem });
}

var TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

/* Tipos que valem comprimir. Imagem já vem comprimida de fábrica. */
var COMPRIMIVEIS = {
  'text/html': true,
  'text/css': true,
  'application/javascript': true,
  'application/json': true,
  'image/svg+xml': true,
  'text/plain': true
};

function servirEstatico(req, res, caminhoUrl) {
  var relativo;
  try {
    relativo = decodeURIComponent(caminhoUrl);
  } catch (e) {
    // Um "%" solto na URL faz o decodeURIComponent lançar. Sem esta
    // guarda o erro subia até o handler do http e derrubava o processo:
    // um GET /% tirava a mesa inteira do ar.
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Caminho inválido');
    return;
  }
  if (relativo === '/') relativo = '/index.html';
  var destino = path.join(RAIZ_PUBLICA, path.normalize(relativo));

  // impede sair da pasta pública — comparando com a barra junto, para
  // que uma pasta irmã de nome parecido não passe pelo prefixo
  if (destino !== RAIZ_PUBLICA && destino.indexOf(RAIZ_PUBLICA + path.sep) !== 0) {
    res.writeHead(403); res.end('Proibido'); return;
  }

  fs.stat(destino, function (erro, info) {
    if (erro || !info.isFile()) {
      // tenta acrescentar .html (permite /mapa em vez de /mapa.html)
      fs.stat(destino + '.html', function (e2, i2) {
        if (e2 || !i2.isFile()) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Não encontrado');
          return;
        }
        enviarArquivo(req, res, destino + '.html', i2);
      });
      return;
    }
    enviarArquivo(req, res, destino, info);
  });
}

function enviarArquivo(req, res, destino, info) {
  var extensao = path.extname(destino).toLowerCase();
  var tipo = TIPOS[extensao] || 'application/octet-stream';
  var ehImagem = extensao === '.png' || extensao === '.jpg' || extensao === '.jpeg' ||
                 extensao === '.webp';

  /* São mais de trezentos quilobytes de JS e CSS por carga — só o desenho
     da geografia passa de cem. Comprimido cai para menos de um terço, o
     que no celular é a diferença entre abrir na hora e esperar. */
  var comprimir = !ehImagem &&
                  COMPRIMIVEIS[String(tipo).split(';')[0].trim()] === true &&
                  info.size > 1024 &&
                  aceitaGzip(req);

  // a versão comprimida e a crua são corpos diferentes: etiquetas diferentes
  var etag = '"' + info.size + '-' + Number(info.mtimeMs).toString(36) +
             (comprimir ? '-gz' : '') + '"';

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { 'ETag': etag, 'Vary': 'Accept-Encoding' });
    res.end();
    return;
  }

  var cabecalhos = {
    'Content-Type': tipo,
    'ETag': etag,
    'Vary': 'Accept-Encoding',
    'Cache-Control': ehImagem ? 'public, max-age=604800' : 'no-cache'
  };
  if (comprimir) cabecalhos['Content-Encoding'] = 'gzip';
  else cabecalhos['Content-Length'] = info.size;

  res.writeHead(200, cabecalhos);
  if (req.method === 'HEAD') { res.end(); return; }

  var leitura = fs.createReadStream(destino);
  leitura.on('error', function () { res.destroy(); });

  if (!comprimir) { leitura.pipe(res); return; }

  var compressor = zlib.createGzip();
  compressor.on('error', function () { res.destroy(); });
  leitura.pipe(compressor).pipe(res);
}

/* ------------------------------------------------------------------
   Rotas da API
   ------------------------------------------------------------------ */

function tratarApi(req, res, rota, consulta) {
  var nivel = nivelDoPedido(req);
  var mestre = nivel === 'mestre';
  var entrou = nivel !== null;

  function semSenha() {
    return responderJson(res, 401, {
      erro: 'Esta mesa é fechada. Peça a senha ao mestre.',
      precisaSenha: true
    });
  }

  if (rota === '/api/sessao' && req.method === 'GET') {
    return responderJson(res, 200, {
      mestre: mestre, nivel: nivel, portaoFechado: PORTAO_FECHADO, ano: 1410
    });
  }

  if (rota === '/api/login' && req.method === 'POST') {
    var ip = ipDoPedido(req);
    if (!podeTentar(ip)) {
      return responderJson(res, 429, { erro: 'Muitas tentativas. Espere alguns minutos.' });
    }
    return lerCorpo(req, function (erro, corpo) {
      if (erro) return recusarCorpo(res, erro, 'Requisição inválida.');
      var senha = String((corpo && corpo.senha) || '');
      var nivelNovo = nivelDaSenha(senha);
      if (!nivelNovo) {
        registrarFalha(ip);
        return responderJson(res, 401, { erro: 'Senha incorreta.' });
      }
      var cookie = 'artoniana_mestre=' + criarToken(nivelNovo) +
        '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + Math.floor(DURACAO_SESSAO_MS / 1000) +
        (protocoloHttps(req) ? '; Secure' : '');
      responderJson(res, 200, {
        mestre: nivelNovo === 'mestre', nivel: nivelNovo
      }, { 'Set-Cookie': cookie });
    });
  }

  if (rota === '/api/logout' && req.method === 'POST') {
    /* Sair de verdade: a época avança e todo cookie de mestre já emitido
       para de valer, não só o deste navegador. Como o mestre é um só,
       não há sessão de terceiro para derrubar junto. */
    if (mestre) {
      estado.epocaMestre = (estado.epocaMestre || 1) + 1;
      salvarEstado();
    }
    return responderJson(res, 200, { mestre: false }, {
      'Set-Cookie': 'artoniana_mestre=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
    });
  }

  /* Só o carimbo de tempo — os jogadores consultam isto a cada poucos
     segundos para saber se vale a pena baixar o estado inteiro. */
  if (rota === '/api/versao' && req.method === 'GET') {
    if (!entrou) return semSenha();
    return responderJson(res, 200, {
      atualizadoEm: estado.atualizadoEm,
      mestre: mestre, nivel: nivel
    });
  }

  if (rota === '/api/estado' && req.method === 'GET') {
    if (!entrou) return semSenha();
    var desde = parseInt(consulta.desde, 10);
    if (desde && desde >= estado.atualizadoEm) {
      return responderJson(res, 200, {
        semMudanca: true,
        versao: estado.versao,
        atualizadoEm: estado.atualizadoEm
      });
    }
    return responderJson(res, 200, {
      versao: estado.versao,
      atualizadoEm: estado.atualizadoEm,
      mapa: estado.mapa,
      calendario: estado.calendario,
      mestre: mestre, nivel: nivel
    });
  }

  if (rota === '/api/estado' && (req.method === 'PUT' || req.method === 'POST')) {
    if (!mestre) {
      return responderJson(res, 403, {
        erro: 'Só o mestre pode alterar o mundo. Entre com a senha para editar.'
      });
    }
    return lerCorpo(req, function (erro, corpo) {
      if (erro) return recusarCorpo(res, erro, 'JSON inválido: ' + erro.message);

      /* Trava otimista. O mestre diz de qual revisão partiu; se o mundo
         andou desde então — outra aba, outro aparelho — recusa em vez de
         passar por cima do que o outro escreveu. */
      var base = parseInt(corpo.baseVersao, 10);
      if (base && base !== estado.versao) {
        return responderJson(res, 409, {
          erro: 'O mundo mudou em outro lugar enquanto você editava.',
          conflito: true,
          versao: estado.versao,
          atualizadoEm: estado.atualizadoEm
        });
      }

      if (corpo.mapa !== undefined) estado.mapa = corpo.mapa;
      if (corpo.calendario !== undefined) {
        estado.calendario = mesclarCalendario(
          estado.calendario, corpo.calendario, corpo.substituirNotas === true
        );
      }
      registrarMudancaDoMestre();
      responderJson(res, 200, {
        ok: true, versao: estado.versao, atualizadoEm: estado.atualizadoEm
      });
    });
  }

  /* O diário é a única coisa que um jogador pode escrever: a entrada do
     próprio herói, num dia. Nada mais do estado é gravável por ele.
     Como não há senha por jogador, quem tem o link pode escrever como
     qualquer herói da lista — é uma mesa de amigos, não um fórum aberto.
     O mestre lê tudo e pode apagar o que quiser. */
  if (rota === '/api/diario' && req.method === 'POST') {
    if (!entrou) return semSenha();
    var ipDiario = ipDoPedido(req);
    if (!podeEscreverDiario(ipDiario)) {
      return responderJson(res, 429, { erro: 'Calma. Espere um pouco antes de escrever de novo.' });
    }
    return lerCorpo(req, function (erro, corpo) {
      if (erro) return recusarCorpo(res, erro, 'Requisição inválida.');

      var chave = String((corpo && corpo.chave) || '');
      var autor = String((corpo && corpo.autor) || '');
      var texto = String((corpo && corpo.texto) || '');

      // chave de dia: "1410-3-5" ou, nos Dias de Nimb, "1410-N-2"
      if (!/^-?\d{1,6}-(N|\d{1,2})-\d{1,2}$/.test(chave)) {
        return responderJson(res, 400, { erro: 'Dia inválido.' });
      }
      if (texto.length > 4000) {
        return responderJson(res, 400, { erro: 'Texto longo demais (máximo 4.000 caracteres).' });
      }

      if (autor === 'mestre') {
        if (!mestre) return responderJson(res, 403, { erro: 'Só o mestre escreve como mestre.' });
      } else {
        var heroi = estado.mapa && Array.isArray(estado.mapa.tokens) &&
          estado.mapa.tokens.filter(function (t) { return t.id === autor && t.nome; })[0];
        if (!heroi) {
          return responderJson(res, 403, { erro: 'Esse herói não existe no grupo.' });
        }
      }

      if (!estado.calendario) estado.calendario = { versao: 1, notas: {} };
      if (!estado.calendario.notas) estado.calendario.notas = {};

      var doDia = estado.calendario.notas[chave];
      if (typeof doDia === 'string') doDia = { mestre: doDia };   // formato antigo
      if (!doDia || typeof doDia !== 'object') doDia = {};

      if (texto.trim()) doDia[autor] = texto.trim();
      else delete doDia[autor];

      if (Object.keys(doDia).length) estado.calendario.notas[chave] = doDia;
      else delete estado.calendario.notas[chave];

      registrarMudancaDoDiario();
      registrarEscrita(ipDiario);
      responderJson(res, 200, { ok: true, atualizadoEm: estado.atualizadoEm });
    });
  }

  if (rota === '/api/reiniciar' && req.method === 'POST') {
    if (!mestre) return responderJson(res, 403, { erro: 'Só o mestre pode reiniciar.' });
    return lerCorpo(req, function (erro, corpo) {
      if (erro) return recusarCorpo(res, erro, 'Requisição inválida.');
      var alvo = (corpo && corpo.alvo) || 'tudo';
      if (alvo === 'mapa' || alvo === 'tudo') estado.mapa = null;
      if (alvo === 'calendario' || alvo === 'tudo') estado.calendario = null;
      registrarMudancaDoMestre();
      responderJson(res, 200, {
        ok: true, versao: estado.versao, atualizadoEm: estado.atualizadoEm
      });
    });
  }

  responderJson(res, 404, { erro: 'Rota desconhecida.' });
}

/* ------------------------------------------------------------------
   Servidor
   ------------------------------------------------------------------ */

var servidor = http.createServer(function (req, res) {
  var endereco;
  try {
    endereco = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  } catch (e) {
    res.writeHead(400); res.end('Requisição malformada'); return;
  }
  var rota = endereco.pathname;

  if (rota.indexOf('/api/') === 0) {
    var consulta = {};
    endereco.searchParams.forEach(function (valor, chave) { consulta[chave] = valor; });
    return tratarApi(req, res, rota, consulta);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405); res.end('Método não permitido'); return;
  }
  servirEstatico(req, res, rota);
});

iniciarEstado().then(function () {
  servidor.listen(PORTA, function () {
    console.log('');
    console.log('  ⚔️  Crônicas Artonianas — circa 1410');
    console.log('  ---------------------------------------------');
    console.log('  Servindo em  http://localhost:' + PORTA);
    console.log('  Dados em     ' + (USANDO_POSTGRES ? 'Postgres (DATABASE_URL)' : ARQUIVO_ESTADO));
    console.log('  Acesso       ' + (PORTAO_FECHADO
      ? 'fechado — só quem tem a senha da mesa entra'
      : 'ABERTO — qualquer pessoa com o link vê tudo'));
    if (!PORTAO_FECHADO) {
      console.log('');
      console.log('  ⚠️  SENHA_JOGADOR não definida — o link é público.');
      console.log('     Defina-a para que só a sua mesa entre.');
    }
    if (!process.env.SENHA_MESTRE) {
      console.log('');
      console.log('  ⚠️  SENHA_MESTRE não definida — usando "mestre".');
      console.log('     Defina a variável de ambiente antes de publicar!');
    }
    if (!USANDO_POSTGRES) {
      console.log('');
      console.log('  ⚠️  DATABASE_URL não definida — gravando em arquivo local.');
      console.log('     No Railway, sem um banco Postgres o mundo se perde a cada redeploy.');
    }
    console.log('');
  });
}).catch(function (e) {
  console.error('Não consegui carregar o estado inicial:', e.message);
  process.exit(1);
});

/* Rede de segurança. Um erro solto num handler não pode tirar a mesa do
   ar no meio da sessão — loga e segue de pé. É a última linha: o certo
   continua sendo tratar o erro onde ele nasce. */
process.on('uncaughtException', function (e) {
  console.error('Erro não tratado (o servidor continua de pé):', (e && e.stack) || e);
});

process.on('unhandledRejection', function (e) {
  console.error('Promise rejeitada sem tratamento:', (e && e.stack) || e);
});

process.on('SIGTERM', function () {
  if (gravacaoPendente) { clearTimeout(gravacaoPendente); gravacaoPendente = null; }

  function finalizar() { servidor.close(function () { process.exit(0); }); }

  if (USANDO_POSTGRES) {
    var tempoLimite = setTimeout(finalizar, 3000);
    Banco.salvarEstado(estado).catch(function () { /* melhor esforço */ }).then(function () {
      clearTimeout(tempoLimite);
      finalizar();
    });
    return;
  }

  try {
    garantirPasta();
    fs.writeFileSync(ARQUIVO_ESTADO, JSON.stringify(estado), 'utf8');
  } catch (e) { /* nada a fazer */ }
  finalizar();
});
