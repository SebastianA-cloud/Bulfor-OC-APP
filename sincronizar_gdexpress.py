"""
Sincronización de facturas emitidas (GDExpress -> Supabase).

Trae las facturas (TipoDTE:33) que Bulfor ha emitido a los hospitales desde
GDExpress, y las guarda/actualiza en facturas_pago:
  - Si la factura NO existía, la crea completa.
  - Si YA existía, actualiza los datos que vienen del documento (hospital,
    monto, fecha de emisión, fecha de vencimiento REAL, estado de
    aceptación, link al documento) — porque esa es la fuente de verdad.
  - NUNCA toca fecha_pago ni estado_pago — esos los maneja el import del
    listado de pagos o la edición manual en la app. Así no se pisa nada
    de lo que ya hayas marcado como pagado.

Se corre todas las noches via GitHub Actions (workflow_dispatch + cron),
igual que el script de Mercado Público.
"""

import os
import base64
import time
import xml.etree.ElementTree as ET
from datetime import datetime

import requests
from supabase import create_client

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']
DTEBOX_IP = os.environ['DTEBOX_IP']
AUTH_KEY = os.environ['GDEXPRESS_API_KEY']

AMBIENTE = 'P'   # P = Producción (facturas reales). Usar 'T' solo para pruebas.
GRUPO = 'E'      # E = Emitidos (lo que Bulfor factura a los hospitales)
CONSULTA = 'TipoDTE:33'  # 33 = Factura Electrónica (no notas de crédito ni guías)
TAMANO_PAGINA = 300  # máximo permitido por la API

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def gdexpress_get(pagina):
    query_b64 = base64.b64encode(CONSULTA.encode('utf-8')).decode('ascii')
    url = f"http://{DTEBOX_IP}/api/Core.svc/core/PaginatedSearch/{AMBIENTE}/{GRUPO}/{query_b64}/{pagina}/{TAMANO_PAGINA}"
    headers = {'AuthKey': AUTH_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json'}
    r = requests.get(url, headers=headers, timeout=60)
    r.raise_for_status()
    data = r.json()
    if str(data.get('Result')) != '0':
        raise RuntimeError(f"GDExpress devolvió un error: {data.get('Description')}")
    return data


def parse_fecha(texto):
    """GDExpress trae fechas tipo '2026-06-15T00:00:00'."""
    if not texto:
        return None
    try:
        return datetime.strptime(texto[:19], '%Y-%m-%dT%H:%M:%S').strftime('%Y-%m-%d')
    except Exception:
        return None


def documentos_desde_xml(xml_bytes):
    """El XML viene en ISO-8859-1 (lo declara en la cabecera) — se lo pasamos
    crudo a ElementTree para que respete esa codificación él solo."""
    root = ET.fromstring(xml_bytes)
    docs = []
    for doc in root.findall('document'):
        def campo(nombre):
            el = doc.find(nombre)
            return el.text if el is not None else None

        anulado = (campo('Anulado') or '').strip().lower() in ('si', 'sí', 'true')
        autorizado = (campo('AutorizadoSII') or '').strip().lower() in ('si', 'sí', 'true')

        docs.append({
            'factura': campo('Folio'),
            'rut_hospital': campo('RUTRecep'),
            'hospital': campo('RznSocRecep'),
            'fecha_emision': parse_fecha(campo('FchEmis')),
            'fecha_vencimiento': parse_fecha(campo('DueDate')),
            'monto': float(campo('MntNeto')) if campo('MntNeto') else None,
            'estado_aceptacion': 'N' if anulado else ('A' if autorizado else None),
            'doc_url': campo('DownloadCustomerDocumentUrl'),
        })
    return docs


def main():
    print(f"Sincronizando facturas emitidas — Ambiente: {AMBIENTE}, Consulta: {CONSULTA}\n")

    # Facturas ya existentes, para no pisar fecha_pago/estado_pago
    existentes = {}
    res = supabase.table('facturas_pago').select('factura,fecha_pago,estado_pago').execute()
    for f in (res.data or []):
        existentes[f['factura']] = f

    pagina = 1
    total_procesadas = 0
    total_paginas = None

    while True:
        print(f"Página {pagina}" + (f"/{total_paginas}" if total_paginas else "") + "...")
        data = gdexpress_get(pagina)
        total_documentos = int(data.get('TotalDocuments', 0))
        if total_paginas is None:
            total_paginas = max(1, -(-total_documentos // TAMANO_PAGINA))  # ceil

        if not data.get('Data'):
            print("  Sin datos en esta página.")
            break

        xml_bytes = base64.b64decode(data['Data'])
        docs = documentos_desde_xml(xml_bytes)
        print(f"  {len(docs)} facturas en esta página")

        filas = []
        for d in docs:
            if not d['factura']:
                continue
            filas.append(d)  # nunca incluimos fecha_pago/estado_pago acá — eso no se toca

        if filas:
            supabase.table('facturas_pago').upsert(filas, on_conflict='factura').execute()
            total_procesadas += len(filas)

        if pagina >= total_paginas:
            break
        pagina += 1
        time.sleep(1)

    print(f"\n✔ Listo: {total_procesadas} facturas sincronizadas (creadas o actualizadas).")


if __name__ == '__main__':
    main()
