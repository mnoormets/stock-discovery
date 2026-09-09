param(
  [string]$SecUserAgent = '',
  [string]$FmpApiKey = '',
  [string]$Destination = ''
)

$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = if ($Destination) { $Destination } else { Join-Path $projectRoot '.env' }

if (Test-Path -LiteralPath $envPath) {
  Write-Host "Fail on juba olemas: $envPath"
  Write-Host 'Olemasolevat .env faili ei kirjutatud üle.'
  exit 0
}

if (-not $SecUserAgent) {
  $SecUserAgent = Read-Host 'SEC User-Agent (näiteks stock-discovery/1.0 sinu@email.ee)'
}
if (-not $SecUserAgent.Trim()) {
  Write-Error 'SEC User-Agent on vajalik.'
  exit 1
}

$randomBytes = New-Object byte[] 32
$randomGenerator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
try {
  $randomGenerator.GetBytes($randomBytes)
} finally {
  $randomGenerator.Dispose()
}
$cronSecret = ([System.BitConverter]::ToString($randomBytes) -replace '-', '').ToLowerInvariant()
$safeUserAgent = $SecUserAgent.Replace("`r", '').Replace("`n", '')
$safeFmpKey = $FmpApiKey.Replace("`r", '').Replace("`n", '')

$content = @"
DATABASE_URL=postgres://discovery:discovery@db:5432/discovery
DATABASE_TARGET=local
TZ=Europe/Tallinn
CRON_SECRET=$cronSecret
SEC_USER_AGENT=$safeUserAgent
FMP_API_KEY=$safeFmpKey
"@

$parent = Split-Path -Parent $envPath
if ($parent -and -not (Test-Path -LiteralPath $parent)) {
  New-Item -ItemType Directory -Path $parent | Out-Null
}
[System.IO.File]::WriteAllText($envPath, $content, (New-Object System.Text.UTF8Encoding($false)))
Write-Host "Loodi lokaalne keskkonnafail: $envPath"
Write-Host 'CRON_SECRET genereeriti lokaalselt ja selle väärtust ei väljastatud.'
