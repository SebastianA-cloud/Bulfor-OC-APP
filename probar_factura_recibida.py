"""
DIAGNÓSTICO — ¿por qué algunas facturas de proveedor no traen productos?

Por qué existe este script
──────────────────────────
Los productos de una factura de proveedor salen de su XML completo
(RecoverXML_V2). Si GDExpress responde "no recibido en la plataforma", la
sincronización la marca como revisada y queda sin productos para siempre.
Pasa con TODAS las facturas de algunos proveedores (ej. Zoellner, Mediven),
así que no parece un error puntual.

Qué hace
────────
NO escribe nada en Supabase. Para cada factura de prueba:
  1. La busca en el listado de recibidos de GDExpress e imprime todos sus
     campos (ahí se ve, por ejemplo, si GDExpress tiene el archivo o solo
     el registro del SII).
  2. Pide su XML completo con las mismas opciones que la sincronización, y
     también con IsForDistribution=false, e imprime lo que responde.
Las dos primeras son de proveedores SIN productos; las otras dos, CON productos.

Cómo correrlo
─────────────
GitHub -> Actions -> "Diagnóstico factura recibida" -> Run workflow.
También corre solo al subir cambios a este script en la rama separar-css.
"""

import os
import base64
import xml.etree.ElementTree as ET

import requests

DTEBOX_IP = os.environ['DTEBOX_IP']
AUTH_KEY = os.environ['GDEXPRESS_API_KEY']

AMBIENTE = 'P'
GRUPO = 'R'
RUT_RECEPTOR = '76186755-5'

# (folio, RUT proveedor, fecha de emisión, tiene productos en el programa)
CASOS = [
    ('2647', '76078309-9', '2026-05-22', 'SIN productos — ZOELLNER'),
    ('4021261', '76425071-0', '2026-10-06', 'SIN productos — MEDIVEN'),
    ('454107', '77190661-3', '2026-05-31', 'CON productos — PAGOS Y SERVICIOS'),
    ('90673', '79609600-4', '2026-05-29', 'CON productos — DRUGPLASTICS ARCADIA'),
]

HEADERS = {'AuthKey': AUTH_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json'}


def titulo(texto):
    print(f"\n{'=' * 68}\n{texto}\n{'=' * 68}")


def buscar_en_listado(folio, rut, fecha):
    consulta = f'(RUTRecep:{RUT_RECEPTOR} AND TipoDTE:33 AND FchEmis:[{fecha} TO {fecha}])'
    query_b64 = base64.b64encode(consulta.encode('utf-8')).decode('ascii')
    url = f"http://{DTEBOX_IP}/api/Core.svc/core/PaginatedSearch/{AMBIENTE}/{GRUPO}/{query_b64}/1/300"
    r = requests.get(url, headers=HEADERS, timeout=120)
    r.raise_for_status()
    data = r.json()
    if str(data.get('Result')) != '0' or not data.get('Data'):
        print(f"  Listado: Result={data.get('Result')} · {data.get('Description')} · sin datos")
        return None
    root = ET.fromstring(base64.b64decode(data['Data']))
    for doc in root.findall('document'):
        campos = {hijo.tag.split('}')[-1]: (hijo.text or '').strip() for hijo in doc}
        if campos.get('Folio') == folio and campos.get('RUTEmisor', '').upper() == rut.upper():
            return campos
    print(f"  Listado: {data.get('TotalDocuments')} documentos ese día, pero no aparece el folio {folio} de {rut}.")
    return None


def pedir_xml(folio, rut, para_distribucion):
    body = {
        "Environment": AMBIENTE,
        "Group": GRUPO,
        "Rut": rut,
        "DocType": "33",
        "Folio": folio,
        "IsForDistribution": para_distribucion,
    }
    url = f"http://{DTEBOX_IP}/api/Core.svc/core/RecoverXML_V2"
    try:
        r = requests.post(url, headers=HEADERS, json=body, timeout=60)
        data = r.json()
    except Exception as e:
        return f"error: {e}"
    largo = len(base64.b64decode(data['Data'])) if data.get('Data') else 0
    return f"HTTP {r.status_code} · Result={data.get('Result')} · {data.get('Description')} · XML de {largo} bytes"


def main():
    print("DIAGNÓSTICO FACTURAS RECIBIDAS — no escribe nada en la base de datos.")
    for folio, rut, fecha, etiqueta in CASOS:
        titulo(f"Factura {folio} · {rut} · {etiqueta}")
        campos = buscar_en_listado(folio, rut, fecha)
        if campos:
            for nombre, valor in sorted(campos.items()):
                print(f"  {nombre} = {valor[:300]}")
        print(f"\n  XML (IsForDistribution=true):  {pedir_xml(folio, rut, 'true')}")
        print(f"  XML (IsForDistribution=false): {pedir_xml(folio, rut, 'false')}")


if __name__ == '__main__':
    main()
