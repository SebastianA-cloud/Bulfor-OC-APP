"""
Script de PRUEBA — solo para ver qué trae realmente la API de GDExpress.
No guarda nada en Supabase todavía. Corre esto primero, mándame la salida
(el XML decodificado) y con eso armamos el script real de sincronización.

Cómo correrlo:
  1. pip install requests
  2. Reemplaza DTEBOX_IP y AUTH_KEY abajo (o pásalos como variables de entorno)
  3. python probar_gdexpress.py
"""

import os
import base64
import json
import requests

DTEBOX_IP = os.environ.get('DTEBOX_IP', '200.6.118.254')
AUTH_KEY = os.environ.get('GDEXPRESS_API_KEY', 'PEGA_AQUI_TU_API_KEY')

# Empezamos en Homologación ('T') para no mezclar con datos reales de producción
# mientras probamos. Una vez que confirmemos que todo funciona, cambiamos a 'P'.
AMBIENTE = 'T'   # T = Homologación, P = Producción
GRUPO = 'E'      # E = Emitidos (facturas que Bulfor emite), R = Recibidos
CONSULTA = 'TipoDTE:33'  # 33 = Factura Electrónica
PAGINA = 1
TAMANO_PAGINA = 5  # chico a propósito, solo para ver la forma de los datos


def main():
    query_b64 = base64.b64encode(CONSULTA.encode('utf-8')).decode('ascii')
    url = f"http://{DTEBOX_IP}/api/Core.svc/core/PaginatedSearch/{AMBIENTE}/{GRUPO}/{query_b64}/{PAGINA}/{TAMANO_PAGINA}"

    headers = {
        'AuthKey': AUTH_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }

    print(f"Consultando: {url}\n")
    r = requests.get(url, headers=headers, timeout=30)
    print(f"HTTP status: {r.status_code}\n")

    try:
        data = r.json()
    except Exception:
        print("La respuesta no fue JSON válido. Texto crudo:")
        print(r.text[:2000])
        return

    print("=== Respuesta (sin el campo Data, que viene aparte) ===")
    resumen = {k: v for k, v in data.items() if k != 'Data'}
    print(json.dumps(resumen, indent=2, ensure_ascii=False))

    if str(data.get('Result')) != '0':
        print("\n⚠ La API devolvió un error:", data.get('Description'))
        return

    if not data.get('Data'):
        print("\n⚠ No vino nada en 'Data' — probablemente no hay documentos en Homologación.")
        print("   Si esto pasa, cambia AMBIENTE = 'P' arriba y prueba de nuevo (con cuidado, ya es producción).")
        return

    xml_bytes = base64.b64decode(data['Data'])
    xml_texto = xml_bytes.decode('utf-8', errors='replace')

    print("\n=== XML decodificado (esto es lo importante — mándame esta parte) ===\n")
    print(xml_texto[:5000])

    with open('respuesta_gdexpress.xml', 'w', encoding='utf-8') as f:
        f.write(xml_texto)
    print("\n✔ Guardado también en respuesta_gdexpress.xml por si es muy largo para la consola.")


if __name__ == '__main__':
    main()
