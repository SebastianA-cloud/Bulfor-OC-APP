"""
Sincronización de facturas RECIBIDAS de proveedores (GDExpress -> Supabase).

Es la contraparte de sincronizar_gdexpress.py: en vez de traer lo que Bulfor
EMITE a los hospitales (GRUPO=E, filtrando por RUTEmisor), trae lo que los
PROVEEDORES le emiten A Bulfor (GRUPO=R, filtrando por RUTRecep) — o sea,
las cuentas por pagar.

Además de las facturas (TipoDTE 33), también trae las Notas de Crédito que
los proveedores le envían a Bulfor (TipoDTE 61) — son las que anulan una
factura. Sin esto, una factura anulada por NC se seguía viendo como
"pendiente" para siempre, porque el campo "Anulado" del documento no
siempre se actualiza solo del lado de GDExpress.

Rango de fechas: igual que actualizar_oc_final.py — busca en Supabase cuál
es la fecha de emisión más reciente ya guardada y sigue desde ahí (así cada
corrida es rápida). La PRIMERA vez que corre (tabla vacía) no encuentra
nada guardado, así que parte desde el 01-01-2024.

Guarda/actualiza en facturas_por_pagar:
  - Si la factura NO existía (por rut_proveedor + factura), la crea.
  - Si YA existía, actualiza los datos que vienen del documento (proveedor,
    monto, fechas, estado) — esa es la fuente de verdad.
  - NUNCA toca estado_pago, fecha_pago ni cuenta_pago_id — eso lo maneja
    la persona que va marcando qué se pagó, desde la app.
  - Si la factura no trae fecha de vencimiento (DueDate), se usa la misma
    fecha de emisión (vence "al día"), tal como se pidió.

Guarda las Notas de Crédito recibidas en notas_credito_recibidas, y cuando
se identifica a qué factura anulan (leyendo el XML completo), esa factura
se marca como 'N' (anulada) en facturas_por_pagar automáticamente.

Se corre varias veces al día vía GitHub Actions (workflow_dispatch + cron).
"""

import os
import base64
import re
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

# Nunca se busca antes de esta fecha, ni siquiera forzando el histórico completo.
FECHA_MINIMA_ABSOLUTA = '2024-01-01'

# Si se activa (desde el botón "Run workflow" en GitHub, marcando la casilla),
# ignora todo lo guardado y vuelve a pedir TODO desde FECHA_MINIMA_ABSOLUTA —
# para un respaldo histórico puntual. El resto de las corridas (automáticas
# o manuales sin marcar la casilla) siguen siendo incrementales como siempre.
FORZAR_HISTORICO_COMPLETO = os.environ.get('FORZAR_HISTORICO_COMPLETO', 'false').lower() == 'true'

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def obtener_ultima_fecha_guardada(tabla):
    """Punto de partida de la búsqueda para una tabla dada: normalmente es
    la fecha de emisión más reciente que ya tengamos guardada ahí (para no
    revisar de nuevo todo el histórico cada vez). Si hay filas guardadas con
    el proveedor vacío, la fecha de inicio retrocede hasta cubrir la más
    antigua de esas, para que se auto-corrijan solas. Si la tabla está
    vacía, o si se pidió expresamente el histórico completo, parte desde
    FECHA_MINIMA_ABSOLUTA."""
    if FORZAR_HISTORICO_COMPLETO:
        return FECHA_MINIMA_ABSOLUTA

    res = supabase.table(tabla).select('fecha_emision') \
        .order('fecha_emision', desc=True).limit(1).execute()
    ultima = res.data[0]['fecha_emision'] if res.data and res.data[0].get('fecha_emision') else None
    if not ultima:
        return FECHA_MINIMA_ABSOLUTA

    res_incompletas = supabase.table(tabla).select('fecha_emision') \
        .is_('proveedor', 'null').order('fecha_emision').limit(1).execute()
    if res_incompletas.data and res_incompletas.data[0].get('fecha_emision'):
        mas_antigua_incompleta = res_incompletas.data[0]['fecha_emision']
        print(f"  ⚠ Hay filas en {tabla} sin proveedor desde el {mas_antigua_incompleta} — se revisan de nuevo.")
        ultima = min(ultima, mas_antigua_incompleta)

    return max(ultima, FECHA_MINIMA_ABSOLUTA)


def construir_consulta(tipo_dte, fecha_minima, fecha_maxima):
    return f'(RUTRecep:{RUT_RECEPTOR} AND TipoDTE:{tipo_dte} AND FchEmis:[{fecha_minima} TO {fecha_maxima}])'


def gdexpress_get(pagina, consulta, max_reintentos=6):
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


def recuperar_xml_documento(folio, rut_proveedor, doc_type="33"):
    """Trae el XML COMPLETO de un documento recibido puntual (factura o
    nota de crédito) — mismo caso de uso 'Recuperar XML' que usa
    sincronizar_documentos_gdexpress.py para los documentos emitidos.

    OJO: el parámetro "Rut" de esta API siempre significa 'RUT de quien
    EMITIÓ el documento' — pase lo que pase con "Group". Para documentos
    recibidos, quien emite es el PROVEEDOR (distinto en cada documento), no
    Bulfor — por eso este parámetro cambia según el documento, y no es un
    valor fijo como en el script de documentos emitidos.

    doc_type: "33" para facturas, "61" para notas de crédito — tienen que
    coincidir con el tipo real del documento o GDExpress no lo encuentra
    (aunque el folio y el RUT estén perfectos)."""
    url = f"http://{DTEBOX_IP}/api/Core.svc/core/RecoverXML_V2"
    headers = {'AuthKey': AUTH_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json'}
    body = {
        "Environment": AMBIENTE,
        "Group": GRUPO,
        "Rut": rut_proveedor,
        "DocType": doc_type,
        "Folio": str(folio),
        "IsForDistribution": "true",
    }
    r = requests.post(url, headers=headers, json=body, timeout=60)
    r.raise_for_status()
    data = r.json()
    if str(data.get('Result')) != '0':
        raise RuntimeError(data.get('Description'))
    return base64.b64decode(data['Data'])


def sanitizar_xml(texto):
    """Mismos arreglos que sincronizar_documentos_gdexpress.py: un '&' suelto
    (típico en nombres de productos, ej. 'Sales & Geles') y caracteres de
    control inválidos rompen el XML si no se limpian antes de leerlo."""
    texto = re.sub(r'&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)', '&amp;', texto)
    texto = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F]', '', texto)
    return texto


def items_desde_xml_completo(xml_texto_saneado):
    """Extrae los ítems (productos) del XML completo — mismo bloque
    <Detalle> repetido por producto que usa el estándar SII."""
    root = ET.fromstring(xml_texto_saneado)

    def buscar_todos(tag_objetivo):
        return [el for el in root.iter() if el.tag.split('}')[-1].lower() == tag_objetivo.lower()]

    def texto_de(padre, *nombres_posibles):
        for nombre in nombres_posibles:
            for hijo in padre.iter():
                if hijo.tag.split('}')[-1].lower() == nombre.lower() and hijo is not padre:
                    return hijo.text
        return None

    def codigo_de(padre):
        for hijo in padre.iter():
            if hijo.tag.split('}')[-1].lower() == 'cdgitem':
                return texto_de(hijo, 'TpoCodigo'), texto_de(hijo, 'VlrCodigo')
        return None, None

    items = []
    for det in buscar_todos('Detalle'):
        codigo_tipo, codigo_valor = codigo_de(det)
        items.append({
            'nombre_producto': texto_de(det, 'NmbItem', 'NombreItem'),
            'cantidad': texto_de(det, 'QtyItem', 'Cantidad'),
            'unidad': texto_de(det, 'UnmdItem', 'Unidad'),
            'precio_unitario': texto_de(det, 'PrcItem', 'PrecioUnitario', 'PrecioUnit'),
            'monto_item': texto_de(det, 'MontoItem', 'MntItem'),
            'codigo_tipo': codigo_tipo,
            'codigo_valor': codigo_valor,
            'descripcion': texto_de(det, 'DscItem', 'DescripcionItem'),
        })
    return items


def nc_factura_ref_desde_xml_completo(xml_texto_saneado):
    """Para una Nota de Crédito, qué factura anula: el bloque <Referencia>
    del documento, con TpoDocRef=33 (código SII de Factura Electrónica)."""
    try:
        root = ET.fromstring(xml_texto_saneado)
    except ET.ParseError:
        return None
    for el in root.iter():
        if el.tag.split('}')[-1].lower() == 'referencia':
            tpo_doc_ref = None
            folio_ref = None
            for hijo in el.iter():
                tag = hijo.tag.split('}')[-1].lower()
                if tag == 'tpodocref':
                    tpo_doc_ref = (hijo.text or '').strip()
                elif tag == 'folioref':
                    folio_ref = (hijo.text or '').strip()
            if tpo_doc_ref == '33' and folio_ref:
                return folio_ref[:100]
    return None


def sincronizar_detalle_pendiente(limite=150):
    """Para las facturas que todavía no tienen sus productos guardados, los
    trae y los guarda — igual que su contraparte para facturas emitidas.
    Limitado por corrida para que no se demore demasiado."""
    print(f"\n{'='*50}\nTrayendo el detalle (productos) de cada factura — hasta {limite} por corrida\n{'='*50}")
    res = supabase.table('facturas_por_pagar').select('id,factura,rut_proveedor') \
        .eq('detalle_sincronizado', False).order('fecha_emision', desc=True, nullsfirst=True).limit(limite).execute()
    pendientes = res.data or []
    print(f"{len(pendientes)} facturas sin detalle todavía")

    ok, ok_sin_items, fallidos = 0, 0, 0
    for f in pendientes:
        try:
            xml_bytes = recuperar_xml_documento(f['factura'], f['rut_proveedor'])
        except Exception as e:
            print(f"  ✗ Factura {f['factura']}: no se pudo traer el XML — {e}")
            fallidos += 1
            time.sleep(1)
            continue

        xml_texto = xml_bytes.decode('iso-8859-1', errors='replace')
        xml_saneado = sanitizar_xml(xml_texto)

        items = []
        try:
            items = items_desde_xml_completo(xml_saneado)
        except Exception as e:
            print(f"  ⚠ Factura {f['factura']}: XML no se pudo interpretar ({e}) — se marca igual, sin productos.")
            ok_sin_items += 1

        try:
            if items:
                filas_items = [{**it, 'factura_id': f['id']} for it in items]
                supabase.table('facturas_por_pagar_items').insert(filas_items).execute()
            supabase.table('facturas_por_pagar').update({'detalle_sincronizado': True}).eq('id', f['id']).execute()
            ok += 1
        except Exception as e:
            print(f"  ✗ Factura {f['factura']}: no se pudo guardar en Supabase — {e}")
            fallidos += 1
        time.sleep(1)

    print(f"✔ Detalle traído: {ok} facturas guardadas ({ok - ok_sin_items} con productos, {ok_sin_items} solo marcadas). Fallidos de verdad: {fallidos}.")


def sincronizar_facturas(fecha_minima, fecha_maxima):
    """Trae las facturas (TipoDTE 33) que los proveedores le emiten a Bulfor."""
    print(f"\n{'='*50}\nFacturas recibidas (TipoDTE 33)\n{'='*50}")
    consulta = construir_consulta('33', fecha_minima, fecha_maxima)
    print(f"Desde: {fecha_minima}  Hasta: {fecha_maxima}\nConsulta: {consulta}\n")

    pagina, total_procesadas, total_paginas, paginas_con_error = 1, 0, None, []
    while True:
        print(f"Página {pagina}" + (f"/{total_paginas}" if total_paginas else "") + "...")
        try:
            data = gdexpress_get(pagina, consulta)
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

        filas = [d for d in docs if d['factura'] and d['rut_proveedor'] and d['fecha_emision'] and d['fecha_emision'] >= fecha_minima]
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


def sincronizar_notas_credito_recibidas(fecha_minima, fecha_maxima):
    """Trae las Notas de Crédito (TipoDTE 61) que los proveedores le envían
    a Bulfor — son las que anulan una factura. Sin esto, una factura
    anulada por NC se seguía viendo como pendiente para siempre."""
    print(f"\n{'='*50}\nNotas de Crédito recibidas (TipoDTE 61)\n{'='*50}")
    consulta = construir_consulta('61', fecha_minima, fecha_maxima)
    print(f"Desde: {fecha_minima}  Hasta: {fecha_maxima}\nConsulta: {consulta}\n")

    pagina, total_procesadas, total_paginas, paginas_con_error = 1, 0, None, []
    while True:
        print(f"Página {pagina}" + (f"/{total_paginas}" if total_paginas else "") + "...")
        try:
            data = gdexpress_get(pagina, consulta)
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
        docs = documentos_desde_xml(xml_bytes)
        print(f"  {len(docs)} notas de crédito en esta página")

        filas = [{
            'folio': d['factura'], 'rut_proveedor': d['rut_proveedor'], 'proveedor': d['proveedor'],
            'fecha_emision': d['fecha_emision'], 'monto': d['monto'], 'monto_total': d['monto_total'],
        } for d in docs if d['factura'] and d['rut_proveedor'] and d['fecha_emision'] and d['fecha_emision'] >= fecha_minima]
        if filas:
            supabase.table('notas_credito_recibidas').upsert(filas, on_conflict='rut_proveedor,folio').execute()
            total_procesadas += len(filas)

        if pagina >= total_paginas:
            break
        pagina += 1
        time.sleep(2)

    print(f"\n✔ Listo: {total_procesadas} notas de crédito recibidas sincronizadas.")
    if paginas_con_error:
        print(f"⚠ {len(paginas_con_error)} página(s) fallaron incluso con reintentos: {paginas_con_error}")


def sincronizar_detalle_nc_pendiente(limite=150):
    """Para las NC que todavía no sabemos a qué factura anulan, trae su XML
    completo y lo averigua — y de paso marca esa factura como anulada."""
    print(f"\n{'='*50}\nAveriguando a qué factura anula cada Nota de Crédito — hasta {limite} por corrida\n{'='*50}")
    res = supabase.table('notas_credito_recibidas').select('id,folio,rut_proveedor') \
        .eq('detalle_sincronizado', False).order('fecha_emision', desc=True, nullsfirst=True).limit(limite).execute()
    pendientes = res.data or []
    print(f"{len(pendientes)} notas de crédito sin revisar todavía")

    ok, anuladas, fallidos = 0, 0, 0
    for nc in pendientes:
        try:
            xml_bytes = recuperar_xml_documento(nc['folio'], nc['rut_proveedor'], doc_type="61")
        except Exception as e:
            print(f"  ✗ NC {nc['folio']}: no se pudo traer el XML — {e}")
            fallidos += 1
            time.sleep(1)
            continue

        xml_texto = xml_bytes.decode('iso-8859-1', errors='replace')
        xml_saneado = sanitizar_xml(xml_texto)

        factura_ref = None
        try:
            factura_ref = nc_factura_ref_desde_xml_completo(xml_saneado)
        except Exception as e:
            print(f"  ⚠ NC {nc['folio']}: XML no se pudo interpretar ({e}).")

        try:
            supabase.table('notas_credito_recibidas').update({
                'detalle_sincronizado': True,
                'factura_ref': factura_ref,
            }).eq('id', nc['id']).execute()

            if factura_ref:
                res_upd = supabase.table('facturas_por_pagar') \
                    .update({'estado_aceptacion': 'N'}) \
                    .eq('rut_proveedor', nc['rut_proveedor']).eq('factura', factura_ref).execute()
                if res_upd.data:
                    anuladas += 1
                    print(f"  ✔ NC {nc['folio']} anula la factura {factura_ref} — marcada como anulada.")
            ok += 1
        except Exception as e:
            print(f"  ✗ NC {nc['folio']}: no se pudo guardar en Supabase — {e}")
            fallidos += 1
        time.sleep(1)

    print(f"✔ Revisadas: {ok} notas de crédito ({anuladas} facturas marcadas como anuladas). Fallidos de verdad: {fallidos}.")


def main():
    fecha_min_facturas = obtener_ultima_fecha_guardada('facturas_por_pagar')
    fecha_min_nc = obtener_ultima_fecha_guardada('notas_credito_recibidas')
    fecha_maxima = datetime.now().strftime('%Y-%m-%d')
    if FORZAR_HISTORICO_COMPLETO:
        print("⚙ Se pidió el histórico completo — se ignora lo ya guardado y se busca desde el inicio.\n")

    sincronizar_facturas(fecha_min_facturas, fecha_maxima)
    sincronizar_notas_credito_recibidas(fecha_min_nc, fecha_maxima)
    sincronizar_detalle_pendiente(limite=int(os.environ.get('LIMITE_DETALLE', 150)))
    sincronizar_detalle_nc_pendiente(limite=int(os.environ.get('LIMITE_DETALLE', 150)))


if __name__ == '__main__':
    main()
