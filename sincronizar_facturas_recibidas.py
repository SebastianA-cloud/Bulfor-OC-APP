"""
Sincronización de facturas RECIBIDAS de proveedores (GDExpress -> Supabase).

Es la contraparte de sincronizar_gdexpress.py: en vez de traer lo que Bulfor
EMITE a los hospitales (GRUPO=E, filtrando por RUTEmisor), trae lo que los
PROVEEDORES le emiten A Bulfor (GRUPO=R, filtrando por RUTRecep) — o sea,
las cuentas por pagar.

Rango de fechas: igual que actualizar_oc_final.py — busca en Supabase cuál
es la fecha de emisión más reciente ya guardada y sigue desde ahí (así cada
corrida es rápida). La PRIMERA vez que corre (tabla vacía) no encuentra
nada guardado, así que parte desde el 01-01-2026.

Guarda/actualiza en facturas_por_pagar:
  - Si la factura NO existía (por rut_proveedor + factura), la crea.
  - Si YA existía, actualiza los datos que vienen del documento (proveedor,
    monto, fechas, estado) — esa es la fuente de verdad.
  - NUNCA toca estado_pago, fecha_pago ni cuenta_pago_id — eso lo maneja
    la persona que va marcando qué se pagó, desde la app.
  - Si la factura no trae fecha de vencimiento (DueDate), se usa la misma
    fecha de emisión (vence "al día"), tal como se pidió.

Se corre varias veces al día vía GitHub Actions (workflow_dispatch + cron).
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
GRUPO = 'R'      # R = Recibidos (lo que los proveedores le facturan a Bulfor)
RUT_RECEPTOR = '76186755-5'  # RUT de Farmacia Bulfor
TAMANO_PAGINA = 300  # máximo permitido por la API

# Nunca se busca antes de esta fecha, ni siquiera la primera vez.
FECHA_MINIMA_ABSOLUTA = '2026-01-01'

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def obtener_ultima_fecha_guardada():
    """Punto de partida de la búsqueda: normalmente es la fecha de emisión
    más reciente que ya tengamos guardada (para no revisar de nuevo todo el
    histórico cada vez). Pero si hay facturas guardadas con el proveedor
    vacío (por ejemplo, porque un cambio de código como este arregló cómo
    se lee ese campo, pero las filas viejas quedaron con el dato en blanco),
    la fecha de inicio retrocede hasta cubrir la más antigua de esas — así
    se auto-corrigen solas en la próxima corrida, sin intervención manual.
    Si la tabla está vacía (primera corrida), parte desde FECHA_MINIMA_ABSOLUTA."""
    res = supabase.table('facturas_por_pagar').select('fecha_emision') \
        .order('fecha_emision', desc=True).limit(1).execute()
    ultima = res.data[0]['fecha_emision'] if res.data and res.data[0].get('fecha_emision') else None
    if not ultima:
        return FECHA_MINIMA_ABSOLUTA

    res_incompletas = supabase.table('facturas_por_pagar').select('fecha_emision') \
        .is_('proveedor', 'null').order('fecha_emision').limit(1).execute()
    if res_incompletas.data and res_incompletas.data[0].get('fecha_emision'):
        mas_antigua_incompleta = res_incompletas.data[0]['fecha_emision']
        print(f"  ⚠ Hay facturas sin proveedor desde el {mas_antigua_incompleta} — se revisan de nuevo.")
        ultima = min(ultima, mas_antigua_incompleta)

    return max(ultima, FECHA_MINIMA_ABSOLUTA)


FECHA_MINIMA = obtener_ultima_fecha_guardada()
FECHA_MAXIMA = datetime.now().strftime('%Y-%m-%d')

CONSULTA = f'(RUTRecep:{RUT_RECEPTOR} AND TipoDTE:33 AND FchEmis:[{FECHA_MINIMA} TO {FECHA_MAXIMA}])'


def gdexpress_get(pagina, max_reintentos=6):
    query_b64 = base64.b64encode(CONSULTA.encode('utf-8')).decode('ascii')
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
    t = texto.strip().lower()
    return t not in ('no', 'false', '0', 'indefinido', '')


def documentos_desde_xml(xml_bytes, imprimir_diagnostico=False):
    """El XML viene en ISO-8859-1 (lo declara en la cabecera) — se lo pasamos
    crudo a ElementTree para que respete esa codificación él solo."""
    root = ET.fromstring(xml_bytes)
    docs = []
    for i, doc in enumerate(root.findall('document')):
        def campo(nombre):
            el = doc.find(nombre)
            return el.text if el is not None else None

        def campo_alt(*nombres):
            """Prueba varios nombres de campo posibles y devuelve el primero
            que venga con datos. Se usa para 'razón social del emisor', cuyo
            nombre exacto en esta dirección (GRUPO=R) no está confirmado
            todavía — apenas se vea cuál trae datos de verdad, se puede
            dejar solo ese."""
            for nombre in nombres:
                valor = campo(nombre)
                if valor:
                    return valor
            return None

        # Diagnóstico: en el primerísimo documento de toda la corrida,
        # imprime CADA campo que trae el XML con su valor — así se ve en el
        # log de GitHub Actions cuál es el nombre real del proveedor (y
        # cualquier otro dato que convenga agregar después).
        if imprimir_diagnostico and i == 0:
            print("\n  🔎 DIAGNÓSTICO — campos del primer documento:")
            for hijo in doc:
                print(f"    {hijo.tag} = {hijo.text}")
            print()

        anulado = es_verdadero(campo('Anulado'))
        autorizado = es_verdadero(campo('AutorizadoSII'))
        fecha_emision = parse_fecha(campo('FchEmis'))
        # Si no trae vencimiento, vence "al día" (misma fecha de emisión) —
        # así lo pidió Sebastián en vez de dejarlo vacío.
        fecha_vencimiento = parse_fecha(campo('DueDate')) or fecha_emision

        monto_neto = float(campo('MntNeto')) if campo('MntNeto') else None
        # Por si esta respuesta liviana sí trae el total con IVA — si no
        # viene, queda en None y la app lo completa después con el mismo
        # mecanismo que ya existe para las facturas emitidas.
        monto_total = float(campo('MntTotal')) if campo('MntTotal') else None

        docs.append({
            'factura': campo('Folio'),
            'rut_proveedor': campo('RUTEmisor'),
            'proveedor': campo_alt('RznSoc', 'RznSocEmisor', 'IssuerName', 'RznSocEmi', 'RazonSocialEmisor', 'NombreEmisor'),
            'fecha_emision': fecha_emision,
            'fecha_vencimiento': fecha_vencimiento,
            'monto': monto_neto,
            'monto_total': monto_total,
            'estado_aceptacion': 'N' if anulado else ('A' if autorizado else None),
            'doc_url': campo('DownloadCustomerDocumentUrl'),
        })
    return docs


def main():
    print(f"Sincronizando facturas RECIBIDAS de proveedores — Ambiente: {AMBIENTE}")
    print(f"Desde: {FECHA_MINIMA}  Hasta: {FECHA_MAXIMA}")
    print(f"Consulta: {CONSULTA}\n")

    pagina = 1
    total_procesadas = 0
    total_paginas = None
    paginas_con_error = []

    while True:
        print(f"Página {pagina}" + (f"/{total_paginas}" if total_paginas else "") + "...")
        try:
            data = gdexpress_get(pagina)
        except Exception as e:
            print(f"  ✗ No se pudo traer la página {pagina} después de varios intentos: {e}")
            paginas_con_error.append(pagina)
            if total_paginas is None or pagina >= total_paginas:
                break
            pagina += 1
            time.sleep(2)
            continue

        total_documentos = int(data.get('TotalDocuments', 0))
        if total_paginas is None:
            total_paginas = max(1, -(-total_documentos // TAMANO_PAGINA))
            print(f"  Total de documentos en el rango: {total_documentos} ({total_paginas} página(s))")

        if not data.get('Data'):
            print("  Sin datos en esta página.")
            break

        xml_bytes = base64.b64decode(data['Data'])
        docs = documentos_desde_xml(xml_bytes, imprimir_diagnostico=(pagina == 1))
        print(f"  {len(docs)} facturas en esta página")

        filas = [d for d in docs if d['factura'] and d['rut_proveedor'] and d['fecha_emision'] and d['fecha_emision'] >= FECHA_MINIMA]

        if filas:
            supabase.table('facturas_por_pagar').upsert(filas, on_conflict='rut_proveedor,factura').execute()
            total_procesadas += len(filas)

        if pagina >= total_paginas:
            break
        pagina += 1
        time.sleep(2)

    print(f"\n✔ Listo: {total_procesadas} facturas recibidas sincronizadas (creadas o actualizadas).")
    if paginas_con_error:
        print(f"⚠ {len(paginas_con_error)} página(s) fallaron incluso con reintentos: {paginas_con_error}")
        print("  Corre el script de nuevo para completarlas (no duplica nada, solo rellena lo que falte).")


if __name__ == '__main__':
    main()
