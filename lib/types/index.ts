export enum RuleCategory {
  Title = "Title",
  Footer = "Footer",
  Bullets = "Bullets",
  Tables = "Tables",
  Charts = "Charts",
  Colors = "Colors",
  Spacing = "Spacing",
  Shapes = "Shapes",
  WritingStyle = "Writing Style",
  Terminology = "Terminology",
  Footnotes = "Footnotes",
}

export enum Severity {
  Error = "ERROR",
  Warning = "WARNING",
  Info = "INFO",
}

export enum Confidence {
  High = "HIGH",
  Medium = "MEDIUM",
  Low = "LOW",
}

export enum FindingSource {
  Deterministic = "deterministic",
  Ai = "ai",
}

export enum SlideType {
  Title = "title",
  Section = "section",
  Content = "content",
  Unknown = "unknown",
}

export interface PositionMetadata {
  left_inches: number;
  top_inches: number;
  width_inches: number;
  height_inches: number;
}

export interface HighlightRegion {
  position: PositionMetadata;
  label: string;
}

export interface ColorMetadata {
  hex?: string | null;
  rgb?: string | null;
}

export interface TextRunMetadata {
  text: string;
  font_family?: string | null;
  font_size_pt?: number | null;
  bold?: boolean | null;
  italic?: boolean | null;
  color?: ColorMetadata | null;
  superscript?: boolean | null;
}

export interface ParagraphMetadata {
  level: number;
  text: string;
  runs: TextRunMetadata[];
  bullet_char?: string | null;
  indent_inches?: number | null;
  space_after_pt?: number | null;
  line_spacing?: number | null;
  alignment?: string | null;
}

export interface TextMetadata {
  shape_id: string;
  shape_name: string;
  is_title: boolean;
  is_placeholder?: boolean;
  placeholder_type?: string | null;
  position: PositionMetadata;
  paragraphs: ParagraphMetadata[];
  full_text: string;
  vertical_anchor?: string | null;
  fill_hex?: string | null;
}

export interface TableCellMetadata {
  row: number;
  col: number;
  text: string;
  font_family?: string | null;
  font_size_pt?: number | null;
  bold?: boolean | null;
  italic?: boolean | null;
  fill_hex?: string | null;
  font_color_hex?: string | null;
  is_merged: boolean;
  alignment?: string | null;
  vertical_anchor?: string | null;
  border_left?: boolean | null;
  border_right?: boolean | null;
  border_top?: boolean | null;
  border_bottom?: boolean | null;
}

export interface TableMetadata {
  shape_id: string;
  shape_name: string;
  position: PositionMetadata;
  rows: number;
  cols: number;
  has_title: boolean;
  title_text?: string | null;
  title_font_size_pt?: number | null;
  title_bold: boolean;
  cells: TableCellMetadata[];
  header_row_fill_hex?: string | null;
}

export interface ChartMetadata {
  shape_id: string;
  shape_name: string;
  position: PositionMetadata;
  has_title: boolean;
  title_text?: string | null;
  title_font_size_pt?: number | null;
  title_bold?: boolean | null;
  is_picture: boolean;
  has_source_note: boolean;
  source_note_text?: string | null;
  source_note_font_size_pt?: number | null;
  source_note_italic: boolean;
  is_native_chart?: boolean;
  has_legend?: boolean | null;
  has_axis_titles?: boolean | null;
}

export interface ShapeMetadata {
  shape_id: string;
  shape_name: string;
  shape_type: string;
  position: PositionMetadata;
  fill_hex?: string | null;
  text?: string | null;
  font_family?: string | null;
  font_size_pt?: number | null;
  bold?: boolean | null;
}

export interface SlideMetadata {
  slide_number: number;
  slide_type: SlideType;
  notes: string;
  title?: TextMetadata | null;
  confidentiality?: TextMetadata | null;
  texts: TextMetadata[];
  tables: TableMetadata[];
  charts: ChartMetadata[];
  shapes: ShapeMetadata[];
  has_confidentiality: boolean;
  authors: string[];
  date_text?: string | null;
  contains_draft: boolean;
}

export interface PresentationMetadata {
  filename: string;
  slide_width_inches: number;
  slide_height_inches: number;
  slide_count: number;
  slides: SlideMetadata[];
  /** Base64 PNG per slide — faithful PowerPoint render */
  slide_images?: string[];
}

export interface Finding {
  id: string;
  rule_id: string;
  slide_number: number;
  title: string;
  description: string;
  category: RuleCategory;
  severity: Severity;
  confidence: Confidence;
  expected_value: string;
  actual_value: string;
  recommendation: string;
  accepted: boolean;
  rejected: boolean;
  source: FindingSource;
  shape_id?: string;
  highlight?: PositionMetadata;
  /** Precise regions to highlight (cells, words, rows). */
  highlight_regions?: HighlightRegion[];
}

export interface SlideAnalysis {
  slide_number: number;
  slide_type: SlideType;
  findings: Finding[];
  accepted_count: number;
  rejected_count: number;
  pending_count: number;
}

export interface PresentationAnalysis {
  id: string;
  filename: string;
  analyzed_at: string;
  slide_count: number;
  slides: SlideAnalysis[];
  findings: Finding[];
  metadata: PresentationMetadata;
  progress: number;
  status: "pending" | "parsing" | "rules" | "ai" | "complete" | "error";
  error?: string;
}

export interface RuleResult {
  pass: boolean;
  finding?: Omit<Finding, "id" | "accepted" | "rejected">;
}

export interface BaseRule {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  severity: Severity;
  run(slide: SlideMetadata, deck: PresentationMetadata): RuleResult[];
}
