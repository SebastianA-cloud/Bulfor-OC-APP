"""
Competencia en licitaciones — Etapa 0 (prueba, solo lectura).

Descarga los archivos mensuales de "Datos Abiertos" de ChileCompra (licitaciones)
y arma un Excel para comparar los precios de Bulfor con los de la competencia.

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
    """Lee el CSV del ZIP y deja solo las licitaciones donde participó Bulfor o
    algún competidor (con TODAS sus ofertas, también las de otras empresas)."""
    with zipfile.ZipFile(ruta) as z:
        nombre_csv = [n for n in z.namelist() if n.lower().endswith(".csv")][0]
        with z.open(nombre_csv) as f:
            df = pd.read_csv(
                io.TextIOWrapper(f, encoding="latin1", newline=""),
                sep=";", dtype=str, usecols=lambda c: c in COLUMNAS,
                on_bad_lines="skip",
            )
    seguidas = df["RutProveedor"].isin(NOMBRES.keys())
    codigos = set(df.loc[seguidas, "CodigoExterno"])
    df = df[df["CodigoExterno"].isin(codigos)].copy()
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


def hoja_cara_a_cara(df, ganadores, base):
    """Líneas donde ofertó Bulfor y al menos un competidor: precio de cada uno
    lado a lado, ganador y diferencia."""
    seg = df[df["RutProveedor"].isin(NOMBRES.keys()) & df["Estado Oferta"].ne("Rechazada")]
    precios = seg.pivot_table(index="clave_linea", columns="Empresa", values="Precio unitario", aggfunc="min")
    con_bulfor = precios["Bulfor"].notna() if "Bulfor" in precios else pd.Series(False, index=precios.index)
    comp_cols = [n for n in COMPETIDORES.values() if n in precios.columns]
    con_comp = precios[comp_cols].notna().any(axis=1)
    precios = precios[con_bulfor & con_comp]
    orden = ["Bulfor"] + comp_cols
    precios = precios.reindex(columns=orden)
    precios.columns = [f"Precio {c}" for c in precios.columns]
    out = base.join(precios, how="inner").join(ganadores)
    out["Bulfor ganó"] = out["Ganador"].fillna("").str.contains("BULFOR")
    out["Bulfor vs ganador (%)"] = ((out["Precio Bulfor"] / out["Precio ganador"] - 1) * 100).round(1)
    return out.sort_values(["Fecha publicación", "Licitación", "N° línea"], ascending=[False, True, True])


def hoja_ofertas_de(df, ganadores, base, empresa_rut):
    """Todas las líneas donde ofertó una empresa, con su precio y el ganador."""
    propias = df[df["RutProveedor"] == empresa_rut]
    cols = propias.set_index("clave_linea")[["Precio unitario", "Cantidad Ofertada", "Estado Oferta", "Seleccionada"]]
    cols = cols[~cols.index.duplicated()]
    cols = cols.rename(columns={"Precio unitario": "Precio ofertado", "Seleccionada": "Ganó"})
    out = base.join(cols, how="inner").join(ganadores)
    out["Ofertado vs ganador (%)"] = ((out["Precio ofertado"] / out["Precio ganador"] - 1) * 100).round(1)
    return out.sort_values(["Fecha publicación", "Licitación", "N° línea"], ascending=[False, True, True])


def hoja_resumen(df, cara):
    """Una fila por empresa: cuánto participa, cuánto gana y cómo le va contra Bulfor."""
    filas = []
    acep = df[df["Estado Oferta"].ne("Rechazada")]
    bulfor_lic = set(df.loc[df["RutProveedor"] == RUT_BULFOR, "CodigoExterno"])
    for rut, nombre in NOMBRES.items():
        o = df[df["RutProveedor"] == rut]
        if o.empty:
            filas.append({"Empresa": nombre, "RUT": rut})
            continue
        lineas = o["clave_linea"].nunique()
        ganadas = o.loc[o["Seleccionada"], "clave_linea"].nunique()
        fila = {
            "Empresa": nombre, "RUT": rut,
            "Razón social": o["RazonSocialProveedor"].iloc[0],
            "Licitaciones en que ofertó": o["CodigoExterno"].nunique(),
            "Líneas ofertadas": lineas,
            "Líneas ganadas": ganadas,
            "% líneas ganadas": round(100 * ganadas / lineas, 1) if lineas else None,
            "Organismos distintos": o["NombreOrganismo"].nunique(),
            "Última oferta (publicación)": o["Fecha publicación"].max(),
        }
        if rut != RUT_BULFOR:
            col = f"Precio {nombre}"
            comunes = cara[cara[col].notna()] if col in cara else cara.iloc[0:0]
            fila["Licitaciones en común con Bulfor"] = len(set(o["CodigoExterno"]) & bulfor_lic)
            fila["Líneas cara a cara con Bulfor"] = len(comunes)
            if len(comunes):
                fila["Veces más barato que Bulfor"] = int((comunes[col] < comunes["Precio Bulfor"]).sum())
                fila["Veces más caro que Bulfor"] = int((comunes[col] > comunes["Precio Bulfor"]).sum())
                dif = (comunes[col] / comunes["Precio Bulfor"] - 1) * 100
                fila["Diferencia mediana vs Bulfor (%)"] = round(dif.median(), 1)
        filas.append(fila)
    return pd.DataFrame(filas)


def hoja_leeme(desde, hasta, meses_ok, meses_faltan, df):
    lineas = [
        ("Competencia en licitaciones — Etapa 0 (prueba)", ""),
        ("Generado", date.today().isoformat()),
        ("Período pedido", f"{desde} a {hasta} (por mes de PUBLICACIÓN de la licitación)"),
        ("Meses incluidos", ", ".join(meses_ok)),
        ("Meses sin archivo todavía", ", ".join(meses_faltan) or "—"),
        ("Fuente", "Datos Abiertos ChileCompra, archivo mensual de licitaciones (una fila por oferta)."),
        ("Licitaciones incluidas", df["CodigoExterno"].nunique()),
        ("", ""),
        ("Hojas", ""),
        ("Resumen", "Una fila por empresa: participación, líneas ganadas y comparación con Bulfor."),
        ("Cara a cara", "Productos donde ofertó Bulfor y al menos un competidor: precio de cada uno, ganador y diferencia."),
        ("Ofertas Bulfor", "Todo lo que ofertó Bulfor, con el ganador y su precio."),
        ("Ofertas <competidor>", "Todo lo que ofertó cada competidor (también donde Bulfor no participó)."),
        ("Todas las ofertas", "Detalle completo de las licitaciones donde participó Bulfor (todas las empresas)."),
        ("", ""),
        ("Ojo al leer", ""),
        ("Precios", "Precio unitario NETO ofertado, tal como viene en Mercado Público. Revisar la columna Unidad: "
                    "un mismo producto puede pedirse por frasco, por kilo, etc."),
        ("Ganar ≠ más barato", "La adjudicación es por puntaje (precio, plazo, experiencia...). Hay líneas que gana "
                               "una oferta que no es la más barata."),
        ("Unidades distintas", "Algunos comparan por comprimido y otros por frasco (ej. primidona: $58 vs $2.340). "
                               "Por eso el Resumen usa la diferencia MEDIANA, que no se deja llevar por esos casos."),
        ("Meses recientes", "Las licitaciones aún no cerradas o no adjudicadas no muestran ganador."),
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
        print(f"{etiqueta}: {df_mes['CodigoExterno'].nunique()} licitaciones con Bulfor o competidores", file=sys.stderr)

    if not partes:
        sys.exit("No se pudo leer ningún mes.")
    df = preparar(pd.concat(partes, ignore_index=True))
    ganadores = tabla_ganadores(df)
    base = datos_linea(df)

    cara = hoja_cara_a_cara(df, ganadores, base)
    hojas = [("Léeme", hoja_leeme(args.desde, args.hasta, ok, faltan, df)),
             ("Resumen", hoja_resumen(df, cara)),
             ("Cara a cara", cara),
             ("Ofertas Bulfor", hoja_ofertas_de(df, ganadores, base, RUT_BULFOR))]
    for rut, nombre in COMPETIDORES.items():
        hojas.append((f"Ofertas {nombre}", hoja_ofertas_de(df, ganadores, base, rut)))

    # Detalle completo, solo de licitaciones donde participó Bulfor.
    lic_bulfor = set(df.loc[df["RutProveedor"] == RUT_BULFOR, "CodigoExterno"])
    det = df[df["CodigoExterno"].isin(lic_bulfor)]
    det = det.set_index("clave_linea")[["RazonSocialProveedor", "RutProveedor", "Empresa", "Precio unitario",
                                        "Cantidad Ofertada", "Estado Oferta", "Seleccionada"]]
    det = base.join(det, how="inner").rename(columns={"RazonSocialProveedor": "Proveedor", "Seleccionada": "Ganó"})
    det = det.sort_values(["Fecha publicación", "Licitación", "N° línea", "Precio unitario"],
                          ascending=[False, True, True, True])
    hojas.append(("Todas las ofertas", det))

    escribir_excel(args.salida, hojas)
    print(f"Listo: {args.salida}", file=sys.stderr)


if __name__ == "__main__":
    main()
