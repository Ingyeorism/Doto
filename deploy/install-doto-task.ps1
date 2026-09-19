# Registers the Doto server as a Windows scheduled task that starts at boot.
# The Cloudflare Tunnel (cloudflared service) fronts it at https://dotoschool.uk,
# so without this the tunnel stays up but has nothing to serve.
#
# Run from an ADMIN PowerShell:
#   powershell -ExecutionPolicy Bypass -File deploy\install-doto-task.ps1

$ErrorActionPreference = 'Stop'

$node = 'C:\Program Files\nodejs\node.exe'
$root = 'C:\Users\strata\Documents\ChatGPT\Doto'
$name = 'Doto Server'

if (-not (Test-Path $node)) { throw "node.exe not found at $node" }
if (-not (Test-Path (Join-Path $root 'server\index.mjs'))) { throw "Doto not found at $root" }

$action = New-ScheduledTaskAction -Execute $node `
  -Argument '--env-file-if-exists=.env server\index.mjs' `
  -WorkingDirectory $root

$trigger = New-ScheduledTaskTrigger -AtStartup

# SYSTEM so it runs without anyone logging in.
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

# Restart on crash, never time out, never start a second copy.
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
  -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $name `
  -Description 'Doto app server behind the Cloudflare Tunnel (dotoschool.uk)' `
  -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null

Write-Host "Registered scheduled task '$name'."

# Free port 3000 first: a manually started server would block the task.
Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
  Where-Object { $_.CommandLine -like '*server?index.mjs*' } |
  ForEach-Object {
    Write-Host "Stopping existing Doto server (PID $($_.ProcessId))."
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
Start-Sleep -Seconds 2

Start-ScheduledTask -TaskName $name
Start-Sleep -Seconds 8

$info = Get-ScheduledTaskInfo -TaskName $name
Write-Host ("State: {0}  LastResult: {1}" -f (Get-ScheduledTask -TaskName $name).State, $info.LastTaskResult)
Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue |
  Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table

try {
  $code = (Invoke-WebRequest -Uri 'https://dotoschool.uk/' -UseBasicParsing -TimeoutSec 15).StatusCode
  Write-Host "https://dotoschool.uk -> $code"
} catch {
  Write-Host "https://dotoschool.uk check failed: $_"
}
