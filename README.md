# Crônicas Artonianas

Mapa interativo de **Arton em 1410** e **calendário artoniano**, para a campanha da
Guerra Artoniana em Tormenta20.

Tudo numa página só:

- **O mapa** é a tela — o Reinado e terras próximas *circa* 1410, desenhado em vetor:
  costa, rios, desertos, matas, serras e Áreas de Tormenta. Territórios editáveis
  recortados pela linha de costa, cidades dentro de cada reino, busca, régua em
  quilômetros.
- **Os seis heróis** ficam em cima do mapa, com nome e retrato, mostrando onde o grupo
  está agora.
- **O calendário** abre num pop-up por cima do mapa: os doze meses de Arton, a semana dos
  deuses, os Dias de Nimb e as datas comemorativas, com um diário de campanha por dia —
  escrito a várias vozes, uma por herói.
- **A guerra** pinta o mapa: território tomado fica listrado com as cores do conquistador
  sobre as do dono antigo, cerco tem fronteira pulsante, revolta é hachurada.
- **A crônica** guarda o mapa em momentos datados, e você percorre a linha do tempo para
  ver a guerra acontecer. Cada momento aparece no calendário, no dia em que aconteceu, e o
  **boletim** compara dois momentos e narra em texto o que mudou: quem tomou o quê, quem se
  revoltou, quanto território mudou de mãos.
- **As marcações** desenham por cima do mundo sem mexer nele: círculo, retângulo e alfinete,
  com o tamanho em quilômetros — o raio de uma explosão continua valendo o mesmo depois de
  qualquer zoom. O mestre marca para a mesa; cada jogador marca as próprias anotações.
- **O rastro** liga as posições do grupo momento a momento, mostrando o caminho da campanha.
- **As sessões** registram o encontro de verdade — número, data real, resumo — amarrado aos
  dias de Arton que vocês jogaram.
- **A névoa** esconde o que o grupo ainda não conhece.
- **Os brasões** de treze nações são desenhados a partir da linguagem heráldica do Atlas.

A paleta vem do próprio livro: o vermelho `#d22833` é o mesmo das quatorze aberturas de
classe do básico, e o "preto" do projeto é o bordô `#3f0e16` que a Jambô usa no lugar do
preto puro.

As duas escurecem sozinhas quando anoitece **no relógio real de quem está olhando** — cada
jogador vê segundo o próprio fuso horário, não o do jogo.

**O mestre edita, os jogadores só visualizam.** É a mesma URL para todo mundo; quem entra
com a senha ganha as ferramentas de edição.

---

## Rodando na sua máquina

Precisa do Node.js 18 ou mais novo. A única dependência é o driver do Postgres (`pg`).

```bash
cd Artoniana
npm install
SENHA_MESTRE="a-senha-que-voce-quiser" node servidor.js
```

Abra <http://localhost:3000>. Clique em **Entrar como mestre** e use a senha.

Sem `DATABASE_URL` definida, o servidor grava o mundo num arquivo local
(`dados/estado.json`) — ótimo para testar na sua máquina, sem precisar de um Postgres
rodando. Veja a seção seguinte para publicar com Postgres de verdade.

### Testes

```bash
npm test
```

Sobe o servidor de verdade numa pasta temporária e confere o que não pode quebrar em
silêncio: as três portas de entrada, a URL malformada que já derrubou o processo, a
compressão, o diário sobrevivendo às gravações do mestre, a trava otimista e o logout
revogando a sessão. Sem framework e sem dependência de desenvolvimento — é o mesmo Node
que roda o servidor. O GitHub Actions roda isso e mais uma conferida de sintaxe em todo o
JavaScript a cada push, já que o front-end não tem build para pegar um erro de digitação.

---

## Publicando no Railway

1. Suba a pasta para um repositório do GitHub e crie um projeto novo no Railway apontando
   para ele. O `railway.json` já manda rodar `node servidor.js`; o `PORT` o Railway define
   sozinho.

2. **Defina `SENHA_MESTRE` e `SENHA_JOGADOR`.** Sem a primeira o servidor **se recusa a
   subir** em produção, em vez de aceitar a senha de exemplo e deixar qualquer pessoa com o
   link virar mestre. Sem a segunda ele sobe, mas o link é público e estranhos veem o mundo
   inteiro — o log avisa.

3. **Adicione um banco Postgres ao projeto.** O disco do contêiner é efêmero: sem um banco,
   todo redeploy apaga o mundo que você construiu — é para isso que serve o Postgres aqui.

   - No projeto do Railway, clique em **New** → **Database** → **Add PostgreSQL**.
   - Como o Postgres fica no mesmo projeto, o Railway já injeta `DATABASE_URL` nas
     variáveis do serviço da aplicação automaticamente (se não injetar sozinho, adicione a
     variável `DATABASE_URL` apontando para `${{Postgres.DATABASE_URL}}`).
   - Pronto — o servidor detecta `DATABASE_URL` e passa a gravar o mundo no Postgres, que
     sobrevive a redeploys sem precisar de volume nenhum.

4. Mande o link para a mesa. Quem abrir sem a senha entra em modo leitura.

### Variáveis de ambiente

| Variável | Para que serve | Padrão |
| --- | --- | --- |
| `SENHA_MESTRE` | Senha que libera a edição | `mestre` na sua máquina; **obrigatória** em produção |
| `SENHA_JOGADOR` | Senha da mesa: sem ela ninguém entra | vazia = link público ⚠️ |
| `DATABASE_URL` | Conexão do Postgres onde o mundo é gravado | sem ela, cai para um arquivo local ⚠️ |
| `DADOS_DIR` | Onde gravar `estado.json` quando não há `DATABASE_URL` | `./dados` |
| `SEGREDO` | Assina o cookie de sessão | derivado da senha |
| `PORT` | Porta HTTP | `3000` |

Sem `DATABASE_URL` no Railway, o servidor sobe do mesmo jeito, mas grava no disco efêmero
do contêiner — e some no próximo redeploy. É por isso que vale a pena configurar o
Postgres antes de convidar a mesa.

Em produção o servidor prefere não subir a subir aberto: sem `SENHA_MESTRE` ele sai com
erro dizendo o que falta. Ele reconhece produção por `NODE_ENV=production` ou pelas
variáveis que o próprio Railway injeta.

O servidor tem duas portas estreitas, `POST /api/diario` e `POST /api/marcacao`, que são as
únicas gravações liberadas a quem não é mestre — e só aceitam a assinatura de um herói que
exista no grupo. A do diário exige um dia válido; a das marcações valida forma, posição e
tamanho antes de deixar qualquer coisa entrar no estado.

Trocar `SENHA_MESTRE` ou `SEGREDO` derruba as sessões abertas — é só entrar de novo.
Clicar em **Sair** também: o token do mestre carrega a época em que nasceu, e sair faz a
época avançar, de modo que todo cookie de mestre já emitido para de valer em qualquer
aparelho — não adianta ter guardado uma cópia dele.

### Duas gravações que não se atropelam

O mestre grava o mundo por `PUT /api/estado`; os jogadores gravam só o próprio diário, por
`POST /api/diario`. As duas coisas convivem sem se apagar:

- **O diário fica com o servidor.** O calendário que o mestre envia entra sem as notas, que
  são preservadas como estão no banco. Antes, como o mestre trabalha com uma cópia de até
  seis segundos atrás, mover o tempo apagava o que um jogador tivesse acabado de escrever.
  Só a restauração de backup pede explicitamente para trocar o diário inteiro.
- **As marcações dos jogadores também.** Quando o mestre grava o mapa, as marcações que ele
  não assinou ficam onde estão — as dele são substituídas normalmente. Para moderar uma
  marcação de jogador, o mestre a apaga pela porta própria.
- **Trava otimista no resto.** Cada gravação do mestre diz de qual revisão partiu; se o
  mundo andou desde então — outra aba, outro aparelho — o servidor responde `409` e o
  cliente recarrega e avisa, em vez de passar por cima. Escrever no diário não move a
  revisão, então uma anotação de jogador nunca vira um conflito falso.

### Desempenho

HTML, CSS e JavaScript saem comprimidos com gzip para quem aceita (praticamente todo mundo).
Na prática o desenho da geografia cai de 112 kB para 42, o `mapa.js` de 102 para 26 e o
`mapa.css` de 29 para 6 — no celular, é a diferença entre abrir na hora e esperar. As
imagens saem como estão, já que PNG e WebP não ganham nada com isso.

### Quem entra

São três portas:

| Quem | Senha | Pode |
| --- | --- | --- |
| **Estranho** | nenhuma | nada — a página mostra só a tela de senha |
| **Jogador** | `SENHA_JOGADOR` | ver o mapa, o calendário e a crônica; escrever o próprio diário |
| **Mestre** | `SENHA_MESTRE` | tudo |

Mande a senha da mesa para os jogadores e guarde a sua. As duas funcionam na mesma tela de
entrada: quem digita a do mestre entra como mestre.

Se você deixar `SENHA_JOGADOR` vazia, o link volta a ser aberto a qualquer pessoa — útil
para testar, ruim para valer.

### Atrás do proxy do Railway

O app já conta com isso e não precisa de ajuste:

- O cookie de sessão ganha `Secure` quando o `X-Forwarded-Proto` diz que a ligação é https
- O freio contra chute de senha usa o `X-Forwarded-For` para separar quem é quem. Sem isso,
  como todas as conexões chegam pelo mesmo endereço do proxy, dez erros de senha de
  qualquer visitante trancariam a mesa inteira — inclusive você
- Há também um teto geral de tentativas, já que o `X-Forwarded-For` pode ser forjado
- No `SIGTERM` do redeploy o estado é gravado antes de sair; ao subir, é lido de volta

### Backup

O disco pode falhar, então guarde uma cópia de vez em quando. No mapa, logado como mestre,
use **⬇ Backup** na barra da esquerda: baixa mapa e calendário num `.json` que o botão
**⬆ Restaurar** recarrega. Pela linha de comando dá no mesmo:

```bash
curl https://seu-app.up.railway.app/api/estado > backup-arton.json
```

---

## Como usar

### Mapa

É a própria tela, não precisa abrir nada.

| Ação | Como |
| --- | --- |
| Navegar | Arraste para mover, role para aproximar |
| Ver um reino | Clique no território ou escolha na lista da esquerda |
| Ver as cidades de um reino | Selecione o reino — a lista se abre embaixo dele |
| Buscar | Campo no topo: reinos, cidades, ruínas |
| Medir distância | Ferramenta 📏, clique em dois pontos (dá km e dias de viagem) |
| Esconder categorias | Filtros no alto da lista (Reinado, Regiões, Tormenta, Mares…) |

Só como mestre:

| Ação | Como |
| --- | --- |
| Mudar a expansão de um reino | Selecione, **✏️ Editar contorno**, arraste os pontos ⭕ vermelhos |
| Criar um ponto na fronteira | Clique num círculo dourado tracejado **+**, entre dois vértices |
| Apagar um ponto | Alt + clique num ponto vermelho (mínimo de 3 por território) |
| Mover o reino inteiro | Com o contorno em edição, arraste de dentro do território |
| Avançar ou recuar fronteiras | Botões **⊕ Expandir** / **⊖ Encolher** |
| Desenhar um território novo | Ferramenta ✏️, clique nos cantos, duplo clique fecha |
| Fundar uma cidade | Ferramenta 📍, clique no lugar |
| Mover uma cidade | Arraste o marcador |
| Renomear qualquer coisa | Campos do painel da direita — salvam sozinhos |
| Marcar onde a campanha se passa | Caixa **Palco de campanha ⚔️** na ficha da cidade |
| Posicionar os heróis | Veja "Os seis heróis", logo abaixo |
| Mudar quem manda numa terra | **Estado de guerra** na ficha: situação + sob domínio de |
| Esconder uma terra da mesa | Desmarque **O grupo conhece esta terra**, na ficha |
| Espiar por baixo da névoa | Ferramenta 🌫️ (`N`) — só você enxerga |
| Guardar o mapa de hoje | **📸 Registrar momento**, na crônica embaixo do mapa |

Com o contorno ligado, a fronteira mostra dois tipos de alça:

- **⭕ vermelho** nos cantos — arraste para mover a fronteira
- **⊕ dourado tracejado** no meio de cada trecho — clique para criar um canto novo

O modo contorno continua ligado quando você troca de território, então dá para ajustar
vários reinos seguidos sem reativar toda vez. Uma faixa embaixo do mapa lembra o que cada
alça faz enquanto você edita.

Atalhos: `V` selecionar · `R` régua · `T` território · `C` cidade · `L` rótulos ·
`0` enquadrar · `Esc` cancelar.

### Os seis heróis

A tira **O grupo**, no alto da barra da esquerda, tem seis lugares — um por personagem.
Todo mundo vê nome, retrato e posição; só o mestre mexe.

| Ação | Como |
| --- | --- |
| Definir nome e foto | Clique no ✎ do herói |
| Enviar a foto | **🖼️ Escolher foto** — qualquer imagem serve |
| Enquadrar o retrato | Arraste a foto dentro do círculo |
| Aproximar | Barra **Aproximar** ou a roda do mouse sobre o círculo |
| Endireitar | **↻ Girar 90°** para fotos deitadas |
| Recomeçar o enquadramento | **Centralizar** |
| Pôr no mapa | Clique no herói na tira; ele aparece no meio da vista |
| Mover | Arraste o retrato pelo mapa |
| Redimensionar | Puxe o **alfinete dourado** na quina do aro, ou use a barra **Tamanho do retrato** |
| Tirar do mapa | **Tirar do mapa**, na ficha ou no ✎ |
| Ir até ele | Clique no herói na tira (funciona para os jogadores também) |

Ao escolher a imagem, o círculo vira um recortador: arraste para escolher o pedaço, use a
barra ou a roda do mouse para aproximar e gire se a foto estiver deitada. O aro vermelho
mostra exatamente o que vai virar retrato.

O recorte é feito **no seu navegador** e guardado com 160 px — uma foto de 1200×500 sai
com cerca de 4 KB. Pode mandar a imagem que quiser sem pensar no tamanho do arquivo.

Clicando num herói no mapa, a ficha da direita diz em que território ele está e qual a
cidade mais próxima, em quilômetros.

O alfinete só aparece no herói selecionado e só para o mestre. Retrato, nome e alfinete
mantêm o mesmo tamanho na tela em qualquer aproximação — o herói não incha quando você dá
zoom, e o alfinete continua do mesmo jeito para ser puxado.

### A guerra no mapa

Cada território tem uma **situação**: em paz, leal ao Reinado, mobilizado, sitiado, em
revolta, conquistado ou arrasado. Marcando **Conquistado** e escolhendo quem tomou a terra,
o território passa a ser pintado com as cores do conquistador **listradas sobre as do dono
antigo** — dá para ver o que mudou de mão sem ler nada. Cerco ganha fronteira vermelha
pulsante; revolta, hachura; terra arrasada fica apagada e pontilhada.

A pastilha na lista lateral também fica bicolor, e um selo mostra a situação.

### A crônica

A faixa embaixo do mapa é a linha do tempo da guerra. Em **📸 Registrar momento** o mestre
guarda o mapa de hoje, carimbado com a data artoniana e um título ("Yudennach cruza a
fronteira"). Depois é só clicar num momento para ver o mapa como estava naquele dia.

Os momentos ficam em ordem de data artoniana. No passado nada pode ser editado — uma tarja
dourada avisa. O mestre pode **↩ Trazer para hoje**, que devolve fronteiras e domínios
daquele dia ao presente, ou apagar o momento.

Cidades e heróis não aparecem na crônica: eles são do agora.

### A névoa

Desmarcando **O grupo conhece esta terra**, o território vira **terra incógnita** para a
mesa: sem nome, sem cor, sem cidades, e a ficha não conta nada. O mestre continua
trabalhando normalmente — a ferramenta 🌫️ (`N`) levanta o véu só para ele, e os
territórios que a mesa não vê ficam com contorno pontilhado para lembrar disso.

### Os brasões

Treze nações têm o brasão descrito no *Atlas de Arton* em linguagem heráldica de verdade —
*"de púrpura uma torre de ouro"*, *"gironado de azul e prata, duas cimitarras passadas em
aspa"*. O `js/heraldica.js` lê essa descrição e desenha o escudo: esmaltes, partições
(talhado, cortado, gironado), peças (banda, faixa, aspa, campanha, orla) e um punhado de
figuras. O que ele não reconhece vira um escudo liso com a inicial da nação.

Para dar brasão a outra nação, basta escrever a descrição no campo `brasao` dela em
`js/dados-mapa.js`.

### Calendário

Abre no botão da barra do topo (que já mostra a data e a hora da campanha) ou com a tecla
`K`. Fecha com `Esc`, no ✕ ou clicando fora.

O mestre move o tempo pelos botões (`−1 dia`, `+1 h`, `+8 h` para um descanso longo,
`+3 h` para um toque de sino) ou em **Acertar data…**. O que ele fizer aparece na tela dos
jogadores em poucos segundos.

### O diário a várias vozes

Cada dia tem um **diário de campanha** onde a mesa inteira escreve. O jogador clica em
**Quem é você?** na barra do topo, escolhe seu herói, e o que ele escrever passa a ser
assinado com o nome e o retrato do personagem. Todo mundo lê todas as entradas; o número
no canto do dia, na grade, conta quantas vozes há ali.

O mestre escreve como mestre e pode apagar qualquer entrada.

> Não há senha por jogador: quem tem o link pode escrever como qualquer herói do grupo. Para
> uma mesa de amigos isso evita atrito, e o mestre modera o que precisar. Se um dia isso
> incomodar, dá para pôr um código por herói.

Em **🌀 Dias de Nimb** você abre a carta do Deus do Caos daquele ano: quantos dias avulsos
ele terá (de 2 a 8) e ao fim de qual mês vão cair. Sem definir nada, o app sorteia a partir
do número do ano — sempre igual para o mesmo ano, então a mesa toda vê a mesma coisa.

Atalhos: `K` abre e fecha · `←` `→` trocam de mês · `H` volta para a data atual.

### No celular

O mapa é a tela toda. As duas laterais viram gavetas nos botões **☰** (reinos e grupo) e
**ⓘ** (detalhes), no alto à direita; tocar no mapa fecha a gaveta aberta.

- **Dois dedos** aproximam e afastam
- **Um dedo** arrasta o mapa, mesmo saindo de cima de um reino
- **Toque parado** num reino seleciona e abre a ficha sozinho

O calendário abre em coluna única, e os modais sobem de baixo como folhas.

### Dia e noite

O ícone ao lado do relógio, no topo, alterna entre **automático**, **sempre claro** e
**sempre escuro**. Shift + clique (ou botão direito) abre o horário do nascer e do pôr do
sol. É uma preferência de cada pessoa, guardada no navegador — não afeta a mesa.

---

## O que já vem pronto

**Calendário** — conforme o *Atlas de Arton*, "Tempo & Calendário" (p. 30-33):

- 12 meses de 30 dias: Caravana, Pomo, Keenvia *(primavera)*, Sirravia, Vigília, Prussvia
  *(verão)*, Ceifa, Contenda, Clausura *(outono)*, Pharstyth, Véu, Pyra *(inverno)*
- Semana de 7 dias: Valk, Hedryl, Luna, Astar, Dallia, Haya *(festejos)*, Leen *(descanso)*
- Dias de Nimb, de 2 a 8 por ano, fora de qualquer mês
- As 10 datas comemorativas do Atlas, do Dia do Reencontro à Noite das Sombras
- Datas em forma culta *("Hedryl 5 sob Keenvia, mil quatrocentos e dez anos da chegada dos
  elfos")* e coloquial *("5 de Keenvia de 1410")*
- As três velas da noite e os sinos de três em três horas

A campanha começa em **5 de Keenvia de 1410** — a data que o golem Ecletos anuncia no
Palácio Imperial, em *Jornada Heróica — Guerra Artoniana*.

**Mapa** — traçado vetorial extraído da prancha original, mais 42 territórios e 109
locais posicionados, no cenário de 1410:

- O Reinado: Deheon, Yudennach, Bielefeld, Wynlla, Ahlen, Zakharov, Namalkah, Pondsmânia,
  Callistia, Feudos de Trebuck
- Vizinhos: Sambúrdia, Salistick, União Púrpura, Portsmouth, Hongari, Nova Malpetrim,
  Ghondriann, Sckharshantallas, Khubar e outros
- Regiões, mares e as Áreas de Tormenta

Como é **1410 e não 1420**, o mundo está diferente do Atlas: a **União Púrpura** ainda não
virou Aslothia, **Kannilar** é só uma cidade de Yudennach e não a capital purista,
**Tyrondir** ainda é um reino de pé, e a Supremacia Purista está se formando nas sombras.

> A geografia (costa, rios, biomas, Tormenta) é fiel: sai da própria prancha, classificada
> por cor e vetorizada. Já as **fronteiras políticas** são aproximações traçadas por cima,
> só para você ter de onde partir — ajuste cada uma no editor conforme a guerra avança.
> Elas ficam recortadas pela linha de costa, então nenhuma nação avança pelo mar.

### Regerando o traçado

O desenho vetorial é gerado por `ferramentas/vetorizar.py` a partir de
`ferramentas/mapa-origem-1410.png`. Só precisa de Python com Pillow:

```bash
python3 ferramentas/vetorizar.py
```

Ele reescreve `publico/js/geografia-arton.js`. Mexa nos limiares de cor ou nas caixas de
legenda lá dentro se quiser afinar o resultado.

---

## Estrutura

```
servidor.js               servidor HTTP, API e sessão do mestre (Node puro)
banco.js                  persistência em Postgres (usada quando há DATABASE_URL)
railway.json              configuração de deploy
testes/fumaca.js          testes de fumaça, sem framework (`npm test`)
dados/estado.json         o mundo salvo em arquivo local, sem DATABASE_URL (não vai para o git)
ferramentas/
  vetorizar.py            gera o traçado vetorial a partir da prancha
  mapa-origem-1410.png    a prancha original (não é servida; só serve de fonte)
publico/
  index.html              a página — mapa, pop-up do calendário e os modais
  css/
    base.css              paleta do Tormenta20, tipografia e o tema dia/noite
    mapa.css              o mapa em tela cheia e os heróis
    calendario.css        a janela sobreposta do calendário
  js/
    geografia-arton.js    GERADO — costa, rios, biomas e Tormenta em SVG
    dados-mapa.js         nações, cidades e coordenadas de 1410
    dados-calendario.js   meses, dias da semana, datas comemorativas
    calendario-arton.js   motor do calendário (conversão, Dias de Nimb, formatação)
    tema.js               ciclo dia/noite pelo relógio real
    sincronia.js          conversa com o servidor
    armazenamento.js      localStorage, exportar e importar
    interface.js          barra do topo, login, avisos
    heraldica.js          lê a linguagem heráldica do Atlas e desenha os escudos
    mapa.js               o mapa, guerra, crônica, névoa, heróis e fotos (MapaArton)
    calendario.js         a janela do calendário (CalendarioJanela)
```

O `js/dados-mapa.js` explica o sistema de coordenadas, caso você queira acrescentar
lugares direto no arquivo em vez de pelo editor. O `js/geografia-arton.js` é gerado —
não edite à mão.

---

## Créditos

Tormenta20 é © Jambô Editora. Calendário e cenário adaptados do *Atlas de Arton* e de
*Jornada Heróica — Guerra Artoniana*. Traçado vetorizado a partir de *Arton — O Reinado e
terras próximas, circa 1410*, cartografia de Bruno Müller. Paleta amostrada das aberturas
de classe do livro básico. Projeto de uso pessoal, para a mesa.
