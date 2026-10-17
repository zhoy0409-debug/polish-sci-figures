#Requires -Version 7.5
param([Parameter(Mandatory=$true)][string]$QaRoot)
$ErrorActionPreference='Stop'
$rootPath=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$cachePath=[IO.Path]::GetFullPath((Join-Path $rootPath '.cache'))
$QaRoot=[IO.Path]::GetFullPath($QaRoot)
if(-not $QaRoot.StartsWith($cachePath+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Final-state queries are restricted to the owned workspace cache.'}
$state=Get-Content -LiteralPath (Join-Path $QaRoot 'private-state.json') -Raw -Encoding UTF8|ConvertFrom-Json -AsHashtable -DateKind String
if(-not $state.uninstalled -or -not $state.reinstallPreserved -or -not $state.qaProcessStopped){throw 'The actual successful reinstall and uninstall state is required.'}
$installPath=[IO.Path]::GetFullPath((Join-Path $QaRoot 'installed'))
$exePath=Join-Path $installPath 'Figure Studio.exe'
if(Test-Path -LiteralPath $exePath){throw 'Owned installed executable is still present.'}
$protectedCount=0
foreach($saved in @($state.protectedProcesses)){
    $actual=Get-CimInstance Win32_Process -Filter ('ProcessId='+[int]$saved.pid)
    if(-not $actual -or -not $actual.ExecutablePath){throw 'A protected process identity is missing or cannot be read.'}
    if([int]$actual.ProcessId -ne [int]$saved.pid -or $actual.CreationDate.ToUniversalTime().ToString('o') -ne $saved.created -or [IO.Path]::GetFullPath($actual.ExecutablePath) -ne $saved.path -or (Get-FileHash -LiteralPath $actual.ExecutablePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $saved.sha256){throw 'A protected process identity changed.'}
    $protectedCount++
}
$ownedProcesses=@(Get-CimInstance Win32_Process -Filter "Name='Figure Studio.exe'"|Where-Object {$_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq $exePath})
if($ownedProcesses.Count){throw 'An executable process from the exact owned install is still running.'}
$guid='{51D78749-35EE-43BB-BA21-F79D6A1D5094}'
$keyPath="Software\Microsoft\Windows\CurrentVersion\Uninstall\${guid}_is1"
$views=@()
foreach($hive in @([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryHive]::LocalMachine)){
    foreach($view in @([Microsoft.Win32.RegistryView]::Registry32,[Microsoft.Win32.RegistryView]::Registry64)){
        $base=[Microsoft.Win32.RegistryKey]::OpenBaseKey($hive,$view)
        try{$key=$base.OpenSubKey($keyPath,$false);$exists=$null -ne $key;if($key){$key.Dispose()};if($exists){throw 'An exact AppId registration remains after uninstall.'};$views+=@{hive=if($hive -eq [Microsoft.Win32.RegistryHive]::CurrentUser){'HKCU'}else{'HKLM'};view=$view.ToString();exists=$exists}}finally{$base.Dispose()}
    }
}
$preserved=@()
$dataPath=[IO.Path]::GetFullPath((Join-Path $QaRoot 'data'))
foreach($item in @($state.preservation)){
    $file=[IO.Path]::GetFullPath((Join-Path $dataPath $item.file))
    if(-not $file.StartsWith($dataPath+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Preservation file escaped the owned data root.'}
    $hash=(Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant()
    if($hash -ne $item.sha256){throw 'A preserved file differs from its pre-reinstall hash.'}
    $role=switch($item.file.Replace('\','/')){'external-sentinel.bin'{'externalSentinel'}'settings.json'{'settings'}'public-projects/actual-saved-public-project.json'{'actualSavedPublicIris'}default{throw 'Unexpected preserved-file role.'}}
    $preserved+=@{role=$role;beforeReinstallSha256=$item.sha256;afterUninstallSha256=$hash;byteExact=$true}
}
$saved=Get-Content -LiteralPath (Join-Path $dataPath 'public-projects/actual-saved-public-project.json') -Raw -Encoding UTF8|ConvertFrom-Json -AsHashtable -DateKind String
if($saved.project.panels[0].table.rows.Count -ne 151){throw 'Actual saved Iris does not have its expected header and 150 observations.'}
@{schema='figure-studio-windows-final-native-query/1';status='PASS_ACTUAL_READ_ONLY_FINAL_QUERY';queriedAtUtc=[DateTime]::UtcNow.ToString('o');version=$state.version;powerShellVersion=$PSVersionTable.PSVersion.ToString();qaProcessStoppedInState=[bool]$state.qaProcessStopped;ownedQaProcessCount=$ownedProcesses.Count;ownedExecutableAbsent=$true;registryViews=$views;protectedOriginalCount=$protectedCount;protectedOriginalIdentityUnchanged=$true;preserved=$preserved;actualIrisObservationCount=150;scope='Read-only CIM, file SHA-256 and all four exact AppId registry view queries after actual normal uninstall. No PID, local path, registry values, token or measurement is disclosed; no process or registry mutation.'}|ConvertTo-Json -Depth 8
