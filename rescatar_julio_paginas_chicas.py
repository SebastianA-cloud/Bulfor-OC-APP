"""
Script exploratorio — mientras GDExpress revisa el problema de fondo.

Las páginas 34-38 (con tamaño de página 300) fallan siempre con
"Error buscando documentos en el cloud" — probablemente un solo documento
dañado esté rompiendo el lote completo. Acá probamos el mismo tramo de
documentos pero con páginas mucho más chicas (20 en vez de 300), para ver
si el resto de los documentos sí pasa y solo falla un pedacito chiquito.

No toca el checkpoint del sincronizador principal (sincronizar_gdexpress.py)
— es un script aparte, pensado para correr una sola vez como rescate.
Sí guarda en facturas_pago lo que logre traer (respetando FECHA_MINIMA,
nunca toca fecha_pago/estado_pago), así que lo que logre rescatar aquí
queda guardado de verdad.
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

AMBIENTE = 'P'
GRUPO = 'E'
CONSULTA = 'TipoDTE:33'
FECHA_MINIMA = '2026-07-01'

# Las páginas 34-38 con tamaño 300 cubren, aproximadamente, los documentos
# 9901 a 11400. Con tamaño de página 20, eso equivale más o menos a las
# páginas 480 a 580 — dejamos margen de sobra por si el corte no es exacto.
TAMANO_PAGINA_CHICO = 20
PAGINA_INICIO = 470
PAGINA_FIN = 590

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def gdexpress_get(pagina, tamano_pagina, max_reintentos=3):
    query_b64 = base64.b64encode(CONSULTA.encode('utf-8')).decode('ascii')
    url = f"http://{DTEBOX_IP}/api/Core.svc/core/PaginatedSearch/{AMBIENTE}/{GRUPO}/{query_b64}/{pagina}/{tamano_pagina}"
    headers = {'AuthKey': AUTH_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json'}
    espera = 3
    for intento in range(max_reintentos):
        try:
            r = requests.get(url, headers=headers, timeout=60)
            r.raise_for_status()
            data = r.json()
            if str(data.get('Result')) != '0':
                raise RuntimeError(f"{data.get('Description')}")
            return data
        except (requests.exceptions.RequestException, RuntimeError) as e:
            if intento == max_reintentos - 1:
                raise
            time.sleep(espera)
            espera *= 2


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


def documentos_desde_xml(xml_bytes):
    root = ET.fromstring(xml_bytes)
    docs = []
    for doc in root.findall('document'):
        def campo(nombre):
            el = doc.find(nombre)
            return el.text if el is not None else None
        anulado = es_verdadero(campo('Anulado'))
        autorizado = es_verdadero(campo('AutorizadoSII'))
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
    print(f"Explorando páginas {PAGINA_INICIO} a {PAGINA_FIN} (tamaño {TAMANO_PAGINA_CHICO})\n")
    ok, fallidas = 0, 0
    paginas_fallidas = []
    total_julio_en_adelante = 0
    facturas_encontradas = []

    for pagina in range(PAGINA_INICIO, PAGINA_FIN + 1):
        try:
            data = gdexpress_get(pagina, TAMANO_PAGINA_CHICO)
        except Exception as e:
            print(f"Página {pagina}: ✗ falló — {e}")
            fallidas += 1
            paginas_fallidas.append(pagina)
            time.sleep(1)
            continue

        ok += 1
        if not data.get('Data'):
            print(f"Página {pagina}: sin datos (probablemente pasamos el final)")
            continue

        xml_bytes = base64.b64decode(data['Data'])
        docs = documentos_desde_xml(xml_bytes)
        recientes = [d for d in docs if d['factura'] and d['fecha_emision'] and d['fecha_emision'] >= FECHA_MINIMA]
        if recientes:
            supabase.table('facturas_pago').upsert(recientes, on_conflict='factura').execute()
            total_julio_en_adelante += len(recientes)
            facturas_encontradas.extend(d['factura'] for d in recientes)

        fechas = sorted(set(d['fecha_emision'] for d in docs if d['fecha_emision']))
        rango = f"{fechas[0]} a {fechas[-1]}" if fechas else "sin fechas"
        print(f"Página {pagina}: ✔ {len(docs)} docs ({rango}) — {len(recientes)} de julio+ guardadas")
        time.sleep(0.5)

    print(f"\n{'='*50}")
    print(f"Páginas OK: {ok}   Páginas fallidas: {fallidas}")
    if paginas_fallidas:
        print(f"Páginas que fallaron: {paginas_fallidas}")
    print(f"Total facturas de julio 2026+ rescatadas y guardadas: {total_julio_en_adelante}")
    if facturas_encontradas:
        print(f"Números de factura encontrados: {sorted(facturas_encontradas)}")


if __name__ == '__main__':
    main()
