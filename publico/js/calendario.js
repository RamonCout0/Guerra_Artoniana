/* =============================================================
   CALENDÁRIO ARTONIANO — janela sobreposta

   Abre por cima do mapa (CalendarioJanela.abrir()), pelo botão da
   barra ou pela tecla K. O mapa continua lá atrás.

   O mestre move o tempo da campanha; os jogadores acompanham.
   O relógio da barra do topo é sempre o do mundo real, no fuso de
   quem está olhando — é ele que faz a tela escurecer à noite.
   ============================================================= */

var CalendarioJanela = (function () {
  'use strict';

  var $ = Interface.$, $$ = Interface.$$;
  var esc = Interface.escapar;
  var D = DadosCalendario;
  var C = CalendarioArton;

  /* ---------------- estado ---------------- */

  /* A campanha da Guerra Artoniana abre em 5 de Keenvia de 1410:
     é a data que o golem Ecletos anuncia no Palácio Imperial. */
  function padrao() {
    return {
      versao: 1,
      dataAtual: { ano: 1410, mes: 3, dia: 5, nimb: false, hora: 8, minuto: 0 },
      inicioCampanha: { ano: 1410, mes: 3, dia: 5, nimb: false },
      nimb: {},
      notas: {}
    };
  }

  var estado = padrao();
  var mesVisivel = { ano: 1410, mes: 3 };
  var diaSelecionado = null;
  var janela = null, aberto = false, pronto = false;

  function ehMestre() { return Sincronia.ehMestre(); }

  function salvar() {
    if (!ehMestre()) return;
    estado.nimb = C.exportarNimb();
    Sincronia.salvarCalendario(estado);
  }

  function chaveNota(data) {
    return data.ano + '-' + (data.nimb ? 'N' : data.mes) + '-' + data.dia;
  }

  function ehMesmoDia(a, b) {
    return a && b && a.ano === b.ano && a.dia === b.dia &&
           !!a.nimb === !!b.nimb && (a.nimb || a.mes === b.mes);
  }

  /* ---------------- painel da data corrente ---------------- */

  function renderHoje() {
    var caixa = $('#painel-hoje');
    if (!caixa) return;
    var d = estado.dataAtual;
    var semana = C.diaDaSemana(d);
    var mes = d.nimb ? null : C.mes(d.mes);
    var estacao = mes ? D.ESTACOES[mes.estacao] : null;
    var vela = C.velaDaNoite(d.hora, Tema.obterConfig().nascer, Tema.obterConfig().ocaso);
    var fase = C.faseDoDia(d.hora, Tema.obterConfig().nascer, Tema.obterConfig().ocaso);
    var sino = C.proximoSino(d.hora, d.minuto);

    var FASES = { amanhecer: '🌅 Amanhecer', dia: '☀️ Dia claro',
                  anoitecer: '🌆 Anoitecer', noite: '🌙 Noite' };

    caixa.innerHTML = '' +
      '<div class="selo">Data da campanha</div>' +
      '<div class="dia-semana">' + esc(semana.nome) +
        (semana.nota ? ' · ' + esc(semana.nota.toLowerCase()) : '') + '</div>' +
      '<div class="data-grande">' + esc(C.formatarColoquial(d)) + '</div>' +
      '<div class="data-culta">“' + esc(C.formatarCulta(d)) + '”</div>' +
      '<div class="relogio-arton">' + esc(C.formatarHora(d)) + '</div>' +
      '<div class="detalhe-hora">' +
        '<span>' + FASES[fase] + '</span>' +
        (vela ? '<span>🕯️ ' + esc(vela.nome) + '</span>' : '') +
        '<span>🔔 sino em ' + sino.faltamMinutos + ' min</span>' +
      '</div>' +
      (estacao
        ? '<div class="estacao">' + estacao.icone + ' ' + esc(mes.estacao) +
          ' · mês de ' + esc(mes.nome) + '</div>'
        : '<div class="estacao">🌀 Fora dos meses — os Dias de Nimb</div>');
  }

  function renderControles() {
    var caixa = $('#controles-tempo');
    if (!caixa) return;
    if (!ehMestre()) { caixa.innerHTML = ''; return; }

    var nimb = C.nimbDoAno(estado.dataAtual.ano);

    caixa.innerHTML = '' +
      '<div class="painel-titulo" style="padding:0 0 8px">Mover o tempo</div>' +
      '<div class="passos">' +
        '<button class="botao" data-avancar="-24">−1 dia</button>' +
        '<button class="botao" data-avancar="-1">−1 h</button>' +
        '<button class="botao" data-avancar="1">+1 h</button>' +
        '<button class="botao" data-avancar="24">+1 dia</button>' +
      '</div>' +
      '<div class="passos">' +
        '<button class="botao" data-avancar="3" title="Um toque de sino">+3 h</button>' +
        '<button class="botao" data-avancar="8" title="Descanso longo">+8 h</button>' +
        '<button class="botao" data-avancar="168">+1 semana</button>' +
        '<button class="botao" data-avancar="720">+1 mês</button>' +
      '</div>' +
      '<div class="grupo-botoes" style="margin-top:8px">' +
        '<button class="botao primario" id="abrir-data">Acertar data…</button>' +
        '<button class="botao" id="abrir-nimb">🌀 Dias de Nimb</button>' +
      '</div>' +
      '<div class="grupo-botoes" style="margin-top:6px">' +
        '<button class="botao pequeno" id="marcar-inicio">⚔️ Marcar como início da campanha</button>' +
      '</div>' +
      '<p class="discreto" style="margin:9px 0 0">' +
        'Em ' + esc(C.rotuloAno(estado.dataAtual.ano)) + ' o Caos manda ' + nimb.quantidade +
        ' dias de Nimb ao fim de ' + esc(C.mes(nimb.aposMes).nome) +
        (nimb.manual ? ' (definido por você).' : ' (sorteado).') +
      '</p>';

    $$('[data-avancar]', caixa).forEach(function (botao) {
      botao.addEventListener('click', function () {
        var horas = parseInt(botao.getAttribute('data-avancar'), 10);
        estado.dataAtual = C.somarHoras(estado.dataAtual, horas);
        mesVisivel = { ano: estado.dataAtual.ano, mes: estado.dataAtual.mes };
        diaSelecionado = null;
        salvar();
        renderTudo();
      });
    });

    var abrirData = $('#abrir-data', caixa);
    if (abrirData) abrirData.addEventListener('click', abrirModalData);

    var abrirNimb = $('#abrir-nimb', caixa);
    if (abrirNimb) abrirNimb.addEventListener('click', abrirModalNimb);

    var marcar = $('#marcar-inicio', caixa);
    if (marcar) {
      marcar.addEventListener('click', function () {
        var d = estado.dataAtual;
        estado.inicioCampanha = { ano: d.ano, mes: d.mes, dia: d.dia, nimb: !!d.nimb };
        salvar();
        renderTudo();
        Interface.avisar('Início da campanha marcado em ' + C.formatarColoquial(d) + '.');
      });
    }
  }

  /* ---------------- relógio real ---------------- */

  function renderRelogioReal() {
    var caixa = $('#relogio-real');
    if (!caixa) return;
    var agora = new Date();
    var e = Tema.estado();
    var fuso = Intl.DateTimeFormat().resolvedOptions().timeZone || 'fuso local';

    caixa.innerHTML = '' +
      '<span class="agora">' +
        agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) +
      '</span>' +
      agora.toLocaleDateString('pt-BR', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
      }) + '<br>' +
      '<span class="discreto">Mundo real · ' + esc(fuso) + ' · ' + esc(e.rotulo.toLowerCase()) +
      (e.modo === 'auto' ? '' : ' (fixo)') + '</span>';
  }

  /* ---------------- lista de meses ---------------- */

  function renderMeses() {
    var caixa = $('#lista-meses');
    if (!caixa) return;
    caixa.textContent = '';

    D.MESES.forEach(function (mes) {
      var linha = document.createElement('div');
      linha.className = 'item-mes' + (mesVisivel.mes === mes.numero ? ' ativo' : '');
      linha.innerHTML =
        '<span class="indice">' + mes.numero + '</span>' +
        '<span>' + esc(mes.nome) + '</span>' +
        '<span class="est">' + D.ESTACOES[mes.estacao].icone + '</span>';
      linha.title = mes.significado;
      linha.addEventListener('click', function () {
        mesVisivel.mes = mes.numero;
        diaSelecionado = null;
        renderGrade();
        renderMeses();
        renderDetalhe();
      });
      caixa.appendChild(linha);
    });
  }

  /* ---------------- grade do mês ---------------- */

  function renderCabecalhoSemana() {
    var caixa = $('#nomes-dias');
    if (!caixa) return;
    caixa.textContent = '';
    D.DIAS_SEMANA.forEach(function (dia) {
      var celula = document.createElement('div');
      celula.className = 'nome-dia' +
        (dia.nome === 'Haya' ? ' festa' : '') +
        (dia.nome === 'Leen' ? ' descanso' : '');
      celula.textContent = dia.nome;
      celula.title = dia.deus + (dia.nota ? ' — ' + dia.nota : '');
      caixa.appendChild(celula);
    });
  }

  function renderGrade() {
    var grade = $('#grade-dias');
    if (!grade) return;
    grade.textContent = '';

    var mes = C.mes(mesVisivel.mes);
    var estacao = D.ESTACOES[mes.estacao];

    $('#titulo-mes').textContent = mes.nome;
    $('#titulo-ano').textContent = estacao.icone + ' ' + mes.estacao +
      ' · ' + C.rotuloAno(mesVisivel.ano);
    $('#legenda-mes').textContent = mes.significado;

    var primeiro = { ano: mesVisivel.ano, mes: mesVisivel.mes, dia: 1, nimb: false };
    var deslocamento = C.indiceDiaSemana(primeiro);

    for (var v = 0; v < deslocamento; v++) {
      var vazio = document.createElement('div');
      vazio.className = 'dia vazio';
      grade.appendChild(vazio);
    }

    for (var d = 1; d <= D.DIAS_POR_MES; d++) {
      grade.appendChild(celulaDia({
        ano: mesVisivel.ano, mes: mesVisivel.mes, dia: d, nimb: false
      }));
    }

    // Os Dias de Nimb aparecem depois do mês em que caem
    var nimb = C.nimbDoAno(mesVisivel.ano);
    if (nimb.aposMes === mesVisivel.mes) {
      for (var k = 1; k <= nimb.quantidade; k++) {
        grade.appendChild(celulaDia({
          ano: mesVisivel.ano, mes: mesVisivel.mes, dia: k, nimb: true
        }));
      }
    }
  }

  function celulaDia(data) {
    var celula = document.createElement('div');
    var eventos = C.eventosDoDia(data);
    var nota = estado.notas[chaveNota(data)];

    celula.className = 'dia' +
      (data.nimb ? ' nimb' : '') +
      (ehMesmoDia(data, estado.dataAtual) ? ' hoje-marcado' : '') +
      (ehMesmoDia(data, estado.inicioCampanha) ? ' inicio-campanha' : '') +
      (diaSelecionado && ehMesmoDia(data, diaSelecionado) ? ' selecionado' : '');

    var numero = document.createElement('div');
    numero.className = 'numero';
    numero.textContent = data.nimb ? '🌀' + data.dia : data.dia;
    celula.appendChild(numero);

    var fitas = document.createElement('div');
    fitas.className = 'fitas';
    eventos.slice(0, 2).forEach(function (e) {
      var fita = document.createElement('div');
      fita.className = 'fita ' + (e.tipo || 'evento');
      fita.textContent = e.nome + (e.diaDoEvento ? ' (' + e.diaDoEvento + '/' + e.duracao + ')' : '');
      fita.title = e.nome;
      fitas.appendChild(fita);
    });
    if (nota && eventos.length < 2) {
      var fitaNota = document.createElement('div');
      fitaNota.className = 'fita nota';
      fitaNota.textContent = nota.split('\n')[0];
      fitas.appendChild(fitaNota);
    }
    celula.appendChild(fitas);

    if (nota) {
      var marca = document.createElement('span');
      marca.className = 'marca-nota';
      celula.appendChild(marca);
    }

    celula.title = C.formatarCulta(data);
    celula.addEventListener('click', function () {
      diaSelecionado = data;
      renderGrade();
      renderDetalhe();
    });

    return celula;
  }

  /* ---------------- detalhe do dia ---------------- */

  function renderDetalhe() {
    var caixa = $('#detalhe-dia');
    if (!caixa) return;

    var data = diaSelecionado || estado.dataAtual;
    var semana = C.diaDaSemana(data);
    var eventos = C.eventosDoDia(data);
    var chave = chaveNota(data);
    var nota = estado.notas[chave] || '';

    var html = '' +
      '<h3>' + esc(C.formatarColoquial(data)) + '</h3>' +
      '<div class="culta">' + esc(semana.nome) + ' — ' + esc(semana.deus) +
        (semana.nota ? ' · ' + esc(semana.nota) : '') + '<br>' +
        esc(C.formatarNumerica(data)) + '</div>';

    if (ehMesmoDia(data, estado.dataAtual)) {
      html += '<div class="evento tipo-evento" style="margin-top:12px">' +
        '<h5>⏳ É agora</h5><p>Este é o dia em que a campanha se encontra, ' +
        'às ' + esc(C.formatarHora(estado.dataAtual)) + '.</p></div>';
    }
    if (ehMesmoDia(data, estado.inicioCampanha)) {
      html += '<div class="evento"><h5>⚔️ Início da campanha</h5>' +
        '<p>Foi daqui que tudo começou.</p></div>';
    }

    eventos.forEach(function (e) {
      html += '<div class="evento tipo-' + esc(e.tipo || 'evento') + '">' +
        '<h5>' + esc(e.nome) +
        (e.diaDoEvento ? ' <span class="discreto">(dia ' + e.diaDoEvento +
          ' de ' + e.duracao + ')</span>' : '') + '</h5>' +
        '<p>' + esc(e.descricao) + '</p></div>';
    });

    if (!data.nimb) {
      var mes = C.mes(data.mes);
      html += '<div class="secao" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--borda)">' +
        '<h4 style="font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--tinta-fraca);margin-bottom:7px">' +
        'Sobre o mês de ' + esc(mes.nome) + '</h4>' +
        '<p style="font-size:12.5px;line-height:1.6;color:var(--tinta-suave);margin:0">' +
        esc(mes.significado) + '</p></div>';
    }

    html += '<div class="anotacao" style="margin-top:16px">' +
      '<div class="painel-titulo" style="padding:0 0 6px">Diário de campanha</div>';

    if (ehMestre()) {
      html += '<textarea id="campo-nota" placeholder="O que aconteceu neste dia…">' +
        esc(nota) + '</textarea>' +
        '<div class="discreto" style="margin-top:5px">Salva sozinho. Os jogadores leem o que você escrever aqui.</div>';
    } else if (nota) {
      html += '<div class="texto-notas" style="white-space:pre-wrap;font-size:13px;line-height:1.6;color:var(--tinta-suave)">' +
        esc(nota) + '</div>';
    } else {
      html += '<div class="aviso-leitura">Nada anotado neste dia ainda.</div>';
    }
    html += '</div>';

    caixa.innerHTML = html;

    var campo = $('#campo-nota', caixa);
    if (campo) {
      var atraso = null;
      campo.addEventListener('input', function () {
        if (atraso) clearTimeout(atraso);
        atraso = setTimeout(function () {
          var texto = campo.value.trim();
          if (texto) estado.notas[chave] = texto;
          else delete estado.notas[chave];
          salvar();
          renderGrade();
        }, 500);
      });
    }
  }

  /* ---------------- modais ---------------- */

  function preencherSelecaoDeMeses(seletor) {
    var el = $(seletor);
    if (!el) return;
    el.innerHTML = D.MESES.map(function (m) {
      return '<option value="' + m.numero + '">' + m.numero + ' · ' + esc(m.nome) + '</option>';
    }).join('');
  }

  function abrirModalData() {
    var d = estado.dataAtual;
    $('#data-dia').value = d.dia;
    $('#data-mes').value = d.mes;
    $('#data-ano').value = d.ano;
    $('#data-nimb').checked = !!d.nimb;
    $('#data-hora').value = d.hora || 0;
    $('#data-minuto').value = d.minuto || 0;
    $('#erro-data').textContent = '';
    Interface.abrirModal('modal-data');
  }

  function confirmarData() {
    var erro = $('#erro-data');
    var ano = parseInt($('#data-ano').value, 10);
    var mes = parseInt($('#data-mes').value, 10);
    var dia = parseInt($('#data-dia').value, 10);
    var ehNimb = $('#data-nimb').checked;
    var hora = parseInt($('#data-hora').value, 10) || 0;
    var minuto = parseInt($('#data-minuto').value, 10) || 0;

    if (isNaN(ano) || isNaN(mes) || isNaN(dia)) {
      erro.textContent = 'Preencha dia, mês e ano.';
      return;
    }
    if (ehNimb) {
      var nimb = C.nimbDoAno(ano);
      if (dia < 1 || dia > nimb.quantidade) {
        erro.textContent = 'Em ' + C.rotuloAno(ano) + ' há apenas ' + nimb.quantidade +
          ' dias de Nimb.';
        return;
      }
      mes = nimb.aposMes;
    } else if (dia < 1 || dia > 30) {
      erro.textContent = 'Os meses artonianos têm 30 dias.';
      return;
    }

    estado.dataAtual = {
      ano: ano, mes: mes, dia: dia, nimb: ehNimb,
      hora: Math.max(0, Math.min(23, hora)),
      minuto: Math.max(0, Math.min(59, minuto))
    };
    mesVisivel = { ano: ano, mes: mes };
    diaSelecionado = null;
    salvar();
    Interface.fecharModal('modal-data');
    renderTudo();
    Interface.avisar('A campanha agora se passa em ' + C.formatarColoquial(estado.dataAtual) + '.');
  }

  function abrirModalNimb() {
    var ano = mesVisivel.ano;
    var nimb = C.nimbDoAno(ano);
    $('#nimb-ano').value = ano;
    $('#nimb-quantidade').value = nimb.quantidade;
    $('#nimb-mes').value = nimb.aposMes;
    $('#nimb-atual').textContent = nimb.manual
      ? 'Você já definiu este ano manualmente.'
      : 'Valores sorteados a partir do número do ano. Mudar aqui fixa a carta do Caos.';
    Interface.abrirModal('modal-nimb');
  }

  function confirmarNimb() {
    var ano = parseInt($('#nimb-ano').value, 10);
    var quantidade = parseInt($('#nimb-quantidade').value, 10);
    var mes = parseInt($('#nimb-mes').value, 10);
    if (isNaN(ano)) return;
    C.definirNimb(ano, quantidade, mes);
    salvar();
    Interface.fecharModal('modal-nimb');
    renderTudo();
    Interface.avisar('A carta do Caos foi reescrita para ' + C.rotuloAno(ano) + '.');
  }

  function sortearNimb() {
    var ano = parseInt($('#nimb-ano').value, 10);
    if (isNaN(ano)) return;
    C.definirNimb(ano, null);
    salvar();
    Interface.fecharModal('modal-nimb');
    renderTudo();
    Interface.avisar('Os Dias de Nimb de ' + C.rotuloAno(ano) + ' voltaram às mãos do Caos.');
  }

  /* ---------------- dados ---------------- */

  function adotar(remoto) {
    if (!remoto || !remoto.dataAtual) return false;
    estado = {
      versao: remoto.versao || 1,
      dataAtual: remoto.dataAtual,
      inicioCampanha: remoto.inicioCampanha || padrao().inicioCampanha,
      nimb: remoto.nimb || {},
      notas: remoto.notas || {}
    };
    C.carregarNimb(estado.nimb);
    return true;
  }

  /* ---------------- render geral ---------------- */

  function renderResumoNaBarra() {
    var alvo = $('#resumo-data');
    if (alvo) alvo.textContent = C.formatarColoquial(estado.dataAtual) +
                                 ' · ' + C.formatarHora(estado.dataAtual);
  }

  function renderTudo() {
    renderResumoNaBarra();
    renderHoje();
    renderControles();
    renderMeses();
    renderGrade();
    renderDetalhe();
    renderRelogioReal();
  }

  /* ---------------- início ---------------- */

  /* ---------------- abrir e fechar ---------------- */

  function abrir() {
    if (!janela) return;
    aberto = true;
    janela.classList.add('aberta');
    renderTudo();
  }

  function fechar() {
    if (!janela) return;
    aberto = false;
    janela.classList.remove('aberta');
  }

  function alternar() { aberto ? fechar() : abrir(); }

  /* ---------------- início ---------------- */

  function preparar() {
    if (pronto) return;
    pronto = true;

    janela = $('#janela-calendario');
    preencherSelecaoDeMeses('#data-mes');
    preencherSelecaoDeMeses('#nimb-mes');
    renderCabecalhoSemana();

    $('#fechar-calendario').addEventListener('click', fechar);
    janela.addEventListener('mousedown', function (e) { if (e.target === janela) fechar(); });

    $('#mes-anterior').addEventListener('click', function () {
      mesVisivel.mes--;
      if (mesVisivel.mes < 1) { mesVisivel.mes = 12; mesVisivel.ano--; }
      diaSelecionado = null;
      renderGrade(); renderMeses(); renderDetalhe();
    });

    $('#mes-seguinte').addEventListener('click', function () {
      mesVisivel.mes++;
      if (mesVisivel.mes > 12) { mesVisivel.mes = 1; mesVisivel.ano++; }
      diaSelecionado = null;
      renderGrade(); renderMeses(); renderDetalhe();
    });

    $('#ir-para-hoje').addEventListener('click', function () {
      mesVisivel = { ano: estado.dataAtual.ano, mes: estado.dataAtual.mes };
      diaSelecionado = null;
      renderGrade(); renderMeses(); renderDetalhe();
    });

    $('#confirmar-data').addEventListener('click', confirmarData);
    $('#cancelar-data').addEventListener('click', function () { Interface.fecharModal('modal-data'); });
    $('#confirmar-nimb').addEventListener('click', confirmarNimb);
    $('#nimb-sortear').addEventListener('click', sortearNimb);

    document.addEventListener('keydown', function (e) {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ($$('.fundo-modal').some(function (m) { return !m.hidden; })) return;

      if (e.key.toLowerCase() === 'k') { alternar(); return; }
      if (!aberto) return;
      if (e.key === 'Escape') fechar();
      else if (e.key === 'ArrowLeft') $('#mes-anterior').click();
      else if (e.key === 'ArrowRight') $('#mes-seguinte').click();
      else if (e.key.toLowerCase() === 'h') $('#ir-para-hoje').click();
    });

    if (!adotar(Sincronia.dadosCalendario())) {
      estado = padrao();
      C.carregarNimb(estado.nimb);
    }
    mesVisivel = { ano: estado.dataAtual.ano, mes: estado.dataAtual.mes };
    renderTudo();

    Sincronia.aoMudar('calendario', function (remoto) {
      if (adotar(remoto)) {
        renderTudo();
        if (aberto) Interface.avisar('O mestre moveu o tempo.');
      }
    });

    Interface.quandoPapelMudar(function () { renderControles(); renderDetalhe(); });

    Tema.aoMudar(function () { renderHoje(); renderRelogioReal(); });
    setInterval(renderRelogioReal, 1000);
  }

  return {
    preparar: preparar,
    abrir: abrir,
    fechar: fechar,
    alternar: alternar,
    estaAberto: function () { return aberto; }
  };
})();
