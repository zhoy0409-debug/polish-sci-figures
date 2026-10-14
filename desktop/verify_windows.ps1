param([string]$Version = '0.1.10')
$ErrorActionPreference = 'Stop'
$studioRoot = Split-Path -Parent $PSScriptRoot
$studioCache = [IO.Path]::GetFullPath((Join-Path $studioRoot '.cache'))
$studioInstall = [IO.Path]::GetFullPath((Join-Path $studioCache 'desktop-installer-qa'))
$studioData = Join-Path $studioCache 'desktop-installer-data'
$studioProof = Join-Path $studioCache "desktop-installer-proof-$Version"
$studioSetup = Join-Path $studioRoot "dist/desktop/polish-sci-figures-Studio-$Version-Setup-x64.exe"
$studioSource = Join-Path $studioRoot 'dist/desktop/Figure Studio'
if (-not $studioInstall.StartsWith($studioCache + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Installer test must remain inside the build workspace.'
}
$studioRegistration = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\{51D78749-35EE-43BB-BA21-F79D6A1D5094}_is1'
if (Test-Path -LiteralPath $studioRegistration) {
    $studioExisting = (Get-ItemProperty -LiteralPath $studioRegistration).InstallLocation
    if ($studioExisting.TrimEnd('\') -ne $studioInstall.TrimEnd('\')) {
        throw 'An existing user installation is registered. Use a separate Windows test account.'
    }
}
New-Item -ItemType Directory -Path $studioData,$studioProof -Force | Out-Null
$studioReport = [ordered]@{version=$Version; passed=$false; checks=@(); environment='local Windows x64; isolated PATH, PYTHONHOME and working directory; not a clean VM'}
$studioSentinel = Join-Path $studioData 'project-backup-test.json'
[IO.File]::WriteAllText($studioSentinel, '{"project":"installer preservation test"}')
$studioSentinelHash = (Get-FileHash -LiteralPath $studioSentinel).Hash
function Invoke-StudioInstaller([string]$label) {
    $studioLog = Join-Path $studioProof "$label.log"
    $studioArgs = '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /NOICONS /TASKS="" /DIR="' + $studioInstall + '" /LOG="' + $studioLog + '"'
    $studioProcess = Start-Process -FilePath $studioSetup -ArgumentList $studioArgs -WindowStyle Hidden -PassThru -Wait
    if ($studioProcess.ExitCode -ne 0) { throw "$label failed: $($studioProcess.ExitCode)" }
}
Invoke-StudioInstaller 'install'
$studioExe = Join-Path $studioInstall 'Figure Studio.exe'
if (-not (Test-Path -LiteralPath $studioExe)) { throw 'Installed executable missing.' }
$studioBytes = [IO.File]::ReadAllBytes($studioExe)
$studioPE = [BitConverter]::ToInt32($studioBytes, 0x3c)
if ([BitConverter]::ToUInt16($studioBytes, $studioPE + 4) -ne 0x8664) { throw 'Executable is not x64.' }
$studioReport.checks += 'Installer installs x64 executable without admin requirement'
foreach ($studioFile in Get-ChildItem -LiteralPath $studioSource -File -Recurse) {
    $studioRelative = $studioFile.FullName.Substring($studioSource.Length).TrimStart('\')
    $studioTarget = Join-Path $studioInstall $studioRelative
    if (-not (Test-Path -LiteralPath $studioTarget)) { throw "Missing installed file: $studioRelative" }
    if ((Get-FileHash -LiteralPath $studioFile.FullName).Hash -ne (Get-FileHash -LiteralPath $studioTarget).Hash) {
        throw "Installed file mismatch: $studioRelative"
    }
}
$studioReport.checks += 'Every installed application file matches the packaged build'
$studioSavedEnv = @{PATH=$env:PATH; PYTHONHOME=$env:PYTHONHOME; PYTHONPATH=$env:PYTHONPATH; PYTHONNOUSERSITE=$env:PYTHONNOUSERSITE}
try {
    $env:PATH = "$env:SystemRoot\System32;$env:SystemRoot"
    $env:PYTHONHOME = 'Z:\intentionally-unavailable-python'
    $env:PYTHONPATH = ''
    $env:PYTHONNOUSERSITE = '1'
    $studioArgs = '--self-test --data-dir "' + $studioData + '" --output-dir "' + $studioProof + '"'
    $studioProcess = Start-Process -FilePath $studioExe -ArgumentList $studioArgs -WorkingDirectory $env:TEMP -WindowStyle Hidden -PassThru -Wait
    if ($studioProcess.ExitCode -ne 0) { throw 'Installed app self-test failed. Inspect self-test.json.' }
} finally {
    foreach ($studioKey in $studioSavedEnv.Keys) { [Environment]::SetEnvironmentVariable($studioKey, $studioSavedEnv[$studioKey], 'Process') }
}
$studioReport.selfTest = Get-Content -LiteralPath (Join-Path $studioProof 'self-test.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $studioReport.selfTest.passed -or -not $studioReport.selfTest.frozen) { throw 'Self-test did not verify frozen runtime.' }
$studioReport.checks += 'Installed EXE completes Tk, HTTP analysis, rendering and reflow with no Python on PATH'
$studioSettings = Join-Path $studioData 'settings.json'
$studioSettingsHash = if (Test-Path -LiteralPath $studioSettings) { (Get-FileHash -LiteralPath $studioSettings).Hash } else { $null }
Invoke-StudioInstaller 'upgrade'
if ((Get-FileHash -LiteralPath $studioSentinel).Hash -ne $studioSentinelHash) { throw 'Upgrade altered user data.' }
if ($studioSettingsHash -and (Get-FileHash -LiteralPath $studioSettings).Hash -ne $studioSettingsHash) { throw 'Upgrade altered settings.' }
$studioReport.checks += 'Reinstall / upgrade preserves external project data and settings'
$studioUninstall = Join-Path $studioInstall 'unins000.exe'
$studioProcess = Start-Process -FilePath $studioUninstall -ArgumentList '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART' -WindowStyle Hidden -PassThru -Wait
if ($studioProcess.ExitCode -ne 0 -or (Test-Path -LiteralPath $studioExe)) { throw 'Uninstall did not remove the application.' }
if ((Get-FileHash -LiteralPath $studioSentinel).Hash -ne $studioSentinelHash) { throw 'Uninstall altered user data.' }
$studioReport.checks += 'Uninstall removes application and keeps external project data'
$studioReport.passed = $true
$studioReport | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $studioProof 'installer-verification.json') -Encoding UTF8
$studioReport | ConvertTo-Json -Depth 8
