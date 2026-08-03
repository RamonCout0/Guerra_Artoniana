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
    // quem já rodava antes da revogação de sessão não tem esta coluna
    return pool.query(
      'ALTER TABLE estado ADD COLUMN IF NOT EXISTS epoca_mestre INTEGER NOT NULL DEFAULT 1'
    );
  }).then(function () {
    return pool.query(
      'SELECT versao, atualizado_em, mapa, calendario, epoca_mestre FROM estado WHERE id = 1'
    );
  }).then(function (resultado) {
    if (resultado.rows.length) {
      var linha = resultado.rows[0];
      return {
        versao: linha.versao || 1,
        atualizadoEm: Number(linha.atualizado_em) || 0,
        mapa: linha.mapa || null,
        calendario: linha.calendario || null,
        epocaMestre: linha.epoca_mestre || 1
      };
    }

    // Tabela nova: se existir um estado.json de uma instalação anterior
    // (por exemplo, quem já rodava com um volume), usa ele como semente
    // em vez de começar do zero.
    var semente = {
      versao: 1, atualizadoEm: Date.now(), mapa: null, calendario: null, epocaMestre: 1
    };
    try {
      var bruto = fs.readFileSync(arquivoLegado, 'utf8');
      var lido = JSON.parse(bruto);
      semente = {
        versao: lido.versao || 1,
        atualizadoEm: lido.atualizadoEm || Date.now(),
        mapa: lido.mapa || null,
        calendario: lido.calendario || null,
        epocaMestre: lido.epocaMestre || 1
      };
      console.log('Semeando o Postgres com o estado.json encontrado em ' + arquivoLegado);
    } catch (e) {
      // sem arquivo legado, começa do zero mesmo
    }

    return pool.query(
      'INSERT INTO estado (id, versao, atualizado_em, mapa, calendario, epoca_mestre) ' +
      'VALUES (1, $1, $2, $3, $4, $5)',
      [semente.versao, semente.atualizadoEm, semente.mapa, semente.calendario,
       semente.epocaMestre]
    ).then(function () { return semente; });
  });
}

function salvarEstado(estado) {
  return pool.query(
    'UPDATE estado SET versao = $1, atualizado_em = $2, mapa = $3, calendario = $4, ' +
    'epoca_mestre = $5 WHERE id = 1',
    [estado.versao, estado.atualizadoEm, estado.mapa, estado.calendario,
     estado.epocaMestre || 1]
  );
}

module.exports = {
  iniciar: iniciar,
  salvarEstado: salvarEstado
};
