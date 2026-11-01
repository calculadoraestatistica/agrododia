/* agrododia.com.br — carrega os widgets da TradingView só depois do clique.
 *
 * Por quê: o widget vem de s3.tradingview.com e define cookies próprios. Antes
 * deste arquivo o script ficava direto no HTML e era buscado em toda visita,
 * independente do que o visitante respondesse no banner de consentimento. O
 * banner só escrevia em localStorage e chamava gtag, então não bloqueava nada.
 * O botão de recusar prometia um controle que não existia.
 *
 * Agora a configuração mora num <script type="application/json">, que o
 * navegador não busca nem executa. O script de verdade só é criado quando o
 * visitante clica. O consentimento passa a existir onde o dado é buscado, e
 * não num banner em outro canto da página.
 *
 * O custo para quem visita é pequeno: a tabela de cotações é o dado do próprio
 * site e aparece na hora. Só o gráfico espera o clique.
 *
 * A escolha fica guardada neste navegador, para quem já clicou uma vez não ter
 * de clicar de novo. A chave só é lida e escrita aqui e não vai a lugar nenhum.
 */
(function () {
  'use strict';

  var CHAVE = 'tv-consentimento';

  function jaAceitou() {
    try {
      return localStorage.getItem(CHAVE) === 'sim';
    } catch (_) {
      return false;                 /* janela privada, armazenamento bloqueado */
    }
  }

  function guardar() {
    try {
      localStorage.setItem(CHAVE, 'sim');
    } catch (_) { /* não vale falhar por isso */ }
  }

  function carregar(caixa) {
    if (caixa.getAttribute('data-tv-carregado')) return;
    var cfg = caixa.querySelector('script.tv-config');
    if (!cfg) return;
    var url = cfg.getAttribute('data-tv-src');
    if (!url) return;
    caixa.setAttribute('data-tv-carregado', '1');

    var porta = caixa.querySelector('.tv-gate');
    if (porta) porta.hidden = true;

    /* O carregador da TradingView procura o próprio <script> no DOM e lê a
       configuração do texto dele, e depois se remove. Por isso o script novo
       precisa ter src E o mesmo texto, e precisa ficar na mesma caixa. */
    var s = document.createElement('script');
    s.type = 'text/javascript';
    s.async = true;
    s.src = url;
    s.text = cfg.textContent;
    caixa.appendChild(s);
  }

  function iniciar() {
    var caixas = document.querySelectorAll('.tradingview-widget-container');
    for (var i = 0; i < caixas.length; i++) {
      (function (caixa) {
        var botao = caixa.querySelector('.tv-gate__knap');
        if (botao) {
          botao.addEventListener('click', function () {
            guardar();
            /* todas as caixas da página, para não precisar clicar três vezes */
            var todas = document.querySelectorAll('.tradingview-widget-container');
            for (var j = 0; j < todas.length; j++) carregar(todas[j]);
          });
        }
        if (jaAceitou()) carregar(caixa);
      }(caixas[i]));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
}());
