"""
Sincronización del estado de los envíos FedEx (FedEx Track API -> Supabase).

Reemplaza a los correos de aviso de FedEx (que dejaron de llegar): consulta
directamente a FedEx, con el N° de orden de transporte, en qué va cada envío
y lo deja en seguimiento_fedex, que es lo que muestra "Seguimiento FedEx".

Usa la API oficial gratuita "Basic Integrated Visibility" (antes Track API)
del FedEx Developer Portal, con las claves guardadas en GitHub Secrets
(FEDEX_API_KEY y FEDEX_SECRET_KEY).

Qué consulta:
  - Solo los envíos de los últimos DIAS_ATRAS días que todavía NO están
    "Entregado". Lo entregado ya no cambia, así que no se vuelve a preguntar.

Qué escribe (solo estas tres columnas, nunca otras):
  - estado_envio: Recibido por FedEx / En ruta / Retraso /
    Entrega reprogramada / Entregado (los mismos de la app).
  - fecha_entrega: el día en que FedEx lo entregó.
  - recibido_por: el nombre de quien firmó la entrega.
  Si FedEx todavía no tiene información del envío (recién creado), no se
  toca nada.

Modos (variable MODO):
  - "probar": solo muestra lo que cambiaría, sin escribir nada.
  - "escribir": guarda los cambios en Supabase.
"""

import os
import sys
import time
from datetime import datetime, timedelta, timezone

import requests
from supabase import create_client

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']
FEDEX_API_KEY = os.environ['FEDEX_API_KEY']
FEDEX_SECRET_KEY = os.environ['FEDEX_SECRET_KEY']
MODO = os.environ.get('MODO', 'probar').strip().lower()

FEDEX_URL = 'https://apis.fedex.com'
DIAS_ATRAS = 45          # envíos más antiguos que esto ya no se consultan
POR_CONSULTA = 30        # FedEx acepta hasta 30 números por consulta


def token_fedex():
    r = requests.post(f'{FEDEX_URL}/oauth/token', timeout=30, data={
        'grant_type': 'client_credentials',
        'client_id': FEDEX_API_KEY,
        'client_secret': FEDEX_SECRET_KEY,
    })
    if r.status_code != 200:
        sys.exit(f'FedEx no aceptó las claves (HTTP {r.status_code}): {r.text[:300]}')
    return r.json()['access_token']


def rastrear(token, numeros):
    """Devuelve {numero: resultado de FedEx} para un grupo de hasta 30 números."""
    r = requests.post(f'{FEDEX_URL}/track/v1/trackingnumbers', timeout=60,
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json', 'X-locale': 'es_CL'},
        json={
            'includeDetailedScans': False,
            'trackingInfo': [{'trackingNumberInfo': {'trackingNumber': n}} for n in numeros],
        })
    if r.status_code != 200:
        print(f'  ! FedEx respondió HTTP {r.status_code}: {r.text[:300]}')
        return {}
    salida = {}
    for completo in r.json().get('output', {}).get('completeTrackResults', []):
        resultados = completo.get('trackResults') or [{}]
        salida[completo.get('trackingNumber')] = resultados[0]
    return salida


def traducir(res):
    """Pasa la respuesta de FedEx a los datos que usa la app.
    Devuelve None si FedEx todavía no tiene información útil del envío."""
    if not res or res.get('error'):
        return None
    det = res.get('latestStatusDetail') or {}
    codigo = (det.get('derivedCode') or det.get('code') or '').upper()
    descripcion = det.get('statusByLocale') or det.get('description') or ''
    atrasado = (det.get('delayDetail') or {}).get('status') == 'DELAYED'

    datos = {'codigo': codigo, 'descripcion': descripcion}
    if codigo == 'DL':
        datos['estado_envio'] = 'Entregado'
        for f in res.get('dateAndTimes') or []:
            if f.get('type') == 'ACTUAL_DELIVERY' and f.get('dateTime'):
                # FedEx entrega la hora local del destino: basta con el día.
                datos['fecha_entrega'] = f['dateTime'][:10]
        nombre = ((res.get('deliveryDetails') or {}).get('receivedByName') or '').strip()
        if nombre:
            datos['recibido_por'] = nombre
    elif codigo == 'DE':
        datos['estado_envio'] = 'Entrega reprogramada'   # intento de entrega fallido
    elif codigo in ('SE', 'DY', 'CD') or atrasado:
        datos['estado_envio'] = 'Retraso'
    elif codigo in ('PU', 'PX', 'HP'):   # HP = "Tenemos su paquete"
        datos['estado_envio'] = 'Recibido por FedEx'
    elif codigo in ('OC', 'CA', ''):
        return None   # solo etiqueta creada / sin movimiento: no se toca
    else:
        datos['estado_envio'] = 'En ruta'               # IT, AR, DP, OD, AF, etc.
    return datos


def main():
    print(f'Modo: {MODO.upper()}' + ('  (no se escribe nada)' if MODO != 'escribir' else ''))
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)
    desde = (datetime.now(timezone.utc) - timedelta(days=DIAS_ATRAS)).isoformat()
    filas = (sb.table('seguimiento_fedex')
               .select('id, orden_transporte, factura, estado_envio, fecha_entrega, recibido_por')
               .gte('fecha_ingreso', desde).execute().data)
    # En modo prueba también se revisan algunos ya entregados, para comparar
    # lo que dice FedEx con lo que se anotó a mano.
    pendientes = [f for f in filas if f.get('orden_transporte') and (f.get('estado_envio') != 'Entregado' or MODO != 'escribir')]
    print(f'{len(pendientes)} envíos a consultar (de {len(filas)} en los últimos {DIAS_ATRAS} días)\n')
    if not pendientes:
        return

    token = token_fedex()
    cambios = 0
    for i in range(0, len(pendientes), POR_CONSULTA):
        grupo = pendientes[i:i + POR_CONSULTA]
        resultados = rastrear(token, [f['orden_transporte'].strip() for f in grupo])
        for f in grupo:
            datos = traducir(resultados.get(f['orden_transporte'].strip()))
            etiqueta = f"OT {f['orden_transporte']} (factura {f.get('factura') or '—'})"
            if not datos:
                print(f'  {etiqueta}: FedEx aún sin información')
                continue
            nuevo = {k: datos[k] for k in ('estado_envio', 'fecha_entrega', 'recibido_por') if k in datos}
            actual = {k: (str(f.get(k) or '')[:10] if k == 'fecha_entrega' else f.get(k)) for k in nuevo}
            if nuevo == actual:
                print(f"  {etiqueta}: sin cambios ({nuevo['estado_envio']})")
                continue
            cambios += 1
            print(f"  {etiqueta}: {f.get('estado_envio') or 'Sin información'} -> {nuevo['estado_envio']}"
                  f"  [{datos['codigo']} · {datos['descripcion']}]"
                  + (f"  entrega {nuevo.get('fecha_entrega', '')} a {nuevo.get('recibido_por', '')}" if 'fecha_entrega' in nuevo else ''))
            if MODO == 'escribir' and f.get('estado_envio') != 'Entregado':
                nuevo['updated_at'] = datetime.now(timezone.utc).isoformat()
                sb.table('seguimiento_fedex').update(nuevo).eq('id', f['id']).execute()
        time.sleep(1)

    print(f'\n{cambios} envíos con cambios' + (' guardados.' if MODO == 'escribir' else ' (no se guardó nada: modo prueba).'))


if __name__ == '__main__':
    main()
