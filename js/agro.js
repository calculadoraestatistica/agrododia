/* ==========================================================================
   agro.js — Núcleo de cálculo do Agro do Dia
   Funções puras, sem DOM. Roda no navegador e no Node (para testes).

   Coeficientes baseados em referências técnicas (Embrapa, IAC, Conab,
   universidades). São estimativas — variam com manejo, cultivar, região e
   condições. As calculadoras são orientativas.
   ========================================================================== */
(function (global) {
  'use strict';

  var num = function (x) { return typeof x === 'number' && isFinite(x); };

  function parseData(s) {
    if (typeof s !== 'string') return null;
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return dt;
  }
  function formatarData(dt) {
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return p(dt.getUTCDate()) + '/' + p(dt.getUTCMonth() + 1) + '/' + dt.getUTCFullYear();
  }

  /* ======================================================================
     PECUÁRIA
     ====================================================================== */

  // 1. Taxa de lotação da pastagem — Unidade Animal (1 UA = 450 kg de PV)
  function lotacaoPastagem(o) {
    var n = o.numAnimais, p = o.pesoMedio, a = o.area;
    if (!num(n) || !num(p) || !num(a) || n <= 0 || p <= 0 || a <= 0)
      return { error: 'Informe o número de animais, o peso médio e a área (ha).' };
    var pesoTotal = n * p;
    var ua = pesoTotal / 450;
    return { pesoTotal: pesoTotal, ua: ua, uaPorHa: ua / a };
  }

  // 2. Ganho médio diário (GMD) e previsão de abate
  function ganhoPeso(o) {
    var pi = o.pesoInicial, pf = o.pesoFinal, d = o.dias;
    if (!num(pi) || !num(pf) || !num(d) || pi <= 0 || pf <= 0 || d <= 0)
      return { error: 'Informe o peso inicial, o peso final e o número de dias.' };
    if (pf < pi) return { error: 'O peso final deve ser maior que o peso inicial.' };
    var gmd = (pf - pi) / d;
    var out = { gmd: gmd };
    if (num(o.pesoAbate) && o.pesoAbate > 0) {
      out.diasAteAbate = o.pesoAbate <= pf ? 0 : (o.pesoAbate - pf) / gmd;
    }
    return out;
  }

  // 3. Período de gestação e previsão de parto
  var GESTACAO = { bovino: 285, bufalo: 310, equino: 340, ovino: 150, caprino: 150, suino: 114 };
  function gestacao(o) {
    var dias = GESTACAO[o.especie];
    if (!dias) return { error: 'Selecione a espécie do animal.' };
    var d = parseData(o.dataCobertura);
    if (!d) return { error: 'Informe uma data de cobertura válida.' };
    var parto = new Date(d.getTime() + dias * 86400000);
    return { dias: dias, dataParto: formatarData(parto) };
  }

  // 4. Consumo do rebanho — matéria seca (% do peso vivo) e sal mineral
  function consumoRebanho(o) {
    var n = o.numAnimais, p = o.pesoMedio;
    if (!num(n) || !num(p) || n <= 0 || p <= 0)
      return { error: 'Informe o número de animais e o peso médio.' };
    var pct = o.tipo === 'leite' ? 3.1 : 2.3;       // % do peso vivo em MS
    var msAnimal = p * pct / 100;
    var msDia = msAnimal * n;
    var salAnimal = num(o.salDia) && o.salDia > 0 ? o.salDia : 0.1; // kg/animal/dia
    var salDia = salAnimal * n;
    var out = { pct: pct, consumoMSPorAnimal: msAnimal, consumoMSDia: msDia, salDia: salDia };
    if (num(o.diasEstoque) && o.diasEstoque > 0) {
      out.estoqueMS = msDia * o.diasEstoque;
      out.estoqueSal = salDia * o.diasEstoque;
    }
    return out;
  }

  // 5. Dimensionamento de cocho e bebedouro
  var COCHO = { controlado: 60, avontade: 30, mineral: 5, proteinado: 10 }; // cm/animal
  function cocho(o) {
    var n = o.numAnimais;
    if (!num(n) || n <= 0) return { error: 'Informe o número de animais.' };
    var esp = COCHO[o.manejo];
    if (!esp) return { error: 'Selecione o tipo de manejo do cocho.' };
    return {
      espacoPorAnimal: esp,
      comprimentoCocho: esp * n / 100,        // m
      comprimentoBebedouro: 5 * n / 100       // m (~5 cm/animal)
    };
  }

  /* ======================================================================
     LAVOURA
     ====================================================================== */

  // 6. Conversão de sacas, toneladas e kg
  function conversaoSacas(o) {
    var v = o.quantidade;
    if (!num(v) || v < 0) return { error: 'Informe a quantidade.' };
    var ps = num(o.pesoSaca) && o.pesoSaca > 0 ? o.pesoSaca : 60;
    var emKg;
    if (o.de === 'sacas') emKg = v * ps;
    else if (o.de === 't') emKg = v * 1000;
    else if (o.de === 'kg') emKg = v;
    else return { error: 'Selecione a unidade de origem.' };
    var r;
    if (o.para === 'sacas') r = emKg / ps;
    else if (o.para === 't') r = emKg / 1000;
    else if (o.para === 'kg') r = emKg;
    else return { error: 'Selecione a unidade de destino.' };
    return { resultado: r, emKg: emKg };
  }

  // 7. População de plantas e taxa de semeadura
  function populacaoPlantas(o) {
    var eL = o.espacamentoLinhas;
    if (!num(eL) || eL <= 0) return { error: 'Informe o espaçamento entre linhas (m).' };
    var out = {};
    if (num(o.espacamentoPlantas) && o.espacamentoPlantas > 0)
      out.plantasPorHa = 10000 / (eL * o.espacamentoPlantas);
    if (num(o.populacaoDesejada) && o.populacaoDesejada > 0)
      out.sementesPorMetro = (o.populacaoDesejada * eL) / 10000;
    if (out.plantasPorHa === undefined && out.sementesPorMetro === undefined)
      return { error: 'Informe o espaçamento entre plantas ou a população desejada.' };
    return out;
  }

  // 8. Adubação NPK — converte recomendação técnica em adubo comercial
  function adubacaoNPK(o) {
    var pN = o.pctN, pP = o.pctP, pK = o.pctK;
    if (!num(pN) || !num(pP) || !num(pK))
      return { error: 'Informe a fórmula do adubo (% de N, P₂O₅ e K₂O).' };
    function ad(rec, pct) {
      return (num(rec) && rec > 0 && num(pct) && pct > 0) ? rec / pct * 100 : null;
    }
    var aN = ad(o.recN, pN), aP = ad(o.recP, pP), aK = ad(o.recK, pK);
    var vals = [aN, aP, aK].filter(function (x) { return x !== null; });
    if (!vals.length)
      return { error: 'Informe pelo menos uma recomendação (N, P ou K).' };
    return { aduboN: aN, aduboP: aP, aduboK: aK, aduboLimitante: Math.max.apply(null, vals) };
  }

  // 9. Quantidade de sementes (kg/ha)
  function quantidadeSementes(o) {
    var pop = o.populacaoDesejada, pms = o.pms, germ = o.germinacao;
    if (!num(pop) || !num(pms) || !num(germ) || pop <= 0 || pms <= 0 || germ <= 0 || germ > 100)
      return { error: 'Informe a população desejada, o peso de mil sementes e a germinação (1 a 100%).' };
    var pureza = num(o.pureza) && o.pureza > 0 && o.pureza <= 100 ? o.pureza : 98;
    var vc = germ * pureza / 100;                       // valor cultural (%)
    var sementesPorHa = pop / (vc / 100);
    var margem = num(o.margem) && o.margem >= 0 ? o.margem : 0;
    sementesPorHa *= (1 + margem / 100);
    return { vc: vc, sementesPorHa: sementesPorHa, kgPorHa: sementesPorHa * pms / 1e6 };
  }

  // 10. Necessidade de calagem — método da saturação por bases
  function calagem(o) {
    var v1 = o.v1, v2 = o.v2, ctc = o.ctc, prnt = o.prnt;
    if (!num(v1) || !num(v2) || !num(ctc) || !num(prnt))
      return { error: 'Informe V1, V2, CTC e PRNT.' };
    if (prnt <= 0) return { error: 'O PRNT deve ser maior que zero.' };
    if (ctc <= 0) return { error: 'A CTC deve ser maior que zero.' };
    if (v2 <= v1) return { error: 'A saturação desejada (V2) deve ser maior que a atual (V1).' };
    return { nc: (v2 - v1) * ctc / prnt };              // t/ha
  }

  // 11. Conversão de produtividade
  function produtividade(o) {
    var v = o.valor;
    if (!num(v) || v < 0) return { error: 'Informe o valor da produtividade.' };
    var ps = num(o.pesoSaca) && o.pesoSaca > 0 ? o.pesoSaca : 60;
    var kgHa;
    if (o.de === 'sacas_ha') kgHa = v * ps;
    else if (o.de === 'kg_ha') kgHa = v;
    else if (o.de === 't_ha') kgHa = v * 1000;
    else return { error: 'Selecione a unidade de origem.' };
    var r;
    if (o.para === 'sacas_ha') r = kgHa / ps;
    else if (o.para === 'kg_ha') r = kgHa;
    else if (o.para === 't_ha') r = kgHa / 1000;
    else return { error: 'Selecione a unidade de destino.' };
    return { resultado: r };
  }

  /* ======================================================================
     INSUMOS E ARMAZENAGEM
     ====================================================================== */

  // 12. Calda de pulverização
  function caldaPulverizacao(o) {
    var area = o.area, taxa = o.taxaAplicacao, tanque = o.capacidadeTanque, dose = o.dose;
    if (!num(area) || !num(taxa) || area <= 0 || taxa <= 0)
      return { error: 'Informe a área (ha) e a taxa de aplicação (L/ha).' };
    if (!num(tanque) || tanque <= 0) return { error: 'Informe a capacidade do tanque (L).' };
    if (!num(dose) || dose <= 0) return { error: 'Informe a dose do produto.' };
    var volumeTotal = taxa * area;
    var hectaresPorTanque = tanque / taxa;
    var produtoPorTanque, produtoTotal;
    if (o.doseModo === '100L') {
      produtoPorTanque = tanque / 100 * dose;
      produtoTotal = volumeTotal / 100 * dose;
    } else {
      produtoPorTanque = hectaresPorTanque * dose;
      produtoTotal = dose * area;
    }
    return {
      volumeTotalCalda: volumeTotal,
      numTanques: volumeTotal / tanque,
      hectaresPorTanque: hectaresPorTanque,
      produtoPorTanque: produtoPorTanque,
      produtoTotal: produtoTotal
    };
  }

  // 13. Volume de silagem e dimensionamento de silo
  function silagem(o) {
    var c = o.comprimento, lt = o.larguraTopo, alt = o.altura;
    if (!num(c) || !num(lt) || !num(alt) || c <= 0 || lt <= 0 || alt <= 0)
      return { error: 'Informe o comprimento, a largura e a altura do silo.' };
    var lb = num(o.larguraBase) && o.larguraBase > 0 ? o.larguraBase : lt;
    var dens = num(o.densidade) && o.densidade > 0 ? o.densidade : 600; // kg/m³
    var volume = ((lt + lb) / 2) * alt * c;
    var capacidadeKg = volume * dens;
    return { volume: volume, capacidadeKg: capacidadeKg, capacidadeT: capacidadeKg / 1000 };
  }

  /* ======================================================================
     MEDIDAS E GESTÃO
     ====================================================================== */

  // 14. Conversão de medidas de área rural
  var AREA_M2 = {
    hectare: 10000, metro: 1, are: 100,
    alqueire_paulista: 24200, alqueire_mineiro: 48400,
    alqueire_goiano: 48400, alqueire_baiano: 96800,
    alqueire_norte: 27225, tarefa_ba: 4356
  };
  function conversaoArea(o) {
    var v = o.valor;
    if (!num(v) || v < 0) return { error: 'Informe o valor da área.' };
    var fDe = AREA_M2[o.de], fPara = AREA_M2[o.para];
    if (!fDe || !fPara) return { error: 'Selecione as unidades de origem e destino.' };
    var emM2 = v * fDe;
    return { resultado: emM2 / fPara, emM2: emM2, emHectares: emM2 / 10000 };
  }

  // 15. Custo de produção e ponto de equilíbrio
  function custoProducao(o) {
    var ct = o.custoTotal, prod = o.producao;
    if (!num(ct) || !num(prod) || ct <= 0 || prod <= 0)
      return { error: 'Informe o custo total e a quantidade produzida.' };
    var custoUnitario = ct / prod;
    var out = { custoUnitario: custoUnitario, pontoEquilibrio: custoUnitario };
    if (num(o.precoVenda) && o.precoVenda > 0) {
      out.receita = o.precoVenda * prod;
      out.lucro = out.receita - ct;
      out.margem = out.lucro / out.receita * 100;
    }
    return out;
  }

  /* ----------------------------------------------------------------------
     Exportação
     ---------------------------------------------------------------------- */
  var Agro = {
    lotacaoPastagem: lotacaoPastagem, ganhoPeso: ganhoPeso, gestacao: gestacao,
    consumoRebanho: consumoRebanho, cocho: cocho,
    conversaoSacas: conversaoSacas, populacaoPlantas: populacaoPlantas,
    adubacaoNPK: adubacaoNPK, quantidadeSementes: quantidadeSementes,
    calagem: calagem, produtividade: produtividade,
    caldaPulverizacao: caldaPulverizacao, silagem: silagem,
    conversaoArea: conversaoArea, custoProducao: custoProducao,
    GESTACAO: GESTACAO, AREA_M2: AREA_M2
  };
  global.Agro = Agro;
  if (typeof module !== 'undefined' && module.exports) module.exports = Agro;

})(typeof window !== 'undefined' ? window : globalThis);
