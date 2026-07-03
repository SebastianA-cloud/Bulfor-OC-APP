"""
Script de mantenimiento: completa hospitales_maestro con TODOS los nombres
de hospital que existen de verdad en ordenes_compra, no solo con una lista
fija escrita a mano (esa es la limitación de obtener_ruts_hospitales.py).

Para cada nombre de hospital que aparece en tus OC y todavía no está en
hospitales_maestro:
  1. Busca su RUT en la API de Mercado Público (usando cualquier código de
     OC real de ese hospital, ya lo tenemos en la base).
  2. Si ese RUT YA existe en hospitales_maestro con un nombre_estandar
     definido (ej: ya normalizaste "COMPLEJO ASISTENCIAL DR. SOTERO DEL RIO"),
     el nuevo registro hereda ese mismo nombre_estandar automáticamente —
     así variantes como "Hospital Sotero del Rio" quedan normalizadas solas,
     sin aparecer como pendientes en el panel de la app.
  3. Si el RUT es realmente nuevo (nadie lo ha visto antes, ej: Hospital de
     Lebu), se guarda sin nombre_estandar — ese sí va a aparecer como
     pendiente en el panel, que es lo correcto.

Se ejecuta manualmente desde GitHub Actions (workflow_dispatch). Es seguro
correrlo varias veces: no pisa nombre_estandar ya definidos ni duplica filas
(usa upsert por nombre_original).
"""

import os, requests, time
from supabase import create_client

SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_KEY = os.environ['SUPABASE_KEY']
MP_TICKET    = os.environ['MP_TICKET']

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
MP_BASE = "https://api.mercadopublico.cl/servicios/v1/publico/ordenesdecompra.json"


def mp_get(params, max_reintentos=5):
    params = dict(params)
    params['ticket'] = MP_TICKET
    espera = 3
    for intento in range(max_reintentos):
        r = requests.get(MP_BASE, params=params, timeout=30)
        if r.status_code == 429:
            print(f"    ⏳ Esperando {espera}s por límite de la API...")
            time.sleep(espera)
            espera *= 2
            continue
        r.raise_for_status()
        return r.json()
    raise requests.exceptions.HTTPError("429 persistente")


def cargar_todo(tabla, campos, page=1000):
    """Trae todas las filas de una tabla, paginando (Supabase limita a 1000 por defecto)."""
    todas, offset = [], 0
    while True:
        res = supabase.table(tabla).select(campos).range(offset, offset + page - 1).execute()
        filas = res.data or []
        todas.extend(filas)
        if len(filas) < page:
            break
        offset += page
    return todas


def main():
    print("Cargando hospitales_maestro actual...")
    maestro = cargar_todo("hospitales_maestro", "nombre_original,rut,nombre_estandar")
    registrados = {m["nombre_original"] for m in maestro if m.get("nombre_original")}
    rut_a_nombre_estandar = {
        m["rut"]: m["nombre_estandar"]
        for m in maestro if m.get("rut") and m.get("nombre_estandar")
    }
    print(f"  {len(registrados)} hospitales ya registrados, {len(rut_a_nombre_estandar)} RUT con nombre estándar definido\n")

    print("Cargando nombres de hospital reales desde ordenes_compra...")
    ocs = cargar_todo("ordenes_compra", "hospital,codigooc")
    ejemplo_por_hospital = {}
    for o in ocs:
        h = o.get("hospital")
        if h and h not in ejemplo_por_hospital:
            ejemplo_por_hospital[h] = o.get("codigooc")
    print(f"  {len(ejemplo_por_hospital)} hospitales distintos encontrados en tus OC\n")

    faltantes = {h: c for h, c in ejemplo_por_hospital.items() if h not in registrados}
    print(f"{len(faltantes)} hospitales todavía no están en hospitales_maestro\n")

    if not faltantes:
        print("✔ No hay nada que completar.")
        return

    filas = []
    heredados = 0
    for i, (hospital, codigo) in enumerate(faltantes.items(), 1):
        print(f"[{i}/{len(faltantes)}] {hospital}")
        if not codigo:
            print("   ⚠ Sin código de OC de ejemplo, se omite")
            continue
        try:
            data = mp_get({"codigo": codigo})
            listado = data.get("Listado")
            if not listado:
                print("   ⚠ Sin datos")
                continue
            comprador = listado[0].get("Comprador", {})
            rut = comprador.get("RutUnidad")
            region = comprador.get("RegionUnidad")
            comuna = comprador.get("ComunaUnidad")

            nombre_estandar_heredado = rut_a_nombre_estandar.get(rut)
            if nombre_estandar_heredado:
                print(f"   ✔ RUT: {rut} → hereda nombre estándar '{nombre_estandar_heredado}'")
                heredados += 1
            else:
                print(f"   ✔ RUT: {rut} (nuevo, sin nombre estándar todavía)")

            filas.append({
                "nombre_original": hospital,
                "rut": rut,
                "region": region,
                "comuna": comuna,
                "codigo_oc_ejemplo": codigo,
                "nombre_estandar": nombre_estandar_heredado,  # None si es genuinamente nuevo
            })
        except Exception as e:
            print(f"   ✗ Error: {e}")
        time.sleep(1.5)  # pausa conservadora entre consultas a la API

    if filas:
        supabase.table("hospitales_maestro").upsert(filas, on_conflict="nombre_original").execute()
        print(f"\n✔ {len(filas)} hospitales agregados a hospitales_maestro")
        print(f"  → {heredados} quedaron normalizados solos (heredaron nombre estándar existente)")
        print(f"  → {len(filas) - heredados} quedaron pendientes de normalizar en la app")
    else:
        print("\n⚠ No se guardó ningún hospital nuevo")


if __name__ == "__main__":
    main()
