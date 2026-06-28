"""Shared request/response handling for apply-fixes API."""

from __future__ import annotations

import base64
from typing import Any

from python.pptx_writer.apply_fixes import apply_fixes_to_pptx


def run_apply_fixes(payload: dict[str, Any]) -> dict[str, Any]:
    file_b64 = payload.get("file_base64")
    filename = payload.get("filename", "presentation.pptx")
    findings = payload.get("findings") or []

    if not file_b64:
        raise ValueError("file_base64 is required")
    if not findings:
        raise ValueError("findings is required")

    file_bytes = base64.b64decode(file_b64)
    if len(file_bytes) > 50 * 1024 * 1024:
        raise ValueError("File exceeds 50MB limit")

    fixed_bytes, applied_count, skipped_count = apply_fixes_to_pptx(
        file_bytes, findings
    )

    stem = filename.rsplit(".", 1)[0] if "." in filename else filename
    out_name = f"{stem}-fixed.pptx"

    return {
        "file_base64": base64.b64encode(fixed_bytes).decode("ascii"),
        "filename": out_name,
        "applied_count": applied_count,
        "skipped_count": skipped_count,
    }
