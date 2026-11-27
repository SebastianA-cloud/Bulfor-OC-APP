"""
Prueba TEMPORAL de solo lectura (27-11-2026, pedida por Seba): ¿de dónde se
pueden sacar el teléfono y el correo de la unidad compradora de una OC?
  1. API de OC: campo Descripcion (las "Observaciones" de la ficha).
  2. Página pública de la OC en Mercado Público (lo que se ve al abrirla).
No escribe en ninguna parte. Se borra después de la prueba.
"""
import os, re, requests

T = os.environ['MP_TICKET']
CODIGOS = ['948356-4245-SE26', '812030-1038-AG26']
MAIL = re.compile(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+')
FONO = re.compile(r'(?:\+?56[\s-]?)?(?:\(?\d{1,2}\)?[\s-]?)\d{3,4}[\s-]?\d{3,4}')

for cod in CODIGOS:
    print(f"\n=== {cod} ===")
    d = requests.get("https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json",
                     params={'codigo': cod, 'ticket': T}, timeout=60).json()['Listado'][0]
    desc = d.get('Descripcion') or ''
    print("API Descripcion (primeros 600):", desc[:600].replace('\n', ' | '))
    print("  correos en Descripcion:", MAIL.findall(desc))
    comp = d.get('Comprador') or {}
    print("  Comprador:", {k: v for k, v in comp.items() if k not in ('NombreContacto',)})
    for url in [f"https://www.mercadopublico.cl/PurchaseOrder/Modules/PO/DetailsPurchaseOrder.aspx?codigoOC={cod}",
                f"https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsPurchaseOrder.aspx?codigoOC={cod}"]:
        try:
            r = requests.get(url, timeout=60, headers={'User-Agent': 'Mozilla/5.0'})
            html = r.text
            txt = re.sub(r'<[^>]+>', ' ', html)
            txt = re.sub(r'\s+', ' ', txt)
            i = txt.lower().find('tel')
            print(f"\n  Página {url.split('/Modules/')[1][:40]}… → {r.status_code}, {len(html)} bytes")
            for m in re.finditer(r'Tel[ée]fono\s*:?\s*([+\d][\d\s()+-]{6,20})', txt, re.I):
                print("    teléfono:", m.group(1).strip())
            print("    correos:", sorted(set(MAIL.findall(txt)))[:10])
            for lab in ['lblFonoDemandante', 'lblTelefono', 'Fono']:
                j = html.find(lab)
                if j >= 0:
                    print(f"    cerca de '{lab}':", re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html[j:j+250]))[:160])
        except Exception as e:
            print("  error página:", e)
