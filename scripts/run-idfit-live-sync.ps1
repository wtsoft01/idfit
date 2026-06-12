$ErrorActionPreference = 'Continue'
$AppDir = 'C:/Users/Admin/AppData/Roaming/V-Claw/.openclaw/workspace/main/projects/dealfinder'
$PreferredNodeExe = 'C:/Program Files/V-Claw/resources/node-runtime/win-x64/node.exe'\r\n$NodeExe = if (Test-Path $PreferredNodeExe) { $PreferredNodeExe } else { 'node' }
$LogDir = Join-Path $AppDir 'logs'
$LogFile = Join-Path $LogDir 'idfit-live-sync.log'
$LockFile = Join-Path $LogDir 'idfit-live-sync.lock'
New-Item -ItemType Directory -Force $LogDir | Out-Null
Set-Location $AppDir

function Test-ProcessAlive($processId) {
  if (-not $processId) { return $false }
  return [bool](Get-Process -Id $processId -ErrorAction SilentlyContinue)
}

if (Test-Path $LockFile) {
  $lockPid = (Get-Content $LockFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if (Test-ProcessAlive $lockPid) { exit 0 }
}

$PID | Set-Content -Path $LockFile
try {
  Add-Content -Path $LogFile -Value "[$(Get-Date -Format o)] IDFIT live sync starting"
  & $NodeExe scripts/telegram-live-sync.mjs --watch --limit 50 --source-timeout-ms 120000 *>> $LogFile
  $exitCode = $LASTEXITCODE
  Add-Content -Path $LogFile -Value "[$(Get-Date -Format o)] IDFIT live sync stopped with code $exitCode"
  exit $exitCode
} finally {
  Remove-Item $LockFile -Force -ErrorAction SilentlyContinue
}


