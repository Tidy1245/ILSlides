param([Parameter(Mandatory=$true)][string]$JavaHome)
$ErrorActionPreference='Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$env:JAVA_HOME=$JavaHome
npm ci
if($LASTEXITCODE) { throw 'npm ci failed' }
npm test
if($LASTEXITCODE) { throw 'Tests failed' }
npm run build
if($LASTEXITCODE) { throw 'Web build failed' }
npx cap sync android
if($LASTEXITCODE) { throw 'Capacitor sync failed' }
Push-Location android
try {
    .\gradlew.bat assembleDebug
    if($LASTEXITCODE) { throw 'Android build failed' }
} finally { Pop-Location }
$version=(Get-Content package.json -Raw | ConvertFrom-Json).version
$apkName='ILSlides' + $version.Replace('.','-') + '.apk'
New-Item release -ItemType Directory -Force | Out-Null
Copy-Item -LiteralPath android\app\build\outputs\apk\debug\app-debug.apk -Destination (Join-Path release $apkName)
$hash=(Get-FileHash -LiteralPath (Join-Path release $apkName) -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText((Join-Path $PWD 'release\SHA256SUMS.txt'), "$hash  $apkName`n")
Write-Output "APK: release/$apkName"
