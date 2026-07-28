/* =============================================================
   DADOS DO CALENDÁRIO ARTONIANO
   Fonte: Tormenta20 — Atlas de Arton, "Tempo & Calendário" (p. 30-33)

   O calendário divide o ano em 12 meses de 30 dias (360 dias).
   Cada dia tem 24 horas e cada 7 dias formam uma semana.
   Além disso existem os Dias de Nimb, que não pertencem a mês
   nenhum e cuja quantidade (2 a 8) e posição variam a cada ano.
   Por isso o ano artoniano tem de 362 a 368 dias — na média, 365.
   ============================================================= */

var DadosCalendario = (function () {
  'use strict';

  var MESES = [
    {
      numero: 1, nome: 'Caravana', estacao: 'Primavera',
      significado: 'Homenagem aos refugiados de Lamnor, que terminaram sua longa ' +
        'jornada no início da primavera. Muitas caravanas partem em suas rotas neste mês.'
    },
    {
      numero: 2, nome: 'Pomo', estacao: 'Primavera',
      significado: 'Segundo mês da primavera, quando as plantações começam a crescer.'
    },
    {
      numero: 3, nome: 'Keenvia', estacao: 'Primavera',
      significado: 'Em honra a Keenn, antigo Deus da Guerra. É a época em que os ' +
        'exércitos partem para suas marchas e batalhas.'
    },
    {
      numero: 4, nome: 'Sirravia', estacao: 'Verão',
      significado: 'Homenagem a Sirrannamena, a Rainha Barda, considerada a primeira ' +
        'grande monarca da humanidade.'
    },
    {
      numero: 5, nome: 'Vigília', estacao: 'Verão',
      significado: 'Nesta época Azgher, o Deus-Sol, fica alto no céu, observando tudo.'
    },
    {
      numero: 6, nome: 'Prussvia', estacao: 'Verão',
      significado: 'Menção a Roramar Pruss, fundador do Reinado. O mês se chamaria ' +
        'Roravia, mas o Rei Profeta, humilde, não aceitou.'
    },
    {
      numero: 7, nome: 'Ceifa', estacao: 'Outono',
      significado: 'Início da colheita — época de muito trabalho nos campos do Reinado e além.'
    },
    {
      numero: 8, nome: 'Contenda', estacao: 'Outono',
      significado: 'Antigamente dedicado a duelos e resolução de conflitos; hoje recebe ' +
        'importantes julgamentos em castelos e tribunais.'
    },
    {
      numero: 9, nome: 'Clausura', estacao: 'Outono',
      significado: 'Período em que os camponeses se preparam para o inverno, recolhendo ' +
        'comida e lenha para suas casas.'
    },
    {
      numero: 10, nome: 'Pharstyth', estacao: 'Inverno',
      significado: 'Alusão à mítica arquimaga que habitava o istmo que une os dois ' +
        'continentes. Por que uma vilã seria homenageada permanece um mistério…'
    },
    {
      numero: 11, nome: 'Véu', estacao: 'Inverno',
      significado: 'Época de noites longas e homenagem a Tenebra, que se encontra mais ' +
        'poderosa nesse período do ano.'
    },
    {
      numero: 12, nome: 'Pyra', estacao: 'Inverno',
      significado: 'Alusão a Thyatis, o Deus das Segundas Chances, e ao costume de queimar ' +
        'coisas antigas e fazer profecias em piras divinatórias.'
    }
  ];

  /* Os dias da semana homenageiam divindades do Panteão, com os nomes
     usados em eras passadas ou por raças antigas. */
  var DIAS_SEMANA = [
    { numero: 1, nome: 'Valk',   deus: 'Valkaria',                        nota: '' },
    { numero: 2, nome: 'Hedryl', deus: 'antigo nome de Khalmyr',          nota: '' },
    { numero: 3, nome: 'Luna',   deus: 'antigo nome de Lena',             nota: '' },
    { numero: 4, nome: 'Astar',  deus: 'o nome feérico de Azgher',        nota: '' },
    { numero: 5, nome: 'Dallia', deus: 'o nome élfico de Wynna',          nota: '' },
    { numero: 6, nome: 'Haya',   deus: 'Marah para as fadas',             nota: 'Dia de festejos' },
    { numero: 7, nome: 'Leen',   deus: 'antiga faceta de Ragnar',         nota: 'Dia de descanso' }
  ];

  var ESTACOES = {
    'Primavera': { icone: '🌱', meses: [1, 2, 3] },
    'Verão':     { icone: '☀️', meses: [4, 5, 6] },
    'Outono':    { icone: '🍂', meses: [7, 8, 9] },
    'Inverno':   { icone: '❄️', meses: [10, 11, 12] }
  };

  /* Datas comemorativas do calendário artoniano (Atlas de Arton, p. 32-33).
     "desde" indica o primeiro ano em que a data existe — o Dia da Memória
     só passa a ser celebrado após o fim da Guerra Artoniana. */
  var DATAS_ESPECIAIS = [
    {
      mes: 1, dia: 1, nome: 'Dia do Reencontro', tipo: 'feriado',
      descricao: 'O primeiro e mais importante dia do ano. Foi neste dia que a caravana de ' +
        'refugiados de Lamnor chegou aos pés da estátua de Valkaria, iniciando a era atual ' +
        'de Arton. Também é o equinócio da primavera: povos silvestres cantam e dançam ao ' +
        'redor de fogueiras para comemorar o fim do inverno.'
    },
    {
      mes: 1, dia: 15, nome: 'Cerimônia do Plantio', tipo: 'feriado',
      descricao: 'Popular entre camponeses, celebra o início do plantio. Planta-se uma semente ' +
        'simbólica no solo para afastar o inverno. A Ordem de Lena ordena suas jovens clérigas.'
    },
    {
      mes: 3, dia: 20, nome: 'Sckharal', tipo: 'festival', duracao: 7,
      descricao: 'Sete dias de festividades em Sckharshantallas. As ruas são tomadas por enormes ' +
        'dragões feitos de vime, dançarinos, mágicos e companhias teatrais. O último dia é ' +
        'reservado à execução de criminosos.'
    },
    {
      mes: 4, dia: 6, nome: 'Dia da Memória', tipo: 'feriado', desde: 1411,
      descricao: 'Cerimônia recente, celebrada no Reinado para comemorar o fim da Guerra ' +
        'Artoniana e honrar aqueles que caíram frente às tropas puristas.'
    },
    {
      mes: 5, dia: 12, nome: 'Admissão da Ordem da Luz', tipo: 'evento',
      descricao: 'Norm fica lotada de jovens nobres, escudeiros e aventureiros almejando entrar ' +
        'na prestigiosa ordem de cavalaria.'
    },
    {
      mes: 7, dia: 1, nome: 'Exposição de Inventos', tipo: 'evento',
      descricao: 'Criado por Lorde Niebling, é uma grande mostra de engenhocas no Palácio ' +
        'Imperial de Valkaria. Recebe inventores de todas as raças, incluindo goblins.'
    },
    {
      mes: 8, dia: 11, nome: 'Grande Feira', tipo: 'festival', duracao: 7,
      descricao: 'Semana de festividades que atrai milhares de aventureiros e visitantes para ' +
        'Nova Malpetrim.'
    },
    {
      mes: 9, dia: 17, nome: 'Noite das Máscaras', tipo: 'festival',
      descricao: 'Comemoração da fundação do reino de Ahlen. Na capital, Thartann, todos usam ' +
        'máscaras — é o único dia do ano em que não há distinção entre nobres e plebeus. ' +
        'O ponto alto é o baile no Palácio Rishantor.'
    },
    {
      mes: 10, dia: 7, nome: 'Noite das Sombras', tipo: 'perigo',
      descricao: 'Nesta temida noite, espíritos nefastos vagam pelo mundo arrastando quem ' +
        'puderem para seus reinos de trevas, seres feéricos cavalgam pelos campos e magias ' +
        'nocivas têm seu poder dobrado.'
    },
    {
      mes: 12, dia: 3, nome: 'Dia da Profecia', tipo: 'evento',
      descricao: 'O povo busca orientação de seus clérigos. Dizem que nesta data as profecias ' +
        'costumam ser mais precisas e falam de eventos importantes.'
    }
  ];

  /* Durante os Dias de Nimb, eventos estranhos acontecem: tibares caem do céu
     como chuva, árvores levantam suas raízes e marcham, vacas dão gorad quente
     em vez de leite… e os decretos malucos dos clérigos de Nimb têm peso de lei. */
  var NIMB = {
    nome: 'Dias de Nimb',
    descricao: 'Período cuja duração e posição variam anualmente. No início de cada ano a ' +
      'Rainha-Imperatriz recebe uma carta com o símbolo sagrado do Deus do Caos informando ' +
      'quantos dias de Nimb o ano terá e ao fim de qual mês irão ocorrer. Durante eles, ' +
      'eventos estranhos acontecem e os decretos dos clérigos do Caos carregam peso de lei.',
    minimo: 2,
    maximo: 8
  };

  /* A noite é medida pela duração das velas: normalmente são consumidas três
     velas por noite, daí "primeira vela", "segunda vela" e "terceira vela".
     Templos soam sinos a cada três horas. */
  var VELAS = [
    { nome: 'Primeira Vela', ordem: 1 },
    { nome: 'Segunda Vela',  ordem: 2 },
    { nome: 'Terceira Vela', ordem: 3 }
  ];

  return {
    MESES: MESES,
    DIAS_SEMANA: DIAS_SEMANA,
    ESTACOES: ESTACOES,
    DATAS_ESPECIAIS: DATAS_ESPECIAIS,
    NIMB: NIMB,
    VELAS: VELAS,
    DIAS_POR_MES: 30,
    MESES_POR_ANO: 12,
    DIAS_POR_SEMANA: 7,
    DIAS_BASE_ANO: 360
  };
})();
