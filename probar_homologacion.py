"""
DIAGNÓSTICO — ¿la cuenta de GDExpress tiene habilitado el ambiente de
homologación (T)?

Solo hace consultas de lectura (buscar documentos) con Environment=T y,
para comparar, con P. NO emite documentos ni escribe nada en Supabase.

Cómo correrlo: GitHub -> Actions -> "Diagnóstico homologación GDExpress"
-> Run workflow. También corre solo al subir cambios a este script en la
rama separar-css.
"""

import os
import base64

import requests

DTEBOX_IP = os.environ['DTEBOX_IP']
AUTH_KEY = os.environ['GDEXPRESS_API_KEY']
RUT_EMISOR = '76186755-5'
HEADERS = {'AuthKey': AUTH_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json'}


def buscar(ambiente, grupo, consulta):
    q = base64.b64encode(consulta.encode('utf-8')).decode('ascii')
    url = f"http://{DTEBOX_IP}/api/Core.svc/core/PaginatedSearch/{ambiente}/{grupo}/{q}/1/5"
    try:
        r = requests.get(url, headers=HEADERS, timeout=60)
    except Exception as e:
        return f"error de conexión: {e}"
    try:
        d = r.json()
    except Exception:
        return f"HTTP {r.status_code} · respuesta no JSON: {r.text[:300]}"
    return f"HTTP {r.status_code} · Result={d.get('Result')} · TotalDocuments={d.get('TotalDocuments')} · Description={d.get('Description')}"


def main():
    print("DIAGNÓSTICO HOMOLOGACIÓN — solo lectura, no emite nada.\n")
    consultas = [
        ('Emitidos (cualquier fecha)', 'E', f'(RUTEmisor:{RUT_EMISOR})'),
        ('Emitidos tipo 33', 'E', f'(RUTEmisor:{RUT_EMISOR} AND TipoDTE:33)'),
    ]
    for ambiente in ('T', 'P'):
        print(f"=== Environment = {ambiente} ({'homologación' if ambiente == 'T' else 'producción'}) ===")
        for nombre, grupo, consulta in consultas:
            print(f"  {nombre}: {buscar(ambiente, grupo, consulta)}")
        print()


if __name__ == '__main__':
    main()
