# =====================================================================
#  Bulfor Sync Recetario (Pharma_RM / MySQL) -> Supabase
#  Lee el recetario magistral SOLO CON SELECT y envía a la app:
#  formas farmacéuticas, materias primas, lotes, compras, proveedores
#  y cada RM con su fórmula, el nombre de la institución (si el
#  "paciente" es un hospital) y el nombre y RUT del paciente (personas).
#  Sin direcciones, teléfonos ni datos de médicos.
#  Se ejecuta cada 30 minutos con el Programador de tareas de Windows.
#  Compatible con Windows Server 2016 / PowerShell 5.1.
#
#  Versión 2 (pacientes): la primera vez que corre vuelve a enviar todos
#  los RM desde carga_inicial_desde, para completar el paciente de los
#  RM antiguos. Después sigue igual que antes (nuevos + últimos 7/90 días).
# =====================================================================
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$Base     = 'C:\BulforSync\recetario'      # carpeta protegida: solo Administradores y SYSTEM
$CfgFile  = Join-Path $Base 'config_recetario.json'
$LogDir   = Join-Path $Base 'logs'
$LogFile  = Join-Path $LogDir 'recetario.log'
$CacheDir = Join-Path $Base 'cache_recetario'
New-Item -ItemType Directory -Force -Path $LogDir, $CacheDir | Out-Null

function Log([string]$msg) {
    $line = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $msg
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    Write-Host $line
    if ((Get-Item $LogFile).Length -gt 5MB) { Move-Item $LogFile ($LogFile + '.old') -Force }
}

# Cualquier error (también al leer la configuración) queda en el log
trap {
    $det = if ($_.ErrorDetails) { ' ' + $_.ErrorDetails.Message } else { '' }
    Log ("ERROR  " + $_.Exception.Message + $det)
    exit 1
}

# Una sola ejecución a la vez (si la anterior sigue corriendo, esta se salta)
try { $Candado = [IO.File]::Open((Join-Path $CacheDir 'en_ejecucion.lock'), 'OpenOrCreate', 'ReadWrite', 'None') }
catch { Log 'Otra ejecucion sigue en curso: se omite esta vuelta.'; exit 0 }

$cfg     = Get-Content $CfgFile -Raw | ConvertFrom-Json
$RmDir   = if ($cfg.pharma_rm_dir) { $cfg.pharma_rm_dir } else { 'C:\apps\Pharma_RM' }
$RpcUrl  = $cfg.supabase_url.TrimEnd('/') + '/rest/v1/rpc/'
$Headers = @{ apikey = $cfg.supabase_anon_key; Authorization = 'Bearer ' + $cfg.supabase_anon_key }
$Token   = $cfg.token
$Desde   = [datetime]::ParseExact($cfg.carga_inicial_desde, 'yyyy-MM-dd', $null).ToString('yyyy-MM-dd')
$Agente  = $env:COMPUTERNAME
$Bloque  = 1000     # filas por envío (maestros)
$RangoRm = 400      # RM por envío

# Copia local de la librería de MySQL (no se carga desde la carpeta compartida de Pharma_RM)
Add-Type -Path (Join-Path $Base 'MySql.Data.dll')

# Conexión: si existe el usuario de solo lectura (crear_usuario_lectura.ps1) se usa ese;
# si no, la misma conexión que usa Pharma_RM. En ambos casos aquí solo se ejecutan SELECT.
$LecturaFile = Join-Path $Base 'recetario_mysql.dat'
if (Test-Path $LecturaFile) {
    Add-Type -AssemblyName System.Security
    $enc = [IO.File]::ReadAllBytes($LecturaFile)
    $MyConn = [Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect($enc, $null, [Security.Cryptography.DataProtectionScope]::LocalMachine))
    $ModoConexion = 'usuario solo lectura'
} else {
    [xml]$xcfg = Get-Content (Join-Path $RmDir 'Pharma_RM.exe.config')
    $MyConn = ($xcfg.configuration.connectionStrings.add | Where-Object { $_.name -eq 'DBMYSQL' }).connectionString
    $ModoConexion = 'conexion de Pharma_RM'
}
# Columnas TINYINT(1) como números (no true/false)
try {
    $csb = New-Object MySql.Data.MySqlClient.MySqlConnectionStringBuilder $MyConn
    $csb.TreatTinyAsBoolean = $false
    $MyConn = $csb.ConnectionString
} catch { }   # versiones antiguas de la librería: igual se convierten true/false a 1/0 más abajo

# ---------------------------------------------------------------- MySQL (solo lectura)
function Invoke-My([string]$query) {
    $cn = New-Object MySql.Data.MySqlClient.MySqlConnection $MyConn
    $cn.Open()
    try {
        $cmd = $cn.CreateCommand()
        $cmd.CommandText = $query
        $cmd.CommandTimeout = 300
        $rd = $cmd.ExecuteReader()
        $rows = New-Object System.Collections.Generic.List[object]
        while ($rd.Read()) {
            $o = [ordered]@{}
            for ($i = 0; $i -lt $rd.FieldCount; $i++) {
                $v = $null
                if (-not $rd.IsDBNull($i)) {
                    $v = $rd.GetValue($i)
                    if ($v -is [byte[]]) { $v = [Text.Encoding]::UTF8.GetString($v) }      # MySQL 5.0 devuelve DATE_FORMAT como binario
                    elseif ($v -is [datetime]) { $v = $v.ToString('yyyy-MM-dd HH:mm:ss') }
                    elseif ($v -is [bool]) { $v = [int]$v }
                    elseif ($v -is [sbyte] -or $v -is [byte] -or $v -is [int16] -or $v -is [uint16]) { $v = [int]$v }
                    elseif ($v -is [uint32] -or $v -is [uint64]) { $v = [int64]$v }
                }
                $o[$rd.GetName($i)] = $v
            }
            $rows.Add($o)
        }
        $rd.Close()
        return ,$rows
    } finally { $cn.Close() }
}

function Escalar([string]$query) {
    $r = Invoke-My $query
    if ($r.Count -eq 0) { return $null }
    $v = @($r[0].Values)[0]
    if ($null -eq $v) { return $null }
    return [int64]$v
}

# ---------------------------------------------------------------- Supabase
function Send-Rpc([string]$fn, $body) {
    $json  = $body | ConvertTo-Json -Depth 6 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    $intento = 0
    while ($true) {
        try {
            return Invoke-RestMethod -Uri ($RpcUrl + $fn) -Method Post -Headers $Headers `
                   -ContentType 'application/json; charset=utf-8' -Body $bytes -TimeoutSec 180
        } catch {
            $intento++
            if ($intento -ge 3) { throw }
            Start-Sleep -Seconds (15 * $intento)
        }
    }
}

function Send-Bloques([string]$clave, $rows) {
    $enviados = 0
    for ($i = 0; $i -lt $rows.Count; $i += $Bloque) {
        $fin   = [Math]::Min($i + $Bloque, $rows.Count) - 1
        $trozo = New-Object System.Collections.Generic.List[object]
        for ($j = $i; $j -le $fin; $j++) { $trozo.Add($rows[$j]) }
        $payload = @{ agente = $Agente }
        $payload[$clave] = $trozo.ToArray()
        [void](Send-Rpc 'rec_ingest' @{ p_token = $Token; p_payload = $payload })
        $enviados += $trozo.Count
    }
    return $enviados
}

# Envía solo las filas que cambiaron desde la última vez (caché local)
function Send-Cambios([string]$clave, $rows, [string]$keyCol, [string]$cacheName) {
    $cacheFile = Join-Path $CacheDir $cacheName
    $prev = @{}
    if (Test-Path $cacheFile) {
        foreach ($l in [IO.File]::ReadAllLines($cacheFile)) {
            $p = $l.IndexOf('|'); if ($p -gt 0) { $prev[$l.Substring(0, $p)] = $l.Substring($p + 1) }
        }
    }
    $cambios = New-Object System.Collections.Generic.List[object]
    $nuevo   = New-Object System.Collections.Generic.List[string]
    foreach ($r in $rows) {
        $k   = [string]$r[$keyCol]
        $sig = (($r.Values | ForEach-Object { [string]$_ }) -join [char]0x00A6)
        $nuevo.Add($k + '|' + $sig)
        if (-not $prev.ContainsKey($k) -or $prev[$k] -cne $sig) { $cambios.Add($r) }
    }
    $n = 0
    if ($cambios.Count -gt 0) { $n = Send-Bloques $clave $cambios }
    [IO.File]::WriteAllLines($cacheFile, $nuevo)   # solo se guarda si el envío fue exitoso
    return $n
}

# ---------------------------------------------------------------- Consultas
$SqlFormas = "SELECT idFormaFarma AS id_forma, detalle AS nombre, tipoCalculo AS tipo_calculo, unidad, diasVencimiento AS dias_vencimiento FROM formafarma"

$SqlMaterias = @"
SELECT idProducto AS id_producto, detalle AS nombre, unidadMedida AS unidad_medida, unidadMedidaEquivalencia AS unidad_stock,
       codigo_ISP AS codigo_isp, precio_costo, precio_venta, controlado, activo, sinonimo, codigobase AS codigo_base,
       stock AS stock_programa, stockCritico AS stock_critico, diasVencimiento AS dias_vencimiento,
       tipoMateriaPrima AS tipo_materia, DATE_FORMAT(fechaModificacion, '%Y-%m-%d %H:%i:%s') AS fecha_modificacion
FROM producto
"@

$SqlLotes = "SELECT idProductoLote AS id_lote, idProducto AS id_producto, lote, DATE_FORMAT(FechaVencimientoLote, '%Y-%m-%d') AS vence, activo FROM producto_lote"

$SqlProveedores = "SELECT idProveedor AS id_proveedor, nombre, razon_social FROM proveedor"

$SqlIngresos = @"
SELECT x.idIngresoDetalle AS id_detalle, i.idIngreso AS id_ingreso, DATE_FORMAT(i.fecha_ingreso, '%Y-%m-%d') AS fecha,
       i.idProveedor AS id_proveedor, i.guia, x.idProducto AS id_producto, x.cantidad, x.precio_compra, x.idProductoLote AS id_lote
FROM ingreso_stock_detalle x JOIN ingreso_stock i ON i.idIngreso = x.idIngreso
"@

# Paciente: si el RUT es de persona (< 50.000.000) se envía su nombre y RUT (el
# dígito verificador lo calcula Supabase). Si es de una institución, va como
# "institucion", igual que antes.
function Sql-Rm([int64]$a, [int64]$b) {
    return @"
SELECT d.idRpDetalle AS id_rp_detalle, d.idRp AS id_rp, d.folio, DATE_FORMAT(r.FechaCreacion, '%Y-%m-%d %H:%i:%s') AS fecha,
       r.local, r.tipoReceta AS tipo_receta, d.idFormaFarma AS id_forma, d.Cantidad AS cantidad, d.unidad_forma_farma AS unidad,
       d.frascos, d.Indicaciones AS indicaciones, r.contrasena,
       CASE WHEN r.rut >= 50000000 THEN TRIM(CONCAT_WS(' ', r.nombre, r.paterno, r.materno)) ELSE NULL END AS institucion,
       d.valor_rp_real AS valor_programa,
       CASE WHEN r.rut > 0 AND r.rut < 50000000 THEN TRIM(CONCAT_WS(' ', r.nombre, r.paterno, r.materno)) ELSE NULL END AS paciente_nombre,
       CASE WHEN r.rut > 0 AND r.rut < 50000000 THEN r.rut ELSE NULL END AS paciente_rut
FROM receta_rp_detalle d JOIN receta_rp r ON r.idRp = d.idRp
WHERE d.idRpDetalle BETWEEN $a AND $b
"@
}

function Sql-Componentes([int64]$a, [int64]$b) {
    return @"
SELECT 'A' AS tipo, c.idRpProductos AS id, c.idRpDetalle AS id_rp_detalle, c.idProducto AS id_producto, c.cantidad, c.etiqueta,
       c.idUnidad AS id_unidad, c.idUnidadCosto AS id_unidad_costo, c.precio_costo, c.precio_venta, c.idProductoLote AS id_lote
FROM receta_rp_componentes c WHERE c.idRpDetalle BETWEEN $a AND $b
UNION ALL
SELECT 'E', e.idRpProductos, e.idRpDetalle, e.idProducto, e.cantidad, e.etiqueta,
       e.idUnidad, e.idUnidadCosto, e.precio_costo, e.precio_venta, e.idProductoLote
FROM receta_rp_excipientes e WHERE e.idRpDetalle BETWEEN $a AND $b
"@
}

function MinIdDesde([string]$condicion) {
    return Escalar "SELECT MIN(d.idRpDetalle) AS m FROM receta_rp_detalle d JOIN receta_rp r ON r.idRp = d.idRp WHERE $condicion"
}

# ================================================================= PROCESO
try {
    Log ("--- inicio (" + $ModoConexion + ")")
    $est = Send-Rpc 'rec_estado' @{ p_token = $Token }

    # 1) Maestros: solo lo que cambió
    $nFor = Send-Cambios 'formas'      (Invoke-My $SqlFormas)      'id_forma'     'formas.txt'
    $nMat = Send-Cambios 'materias'    (Invoke-My $SqlMaterias)    'id_producto'  'materias.txt'
    $nPro = Send-Cambios 'proveedores' (Invoke-My $SqlProveedores) 'id_proveedor' 'proveedores.txt'
    $nLot = Send-Cambios 'lotes'       (Invoke-My $SqlLotes)       'id_lote'      'lotes.txt'
    $nIng = Send-Cambios 'ingresos'    (Invoke-My $SqlIngresos)    'id_detalle'   'ingresos.txt'

    # 2) RM con su fórmula, por rangos de idRpDetalle.
    #    Primera vez: todo desde carga_inicial_desde. Después: RM nuevos + últimos 7 días
    #    (para captar folios asignados después, lotes corregidos, etc.) y una vez al día los últimos 90.
    $marcaInicial = Join-Path $CacheDir 'carga_inicial_ok.txt'
    $progreso     = Join-Path $CacheDir 'carga_inicial_progreso.txt'
    $marcaDiaria  = Join-Path $CacheDir 'repaso_diario.txt'
    $hoy   = Get-Date -Format 'yyyy-MM-dd'

    # Versión 2 (pacientes): una sola vez se repite la carga inicial completa para
    # completar el paciente de los RM antiguos. "pacientes_en_curso" evita que, si esa
    # carga se corta, vuelva a empezar de cero (sigue desde donde quedó).
    $marcaPacientes   = Join-Path $CacheDir 'pacientes_ok.txt'
    $pacientesEnCurso = Join-Path $CacheDir 'pacientes_en_curso.txt'
    if (-not (Test-Path $marcaPacientes) -and -not (Test-Path $pacientesEnCurso)) {
        Remove-Item $marcaInicial, $progreso -ErrorAction SilentlyContinue
        Set-Content $pacientesEnCurso $hoy
        Log 'Version 2: se vuelven a enviar todos los RM para completar el paciente.'
    }

    $maxId = Escalar "SELECT MAX(idRpDetalle) AS m FROM receta_rp_detalle"
    if ($null -eq $maxId) { $maxId = 0 }
    $ult = if ($est.ultimo_rp_detalle) { [int64]$est.ultimo_rp_detalle } else { 0 }

    $inicial = (-not (Test-Path $marcaInicial)) -or $ult -eq 0
    if ($inicial) {
        $inicio = MinIdDesde ("r.FechaCreacion >= '" + $Desde + "'")
        # Si una carga inicial anterior se cortó, se sigue desde donde quedó
        $hecho = if (Test-Path $progreso) { [string](Get-Content $progreso -Raw) } else { '' }
        if ($hecho.Trim() -match '^\d+$' -and $null -ne $inicio) { $inicio = [Math]::Max([int64]$inicio, [int64]$hecho.Trim() + 1) }
        $tipo = 'carga inicial desde ' + $Desde
    } else {
        $dias = 7
        $ultimoRepaso = if (Test-Path $marcaDiaria) { ([string](Get-Content $marcaDiaria -Raw)).Trim() } else { '' }
        if ($ultimoRepaso -ne $hoy) { $dias = 90 }
        $inicio = MinIdDesde ("r.FechaCreacion >= DATE_SUB(CURDATE(), INTERVAL " + $dias + " DAY)")
        if ($null -eq $inicio -or ($ult + 1 -lt $inicio)) { $inicio = $ult + 1 }
        $tipo = 'ultimos ' + $dias + ' dias'
    }
    if ($null -eq $inicio) { $inicio = $maxId + 1 }

    $nRm = 0; $nCo = 0
    for ($a = [int64]$inicio; $a -le $maxId; $a += $RangoRm) {
        $b    = $a + $RangoRm - 1
        $rm   = Invoke-My (Sql-Rm $a $b)
        $comp = Invoke-My (Sql-Componentes $a $b)
        $payload = @{ agente = $Agente; rango = @{ desde = $a; hasta = $b }; rm = $rm.ToArray(); componentes = $comp.ToArray() }
        [void](Send-Rpc 'rec_ingest' @{ p_token = $Token; p_payload = $payload })
        $nRm += $rm.Count; $nCo += $comp.Count
        if ($inicial) { Set-Content $progreso ([string]$b) }
    }
    if ($inicial) {
        Set-Content $marcaInicial $hoy
        if (Test-Path $pacientesEnCurso) {
            Set-Content $marcaPacientes $hoy
            Remove-Item $pacientesEnCurso -ErrorAction SilentlyContinue
            Log 'Version 2: pacientes completados.'
        }
    }
    Set-Content $marcaDiaria $hoy

    # Marca de vida
    [void](Send-Rpc 'rec_ingest' @{ p_token = $Token; p_payload = @{ agente = $Agente } })

    Log ("OK  " + $tipo + "  formas=$nFor materias=$nMat proveedores=$nPro lotes=$nLot compras=$nIng rm=$nRm lineas=$nCo")
    exit 0
} catch {
    $det = if ($_.ErrorDetails) { ' ' + $_.ErrorDetails.Message } else { '' }
    Log ("ERROR  " + $_.Exception.Message + $det)
    exit 1
}
