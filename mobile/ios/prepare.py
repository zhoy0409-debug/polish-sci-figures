#!/usr/bin/env python3
"""Verify and bundle the existing offline web build; generate an unsigned Xcode project.

No runtime download or third-party project generator is invoked by this script.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import plistlib
import shutil

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
GENERATED = HERE / '.generated'


def ident(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()[:24].upper()


def quote(value: str) -> str:
    return json.dumps(value)


def project_text() -> str:
    objects = {}

    def add(key, isa, **attrs):
        fields = ['isa = ' + isa + ';']
        for name, value in attrs.items():
            fields.append(f'{name} = {value};')
        objects[ident(key)] = '{ ' + ' '.join(fields) + ' }'
        return ident(key)

    def sequence(values):
        return '(' + ', '.join(values) + (',' if values else '') + ')'

    sources = []
    source_builds = []
    for path in sorted((HERE / 'Sources').glob('*.swift')):
        ref = add('source-' + path.name, 'PBXFileReference', lastKnownFileType='sourcecode.swift', path=quote(path.name), sourceTree=quote('<group>'))
        sources.append(ref)
        source_builds.append(add('build-' + path.name, 'PBXBuildFile', fileRef=ref))
    source_group = add('sources', 'PBXGroup', children=sequence(sources), path=quote('../Sources'), sourceTree=quote('<group>'))
    resources, resource_builds = [], []
    for name, path, kind in [('WebAssets', 'WebAssets', 'folder'), ('native-adapter.js', '../Resources/native-adapter.js', 'sourcecode.javascript'), ('simulator-smoke.js', '../Resources/simulator-smoke.js', 'sourcecode.javascript')]:
        ref = add('resource-' + name, 'PBXFileReference', lastKnownFileType=kind, path=quote(path), sourceTree=quote('<group>'))
        resources.append(ref)
        resource_builds.append(add('build-' + name, 'PBXBuildFile', fileRef=ref))
    test_ref = add('test-source', 'PBXFileReference', lastKnownFileType='sourcecode.swift', path=quote('../Tests/SimulatorTests.swift'), sourceTree=quote('<group>'))
    test_build = add('test-build', 'PBXBuildFile', fileRef=test_ref)
    app_product = add('app-product', 'PBXFileReference', explicitFileType='wrapper.application', includeInIndex='0', path='FigureStudio.app', sourceTree='BUILT_PRODUCTS_DIR')
    test_product = add('test-product', 'PBXFileReference', explicitFileType='wrapper.cfbundle', includeInIndex='0', path='FigureStudioUITests.xctest', sourceTree='BUILT_PRODUCTS_DIR')
    products = add('products', 'PBXGroup', children=sequence([app_product, test_product]), name='Products', sourceTree=quote('<group>'))
    group = add('main-group', 'PBXGroup', children=sequence([source_group, *resources, test_ref, products]), sourceTree=quote('<group>'))
    app_sources = add('app-sources', 'PBXSourcesBuildPhase', buildActionMask='2147483647', files=sequence(source_builds), runOnlyForDeploymentPostprocessing='0')
    app_resources = add('app-resources', 'PBXResourcesBuildPhase', buildActionMask='2147483647', files=sequence(resource_builds), runOnlyForDeploymentPostprocessing='0')
    test_sources = add('test-sources', 'PBXSourcesBuildPhase', buildActionMask='2147483647', files=sequence([test_build]), runOnlyForDeploymentPostprocessing='0')
    frameworks = add('app-frameworks', 'PBXFrameworksBuildPhase', buildActionMask='2147483647', files='()', runOnlyForDeploymentPostprocessing='0')
    test_frameworks = add('test-frameworks', 'PBXFrameworksBuildPhase', buildActionMask='2147483647', files='()', runOnlyForDeploymentPostprocessing='0')

    def configs(key, extra):
        values = []
        for mode in ['Debug', 'Release']:
            settings = {
                'SDKROOT': 'iphoneos', 'IPHONEOS_DEPLOYMENT_TARGET': '17.0',
                'SWIFT_VERSION': '5.0', 'TARGETED_DEVICE_FAMILY': quote('1,2'),
                'CODE_SIGNING_ALLOWED': 'NO', 'CODE_SIGNING_REQUIRED': 'NO',
                'SUPPORTED_PLATFORMS': quote('iphoneos iphonesimulator'),
                'CLANG_ENABLE_MODULES': 'YES', 'ENABLE_USER_SCRIPT_SANDBOXING': 'YES',
                'SWIFT_OPTIMIZATION_LEVEL': quote('-Onone' if mode == 'Debug' else '-O'),
                'SWIFT_ACTIVE_COMPILATION_CONDITIONS': quote('DEBUG $(inherited)' if mode == 'Debug' else '$(inherited)'),
                **extra,
            }
            body = '{ ' + ' '.join(f'{k} = {v};' for k, v in settings.items()) + ' }'
            values.append(add(key + '-' + mode, 'XCBuildConfiguration', buildSettings=body, name=mode))
        return add(key + '-list', 'XCConfigurationList', buildConfigurations=sequence(values), defaultConfigurationIsVisible='0', defaultConfigurationName='Release')

    project_configs = configs('project-config', {})
    app_configs = configs('app-config', {'PRODUCT_NAME': 'FigureStudio', 'PRODUCT_BUNDLE_IDENTIFIER': 'org.polishscifigures.studio.iospreview', 'INFOPLIST_FILE': quote('../Info.plist'), 'LD_RUNPATH_SEARCH_PATHS': quote('$(inherited) @executable_path/Frameworks')})
    test_configs = configs('test-config', {'PRODUCT_NAME': 'FigureStudioUITests', 'PRODUCT_BUNDLE_IDENTIFIER': 'org.polishscifigures.studio.iospreview.uitests', 'GENERATE_INFOPLIST_FILE': 'YES', 'TEST_TARGET_NAME': 'FigureStudio', 'LD_RUNPATH_SEARCH_PATHS': quote('$(inherited) @executable_path/Frameworks @loader_path/Frameworks')})
    app = add('app-target', 'PBXNativeTarget', buildConfigurationList=app_configs, buildPhases=sequence([app_sources, frameworks, app_resources]), buildRules='()', dependencies='()', name='FigureStudio', productName='FigureStudio', productReference=app_product, productType=quote('com.apple.product-type.application'))
    proxy = add('test-proxy', 'PBXContainerItemProxy', containerPortal=ident('project'), proxyType='1', remoteGlobalIDString=app, remoteInfo='FigureStudio')
    dependency = add('test-dependency', 'PBXTargetDependency', target=app, targetProxy=proxy)
    test = add('test-target', 'PBXNativeTarget', buildConfigurationList=test_configs, buildPhases=sequence([test_sources, test_frameworks]), buildRules='()', dependencies=sequence([dependency]), name='FigureStudioUITests', productName='FigureStudioUITests', productReference=test_product, productType=quote('com.apple.product-type.bundle.ui-testing'))
    project = add('project', 'PBXProject', attributes='{ LastUpgradeCheck = 1600; }', buildConfigurationList=project_configs, compatibilityVersion=quote('Xcode 14.0'), developmentRegion='en', hasScannedForEncodings='0', knownRegions='(en, Base)', mainGroup=group, productRefGroup=products, projectDirPath=quote(''), projectRoot=quote(''), targets=sequence([app, test]))
    entries = '\n'.join(f'\t\t{k} = {v};' for k, v in objects.items())
    return '// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n' + entries + '\n}; rootObject = ' + project + '; }\n'


def scheme() -> str:
    def ref(target, name):
        return f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{ident(target)}" BuildableName="{name}" BlueprintName="{name.split(".")[0]}" ReferencedContainer="container:FigureStudio.xcodeproj"/>'
    app, test = ref('app-target', 'FigureStudio.app'), ref('test-target', 'FigureStudioUITests.xctest')
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="1600" version="1.3">
 <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries>
  <BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{app}</BuildActionEntry>
  <BuildActionEntry buildForTesting="YES" buildForRunning="NO" buildForProfiling="NO" buildForArchiving="NO" buildForAnalyzing="YES">{test}</BuildActionEntry>
 </BuildActionEntries></BuildAction>
 <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">{test}</TestableReference></Testables></TestAction>
 <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{app}</BuildableProductRunnable></LaunchAction>
 <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{app}</BuildableProductRunnable></ProfileAction>
 <AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>'''


def prepare(web_root: Path):
    web_root = web_root.resolve()
    if not (web_root / '.local-web-preview').is_file():
        raise ValueError('Build the marked local web preview before packaging iOS')
    checksums = (web_root / 'SHA256SUMS.txt').read_text(encoding='utf-8').splitlines()
    files = []
    for line in checksums:
        expected, relative = line.split('  ', 1)
        path = (web_root / relative).resolve()
        if web_root not in path.parents or path.is_symlink() or hashlib.sha256(path.read_bytes()).hexdigest() != expected:
            raise ValueError('Web asset checksum/path mismatch: ' + relative)
        files.append((path, relative, expected))
    # Only our fixed generated directory may be replaced; never follow a redirected parent.
    if GENERATED.resolve().parent != HERE or GENERATED.is_symlink():
        raise ValueError('Unexpected generated project directory')
    if GENERATED.exists():
        shutil.rmtree(GENERATED)
    GENERATED.mkdir()
    assets = GENERATED / 'WebAssets'
    for source, relative, _ in files:
        target = assets / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    shutil.copyfile(web_root / 'SHA256SUMS.txt', assets / 'SHA256SUMS.txt')
    project = GENERATED / 'FigureStudio.xcodeproj'
    project.mkdir()
    (project / 'project.pbxproj').write_text(project_text(), encoding='utf-8', newline='\n')
    scheme_dir = project / 'xcshareddata/xcschemes'
    scheme_dir.mkdir(parents=True)
    (scheme_dir / 'FigureStudio.xcscheme').write_text(scheme(), encoding='utf-8', newline='\n')
    with (HERE / 'Info.plist').open('rb') as handle:
        plistlib.load(handle)
    report = {'schema': 'figure-studio-ios-bundle/1', 'distribution': 'unsigned development/simulator only', 'webFiles': len(files), 'webBytes': sum(path.stat().st_size for path, _, _ in files), 'files': [{'path': relative, 'sha256': digest} for _, relative, digest in files]}
    (GENERATED / 'bundle-report.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    return {'project': str(project), 'webFiles': report['webFiles'], 'webBytes': report['webBytes']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--web-root', type=Path, default=ROOT / '.cache/local-web-preview')
    args = parser.parse_args()
    print(json.dumps(prepare(args.web_root), indent=2))
