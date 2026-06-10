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
    cafe:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h13a3 3 0 0 1 3 3v0a3 3 0 0 1-3 3h-1"/><path d="M4 8v8a4 4 0 0 0 4 4h5a4 4 0 0 0 4-4V8"/><path d="M8 2v3M12 2v3"/></svg>'
  };

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
      var icon = ICONS[it.icon] || '';
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

  function showError(container) {
    container.innerHTML = ''
      + '<div class="cot-card cot-card--err">'
      + '  <p>Cotações spot indisponíveis no momento. Veja em <a href="https://www.cepea.org.br/" target="_blank" rel="noopener nofollow">cepea.org.br</a>.</p>'
      + '</div>';
  }

  function render(container) {
    container.innerHTML = '<div class="cot-card cot-card--loading">Carregando cotações…</div>';
    fetch('/data/cotacoes.json', { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('http ' + r.status); return r.json(); })
      .then(function (data) {
        if (!data || !data.items || !data.items.length) throw new Error('no items');
        container.innerHTML = buildTable(data);
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
