#Requires -Version 7.5
param(
    [Parameter(Mandatory=$true)][ValidateSet('Install','Start','Reinstall','Uninstall')][string]$Phase,
    [string]$Version='0.1.23',
    [string]$QaRoot='',
    [string]$PackageRoot='',
    [string]$ExpectedSetupSha256='',
    [int]$Port=18788,
    [string]$ProjectPayload='',
    [string]$EvidenceAttempt='',
    [switch]$BrowserAcceptanceComplete,
    [switch]$CleanupIncompleteAttempt
)
$ErrorActionPreference='Stop'
if($EvidenceAttempt -and $EvidenceAttempt -cnotmatch '^[a-z0-9][a-z0-9-]{0,39}$'){throw 'Evidence attempt must be a short explicit lowercase identifier.'}
$rootPath=[IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$cachePath=[IO.Path]::GetFullPath((Join-Path $rootPath '.cache'))
if(-not $QaRoot){$QaRoot=Join-Path $cachePath "live-preview-windows-qa-$Version"}
$QaRoot=[IO.Path]::GetFullPath($QaRoot)
if(-not $QaRoot.StartsWith($cachePath+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'QA root must be inside this workspace cache.'}
$installPath=[IO.Path]::GetFullPath((Join-Path $QaRoot 'installed'))
$dataPath=[IO.Path]::GetFullPath((Join-Path $QaRoot 'data'))
$localPath=[IO.Path]::GetFullPath((Join-Path $QaRoot 'localappdata'))
$proofPath=[IO.Path]::GetFullPath((Join-Path $QaRoot 'proof'))
$emptyPath=[IO.Path]::GetFullPath((Join-Path $QaRoot 'empty-cwd'))
$statePath=Join-Path $QaRoot 'private-state.json'
$exePath=Join-Path $installPath 'Figure Studio.exe'
$appGuid='{51D78749-35EE-43BB-BA21-F79D6A1D5094}'
$registryKey="Software\Microsoft\Windows\CurrentVersion\Uninstall\${appGuid}_is1"
if(-not (Get-Content -LiteralPath (Join-Path $rootPath 'desktop/FigureStudio.iss') -Raw -Encoding UTF8).Contains('AppId={'+$appGuid)){throw 'QA AppId differs from the actual installer source.'}
foreach($owned in @($installPath,$dataPath,$localPath,$proofPath,$emptyPath)){
    if(-not $owned.StartsWith($QaRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Computed QA path escaped its owned root.'}
}
if(-not [Environment]::Is64BitOperatingSystem){throw 'This acceptance requires actual Windows x64.'}
function Hash-File([string]$File){return (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant()}
function Save-State {
    $json=$script:state|ConvertTo-Json -Depth 24
    [IO.File]::WriteAllText($statePath,$json,[Text.UTF8Encoding]::new($false))
}
function Registry-Snapshot {
    $result=@()
    foreach($hive in @([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryHive]::LocalMachine)){
        foreach($view in @([Microsoft.Win32.RegistryView]::Registry32,[Microsoft.Win32.RegistryView]::Registry64)){
            $base=[Microsoft.Win32.RegistryKey]::OpenBaseKey($hive,$view)
            try{
                $key=$base.OpenSubKey($registryKey,$false)
                if($null -eq $key){$result+=@{hive=$hive.ToString();view=$view.ToString();exists=$false};continue}
                try{
                    $values=@()
                    foreach($name in $key.GetValueNames()){$values+=@{name=$name;kind=$key.GetValueKind($name).ToString();value=$key.GetValue($name,$null,[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)}}
                    $result+=@{hive=$hive.ToString();view=$view.ToString();exists=$true;installLocation=$key.GetValue('InstallLocation','',[Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames);values=$values}
                }finally{$key.Dispose()}
            }finally{$base.Dispose()}
        }
    }
    return ,$result
}
function Process-Identity([int]$ProcessId){
    $item=Get-CimInstance Win32_Process -Filter "ProcessId=$ProcessId" -ErrorAction Stop
    if(-not $item -or -not $item.ExecutablePath){throw 'A protected process is missing or its precise executable identity is unreadable.'}
    return @{pid=[int]$item.ProcessId;created=$item.CreationDate.ToUniversalTime().ToString('o');path=[IO.Path]::GetFullPath($item.ExecutablePath);sha256=(Hash-File $item.ExecutablePath);commandLine=$item.CommandLine}
}
function Snapshot-Protected {
    $items=@(Get-CimInstance Win32_Process -Filter "Name='Figure Studio.exe'")
    return ,@($items|ForEach-Object {Process-Identity ([int]$_.ProcessId)})
}
function Assert-Protected {
    foreach($saved in $script:state.protectedProcesses){
        $current=Process-Identity ([int]$saved.pid)
        foreach($key in @('pid','created','path','sha256')){if($current[$key] -ne $saved[$key]){throw 'A protected process identity or executable changed; no cleanup is authorized.'}}
    }
}
function Assert-OwnedRegistration {
    $snapshot=Registry-Snapshot
    $present=@($snapshot|Where-Object {$_.exists})
    if($present.Count -lt 1){throw 'The exact QA AppId registration is unexpectedly absent.'}
    foreach($entry in $present){if(-not $entry.installLocation -or [IO.Path]::GetFullPath($entry.installLocation).TrimEnd('\') -ne $installPath.TrimEnd('\')){throw 'Exact AppId registration now belongs to another installation; abort.'}}
    return ,$snapshot
}
function Assert-Package {
    if((Hash-File $script:state.setup) -ne $script:state.setupSha256){throw 'The approved Setup bytes changed.'}
    $expected=@(Get-ChildItem -LiteralPath $script:state.packagedApp -File -Recurse|Sort-Object FullName)
    if($expected.Count -lt 100){throw 'The packaged file tree is unexpectedly small.'}
    $rows=@()
    foreach($file in $expected){
        $relative=$file.FullName.Substring($script:state.packagedApp.Length).TrimStart('\')
        $target=[IO.Path]::GetFullPath((Join-Path $installPath $relative))
        if(-not $target.StartsWith($installPath+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Package entry escapes the owned install directory.'}
        $sourceSha=Hash-File $file.FullName
        if(-not (Test-Path -LiteralPath $target -PathType Leaf) -or (Hash-File $target) -ne $sourceSha){throw "Installed package mismatch: $relative"}
        $rows+=@{file=$relative;sha256=$sourceSha}
    }
    $manifest=Join-Path $proofPath ("packaged-files-"+$Phase+".json")
    [IO.File]::WriteAllText($manifest,($rows|ConvertTo-Json -Depth 4),[Text.UTF8Encoding]::new($false))
    return @{fileCount=$rows.Count;manifestSha256=(Hash-File $manifest);everyPackagedFileMatches=$true}
}
function Invoke-Installer([string]$Label){
    Assert-Protected
    if($Label -eq 'install'){if(@((Registry-Snapshot)|Where-Object {$_.exists}).Count){throw 'An exact AppId registration appeared since preflight; abort before Setup.'}}else{$null=Assert-OwnedRegistration}
    if((Hash-File $script:state.setup) -ne $script:state.setupSha256){throw 'Setup does not match the explicitly approved hash.'}
    $suffix=if($EvidenceAttempt){'-'+$EvidenceAttempt}else{''}
    $log=Join-Path $proofPath ($Label+$suffix+'.log')
    if(Test-Path -LiteralPath $log){throw 'Retain the previous installer log; supply a new EvidenceAttempt for a separately reviewed retry.'}
    $arguments='/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /NOCLOSEAPPLICATIONS /STUDIOUPDATE=1 /NOICONS /TASKS="" /DIR="'+$installPath+'" /LOG="'+$log+'"'
    $process=Start-Process -FilePath $script:state.setup -ArgumentList $arguments -WindowStyle Hidden -PassThru -Wait
    if($process.ExitCode -ne 0){throw "Installer phase failed with exit code $($process.ExitCode)."}
    Assert-Protected
}
function Stop-OwnedProcess {
    if(-not $script:state.qaProcess){return}
    $saved=$script:state.qaProcess
    if($script:state.qaProcessStopped){
        if(Get-Process -Id ([int]$saved.pid) -ErrorAction SilentlyContinue){throw 'A recorded stopped PID is present again; no process action is authorized.'}
        $remaining=@(Get-CimInstance Win32_Process -Filter "Name='Figure Studio.exe'"|Where-Object {$_.ExecutablePath -and [IO.Path]::GetFullPath($_.ExecutablePath) -eq $exePath})
        if($remaining.Count){throw 'Another process is using the owned install; no process action is authorized.'}
        return
    }
    $current=Process-Identity ([int]$saved.pid)
    foreach($key in @('pid','created','path','sha256')){if($current[$key] -ne $saved[$key]){throw 'QA PID was reused or its identity changed; do not terminate it.'}}
    if($current.path -ne $exePath -or $current.commandLine -notlike ('*'+$dataPath+'*')){throw 'Process does not match the exact owned executable and data command line.'}
    Stop-Process -Id ([int]$saved.pid) -ErrorAction Stop
    Wait-Process -Id ([int]$saved.pid) -Timeout 15 -ErrorAction SilentlyContinue
    if(Get-Process -Id ([int]$saved.pid) -ErrorAction SilentlyContinue){throw 'The owned QA process did not exit.'}
    $script:state.qaProcessStopped=$true
    Save-State
}
function Preservation-Snapshot {
    $files=@((Join-Path $dataPath 'external-sentinel.bin'),(Join-Path $dataPath 'settings.json'))
    $projects=Join-Path $dataPath 'public-projects'
    if(Test-Path -LiteralPath $projects){$files+=@(Get-ChildItem -LiteralPath $projects -File|ForEach-Object {$_.FullName})}
    return ,@($files|ForEach-Object {if(-not (Test-Path -LiteralPath $_ -PathType Leaf)){throw 'Required external preservation file is missing.'};@{file=$_.Substring($dataPath.Length).TrimStart('\');sha256=(Hash-File $_)}})
}
function Assert-Preserved {
    foreach($item in $script:state.preservation){$file=[IO.Path]::GetFullPath((Join-Path $dataPath $item.file));if(-not $file.StartsWith($dataPath+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Preservation entry escaped QA data.'};if(-not (Test-Path -LiteralPath $file) -or (Hash-File $file) -ne $item.sha256){throw 'Reinstall or uninstall changed a preserved external file.'}}
}
if($Phase -eq 'Install'){
    if(Test-Path -LiteralPath $statePath){throw 'Refuse to overwrite an existing installation acceptance state.'}
    if(-not $PackageRoot -or $ExpectedSetupSha256 -notmatch '^[a-fA-F0-9]{64}$'){throw 'Explicit PackageRoot and ExpectedSetupSha256 are required for actual installation.'}
    if($Port -lt 1024 -or $Port -gt 65534){throw 'Choose two explicit unprivileged QA ports.'}
    if(Test-Path -LiteralPath $installPath){throw 'The new owned install directory already exists.'}
    foreach($directory in @($QaRoot,$dataPath,$localPath,$proofPath,$emptyPath)){New-Item -ItemType Directory -Path $directory -Force|Out-Null}
    $PackageRoot=[IO.Path]::GetFullPath($PackageRoot)
    $setup=Join-Path $PackageRoot "polish-sci-figures-Studio-$Version-Setup-x64.exe"
    $packagedApp=[IO.Path]::GetFullPath((Join-Path $PackageRoot 'Figure Studio'))
    if((Hash-File $setup) -ne $ExpectedSetupSha256.ToLowerInvariant()){throw 'Final Setup hash does not match the authorized candidate.'}
    $preflight=Registry-Snapshot
    $script:state=@{schema='figure-studio-live-preview-windows/1';version=$Version;startedAt=[DateTime]::UtcNow.ToString('o');setup=$setup;setupSha256=$ExpectedSetupSha256.ToLowerInvariant();packagedApp=$packagedApp;port=$Port;initialRegistry=$preflight;protectedProcesses=(Snapshot-Protected);checks=@();phases=@()}
    Save-State
    if(@($preflight|Where-Object {$_.exists}).Count){throw 'Real AppId is registered in one of four views; no same-account installation is authorized.'}
    foreach($checkPort in @($Port,($Port+1))){if(Get-NetTCPConnection -LocalPort $checkPort -State Listen -ErrorAction SilentlyContinue){throw 'Explicit QA port is already occupied.'}}
    [IO.File]::WriteAllBytes((Join-Path $dataPath 'external-sentinel.bin'),[Text.Encoding]::UTF8.GetBytes('PUBLIC QA external-data preservation sentinel v1'))
    Invoke-Installer 'install'
    $script:state.installedRegistry=Assert-OwnedRegistration
    $script:state.uninstallerSha256=Hash-File (Join-Path $installPath 'unins000.exe')
    $script:state.packageVerification=Assert-Package
    $bytes=[IO.File]::ReadAllBytes($exePath);$pe=[BitConverter]::ToInt32($bytes,0x3c)
    if([BitConverter]::ToUInt16($bytes,$pe+4) -ne 0x8664){throw 'Installed EXE is not x64.'}
    if((Get-Item -LiteralPath $exePath).VersionInfo.ProductVersion -ne $Version){throw 'Installed PE product version differs from the requested candidate.'}
    $selfData=Join-Path $QaRoot 'selftest-data';$selfOutput=Join-Path $proofPath 'selftest'
    New-Item -ItemType Directory -Path $selfData,$selfOutput -Force|Out-Null
    [IO.File]::WriteAllText((Join-Path $selfData 'settings.json'),('{"app":"figure-studio-desktop-v1","port":'+($Port+1)+'}'))
    $savedEnvironment=@{PATH=$env:PATH;PYTHONHOME=$env:PYTHONHOME;PYTHONPATH=$env:PYTHONPATH;PYTHONNOUSERSITE=$env:PYTHONNOUSERSITE;LOCALAPPDATA=$env:LOCALAPPDATA}
    try{
        $env:PATH="$env:SystemRoot\System32;$env:SystemRoot";$env:PYTHONHOME='Z:\intentionally-unavailable-python';$env:PYTHONPATH='';$env:PYTHONNOUSERSITE='1';$env:LOCALAPPDATA=$localPath
        $process=Start-Process -FilePath $exePath -ArgumentList ('--self-test --data-dir "'+$selfData+'" --output-dir "'+$selfOutput+'"') -WorkingDirectory $emptyPath -WindowStyle Hidden -PassThru -Wait
        if($process.ExitCode -ne 0){throw 'The actually installed frozen self-test failed.'}
    }finally{foreach($name in $savedEnvironment.Keys){[Environment]::SetEnvironmentVariable($name,$savedEnvironment[$name],'Process')}}
    $selfReport=Get-Content -LiteralPath (Join-Path $selfOutput 'self-test.json') -Raw -Encoding UTF8|ConvertFrom-Json
    if(-not $selfReport.passed -or -not $selfReport.frozen){throw 'The self-test did not prove a frozen installed runtime.'}
    [IO.File]::WriteAllText((Join-Path $dataPath 'settings.json'),('{"app":"figure-studio-desktop-v1","port":'+$Port+'}'))
    $script:state.selfTestPassed=$true;$script:state.frozen=$true;$script:state.selfTestReportSha256=Hash-File (Join-Path $selfOutput 'self-test.json')
    $script:state.checks+=@('Four exact AppId hive/view combinations initially absent','Protected application process identities and binaries unchanged','All packaged files match actual installed files','Actually installed x64 PE version matches','Frozen installed self-test passes with Python removed from PATH and invalid PYTHONHOME')
}else{
    if(-not (Test-Path -LiteralPath $statePath)){throw 'No owned installation state exists.'}
    # PowerShell 7.5+ otherwise coerces ISO creation-time strings to DateTime,
    # which fails an exact identity comparison despite the same UTC instant.
    # Preserve the original strings; never relax the protected PID/path/hash checks.
    $script:state=Get-Content -LiteralPath $statePath -Raw -Encoding UTF8|ConvertFrom-Json -AsHashtable -DateKind String
    if($script:state.version -ne $Version){throw 'This phase version differs from the owned acceptance state.'}
    Assert-Protected
    $null=Assert-OwnedRegistration
    if($Phase -eq 'Start'){
        if($script:state.qaProcess -and -not $script:state.qaProcessStopped){throw 'An owned QA process is already recorded; do not start another instance.'}
        $savedLocal=$env:LOCALAPPDATA
        try{$env:LOCALAPPDATA=$localPath;$process=Start-Process -FilePath $exePath -ArgumentList ('--no-open --data-dir "'+$dataPath+'"') -WorkingDirectory $emptyPath -WindowStyle Hidden -PassThru}finally{[Environment]::SetEnvironmentVariable('LOCALAPPDATA',$savedLocal,'Process')}
        $script:state.qaProcess=Process-Identity $process.Id;$script:state.qaProcessStopped=$false;Save-State
        $deadline=[DateTime]::UtcNow.AddSeconds(60);$instancePath=Join-Path $dataPath 'instance.json';$ready=$false
        while([DateTime]::UtcNow -lt $deadline){
            if($process.HasExited){throw 'Owned installed application exited before local service readiness.'}
            if(Test-Path -LiteralPath $instancePath){try{$instance=Get-Content -LiteralPath $instancePath -Raw -Encoding UTF8|ConvertFrom-Json;if($instance.port -eq $script:state.port -and $instance.pid -eq $process.Id){$health=Invoke-RestMethod -Uri ('http://127.0.0.1:'+$instance.port+'/api/desktop/health') -Headers @{'X-Studio-Instance'=$instance.instance_id} -TimeoutSec 2;if($health.pid -eq $process.Id -and $health.instance_id -eq $instance.instance_id){$ready=$true;break}}}catch{}}
            Start-Sleep -Milliseconds 250
        }
        if(-not $ready){throw 'Installed local service readiness timed out.'}
        $servedFile=Join-Path $proofPath 'private-installed-served.html'
        Invoke-WebRequest -Uri ('http://127.0.0.1:'+$script:state.port+'/') -TimeoutSec 20 -OutFile $servedFile|Out-Null
        $servedText=Get-Content -LiteralPath $servedFile -Raw -Encoding UTF8
        $configMatch=[regex]::Match($servedText,'<script id="local-engine" type="application/json">(.*?)</script>',[Text.RegularExpressions.RegexOptions]::Singleline)
        if(-not $configMatch.Success){throw 'Installed runtime did not inject its actual local engine configuration.'}
        $config=$configMatch.Groups[1].Value|ConvertFrom-Json
        if($config.updateInfo.currentVersion -ne $Version){throw 'Actual installed service version does not match the Setup/PE candidate.'}
        $script:state.serviceReady=$true;$script:state.servedHtmlSha256=Hash-File $servedFile;$script:state.workspaceHtmlSha256=Hash-File (Join-Path $dataPath 'workspace/index.html')
        $script:state.checks+='Exact installed process serves authenticated local health on isolated persisted QA port'
    }elseif($Phase -eq 'Reinstall'){
        if(-not $BrowserAcceptanceComplete){throw 'Browser evidence must be complete before stopping or reinstalling the QA runtime.'}
        if(-not $ProjectPayload -or -not (Test-Path -LiteralPath $ProjectPayload -PathType Leaf)){throw 'An actual public Save download payload is required for preservation checks.'}
        $projectDirectory=Join-Path $dataPath 'public-projects';New-Item -ItemType Directory -Path $projectDirectory -Force|Out-Null
        Copy-Item -LiteralPath $ProjectPayload -Destination (Join-Path $projectDirectory 'actual-saved-public-project.json')
        $script:state.preservation=Preservation-Snapshot
        Stop-OwnedProcess
        Invoke-Installer 'reinstall'
        $null=Assert-OwnedRegistration;$script:state.reinstallPackageVerification=Assert-Package;$script:state.uninstallerSha256=Hash-File (Join-Path $installPath 'unins000.exe')
        Assert-Preserved;Assert-Protected;$script:state.reinstallPreserved=$true
        $script:state.checks+='Same-version original Setup reinstall preserves exact settings, external sentinel and actual saved public project bytes'
    }elseif($Phase -eq 'Uninstall'){
        if((-not $BrowserAcceptanceComplete -or -not $script:state.reinstallPreserved) -and -not $CleanupIncompleteAttempt){throw 'Browser completion and successful preservation reinstall are required before successful cleanup; failed-attempt cleanup must be explicit.'}
        if($script:state.qaProcess -and -not $script:state.qaProcessStopped){Stop-OwnedProcess}
        $null=Assert-OwnedRegistration;Assert-Protected
        $uninstaller=[IO.Path]::GetFullPath((Join-Path $installPath 'unins000.exe'))
        if(-not $uninstaller.StartsWith($installPath+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Uninstaller escaped the exact owned install directory.'}
        if($script:state.uninstallerSha256 -and (Hash-File $uninstaller) -ne $script:state.uninstallerSha256){throw 'The exact owned uninstaller bytes changed.'}
        $process=Start-Process -FilePath $uninstaller -ArgumentList '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART' -WorkingDirectory $emptyPath -WindowStyle Hidden -PassThru -Wait
        if($process.ExitCode -ne 0 -or (Test-Path -LiteralPath $exePath)){throw 'Actual uninstaller did not remove the owned application.'}
        $after=Registry-Snapshot;if(@($after|Where-Object {$_.exists}).Count){throw 'Four-view registry state was not restored to original absence.'}
        if($script:state.preservation){Assert-Preserved}else{if(-not (Test-Path -LiteralPath (Join-Path $dataPath 'external-sentinel.bin'))){throw 'Incomplete cleanup lost its external sentinel.'}}
        Assert-Protected;$script:state.finalRegistry=$after;$script:state.uninstalled=$true;$script:state.externalDataPreserved=$true;$script:state.protectedUnchanged=$true;$script:state.cleanedIncompleteAttempt=[bool]$CleanupIncompleteAttempt
        $script:state.checks+='Actual uninstaller restores all four AppId combinations to absence and preserves external data/protected processes'
    }
}
Assert-Protected
$script:state.phases+=@{phase=$Phase;completedAt=[DateTime]::UtcNow.ToString('o')}
Save-State
$safe=@{schema=$script:state.schema;version=$Version;setupSha256=$script:state.setupSha256;phase=$Phase;evidenceAttempt=$EvidenceAttempt;completedPhases=@($script:state.phases|ForEach-Object {$_.phase});harnessSha256=(Hash-File $PSCommandPath);powerShellVersion=$PSVersionTable.PSVersion.ToString();initialRegistryViewsAbsent=@($script:state.initialRegistry|Where-Object {-not $_.exists}).Count;protectedProcessCount=@($script:state.protectedProcesses).Count;protectedProcessIdentitiesUnchanged=$true;packageVerification=$script:state.packageVerification;reinstallPackageVerification=$script:state.reinstallPackageVerification;selfTestPassed=$script:state.selfTestPassed;frozen=$script:state.frozen;selfTestReportSha256=$script:state.selfTestReportSha256;servedHtmlSha256=$script:state.servedHtmlSha256;workspaceHtmlSha256=$script:state.workspaceHtmlSha256;checks=$script:state.checks;reinstallPreserved=[bool]$script:state.reinstallPreserved;uninstalled=[bool]$script:state.uninstalled;incompleteAttemptCleanup=[bool]$script:state.cleanedIncompleteAttempt;externalDataPreserved=[bool]$script:state.externalDataPreserved;environment='Actual local Windows x64; exact original Setup/AppId, isolated install/data/LOCALAPPDATA, no Python on self-test PATH. Not a clean VM and not an official version update/release.'}
$safe|ConvertTo-Json -Depth 12|Set-Content -LiteralPath (Join-Path $proofPath ('safe-'+$Phase.ToLowerInvariant()+'.json')) -Encoding UTF8
$safe|ConvertTo-Json -Depth 12
