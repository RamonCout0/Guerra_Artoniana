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
  deuses, os Dias de Nimb e as datas comemorativas, com um diário de campanha por dia.

A paleta vem do próprio livro: o vermelho `#d22833` é o mesmo das quatorze aberturas de
classe do básico, e o "preto" do projeto é o bordô `#3f0e16` que a Jambô usa no lugar do
preto puro.

As duas escurecem sozinhas quando anoitece **no relógio real de quem está olhando** — cada
jogador vê segundo o próprio fuso horário, não o do jogo.

**O mestre edita, os jogadores só visualizam.** É a mesma URL para todo mundo; quem entra
com a senha ganha as ferramentas de edição.

---

## Rodando na sua máquina

Precisa só do Node.js 18 ou mais novo. Não há dependências para instalar.

```bash
cd Artoniana
SENHA_MESTRE="a-senha-que-voce-quiser" node servidor.js
```

Abra <http://localhost:3000>. Clique em **Entrar como mestre** e use a senha.

---

## Publicando no Railway

1. Suba a pasta para um repositório do GitHub e crie um projeto novo no Railway apontando
   para ele. O `railway.json` já manda rodar `node servidor.js`; o `PORT` o Railway define
   sozinho.

2. **Defina a variável de ambiente `SENHA_MESTRE`.** Sem ela o servidor sobe com a senha
   `mestre` e avisa no log — qualquer pessoa com o link viraria mestre.

3. **Monte um volume** e aponte `DADOS_DIR` para ele. O disco do contêiner é efêmero: sem
   volume, todo redeploy apaga o mundo que você construiu.

   - Crie um volume no serviço, com ponto de montagem `/dados`
   - Defina `DADOS_DIR=/dados`

4. Mande o link para a mesa. Quem abrir sem a senha entra em modo leitura.

### Variáveis de ambiente

| Variável | Para que serve | Padrão |
| --- | --- | --- |
| `SENHA_MESTRE` | Senha que libera a edição | `mestre` ⚠️ |
| `DADOS_DIR` | Onde gravar `estado.json` | `./dados` |
| `SEGREDO` | Assina o cookie de sessão | derivado da senha |
| `PORT` | Porta HTTP | `3000` |

Trocar `SENHA_MESTRE` ou `SEGREDO` derruba as sessões abertas — é só entrar de novo.

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

### Calendário

Abre no botão da barra do topo (que já mostra a data e a hora da campanha) ou com a tecla
`K`. Fecha com `Esc`, no ✕ ou clicando fora.

O mestre move o tempo pelos botões (`−1 dia`, `+1 h`, `+8 h` para um descanso longo,
`+3 h` para um toque de sino) ou em **Acertar data…**. O que ele fizer aparece na tela dos
jogadores em poucos segundos.

Cada dia tem um espaço no **diário de campanha**. O mestre escreve, os jogadores leem.

Em **🌀 Dias de Nimb** você abre a carta do Deus do Caos daquele ano: quantos dias avulsos
ele terá (de 2 a 8) e ao fim de qual mês vão cair. Sem definir nada, o app sorteia a partir
do número do ano — sempre igual para o mesmo ano, então a mesa toda vê a mesma coisa.

Atalhos: `K` abre e fecha · `←` `→` trocam de mês · `H` volta para a data atual.

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
servidor.js               servidor HTTP, API e sessão do mestre (Node puro, sem dependências)
railway.json              configuração de deploy
dados/estado.json         o mundo salvo (criado sozinho; não vai para o git)
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
    mapa.js               o mapa, os heróis e as fotos (MapaArton)
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
