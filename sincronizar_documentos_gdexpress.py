"""
Sincronización del Buscador de documentos (GDExpress -> Supabase).

Trae 3 tipos de documentos emitidos por Bulfor, desde el 01-01-2025 hasta
hoy, y los guarda en una sola tabla (documentos_gdexpress), diferenciados
por tipo_dte:
  - 33: Facturas Electrónicas
  - 61: Notas de Crédito
  - 52: Guías de Despacho

Usa el mismo truco de filtro de fecha directo en la consulta que ya
confirmamos que funciona para Seguimiento de Pago (evita el rango roto de
GDExpress que aparece si se recorre todo el historial página por página).

Se corre todas las noches via GitHub Actions.
"""

import os
import re
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

AMBIENTE = 'P'
GRUPO = 'E'
RUT_EMISOR = '76186755-5'  # RUT de Farmacia Bulfor
TAMANO_PAGINA = 300

FECHA_MINIMA = '2025-01-01'
FECHA_MAXIMA = datetime.now().strftime('%Y-%m-%d')

TIPOS_DTE = {
    '33': 'Facturas',
    '61': 'Notas de Crédito',
    '52': 'Guías de Despacho',
}

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Patrón típico de un código de OC de Mercado Público, ej: "1058134-1202-SE26"
PATRON_OC = re.compile(r'\b\d{3,9}-\d{1,6}-[A-Z]{2,4}\d{2,4}\b')


def gdexpress_get(tipo_dte, pagina, max_reintentos=6):
    consulta = f'(RUTEmisor:{RUT_EMISOR} AND TipoDTE:{tipo_dte} AND FchEmis:[{FECHA_MINIMA} TO {FECHA_MAXIMA}])'
    query_b64 = base64.b64encode(consulta.encode('utf-8')).decode('ascii')
    url = f"http://{DTEBOX_IP}/api/Core.svc/core/PaginatedSearch/{AMBIENTE}/{GRUPO}/{query_b64}/{pagina}/{TAMANO_PAGINA}"
    headers = {'AuthKey': AUTH_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json'}
    espera = 5
    for intento in range(max_reintentos):
        try:
            r = requests.get(url, headers=headers, timeout=120)
            r.raise_for_status()
            data = r.json()
            if str(data.get('Result')) != '0':
                raise RuntimeError(f"GDExpress devolvió un error: {data.get('Description')}")
            return data
        except (requests.exceptions.RequestException, RuntimeError) as e:
            print(f"    ⚠ Error en la página {pagina} (intento {intento+1}/{max_reintentos}): {e}")
            if intento == max_reintentos - 1:
                raise
            time.sleep(espera)
            espera = min(espera * 2, 60)


def parse_fecha(texto):
    if not texto:
        return None
    try:
        return datetime.strptime(texto[:19], '%Y-%m-%dT%H:%M:%S').strftime('%Y-%m-%d')
    except Exception:
        return None


def es_verdadero(texto):
    if not texto:
        return False
    return texto.strip().lower() not in ('no', 'false', '0', 'indefinido', '')


def extraer_oc_referenciada(texto_referencias):
    """DocumentReferences trae un texto tipo JSON con documentos relacionados
    (guías, OC, etc). Buscamos ahí un código con pinta de OC de Mercado
    Público. Si no hay nada, devolvemos None sin problema."""
    if not texto_referencias:
        return None
    m = PATRON_OC.search(texto_referencias)
    return m.group(0) if m else None


def documentos_desde_xml(xml_bytes, tipo_dte):
    root = ET.fromstring(xml_bytes)
    docs = []
    for doc in root.findall('document'):
        def campo(nombre):
            el = doc.find(nombre)
            return el.text if el is not None else None

        anulado = es_verdadero(campo('Anulado'))
        autorizado = es_verdadero(campo('AutorizadoSII'))

        docs.append({
            'tipo_dte': tipo_dte,
            'folio': campo('Folio'),
            'rut_hospital': campo('RUTRecep'),
            'hospital': campo('RznSocRecep'),
            'fecha_emision': parse_fecha(campo('FchEmis')),
            'monto': float(campo('MntNeto')) if campo('MntNeto') else None,
            'estado_aceptacion': 'N' if anulado else ('A' if autorizado else None),
            'doc_url': campo('DownloadCustomerDocumentUrl'),
            'orden_compra_ref': extraer_oc_referenciada(campo('DocumentReferences')),
        })
    return docs


def sincronizar_tipo(tipo_dte, nombre):
    print(f"\n{'='*50}\n{nombre} (TipoDTE:{tipo_dte})\n{'='*50}")
    pagina = 1
    total_paginas = None
    total_procesadas = 0
    paginas_con_error = []

    while True:
        print(f"Página {pagina}" + (f"/{total_paginas}" if total_paginas else "") + "...")
        try:
            data = gdexpress_get(tipo_dte, pagina)
        except Exception as e:
            print(f"  ✗ No se pudo traer la página {pagina}: {e}")
            paginas_con_error.append(pagina)
            if total_paginas is None or pagina >= total_paginas:
                break
            pagina += 1
            time.sleep(2)
            continue

        total_documentos = int(data.get('TotalDocuments', 0))
        if total_paginas is None:
            total_paginas = max(1, -(-total_documentos // TAMANO_PAGINA))
            print(f"  Total de documentos: {total_documentos} ({total_paginas} página(s))")

        if not data.get('Data'):
            print("  Sin datos en esta página.")
            break

        xml_bytes = base64.b64decode(data['Data'])
        docs = documentos_desde_xml(xml_bytes, tipo_dte)
        filas = [d for d in docs if d['folio']]
        if filas:
            supabase.table('documentos_gdexpress').upsert(filas, on_conflict='tipo_dte,folio').execute()
            total_procesadas += len(filas)
        print(f"  {len(filas)} documentos guardados")

        if pagina >= total_paginas:
            break
        pagina += 1
        time.sleep(2)

    print(f"✔ {nombre}: {total_procesadas} documentos sincronizados.")
    if paginas_con_error:
        print(f"⚠ Páginas fallidas: {paginas_con_error}")
    return total_procesadas


def main():
    print(f"Sincronizando Buscador de Documentos — {FECHA_MINIMA} a {FECHA_MAXIMA}")
    total = 0
    for tipo_dte, nombre in TIPOS_DTE.items():
        total += sincronizar_tipo(tipo_dte, nombre)
        time.sleep(2)
    print(f"\n✔✔ Listo en total: {total} documentos sincronizados entre los 3 tipos.")


if __name__ == '__main__':
    main()
