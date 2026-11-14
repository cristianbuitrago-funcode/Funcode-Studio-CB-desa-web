<#
.SYNOPSIS
  Prueba de humo de la ventana de escritorio en Windows.

.DESCRIPTION
  Con la aplicación ya compilada, comprueba:
    1. Que la ventana abre y permanece abierta.
    2. Que la aplicación inicia el backend empaquetado (fwa-backend.exe).
    3. Que el backend responde y exige el token de la sesión.
    4. Que al cerrar la ventana con normalidad el backend se detiene.
    5. Que al terminar la aplicación de forma abrupta el backend también se detiene.

  Usa un directorio de datos temporal: no toca tus proyectos ni tu configuración.

.EXAMPLE
  pwsh desktop\scripts\windows-window-smoke.ps1 -AppPath desktop\src-tauri\target\release\funcode-web-architect.exe
#>
param(
  [Parameter(Mandatory = $true)][string]$AppPath,
  [string]$Screenshot = ""
)

$ErrorActionPreference = "Stop"
$AppPath = (Resolve-Path $AppPath).Path

function Step([string]$Message) { Write-Host "  ok  $Message" }

function Get-BackendProcesses {
  @(Get-CimInstance Win32_Process -Filter "Name = 'fwa-backend.exe'")
}

function Wait-NoBackend([int[]]$Ids, [int]$Seconds) {
  $deadline = (Get-Date).AddSeconds($Seconds)
  while ((Get-Date) -lt $deadline) {
    $alive = @($Ids | Where-Object { Get-Process -Id $_ -ErrorAction SilentlyContinue })
    if ($alive.Count -eq 0) { return $true }
    Start-Sleep -Milliseconds 300
  }
  return $false
}

function Start-AppAndWait([string]$DataDir) {
  $env:FWA_DATA_DIR = $DataDir
  $app = Start-Process -FilePath $AppPath -PassThru
  $log = Join-Path $DataDir "logs\backend.log"
  $port = $null
  $deadline = (Get-Date).AddSeconds(120)
  while ((Get-Date) -lt $deadline -and -not $port) {
    if ($app.HasExited) { throw "La aplicación terminó al iniciar (código $($app.ExitCode))." }
    if (Test-Path $log) {
      $match = Select-String -Path $log -Pattern "Backend iniciado en el puerto (\d+)" | Select-Object -Last 1
      if ($match) { $port = [int]$match.Matches[0].Groups[1].Value }
    }
    Start-Sleep -Milliseconds 400
  }
  if (-not $port) { throw "La aplicación no inició el backend en 120 s." }
  return @{ App = $app; Port = $port }
}

if (Get-BackendProcesses) { throw "Ya hay un fwa-backend.exe en ejecución. Cierra Funcode Web Architect antes de la prueba." }

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("fwa-ventana-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tmp | Out-Null
$app = $null
try {
  # ---- Arranque y cierre normal ---------------------------------------------
  $run = Start-AppAndWait (Join-Path $tmp "datos-1")
  $app = $run.App
  $base = "http://127.0.0.1:$($run.Port)"

  $backends = Get-BackendProcesses
  if ($backends.Count -eq 0) { throw "No se encontró el proceso fwa-backend.exe." }
  $children = @($backends | Where-Object { $_.ParentProcessId -eq $app.Id })
  if ($children.Count -eq 0) { throw "fwa-backend.exe no es hijo de la aplicación." }
  $backendIds = @($backends | ForEach-Object { [int]$_.ProcessId })
  Step "la aplicación inició el backend empaquetado (PID $($backendIds -join ', '), puerto $($run.Port))"

  $health = Invoke-WebRequest -Uri "$base/health" -UseBasicParsing -TimeoutSec 10
  if ($health.StatusCode -ne 200) { throw "El backend no respondió a /health." }
  $rejected = $false
  try { Invoke-WebRequest -Uri "$base/api/v1/projects" -UseBasicParsing -TimeoutSec 10 | Out-Null }
  catch { $rejected = ($_.Exception.Response.StatusCode.value__ -eq 401) }
  if (-not $rejected) { throw "El backend aceptó una petición sin token." }
  Step "el backend responde y rechaza peticiones sin el token de la sesión"

  $listeners = @(Get-NetTCPConnection -LocalPort $run.Port -State Listen -ErrorAction SilentlyContinue)
  $exposed = @($listeners | Where-Object { $_.LocalAddress -ne "127.0.0.1" })
  if ($listeners.Count -eq 0 -or $exposed.Count -gt 0) { throw "El backend no escucha solo en 127.0.0.1: $($listeners.LocalAddress -join ', ')" }
  Step "el backend escucha únicamente en 127.0.0.1"

  Start-Sleep -Seconds 8
  $app.Refresh()
  if ($app.HasExited) { throw "La ventana se cerró sola." }
  if ($app.MainWindowHandle -eq 0) { throw "La aplicación no tiene ventana visible." }
  Step "la ventana está abierta: «$($app.MainWindowTitle)»"

  if ($Screenshot) {
    Add-Type -AssemblyName System.Windows.Forms, System.Drawing
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $bitmap.Save($Screenshot, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose(); $bitmap.Dispose()
    Step "captura de pantalla guardada en $Screenshot"
  }

  if (-not $app.CloseMainWindow()) { throw "No se pudo enviar el cierre a la ventana." }
  if (-not $app.WaitForExit(30000)) { throw "La aplicación no se cerró en 30 s." }
  if (-not (Wait-NoBackend $backendIds 20)) { throw "El backend siguió en ejecución tras cerrar la ventana." }
  Step "al cerrar la ventana, la aplicación y el backend se detuvieron"

  # ---- Segundo arranque y cierre abrupto --------------------------------------
  $run = Start-AppAndWait (Join-Path $tmp "datos-2")
  $app = $run.App
  $backendIds = @(Get-BackendProcesses | ForEach-Object { [int]$_.ProcessId })
  if ($backendIds.Count -eq 0) { throw "No se inició el backend en el segundo arranque." }
  Stop-Process -Id $app.Id -Force
  if (-not (Wait-NoBackend $backendIds 30)) { throw "El backend quedó huérfano tras terminar la aplicación de forma abrupta." }
  Step "al terminar la aplicación de forma abrupta, el backend se apagó solo"

  Write-Host "Ventana de escritorio (Windows): prueba de humo superada."
}
finally {
  if ($app -and -not $app.HasExited) { Stop-Process -Id $app.Id -Force -ErrorAction SilentlyContinue }
  Get-BackendProcesses | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Remove-Item Env:FWA_DATA_DIR -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 1
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
