#!/usr/bin/env python3
"""Query and validate the 124-to-family scientific template catalog."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


CATALOG = Path(__file__).resolve().parents[1] / "assets" / "template_catalog.json"
REQUIRED = {"id", "source_template_ids", "route", "contract", "candidates", "upgrade"}


def load_catalog() -> dict:
    return json.loads(CATALOG.read_text(encoding="utf-8"))


def validate(catalog: dict) -> None:
    families = catalog.get("families", [])
    if catalog.get("source", {}).get("template_count") != 124:
        raise ValueError("Catalog must declare exactly 124 source templates.")
    ids: list[int] = []
    family_names: list[str] = []
    for family in families:
        missing = REQUIRED - set(family)
        if missing:
            raise ValueError(f"Family {family.get('id', '<unknown>')} is missing {sorted(missing)}")
        family_names.append(family["id"])
        ids.extend(family["source_template_ids"])
        if not family["candidates"] or not family["route"].strip():
            raise ValueError(f"Family {family['id']} has no executable route or candidates.")
    if len(family_names) != len(set(family_names)):
        raise ValueError("Family IDs must be unique.")
    duplicates = sorted({number for number in ids if ids.count(number) > 1})
    if duplicates:
        raise ValueError(f"Template IDs assigned more than once: {duplicates}")
    expected = set(range(1, 125))
    actual = set(ids)
    if actual != expected:
        raise ValueError(
            f"Template coverage mismatch; missing={sorted(expected - actual)}, "
            f"unexpected={sorted(actual - expected)}"
        )


def resolve(catalog: dict, template_id: int) -> dict:
    for family in catalog["families"]:
        if template_id in family["source_template_ids"]:
            return family
    raise ValueError(f"Unknown source template ID: {template_id}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("self-check", help="Validate complete, unique 1-124 coverage")
    listing = sub.add_parser("list", help="List upgraded template families")
    listing.add_argument("--json", action="store_true")
    item = sub.add_parser("resolve", help="Resolve a source template number to its upgraded route")
    item.add_argument("--template", type=int, required=True)
    item.add_argument("--json", action="store_true")
    args = parser.parse_args()

    catalog = load_catalog()
    validate(catalog)
    if args.command == "self-check":
        print(f"template catalog: 124 templates -> {len(catalog['families'])} validated families")
        return
    if args.command == "list":
        if args.json:
            print(json.dumps(catalog["families"], indent=2, ensure_ascii=False))
            return
        for family in catalog["families"]:
            print(
                f"{family['id']:<25} {len(family['source_template_ids']):>3}  "
                f"{family['route']}"
            )
        return

    family = resolve(catalog, args.template)
    if args.json:
        print(json.dumps(family, indent=2, ensure_ascii=False))
        return
    print(f"template: {args.template}")
    print(f"family:   {family['id']}")
    print(f"route:    {family['route']}")
    print(f"contract: {family['contract']}")
    print(f"upgrade:  {family['upgrade']}")
    print("candidates:")
    for candidate in family["candidates"]:
        print(f"- {candidate}")


if __name__ == "__main__":
    main()
