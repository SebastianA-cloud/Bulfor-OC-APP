name: Sincronizar Buscador de Documentos

on:
  schedule:
    - cron: '30 6 * * *'  # 3:30am hora Chile
  workflow_dispatch:
    inputs:
      limite_detalle:
        description: 'Cuántos documentos revisar para traer sus productos en esta corrida'
        required: false
        default: '150'
      limite_fiscal:
        description: 'Cuántos documentos revisar de estado fiscal en esta corrida'
        required: false
        default: '200'

jobs:
  sincronizar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Instalar Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Instalar dependencias
        run: pip install requests supabase

      - name: Ejecutar sincronización
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_KEY: ${{ secrets.SUPABASE_KEY }}
          DTEBOX_IP: ${{ secrets.DTEBOX_IP }}
          GDEXPRESS_API_KEY: ${{ secrets.GDEXPRESS_API_KEY }}
          LIMITE_DETALLE: ${{ github.event.inputs.limite_detalle || '150' }}
          LIMITE_FISCAL: ${{ github.event.inputs.limite_fiscal || '200' }}
        run: python sincronizar_documentos_gdexpress.py
