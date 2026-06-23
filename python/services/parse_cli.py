#!/usr/bin/env python3
"""CLI entry point for local PPTX parsing and slide rendering."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from python.parser.pptx_parser import parse_pptx
from python.services.slide_renderer import render_slide_images


def main() -> None:
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: parse_cli.py <filepath>"}))
        sys.exit(1)
    filepath = Path(sys.argv[1])
    if not filepath.exists():
        print(json.dumps({"error": f"File not found: {filepath}"}))
        sys.exit(1)

    data = filepath.read_bytes()
    metadata = parse_pptx(data, filepath.name)
    result = json.loads(metadata.model_dump_json())

    try:
        result["slide_images"] = render_slide_images(data, filepath.name)
    except Exception as exc:
        print(f"Slide render warning: {exc}", file=sys.stderr)
        result["slide_images"] = []

    sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    print(json.dumps(result))


if __name__ == "__main__":
    main()
