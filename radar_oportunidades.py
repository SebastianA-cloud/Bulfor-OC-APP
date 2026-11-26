"""
Radar de oportunidades — licitaciones y compras ágiles abiertas en Mercado Público.
(Pedido por Seba el 26-11-2026.)

Qué hace:
  1. COMPRAS ÁGILES (API nueva de ChileCompra, api2.mercadopublico.cl):
     trae TODAS las compras ágiles publicadas desde la última revisión (todo
     Chile, sin monto mínimo) y busca las palabras clave en el nombre. Las que
     calzan, o que son de un hospital que ya es cliente, se consultan en detalle
     (descripción y productos) para confirmar.
  2. LICITACIONES (API de siempre): trae el listado de licitaciones activas
     (solo trae código, nombre y fecha de cierre). Las que por el nombre pueden
     ser de medicamentos o magistrales se consultan una sola vez en detalle y se
     revisan sus productos.
  3. Guarda el resultado en la tabla mp_oportunidades (no toca ninguna otra).
     Las licitaciones revisadas que no calzan quedan con prioridad vacía, para no
     volver a consultarlas en cada corrida (la app no las muestra).

Prioridad:
  alta  = dice magistral/recetario/preparado/oficinal/papelillos…, o es de un
          hospital cliente y pide un producto que Bulfor vende.
  media = pide un producto que Bulfor vende, o es de un cliente y pide una forma
          farmacéutica típica (jarabe, cápsulas, suspensión oral…).
  baja  = solo coincide una forma farmacéutica, o es una licitación de
          medicamentos de un hospital cliente (la app las oculta por defecto).

Uso:
  python radar_oportunidades.py            # corrida normal (cada 2 horas)
  python radar_oportunidades.py --probar   # no guarda nada, solo muestra
"""

import os, re, sys, time, unicodedata
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import requests
from supabase import create_client

MP_TICKET = os.environ['MP_TICKET']
PROBAR = '--probar' in sys.argv

V1 = "https://api.mercadopublico.cl/servicios/v1/publico"
V2 = "https://api2.mercadopublico.cl/v2/compra-agil"
CHILE = ZoneInfo("America/Santiago")

supabase = None if PROBAR and not os.environ.get('SUPABASE_URL') else \
    create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_KEY'])


# ─── PALABRAS CLAVE ─────────────────────────────────────────────────────────
# Sacadas de las OC de Bulfor de los últimos 18 meses (26-11-2026). Se comparan
# sin tildes y en minúsculas. Cada una es una expresión regular corta.
FUERTES = [  # hablan directamente de recetario magistral
    r'magistral', r'recetario', r'preparados? farmac', r'preparado magistral',
    r'\bformulas?\b(?! ?(de )?(inscripcion|postulacion))', r'oficinal',
    r'papelillos?', r'encapsulad', r'fraccionamiento',
]
PRODUCTOS = [  # productos que Bulfor vende seguido a hospitales
    r'polietilenglicol', r'\bpeg\b', r'bicarbonato de sodio', r'carnitina',
    r'espironolactona', r'primidona', r'captopril', r'hidralazina', r'lugol',
    r'vaselina liquida', r'pasta (de )?lassar', r'permetrina', r'subgalato',
    r'tricloroacetico', r'hidrato de cloral', r'dapsona', r'colestiramina',
    r'coenzima', r'\bq10\b', r'tiamina', r'piridoxina', r'biotina', r'arginina',
    r'acetilcisteina', r'hidroclorotiazida', r'carvedilol', r'cafeina',
    r'novobase', r'acido acetico', r'salicilad', r'micofenolato', r'disulfiramo',
    r'dietilestilbestrol', r'fenobarbital', r'sildenafil', r'omeprazol (suspension|jarabe|pellets)',
]
FORMAS = [  # formas farmacéuticas típicas de magistrales (por sí solas pesan poco)
    r'capsulas?', r'jarabe', r'suspension oral', r'solucion oral', r'pellets',
]
# Nombres que pueden ser de medicamentos: vale la pena abrirlos en detalle
# (licitaciones siempre; compras ágiles solo si son de un hospital cliente)
LICITACION_CANDIDATA = re.compile(
    r'magistral|recetario|preparad|medicament|farmac|farmaco|suplement|formula|oficinal|papelillo')


def sin_tildes(t):
    t = unicodedata.normalize('NFD', (t or '').lower())
    return ''.join(c for c in t if unicodedata.category(c) != 'Mn')


def buscar(texto, lista):
    """Devuelve las palabras de la lista que aparecen en el texto (sin repetir)."""
    t = sin_tildes(texto)
    encontradas = []
    for patron in lista:
        m = re.search(patron, t)
        if m and m.group(0).strip() not in encontradas:
            encontradas.append(m.group(0).strip())
    return encontradas


def clasificar(texto, es_cliente, medicamento=False):
    """Prioridad y palabras encontradas para un texto (nombre + descripción + productos)."""
    f, p, fo = buscar(texto, FUERTES), buscar(texto, PRODUCTOS), buscar(texto, FORMAS)
    palabras = f + p + fo
    if f or (es_cliente and p):
        prio = 'alta'
    elif p or (es_cliente and fo):
        prio = 'media'
    elif fo or (es_cliente and medicamento):
        prio = 'baja'
    else:
        prio = None
    return prio, palabras


# ─── FECHAS ─────────────────────────────────────────────────────────────────
def fecha_chile(s):
    """Las fechas sin zona de Mercado Público son hora de Chile; las con 'Z' son UTC."""
    if not s:
        return None
    s = str(s).strip().replace(' ', 'T')
    try:
        if s.endswith('Z'):
            return datetime.fromisoformat(s[:-1]).replace(tzinfo=timezone.utc).isoformat()
        d = datetime.fromisoformat(s[:19])
        return d.replace(tzinfo=CHILE).isoformat()
    except ValueError:
        return None


# ─── LLAMADAS A LA API (con esperas si pide calma) ───────────────────────────
def pedir(url, params=None, headers=None, intentos=5):
    espera = 3
    for i in range(intentos):
        try:
            r = requests.get(url, params=params, headers=headers, timeout=60)
        except requests.RequestException as e:
            print(f"    ⚠ error de red ({e}), reintento en {espera}s")
            time.sleep(espera); espera *= 2
            continue
        if r.status_code == 429 or r.status_code >= 500:
            print(f"    ⏳ la API respondió {r.status_code}, espero {espera}s")
            time.sleep(espera); espera *= 2
            continue
        r.raise_for_status()
        js = r.json()
        # La API antigua a veces responde 200 con un error de "peticiones simultáneas"
        if isinstance(js, dict) and js.get('Codigo') == 10500:
            time.sleep(espera); espera *= 2
            continue
        return js
    raise RuntimeError(f"La API no respondió bien tras {intentos} intentos: {url}")


def v2(ruta='', params=None):
    return pedir(V2 + ruta, params=params, headers={'ticket': MP_TICKET})


def v1(servicio, params):
    p = dict(params); p['ticket'] = MP_TICKET
    return pedir(f"{V1}/{servicio}.json", params=p)


# ─── DATOS QUE YA TENEMOS ───────────────────────────────────────────────────
def ruts_clientes():
    """RUT de los hospitales que ya le compran a Bulfor (hospitales_maestro)."""
    if not supabase:
        return set()
    res = supabase.table('hospitales_maestro').select('rut').execute()
    return {norm_rut(r['rut']) for r in res.data or [] if r.get('rut')}


def norm_rut(r):
    return re.sub(r'[^0-9k]', '', str(r or '').lower())


def codigos_guardados(tipo):
    if not supabase:
        return set()
    out, desde = set(), 0
    while True:
        res = supabase.table('mp_oportunidades').select('codigo').eq('tipo', tipo) \
            .range(desde, desde + 999).execute()
        out |= {r['codigo'] for r in res.data or []}
        if len(res.data or []) < 1000:
            return out
        desde += 1000


def ultima_publicacion_compra_agil():
    if not supabase:
        return None
    res = supabase.table('mp_oportunidades').select('fecha_publicacion').eq('tipo', 'compra_agil') \
        .order('fecha_publicacion', desc=True).limit(1).execute()
    if res.data and res.data[0].get('fecha_publicacion'):
        return datetime.fromisoformat(res.data[0]['fecha_publicacion'])
    return None


def guardar(filas):
    if not filas:
        return
    if PROBAR or not supabase:
        for f in filas:
            if f['prioridad']:
                print(f"    [{f['prioridad']}] {f['codigo']} · {f['organismo']} · {f['nombre'][:80]} · {f['palabras']}")
        return
    for i in range(0, len(filas), 200):
        supabase.table('mp_oportunidades').upsert(filas[i:i + 200], on_conflict='codigo',
                                                  returning='minimal').execute()


# ─── 1. COMPRAS ÁGILES ──────────────────────────────────────────────────────
def compras_agiles(clientes):
    print("\n── Compras ágiles ──")
    ultima = ultima_publicacion_compra_agil()
    ahora = datetime.now(timezone.utc)
    if ultima:
        # Desde la última revisada (con 2 h de margen), mínimo las últimas 4 h
        # (la sincronización corre cada 2 h) y máximo 3 días hacia atrás.
        desde = max(min(ultima - timedelta(hours=2), ahora - timedelta(hours=4)), ahora - timedelta(days=3))
        params = {'publicado_desde': desde.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}
        print(f"  Publicadas desde {desde.astimezone(CHILE):%d-%m-%Y %H:%M}")
    else:
        params = {}
        print("  Primera corrida: todas las que siguen abiertas")
    params.update({'estado': 'publicada', 'tamano_pagina': 50, 'ordenar_por': 'FechaPublicacion'})

    ya = codigos_guardados('compra_agil')
    candidatas, pagina, total = [], 1, 0
    while True:
        params['numero_pagina'] = pagina
        p = v2('', params)['payload']
        items = p.get('items') or []
        total += len(items)
        for it in items:
            inst = it.get('institucion') or {}
            cliente = norm_rut(inst.get('rut')) in clientes
            prio, _ = clasificar(it.get('nombre'), cliente)
            # Se abre en detalle si el nombre calza, o si es de un cliente y el
            # nombre suena a medicamentos (la descripción y los productos pueden
            # traer la palabra aunque el nombre no)
            medica = LICITACION_CANDIDATA.search(sin_tildes(it.get('nombre')))
            if it.get('codigo') not in ya and (prio or (cliente and medica)):
                candidatas.append((it, cliente))
        pag = p.get('paginacion') or {}
        if pagina >= (pag.get('total_paginas') or 1):
            break
        pagina += 1
        time.sleep(0.3)
    print(f"  Revisadas {total} compras ágiles; {len(candidatas)} nuevas para ver en detalle")

    filas = []
    for it, cliente in candidatas:
        try:
            d = v2('/' + it['codigo'])['payload']
        except Exception as e:
            print(f"    ⚠ no se pudo abrir {it['codigo']}: {e}")
            continue
        productos = [{'nombre': x.get('nombre'), 'descripcion': x.get('descripcion'),
                      'cantidad': x.get('cantidad'), 'unidad': x.get('unidad_medida')}
                     for x in d.get('productos_solicitados') or []]
        texto = ' '.join([d.get('nombre') or '', d.get('descripcion') or ''] +
                         [f"{x['nombre'] or ''} {x['descripcion'] or ''}" for x in productos])
        prio, palabras = clasificar(texto, cliente)
        # Las que no calzan se guardan igual con prioridad vacía (la app no las
        # muestra) para no volver a abrirlas en la próxima corrida.
        inst, fechas, pres = d.get('institucion') or {}, d.get('fechas') or {}, d.get('presupuesto') or {}
        filas.append({
            'codigo': d['codigo'], 'tipo': 'compra_agil',
            'nombre': d.get('nombre'), 'descripcion': d.get('descripcion'),
            'organismo': inst.get('organismo_comprador'), 'unidad': inst.get('unidad_compra'),
            'rut_organismo': inst.get('rut'), 'region': (inst.get('nombre_region') or '').strip() or None,
            'estado': (d.get('estado') or {}).get('glosa'),
            'fecha_publicacion': fecha_chile(fechas.get('fecha_publicacion')),
            'fecha_cierre': fecha_chile(fechas.get('fecha_cierre')),
            'monto': pres.get('monto_disponible_clp') or pres.get('presupuesto_estimado'),
            'moneda': 'CLP', 'productos': productos if prio else None, 'palabras': palabras,
            'prioridad': prio, 'es_cliente': cliente,
            'total_ofertas': (d.get('resumen') or {}).get('total_ofertas_recibidas'),
            'url': f"https://buscador.mercadopublico.cl/ficha?code={d['codigo']}",
            'actualizada_en': datetime.now(timezone.utc).isoformat(),
        })
        time.sleep(0.3)
    guardar(filas)
    print(f"  ✔ {len(filas)} compras ágiles revisadas ({sum(1 for f in filas if f['prioridad'])} calzan)")


# ─── 2. LICITACIONES ────────────────────────────────────────────────────────
def licitaciones(clientes):
    print("\n── Licitaciones ──")
    activas = v1('licitaciones', {'estado': 'activas'}).get('Listado') or []
    ya = codigos_guardados('licitacion')
    cand = [x for x in activas
            if x.get('CodigoExterno') not in ya and LICITACION_CANDIDATA.search(sin_tildes(x.get('Nombre')))]
    print(f"  {len(activas)} activas; {len(cand)} nuevas que pueden ser de medicamentos")

    filas = []
    for x in cand:
        codigo = x['CodigoExterno']
        try:
            lst = v1('licitaciones', {'codigo': codigo}).get('Listado') or []
        except Exception as e:
            print(f"    ⚠ no se pudo abrir {codigo}: {e}")
            continue
        time.sleep(1.2)  # la API antigua no acepta consultas seguidas
        if not lst:
            continue
        d = lst[0]
        comp, fechas = d.get('Comprador') or {}, d.get('Fechas') or {}
        items = (d.get('Items') or {}).get('Listado') or []
        productos = [{'nombre': i.get('NombreProducto'), 'descripcion': i.get('Descripcion'),
                      'cantidad': i.get('Cantidad'), 'unidad': i.get('UnidadMedida'),
                      'categoria': i.get('Categoria')} for i in items]
        medicamento = any(str(i.get('CodigoCategoria') or '').startswith(('51', '731017', '851219'))
                          for i in items)
        cliente = norm_rut(comp.get('RutUnidad')) in clientes
        texto = ' '.join([d.get('Nombre') or '', d.get('Descripcion') or ''] +
                         [f"{p['nombre'] or ''} {p['descripcion'] or ''}" for p in productos])
        prio, palabras = clasificar(texto, cliente, medicamento)
        monto = d.get('MontoEstimado') if d.get('VisibilidadMonto') != 0 else None
        filas.append({
            'codigo': codigo, 'tipo': 'licitacion',
            'nombre': d.get('Nombre'), 'descripcion': (d.get('Descripcion') or '')[:4000],
            'organismo': comp.get('NombreOrganismo'), 'unidad': comp.get('NombreUnidad'),
            'rut_organismo': comp.get('RutUnidad'), 'region': (comp.get('RegionUnidad') or '').strip() or None,
            'estado': d.get('Estado'),
            'fecha_publicacion': fecha_chile(fechas.get('FechaPublicacion')),
            'fecha_cierre': fecha_chile(fechas.get('FechaCierre') or d.get('FechaCierre')),
            'monto': monto, 'moneda': d.get('Moneda') or 'CLP',
            # Solo se guardan los productos de las que calzan (las otras no se muestran)
            'productos': productos if prio else None,
            'palabras': palabras, 'prioridad': prio, 'es_cliente': cliente,
            'total_ofertas': None,
            'url': f"https://www.mercadopublico.cl/Procurement/Modules/RFB/DetailsAcquisition.aspx?idlicitacion={codigo}",
            'actualizada_en': datetime.now(timezone.utc).isoformat(),
        })
    guardar(filas)
    print(f"  ✔ {len(filas)} licitaciones revisadas ({sum(1 for f in filas if f['prioridad'])} calzan)")


def main():
    print(f"Radar de oportunidades — {datetime.now(CHILE):%d-%m-%Y %H:%M}" + (" (PRUEBA, no guarda)" if PROBAR else ''))
    clientes = ruts_clientes()
    print(f"  {len(clientes)} hospitales cliente con RUT")
    errores = 0
    for paso in (compras_agiles, licitaciones):
        try:
            paso(clientes)
        except Exception as e:  # que un paso caído no impida el otro
            errores += 1
            print(f"  ✖ {paso.__name__}: {e}")
    if errores == 2:
        sys.exit(1)


if __name__ == '__main__':
    main()
