#Requires -Version 7.5
param([Parameter(Mandatory=$true)][string]$QaRoot)
$ErrorActionPreference='Stop'
$rootPath=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$cachePath=[IO.Path]::GetFullPath((Join-Path $rootPath '.cache'))
$QaRoot=[IO.Path]::GetFullPath($QaRoot)
if(-not $QaRoot.StartsWith($cachePath+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Identity check is restricted to the owned workspace cache.'}
$state=Get-Content -LiteralPath (Join-Path $QaRoot 'private-state.json') -Raw -Encoding UTF8|ConvertFrom-Json -AsHashtable -DateKind String
if(-not $state.serviceReady -or $state.qaProcessStopped -or -not $state.qaProcess){throw 'No running, ready owned installed process is recorded.'}
function Identity([int]$ProcessId){
    $p=Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId"
    if(-not $p -or -not $p.ExecutablePath){throw 'An exact recorded process is missing or its identity cannot be read.'}
    return @{pid=[int]$p.ProcessId;created=$p.CreationDate.ToUniversalTime().ToString('o');path=[IO.Path]::GetFullPath($p.ExecutablePath);sha256=(Get-FileHash -LiteralPath $p.ExecutablePath -Algorithm SHA256).Hash.ToLowerInvariant();commandLine=$p.CommandLine}
}
foreach($saved in @($state.protectedProcesses)+@($state.qaProcess)){
    $actual=Identity ([int]$saved.pid)
    foreach($key in @('pid','created','path','sha256')){if($actual[$key] -ne $saved[$key]){throw 'A protected or QA process identity changed; browser acceptance must not proceed.'}}
}
$qa=Identity ([int]$state.qaProcess.pid)
$installPath=[IO.Path]::GetFullPath((Join-Path $QaRoot 'installed'))
$dataPath=[IO.Path]::GetFullPath((Join-Path $QaRoot 'data'))
$exePath=Join-Path $installPath 'Figure Studio.exe'
if($qa.path -ne $exePath -or $qa.commandLine -notlike ('*'+$dataPath+'*')){throw 'The ready process does not belong to the exact owned install and data directories.'}
if((Get-Item -LiteralPath $exePath).VersionInfo.ProductVersion -ne $state.version){throw 'The running installed PE version differs from the acceptance state.'}
if((Get-FileHash -LiteralPath (Join-Path $state.packagedApp 'Figure Studio.exe') -Algorithm SHA256).Hash.ToLowerInvariant() -ne $qa.sha256){throw 'The installed process does not match the approved packaged executable.'}
if(@($state.initialRegistry).Count -ne 4 -or @($state.initialRegistry|Where-Object {$_.exists}).Count){throw 'Initial exact AppId registration absence was not established in all four views.'}
$guid='{51D78749-35EE-43BB-BA21-F79D6A1D5094}'
$keyPath="Software\Microsoft\Windows\CurrentVersion\Uninstall\${guid}_is1"
$present=0
foreach($hive in @([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryHive]::LocalMachine)){
    foreach($view in @([Microsoft.Win32.RegistryView]::Registry32,[Microsoft.Win32.RegistryView]::Registry64)){
        $base=[Microsoft.Win32.RegistryKey]::OpenBaseKey($hive,$view)
        try{
            $key=$base.OpenSubKey($keyPath,$false)
            if($null -eq $key){continue}
            try{$location=$key.GetValue('InstallLocation','',[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames);if(-not $location -or [IO.Path]::GetFullPath($location).TrimEnd('\') -ne $installPath.TrimEnd('\')){throw 'The exact AppId registration belongs to another installation.'};$present++}finally{$key.Dispose()}
        }finally{$base.Dispose()}
    }
}
if($present -lt 1){throw 'The original installer registration is unexpectedly absent.'}
@{status='PASS_READ_ONLY_IDENTITY';protectedProcessCount=@($state.protectedProcesses).Count;protectedIdentitiesUnchanged=$true;qaProcessExact=$true;installedExecutableMatchesPackage=$true;currentRegistrationOwned=$true;registeredViewCount=$present;initialRegistryViewsAbsent=4;version=$state.version;powerShellVersion=$PSVersionTable.PSVersion.ToString();scope='Read-only CIM, file hashes and exact AppId registry queries. No process, registry or installed file is modified.'}|ConvertTo-Json -Depth 4
