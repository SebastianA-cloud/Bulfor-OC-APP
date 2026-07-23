"""
Diagnóstico puntual: trae el XML COMPLETO (RecoverXML_V2) de un solo
documento y muestra el valor real del campo Anulado/AutorizadoSII, para
comparar contra lo que trae el resumen de PaginatedSearch.

No guarda nada en Supabase — solo imprime en el log.
"""

import os
import base64
import requests

DTEBOX_IP = os.environ['DTEBOX_IP']
AUTH_KEY = os.environ['GDEXPRESS_API_KEY']

AMBIENTE = 'P'
GRUPO = 'E'
RUT_EMISOR = '76186755-5'

# Cambia estos dos datos para revisar otro documento
TIPO_DTE = '33'
FOLIO = '21434'


def main():
    url = f"http://{DTEBOX_IP}/api/Core.svc/core/RecoverXML_V2"
    headers = {'AuthKey': AUTH_KEY, 'Content-Type': 'application/json', 'Accept': 'application/json'}
    body = {
        "Environment": AMBIENTE,
        "Group": GRUPO,
        "Rut": RUT_EMISOR,
        "DocType": TIPO_DTE,
        "Folio": FOLIO,
        "IsForDistribution": "true",
    }
    print(f"Consultando folio {FOLIO} (tipo {TIPO_DTE})...\n")
    r = requests.post(url, headers=headers, json=body, timeout=60)
    print(f"HTTP status: {r.status_code}\n")
    data = r.json()
    print("Result:", data.get('Result'), "| Description:", data.get('Description'), "\n")

    if str(data.get('Result')) != '0':
        print("⚠ La API devolvió un error, no hay XML para mostrar.")
        return

    xml_bytes = base64.b64decode(data['Data'])
    xml_texto = xml_bytes.decode('iso-8859-1', errors='replace')

    print("=== XML completo ===\n")
    print(xml_texto)

    with open('folio_21434.xml', 'w', encoding='utf-8') as f:
        f.write(xml_texto)
    print("\n✔ Guardado también en folio_21434.xml")


if __name__ == '__main__':
    main()
