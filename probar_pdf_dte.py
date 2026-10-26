"""
DIAGNÓSTICO — ¿cómo se recupera el PDF oficial de un documento emitido?

Solo hace consultas de lectura a GDExpress para la factura de prueba
(homologación, tipo 33, folio 55). NO emite nada ni escribe en Supabase.
Prueba los nombres posibles del servicio "Recuperar PDF" y la búsqueda
paginada (que trae el enlace de descarga DownloadCustomerDocumentUrl).
"""

import os
import base64

import requests

DTEBOX_IP = os.environ['DTEBOX_IP']
AUTH_KEY = os.environ['GDEXPRESS_API_KEY']
RUT = '76186755-5'
AMB, TIPO, FOLIO = os.environ.get('AMB', 'T'), os.environ.get('TIPO', '33'), os.environ.get('FOLIO', '55')
H = {'AuthKey': AUTH_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json'}
BASE = f"http://{DTEBOX_IP}/api/Core.svc/core"


def resumen(r):
    try:
        d = r.json()
    except Exception:
        return f"HTTP {r.status_code} · no JSON: {r.text[:200]!r}"
    if isinstance(d, dict):
        partes = []
        for k, v in d.items():
            s = str(v)
            partes.append(f"{k}={s[:80]!r}{'…(' + str(len(s)) + ' car.)' if len(s) > 80 else ''}")
        return f"HTTP {r.status_code} · " + ' · '.join(partes)
    return f"HTTP {r.status_code} · {str(d)[:200]}"


def main():
    print(f"DIAGNÓSTICO PDF — solo lectura. Ambiente {AMB}, tipo {TIPO}, folio {FOLIO}\n")
    cuerpos = {
        'Group E + IsForDistribution': {'Environment': AMB, 'Group': 'E', 'Rut': RUT, 'DocType': TIPO, 'Folio': FOLIO, 'IsForDistribution': 'true'},
        'Group E': {'Environment': AMB, 'Group': 'E', 'Rut': RUT, 'DocType': TIPO, 'Folio': FOLIO},
    }
    for ruta in ['RecoverPDF_V2', 'RecoverPDF', 'RecoverPDF_V3', 'RecoverDocumentPDF', 'GetPDF']:
        for nombre, cuerpo in cuerpos.items():
            try:
                r = requests.post(f"{BASE}/{ruta}", headers=H, json=cuerpo, timeout=60)
                print(f"POST {ruta} [{nombre}]: {resumen(r)}")
            except Exception as e:
                print(f"POST {ruta} [{nombre}]: error {e}")
    # El XML (sabemos que funciona) también confirma que el documento existe.
    r = requests.post(f"{BASE}/RecoverXML_V2", headers=H, json=cuerpos['Group E + IsForDistribution'], timeout=60)
    print(f"\nPOST RecoverXML_V2: {resumen(r)}")
    q = base64.b64encode(f'(RUTEmisor:{RUT} AND TipoDTE:{TIPO} AND Folio:{FOLIO})'.encode()).decode()
    r = requests.get(f"{BASE}/PaginatedSearch/{AMB}/E/{q}/1/5", headers=H, timeout=60)
    print(f"\nGET PaginatedSearch: {resumen(r)}")
    try:
        datos = r.json().get('Data')
        if datos:
            xml = base64.b64decode(datos).decode('latin-1')
            for etiqueta in ('DownloadCustomerDocumentUrl', 'DownloadDocumentUrl', 'Url', 'PDF'):
                i = xml.find(f'<{etiqueta}')
                if i >= 0:
                    print(f"  {etiqueta}: {xml[i:i+250]!r}")
            print(f"  (largo XML de la búsqueda: {len(xml)})")
    except Exception as e:
        print(f"  no se pudo leer Data: {e}")


def listar_homologacion():
    # Qué documentos de prueba (T) SÍ muestra la plataforma, para comparar.
    import re
    q = base64.b64encode(f'(RUTEmisor:{RUT})'.encode()).decode()
    r = requests.get(f"{BASE}/PaginatedSearch/{AMB}/E/{q}/1/50", headers=H, timeout=60)
    d = r.json()
    print(f"\nDocumentos emitidos visibles en ambiente {AMB}: {d.get('TotalDocuments')}")
    xml = base64.b64decode(d.get('Data') or '').decode('latin-1')
    for doc in re.findall(r'<document>(.*?)</document>', xml, re.S)[:50]:
        campos = {k: (re.search(f'<{k}>([^<]*)</{k}>', doc) or [None, ''])[1] for k in ('TipoDTE', 'Folio', 'FchEmis', 'FechaEmision', 'RznSocRecep', 'Estado', 'EstadoSII')}
        print('  ' + ' · '.join(f'{k}={v}' for k, v in campos.items() if v))
    if not re.findall(r'<document>', xml):
        print('  (XML) ' + xml[:600])


if __name__ == '__main__':
    listar_homologacion()
    main()
