"""
Prueba TEMPORAL de solo lectura (26-11-2026, autorizada por Seba).
Comprueba si el ticket de Mercado Público sirve para la API nueva de
Compra Ágil y cómo vienen los datos de licitaciones y del contacto de las OC.
NO escribe en Supabase ni en ninguna parte. Se borra después de la prueba.
"""
import os, json, time, requests

T = os.environ['MP_TICKET']
V1 = "https://api.mercadopublico.cl/servicios/v1/publico"
V2 = "https://api2.mercadopublico.cl/v2/compra-agil"

def corto(obj, n=1500):
    s = json.dumps(obj, ensure_ascii=False, default=str)
    return s[:n]

def quitar_contacto(d):
    # No imprimimos datos personales en el registro público de Actions
    if isinstance(d, dict):
        return {k: ('<oculto>' if any(x in k.lower() for x in ('mail', 'fono', 'contacto', 'rut_proveedor', 'razon')) else quitar_contacto(v)) for k, v in d.items()}
    if isinstance(d, list):
        return [quitar_contacto(x) for x in d]
    return d

print("=== 1. Compra Ágil (api2) ===")
for intento in ('header', 'param'):
    try:
        if intento == 'header':
            r = requests.get(V2, headers={'ticket': T}, params={'q': 'magistral', 'estado': 'publicada', 'tamano_pagina': 50}, timeout=40)
        else:
            r = requests.get(V2, params={'ticket': T, 'q': 'magistral', 'estado': 'publicada', 'tamano_pagina': 50}, timeout=40)
        print(intento, r.status_code, r.text[:300] if r.status_code != 200 else '')
        if r.status_code == 200:
            p = r.json()['payload']
            print("paginacion", p.get('paginacion'))
            items = p.get('items', [])
            for it in items[:8]:
                print(" -", it.get('codigo'), '|', it.get('nombre'), '|', (it.get('institucion') or {}).get('organismo_comprador'), '|', (it.get('fechas') or {}).get('fecha_cierre'))
            if items:
                print("claves item:", list(items[0].keys()))
                print("item ejemplo:", corto(quitar_contacto(items[0])))
                d = requests.get(f"{V2}/{items[0]['codigo']}", headers={'ticket': T}, timeout=40)
                print("detalle", d.status_code)
                if d.status_code == 200:
                    print("claves detalle:", list(d.json()['payload'].keys()))
                    print(corto(quitar_contacto(d.json()['payload']), 2500))
            break
    except Exception as e:
        print(intento, 'ERROR', e)

print("\n--- conteos por palabra (Compra Ágil publicadas) ---")
for q in ['magistral', 'recetario', 'preparado farmaceutico', 'papelillos', 'capsulas', 'polietilenglicol', 'espironolactona', 'carnitina', 'medicamentos', 'farmacia']:
    try:
        r = requests.get(V2, headers={'ticket': T}, params={'q': q, 'estado': 'publicada', 'tamano_pagina': 1}, timeout=40)
        tot = r.json()['payload']['paginacion']['total_resultados'] if r.status_code == 200 else r.status_code
        print(f"  {q}: {tot}")
    except Exception as e:
        print(f"  {q}: ERROR {e}")
    time.sleep(0.5)

try:
    from datetime import datetime, timedelta, timezone
    desde = (datetime.now(timezone.utc) - timedelta(hours=24)).strftime('%Y-%m-%dT%H:%M:%SZ')
    r = requests.get(V2, headers={'ticket': T}, params={'publicado_desde': desde, 'estado': 'publicada', 'tamano_pagina': 50}, timeout=40)
    print("publicadas últimas 24h:", r.json()['payload']['paginacion'] if r.status_code == 200 else r.status_code)
except Exception as e:
    print("24h ERROR", e)

print("\n=== 2. Licitaciones activas (v1) ===")
try:
    r = requests.get(f"{V1}/licitaciones.json", params={'estado': 'activas', 'ticket': T}, timeout=90)
    print(r.status_code)
    js = r.json()
    lst = js.get('Listado', [])
    print("cantidad activas:", js.get('Cantidad'), len(lst))
    print("claves:", list(lst[0].keys()) if lst else None)
    import re
    pat = re.compile(r'magistral|recetario|preparad|medicament|farmac|f[aá]rmaco', re.I)
    cand = [x for x in lst if pat.search(x.get('Nombre') or '')]
    print("candidatas por nombre:", len(cand))
    for x in cand[:15]:
        print(" -", x.get('CodigoExterno'), '|', x.get('Nombre'), '|', x.get('FechaCierre'))
    if cand:
        time.sleep(2)
        d = requests.get(f"{V1}/licitaciones.json", params={'codigo': cand[0]['CodigoExterno'], 'ticket': T}, timeout=60).json()
        det = d['Listado'][0]
        print("claves detalle:", list(det.keys()))
        print("Comprador claves:", list((det.get('Comprador') or {}).keys()))
        items = (det.get('Items') or {}).get('Listado', [])
        print("items:", len(items), corto(items[:2], 1200))
        print("Fechas:", corto(det.get('Fechas')))
        print("MontoEstimado:", det.get('MontoEstimado'), det.get('Moneda'))
except Exception as e:
    print('ERROR', e)

print("\n=== 3. Contacto en el detalle de una OC (v1) ===")
try:
    time.sleep(2)
    r = requests.get(f"{V1}/ordenesdecompra.json", params={'codigo': '812030-1038-AG26', 'ticket': T}, timeout=60).json()
    oc = r['Listado'][0]
    print("claves OC:", list(oc.keys()))
    print("claves Comprador:", list((oc.get('Comprador') or {}).keys()))
    print("Fechas:", oc.get('Fechas'))
    print("Estado:", oc.get('CodigoEstado'), oc.get('Estado'))
except Exception as e:
    print('ERROR', e)
