"""
Scraper CEPEA/Esalq - baixa indicadores spot do widget oficial e salva em
data/cotacoes.json. Roda via GH Actions de hora em hora 8h-19h BRT dias uteis.

Indicadores fixados (mesmos do widget original):
  2  = Boi Gordo CEPEA/B3 @
  12 = Soja - PR CEPEA/Esalq sc 60kg
  77 = Milho CEPEA/Esalq sc 60kg
  23 = Cafe Arabica CEPEA/Esalq sc 60kg
"""
import json, re, sys
import urllib.request as u
import urllib.error
from datetime import datetime, timezone, timedelta
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "cotacoes.json"
OUT.parent.mkdir(parents=True, exist_ok=True)

# Mapa para meta enriquecida no JSON final
META = {
    "Boi Gordo": {"slug": "boi-gordo", "icon": "boi"},
    "Soja - PR": {"slug": "soja-pr", "icon": "soja"},
    "Milho": {"slug": "milho", "icon": "milho"},
    "Cafe Arabica": {"slug": "cafe-arabica", "icon": "cafe"},
    "Café Arábica": {"slug": "cafe-arabica", "icon": "cafe"},
}

WIDGET_URL = (
    "https://www.cepea.org.br/br/widgetproduto.js.php"
    "?fonte=arial&tamanho=12&largura=680px"
    "&corfundo=ffffff&cortexto=0f172a&corlinha=f1f5f9"
    "&id_indicador%5B%5D=2"   # Boi Gordo
    "&id_indicador%5B%5D=12"  # Soja PR
    "&id_indicador%5B%5D=77"  # Milho
    "&id_indicador%5B%5D=23"  # Cafe Arabica
)

def fetch_widget():
    req = u.Request(WIDGET_URL, headers={
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

def main():
    try:
        body = fetch_widget()
        items = parse_rows(body)
        if not items:
            print("ERRO: zero items extraidos do widget CEPEA", file=sys.stderr)
            sys.exit(1)
        # Timezone BRT (-3)
        brt = timezone(timedelta(hours=-3))
        out = {
            "updated_at": datetime.now(brt).isoformat(timespec="seconds"),
            "source": "CEPEA/Esalq",
            "source_url": "https://www.cepea.org.br/",
            "items": items,
        }
        OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"OK: {len(items)} indicadores salvos em {OUT.name}")
        for it in items:
            print(f"  {it['name']:20s} {it['value_display']:>14s} / {it['unit']} ({it['date']})")
    except urllib.error.URLError as e:
        print(f"ERRO conexao CEPEA: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"ERRO: {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
