# Build with desktop/build_windows.py; application sources retain their paths
# under suite/, because renderers resolve their sibling assets from __file__.
from pathlib import Path

root = Path(SPECPATH).parent
stage = root / '.cache' / 'desktop-build' / 'suite'
hidden = [
    'numpy', 'pandas', 'openpyxl', 'PIL.Image', 'PIL.ImageTk', 'pypdfium2', 'pypdf', 'cv2',
    'matplotlib.pyplot', 'matplotlib.backends.backend_agg',
    'matplotlib.backends.backend_svg', 'matplotlib.backends.backend_pdf',
    'mpl_toolkits.axes_grid1', 'mpl_toolkits.mplot3d',
    'scipy.stats', 'scipy.optimize', 'scipy.cluster.hierarchy',
    'scipy.spatial.distance', 'scipy.special', 'scipy.integrate',
    'scipy.interpolate', 'scipy.linalg', 'scipy.ndimage',
    'tkinter', 'tkinter.messagebox', 'tkinter.ttk',
]
a = Analysis(
    [str(root / 'desktop' / 'figure_studio_app.py')], pathex=[],
    binaries=[], datas=[(str(stage), 'suite')], hiddenimports=hidden,
    hookspath=[], hooksconfig={'matplotlib': {'backends': ['Agg']}},
    runtime_hooks=[], excludes=[
        'IPython', 'notebook', 'jupyter', 'pytest', 'sympy', 'torch',
        'tensorflow', 'PyQt5', 'PyQt6', 'PySide2', 'PySide6',
        'pandas.tests', 'matplotlib.tests', 'numpy.tests', 'scipy.tests',
        'studio_server', 'figure_studio',
    ], noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, [], exclude_binaries=True, name='Figure Studio',
    debug=False, bootloader_ignore_signals=False, strip=False, upx=False,
    console=False, disable_windowed_traceback=False,
    icon=str(root / 'desktop' / 'resources' / 'figure-studio.ico'),
    version=str(root / 'desktop' / 'resources' / 'version-info.txt'),
)
coll = COLLECT(exe, a.binaries, a.datas, strip=False, upx=False, name='Figure Studio')
