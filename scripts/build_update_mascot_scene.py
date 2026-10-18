"""Compose the preserved small ink cat and its matching dog. No runtime dependency."""
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "skills/polish-sci-figures/assets/figure-studio"
SVG = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG)


def character(name, class_name, transform):
    source = ET.parse(ASSETS / name).getroot()
    group = ET.Element(f"{{{SVG}}}g", {"class": class_name, "transform": transform})
    pose = ET.SubElement(group, f"{{{SVG}}}g", {"class": class_name + "-hop"})
    for child in source:
        if child.tag.rsplit("}", 1)[-1] not in {"title", "desc", "style"}:
            pose.append(child)
    return ET.tostring(group, encoding="unicode")


def main():
    cat = character("mascot-minimal-cat.svg", "mascot-cat", "translate(0 0)")
    dog = character("mascot-minimal-dog.svg", "mascot-dog", "translate(90 0)")
    scene = f'''<svg xmlns="{SVG}" viewBox="0 0 500 128" fill="none" class="update-mascot-art" color="#353538" aria-hidden="true" focusable="false">
  <!-- Generated from the two original, layered mascot sources by scripts/build_update_mascot_scene.py. -->
  <g class="mascot-track"><rect x="24" y="107" width="452" height="4" rx="2" fill="#d9d9de"/><rect class="mascot-track-fill" x="24" y="107" width="452" height="4" rx="2" fill="currentColor"/></g>
  <g class="mascot-work-team" transform="translate(173 30)">
    <g class="mascot-route">
      <g transform="scale(.85)">
        <g class="mascot-cat-shadow"><ellipse cx="48" cy="69" rx="32" ry="3" fill="currentColor" opacity=".09"/></g>
        <g class="mascot-dog-shadow"><ellipse cx="138" cy="69" rx="32" ry="3" fill="currentColor" opacity=".09"/></g>
        {cat}
        {dog}
        <g class="mascot-inspect" transform="translate(94 37)"><path d="M0 13L6 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="1" r="8" fill="#f2f2f4" stroke="currentColor" stroke-width="1.8"/></g>
      </g>
    </g>
  </g>
</svg>'''
    (ASSETS / "mascot-scene.svg").write_text(scene, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
