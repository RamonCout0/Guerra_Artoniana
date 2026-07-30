/* =============================================================
   BANCO — persistência do estado em Postgres
   Node.js puro + pg. Usado quando DATABASE_URL está definida;
   servidor.js cai para o arquivo local quando não está.

   Guarda o mundo (mapa + calendário) numa única linha (id=1) —
   o mesmo modelo singleton que já existia em memória.
   ============================================================= */

'use strict';

var fs = require('fs');
var Pool = require('pg').Pool;

var pool = null;

function iniciar(connectionString, arquivoLegado) {
  pool = new Pool({
    connectionString: connectionString,
    ssl: process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : undefined
  });

  return pool.query(
    'CREATE TABLE IF NOT EXISTS estado (' +
    '  id INTEGER PRIMARY KEY DEFAULT 1,' +
    '  versao INTEGER NOT NULL DEFAULT 1,' +
    '  atualizado_em BIGINT NOT NULL DEFAULT 0,' +
    '  mapa JSONB,' +
    '  calendario JSONB,' +
    '  CONSTRAINT estado_singleton CHECK (id = 1)' +
    ')'
  ).then(function () {
    return pool.query('SELECT versao, atualizado_em, mapa, calendario FROM estado WHERE id = 1');
  }).then(function (resultado) {
    if (resultado.rows.length) {
      var linha = resultado.rows[0];
      return {
        versao: linha.versao || 1,
        atualizadoEm: Number(linha.atualizado_em) || 0,
        mapa: linha.mapa || null,
        calendario: linha.calendario || null
      };
    }

    // Tabela nova: se existir um estado.json de uma instalação anterior
    // (por exemplo, quem já rodava com um volume), usa ele como semente
    // em vez de começar do zero.
    var semente = { versao: 1, atualizadoEm: Date.now(), mapa: null, calendario: null };
    try {
      var bruto = fs.readFileSync(arquivoLegado, 'utf8');
      var lido = JSON.parse(bruto);
      semente = {
        versao: lido.versao || 1,
        atualizadoEm: lido.atualizadoEm || Date.now(),
        mapa: lido.mapa || null,
        calendario: lido.calendario || null
      };
      console.log('Semeando o Postgres com o estado.json encontrado em ' + arquivoLegado);
    } catch (e) {
      // sem arquivo legado, começa do zero mesmo
    }

    return pool.query(
      'INSERT INTO estado (id, versao, atualizado_em, mapa, calendario) VALUES (1, $1, $2, $3, $4)',
      [semente.versao, semente.atualizadoEm, semente.mapa, semente.calendario]
    ).then(function () { return semente; });
  });
}

function salvarEstado(estado) {
  return pool.query(
    'UPDATE estado SET versao = $1, atualizado_em = $2, mapa = $3, calendario = $4 WHERE id = 1',
    [estado.versao, estado.atualizadoEm, estado.mapa, estado.calendario]
  );
}

module.exports = {
  iniciar: iniciar,
  salvarEstado: salvarEstado
};
