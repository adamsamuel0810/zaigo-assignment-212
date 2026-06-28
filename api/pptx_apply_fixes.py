"""Vercel Python serverless handler for PPTX auto-fix apply."""

from __future__ import annotations

import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from python.pptx_writer.apply_fixes_api import run_apply_fixes


class handler(BaseHTTPRequestHandler):  # noqa: N801
    def do_POST(self) -> None:
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            payload = json.loads(body.decode("utf-8"))
            self._respond(200, run_apply_fixes(payload))
        except json.JSONDecodeError:
            self._respond(400, {"error": "Invalid JSON body"})
        except ValueError as exc:
            self._respond(400, {"error": str(exc)})
        except Exception as exc:
            self._respond(500, {"error": f"Apply fixes failed: {exc}"})

    def do_GET(self) -> None:
        self._respond(200, {"status": "ok", "service": "acme-pptx-apply-fixes"})

    def _respond(self, status: int, data: dict) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))
