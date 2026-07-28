/* =============================================================
   ARMAZENAMENTO
   Persistência local (localStorage) + exportar/importar JSON.
   Funciona abrindo os arquivos direto pelo navegador (file://).
   ============================================================= */

var Armazenamento = (function () {
  'use strict';

  var PREFIXO = 'artoniana:';
  var disponivel = (function () {
    try {
      var t = PREFIXO + '__teste__';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return true;
    } catch (e) {
      return false;
    }
  })();

  var memoria = {};   // reserva caso o localStorage esteja bloqueado

  function ler(chave, padrao) {
    var bruto;
    try {
      bruto = disponivel ? window.localStorage.getItem(PREFIXO + chave) : memoria[chave];
    } catch (e) {
      bruto = memoria[chave];
    }
    if (bruto === null || bruto === undefined) return padrao;
    try {
      return JSON.parse(bruto);
    } catch (e) {
      console.warn('Dado corrompido em "' + chave + '", usando o padrão.', e);
      return padrao;
    }
  }

  function gravar(chave, valor) {
    var bruto = JSON.stringify(valor);
    memoria[chave] = bruto;
    if (!disponivel) return false;
    try {
      window.localStorage.setItem(PREFIXO + chave, bruto);
      return true;
    } catch (e) {
      console.warn('Não foi possível gravar "' + chave + '".', e);
      return false;
    }
  }

  function apagar(chave) {
    delete memoria[chave];
    if (!disponivel) return;
    try {
      window.localStorage.removeItem(PREFIXO + chave);
    } catch (e) { /* ignora */ }
  }

  /* Baixa um objeto como arquivo .json */
  function exportar(nomeArquivo, objeto) {
    var texto = JSON.stringify(objeto, null, 2);
    var blob = new Blob([texto], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* Abre o seletor de arquivos e devolve o objeto lido */
  function importar(aoLer, aoFalhar) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', function () {
      var arquivo = input.files && input.files[0];
      if (!arquivo) return;
      var leitor = new FileReader();
      leitor.onload = function () {
        try {
          aoLer(JSON.parse(String(leitor.result)));
        } catch (e) {
          if (aoFalhar) aoFalhar(e);
          else alert('Arquivo inválido: ' + e.message);
        }
      };
      leitor.onerror = function () {
        if (aoFalhar) aoFalhar(leitor.error);
      };
      leitor.readAsText(arquivo, 'utf-8');
    });
    input.click();
  }

  return {
    ler: ler,
    gravar: gravar,
    apagar: apagar,
    exportar: exportar,
    importar: importar,
    disponivel: disponivel
  };
})();
