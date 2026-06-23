"""Pydantic schemas for normalized presentation metadata."""

from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class SlideType(str, Enum):
    TITLE = "title"
    SECTION = "section"
    CONTENT = "content"
    UNKNOWN = "unknown"


class PositionMetadata(BaseModel):
    left_inches: float
    top_inches: float
    width_inches: float
    height_inches: float


class ColorMetadata(BaseModel):
    hex: Optional[str] = None
    rgb: Optional[str] = None


class TextRunMetadata(BaseModel):
    text: str
    font_family: Optional[str] = None
    font_size_pt: Optional[float] = None
    bold: Optional[bool] = None
    italic: Optional[bool] = None
    color: Optional[ColorMetadata] = None
    # True when the run is rendered as a superscript (baseline > 0).
    superscript: Optional[bool] = None


class ParagraphMetadata(BaseModel):
    level: int = 0
    text: str
    runs: list[TextRunMetadata] = Field(default_factory=list)
    bullet_char: Optional[str] = None
    indent_inches: Optional[float] = None
    space_after_pt: Optional[float] = None
    line_spacing: Optional[float] = None
    # Horizontal alignment: LEFT / CENTER / RIGHT / JUSTIFY (None when inherited).
    alignment: Optional[str] = None


class TextMetadata(BaseModel):
    shape_id: str
    shape_name: str
    is_title: bool = False
    is_placeholder: bool = False
    placeholder_type: Optional[str] = None
    position: PositionMetadata
    paragraphs: list[ParagraphMetadata] = Field(default_factory=list)
    full_text: str = ""
    # Vertical anchor of the text frame: TOP / MIDDLE / BOTTOM (None when inherited).
    vertical_anchor: Optional[str] = None
    # Shape fill when the text box has an explicit background (e.g. callout boxes).
    fill_hex: Optional[str] = None


class TableCellMetadata(BaseModel):
    row: int
    col: int
    text: str
    font_family: Optional[str] = None
    font_size_pt: Optional[float] = None
    bold: Optional[bool] = None
    italic: Optional[bool] = None
    fill_hex: Optional[str] = None
    font_color_hex: Optional[str] = None
    is_merged: bool = False
    # Explicit horizontal alignment of the cell's first paragraph, if any.
    alignment: Optional[str] = None
    # Explicit vertical anchor of the cell, if any.
    vertical_anchor: Optional[str] = None
    # True/False when an explicit border edge is present; None when inherited.
    border_left: Optional[bool] = None
    border_right: Optional[bool] = None
    border_top: Optional[bool] = None
    border_bottom: Optional[bool] = None


class TableMetadata(BaseModel):
    shape_id: str
    shape_name: str
    position: PositionMetadata
    rows: int
    cols: int
    has_title: bool = False
    title_text: Optional[str] = None
    title_font_size_pt: Optional[float] = None
    title_bold: bool = False
    cells: list[TableCellMetadata] = Field(default_factory=list)
    header_row_fill_hex: Optional[str] = None


class ChartMetadata(BaseModel):
    shape_id: str
    shape_name: str
    position: PositionMetadata
    has_title: bool = False
    title_text: Optional[str] = None
    title_font_size_pt: Optional[float] = None
    title_bold: Optional[bool] = None
    is_picture: bool = False
    has_source_note: bool = False
    source_note_text: Optional[str] = None
    source_note_font_size_pt: Optional[float] = None
    source_note_italic: bool = False
    # Native-chart introspection (None when the visual is a picture/unknown).
    is_native_chart: bool = False
    has_legend: Optional[bool] = None
    has_axis_titles: Optional[bool] = None


class ShapeMetadata(BaseModel):
    shape_id: str
    shape_name: str
    shape_type: str
    position: PositionMetadata
    fill_hex: Optional[str] = None
    text: Optional[str] = None
    font_family: Optional[str] = None
    font_size_pt: Optional[float] = None
    bold: Optional[bool] = None


class SlideMetadata(BaseModel):
    slide_number: int
    slide_type: SlideType = SlideType.UNKNOWN
    notes: str = ""
    title: Optional[TextMetadata] = None
    confidentiality: Optional[TextMetadata] = None
    texts: list[TextMetadata] = Field(default_factory=list)
    tables: list[TableMetadata] = Field(default_factory=list)
    charts: list[ChartMetadata] = Field(default_factory=list)
    shapes: list[ShapeMetadata] = Field(default_factory=list)
    has_confidentiality: bool = False
    authors: list[str] = Field(default_factory=list)
    date_text: Optional[str] = None
    contains_draft: bool = False


class PresentationMetadata(BaseModel):
    filename: str
    slide_width_inches: float
    slide_height_inches: float
    slide_count: int
    slides: list[SlideMetadata] = Field(default_factory=list)
    slide_images: list[str] = Field(
        default_factory=list,
        description="Base64-encoded PNG per slide for faithful preview",
    )
