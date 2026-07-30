/* =============================================================
   DADOS DO MAPA DE ARTON — circa 1410
   Baseado no mapa "Arton: O Reinado e terras próximas, circa 1410"
   (Jambô Editora / Tormenta20) e no cenário político descrito em
   "Jornada Heróica — Guerra Artoniana".

   SISTEMA DE COORDENADAS
   ----------------------
   Todas as coordenadas estão no espaço do viewBox do SVG:
       x de 0 a 1000
       y de 0 a 850.64   (proporção da imagem 3957 × 3366)
   Ou seja, é o mapa inteiro normalizado. Se você trocar a imagem
   por outra de proporção diferente, ajuste ALTURA_VIEWBOX.

   ATENÇÃO: as fronteiras são APROXIMAÇÕES traçadas por cima do mapa
   para servirem de ponto de partida. Use o editor ("Editar contorno")
   para ajustar cada território à sua campanha — é exatamente para
   isso que ele existe.
   ============================================================= */

var DadosMapa = (function () {
  'use strict';

  var LARGURA_VIEWBOX = 1000;
  var ALTURA_VIEWBOX = 850.64;

  /* Escala do mapa: a barra gráfica impressa marca 1.000 km e ocupa
     474 pixels da imagem original — 119,79 unidades de viewBox.
     Logo, o mapa inteiro tem cerca de 8.350 km de largura. */
  var KM_POR_UNIDADE = 8.348;

  /* Um dia normal de viagem por estrada. A caixa da Rota de Vectora, no
     próprio mapa, diz que o Mercado Voador percorre 180 km por dia indo
     "na velocidade de um cavalo — mas sem parar"; uma jornada comum, com
     paradas e pernoite, rende perto de um terço disso. */
  var KM_POR_DIA_DE_VIAGEM = 60;

  var NACOES = [
    /* ---------------- O REINADO ---------------- */
    {
      id: 'deheon',
      brasao: 'de prata a estátua de Valkaria de sua cor',
      nome: 'Deheon',
      nomeOficial: 'Sacro Reino-Capitânia de Deheon',
      categoria: 'reinado',
      cor: '#9f7f3e',
      capital: 'valkaria',
      governo: 'Monarquia',
      regente: 'Rainha-Imperatriz Shivara I',
      populacao: '≈ 6.000.000',
      notas: 'O Reino Capital. Em 1410 vive um período de paz sob a liderança forte e ' +
        'respeitada de Shivara, que acumula as coroas de Deheon, Yudennach e Trebuck. ' +
        'Ainda assim, alguns reinos vinham se separando do Reinado.',
      rotulo: { x: 461, y: 600 },
      poligono: [[398,558],[430,543],[470,546],[506,564],[521,590],[512,621],[489,649],
                 [458,661],[428,650],[404,624],[391,594]]
    },
    {
      id: 'yudennach',
      nome: 'Yudennach',
      nomeOficial: 'Reino de Yudennach — "o Exército com uma Nação"',
      categoria: 'reinado',
      cor: '#7c1f25',
      capital: 'kannilar',
      governo: 'Autocracia militar',
      regente: 'Rainha-Imperatriz Shivara I (de fato, Hermann Von Krauser nas sombras)',
      populacao: '≈ 5.000.000',
      notas: 'Segundo país mais poderoso da coalizão. Cultura militarista, autocrática e ' +
        'intolerante — incompatível com os ideais de Shivara. É daqui que parte o golpe ' +
        'purista que leva à Guerra Artoniana. Hermann Von Krauser, exímio estrategista ' +
        'desaparecido da vida pública, age nas sombras para tomar o poder.',
      rotulo: { x: 522, y: 486 },
      poligono: [[492,444],[540,432],[578,446],[592,478],[578,514],[547,536],[510,541],
                 [488,519],[482,478]]
    },
    {
      id: 'bielefeld',
      brasao: 'talhado de prata e azul, uma balança de ouro brocante',
      nome: 'Bielefeld',
      nomeOficial: 'Reino de Bielefeld',
      categoria: 'reinado',
      cor: '#2e417e',
      capital: 'roschfallen',
      governo: 'Monarquia',
      regente: 'Casa real de Bielefeld',
      populacao: '≈ 1.600.000',
      notas: 'O Reino dos Cavaleiros. Terra da Ordem da Luz, sediada em Norm.',
      rotulo: { x: 600, y: 567 },
      poligono: [[558,508],[600,500],[641,509],[661,535],[655,571],[624,591],[584,589],
                 [556,565],[546,534]]
    },
    {
      id: 'wynlla',
      brasao: 'de púrpura uma torre de ouro aberta, lavrada e iluminada do campo',
      nome: 'Wynlla',
      nomeOficial: 'Reino de Wynlla',
      categoria: 'reinado',
      cor: '#5b3a7a',
      capital: 'sophand',
      governo: 'Conselho de arcanistas',
      regente: 'Grande Conselho de Wynlla',
      populacao: '≈ 530.000',
      notas: 'O Reino da Magia. Nação rica governada por um grande conselho de arcanistas — ' +
        'tamanho poder os tornou arrogantes e prepotentes. Território pequeno, mas o ' +
        'conselho crê que pode resolver qualquer problema sozinho. Abriga a Academia Arcana.',
      rotulo: { x: 558, y: 639 },
      poligono: [[516,584],[550,578],[573,594],[576,620],[558,641],[529,639],[510,615]]
    },
    {
      id: 'ahlen',
      brasao: 'de prata três raposas passantes de vermelho alinhadas em pala',
      nome: 'Ahlen',
      nomeOficial: 'Mui Exaltado Reino de Ahlen',
      categoria: 'reinado',
      cor: '#b0603a',
      capital: 'thartann',
      governo: 'Monarquia',
      regente: 'Corte ahleniense',
      populacao: '≈ 950.000',
      notas: 'Reino de nobres e etiqueta rígida. Sede da Noite das Máscaras, no Palácio ' +
        'Rishantor, único dia do ano sem distinção entre nobres e plebeus.',
      rotulo: { x: 378, y: 633 },
      poligono: [[354,608],[390,600],[416,614],[419,646],[398,669],[367,669],[347,645]]
    },
    {
      id: 'zakharov',
      brasao: 'de vermelho uma aspa de prata carregada de uma águia de negro',
      nome: 'Zakharov',
      nomeOficial: 'Reino de Zakharov',
      categoria: 'reinado',
      cor: '#3f6b4a',
      capital: 'zakharin',
      governo: 'Monarquia',
      regente: 'Casa Zakharov',
      populacao: '≈ 2.200.000',
      notas: 'Reino frio ao pé das Montanhas Uivantes. Uma Área de Tormenta corrói sua ' +
        'porção norte.',
      rotulo: { x: 440, y: 486 },
      poligono: [[414,452],[456,447],[492,469],[501,505],[480,536],[444,541],[417,514],
                 [404,478]]
    },
    {
      id: 'namalkah',
      brasao: 'de verde um cavalo passante de prata coroado de ouro',
      nome: 'Namalkah',
      nomeOficial: 'Veneráveis Hostes de Namalkah',
      categoria: 'reinado',
      cor: '#8a6a3c',
      capital: 'corte-errante',
      governo: 'Confederação de clãs nômades',
      regente: 'Conselho das Hostes',
      populacao: '≈ 1.450.000',
      notas: 'Povo nômade das planícies. A capital, a Corte Errante, se move com as hostes.',
      rotulo: { x: 525, y: 397 },
      poligono: [[488,368],[531,360],[564,375],[569,403],[547,427],[511,429],[486,408]]
    },
    {
      id: 'pondsmania',
      brasao: 'de prata duas dríades adossadas e unidas pela cintura a uma árvore arrancada de verde',
      nome: 'Pondsmânia',
      nomeOficial: 'Reino das Fadas de Pondsmânia',
      categoria: 'reinado',
      cor: '#a8478c',
      capital: 'linnanthas-shaed',
      governo: 'Monarquia feérica',
      regente: 'Rainha Thantalla',
      populacao: 'Ninguém tem a menor ideia',
      notas: 'Terra mágica onde o próprio tempo obedece aos caprichos da Rainha Thantalla — ' +
        'não faz sentido registrar a passagem dos dias por aqui. As fadas têm feriados ' +
        'mesmo sem calendário; o mais popular é o Gatal.',
      rotulo: { x: 700, y: 344 },
      poligono: [[674,318],[713,312],[735,330],[731,359],[706,374],[679,363],[666,340]]
    },
    {
      id: 'trebuck',
      brasao: 'de vermelho três espadas de prata, guarnecidas e maçanetadas de ouro',
      nome: 'Feudos de Trebuck',
      nomeOficial: 'Feudos Independentes de Trebuck',
      categoria: 'reinado',
      cor: '#6b7a35',
      capital: 'crovandir',
      governo: 'Feudos independentes',
      regente: 'Rainha-Imperatriz Shivara I (por ascendência)',
      populacao: '≈ 1.850.000',
      notas: 'Terra natal de Shivara. Conjunto de feudos autônomos — é entre feudos como ' +
        'estes que começa a campanha da Guerra Artoniana.',
      rotulo: { x: 717, y: 311 },
      poligono: [[687,261],[731,254],[763,272],[766,306],[742,331],[704,333],[681,308],
                 [674,281]]
    },
    {
      id: 'callistia',
      nome: 'Callistia',
      nomeOficial: 'Bacia de Callistia',
      categoria: 'reinado',
      cor: '#4a727f',
      capital: 'crisandir',
      governo: 'Nobreza local',
      regente: 'Casas nobres da bacia',
      populacao: '—',
      notas: 'Região fértil ao redor do curso do Rio dos Deuses.',
      rotulo: { x: 583, y: 333 },
      poligono: [[557,306],[596,298],[621,314],[619,346],[594,363],[565,356],[549,330]]
    },
    {
      id: 'sanburdia',
      brasao: 'de verde uma roda de ouro, em uma campanha arqueada de azul e perfilada de prata',
      nome: 'Sambúrdia',
      nomeOficial: 'Repúblicas Livres de Sambúrdia',
      categoria: 'independente',
      cor: '#b58a3c',
      capital: 'sanburdia-capital',
      governo: 'Repúblicas confederadas',
      regente: 'Assembleias republicanas',
      populacao: '≈ 3.600.000',
      notas: 'Conjunto de repúblicas mercantis, prósperas e ciosas de sua independência.',
      rotulo: { x: 672, y: 367 },
      poligono: [[644,338],[691,330],[726,347],[731,383],[708,409],[671,413],[644,393],
                 [634,361]]
    },
    {
      id: 'nova-malpetrim',
      brasao: 'de azul um castelo de prata assente sobre um monte de verde',
      nome: 'Nova Malpetrim',
      nomeOficial: 'Cidade Livre de Nova Malpetrim',
      categoria: 'independente',
      cor: '#c2703c',
      capital: 'nova-malpetrim-cidade',
      governo: 'Cidade livre',
      regente: 'Conselho da cidade',
      populacao: '—',
      notas: 'Cidade cosmopolita de aventureiros. Sede da Grande Feira, semana de ' +
        'festividades que atrai milhares de visitantes.',
      rotulo: { x: 634, y: 386 },
      poligono: [[618,364],[650,357],[669,373],[665,398],[643,410],[619,400],[611,378]]
    },
    {
      id: 'ghondriann',
      nome: 'Ghondriann',
      nomeOficial: 'Principado de Ghondriann',
      categoria: 'independente',
      cor: '#6a4a8a',
      capital: null,
      governo: 'Principado',
      regente: '—',
      populacao: '—',
      notas: 'Terras entre o Rio Vermelho e as planícies de Salistick.',
      rotulo: { x: 606, y: 411 },
      poligono: [[586,388],[618,381],[638,398],[635,426],[611,439],[588,428],[578,405]]
    },
    {
      id: 'salistick',
      brasao: 'de prata uma banda de vermelho',
      nome: 'Salistick',
      nomeOficial: 'Majestado Único de Aghmen, Acetos, Balium e Ystamen',
      categoria: 'independente',
      cor: '#7d8a3a',
      capital: 'yuton',
      governo: 'Sem governo central',
      regente: '—',
      populacao: '≈ 445.000',
      notas: 'Reino da medicina, marcado pela figura do Médico Desconhecido e pela lenda ' +
        'da Dama de Porcelana, a Rainha Gladys.',
      rotulo: { x: 597, y: 444 },
      poligono: [[576,419],[611,410],[634,424],[637,451],[621,472],[591,474],[573,455]]
    },
    {
      id: 'uniao-purpura',
      nome: 'União Púrpura',
      nomeOficial: 'União Púrpura',
      categoria: 'independente',
      cor: '#6b3f8f',
      capital: 'milothiann',
      governo: 'União de cidades',
      regente: 'Conselho da União',
      populacao: '≈ 1.500.000',
      notas: 'Em 1410 ainda é a União Púrpura. Décadas depois, esta mesma terra se torna ' +
        'Aslothia, o Cadávero Reino governado por um Arquilich — com Milothiann por capital.',
      rotulo: { x: 617, y: 486 },
      poligono: [[583,453],[630,446],[673,459],[694,485],[689,516],[655,531],[614,529],
                 [588,505],[578,477]]
    },
    {
      id: 'portsmouth',
      nome: 'Portsmouth',
      nomeOficial: 'Portsmouth',
      categoria: 'independente',
      cor: '#3f7a80',
      capital: null,
      governo: 'Cidade portuária',
      regente: '—',
      populacao: '—',
      notas: 'Faixa costeira voltada para a Enseada dos Selakos.',
      rotulo: { x: 683, y: 533 },
      poligono: [[663,503],[696,498],[717,515],[713,546],[692,563],[667,556],[656,527]]
    },
    {
      id: 'hongari',
      nome: 'Hongari',
      nomeOficial: 'Hongari',
      categoria: 'independente',
      cor: '#8a5a34',
      capital: 'triunphus',
      governo: '—',
      regente: '—',
      populacao: '—',
      notas: 'Terras acidentadas junto à Cordilheira do Mosck Vila e às Montanhas de Calidore.',
      rotulo: { x: 694, y: 556 },
      poligono: [[671,538],[706,530],[727,548],[723,576],[698,590],[674,579],[663,557]]
    },
    {
      id: 'tollon',
      nome: 'Floresta de Tollon',
      nomeOficial: 'Floresta de Tollon',
      categoria: 'regiao',
      cor: '#2f6b3a',
      capital: null,
      governo: 'Sem governo',
      regente: '—',
      populacao: '—',
      notas: 'Grande floresta ao sul do Reinado, cheia de segredos élficos e perigos antigos.',
      rotulo: { x: 339, y: 622 },
      poligono: [[313,598],[346,593],[364,612],[359,641],[335,653],[311,641],[303,617]]
    },
    {
      id: 'collen',
      nome: 'Collen',
      nomeOficial: 'Collen',
      categoria: 'independente',
      cor: '#6f8a4c',
      capital: null,
      governo: '—',
      regente: '—',
      populacao: '—',
      notas: 'Terras litorâneas voltadas ao Mar de Flok.',
      rotulo: { x: 369, y: 689 },
      poligono: [[344,663],[381,658],[401,676],[396,701],[369,713],[344,703],[333,681]]
    },
    {
      id: 'tyrondir',
      nome: 'Tyrondir',
      nomeOficial: 'Reino de Tyrondir',
      categoria: 'independente',
      cor: '#8a4a4a',
      capital: null,
      governo: 'Monarquia',
      regente: '—',
      populacao: '—',
      notas: 'Em 1410 Tyrondir ainda é um reino de pé. No cenário de 1420 restam apenas ' +
        'as Ruínas de Tyrondir.',
      rotulo: { x: 489, y: 639 },
      poligono: [[464,613],[501,608],[521,628],[516,656],[490,669],[464,659],[453,634]]
    },
    {
      id: 'petrynia',
      nome: 'Petrynia',
      nomeOficial: 'Petrynia',
      categoria: 'independente',
      cor: '#a07a35',
      capital: 'tiberus',
      governo: '—',
      regente: '—',
      populacao: '—',
      notas: 'Terras ocidentais entre o Mar Negro e as Montanhas Uivantes.',
      rotulo: { x: 222, y: 572 },
      poligono: [[188,503],[236,496],[266,514],[269,549],[248,579],[214,586],[187,565],
                 [176,531]]
    },
    {
      id: 'roddenphord',
      nome: 'Protetorado de Roddenphord',
      nomeOficial: 'Protetorado de Roddenphord',
      categoria: 'independente',
      cor: '#5a6a80',
      capital: null,
      governo: 'Protetorado',
      regente: '—',
      populacao: '—',
      notas: 'Enclave costeiro no extremo oeste, sobre o Mar Negro.',
      rotulo: { x: 142, y: 567 },
      poligono: [[117,539],[151,531],[173,548],[171,579],[148,596],[121,586],[111,561]]
    },
    {
      id: 'fortuna',
      nome: 'Fortuna',
      nomeOficial: 'Fortuna',
      categoria: 'independente',
      cor: '#b09040',
      capital: null,
      governo: '—',
      regente: '—',
      populacao: '—',
      notas: 'Corredor entre Petrynia e o coração do Reinado.',
      rotulo: { x: 289, y: 583 },
      poligono: [[269,556],[301,550],[319,568],[316,596],[292,609],[267,599],[259,574]]
    },

    /* ---------------- ALÉM DO REINADO ---------------- */
    {
      id: 'sckharshantallas',
      brasao: 'de ouro, um dragão rampante de vermelho coroado do campo',
      nome: 'Sckharshantallas',
      nomeOficial: 'Reino Dracônico de Sckharshantallas',
      categoria: 'independente',
      cor: '#d22833',
      capital: 'ghallistryx',
      governo: 'Monarquia dracônica',
      regente: 'Kallyadranoch (culto)',
      populacao: '≈ 1.950.000',
      notas: 'O reino dos dragões e seus servos. Sede do Sckharal, sete dias de festividades ' +
        'em que dragões de vime tomam as ruas — e cujo último dia é reservado à execução ' +
        'de criminosos.',
      rotulo: { x: 728, y: 239 },
      poligono: [[694,204],[746,195],[783,215],[789,253],[762,283],[719,286],[691,258],
                 [684,227]]
    },
    {
      id: 'montanhas-sanguinarias',
      nome: 'Montanhas Sanguinárias',
      nomeOficial: 'Montanhas Sanguinárias',
      categoria: 'regiao',
      cor: '#6b2b2b',
      capital: null,
      governo: 'Tribos e senhores da guerra',
      regente: '—',
      populacao: '—',
      notas: 'Cordilheira brutal no extremo leste, terra de orcs, ogros e coisas piores.',
      rotulo: { x: 844, y: 267 },
      poligono: [[809,204],[861,197],[891,222],[893,276],[870,321],[831,326],[804,290],
                 [797,239]]
    },
    {
      id: 'montanhas-uivantes',
      nome: 'Montanhas Uivantes',
      nomeOficial: 'Montanhas Uivantes',
      categoria: 'regiao',
      cor: '#7a8590',
      capital: null,
      governo: 'Sem governo',
      regente: '—',
      populacao: '—',
      notas: 'Cordilheira congelada onde a Dragoa-Rainha Beluhga foi aprisionada por Khalmyr. ' +
        'A região congelou ao longo dos milênios.',
      rotulo: { x: 356, y: 522 },
      poligono: [[299,477],[361,467],[421,478],[441,506],[425,541],[374,556],[319,546],
                 [291,514]]
    },
    {
      id: 'khubar',
      nome: 'Khubar',
      nomeOficial: 'Halak-Tûr Il Kabir',
      categoria: 'independente',
      cor: '#b0913f',
      capital: null,
      governo: '—',
      regente: '—',
      populacao: '—',
      notas: 'Arquipélago e costa a leste do Istmo, no Grande Oceano.',
      rotulo: { x: 675, y: 656 },
      poligono: [[639,624],[691,617],[721,638],[716,673],[682,691],[647,683],[629,651]]
    },
    {
      id: 'hangpharstyth',
      nome: 'Istmo de Hangpharstyth',
      nomeOficial: 'Istmo de Hangpharstyth',
      categoria: 'regiao',
      cor: '#7a6a50',
      capital: null,
      governo: 'Sem governo',
      regente: '—',
      populacao: '—',
      notas: 'Faixa de terra que une Arton Norte e Sul. Leva o nome da arquimaga goblinoide ' +
        'Hangpharstyth, cuja morte em explosão mística deu origem à Noite das Sombras.',
      rotulo: { x: 572, y: 675 },
      poligono: [[544,647],[581,641],[603,660],[599,691],[572,706],[544,696],[534,667]]
    },
    {
      id: 'tapista',
      nome: 'Tapista',
      nomeOficial: 'Tapista',
      categoria: 'regiao',
      cor: '#9a9040',
      capital: null,
      governo: '—',
      regente: '—',
      populacao: '—',
      notas: 'Vastas terras a oeste. Possui uma rede de estradas de pedra calçada, ' +
        'garantindo boa eficiência sob qualquer clima.',
      rotulo: { x: 164, y: 450 },
      poligono: [[99,379],[191,367],[251,392],[256,456],[210,499],[129,501],[91,455]]
    },
    {
      id: 'greenleaf',
      nome: 'Floresta Greenleaf',
      nomeOficial: 'Floresta Greenleaf',
      categoria: 'regiao',
      cor: '#26662f',
      capital: null,
      governo: 'Sem governo',
      regente: '—',
      populacao: '—',
      notas: 'Imensa floresta no noroeste do continente.',
      rotulo: { x: 153, y: 403 },
      poligono: [[104,361],[176,351],[216,372],[211,413],[160,433],[109,421],[94,387]]
    },
    {
      id: 'lamnor',
      nome: 'Vannestuir (Lamnor)',
      nomeOficial: 'Terras de Vannestuir, em Lamnor',
      categoria: 'regiao',
      cor: '#8a6248',
      capital: null,
      governo: '—',
      regente: '—',
      populacao: '—',
      notas: 'Extremo noroeste, na direção de Lamnor — o continente de onde partiu a ' +
        'caravana de refugiados que fundou a era atual de Arton.',
      rotulo: { x: 100, y: 189 },
      poligono: [[44,119],[131,109],[176,140],[173,216],[125,256],[61,249],[34,190]]
    },
    {
      id: 'deserto-perdicao',
      brasao: 'gironado de azul e prata, sobre tudo duas cimitarras passadas em aspa',
      nome: 'Deserto da Perdição',
      nomeOficial: 'Deserto da Perdição',
      categoria: 'regiao',
      cor: '#cfae5a',
      capital: 'cidade-no-deserto',
      governo: '—',
      regente: '—',
      populacao: '≈ 3.000.000',
      notas: 'Deserto de tempestades de areia que trazem estranhos de outros mundos. ' +
        'Abriga a lendária Cidade no Deserto, de posição inconstante.',
      rotulo: { x: 494, y: 208 },
      poligono: [[379,139],[521,119],[641,140],[661,201],[600,256],[469,266],[389,231],
                 [364,179]]
    },
    {
      id: 'grande-savana',
      nome: 'A Grande Savana',
      nomeOficial: 'A Grande Savana',
      categoria: 'regiao',
      cor: '#b09a45',
      capital: null,
      governo: 'Reinos e tribos',
      regente: '—',
      populacao: '—',
      notas: 'Terra de orgulhosa civilização arcana, ao sul do Deserto da Perdição.',
      rotulo: { x: 439, y: 258 },
      poligono: [[329,224],[471,214],[581,240],[591,291],[500,321],[399,319],[329,281]]
    },
    {
      id: 'galrasia',
      nome: 'Galrasia',
      nomeOficial: 'Ilha de Galrasia',
      categoria: 'regiao',
      cor: '#2f7a4a',
      capital: null,
      governo: 'Tribos',
      regente: '—',
      populacao: '—',
      notas: 'A terra esquecida pelo tempo, arrancada de Vitalia, o Mundo de Lena. ' +
        'Aqui surgiram os primeiros povos-trovão.',
      rotulo: { x: 139, y: 717 },
      poligono: [[94,671],[176,661],[216,692],[211,753],[155,783],[99,773],[77,719]]
    },

    /* ---------------- ÁREAS DE TORMENTA ---------------- */
    {
      id: 'tormenta-norte',
      nome: 'Tormenta do Norte',
      nomeOficial: 'Área de Tormenta',
      categoria: 'tormenta',
      cor: '#d22833',
      capital: null,
      governo: 'A Tempestade Rubra',
      regente: '—',
      populacao: '—',
      notas: 'Região de chuva ácida e sangrenta, paisagem de pesadelo tomada por demônios. ' +
        'A movimentação em áreas de Tormenta equivale à metade do tipo de terreno afetado.',
      rotulo: { x: 300, y: 62 },
      poligono: [[213,20],[318,14],[386,44],[392,92],[330,124],[240,128],[188,96],[182,52]]
    },
    {
      id: 'tormenta-savana',
      nome: 'Tormenta da Savana',
      nomeOficial: 'Área de Tormenta',
      categoria: 'tormenta',
      cor: '#d22833',
      capital: null,
      governo: 'A Tempestade Rubra',
      regente: '—',
      populacao: '—',
      notas: 'Mácula avançando sobre a Grande Savana.',
      rotulo: { x: 305, y: 244 },
      poligono: [[264,209],[315,203],[345,222],[344,258],[313,278],[275,272],[256,240]]
    },
    {
      id: 'tormenta-zakharov',
      nome: 'Tormenta de Zakharov',
      nomeOficial: 'Área de Tormenta',
      categoria: 'tormenta',
      cor: '#d22833',
      capital: null,
      governo: 'A Tempestade Rubra',
      regente: '—',
      populacao: '—',
      notas: 'A Tormenta corrói a fronteira norte de Zakharov, junto às Estepes do Norte.',
      rotulo: { x: 430, y: 483 },
      poligono: [[402,462],[433,455],[459,468],[462,494],[444,512],[415,510],[398,488]]
    },
    {
      id: 'tormenta-tyzzia',
      nome: 'Tormenta de Tyzzia',
      nomeOficial: 'Área de Tormenta',
      categoria: 'tormenta',
      cor: '#d22833',
      capital: null,
      governo: 'A Tempestade Rubra',
      regente: '—',
      populacao: '—',
      notas: 'Mácula em torno do Pântano de Tyzzia, ao norte de Callistia e Trebuck.',
      rotulo: { x: 650, y: 275 },
      poligono: [[622,250],[661,244],[684,259],[683,289],[659,304],[629,299],[615,274]]
    },
    {
      id: 'tormenta-oriental',
      nome: 'Tormenta Oriental',
      nomeOficial: 'Área de Tormenta',
      categoria: 'tormenta',
      cor: '#d22833',
      capital: null,
      governo: 'A Tempestade Rubra',
      regente: '—',
      populacao: '—',
      notas: 'Mácula sobre as Montanhas Sanguinárias.',
      rotulo: { x: 903, y: 258 },
      poligono: [[879,214],[918,208],[938,232],[936,282],[912,306],[884,299],[871,254]]
    },

    /* ---------------- MARES ---------------- */
    {
      id: 'mar-negro',
      nome: 'Mar Negro',
      nomeOficial: 'Mar Negro',
      categoria: 'mar',
      cor: '#3b5765',
      capital: null, governo: '—', regente: '—', populacao: '—',
      notas: 'Mar que banha o oeste do Reinado.',
      rotulo: { x: 150, y: 639 },
      poligono: [[70,600],[200,585],[290,620],[300,680],[210,715],[100,705],[58,655]]
    },
    {
      id: 'mar-de-flok',
      nome: 'Mar de Flok',
      nomeOficial: 'Mar de Flok',
      categoria: 'mar',
      cor: '#3b5765',
      capital: null, governo: '—', regente: '—', populacao: '—',
      notas: 'Mar ao sul do Reinado, entre Collen e o Deserto sem Retorno.',
      rotulo: { x: 467, y: 722 },
      poligono: [[350,700],[500,685],[590,710],[585,760],[470,780],[370,760],[330,725]]
    },
    {
      id: 'grande-oceano',
      nome: 'Grande Oceano',
      nomeOficial: 'Grande Oceano',
      categoria: 'mar',
      cor: '#3b5765',
      capital: null, governo: '—', regente: '—', populacao: '—',
      notas: 'O oceano a leste, morada do Grande Oceano e de K’Athanoa nas profundezas.',
      rotulo: { x: 789, y: 622 },
      poligono: [[720,560],[880,545],[950,590],[945,680],[830,715],[720,690],[690,620]]
    }
  ];

  /* ---------------------------------------------------------------
     CIDADES E LOCAIS
     tipo: capital | cidade | vila | fortaleza | ruina | local
     --------------------------------------------------------------- */
  var CIDADES = [
    /* Deheon */
    { id: 'valkaria', nome: 'Cidade de Valkaria', nacao: 'deheon', tipo: 'capital', x: 477.9, y: 585.3,
      notas: 'Capital do Reinado. Abriga o Palácio Imperial e a estátua de Valkaria, onde a ' +
             'caravana de Lamnor chegou. Sede da Exposição de Inventos.' },
    { id: 'selentine', nome: 'Selentine', nacao: 'deheon', tipo: 'cidade', x: 462.5, y: 580.1, notas: '' },
    { id: 'pequena-colina', nome: 'Pequena Colina', nacao: 'deheon', tipo: 'vila', x: 476.4, y: 593.9, notas: '' },
    { id: 'cosamhir', nome: 'Cosamhir', nacao: 'deheon', tipo: 'cidade', x: 457.5, y: 650.2, notas: '' },
    { id: 'monte-palidor', nome: 'Monte Palidor', nacao: 'deheon', tipo: 'local', x: 491.8, y: 629.6, notas: '' },
    { id: 'vallahim', nome: 'Vallahim', nacao: 'deheon', tipo: 'cidade', x: 339.9, y: 597.5, notas: '' },

    /* Zakharov */
    { id: 'zakharin', nome: 'Zakharin', nacao: 'zakharov', tipo: 'capital', x: 468.3, y: 523.0, notas: '' },
    { id: 'rhond', nome: 'Rhond', nacao: 'zakharov', tipo: 'cidade', x: 458.7, y: 493.3, notas: '' },
    { id: 'taharecc', nome: 'Taharecc', nacao: 'zakharov', tipo: 'vila', x: 442.7, y: 517.8, notas: '' },

    /* Yudennach */
    { id: 'kannilar', nome: 'Kannilar', nacao: 'yudennach', tipo: 'capital', x: 519.4, y: 516.6,
      notas: 'Em 1410 é uma cidade de Yudennach. Anos depois se torna a capital da ' +
             'Supremacia Purista.' },
    { id: 'trokhard', nome: 'Trokhard', nacao: 'yudennach', tipo: 'cidade', x: 498.6, y: 525.2, notas: '' },
    { id: 'warton', nome: 'Warton', nacao: 'yudennach', tipo: 'cidade', x: 523.6, y: 541.8, notas: '' },
    { id: 'gavanir', nome: 'Gavanir', nacao: 'yudennach', tipo: 'cidade', x: 554.5, y: 524.1, notas: '' },
    { id: 'gallienn', nome: 'Gallienn', nacao: 'yudennach', tipo: 'vila', x: 522.9, y: 503.2, notas: '' },
    { id: 'bonwa', nome: 'Bonwa', nacao: 'yudennach', tipo: 'vila', x: 559.6, y: 503.9, notas: '' },
    { id: 'kayin', nome: 'Kayin', nacao: 'yudennach', tipo: 'vila', x: 539.3, y: 563.8, notas: '' },
    { id: 'suth-eleghar', nome: 'Suth Eleghar', nacao: 'yudennach', tipo: 'cidade', x: 516.1, y: 439.7, notas: '' },
    { id: 'drekellar', nome: 'Drekellar', nacao: 'yudennach', tipo: 'vila', x: 535.8, y: 456.7, notas: '' },

    /* Bielefeld */
    { id: 'roschfallen', nome: 'Roschfallen', nacao: 'bielefeld', tipo: 'capital', x: 602.5, y: 532.2, notas: '' },
    { id: 'norm', nome: 'Norm', nacao: 'bielefeld', tipo: 'cidade', x: 623.9, y: 552.9,
      notas: 'Sede da Ordem da Luz. Todo ano, na Cerimônia de Admissão, fica lotada de ' +
             'jovens nobres, escudeiros e aventureiros.' },
    { id: 'portfield', nome: 'Portfield', nacao: 'bielefeld', tipo: 'cidade', x: 574.7, y: 539.3, notas: '' },
    { id: 'higther', nome: 'Higther', nacao: 'bielefeld', tipo: 'vila', x: 574.7, y: 560.0, notas: '' },
    { id: 'thornwell', nome: 'Thornwell', nacao: 'bielefeld', tipo: 'vila', x: 578.2, y: 514.5, notas: '' },
    { id: 'galleann', nome: 'Galleann', nacao: 'bielefeld', tipo: 'cidade', x: 627.3, y: 539.8, notas: '' },

    /* Wynlla */
    { id: 'sophand', nome: 'Sophand', nacao: 'wynlla', tipo: 'capital', x: 539.3, y: 606.0, notas: '' },
    { id: 'kresta', nome: 'Kresta', nacao: 'wynlla', tipo: 'cidade', x: 555.9, y: 605.5, notas: '' },
    { id: 'coridrian', nome: 'Coridrian', nacao: 'wynlla', tipo: 'cidade', x: 534.3, y: 615.1, notas: '' },
    { id: 'escola-anoes', nome: 'Escola de Anões', nacao: 'wynlla', tipo: 'local', x: 529.9, y: 634.6, notas: '' },

    /* Ahlen */
    { id: 'thartann', nome: 'Thartann', nacao: 'ahlen', tipo: 'capital', x: 386.4, y: 649.5,
      notas: 'Capital de Ahlen. Sede do Palácio Rishantor e da Noite das Máscaras.' },
    { id: 'horeen', nome: 'Horeen', nacao: 'ahlen', tipo: 'cidade', x: 390.5, y: 658.9, notas: '' },
    { id: 'nilo', nome: 'Nilo', nacao: 'ahlen', tipo: 'vila', x: 411.9, y: 665.4, notas: '' },
    { id: 'follen', nome: 'Follen', nacao: 'tollon', tipo: 'vila', x: 341.2, y: 629.6, notas: '' },

    /* Petrynia / oeste */
    { id: 'tiberus', nome: 'Tiberus', nacao: 'petrynia', tipo: 'capital', x: 217.1, y: 522.1, notas: '' },
    { id: 'calacala', nome: 'Calacala', nacao: 'petrynia', tipo: 'cidade', x: 163.8, y: 540.6, notas: '' },
    { id: 'foz', nome: 'Foz', nacao: 'petrynia', tipo: 'vila', x: 175.9, y: 543.6, notas: '' },
    { id: 'bofen', nome: 'Bofen', nacao: 'petrynia', tipo: 'vila', x: 209.2, y: 510.7, notas: '' },
    { id: 'malpetrim', nome: 'Malpetrim', nacao: 'fortuna', tipo: 'cidade', x: 245.1, y: 613.4,
      notas: 'A Malpetrim original — não confundir com Nova Malpetrim, ao norte.' },
    { id: 'curanmir', nome: 'Curanmir', nacao: 'fortuna', tipo: 'vila', x: 216.6, y: 616.1, notas: '' },
    { id: 'fauchard', nome: 'Fauchard', nacao: 'fortuna', tipo: 'cidade', x: 265.1, y: 633.8, notas: '' },
    { id: 'ashven', nome: 'Ashven', nacao: 'roddenphord', tipo: 'vila', x: 164.5, y: 566.6, notas: '' },
    { id: 'altrim', nome: 'Altrim', nacao: 'roddenphord', tipo: 'cidade', x: 173.6, y: 574.7, notas: '' },
    { id: 'kamalla', nome: 'Kamalla', nacao: 'roddenphord', tipo: 'vila', x: 187.8, y: 585.3, notas: '' },
    { id: 'trandia', nome: 'Trandia', nacao: 'roddenphord', tipo: 'vila', x: 186.5, y: 605.3, notas: '' },

    /* Montanhas Uivantes */
    { id: 'korm', nome: 'Korm', nacao: 'montanhas-uivantes', tipo: 'cidade', x: 297.7, y: 477.9, notas: '' },
    { id: 'cidadela-khalmyr', nome: 'Cidadela de Khalmyr', nacao: 'montanhas-uivantes', tipo: 'fortaleza', x: 304.8, y: 505.4, notas: '' },
    { id: 'giluk', nome: 'Giluk', nacao: 'montanhas-uivantes', tipo: 'vila', x: 294.4, y: 526.2, notas: '' },
    { id: 'torre-siberus', nome: 'Torre de Siberus', nacao: 'montanhas-uivantes', tipo: 'local', x: 273.2, y: 518.6, notas: '' },
    { id: 'palacio-laponya', nome: 'Palácio de Laponya', nacao: 'montanhas-uivantes', tipo: 'local', x: 345.2, y: 553.5, notas: '' },
    { id: 'karitan', nome: 'Karitan', nacao: 'fortuna', tipo: 'vila', x: 295.9, y: 563.6, notas: '' },
    { id: 'luvian', nome: 'Luvian', nacao: 'fortuna', tipo: 'vila', x: 271.9, y: 566.1, notas: '' },

    /* Salistick */
    { id: 'yuton', nome: 'Yuton', nacao: 'salistick', tipo: 'capital', x: 607.5, y: 443.5, notas: '' },
    { id: 'ergonia', nome: 'Ergônia', nacao: 'salistick', tipo: 'cidade', x: 591.9, y: 464.3, notas: '' },
    { id: 'faran', nome: 'Faran', nacao: 'salistick', tipo: 'cidade', x: 615.2, y: 466.8, notas: '' },
    { id: 'tah-par', nome: 'Tah Par', nacao: 'salistick', tipo: 'vila', x: 598.9, y: 471.8, notas: '' },

    /* União Púrpura */
    { id: 'milothiann', nome: 'Milothiann', nacao: 'uniao-purpura', tipo: 'capital', x: 677.5, y: 510.7,
      notas: 'Futura capital de Aslothia, o Cadávero Reino.' },
    { id: 'tahnen', nome: 'Tahnen', nacao: 'uniao-purpura', tipo: 'cidade', x: 637.1, y: 478.4, notas: '' },
    { id: 'hrarglark', nome: 'Hrarglark', nacao: 'uniao-purpura', tipo: 'cidade', x: 659.4, y: 473.3, notas: '' },
    { id: 'gaboran', nome: 'Gaboran', nacao: 'uniao-purpura', tipo: 'cidade', x: 657.8, y: 489.0, notas: '' },
    { id: 'ghord', nome: 'Ghord', nacao: 'uniao-purpura', tipo: 'vila', x: 614.6, y: 482.7, notas: '' },
    { id: 'grael', nome: 'Grael', nacao: 'uniao-purpura', tipo: 'vila', x: 631.6, y: 488.5, notas: '' },
    { id: 'baakaan', nome: 'Baakaan', nacao: 'uniao-purpura', tipo: 'vila', x: 593.2, y: 488.5, notas: '' },
    { id: 'baarkalar', nome: 'Baarkalar', nacao: 'uniao-purpura', tipo: 'vila', x: 594.9, y: 495.6, notas: '' },
    { id: 'zeffan', nome: 'Zeffan', nacao: 'uniao-purpura', tipo: 'vila', x: 596.2, y: 512.0, notas: '' },
    { id: 'darem', nome: 'Darem', nacao: 'uniao-purpura', tipo: 'cidade', x: 622.7, y: 508.2, notas: '' },
    { id: 'borah', nome: 'Borah', nacao: 'uniao-purpura', tipo: 'vila', x: 621.2, y: 514.5, notas: '' },
    { id: 'moane', nome: 'Moane', nacao: 'uniao-purpura', tipo: 'cidade', x: 645.7, y: 510.7, notas: '' },
    { id: 'korenth', nome: 'Korenth', nacao: 'uniao-purpura', tipo: 'cidade', x: 641.4, y: 529.2, notas: '' },
    { id: 'cambur', nome: 'Cambur', nacao: 'uniao-purpura', tipo: 'cidade', x: 667.2, y: 548.6, notas: '' },

    /* Portsmouth / Hongari */
    { id: 'ith', nome: 'Ith', nacao: 'portsmouth', tipo: 'cidade', x: 712.2, y: 501.4, notas: '' },
    { id: 'nessie', nome: 'Nessie', nacao: 'portsmouth', tipo: 'cidade', x: 732.9, y: 510.7, notas: '' },
    { id: 'triunphus', nome: 'Triunphus', nacao: 'hongari', tipo: 'capital', x: 716.4, y: 530.9, notas: '' },
    { id: 'vollendann', nome: 'Vollendann', nacao: 'hongari', tipo: 'cidade', x: 716.0, y: 539.8, notas: '' },
    { id: 'talinthar', nome: 'Talinthar', nacao: 'hongari', tipo: 'cidade', x: 714.7, y: 550.4, notas: '' },
    { id: 'mehnat', nome: 'Mehnat', nacao: 'sanburdia', tipo: 'cidade', x: 738.7, y: 458.7, notas: '' },
    { id: 'balneario-zannar', nome: 'Balneário de Zannar', nacao: 'sanburdia', tipo: 'local', x: 766.7, y: 557.5, notas: '' },
    { id: 'refugio-donzela', nome: 'Refúgio da Donzela', nacao: 'sanburdia', tipo: 'local', x: 765.5, y: 444.8, notas: '' },

    /* Sambúrdia / Nova Malpetrim / Ghondriann / Callistia */
    { id: 'sanburdia-capital', nome: 'Sambúrdia Capital', nacao: 'sanburdia', tipo: 'capital', x: 672.0, y: 387.4, notas: '' },
    { id: 'torba', nome: 'Torba', nacao: 'sanburdia', tipo: 'cidade', x: 645.9, y: 394.5, notas: '' },
    { id: 'tumba-morkh-amhor', nome: 'Tumba de Morkh-Amhor', nacao: 'sanburdia', tipo: 'ruina', x: 723.6, y: 417.5, notas: '' },
    { id: 'nova-malpetrim-cidade', nome: 'Nova Malpetrim', nacao: 'nova-malpetrim', tipo: 'capital', x: 634.0, y: 386.0,
      notas: 'Sede da Grande Feira, semana de festividades que atrai milhares de aventureiros.' },
    { id: 'yukadar', nome: 'Yukadar', nacao: 'ghondriann', tipo: 'cidade', x: 610.6, y: 389.2, notas: '' },
    { id: 'ankhorandir', nome: 'Ankhorandir', nacao: 'ghondriann', tipo: 'cidade', x: 599.5, y: 372.0, notas: '' },
    { id: 'crisandir', nome: 'Crisandir', nacao: 'callistia', tipo: 'capital', x: 627.8, y: 346.0, notas: '' },
    { id: 'fross', nome: 'Fross', nacao: 'callistia', tipo: 'cidade', x: 613.6, y: 326.0, notas: '' },
    { id: 'quiera', nome: 'Quiera', nacao: 'callistia', tipo: 'vila', x: 600.5, y: 342.4, notas: '' },
    { id: 'pedra', nome: 'Pedra', nacao: 'callistia', tipo: 'vila', x: 608.3, y: 345.7, notas: '' },
    { id: 'zuri', nome: 'Zuri', nacao: 'callistia', tipo: 'vila', x: 582.8, y: 347.0, notas: '' },
    { id: 'kanan', nome: 'Kanan', nacao: 'callistia', tipo: 'vila', x: 593.4, y: 343.9, notas: '' },
    { id: 'tyros-sul', nome: 'Tyros', nacao: 'callistia', tipo: 'vila', x: 586.6, y: 365.9, notas: '' },
    { id: 'charco-velha', nome: 'Charco da Velha', nacao: 'callistia', tipo: 'local', x: 570.4, y: 362.9, notas: '' },
    { id: 'buraco-jorsharif', nome: 'Buraco de Jorsharif', nacao: 'ghondriann', tipo: 'local', x: 630.0, y: 362.9, notas: '' },

    /* Namalkah */
    { id: 'corte-errante', nome: 'A Corte Errante', nacao: 'namalkah', tipo: 'capital', x: 526.7, y: 395.2,
      notas: 'Capital móvel: viaja junto com as hostes nômades.' },
    { id: 'yrom', nome: 'Yrom', nacao: 'namalkah', tipo: 'cidade', x: 516.6, y: 367.7, notas: '' },
    { id: 'ruinas-alkav', nome: 'Ruínas de Alkav', nacao: 'namalkah', tipo: 'ruina', x: 559.5, y: 417.5, notas: '' },
    { id: 'refugio-atilah', nome: 'Refúgio de Atilah', nacao: 'namalkah', tipo: 'local', x: 573.4, y: 396.5, notas: '' },

    /* Trebuck e Pondsmânia */
    { id: 'crovandir', nome: 'Crovandir', nacao: 'trebuck', tipo: 'capital', x: 690.6, y: 315.4,
      notas: 'Principal assentamento dos Feudos de Trebuck.' },
    { id: 'coravandor', nome: 'Cidade-Fortaleza de Coravandor', nacao: 'trebuck', tipo: 'fortaleza', x: 699.0, y: 284.1, notas: '' },
    { id: 'tyros-norte', nome: 'Tyros', nacao: 'trebuck', tipo: 'cidade', x: 771.1, y: 272.7, notas: '' },
    { id: 'linnanthas-shaed', nome: 'Linnanthas-Shaed', nacao: 'pondsmania', tipo: 'capital', x: 700.0, y: 337.6, notas: '' },
    { id: 'palacio-nayali', nome: 'Palácio-Cidadela de Nayali', nacao: 'pondsmania', tipo: 'fortaleza', x: 694.9, y: 328.5, notas: '' },
    { id: 'sylvany', nome: 'Sylvany-Cluirfriach', nacao: 'pondsmania', tipo: 'cidade', x: 710.4, y: 346.0, notas: '' },
    { id: 'mercado-goblins', nome: 'Mercado dos Goblins', nacao: 'pondsmania', tipo: 'local', x: 692.0, y: 350.5, notas: '' },
    { id: 'taliban', nome: 'Talibán', nacao: 'montanhas-sanguinarias', tipo: 'cidade', x: 795.6, y: 383.6, notas: '' },

    /* Sckharshantallas */
    { id: 'ghallistryx', nome: 'Ghallistryx', nacao: 'sckharshantallas', tipo: 'capital', x: 731.0, y: 233.0,
      notas: 'Capital do Reino Dracônico. Sede do Sckharal.' },

    /* Sul / Istmo / Khubar */
    { id: 'vila-alkeran', nome: 'Vila Alkeran', nacao: 'khubar', tipo: 'vila', x: 602.0, y: 621.9, notas: '' },
    { id: 'havanah', nome: 'Havanah', nacao: 'khubar', tipo: 'cidade', x: 623.9, y: 635.9, notas: '' },
    { id: 'cidadela-do-mal', nome: 'Cidadela do Mal', nacao: 'khubar', tipo: 'fortaleza', x: 631.6, y: 665.2, notas: '' },
    { id: 'vila-questor', nome: 'Vila Questor', nacao: 'hangpharstyth', tipo: 'vila', x: 544.4, y: 682.9, notas: '' },

    /* Deserto */
    { id: 'cidade-no-deserto', nome: 'Cidade no Deserto', nacao: 'deserto-perdicao', tipo: 'capital', x: 375.0, y: 133.0,
      notas: 'Posição inconstante — a cidade se move pelo deserto.' }
  ];

  var TIPOS_CIDADE = {
    capital:   { rotulo: 'Capital',   raio: 4.2, cor: '#ffd166' },
    cidade:    { rotulo: 'Cidade',    raio: 3.0, cor: '#f4f1e8' },
    vila:      { rotulo: 'Vila',      raio: 2.2, cor: '#cbc4b2' },
    fortaleza: { rotulo: 'Fortaleza', raio: 3.2, cor: '#9ad1ff' },
    ruina:     { rotulo: 'Ruína',     raio: 2.6, cor: '#b39ddb' },
    local:     { rotulo: 'Local',     raio: 2.4, cor: '#8fd6a8' }
  };

  /* ---------------------------------------------------------------
     TOKENS DO GRUPO
     Seis lugares fixos, um por personagem. O mestre põe nome e foto e
     arrasta pelo mapa para mostrar onde o grupo está agora. x/y nulos
     significam que o token ainda não foi posto em lugar nenhum.
     --------------------------------------------------------------- */
  var CORES_TOKEN = ['#d22833', '#2e417e', '#9f7f3e', '#0f6233', '#6b3f8f', '#3f7a80'];

  function tokensPadrao() {
    var lista = [];
    for (var i = 0; i < 6; i++) {
      lista.push({
        id: 'heroi-' + (i + 1),
        nome: '',
        foto: null,          // data URL, gerada no navegador já reduzida
        cor: CORES_TOKEN[i],
        x: null,
        y: null,
        tamanho: 1,          // multiplicador do retrato no mapa
        visivel: true
      });
    }
    return lista;
  }

  /* ---------------------------------------------------------------
     ESTADO DE GUERRA
     Quem manda em cada terra, e como isso aparece no mapa. Quando um
     território é conquistado, ele passa a ser pintado com as cores do
     conquistador listradas sobre as do dono original — dá para ver de
     relance o que mudou de mão sem ler nada.
     --------------------------------------------------------------- */
  var ESTADOS_GUERRA = {
    neutro:      { rotulo: 'Em paz',            ordem: 0, icone: '·' },
    leal:        { rotulo: 'Leal ao Reinado',   ordem: 1, icone: '⚜️' },
    mobilizado:  { rotulo: 'Mobilizado',        ordem: 2, icone: '🛡️' },
    sitiado:     { rotulo: 'Sitiado',           ordem: 3, icone: '⚔️' },
    revolta:     { rotulo: 'Em revolta',        ordem: 4, icone: '🔥' },
    conquistado: { rotulo: 'Conquistado',       ordem: 5, icone: '🏴' },
    arrasado:    { rotulo: 'Arrasado',          ordem: 6, icone: '💀' }
  };

  var CATEGORIAS = {
    reinado:      { rotulo: 'O Reinado',        ordem: 1 },
    independente: { rotulo: 'Nações e reinos',  ordem: 2 },
    regiao:       { rotulo: 'Regiões',          ordem: 3 },
    tormenta:     { rotulo: 'Áreas de Tormenta', ordem: 4 },
    mar:          { rotulo: 'Mares',            ordem: 5 }
  };

  function clonar(o) { return JSON.parse(JSON.stringify(o)); }

  return {
    LARGURA_VIEWBOX: LARGURA_VIEWBOX,
    ALTURA_VIEWBOX: ALTURA_VIEWBOX,
    KM_POR_UNIDADE: KM_POR_UNIDADE,
    KM_POR_DIA_DE_VIAGEM: KM_POR_DIA_DE_VIAGEM,
    TIPOS_CIDADE: TIPOS_CIDADE,
    CATEGORIAS: CATEGORIAS,
    ANO: 1410,
    ESTADOS_GUERRA: ESTADOS_GUERRA,
    MAX_TOKENS: 6,
    CORES_TOKEN: CORES_TOKEN,
    tokensPadrao: tokensPadrao,
    padrao: function () {
      var nacoes = clonar(NACOES);
      nacoes.forEach(function (n) {
        n.estadoGuerra = 'neutro';   // ver ESTADOS_GUERRA
        n.controladoPor = null;      // id de quem tomou a terra, se tomada
        n.conhecido = true;          // névoa: o grupo já esteve/ouviu falar
      });
      return {
        versao: 3, ano: 1410,
        nacoes: nacoes,
        cidades: clonar(CIDADES),
        tokens: tokensPadrao(),
        cronica: []                  // instantâneos datados do mapa
      };
    }
  };
})();
