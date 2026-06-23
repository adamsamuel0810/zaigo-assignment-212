"""Render PPTX slides to PNG images for faithful slide preview."""

from __future__ import annotations

import base64
import json
import logging
import os
import shutil
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

logger = logging.getLogger(__name__)

PP_SAVE_AS_PDF = 32


def _find_libreoffice() -> str | None:
    candidates = [
        shutil.which("soffice"),
        shutil.which("libreoffice"),
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ]
    for path in candidates:
        if path and Path(path).exists():
            return path
    return None


def _render_via_powerpoint_com(pptx_path: Path) -> list[bytes]:
    """Export each slide as PNG via Microsoft PowerPoint (Windows)."""
    if sys.platform != "win32":
        return []
    try:
        import pythoncom  # type: ignore[import-untyped]
        import win32com.client  # type: ignore[import-untyped]
    except ImportError:
        return []

    pythoncom.CoInitialize()
    app = None
    presentation = None
    images: list[bytes] = []

    try:
        app = win32com.client.Dispatch("PowerPoint.Application")
        presentation = app.Presentations.Open(
            str(pptx_path.resolve()),
            WithWindow=False,
            ReadOnly=True,
        )

        with tempfile.TemporaryDirectory(prefix="acme-ppt-export-") as tmp:
            tmp_path = Path(tmp)
            slide_count = presentation.Slides.Count
            for i in range(1, slide_count + 1):
                png_path = tmp_path / f"slide_{i}.png"
                presentation.Slides(i).Export(str(png_path), "PNG")
                if png_path.exists():
                    images.append(png_path.read_bytes())

        return images
    except Exception as exc:
        logger.warning("PowerPoint COM export failed: %s", exc)
        return []
    finally:
        if presentation is not None:
            try:
                presentation.Close()
            except Exception:
                pass
        if app is not None:
            try:
                app.Quit()
            except Exception:
                pass
        try:
            pythoncom.CoUninitialize()
        except Exception:
            pass


def _pptx_to_pdf_libreoffice(pptx_path: Path, pdf_path: Path) -> bool:
    soffice = _find_libreoffice()
    if not soffice:
        return False

    out_dir = pdf_path.parent
    try:
        result = subprocess.run(
            [
                soffice,
                "--headless",
                "--norestore",
                "--convert-to",
                "pdf",
                "--outdir",
                str(out_dir),
                str(pptx_path),
            ],
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        if result.returncode != 0:
            logger.warning("LibreOffice conversion failed: %s", result.stderr)
            return False

        generated = out_dir / f"{pptx_path.stem}.pdf"
        if not generated.exists():
            return False

        if generated != pdf_path:
            generated.replace(pdf_path)
        return pdf_path.exists()
    except (OSError, subprocess.TimeoutExpired) as exc:
        logger.warning("LibreOffice error: %s", exc)
        return False


def _pdf_to_png_bytes(pdf_path: Path, dpi: int = 150) -> list[bytes]:
    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.warning("PyMuPDF not installed — cannot render slide images")
        return []

    images: list[bytes] = []
    doc = fitz.open(pdf_path)
    try:
        zoom = dpi / 72.0
        matrix = fitz.Matrix(zoom, zoom)
        for page in doc:
            pix = page.get_pixmap(matrix=matrix, alpha=False)
            images.append(pix.tobytes("png"))
    finally:
        doc.close()
    return images


def _render_via_libreoffice(pptx_path: Path) -> list[bytes]:
    with tempfile.TemporaryDirectory(prefix="acme-lo-") as tmp:
        tmp_path = Path(tmp)
        pdf_path = tmp_path / "deck.pdf"
        if not _pptx_to_pdf_libreoffice(pptx_path, pdf_path):
            return []
        return _pdf_to_png_bytes(pdf_path)


def _render_via_convertapi(file_bytes: bytes, filename: str) -> list[str]:
    """
    Render via the ConvertAPI cloud service (pptx -> png). Works in serverless
    environments (Vercel) where PowerPoint/LibreOffice are unavailable.

    Requires CONVERTAPI_SECRET. Uses a single synchronous JSON request with the
    deck inlined as base64. Files are stored by ConvertAPI (StoreFile=True) and
    returned as URLs so the parse response stays small (Vercel caps response
    bodies at ~4.5MB, which inline base64 PNGs would exceed for large decks).
    """
    secret = os.environ.get("CONVERTAPI_SECRET") or os.environ.get("CONVERTAPI_TOKEN")
    if not secret:
        return []

    url = "https://v2.convertapi.com/convert/pptx/to/png?Secret=" + urllib.parse.quote(
        secret
    )
    payload = {
        "Parameters": [
            {
                "Name": "File",
                "FileValue": {
                    "Name": filename or "deck.pptx",
                    "Data": base64.b64encode(file_bytes).decode("ascii"),
                },
            },
            {"Name": "StoreFile", "Value": True},
            {"Name": "ImageResolution", "Value": 150},
        ]
    }

    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "ignore")[:200]
        logger.warning("ConvertAPI HTTP %s: %s", exc.code, detail)
        return []
    except (urllib.error.URLError, OSError, json.JSONDecodeError) as exc:
        logger.warning("ConvertAPI request failed: %s", exc)
        return []

    images: list[str] = []
    for entry in body.get("Files", []):
        # Prefer hosted URL (StoreFile=True); fall back to inline base64.
        ref = entry.get("Url") or entry.get("FileData")
        if ref:
            images.append(ref)
    return images


def render_slide_images(file_bytes: bytes, filename: str) -> list[str]:
    """
    Convert PPTX to base64-encoded PNG images (one per slide).
    Returns empty list if no rendering backend is available.
    """
    suffix = Path(filename).suffix or ".pptx"
    with tempfile.TemporaryDirectory(prefix="acme-render-") as tmp:
        pptx_path = Path(tmp) / f"deck{suffix}"
        pptx_path.write_bytes(file_bytes)

        # Windows PowerPoint — highest fidelity, free, offline (local dev)
        png_bytes = _render_via_powerpoint_com(pptx_path)
        if png_bytes:
            return [base64.b64encode(img).decode("ascii") for img in png_bytes]

        # LibreOffice + PyMuPDF — cross-platform, free, offline (local/Docker)
        png_bytes = _render_via_libreoffice(pptx_path)
        if png_bytes:
            return [base64.b64encode(img).decode("ascii") for img in png_bytes]

        # ConvertAPI — cloud fallback for serverless (Vercel) where no local
        # rendering backend exists. Returns base64 PNGs directly.
        return _render_via_convertapi(file_bytes, filename)


def get_renderer_status() -> dict[str, bool]:
    return {
        "libreoffice": _find_libreoffice() is not None,
        "powerpoint_com": sys.platform == "win32",
        "pymupdf": _has_pymupdf(),
        "convertapi": bool(
            os.environ.get("CONVERTAPI_SECRET") or os.environ.get("CONVERTAPI_TOKEN")
        ),
    }


def _has_pymupdf() -> bool:
    try:
        import fitz  # noqa: F401

        return True
    except ImportError:
        return False
