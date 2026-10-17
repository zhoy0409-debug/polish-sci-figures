"""Compose original editable character sources. No network or runtime dependency."""
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "skills/polish-sci-figures/assets/figure-studio"
SVG = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG)


def character(name, class_name, transform):
    source = ET.parse(ASSETS / name).getroot()
    group = ET.Element(f"{{{SVG}}}g", {"class": class_name, "transform": transform})
    for child in source:
        if child.tag.rsplit("}", 1)[-1] not in {"title", "desc", "style"}:
            group.append(child)
    return ET.tostring(group, encoding="unicode")


def main():
    cat = character("mascot-maine-coon.svg", "mascot-cat", "translate(86 20)")
    dog = character("mascot-border-collie.svg", "mascot-dog", "translate(270 20)")
    scene = f'''<svg xmlns="{SVG}" viewBox="0 0 500 210" fill="none" class="update-mascot-art" aria-hidden="true" focusable="false">
  <!-- Generated from the two original, layered mascot sources by scripts/build_update_mascot_scene.py. -->
  <defs><linearGradient id="fs-update-parcel-paper" x1="0" y1="0" x2="50" y2="47" gradientUnits="userSpaceOnUse"><stop stop-color="#E4D7BC"/><stop offset="1" stop-color="#C8B592"/></linearGradient></defs>
  <path d="M32 182H468" stroke="#C6CBC7" stroke-width="1"/>
  <path d="M63 189H437" stroke="#D5D8D1" stroke-width=".6"/>
  <ellipse cx="166" cy="179" rx="61" ry="7" fill="#3E4944" opacity=".1"/>
  <ellipse cx="350" cy="179" rx="61" ry="7" fill="#3E4944" opacity=".1"/>
  <g class="mascot-door"><path d="M436 174V73Q436 68 441 68H472V174" stroke="#ACB7AE" stroke-width="1.3"/><path d="M442 174V77H466V174" fill="#E2E7DE"/><circle cx="461" cy="127" r="2" fill="#97A79D"/></g>
  <g class="mascot-version-mark"><rect x="32" y="52" width="48" height="41" rx="7" fill="#E1E8DF" stroke="#B9C7BD"/><path d="M46 69Q53 59 64 67M64 63V68H59M64 78Q55 86 46 78M46 82V77H51" stroke="#6B897C" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g>
  <g class="mascot-work-team">
    {cat}
    {dog}
    <g class="mascot-parcel" transform="translate(229 133)"><ellipse cx="24" cy="47" rx="33" ry="4" fill="#6F6A58" opacity=".13"/><path d="M0 8L12 0H43L50 8V43Q50 47 46 47H4Q0 47 0 43Z" fill="url(#fs-update-parcel-paper)" stroke="#AB9877" stroke-width="1.2" stroke-linejoin="round"/><path d="M0 9H50M24 9V47M19 0L24 9L30 0" stroke="#8EAB95" stroke-width="5"/><path d="M8 25H16M8 30H19" stroke="#F5EDDD" stroke-width="1.6" stroke-linecap="round"/><path d="M37 31V22M33 26L37 22L41 26" stroke="#6B806D" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></g>
    <g class="mascot-inspect" transform="translate(220 119)"><path d="M0 22L12 9" stroke="#6B746E" stroke-width="4" stroke-linecap="round"/><circle cx="19" cy="2" r="13" fill="#F6FAF4" fill-opacity=".6" stroke="#7C8E80" stroke-width="3"/><path d="M13-4Q19-8 25-3" stroke="#FFFDF5" stroke-width="2" stroke-linecap="round"/></g>
    <g class="mascot-verified" transform="translate(248 99)"><circle r="13" fill="#E2F2E5" stroke="#81AA8E" stroke-width="1.1"/><path d="M-6 0L-1 5L7-5" stroke="#387B61" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>
  </g>
</svg>'''
    (ASSETS / "mascot-scene.svg").write_text(scene, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
