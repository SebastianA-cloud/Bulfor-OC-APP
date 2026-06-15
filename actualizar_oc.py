"""
Script de actualización automática
Llama a la API de Mercado Público y guarda las OC nuevas en Supabase
Se ejecuta cada noche via GitHub Actions
"""

import os, requests, json
from datetime import datetime, timedelta
from supabase import create_client

# ─── CONFIG ────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']
MP_TICKET    = os.environ['MP_TICKET']
MP_RUT       = os.environ['MP_RUT']

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

MP_BASE = "https://api.mercadopublico.cl/servicios/v1/publico"

# ─── HELPERS ───────────────────────────────────────────────────────────────
def fecha_hoy():
    return datetime.now().strftime('%d%m%Y')

def fecha_hace_dias(n):
    return (datetime.now() - timedelta(days=n)).strftime('%d%m%Y')

def mp_get(endpoint, params={}):
    params['ticket'] = MP_TICKET
    r = requests.get(f"{MP_BASE}/{endpoint}", params=params, timeout=30)
    r.raise_for_status()
    return r.json()

# ─── OBTENER OC NUEVAS ─────────────────────────────────────────────────────
def obtener_oc_nuevas():
    """Trae OC de los últimos 3 días para no perder nada"""
    print("→ Consultando OC en Mercado Público…")
    
    fecha_inicio = fecha_hace_dias(3)
    fecha_fin    = fecha_hoy()
    
    data = mp_get("ocs", {
        "CodigoRutUnidadCompra": "",   # todas las unidades
        "CodigoRutProveedor": MP_RUT,
        "FechaCreacionDesde": fecha_inicio,
        "FechaCreacionHasta": fecha_fin,
        "Estado": "",
        "Tipo": ""
    })
    
    ocs = data.get("Listado", [])
    print(f"  ✔ {len(ocs)} OC encontradas en los últimos 3 días")
    return ocs

def obtener_detalle_oc(codigo_oc):
    """Trae el detalle de ítems de una OC"""
    try:
        data = mp_get(f"ocs/{codigo_oc}")
        return data.get("Listado", [{}])[0] if data.get("Listado") else {}
    except:
        return {}

# ─── TRANSFORMAR DATOS ─────────────────────────────────────────────────────
def parse_fecha(f):
    if not f:
        return None
    for fmt in ['%d/%m/%Y', '%Y-%m-%dT%H:%M:%S', '%Y-%m-%d']:
        try:
            return datetime.strptime(str(f)[:19], fmt).isoformat()
        except:
            pass
    return None

def transformar_oc(oc_raw):
    return {
        "CodigoOC":         oc_raw.get("Numero"),
        "TipoOC":           oc_raw.get("Tipo"),
        "NombreOC":         oc_raw.get("Nombre"),
        "FechaOC":          parse_fecha(oc_raw.get("Fecha")),
        "EstadoOC":         oc_raw.get("Estado"),
        "Hospital":         oc_raw.get("Unidad", {}).get("Nombre") if isinstance(oc_raw.get("Unidad"), dict) else oc_raw.get("NombreUnidad"),
        "UnidadCompradora": oc_raw.get("Unidad", {}).get("Nombre") if isinstance(oc_raw.get("Unidad"), dict) else None,
        "Region":           oc_raw.get("Region"),
        "Comuna":           oc_raw.get("Comuna"),
        "TotalOC":          oc_raw.get("TotalCargos"),
        "TotalNeto":        oc_raw.get("TotalNeto"),
        "Moneda":           oc_raw.get("Moneda", "CLP"),
        "CodigoLicitacion": oc_raw.get("CodigoLicitacion"),
        "FormaPago":        str(oc_raw.get("FormaPago", "")),
        "Proveedor":        oc_raw.get("Proveedor", {}).get("Nombre") if isinstance(oc_raw.get("Proveedor"), dict) else None,
        "RutProveedor":     MP_RUT,
        "CodigoProveedor":  str(oc_raw.get("Proveedor", {}).get("CodigoEmpresa", "")) if isinstance(oc_raw.get("Proveedor"), dict) else None,
        "EstadoProveedor":  oc_raw.get("Estado"),
        "FechaAceptacion":  parse_fecha(oc_raw.get("FechaAceptacion")),
        "FechaEnvio":       parse_fecha(oc_raw.get("FechaEnvio")),
        "FechaCancelacion": parse_fecha(oc_raw.get("FechaCancelacion")),
    }

def transformar_items(oc_codigo, fecha_oc, hospital, region, items_raw):
    resultado = []
    for i, item in enumerate(items_raw, 1):
        resultado.append({
            "CodigoOC":                 oc_codigo,
            "FechaOC":                  fecha_oc,
            "Hospital":                 hospital,
            "Region":                   region,
            "CorrelativoItem":          i,
            "CodigoCategoria":          item.get("CodigoCategoria"),
            "Categoria":                item.get("NombreCategoria"),
            "CodigoProductoMP":         item.get("CodigoProducto"),
            "ProductoMP":               item.get("NombreProducto"),
            "EspecificacionComprador":  item.get("Descripcion"),
            "EspecificacionProveedor":  item.get("DescripcionProducto"),
            "Cantidad":                 item.get("Cantidad"),
            "Unidad":                   item.get("UnidadMedida"),
            "Moneda":                   "CLP",
            "PrecioUnitario":           item.get("PrecioUnitario"),
            "TotalItem":                item.get("Total"),
            "ProductoNormalizado":      item.get("NombreProducto"),  # sin diccionario por ahora
            "Familia":                  item.get("NombreCategoria"),
        })
    return resultado

# ─── GUARDAR EN SUPABASE ───────────────────────────────────────────────────
def guardar_oc(ocs_data):
    if not ocs_data:
        return
    # upsert: si el CodigoOC ya existe, actualiza; si no, inserta
    supabase.table("ordenes_compra").upsert(ocs_data, on_conflict="CodigoOC").execute()
    print(f"  ✔ {len(ocs_data)} OC guardadas en Supabase")

def guardar_items(items_data):
    if not items_data:
        return
    CHUNK = 200
    for i in range(0, len(items_data), CHUNK):
        chunk = items_data[i:i+CHUNK]
        supabase.table("items_oc").upsert(chunk, on_conflict="CodigoOC,CorrelativoItem").execute()
    print(f"  ✔ {len(items_data)} ítems guardados en Supabase")

# ─── MAIN ──────────────────────────────────────────────────────────────────
def main():
    print(f"\n{'='*50}")
    print(f"Actualización OC — {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    print(f"{'='*50}\n")

    ocs_raw = obtener_oc_nuevas()
    if not ocs_raw:
        print("No hay OC nuevas. Fin.")
        return

    ocs_para_guardar = []
    items_para_guardar = []

    for oc_raw in ocs_raw:
        codigo = oc_raw.get("Numero")
        if not codigo:
            continue

        oc_transf = transformar_oc(oc_raw)
        ocs_para_guardar.append(oc_transf)

        # Traer ítems del detalle
        detalle = obtener_detalle_oc(codigo)
        items_raw = detalle.get("Cargos", []) or detalle.get("Items", [])
        if items_raw:
            items_transf = transformar_items(
                codigo,
                oc_transf["FechaOC"],
                oc_transf["Hospital"],
                oc_transf["Region"],
                items_raw
            )
            items_para_guardar.extend(items_transf)
            print(f"  OC {codigo}: {len(items_transf)} ítems")

    guardar_oc(ocs_para_guardar)
    guardar_items(items_para_guardar)

    print(f"\n✔ Actualización completada. Total: {len(ocs_para_guardar)} OC, {len(items_para_guardar)} ítems.\n")

if __name__ == "__main__":
    main()
