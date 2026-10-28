#ifndef AppVersion
  #define AppVersion "0.2.0"
#endif
#ifndef BuildRoot
  #error BuildRoot must point to the PyInstaller output directory
#endif
#ifndef OutputRoot
  #error OutputRoot must point to the release directory
#endif

[Setup]
AppId={{51D78749-35EE-43BB-BA21-F79D6A1D5094}
AppName=polish-sci-figures Figure Studio
AppVersion={#AppVersion}
AppPublisher=Wenting Zhou
AppPublisherURL=https://github.com/zhoy0409-debug/polish-sci-figures
AppSupportURL=https://github.com/zhoy0409-debug/polish-sci-figures/issues
DefaultDirName={localappdata}\Programs\Figure Studio
DefaultGroupName=polish-sci-figures
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
WizardStyle=modern
DisableWelcomePage=yes
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
ShowLanguageDialog=no
LanguageDetectionMethod=uilanguage
OutputDir={#OutputRoot}
OutputBaseFilename=polish-sci-figures-Studio-{#AppVersion}-Setup-x64
SetupIconFile=resources\figure-studio.ico
UninstallDisplayIcon={app}\Figure Studio.exe
Compression=lzma2/normal
SolidCompression=yes
CloseApplications=yes
RestartApplications=no
SetupLogging=yes
UninstallDisplayName=polish-sci-figures Figure Studio
VersionInfoVersion={#AppVersion}.0
VersionInfoCopyright=Copyright (c) 2026 Wenting Zhou

[Languages]
Name: "chinesesimp"; MessagesFile: "compiler:Languages\ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; Flags: checkedonce

[Files]
Source: "{#BuildRoot}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\polish-sci-figures Studio"; Filename: "{app}\Figure Studio.exe"; WorkingDir: "{app}"
Name: "{autodesktop}\polish-sci-figures Studio"; Filename: "{app}\Figure Studio.exe"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "{app}\Figure Studio.exe"; Description: "{cm:LaunchProgram,Figure Studio}"; Flags: nowait postinstall skipifsilent; Check: NotStudioUpdate

[Code]
function NotStudioUpdate: Boolean;
begin
  { The verified update helper restarts the application after Setup exits. }
  Result := ExpandConstant('{param:STUDIOUPDATE|0}') <> '1';
end;

// User projects, local history and settings live outside the program folder.
// Deliberately no UninstallDelete entry for the user's Figure Studio data.
