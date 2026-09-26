/* Cotações spot CEPEA — renderiza tabela a partir de /data/cotacoes.json
 * Mostra: produto, valor (R$), unidade, data, com "Atualizado: HH:MM" no rodapé.
 * Auto-detecta containers com data-cotacoes-cepea e renderiza tabela compacta.
 *
 * Uso no HTML:
 *   <div data-cotacoes-cepea></div>
 */
(function () {
  'use strict';

  var ICONS = {
    boi:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12c0-1.7.6-3.2 1.7-4.3M21 12c0-1.7-.6-3.2-1.7-4.3M5 8c0-3 3-5 7-5s7 2 7 5"/><circle cx="9" cy="13" r="1"/><circle cx="15" cy="13" r="1"/><path d="M9 18c0 1 .9 2 2 2h2c1.1 0 2-1 2-2"/></svg>',
    soja:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="3"/><circle cx="16" cy="12" r="3"/><circle cx="9" cy="17" r="3"/></svg>',
    milho:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c-2 0-3 1.5-3 3 0 1 .3 2 .8 3-.5 1-.8 2-.8 3 0 1.5 1 3 3 3s3-1.5 3-3c0-1-.3-2-.8-3 .5-1 .8-2 .8-3 0-1.5-1-3-3-3z"/><path d="M9 20l3-3 3 3"/></svg>',
    cafe:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-1"/><path d="M4 8v8a4 4 0 0 0 4 4h5a4 4 0 0 0 4-4V8"/><path d="M8 2v3M12 2v3"/></svg>',
  // Ícones acrescentados: antes só boi, soja, milho e café tinham; os outros
  // dezoito produtos apareciam com um quadrado vazio ao lado do nome.
bezerro:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M6 10c0-2.2 2.7-4 6-4s6 1.8 6 4"/><path d="M6 10c-1.1 0-2-.9-2-2"/><path d="M18 10c1.1 0 2-.9 2-2"/>' +
    '<circle cx="10" cy="13" r=".9"/><circle cx="14" cy="13" r=".9"/>' +
    '<path d="M10 17.5c.6.5 1.3.8 2 .8s1.4-.3 2-.8"/></svg>',

  trigo:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 21V9"/><path d="M12 9c0-2 1.4-3.6 3-4-.2 2.2-1.3 3.6-3 4z"/>' +
    '<path d="M12 9c0-2-1.4-3.6-3-4 .2 2.2 1.3 3.6 3 4z"/>' +
    '<path d="M12 14c0-2 1.4-3.6 3-4-.2 2.2-1.3 3.6-3 4z"/>' +
    '<path d="M12 14c0-2-1.4-3.6-3-4 .2 2.2 1.3 3.6 3 4z"/></svg>',

  cafe_robusta:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<ellipse cx="12" cy="12" rx="5" ry="8" transform="rotate(35 12 12)"/>' +
    '<path d="M8.6 15.4c1.6-1.2 5.2-4.6 6.8-6.8"/></svg>',

  arroz:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<ellipse cx="8" cy="8" rx="2" ry="3.4" transform="rotate(-28 8 8)"/>' +
    '<ellipse cx="15" cy="11" rx="2" ry="3.4" transform="rotate(22 15 11)"/>' +
    '<ellipse cx="9.5" cy="16" rx="2" ry="3.4" transform="rotate(12 9.5 16)"/></svg>',

  acucar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M4 9.5 9.5 6l10.5 3.5-5.5 3.5z"/><path d="M4 9.5V16l10.5 3.5V13"/>' +
    '<path d="M20 9.5V16l-5.5 3.5"/></svg>',

  etanol:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M10 3h4"/><path d="M11 3v5.2L6.6 17a2.5 2.5 0 0 0 2.2 3.7h6.4a2.5 2.5 0 0 0 2.2-3.7L13 8.2V3"/>' +
    '<path d="M8.2 14h7.6"/></svg>',

  };

  // Fallback pelo slug: o JSON só ganha o campo `icon` no próximo scrape, e
  // não faz sentido esperar por isso para mostrar o ícone certo.
  var POR_SLUG = [
    [/^boi/, 'boi'], [/^bezerro/, 'bezerro'], [/^soja/, 'soja'], [/^milho/, 'milho'],
    [/^trigo/, 'trigo'], [/^cafe-arabica|^caf-arabica/, 'cafe'], [/^caf.?-?robusta/, 'cafe_robusta'],
    [/^arroz/, 'arroz'], [/^a-?car|^acucar/, 'acucar'], [/^etanol/, 'etanol'],
  ];

  function iconePara(it) {
    if (it.icon && ICONS[it.icon]) return ICONS[it.icon];
    var slug = it.slug || '';
    for (var i = 0; i < POR_SLUG.length; i++) {
      if (POR_SLUG[i][0].test(slug)) return ICONS[POR_SLUG[i][1]] || '';
    }
    return ICONS.etanol ? '' : '';
  }

  var _FIM_ICONES = true;


  function formatRelative(updatedAt) {
    if (!updatedAt) return '';
    try {
      var d = new Date(updatedAt);
      var hh = String(d.getHours()).padStart(2, '0');
      var mm = String(d.getMinutes()).padStart(2, '0');
      var dd = String(d.getDate()).padStart(2, '0');
      var mo = String(d.getMonth() + 1).padStart(2, '0');
      return dd + '/' + mo + ' às ' + hh + ':' + mm;
    } catch (e) {
      return updatedAt;
    }
  }

  function formatDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
    return iso;
  }

  function buildTable(data) {
    var rows = (data.items || []).map(function (it) {
      var icon = iconePara(it);
      return ''
        + '<tr>'
        + '  <td class="cot-cell-prod">'
        + '    <span class="cot-icon" aria-hidden="true">' + icon + '</span>'
        + '    <span><strong>' + it.name + '</strong><br><span class="cot-unit">' + it.unit + '</span></span>'
        + '  </td>'
        + '  <td class="cot-cell-val">' + it.value_display + '</td>'
        + '  <td class="cot-cell-date">' + formatDate(it.date) + '</td>'
        + '</tr>';
    }).join('');

    return ''
      + '<div class="cot-card">'
      + '  <table class="cot-table" aria-label="Cotações spot CEPEA">'
      + '    <thead><tr>'
      + '      <th>Produto</th><th>Preço</th><th>Data</th>'
      + '    </tr></thead>'
      + '    <tbody>' + rows + '</tbody>'
      + '  </table>'
      + '  <div class="cot-footer">'
      + '    <span>Atualizado: <strong>' + formatRelative(data.updated_at) + '</strong></span>'
      + '    <span>Fonte: <a href="' + (data.source_url || 'https://www.cepea.org.br/') + '" target="_blank" rel="noopener nofollow">' + (data.source || 'CEPEA/Esalq') + '</a></span>'
      + '  </div>'
      + '</div>';
  }

  /* ── Gráfico ligado à tabela ────────────────────────────────────────────
     Cada linha vira alvo de clique e de teclado; o gráfico lê o mesmo
     histórico diário que o robô salva, então acompanha a atualização
     sozinho (era um mp4, que congelava no dia do render). */
  function ligarGrafico(container, data) {
    var alvo = document.querySelector('[data-cot-chart]');
    if (!alvo || !window.CotChart) return;
    if (!alvo.getAttribute('data-montado')) {
      window.CotChart.montar(alvo, {
        historico: '/data/cotacoes-historico.json', locale: 'pt-BR', textos: {semana:'7 dias',mes:'30 dias',periodo:'Período do gráfico',carregando:'Carregando o histórico…',escolha:'Toque num produto da tabela para ver a série dele.',semDados:'Ainda não há histórico suficiente para este produto.',em7:'em 7 dias',em30:'em 30 dias',dica:'Toque em qualquer linha da tabela para trocar o produto do gráfico.',ariaGrafico:'série de {n} dias'}
      });
      alvo.setAttribute('data-montado', '1');
    }
    var itens = data.items || [];
    var linhas = container.querySelectorAll('.cot-table tbody tr');
    var primeiro = null;
    Array.prototype.forEach.call(linhas, function (tr, i) {
      var it = itens[i];
      if (!it) return;
      var chave = it.slug || '';
      if (!chave) return;
      tr.setAttribute('data-slug', chave);
      tr.setAttribute('tabindex', '0');
      tr.setAttribute('role', 'button');
      var nome = it.name || it.label || chave;
      tr.setAttribute('aria-label', nome);
      if (!primeiro) primeiro = { chave: chave, nome: nome, un: it.unit || '' };
      function abrir() {
        Array.prototype.forEach.call(linhas, function (o) { o.removeAttribute('aria-selected'); });
        tr.setAttribute('aria-selected', 'true');
        window.CotChart.mostrar(chave, nome, it.unit || '');
      }
      tr.addEventListener('click', abrir);
      tr.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); }
      });
    });
    // Abre já no primeiro produto: gráfico vazio na carga não ajuda ninguém.
    if (primeiro) {
      var tr0 = container.querySelector('.cot-table tbody tr[data-slug]');
      if (tr0) tr0.setAttribute('aria-selected', 'true');
      window.CotChart.mostrar(primeiro.chave, primeiro.nome, primeiro.un);
    }
  }

  function showError(container) {
    container.innerHTML = ''
      + '<div class="cot-card cot-card--err">'
      + '  <p>Cotações spot indisponíveis no momento. Veja em <a href="https://www.cepea.org.br/" target="_blank" rel="noopener nofollow">cepea.org.br</a>.</p>'
      + '</div>';
  }

  function render(container) {
    container.innerHTML = '<div class="cot-card cot-card--loading">Carregando cotações…</div>';
    var variant = container.getAttribute('data-cotacoes-cepea') || '';
    var url = variant === 'completas' ? '/data/cotacoes-completas.json' : '/data/cotacoes.json';
    fetch(url, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (data) {
        if (!data || !data.items || !data.items.length) throw new Error('no items');
        container.innerHTML = buildTable(data);
      ligarGrafico(container, data);
      })
      .catch(function () { showError(container); });
  }

  function init() {
    var containers = document.querySelectorAll('[data-cotacoes-cepea]');
    containers.forEach(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
