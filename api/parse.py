"""Vercel serverless handler for PPTX parsing."""

from __future__ import annotations

import base64
import json
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from python.parser.pptx_parser import parse_pptx


class handler(BaseHTTPRequestHandler):  # noqa: N801
    def do_POST(self) -> None:
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length)
            payload = json.loads(body.decode("utf-8"))

            file_b64 = payload.get("file_base64")
            filename = payload.get("filename", "presentation.pptx")
            render_images = payload.get("render_images", False)

            if not file_b64:
                self._respond(400, {"error": "file_base64 is required"})
                return

            file_bytes = base64.b64decode(file_b64)
            if len(file_bytes) > 50 * 1024 * 1024:
                self._respond(413, {"error": "File exceeds 50MB limit"})
                return

            metadata = parse_pptx(file_bytes, filename)
            result = json.loads(metadata.model_dump_json())

            if render_images:
                try:
                    from python.services.slide_renderer import render_slide_images

                    result["slide_images"] = render_slide_images(file_bytes, filename)
                except Exception:
                    result["slide_images"] = []

            self._respond(200, result)
        except json.JSONDecodeError:
            self._respond(400, {"error": "Invalid JSON body"})
        except Exception as exc:
            self._respond(500, {"error": f"Parse failed: {exc}"})

    def do_GET(self) -> None:
        self._respond(200, {"status": "ok", "service": "acme-pptx-parser"})

    def _respond(self, status: int, data: dict) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))
