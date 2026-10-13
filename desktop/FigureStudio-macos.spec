# Manual CI preview only. Native architecture, ad-hoc signing, no notarization.
import os
from pathlib import Path

root = Path(SPECPATH).parent
stage = Path(os.environ['FIGURE_STUDIO_MAC_STAGE']).resolve()
arch = os.environ['FIGURE_STUDIO_MAC_ARCH']
version = os.environ['FIGURE_STUDIO_MAC_VERSION']
if arch not in ('arm64', 'x86_64') or root / '.cache' not in stage.parents:
    raise ValueError('Use desktop/build_macos.py with an isolated native build stage.')
hidden = [
    'numpy', 'pandas', 'openpyxl', 'PIL.Image', 'PIL.ImageTk', 'pypdfium2', 'pypdf', 'cv2',
    'matplotlib.pyplot', 'matplotlib.backends.backend_agg',
    'matplotlib.backends.backend_svg', 'matplotlib.backends.backend_pdf',
    'mpl_toolkits.axes_grid1', 'mpl_toolkits.mplot3d',
    'scipy.stats', 'scipy.optimize', 'scipy.cluster.hierarchy', 'scipy.spatial.distance',
    'scipy.special', 'scipy.integrate', 'scipy.interpolate', 'scipy.linalg', 'scipy.ndimage',
    'tkinter', 'tkinter.messagebox', 'tkinter.ttk', 'tkinter.font',
]
a = Analysis(
    [str(root / 'desktop/figure_studio_app.py')], pathex=[], binaries=[],
    datas=[(str(stage), 'suite')], hiddenimports=hidden,
    hookspath=[], hooksconfig={'matplotlib': {'backends': ['Agg']}}, runtime_hooks=[],
    excludes=['IPython', 'notebook', 'jupyter', 'pytest', 'sympy', 'torch',
              'tensorflow', 'PyQt5', 'PyQt6', 'PySide2', 'PySide6',
              'pandas.tests', 'matplotlib.tests', 'numpy.tests', 'scipy.tests',
              'studio_server', 'figure_studio'], noarchive=False)
pyz = PYZ(a.pure)
exe = EXE(pyz, a.scripts, [], exclude_binaries=True, name='Figure Studio',
          debug=False, bootloader_ignore_signals=False, strip=False, upx=False,
          console=False, target_arch=arch, codesign_identity=None, entitlements_file=None)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name='Figure Studio')
app = BUNDLE(coll, name='Figure Studio.app',
             icon=str(stage / 'desktop/resources/figure-studio.icns'),
             bundle_identifier='io.github.zhoy0409-debug.figure-studio.preview',
             info_plist={'CFBundleShortVersionString': version, 'CFBundleVersion': version,
                         'LSMinimumSystemVersion': '15.0', 'NSHighResolutionCapable': True,
                         'NSHumanReadableCopyright': 'Copyright © 2026 Wenting Zhou'})
