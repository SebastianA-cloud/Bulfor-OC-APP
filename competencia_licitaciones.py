"""
Competencia en licitaciones — Etapa 0 (prueba, solo lectura).

Descarga los archivos mensuales de "Datos Abiertos" de ChileCompra (licitaciones)
y arma un Excel para comparar los precios de Bulfor con los de la competencia,
SOLO en los productos donde ofertó Bulfor.

¿Por qué Datos Abiertos y no la API de Mercado Público?
  La API solo dice quién GANÓ cada producto. Los archivos mensuales de Datos
  Abiertos traen UNA FILA POR CADA OFERTA en cada producto (todas las empresas
  que ofertaron, con su precio y si quedaron "Seleccionada" o no). Eso es lo que
  permite comparar precios con la competencia.

  Fuente: https://transparenciachc.blob.core.windows.net/lic-da/{año}-{mes}.zip
  Cada archivo agrupa las licitaciones por MES DE PUBLICACIÓN. ChileCompra
  vuelve a generar los meses recientes (cambian a medida que se adjudican), por
  eso los últimos 3 meses se descargan de nuevo en cada corrida.

Este script NO escribe en Supabase ni en ninguna parte: solo descarga y genera
un Excel. Es la prueba antes de construir el módulo dentro de la app.

Uso:
    python competencia_licitaciones.py                      # enero 2025 hasta hoy
    python competencia_licitaciones.py --desde 2025-01 --hasta 2026-10
    python competencia_licitaciones.py --salida competencia.xlsx --cache ./lic-da

Requiere: pandas, openpyxl, requests.
"""

import argparse
import io
import os
import sys
import zipfile
from datetime import date

import pandas as pd
import requests

URL_MES = "https://transparenciachc.blob.core.windows.net/lic-da/{anio}-{mes}.zip"

# ─── Empresas a seguir ───────────────────────────────────────────────────────
# Se identifican por RUT (el nombre cambia entre licitaciones; el RUT no).
RUT_BULFOR = "76.186.755-5"

# Competidores indicados por Seba (09-11-2026). Clave = RUT, valor = nombre corto
# que se usa en las columnas del Excel.
COMPETIDORES = {
    "77.768.990-8": "Insuval",          # FARMACEUTICA INSUVAL S.A.
    "76.030.398-4": "Bioformula",       # FARMACEUTICA BIOFORMULA LIMITADA
    "96.776.130-3": "RP Farma",         # COMERCIAL EL PRADO S A (nombre de fantasía "Rpfarma")
    # "Zapata": en los datos hay dos proveedores posibles; se incluyen ambos
    # hasta que Seba confirme cuál es (o si son los dos).
    "76.019.191-4": "Zapata (Zagopharm)",  # GONZALEZ, ZAPATA Y COMPANIA LIMITADA ("ZAGOPHARM")
    "5.923.094-8": "Zapata (Juan D.)",     # JUAN DANIEL ZAPATA ZAPATA
}

NOMBRES = {RUT_BULFOR: "Bulfor", **COMPETIDORES}

# Columnas del archivo de ChileCompra que se usan (el archivo trae ~100).
COLUMNAS = [
    "CodigoExterno", "Link", "Nombre", "Estado", "NombreOrganismo", "NombreUnidad",
    "RegionUnidad", "Tipo", "FechaPublicacion", "FechaCierre", "FechaAdjudicacion",
    "NumeroOferentes", "Codigoitem", "Correlativo", "CodigoProductoONU",
    "Nombre producto genrico", "Descripcion linea Adquisicion", "UnidadMedida",
    "Cantidad", "RutProveedor", "NombreProveedor", "RazonSocialProveedor",
    "Estado Oferta", "Cantidad Ofertada", "Moneda de la Oferta",
    "MontoUnitarioOferta", "Valor Total Ofertado", "CantidadAdjudicada",
    "MontoLineaAdjudica", "Oferta seleccionada",
]

NUMERICAS = [
    "NumeroOferentes", "Cantidad", "Cantidad Ofertada", "MontoUnitarioOferta",
    "Valor Total Ofertado", "CantidadAdjudicada", "MontoLineaAdjudica",
]


def meses_entre(desde, hasta):
    """Lista de (año, mes) desde 'AAAA-MM' hasta 'AAAA-MM', ambos incluidos."""
    a, m = map(int, desde.split("-"))
    ah, mh = map(int, hasta.split("-"))
    salida = []
    while (a, m) <= (ah, mh):
        salida.append((a, m))
        m += 1
        if m == 13:
            a, m = a + 1, 1
    return salida


def descargar_mes(anio, mes, cache, forzar=False):
    """Descarga el ZIP del mes (o usa el que ya está en la carpeta cache).
    Devuelve la ruta, o None si ChileCompra aún no lo publica."""
    os.makedirs(cache, exist_ok=True)
    ruta = os.path.join(cache, f"{anio}-{mes}.zip")
    if os.path.exists(ruta) and not forzar:
        return ruta
    r = requests.get(URL_MES.format(anio=anio, mes=mes), timeout=600)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    with open(ruta + ".part", "wb") as f:
        f.write(r.content)
    os.replace(ruta + ".part", ruta)
    return ruta


def numero(serie):
    """Los números vienen como texto, a veces con coma decimal o en notación
    científica ("2,5e+07"). Se convierten aquí, en un solo lugar."""
    return pd.to_numeric(serie.astype(str).str.replace(",", ".", regex=False), errors="coerce")


def leer_mes(ruta):
    """Lee el CSV del ZIP y deja solo los productos (líneas) donde ofertó Bulfor,
    con TODAS las ofertas de esos productos (también las de otras empresas).
    Lo que la competencia ofertó donde Bulfor no participó se descarta (pedido
    de Seba, 09-11-2026)."""
    with zipfile.ZipFile(ruta) as z:
        nombre_csv = [n for n in z.namelist() if n.lower().endswith(".csv")][0]
        with z.open(nombre_csv) as f:
            df = pd.read_csv(
                io.TextIOWrapper(f, encoding="latin1", newline=""),
                sep=";", dtype=str, usecols=lambda c: c in COLUMNAS,
                on_bad_lines="skip",
            )
    linea = df["CodigoExterno"] + "|" + df["Codigoitem"].astype(str)
    lineas_bulfor = set(linea[df["RutProveedor"] == RUT_BULFOR])
    df = df[linea.isin(lineas_bulfor)].copy()
    for c in NUMERICAS:
        if c in df:
            df[c] = numero(df[c])
    df["archivo_mes"] = os.path.basename(ruta).replace(".zip", "")
    return df


def limpiar_descripcion(texto):
    """La descripción del comprador trae tabulaciones y saltos de línea; se deja
    en una sola línea para que se lea bien en Excel."""
    if not isinstance(texto, str):
        return ""
    return " ".join(texto.replace("\t", " ").split())


def preparar(df):
    df = df.copy()
    df["Empresa"] = df["RutProveedor"].map(NOMBRES).fillna(df["NombreProveedor"])
    df["Seleccionada"] = df["Oferta seleccionada"].eq("Seleccionada")
    df["Producto"] = df["Descripcion linea Adquisicion"].map(limpiar_descripcion)
    df["Fecha publicación"] = pd.to_datetime(df["FechaPublicacion"], errors="coerce").dt.date
    df["Fecha adjudicación"] = pd.to_datetime(df["FechaAdjudicacion"], errors="coerce").dt.date
    df["Precio unitario"] = df["MontoUnitarioOferta"]
    # Una "línea" = un producto dentro de una licitación.
    df["clave_linea"] = df["CodigoExterno"] + "|" + df["Codigoitem"].astype(str)
    return df


def tabla_ganadores(df):
    """Por cada línea: quién ganó, a qué precio, y el precio más bajo ofertado."""
    sel = df[df["Seleccionada"]]
    gan = (sel.sort_values("Precio unitario")
              .groupby("clave_linea")
              .agg(Ganador=("RazonSocialProveedor", lambda s: " / ".join(dict.fromkeys(s))),
                   **{"Precio ganador": ("Precio unitario", "first")}))
    acep = df[df["Estado Oferta"].ne("Rechazada")]
    minimo = acep.groupby("clave_linea").agg(
        **{"Precio más bajo ofertado": ("Precio unitario", "min"),
           "Ofertas en la línea": ("RutProveedor", "nunique")})
    return gan.join(minimo, how="outer")


def datos_linea(df):
    """Datos fijos de cada línea (licitación, comprador, producto)."""
    cols = {
        "CodigoExterno": "Licitación", "Fecha publicación": "Fecha publicación",
        "Fecha adjudicación": "Fecha adjudicación", "Estado": "Estado licitación",
        "NombreOrganismo": "Organismo", "NombreUnidad": "Unidad compradora",
        "RegionUnidad": "Región", "Tipo": "Tipo", "Correlativo": "N° línea",
        "Nombre producto genrico": "Producto genérico (ONU)", "Producto": "Producto (descripción del comprador)",
        "UnidadMedida": "Unidad", "Cantidad": "Cantidad pedida", "Link": "Ficha Mercado Público",
    }
    return df.drop_duplicates("clave_linea").set_index("clave_linea")[list(cols)].rename(columns=cols)


def hoja_nuestras_ofertas(df, ganadores, base):
    """Una fila por producto donde ofertó Bulfor: nuestro precio, el de cada
    competidor seguido (vacío si no ofertó), quién ganó y a qué precio."""
    acep = df[df["Estado Oferta"].ne("Rechazada")]
    seg = acep[acep["RutProveedor"].isin(NOMBRES.keys())]
    precios = seg.pivot_table(index="clave_linea", columns="Empresa", values="Precio unitario", aggfunc="min")
    orden = ["Bulfor"] + list(COMPETIDORES.values())
    precios = precios.reindex(columns=orden)
    # El precio de Bulfor se muestra aunque la oferta haya sido rechazada.
    propias = df[df["RutProveedor"] == RUT_BULFOR]
    precios["Bulfor"] = propias.groupby("clave_linea")["Precio unitario"].min()
    precios.columns = [f"Precio {c}" for c in precios.columns]
    estado_bulfor = (propias.drop_duplicates("clave_linea").set_index("clave_linea")["Estado Oferta"]
                     .rename("Estado oferta Bulfor"))
    compitio = seg[seg["RutProveedor"] != RUT_BULFOR].groupby("clave_linea")["Empresa"].agg(
        lambda s: ", ".join(dict.fromkeys(s)))
    out = (base.join(precios, how="inner").join(estado_bulfor)
               .join(compitio.rename("Competidores seguidos presentes")).join(ganadores))
    out["Resultado Bulfor"] = out["Ganador"].fillna("").map(
        lambda g: "Ganó" if "BULFOR" in g else ("Perdió" if g else "Sin adjudicar"))
    out["Bulfor vs ganador (%)"] = ((out["Precio Bulfor"] / out["Precio ganador"] - 1) * 100).round(1)
    return out.sort_values(["Fecha publicación", "Licitación", "N° línea"], ascending=[False, True, True])


def comparar_con_bulfor(df, nuestras, rut):
    """Cómo le fue a una empresa en los productos donde también ofertó Bulfor."""
    o = df[(df["RutProveedor"] == rut) & df["Estado Oferta"].ne("Rechazada")]
    precio = o.groupby("clave_linea")["Precio unitario"].min()
    comunes = nuestras.loc[nuestras.index.intersection(precio.index)]
    p = precio.loc[comunes.index]
    adj = int((comunes["Resultado Bulfor"] != "Sin adjudicar").sum())
    ganados = df[(df["RutProveedor"] == rut) & df["Seleccionada"]]["clave_linea"].nunique()
    fila = {
        "Licitaciones en común": comunes["Licitación"].nunique(),
        "Productos en común": len(comunes),
        "Productos ya adjudicados": adj,
        "Productos que ganó": ganados,
        "% ganados (de los adjudicados)": round(100 * ganados / adj, 1) if adj else None,
        "Bulfor le ganó": int((comunes["Resultado Bulfor"] == "Ganó").sum()),
    }
    if len(comunes):
        fila["Veces más barato que Bulfor"] = int((p < comunes["Precio Bulfor"]).sum())
        fila["Veces más caro que Bulfor"] = int((p > comunes["Precio Bulfor"]).sum())
        fila["Mismo precio"] = int((p == comunes["Precio Bulfor"]).sum())
        fila["Diferencia mediana vs Bulfor (%)"] = round(((p / comunes["Precio Bulfor"] - 1) * 100).median(), 1)
        fila["Última vez (publicación)"] = comunes["Fecha publicación"].max()
    return fila


def hoja_resumen(df, nuestras):
    """Bulfor y cada competidor seguido, contando SOLO los productos donde ofertó Bulfor."""
    adj = int((nuestras["Resultado Bulfor"] != "Sin adjudicar").sum())
    gan = int((nuestras["Resultado Bulfor"] == "Ganó").sum())
    filas = [{
        "Empresa": "Bulfor", "RUT": RUT_BULFOR,
        "Licitaciones en común": nuestras["Licitación"].nunique(),
        "Productos en común": len(nuestras),
        "Productos ya adjudicados": adj,
        "Productos que ganó": gan,
        "% ganados (de los adjudicados)": round(100 * gan / adj, 1) if adj else None,
    }]
    for rut, nombre in COMPETIDORES.items():
        filas.append({"Empresa": nombre, "RUT": rut, **comparar_con_bulfor(df, nuestras, rut)})
    return pd.DataFrame(filas)


def hoja_frecuentes(df, nuestras, minimo_productos=5):
    """TODAS las empresas que ofertaron en productos de Bulfor, ordenadas por
    cuántas veces se cruzaron con nosotros. Sirve para descubrir competidores
    que no estaban en la lista."""
    otras = df[df["RutProveedor"] != RUT_BULFOR]
    conteo = otras.groupby("RutProveedor")["clave_linea"].nunique()
    filas = []
    for rut in conteo[conteo >= minimo_productos].index:
        razon = otras.loc[otras["RutProveedor"] == rut, "RazonSocialProveedor"].iloc[0]
        fantasia = otras.loc[otras["RutProveedor"] == rut, "NombreProveedor"].iloc[0]
        filas.append({"Empresa": razon, "Nombre de fantasía": fantasia, "RUT": rut,
                      "Ya seguido": "Sí" if rut in COMPETIDORES else "",
                      **comparar_con_bulfor(df, nuestras, rut)})
    out = pd.DataFrame(filas)
    # Se cuentan solo ofertas aceptadas (una oferta rechazada no compitió de verdad).
    out = out[out["Productos en común"] >= minimo_productos]
    return out.sort_values(["Productos en común", "Licitaciones en común"], ascending=False)


def hoja_leeme(desde, hasta, meses_ok, meses_faltan, df):
    lineas = [
        ("Competencia en licitaciones — Etapa 0 (prueba)", ""),
        ("Generado", date.today().isoformat()),
        ("Período pedido", f"{desde} a {hasta} (por mes de PUBLICACIÓN de la licitación)"),
        ("Meses incluidos", ", ".join(meses_ok)),
        ("Meses sin archivo todavía", ", ".join(meses_faltan) or "—"),
        ("Fuente", "Datos Abiertos ChileCompra, archivo mensual de licitaciones (una fila por oferta)."),
        ("Qué incluye", "SOLO los productos donde ofertó Bulfor, con lo que ofertaron las demás empresas en "
                        "esos mismos productos. No incluye ofertas de la competencia donde Bulfor no participó."),
        ("Licitaciones incluidas", df["CodigoExterno"].nunique()),
        ("", ""),
        ("Hojas", ""),
        ("Resumen", "Bulfor y los competidores seguidos (Insuval, Bioformula, RP Farma, Zapata)."),
        ("Competidores frecuentes", "Todas las empresas que se cruzaron con Bulfor en 5 productos o más, "
                                    "de más a menos frecuente. Para descubrir competidores que faltan en la lista."),
        ("Nuestras ofertas", "Una fila por producto ofertado por Bulfor: nuestro precio, el de cada competidor "
                             "seguido (vacío si no ofertó), quién ganó y a qué precio."),
        ("Todas las ofertas", "Las mismas líneas, con una fila por cada empresa que ofertó."),
        ("", ""),
        ("Ojo al leer", ""),
        ("Precios", "Precio unitario NETO ofertado, tal como viene en Mercado Público. Revisar la columna Unidad."),
        ("Unidades distintas", "Algunos comparan por comprimido y otros por frasco (ej. primidona: $58 vs $2.340). "
                               "Por eso se usa la diferencia MEDIANA, que no se deja llevar por esos casos."),
        ("Ganar ≠ más barato", "La adjudicación es por puntaje (precio, plazo, experiencia...). Hay líneas que gana "
                               "una oferta que no es la más barata."),
        ("Sin adjudicar", "Licitaciones aún abiertas, en evaluación, desiertas o revocadas: no tienen ganador."),
        ("Compra Ágil y trato directo", "No vienen en este archivo (son otros procesos)."),
        ("Zapata", "Hay dos proveedores posibles: Zagopharm (González, Zapata y Cía.) y Juan Daniel Zapata. "
                   "Se incluyen ambos hasta confirmar cuál corresponde."),
    ]
    return pd.DataFrame(lineas, columns=["Tema", "Detalle"])


def escribir_excel(ruta, hojas):
    with pd.ExcelWriter(ruta, engine="openpyxl") as xw:
        for nombre, tabla in hojas:
            tabla.to_excel(xw, sheet_name=nombre[:31], index=False)
            ws = xw.sheets[nombre[:31]]
            ws.freeze_panes = "A2" if nombre != "Léeme" else None
            if nombre != "Léeme" and ws.max_row > 1:
                ws.auto_filter.ref = ws.dimensions
            # Ancho de columnas razonable (sin pasar de 60 caracteres).
            for col in ws.columns:
                largo = max((len(str(c.value)) for c in list(col)[:200] if c.value is not None), default=8)
                ws.column_dimensions[col[0].column_letter].width = min(max(10, largo + 2), 60)
            # Formato de miles en precios.
            encabezados = [c.value for c in ws[1]]
            for i, h in enumerate(encabezados, start=1):
                if isinstance(h, str) and (h.startswith("Precio") or h.startswith("Cantidad")):
                    for fila in ws.iter_rows(min_row=2, min_col=i, max_col=i):
                        fila[0].number_format = "#,##0.##"


def main():
    hoy = date.today()
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--desde", default="2025-01")
    p.add_argument("--hasta", default=f"{hoy.year}-{hoy.month:02d}")
    p.add_argument("--cache", default="lic-da", help="carpeta donde se guardan los ZIP descargados")
    p.add_argument("--salida", default=f"competencia_licitaciones_{hoy.isoformat()}.xlsx")
    args = p.parse_args()

    meses = meses_entre(args.desde, args.hasta)
    recientes = set(meses[-3:])  # se vuelven a descargar: ChileCompra los actualiza
    partes, ok, faltan = [], [], []
    for anio, mes in meses:
        ruta = descargar_mes(anio, mes, args.cache, forzar=(anio, mes) in recientes)
        etiqueta = f"{anio}-{mes:02d}"
        if not ruta:
            faltan.append(etiqueta)
            continue
        df_mes = leer_mes(ruta)
        if df_mes.empty and (anio, mes) in recientes:
            faltan.append(etiqueta + " (vacío)")
            continue
        partes.append(df_mes)
        ok.append(etiqueta)
        print(f"{etiqueta}: {df_mes['CodigoExterno'].nunique()} licitaciones donde ofertó Bulfor", file=sys.stderr)

    if not partes:
        sys.exit("No se pudo leer ningún mes.")
    df = preparar(pd.concat(partes, ignore_index=True))
    ganadores = tabla_ganadores(df)
    base = datos_linea(df)

    nuestras = hoja_nuestras_ofertas(df, ganadores, base)

    # Detalle: todas las empresas que ofertaron en los productos de Bulfor.
    det = df.set_index("clave_linea")[["RazonSocialProveedor", "RutProveedor", "Empresa", "Precio unitario",
                                       "Cantidad Ofertada", "Estado Oferta", "Seleccionada"]]
    det = base.join(det, how="inner").rename(columns={"RazonSocialProveedor": "Proveedor", "Seleccionada": "Ganó"})
    det = det.sort_values(["Fecha publicación", "Licitación", "N° línea", "Precio unitario"],
                          ascending=[False, True, True, True])

    hojas = [("Léeme", hoja_leeme(args.desde, args.hasta, ok, faltan, df)),
             ("Resumen", hoja_resumen(df, nuestras)),
             ("Competidores frecuentes", hoja_frecuentes(df, nuestras)),
             ("Nuestras ofertas", nuestras),
             ("Todas las ofertas", det)]
    escribir_excel(args.salida, hojas)
    print(f"Listo: {args.salida}", file=sys.stderr)


if __name__ == "__main__":
    main()
