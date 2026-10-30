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
WizardSizePercent=130,120
WizardKeepAspectRatio=yes
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

[LangOptions]
; Use a real CJK UI face instead of relying on a Latin font's fallback metrics.
; Keep Inno 7's standard 9pt size and base scaling; never shrink the text to fit.
chinesesimp.DialogFontName=Microsoft YaHei UI
chinesesimp.DialogFontSize=9
chinesesimp.DialogFontBaseScaleWidth=7
chinesesimp.DialogFontBaseScaleHeight=15
chinesesimp.WelcomeFontName=Microsoft YaHei UI

[Messages]
chinesesimp.SetupWindowTitle=安装 - Figure Studio
english.SetupWindowTitle=Setup - Figure Studio
chinesesimp.WizardSelectTasks=快捷方式
chinesesimp.SelectTasksDesc=选择需要创建的快捷方式。
chinesesimp.SelectTasksLabel2=桌面快捷方式为可选项，取消勾选也可继续安装。
english.WizardSelectTasks=Shortcuts
english.SelectTasksDesc=Choose the shortcuts to create.
english.SelectTasksLabel2=The desktop shortcut is optional. You can continue without it.

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
procedure InitializeWizard;
begin
  WizardForm.PageDescriptionLabel.WordWrap := True;
  WizardForm.SelectTasksLabel.WordWrap := True;
end;

procedure CurPageChanged(CurPageID: Integer);
var
  HeightChange: Integer;
begin
  if CurPageID = wpSelectTasks then begin
    { Use the actual DPI-scaled content width. AdjustHeight is idempotent:
      returning to this page does not keep pushing its checklist down. }
    WizardForm.SelectTasksLabel.AutoSize := False;
    WizardForm.SelectTasksLabel.Width := WizardForm.TasksList.Width;
    HeightChange := WizardForm.AdjustLabelHeight(WizardForm.SelectTasksLabel);
    WizardForm.IncTopDecHeight(WizardForm.TasksList, HeightChange);
  end;
end;

function NotStudioUpdate: Boolean;
begin
  { The verified update helper restarts the application after Setup exits. }
  Result := ExpandConstant('{param:STUDIOUPDATE|0}') <> '1';
end;

// User projects, local history and settings live outside the program folder.
// Deliberately no UninstallDelete entry for the user's Figure Studio data.
