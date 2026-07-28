/* =============================================================
   MOTOR DO CALENDÁRIO ARTONIANO
   Converte, formata e navega datas do calendário de Arton.

   Modelo:
     - 12 meses de 30 dias = 360 dias
     - Dias de Nimb: 2 a 8 dias avulsos, inseridos ao fim de um mês
       sorteado a cada ano (configurável pelo mestre)
     - Semana de 7 dias, que corre continuamente inclusive pelos
       Dias de Nimb
     - Marco zero: a chegada dos elfos a Lamnor. Anos anteriores são
       contados de forma decrescente e marcados como AE.

   Âncora de dia da semana: o Atlas de Arton usa como exemplo a data
   10/01/1420 escrita como "Valk 10 sob Caravana", ou seja, o dia
   10 de Caravana de 1420 é um Valk. É daí que o motor conta.
   ============================================================= */

var CalendarioArton = (function () {
  'use strict';

  var D = DadosCalendario;
  var DIAS_MES = D.DIAS_POR_MES;          // 30
  var MESES_ANO = D.MESES_POR_ANO;        // 12
  var SEMANA = D.DIAS_POR_SEMANA;         // 7
  var BASE_ANO = D.DIAS_BASE_ANO;         // 360

  /* --- Dias de Nimb --------------------------------------------------
     A quantidade e a posição variam a cada ano e ninguém consegue
     prever — nem os astrônomos de Tanna-Toh. Como o app precisa ser
     determinístico, sorteamos a partir do próprio número do ano; o
     mestre pode sobrescrever qualquer ano pelas configurações. */

  var nimbManual = {};   // { "1410": { quantidade: 5, aposMes: 7 } }

  function embaralhar(semente) {
    var x = semente | 0;
    x ^= x << 13; x |= 0;
    x ^= x >>> 17;
    x ^= x << 5;  x |= 0;
    return Math.abs(x);
  }

  function nimbDoAno(ano) {
    var chave = String(ano);
    if (nimbManual[chave]) {
      return {
        quantidade: nimbManual[chave].quantidade,
        aposMes: nimbManual[chave].aposMes,
        manual: true
      };
    }
    var a = embaralhar(ano * 7919 + 104729);
    var b = embaralhar(ano * 15485863 + 32452843);
    return {
      quantidade: D.NIMB.minimo + (a % (D.NIMB.maximo - D.NIMB.minimo + 1)),
      aposMes: 1 + (b % MESES_ANO),
      manual: false
    };
  }

  function definirNimb(ano, quantidade, aposMes) {
    var chave = String(ano);
    if (quantidade === null || quantidade === undefined) {
      delete nimbManual[chave];
    } else {
      nimbManual[chave] = {
        quantidade: Math.max(D.NIMB.minimo, Math.min(D.NIMB.maximo, quantidade | 0)),
        aposMes: Math.max(1, Math.min(MESES_ANO, aposMes | 0))
      };
    }
    cacheAnos = {};
  }

  function carregarNimb(mapa) {
    nimbManual = mapa || {};
    cacheAnos = {};
  }

  function exportarNimb() {
    return JSON.parse(JSON.stringify(nimbManual));
  }

  function diasNoAno(ano) {
    return BASE_ANO + nimbDoAno(ano).quantidade;
  }

  /* --- Conversão para dia absoluto ----------------------------------
     Dia absoluto 1 = 1 de Caravana do ano 1. */

  var cacheAnos = {};

  function diasAntesDoAno(ano) {
    var chave = String(ano);
    if (cacheAnos[chave] !== undefined) return cacheAnos[chave];
    var total = 0, a;
    if (ano >= 1) {
      for (a = 1; a < ano; a++) total += diasNoAno(a);
    } else {
      for (a = ano; a < 1; a++) total -= diasNoAno(a);
    }
    cacheAnos[chave] = total;
    return total;
  }

  /* Ordinal do dia dentro do ano (1 .. diasNoAno).
     Uma data comum "pula" os Dias de Nimb se eles vierem antes dela. */
  function ordinalNoAno(data) {
    var nimb = nimbDoAno(data.ano);
    if (data.nimb) {
      return nimb.aposMes * DIAS_MES + data.dia;
    }
    var ordinal = (data.mes - 1) * DIAS_MES + data.dia;
    if (data.mes > nimb.aposMes) ordinal += nimb.quantidade;
    return ordinal;
  }

  function paraAbsoluto(data) {
    return diasAntesDoAno(data.ano) + ordinalNoAno(data);
  }

  function deAbsoluto(abs) {
    // acha o ano por aproximação e ajusta
    var ano = Math.floor((abs - 1) / 365) + 1;
    var guarda = 0;
    while (guarda++ < 10000) {
      var inicio = diasAntesDoAno(ano);
      var tamanho = diasNoAno(ano);
      if (abs <= inicio) { ano--; continue; }
      if (abs > inicio + tamanho) { ano++; continue; }
      return doOrdinal(ano, abs - inicio);
    }
    throw new Error('Não foi possível converter o dia absoluto ' + abs);
  }

  function doOrdinal(ano, ordinal) {
    var nimb = nimbDoAno(ano);
    var corte = nimb.aposMes * DIAS_MES;
    if (ordinal > corte && ordinal <= corte + nimb.quantidade) {
      return { ano: ano, mes: nimb.aposMes, dia: ordinal - corte, nimb: true };
    }
    var ajustado = ordinal > corte ? ordinal - nimb.quantidade : ordinal;
    var mes = Math.floor((ajustado - 1) / DIAS_MES) + 1;
    var dia = ajustado - (mes - 1) * DIAS_MES;
    return { ano: ano, mes: mes, dia: dia, nimb: false };
  }

  /* --- Dia da semana -------------------------------------------------
     Âncora canônica: 10 de Caravana de 1420 é um Valk (índice 0). */

  var ANCORA = { ano: 1420, mes: 1, dia: 10, nimb: false };
  var ANCORA_INDICE = 0;

  function definirAncora(data, indiceDiaSemana) {
    ANCORA = normalizar(data);
    ANCORA_INDICE = ((indiceDiaSemana % SEMANA) + SEMANA) % SEMANA;
  }

  function indiceDiaSemana(data) {
    var delta = paraAbsoluto(data) - paraAbsoluto(ANCORA);
    return (((delta + ANCORA_INDICE) % SEMANA) + SEMANA) % SEMANA;
  }

  function diaDaSemana(data) {
    return D.DIAS_SEMANA[indiceDiaSemana(data)];
  }

  /* --- Aritmética ----------------------------------------------------- */

  function normalizar(data) {
    return {
      ano: data.ano,
      mes: data.mes,
      dia: data.dia,
      nimb: !!data.nimb,
      hora: data.hora === undefined ? 0 : data.hora,
      minuto: data.minuto === undefined ? 0 : data.minuto
    };
  }

  function somarDias(data, quantidade) {
    var nova = deAbsoluto(paraAbsoluto(data) + quantidade);
    nova.hora = data.hora || 0;
    nova.minuto = data.minuto || 0;
    return nova;
  }

  function somarHoras(data, quantidade) {
    var totalMin = (data.hora || 0) * 60 + (data.minuto || 0) + Math.round(quantidade * 60);
    var diasExtras = Math.floor(totalMin / 1440);
    var resto = ((totalMin % 1440) + 1440) % 1440;
    var nova = somarDias(data, diasExtras);
    nova.hora = Math.floor(resto / 60);
    nova.minuto = resto % 60;
    return nova;
  }

  function diferencaEmDias(a, b) {
    return paraAbsoluto(b) - paraAbsoluto(a);
  }

  function mesmaData(a, b) {
    return a && b && a.ano === b.ano && a.mes === b.mes &&
           a.dia === b.dia && !!a.nimb === !!b.nimb;
  }

  /* --- Consultas ------------------------------------------------------ */

  function mes(numero) {
    return D.MESES[numero - 1];
  }

  function estacaoDoMes(numero) {
    return mes(numero).estacao;
  }

  /* Devolve os eventos que caem numa data (feriados podem durar vários dias). */
  function eventosDoDia(data) {
    if (data.nimb) {
      return [{
        nome: DadosCalendario.NIMB.nome,
        tipo: 'nimb',
        descricao: DadosCalendario.NIMB.descricao
      }];
    }
    var achados = [];
    for (var i = 0; i < D.DATAS_ESPECIAIS.length; i++) {
      var e = D.DATAS_ESPECIAIS[i];
      if (e.desde && data.ano < e.desde) continue;
      var duracao = e.duracao || 1;
      if (e.mes === data.mes && data.dia >= e.dia && data.dia < e.dia + duracao) {
        var copia = {
          nome: e.nome, tipo: e.tipo, descricao: e.descricao,
          mes: e.mes, dia: e.dia, duracao: duracao
        };
        if (duracao > 1) copia.diaDoEvento = data.dia - e.dia + 1;
        achados.push(copia);
      }
    }
    return achados;
  }

  /* --- Formatação ----------------------------------------------------- */

  var UNIDADES = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
    'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezesseis', 'dezessete',
    'dezoito', 'dezenove'];
  var DEZENAS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta',
    'setenta', 'oitenta', 'noventa'];
  var CENTENAS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos',
    'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

  /* Até 999, sempre ligando as ordens com "e": "quatrocentos e dez". */
  function ateNovecentos(n) {
    if (n === 100) return 'cem';
    var texto = [];
    var c = Math.floor(n / 100);
    var r = n % 100;
    if (c > 0) texto.push(CENTENAS[c]);
    if (r > 0 && r < 20) texto.push(UNIDADES[r]);
    else if (r >= 20) {
      var d = Math.floor(r / 10), u = r % 10;
      texto.push(u > 0 ? DEZENAS[d] + ' e ' + UNIDADES[u] : DEZENAS[d]);
    }
    return texto.join(' e ');
  }

  function porExtenso(n) {
    n = Math.abs(Math.round(n));
    if (n === 0) return 'zero';
    if (n < 1000) return ateNovecentos(n);

    var milhares = Math.floor(n / 1000);
    var resto = n % 1000;
    var cabeca = milhares === 1 ? 'mil' : ateNovecentos(milhares) + ' mil';
    if (resto === 0) return cabeca;

    /* Depois de "mil" só entra "e" quando o resto é menor que cem ou é
       uma centena redonda: "mil e dez", "mil e cem" — mas "mil
       quatrocentos e dez". */
    var conector = (resto < 100 || resto % 100 === 0) ? ' e ' : ' ';
    return cabeca + conector + ateNovecentos(resto);
  }

  function rotuloAno(ano) {
    return ano >= 1 ? String(ano) : (Math.abs(ano - 1) + ' AE');
  }

  /* "5 de Keenvia de 1410" */
  function formatarColoquial(data) {
    if (data.nimb) {
      return data.dia + 'º Dia de Nimb de ' + rotuloAno(data.ano);
    }
    return data.dia + ' de ' + mes(data.mes).nome + ' de ' + rotuloAno(data.ano);
  }

  /* "Dallia 5 sob Keenvia, mil quatrocentos e dez anos da chegada dos elfos" */
  function formatarCulta(data) {
    var sufixo = data.ano >= 1
      ? porExtenso(data.ano) + ' anos da chegada dos elfos'
      : porExtenso(Math.abs(data.ano - 1)) + ' anos antes da chegada dos elfos';
    if (data.nimb) {
      return diaDaSemana(data).nome + ', ' + data.dia + 'º Dia de Nimb, ' + sufixo;
    }
    return diaDaSemana(data).nome + ' ' + data.dia + ' sob ' + mes(data.mes).nome +
           ', ' + sufixo;
  }

  /* "05/03/1410" */
  function formatarNumerica(data) {
    if (data.nimb) return 'Nimb ' + data.dia + '/' + rotuloAno(data.ano);
    return dois(data.dia) + '/' + dois(data.mes) + '/' + rotuloAno(data.ano);
  }

  function dois(n) { return (n < 10 ? '0' : '') + n; }

  function formatarHora(data) {
    return dois(data.hora || 0) + ':' + dois(data.minuto || 0);
  }

  /* --- Horas do dia ---------------------------------------------------
     Khalmyr decretou empate entre Azgher e Tenebra: Arton recebe doze
     horas de luz e doze de escuridão. Templos soam sinos a cada três
     horas; a noite é dividida em três velas. */

  function faseDoDia(hora, nascer, ocaso) {
    nascer = nascer === undefined ? 6 : nascer;
    ocaso = ocaso === undefined ? 18 : ocaso;
    if (hora >= nascer - 1 && hora < nascer + 1) return 'amanhecer';
    if (hora >= nascer + 1 && hora < ocaso - 1) return 'dia';
    if (hora >= ocaso - 1 && hora < ocaso + 1) return 'anoitecer';
    return 'noite';
  }

  function velaDaNoite(hora, nascer, ocaso) {
    nascer = nascer === undefined ? 6 : nascer;
    ocaso = ocaso === undefined ? 18 : ocaso;
    var duracaoNoite = (24 - ocaso) + nascer;
    var decorrido = hora >= ocaso ? hora - ocaso : (24 - ocaso) + hora;
    if (decorrido < 0 || decorrido >= duracaoNoite) return null;
    var indice = Math.min(2, Math.floor(decorrido / (duracaoNoite / 3)));
    return D.VELAS[indice];
  }

  function proximoSino(hora, minuto) {
    var proximo = (Math.floor(hora / 3) + 1) * 3;
    var faltamMin = (proximo * 60) - (hora * 60 + (minuto || 0));
    return { hora: proximo % 24, faltamMinutos: faltamMin };
  }

  /* --- API ------------------------------------------------------------ */

  return {
    nimbDoAno: nimbDoAno,
    definirNimb: definirNimb,
    carregarNimb: carregarNimb,
    exportarNimb: exportarNimb,
    diasNoAno: diasNoAno,
    paraAbsoluto: paraAbsoluto,
    deAbsoluto: deAbsoluto,
    ordinalNoAno: ordinalNoAno,
    definirAncora: definirAncora,
    indiceDiaSemana: indiceDiaSemana,
    diaDaSemana: diaDaSemana,
    normalizar: normalizar,
    somarDias: somarDias,
    somarHoras: somarHoras,
    diferencaEmDias: diferencaEmDias,
    mesmaData: mesmaData,
    mes: mes,
    estacaoDoMes: estacaoDoMes,
    eventosDoDia: eventosDoDia,
    porExtenso: porExtenso,
    rotuloAno: rotuloAno,
    formatarColoquial: formatarColoquial,
    formatarCulta: formatarCulta,
    formatarNumerica: formatarNumerica,
    formatarHora: formatarHora,
    faseDoDia: faseDoDia,
    velaDaNoite: velaDaNoite,
    proximoSino: proximoSino
  };
})();
