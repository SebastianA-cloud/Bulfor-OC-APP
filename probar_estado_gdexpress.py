"""
DIAGNÓSTICO — ¿qué campo de GDExpress dice que una factura está rechazada?

Por qué existe este script
──────────────────────────
En el portal de GDExpress las facturas 22233, 22234 y 22236 tienen la luz
"L" en rojo (rechazo), pero en el programa salen como "Aceptada". La
sincronización solo lee dos campos del listado (Anulado y AutorizadoSII) y
el estado fiscal del SII, que para estas tres es 0 (autorizado). El dato del
rechazo tiene que venir en algún otro campo que hoy ignoramos.

Qué hace
────────
NO escribe nada en Supabase. Pide a GDExpress las facturas emitidas de los
días de esos folios, imprime TODOS los campos de cada una y marca cuáles
campos tienen un valor distinto en las rechazadas respecto de las demás.
Ese campo es el que hay que empezar a leer en la sincronización.

Cómo correrlo
─────────────
GitHub -> Actions -> "Diagnóstico estado GDExpress" -> Run workflow.
También corre solo al subir cambios a este script en la rama separar-css.
"""

import os
import base64
import xml.etree.ElementTree as ET

import requests

DTEBOX_IP = os.environ['DTEBOX_IP']
AUTH_KEY = os.environ['GDEXPRESS_API_KEY']

AMBIENTE = 'P'
GRUPO = 'E'
RUT_EMISOR = '76186755-5'

# Las que en GDExpress tienen la "L" en rojo y en el programa salen aceptadas.
FOLIOS_RECHAZADOS = ['22233', '22234', '22236']
# Días de emisión de esos folios: las demás facturas de esos días sirven de comparación.
FECHA_DESDE = '2026-10-07'
FECHA_HASTA = '2026-10-08'
MAX_REFERENCIAS = 5

HEADERS = {'AuthKey': AUTH_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json'}


def titulo(texto):
    print(f"\n{'=' * 68}\n{texto}\n{'=' * 68}")


def buscar_documentos():
    consulta = f'(RUTEmisor:{RUT_EMISOR} AND TipoDTE:33 AND FchEmis:[{FECHA_DESDE} TO {FECHA_HASTA}])'
    query_b64 = base64.b64encode(consulta.encode('utf-8')).decode('ascii')
    url = f"http://{DTEBOX_IP}/api/Core.svc/core/PaginatedSearch/{AMBIENTE}/{GRUPO}/{query_b64}/1/300"
    r = requests.get(url, headers=HEADERS, timeout=120)
    r.raise_for_status()
    data = r.json()
    print(f"Result={data.get('Result')} · TotalDocuments={data.get('TotalDocuments')} · {data.get('Description')}")
    if str(data.get('Result')) != '0' or not data.get('Data'):
        return None
    return base64.b64decode(data['Data'])


def campos_de(doc):
    """Todos los campos del documento, incluidos los anidados (ruta/del/campo)."""
    campos = {}

    def recorrer(el, prefijo):
        hijos = list(el)
        if not hijos:
            campos[prefijo] = (el.text or '').strip()
            return
        for hijo in hijos:
            nombre = hijo.tag.split('}')[-1]
            recorrer(hijo, f"{prefijo}/{nombre}" if prefijo else nombre)

    recorrer(doc, '')
    return campos


def main():
    print("DIAGNÓSTICO DE ESTADO GDEXPRESS — no escribe nada en la base de datos.")
    titulo(f'1. Facturas emitidas entre {FECHA_DESDE} y {FECHA_HASTA}')
    xml_bytes = buscar_documentos()
    if not xml_bytes:
        print("GDExpress no devolvió documentos para ese rango. Nada que comparar.")
        return

    root = ET.fromstring(xml_bytes)
    docs = [campos_de(d) for d in root.findall('document')]
    print(f"{len(docs)} facturas recibidas.")

    rechazadas = [d for d in docs if d.get('Folio') in FOLIOS_RECHAZADOS]
    referencias = [d for d in docs if d.get('Folio') not in FOLIOS_RECHAZADOS][:MAX_REFERENCIAS]
    faltan = set(FOLIOS_RECHAZADOS) - {d.get('Folio') for d in rechazadas}
    if faltan:
        print(f"⚠ No vinieron en la búsqueda: {sorted(faltan)}")

    titulo('2. Todos los campos de cada factura')
    for grupo, lista in (('RECHAZADA EN GDEXPRESS', rechazadas), ('REFERENCIA (no rechazada)', referencias)):
        for d in lista:
            print(f"\n--- Folio {d.get('Folio')} · {grupo} ---")
            for campo, valor in sorted(d.items()):
                print(f"  {campo} = {valor}")

    titulo('3. Campos que distinguen a las rechazadas')
    if not rechazadas or not referencias:
        print("Faltan rechazadas o referencias para comparar.")
        return
    todos = sorted({c for d in rechazadas + referencias for c in d})
    encontrados = 0
    for campo in todos:
        vals_rech = {d.get(campo, '(no viene)') for d in rechazadas}
        vals_ref = {d.get(campo, '(no viene)') for d in referencias}
        if len(vals_rech) == 1 and not (vals_rech & vals_ref):
            encontrados += 1
            print(f"  ★ {campo}: rechazadas = {sorted(vals_rech)} · referencias = {sorted(vals_ref)}")
    if not encontrados:
        print("Ningún campo separa limpiamente a las rechazadas de las demás.")
        print("Revisa el punto 2 a mano: puede que todas las de esos días estén rechazadas,")
        print("o que el dato no venga en el listado y haya que pedirlo de otra forma.")


if __name__ == '__main__':
    main()
