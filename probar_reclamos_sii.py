"""
DIAGNÓSTICO — ¿de dónde sacamos el reclamo del receptor?

Por qué existe este script
──────────────────────────
La sincronización de hoy pregunta por el estado FISCAL de cada documento:

    core/FiscalStatus/...  ->  0 autorizado · 1 pendiente · 2 con reparos · 9 rechazado

Eso responde "¿el SII aceptó este documento como válido?" (firma, folio,
esquema). NO responde "¿el hospital reclamó esta factura?", que es otra cosa
completamente distinta: el reclamo comercial de la Ley 19.983, que el receptor
puede registrar dentro de 8 días corridos y que aparece como un EVENTO sobre
el documento, no como un cambio en su estado fiscal.

Por eso hay facturas que en el portal del SII salen reclamadas y en el
programa figuran como aceptadas: nunca hemos preguntado por el reclamo.

Qué hace este script
────────────────────
NO escribe nada. Solo mira y reporta:

  1. Intenta listar las operaciones que expone la API de DTEBox, para saber
     con qué contamos de verdad en vez de adivinar.
  2. Muestra qué devuelve FiscalStatus para folios concretos — incluido uno
     que sabemos que el SII rechazó (22050) y varios que el hospital reclamó
     pero que nosotros tenemos como aceptados.
  3. Prueba los nombres de endpoint más probables para eventos/reclamo y
     reporta cuál responde y con qué forma.

Con esa salida se escribe el arreglo de verdad, sin inventar.

Cómo correrlo
─────────────
Desde GitHub: pestaña Actions -> "Diagnóstico reclamos SII" -> Run workflow.
Las credenciales salen de los mismos secretos que ya usa la sincronización.
"""

import os
import json
import requests

DTEBOX_IP = os.environ['DTEBOX_IP']
AUTH_KEY = os.environ['GDEXPRESS_API_KEY']

AMBIENTE = 'P'
GRUPO = 'E'
RUT_EMISOR = '76186755-5'

HEADERS = {'AuthKey': AUTH_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json'}

# Folios elegidos a propósito:
#   22050 -> el único que la sincronización marcó como rechazado (status 9).
#   el resto -> los que Sebastián vio reclamados en el portal del SII y que
#               nosotros tenemos guardados como aceptados (status 0).
FOLIOS_PRUEBA = ['22050', '21961', '21978', '22012', '22033', '22041', '22054']

# Nombres de operación que suelen exponer las APIs tipo DTEBox para el
# acuse/reclamo del receptor. Se prueban todos y se reporta cuál existe;
# los que devuelvan 404 simplemente no están.
CANDIDATOS = [
    'CommercialStatus/{amb}/{grupo}/{rut}/{tipo}/{folio}',
    'CommercialStatus/{amb}/{grupo}/{tipo}/{folio}',
    'GetCommercialStatus/{amb}/{grupo}/{rut}/{tipo}/{folio}',
    'DocumentEvents/{amb}/{grupo}/{rut}/{tipo}/{folio}',
    'GetEvents/{amb}/{grupo}/{rut}/{tipo}/{folio}',
    'Events/{amb}/{grupo}/{rut}/{tipo}/{folio}',
    'AcknowledgeStatus/{amb}/{grupo}/{rut}/{tipo}/{folio}',
    'ReceiptStatus/{amb}/{grupo}/{rut}/{tipo}/{folio}',
    'GetDocumentStatus/{amb}/{grupo}/{rut}/{tipo}/{folio}',
    'Status/{amb}/{grupo}/{rut}/{tipo}/{folio}',
]


def titulo(texto):
    print(f"\n{'=' * 68}\n{texto}\n{'=' * 68}")


def pedir(ruta, timeout=30):
    """Devuelve (status_http, cuerpo) sin reventar si algo falla."""
    url = f"http://{DTEBOX_IP}/api/Core.svc/core/{ruta}"
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout)
        try:
            return r.status_code, r.json()
        except ValueError:
            return r.status_code, r.text[:1500]
    except requests.exceptions.RequestException as e:
        return None, f"(no se pudo conectar: {e})"


def listar_operaciones():
    """Muchas APIs WCF publican su lista de operaciones en /help o en el WSDL.
    Si está, nos ahorra adivinar."""
    titulo('1. ¿Qué operaciones expone la API?')
    for ruta in ('help', '?wsdl', '$metadata'):
        url = f"http://{DTEBOX_IP}/api/Core.svc/{ruta}"
        try:
            r = requests.get(url, headers={'AuthKey': AUTH_KEY}, timeout=30)
            print(f"\n--- {url}  ->  HTTP {r.status_code} ---")
            if r.status_code == 200:
                print(r.text[:4000])
            else:
                print("(no disponible por esta vía)")
        except requests.exceptions.RequestException as e:
            print(f"\n--- {url}  ->  no se pudo conectar: {e}")


def estado_fiscal_de_los_folios():
    titulo('2. Qué devuelve HOY FiscalStatus para estos folios')
    print("Recordatorio: 0 = autorizado por el SII · 1 = pendiente · "
          "2 = con reparos · 9 = rechazado por el SII\n")
    for folio in FOLIOS_PRUEBA:
        code, cuerpo = pedir(f"FiscalStatus/{AMBIENTE}/{GRUPO}/{RUT_EMISOR}/33/{folio}")
        if isinstance(cuerpo, dict):
            print(f"  Folio {folio}: HTTP {code} · Status={cuerpo.get('Status')} · "
                  f"Result={cuerpo.get('Result')} · {cuerpo.get('Description')}")
        else:
            print(f"  Folio {folio}: HTTP {code} · {cuerpo}")


def buscar_endpoint_de_reclamo():
    titulo('3. ¿Existe algún endpoint de eventos / acuse / reclamo?')
    print("Se prueba cada nombre candidato con el folio 21961 (reclamado según el SII).\n")
    encontrados = []
    for plantilla in CANDIDATOS:
        ruta = plantilla.format(amb=AMBIENTE, grupo=GRUPO, rut=RUT_EMISOR, tipo='33', folio='21961')
        code, cuerpo = pedir(ruta, timeout=20)
        marca = '✔' if code == 200 else ' '
        resumen = json.dumps(cuerpo, ensure_ascii=False)[:300] if isinstance(cuerpo, dict) else str(cuerpo)[:300]
        print(f"  {marca} HTTP {code!s:>5}  {plantilla.split('/')[0]:<22} {resumen}")
        if code == 200:
            encontrados.append((plantilla, cuerpo))

    titulo('RESULTADO')
    if encontrados:
        print(f"Respondieron {len(encontrados)} endpoint(s). Detalle completo:\n")
        for plantilla, cuerpo in encontrados:
            print(f"--- {plantilla} ---")
            print(json.dumps(cuerpo, indent=2, ensure_ascii=False)[:3000])
            print()
        print("Con esto se puede escribir el arreglo real de la sincronización.")
    else:
        print("Ninguno de los nombres probados respondió.")
        print("Eso NO significa que no exista — significa que hay que mirar la")
        print("documentación de GDExpress, o pedirles a ellos cuál es el endpoint")
        print("del acuse/reclamo del receptor. Manda la salida del punto 1 si trajo algo.")


def main():
    print("DIAGNÓSTICO DE RECLAMOS — no escribe nada en la base de datos.")
    print(f"DTEBox: {DTEBOX_IP} · ambiente {AMBIENTE} · grupo {GRUPO} · emisor {RUT_EMISOR}")
    listar_operaciones()
    estado_fiscal_de_los_folios()
    buscar_endpoint_de_reclamo()


if __name__ == '__main__':
    main()
