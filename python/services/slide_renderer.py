"""Render PPTX slides to PNG images for faithful slide preview."""

from __future__ import annotations

import base64
import logging
import shutil
import subprocess
import sys
import tempfile
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


def render_slide_images(file_bytes: bytes, filename: str) -> list[str]:
    """
    Convert PPTX to base64-encoded PNG images (one per slide).
    Returns empty list if no rendering backend is available.
    """
    suffix = Path(filename).suffix or ".pptx"
    with tempfile.TemporaryDirectory(prefix="acme-render-") as tmp:
        pptx_path = Path(tmp) / f"deck{suffix}"
        pptx_path.write_bytes(file_bytes)

        # Windows PowerPoint — highest fidelity on Windows
        png_bytes = _render_via_powerpoint_com(pptx_path)
        if png_bytes:
            return [base64.b64encode(img).decode("ascii") for img in png_bytes]

        # LibreOffice + PyMuPDF — cross-platform
        png_bytes = _render_via_libreoffice(pptx_path)
        return [base64.b64encode(img).decode("ascii") for img in png_bytes]


def get_renderer_status() -> dict[str, bool]:
    return {
        "libreoffice": _find_libreoffice() is not None,
        "powerpoint_com": sys.platform == "win32",
        "pymupdf": _has_pymupdf(),
    }


def _has_pymupdf() -> bool:
    try:
        import fitz  # noqa: F401

        return True
    except ImportError:
        return False
