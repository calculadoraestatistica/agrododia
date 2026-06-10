"""
Scraper CEPEA/Esalq - baixa indicadores spot do widget oficial e salva em:
  data/cotacoes.json            (set basico — 4 indicadores p/ hero da home)
  data/cotacoes-completas.json  (set ampliado — 27 indicadores p/ pagina cotacoes.html)

Roda via GH Actions de 30 em 30min, 8h-19h BRT dias uteis.

Sets de indicadores:
  basico (4):  2 (Boi Gordo), 12 (Soja PR), 77 (Milho), 23 (Cafe Arabica)
  completo (27): conjunto historico do widget original — boi gordo SP/SE,
                 leite, suino, algodao, etanol, trigo, arroz, etc.
"""
import argparse, json, re, sys
import urllib.request as u
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Sets de indicadores CEPEA
SET_BASICO = ["2", "12", "77", "23"]
SET_COMPLETO = [
    "2","8","3","12","77","178","179","23","24","leitep","91","54","50",
    "149","35","53","308","208","75","211","101","104","209","119","76","100","103"
]

# Mapa para meta enriquecida no JSON final
META = {
    "Boi Gordo": {"slug": "boi-gordo", "icon": "boi"},
    "Soja - PR": {"slug": "soja-pr", "icon": "soja"},
    "Milho": {"slug": "milho", "icon": "milho"},
    "Cafe Arabica": {"slug": "cafe-arabica", "icon": "cafe"},
    "Café Arábica": {"slug": "cafe-arabica", "icon": "cafe"},
}

def widget_url(ids):
    base = (
        "https://www.cepea.org.br/br/widgetproduto.js.php"
        "?fonte=arial&tamanho=12&largura=680px"
        "&corfundo=ffffff&cortexto=0f172a&corlinha=f1f5f9"
    )
    return base + "".join(f"&id_indicador%5B%5D={i}" for i in ids)

def fetch_widget(ids):
    req = u.Request(widget_url(ids), headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        "Referer": "https://agrododia.com.br/",
    })
    with u.urlopen(req, timeout=20) as r:
        return r.read().decode("utf-8")

def parse_rows(body):
    """Extrai linhas (data, produto, valor) do document.write retornado."""
    m = re.search(r"document\.write\(`(.+)`\)", body, re.DOTALL)
    if not m:
        raise RuntimeError("document.write nao encontrado")
    html = m.group(1)

    rows_html = re.findall(r"<tr[^>]*>(.+?)</tr>", html, re.DOTALL)
    items = []
    for row in rows_html:
        cells = re.findall(r"<t[hd][^>]*>(.+?)</t[hd]>", row, re.DOTALL)
        clean = []
        for c in cells:
            c = re.sub(r"<br\s*/?>", "|", c)
            c = re.sub(r"<[^>]+>", "", c)
            c = c.replace("&nbsp;", " ").replace("&amp;", "&").strip()
            c = re.sub(r"\s+", " ", c)
            clean.append(c)
        if len(clean) != 3:
            continue  # cabecalho/footer
        data_str, produto_str, valor_str = clean
        # Data DD/MM/YYYY
        dm = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", data_str)
        if not dm:
            continue
        date_iso = f"{dm.group(3)}-{dm.group(2)}-{dm.group(1)}"
        # Produto: "Nome | unit"
        parts = [p.strip() for p in produto_str.split("|")]
        nome = parts[0]
        unit = parts[1] if len(parts) > 1 else ""
        # Valor: "R$ 353,15" ou "R$ 1.398,09"
        vm = re.match(r"R\$\s*([\d.]+,\d+)", valor_str)
        if not vm:
            continue
        value_pt = vm.group(1)
        value_num = float(value_pt.replace(".", "").replace(",", "."))
        meta = META.get(nome, {})
        items.append({
            "name": nome,
            "slug": meta.get("slug", re.sub(r"[^a-z0-9]+","-", nome.lower()).strip("-")),
            "icon": meta.get("icon", ""),
            "unit": unit,
            "value": value_num,
            "value_display": f"R$ {value_pt}",
            "date": date_iso,
        })
    return items

def scrape_and_save(ids, out_path, label):
    body = fetch_widget(ids)
    items = parse_rows(body)
    if not items:
        raise RuntimeError(f"zero items extraidos ({label})")
    brt = timezone(timedelta(hours=-3))
    out = {
        "updated_at": datetime.now(brt).isoformat(timespec="seconds"),
        "source": "CEPEA/Esalq",
        "source_url": "https://www.cepea.org.br/",
        "items": items,
    }
    out_path.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"OK ({label}): {len(items)} indicadores -> {out_path.name}")
    for it in items:
        print(f"  {it['name']:30s} {it['value_display']:>16s} / {it['unit']} ({it['date']})")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--set", choices=["basico", "completo", "all"], default="all",
                    help="basico=4 indicadores hero, completo=27 da pagina cotacoes, all=ambos")
    args = ap.parse_args()
    try:
        if args.set in ("basico", "all"):
            scrape_and_save(SET_BASICO, DATA_DIR / "cotacoes.json", "basico")
        if args.set in ("completo", "all"):
            scrape_and_save(SET_COMPLETO, DATA_DIR / "cotacoes-completas.json", "completo")
    except urllib.error.URLError as e:
        print(f"ERRO conexao CEPEA: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERRO: {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
