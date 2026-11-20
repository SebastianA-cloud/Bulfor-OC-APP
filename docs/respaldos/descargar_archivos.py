"""Descarga todas las fotos de los buckets de Supabase Storage a una carpeta.

Lo usa el respaldo semanal (copiar junto a respaldo-semanal.yml en el
repositorio privado). Solo LEE: no borra ni cambia nada.

Uso: python descargar_archivos.py <carpeta_destino>
Necesita SUPABASE_URL y SUPABASE_SERVICE_KEY en el entorno.
"""
import os
import sys

import requests

URL = os.environ["SUPABASE_URL"].rstrip("/")
KEY = os.environ["SUPABASE_SERVICE_KEY"]
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
BUCKETS = ["recetas", "recetas-web"]
destino = sys.argv[1] if len(sys.argv) > 1 else "archivos"


def listar(bucket, prefijo=""):
    """Lista los archivos de un bucket, entrando a las carpetas."""
    offset = 0
    while True:
        r = requests.post(f"{URL}/storage/v1/object/list/{bucket}", headers=H, timeout=60,
                          json={"prefix": prefijo, "limit": 1000, "offset": offset})
        r.raise_for_status()
        filas = r.json()
        for f in filas:
            ruta = f"{prefijo}{f['name']}"
            if f.get("id") is None:  # sin id = carpeta
                yield from listar(bucket, ruta + "/")
            else:
                yield ruta
        if len(filas) < 1000:
            break
        offset += 1000


total = 0
for bucket in BUCKETS:
    for ruta in listar(bucket):
        r = requests.get(f"{URL}/storage/v1/object/authenticated/{bucket}/{ruta}", headers=H, timeout=120)
        r.raise_for_status()
        archivo = os.path.join(destino, bucket, ruta)
        os.makedirs(os.path.dirname(archivo), exist_ok=True)
        with open(archivo, "wb") as fh:
            fh.write(r.content)
        total += 1
    print(f"{bucket}: listo")
print(f"Total: {total} archivos respaldados")
