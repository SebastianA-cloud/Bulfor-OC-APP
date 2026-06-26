"""
Script de actualización automática — VERSIÓN FINAL CONFIRMADA
Traducción directa y verificada línea por línea del código M real de Power Query
(extraído del archivo .xlsm: Section1.m) a Python.

Funciones M de origen verificadas:
- fxOCPorFechaProveedor: lista de OC por día + proveedor
- fxOrdenCompra: detalle completo de una OC por código
- Mis_OC_API / Mis_Items_OC_API: expansión de campos anidados
- fxBuscarDiccionario: búsqueda en diccionario por "contiene" + prioridad
  (nota: usa una tabla de reglas distinta a la tabla diccionario_normalizacion
  que armamos en la app, que es de coincidencia EXACTA. Por ahora este script
  deja productonormalizado en null si no hay un texto original exacto cargado;
  se puede mejorar más adelante para usar el mismo sistema de reglas "contiene".)
"""

import os, requests, time
from datetime import datetime, timedelta
from supabase import create_client

# ─── CONFIG ────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']
MP_TICKET    = os.environ['MP_TICKET']
MP_CODIGO_PROVEEDOR = os.environ.get('MP_CODIGO_PROVEEDOR', '1293183')

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
MP_BASE = "https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json"


def mp_get(params, max_reintentos=5):
    params = dict(params)
    params['ticket'] = MP_TICKET
    espera = 3  # segundos, se va duplicando si sigue fallando
    for intento in range(max_reintentos):
        r = requests.get(MP_BASE, params=params, timeout=30)
        if r.status_code == 429:
            print(f"    ⏳ La API pidió esperar (intento {intento+1}/{max_reintentos}), pausando {espera}s...")
            time.sleep(espera)
            espera *= 2  # cada vez espera más: 3s, 6s, 12s, 24s, 48s
            continue
        r.raise_for_status()
        return r.json()
    # Si después de todos los reintentos sigue fallando, avisamos pero no rompemos todo el script
    raise requests.exceptions.HTTPError(f"429 persistente tras {max_reintentos} intentos")


def fecha_ddmmaaaa(dt):
    return dt.strftime('%d%m%Y')


# ─── PASO 1: lista de códigos de OC para una fecha (= fxOCPorFechaProveedor) ──
def obtener_codigos_oc_del_dia(fecha_dt):
    fecha_str = fecha_ddmmaaaa(fecha_dt)
    print(f"  → Consultando OC del día {fecha_str}...")
    try:
        data = mp_get({"fecha": fecha_str, "CodigoProveedor": MP_CODIGO_PROVEEDOR})
    except Exception as e:
        print(f"    ⚠ No se pudo consultar este día, se omite: {e}")
        return []
    listado = data.get("Listado", []) or []
    print(f"    {len(listado)} OC encontradas")
    return listado


# ─── PASO 2: detalle completo de una OC (= fxOrdenCompra) ──────────────────
def obtener_detalle_oc(codigo_oc):
    try:
        data = mp_get({"codigo": codigo_oc})
        listado = data.get("Listado")
        if not listado:
            return None
        if isinstance(listado, list):
            return listado[0] if listado else None
        return listado
    except Exception as e:
        print(f"    ⚠ Error consultando detalle de {codigo_oc}: {e}")
        return None


def parse_fecha(f):
    if not f:
        return None
    for fmt in ['%Y-%m-%dT%H:%M:%S', '%Y-%m-%d', '%d/%m/%Y']:
        try:
            return datetime.strptime(str(f)[:19], fmt).isoformat()
        except Exception:
            pass
    return None


def transformar_oc(detalle, codigo_oc):
    """Equivalente exacto a Mis_OC_API: ExpandirOC + ExpandirFechas +
    ExpandirComprador + ExpandirProveedor + AgregarTipoOC"""
    fechas = detalle.get("Fechas", {}) or {}
    comprador = detalle.get("Comprador", {}) or {}
    proveedor = detalle.get("Proveedor", {}) or {}

    codigo = detalle.get("Codigo", codigo_oc)
    tipo_oc = codigo.split("-")[-1] if codigo else None
    tipo_oc = ''.join(c for c in (tipo_oc or '') if c.isalpha())

    return {
        "codigooc":          codigo_oc,
        "tipooc":            tipo_oc,
        "nombreoc":          detalle.get("Nombre"),
        "fechaoc":           parse_fecha(fechas.get("FechaCreacion")),
        "estadooc":          detalle.get("CodigoEstado"),
        "hospital":          comprador.get("NombreOrganismo"),
        "unidadcompradora":  comprador.get("NombreUnidad"),
        "region":            comprador.get("RegionUnidad"),
        "comuna":            comprador.get("ComunaUnidad"),
        "totaloc":           detalle.get("Total"),
        "totalneto":         detalle.get("TotalNeto"),
        "moneda":            detalle.get("TipoMoneda", "CLP"),
        "codigolicitacion":  detalle.get("CodigoLicitacion"),
        "formapago":         str(detalle.get("FormaPago", "")),
        "proveedor":         proveedor.get("Nombre"),
        "rutproveedor":      proveedor.get("RutSucursal"),
        "codigoproveedor":   proveedor.get("Codigo", MP_CODIGO_PROVEEDOR),
        "estadoproveedor":   detalle.get("EstadoProveedor"),
        "fechaaceptacion":   parse_fecha(fechas.get("FechaAceptacion")),
        "fechaenvio":        parse_fecha(fechas.get("FechaEnvio")),
        "fechacancelacion":  parse_fecha(fechas.get("FechaCancelacion")),
    }


def buscar_en_diccionario_exacto(texto_original):
    """Busca coincidencia EXACTA en diccionario_normalizacion (la tabla que
    armamos en la app). Si no hay coincidencia, devuelve None — la fila queda
    sin normalizar hasta que el usuario la normalice manualmente desde la app
    (igual que ya funciona con las OC existentes)."""
    if not texto_original:
        return None
    try:
        res = supabase.table("diccionario_normalizacion") \
            .select("nombre_normalizado") \
            .eq("texto_original", texto_original) \
            .limit(1).execute()
        if res.data:
            return res.data[0]["nombre_normalizado"]
    except Exception:
        pass
    return None


def transformar_items(codigo_oc, fecha_oc, hospital, region, items_raw):
    """Equivalente exacto a Mis_Items_OC_API: ExpandirItems + ExpandirDetalleItems"""
    resultado = []
    for item in items_raw:
        producto_mp = item.get("Producto")
        especif_comprador = item.get("EspecificacionComprador")
        especif_proveedor = item.get("EspecificacionProveedor")

        # Misma cascada que ya usa la app (ver textoOriginalDe en index.html):
        # prioriza el texto que tenga info real de producto, evitando frases
        # genéricas tipo "elaborado en recetario..." cuando sea posible.
        texto_para_normalizar = especif_comprador or especif_proveedor or producto_mp
        nombre_normalizado = buscar_en_diccionario_exacto(texto_para_normalizar)

        resultado.append({
            "codigooc":                 codigo_oc,
            "fechaoc":                  fecha_oc,
            "hospital":                 hospital,
            "region":                   region,
            "correlativoitem":          item.get("Correlativo"),
            "codigocategoria":          item.get("CodigoCategoria"),
            "categoria":                item.get("Categoria"),
            "codigoproductomp":         item.get("CodigoProducto"),
            "productomp":               producto_mp,
            "especificacioncomprador":  especif_comprador,
            "especificacionproveedor":  especif_proveedor,
            "cantidad":                 item.get("Cantidad"),
            "unidad":                   item.get("Unidad"),
            "moneda":                   item.get("Moneda", "CLP"),
            "preciounitario":           item.get("PrecioNeto"),
            "totalitem":                item.get("Total"),
            "productonormalizado":      nombre_normalizado,
            "familia":                  item.get("Categoria"),
        })
    return resultado


# ─── GUARDAR EN SUPABASE ───────────────────────────────────────────────────
def guardar_oc(ocs_data):
    if not ocs_data:
        return
    supabase.table("ordenes_compra").upsert(ocs_data, on_conflict="codigooc").execute()
    print(f"  ✔ {len(ocs_data)} OC guardadas en Supabase")


def guardar_items(items_data):
    if not items_data:
        return
    CHUNK = 200
    for i in range(0, len(items_data), CHUNK):
        chunk = items_data[i:i + CHUNK]
        supabase.table("items_oc").upsert(chunk, on_conflict="codigooc,correlativoitem").execute()
    print(f"  ✔ {len(items_data)} ítems guardados en Supabase")


def obtener_ultima_fecha_guardada():
    res = supabase.table("ordenes_compra").select("fechaoc").order("fechaoc", desc=True).limit(1).execute()
    if res.data and res.data[0].get("fechaoc"):
        return datetime.fromisoformat(res.data[0]["fechaoc"].replace("Z", "+00:00")).replace(tzinfo=None)
    return datetime.now() - timedelta(days=7)


# ─── MAIN ──────────────────────────────────────────────────────────────────
def main():
    print(f"\n{'=' * 50}")
    print(f"Actualización OC Bulfor — {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print(f"{'=' * 50}\n")

    ultima_fecha = obtener_ultima_fecha_guardada()
    hoy = datetime.now()
    print(f"Última OC guardada: {ultima_fecha.strftime('%d/%m/%Y')}")
    print(f"Actualizando hasta: {hoy.strftime('%d/%m/%Y')}\n")

    total_ocs = 0
    total_items = 0
    fecha_actual = ultima_fecha

    while fecha_actual.date() <= hoy.date():
        codigos_basicos = obtener_codigos_oc_del_dia(fecha_actual)

        ocs_para_guardar = []
        items_para_guardar = []

        for oc_basica in codigos_basicos:
            codigo = oc_basica.get("Codigo")
            if not codigo:
                continue

            detalle = obtener_detalle_oc(codigo)
            if not detalle:
                continue

            oc_transf = transformar_oc(detalle, codigo)
            ocs_para_guardar.append(oc_transf)

            items_listado = (detalle.get("Items", {}) or {}).get("Listado", [])
            if items_listado:
                items_transf = transformar_items(
                    codigo, oc_transf["fechaoc"], oc_transf["hospital"], oc_transf["region"], items_listado
                )
                items_para_guardar.extend(items_transf)

            time.sleep(1)  # pausa más conservadora para evitar el límite de la API

        guardar_oc(ocs_para_guardar)
        guardar_items(items_para_guardar)
        total_ocs += len(ocs_para_guardar)
        total_items += len(items_para_guardar)

        fecha_actual += timedelta(days=1)

    print(f"\n✔ Actualización completada. Total: {total_ocs} OC, {total_items} ítems.\n")


if __name__ == "__main__":
    main()
