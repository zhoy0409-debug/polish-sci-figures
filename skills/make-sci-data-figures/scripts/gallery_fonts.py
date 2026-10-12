"""Installed-font fallback for editable multilingual gallery text."""
from functools import lru_cache
import matplotlib as mpl
from matplotlib import font_manager
from matplotlib.ft2font import FT2Font


@lru_cache(maxsize=1)
def cjk_fallbacks():
    """Prefer installed static regular/bold faces over incomplete VF registrations."""
    candidates=('Microsoft YaHei','Microsoft YaHei UI',
                'Noto Sans SC','Noto Sans CJK SC','Source Han Sans SC','PingFang SC',
                'SimHei','WenQuanYi Micro Hei','DengXian','SimSun')
    installed=font_manager.fontManager.ttflist
    # A variable font can be registered only as weight 100 by some FreeType
    # versions. Such a family must not displace a real 400/700 pair.
    for required_weights in [(400,700),(400,)]:
        for family in candidates:
            faces={}
            for entry in installed:
                weight=font_manager.weight_dict.get(entry.weight,entry.weight)
                if entry.name==family and entry.style=='normal' and weight in required_weights:
                    faces[weight]=entry.fname
            if not all(weight in faces for weight in required_weights):
                continue
            try:
                if all(all(ord(char) in FT2Font(path).get_charmap() for char in '实验对照组') for path in faces.values()):
                    return (family,)
            except (OSError,RuntimeError):
                continue
    return ()


def font_families(preferred=None):
    """Keep the chosen Latin family first; append an installed CJK fallback."""
    primary=preferred if preferred is not None else mpl.rcParams['font.family']
    primary=[primary] if isinstance(primary,str) else list(primary)
    if primary==['sans-serif']:
        installed={entry.name for entry in font_manager.fontManager.ttflist}
        primary=['Arial'] if 'Arial' in installed else ['DejaVu Sans']
    return list(dict.fromkeys(primary+list(cjk_fallbacks())+['DejaVu Sans']))


def apply_font_fallback(preferred=None):
    families=font_families(preferred)
    mpl.rcParams.update({'font.family':families,'svg.fonttype':'none'})
    return families


def has_cjk(text):
    return any('\u2e80'<=char<='\u9fff' or '\uf900'<=char<='\ufaff' for char in str(text))
