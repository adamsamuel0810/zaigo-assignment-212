"""CLI: read JSON payload from stdin, write JSON result to stdout."""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from python.pptx_writer.apply_fixes_api import run_apply_fixes


def main() -> None:
    payload = json.load(sys.stdin)
    result = run_apply_fixes(payload)
    json.dump(result, sys.stdout)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        json.dump({"error": str(exc)}, sys.stdout)
        sys.exit(1)
