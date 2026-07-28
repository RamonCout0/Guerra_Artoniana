/* =============================================================
   SERVIDOR — Crônicas Artonianas
   Node.js puro, sem dependências. Pronto para o Railway.

   - Serve os arquivos estáticos de ./publico
   - Guarda o estado compartilhado (mapa + calendário) em disco
   - Só o mestre, autenticado por senha, pode gravar
   - Jogadores acessam a mesma URL e enxergam tudo em modo leitura

   Variáveis de ambiente:
     PORT          porta HTTP (o Railway define sozinho)
     SENHA_MESTRE  senha do mestre                  (padrão: "mestre")
     SEGREDO       segredo para assinar o cookie    (padrão: derivado da senha)
     DADOS_DIR     pasta onde o estado é gravado    (padrão: ./dados)
   ============================================================= */

'use strict';

var http = require('http');
var fs = require('fs');
var path = require('path');
var crypto = require('crypto');

var PORTA = parseInt(process.env.PORT, 10) || 3000;
var SENHA_MESTRE = process.env.SENHA_MESTRE || 'mestre';
var SEGREDO = process.env.SEGREDO ||
  crypto.createHash('sha256').update('artoniana:' + SENHA_MESTRE).digest('hex');
var DADOS_DIR = process.env.DADOS_DIR || path.join(__dirname, 'dados');
var ARQUIVO_ESTADO = path.join(DADOS_DIR, 'estado.json');
var RAIZ_PUBLICA = path.join(__dirname, 'publico');
var DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000;  // 30 dias

/* ------------------------------------------------------------------
   Estado em disco
   ------------------------------------------------------------------ */

var estado = { versao: 1, atualizadoEm: 0, mapa: null, calendario: null };

function garantirPasta() {
  try {
    fs.mkdirSync(DADOS_DIR, { recursive: true });
  } catch (e) {
    console.error('Não consegui criar a pasta de dados:', e.message);
  }
}

function carregarEstado() {
  garantirPasta();
  try {
    var bruto = fs.readFileSync(ARQUIVO_ESTADO, 'utf8');
    var lido = JSON.parse(bruto);
    estado = {
      versao: lido.versao || 1,
      atualizadoEm: lido.atualizadoEm || Date.now(),
      mapa: lido.mapa || null,
      calendario: lido.calendario || null
    };
    console.log('Estado carregado de ' + ARQUIVO_ESTADO);
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn('Estado ilegível, começando do zero:', e.message);
    else console.log('Nenhum estado salvo ainda — os clientes usarão o padrão embutido.');
  }
}

var gravacaoPendente = null;

function salvarEstado() {
  // agrupa gravações próximas para não castigar o disco
  if (gravacaoPendente) clearTimeout(gravacaoPendente);
  gravacaoPendente = setTimeout(function () {
    gravacaoPendente = null;
    garantirPasta();
    var temporario = ARQUIVO_ESTADO + '.tmp';
    try {
      fs.writeFileSync(temporario, JSON.stringify(estado), 'utf8');
      fs.renameSync(temporario, ARQUIVO_ESTADO);
    } catch (e) {
      console.error('Falha ao gravar o estado:', e.message);
    }
  }, 250);
}

/* ------------------------------------------------------------------
   Sessão do mestre (cookie assinado)
   ------------------------------------------------------------------ */

function assinar(valor) {
  return crypto.createHmac('sha256', SEGREDO).update(valor).digest('hex').slice(0, 32);
}

function criarToken() {
  var expira = Date.now() + DURACAO_SESSAO_MS;
  var corpo = 'mestre.' + expira;
  return corpo + '.' + assinar(corpo);
}

function tokenValido(token) {
  if (!token) return false;
  var partes = token.split('.');
  if (partes.length !== 3 || partes[0] !== 'mestre') return false;
  var corpo = partes[0] + '.' + partes[1];
  var esperado = assinar(corpo);
  if (!comparacaoSegura(esperado, partes[2])) return false;
  return parseInt(partes[1], 10) > Date.now();
}

function comparacaoSegura(a, b) {
  var ba = Buffer.from(String(a));
  var bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
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

function ehMestre(req) {
  return tokenValido(lerCookies(req).artoniana_mestre);
}

/* Freio simples contra tentativa de força bruta na senha */
var tentativas = {};
function podeTentar(ip) {
  var agora = Date.now();
  var registro = tentativas[ip];
  if (!registro || agora - registro.desde > 15 * 60 * 1000) {
    tentativas[ip] = { contagem: 0, desde: agora };
    return true;
  }
  return registro.contagem < 10;
}
function registrarFalha(ip) {
  if (tentativas[ip]) tentativas[ip].contagem++;
}

/* ------------------------------------------------------------------
   Utilidades HTTP
   ------------------------------------------------------------------ */

function responderJson(res, codigo, objeto, cabecalhos) {
  var corpo = JSON.stringify(objeto);
  var h = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(corpo),
    'Cache-Control': 'no-store'
  };
  if (cabecalhos) Object.keys(cabecalhos).forEach(function (k) { h[k] = cabecalhos[k]; });
  res.writeHead(codigo, h);
  res.end(corpo);
}

function lerCorpo(req, aoTerminar) {
  var pedacos = [];
  var tamanho = 0;
  req.on('data', function (p) {
    tamanho += p.length;
    if (tamanho > 12 * 1024 * 1024) {   // 12 MB
      req.destroy();
      return;
    }
    pedacos.push(p);
  });
  req.on('end', function () {
    try {
      var texto = Buffer.concat(pedacos).toString('utf8');
      aoTerminar(null, texto ? JSON.parse(texto) : {});
    } catch (e) {
      aoTerminar(e);
    }
  });
  req.on('error', function (e) { aoTerminar(e); });
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

function servirEstatico(req, res, caminhoUrl) {
  var relativo = decodeURIComponent(caminhoUrl);
  if (relativo === '/') relativo = '/index.html';
  var destino = path.join(RAIZ_PUBLICA, path.normalize(relativo));

  // impede sair da pasta pública
  if (destino.indexOf(RAIZ_PUBLICA) !== 0) {
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
  var etag = '"' + info.size + '-' + Number(info.mtimeMs).toString(36) + '"';
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304); res.end(); return;
  }
  var ehImagem = extensao === '.png' || extensao === '.jpg' || extensao === '.jpeg' ||
                 extensao === '.webp';
  res.writeHead(200, {
    'Content-Type': TIPOS[extensao] || 'application/octet-stream',
    'Content-Length': info.size,
    'ETag': etag,
    'Cache-Control': ehImagem ? 'public, max-age=604800' : 'no-cache'
  });
  if (req.method === 'HEAD') { res.end(); return; }
  fs.createReadStream(destino).pipe(res);
}

/* ------------------------------------------------------------------
   Rotas da API
   ------------------------------------------------------------------ */

function tratarApi(req, res, rota, consulta) {
  var mestre = ehMestre(req);

  if (rota === '/api/sessao' && req.method === 'GET') {
    return responderJson(res, 200, { mestre: mestre, ano: 1410 });
  }

  if (rota === '/api/login' && req.method === 'POST') {
    var ip = req.socket.remoteAddress || 'desconhecido';
    if (!podeTentar(ip)) {
      return responderJson(res, 429, { erro: 'Muitas tentativas. Espere alguns minutos.' });
    }
    return lerCorpo(req, function (erro, corpo) {
      if (erro) return responderJson(res, 400, { erro: 'Requisição inválida.' });
      var senha = String((corpo && corpo.senha) || '');
      var confere = senha.length === SENHA_MESTRE.length &&
                    comparacaoSegura(senha, SENHA_MESTRE);
      if (!confere) {
        registrarFalha(ip);
        return responderJson(res, 401, { erro: 'Senha incorreta.' });
      }
      var cookie = 'artoniana_mestre=' + criarToken() +
        '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + Math.floor(DURACAO_SESSAO_MS / 1000) +
        (req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '');
      responderJson(res, 200, { mestre: true }, { 'Set-Cookie': cookie });
    });
  }

  if (rota === '/api/logout' && req.method === 'POST') {
    return responderJson(res, 200, { mestre: false }, {
      'Set-Cookie': 'artoniana_mestre=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
    });
  }

  /* Só o carimbo de tempo — os jogadores consultam isto a cada poucos
     segundos para saber se vale a pena baixar o estado inteiro. */
  if (rota === '/api/versao' && req.method === 'GET') {
    return responderJson(res, 200, {
      atualizadoEm: estado.atualizadoEm,
      mestre: mestre
    });
  }

  if (rota === '/api/estado' && req.method === 'GET') {
    var desde = parseInt(consulta.desde, 10);
    if (desde && desde >= estado.atualizadoEm) {
      return responderJson(res, 200, { semMudanca: true, atualizadoEm: estado.atualizadoEm });
    }
    return responderJson(res, 200, {
      versao: estado.versao,
      atualizadoEm: estado.atualizadoEm,
      mapa: estado.mapa,
      calendario: estado.calendario,
      mestre: mestre
    });
  }

  if (rota === '/api/estado' && (req.method === 'PUT' || req.method === 'POST')) {
    if (!mestre) {
      return responderJson(res, 403, {
        erro: 'Só o mestre pode alterar o mundo. Entre com a senha para editar.'
      });
    }
    return lerCorpo(req, function (erro, corpo) {
      if (erro) return responderJson(res, 400, { erro: 'JSON inválido: ' + erro.message });
      if (corpo.mapa !== undefined) estado.mapa = corpo.mapa;
      if (corpo.calendario !== undefined) estado.calendario = corpo.calendario;
      estado.atualizadoEm = Date.now();
      salvarEstado();
      responderJson(res, 200, { ok: true, atualizadoEm: estado.atualizadoEm });
    });
  }

  if (rota === '/api/reiniciar' && req.method === 'POST') {
    if (!mestre) return responderJson(res, 403, { erro: 'Só o mestre pode reiniciar.' });
    return lerCorpo(req, function (erro, corpo) {
      var alvo = (corpo && corpo.alvo) || 'tudo';
      if (alvo === 'mapa' || alvo === 'tudo') estado.mapa = null;
      if (alvo === 'calendario' || alvo === 'tudo') estado.calendario = null;
      estado.atualizadoEm = Date.now();
      salvarEstado();
      responderJson(res, 200, { ok: true, atualizadoEm: estado.atualizadoEm });
    });
  }

  responderJson(res, 404, { erro: 'Rota desconhecida.' });
}

/* ------------------------------------------------------------------
   Servidor
   ------------------------------------------------------------------ */

carregarEstado();

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

servidor.listen(PORTA, function () {
  console.log('');
  console.log('  ⚔️  Crônicas Artonianas — circa 1410');
  console.log('  ---------------------------------------------');
  console.log('  Servindo em  http://localhost:' + PORTA);
  console.log('  Dados em     ' + ARQUIVO_ESTADO);
  if (!process.env.SENHA_MESTRE) {
    console.log('');
    console.log('  ⚠️  SENHA_MESTRE não definida — usando "mestre".');
    console.log('     Defina a variável de ambiente antes de publicar!');
  }
  console.log('');
});

process.on('SIGTERM', function () {
  if (gravacaoPendente) { clearTimeout(gravacaoPendente); gravacaoPendente = null; }
  try {
    garantirPasta();
    fs.writeFileSync(ARQUIVO_ESTADO, JSON.stringify(estado), 'utf8');
  } catch (e) { /* nada a fazer */ }
  servidor.close(function () { process.exit(0); });
});
