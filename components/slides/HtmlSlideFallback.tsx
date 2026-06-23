import type { CSSProperties } from "react";
import {
  ParagraphMetadata,
  ShapeMetadata,
  SlideMetadata,
  TableMetadata,
  TextMetadata,
} from "@/lib/types";

function toCssColor(hex?: string | null): string | undefined {
  if (!hex) return undefined;
  const h = hex.replace(/^#/, "");
  if (h.length === 6) return `#${h}`;
  if (h.length === 8) return `#${h.slice(2)}`; // AARRGGBB → RRGGBB
  return hex.startsWith("#") ? hex : `#${hex}`;
}

function posStyle(
  position: { left_inches: number; top_inches: number; width_inches: number; height_inches: number },
  scale: number,
) {
  return {
    left: position.left_inches * scale,
    top: position.top_inches * scale,
    width: position.width_inches * scale,
    height: position.height_inches * scale,
  };
}

function ParagraphBlock({
  paragraphs,
  defaultSize,
  scale,
}: {
  paragraphs: ParagraphMetadata[];
  defaultSize: number;
  scale: number;
}) {
  return (
    <>
      {paragraphs.map((p, i) => (
        <p
          key={i}
          style={{
            margin: 0,
            fontSize: defaultSize,
            lineHeight: 1.2,
            textAlign: (p.alignment as CSSProperties["textAlign"]) ?? "left",
            paddingLeft: (p.indent_inches ?? 0) * scale,
            marginBottom: p.space_after_pt ? (p.space_after_pt / 72) * scale : 0,
          }}
        >
          {p.bullet_char && (
            <span style={{ marginRight: 4 }}>{p.bullet_char}</span>
          )}
          {p.runs.map((run, j) => (
            <span
              key={j}
              style={{
                fontWeight: run.bold ? "bold" : "normal",
                fontStyle: run.italic ? "italic" : "normal",
                color: toCssColor(run.color?.hex),
                fontSize: run.font_size_pt
                  ? Math.max(6, (run.font_size_pt / 72) * 96 * (scale / 96))
                  : undefined,
                fontFamily: run.font_family ?? "Arial, sans-serif",
                verticalAlign: run.superscript ? "super" : undefined,
              }}
            >
              {run.text}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

function ShapeLayer({ shape, scale }: { shape: ShapeMetadata; scale: number }) {
  const fill = toCssColor(shape.fill_hex);
  if (!fill) return null;

  return (
    <div
      className="absolute"
      style={{
        ...posStyle(shape.position, scale),
        backgroundColor: fill,
        border: "1px solid rgba(0,0,0,0.08)",
      }}
    />
  );
}

function TextBoxLayer({
  text,
  scale,
  fontScale,
}: {
  text: TextMetadata;
  scale: number;
  fontScale: number;
}) {
  const fill = toCssColor(text.fill_hex);
  const defaultSize = Math.max(7, 9 * fontScale);

  return (
    <div
      className="absolute overflow-hidden"
      style={{
        ...posStyle(text.position, scale),
        backgroundColor: fill,
        padding: fill ? 2 : 0,
      }}
    >
      <ParagraphBlock paragraphs={text.paragraphs} defaultSize={defaultSize} scale={scale} />
    </div>
  );
}

function TableLayer({ table, scale }: { table: TableMetadata; scale: number }) {
  const { position, rows, cols, cells } = table;
  if (rows === 0 || cols === 0) return null;

  const cellW = (position.width_inches * scale) / cols;
  const cellH = (position.height_inches * scale) / rows;

  const cellMap = new Map(cells.map((c) => [`${c.row},${c.col}`, c]));

  return (
    <div
      className="absolute overflow-hidden"
      style={posStyle(position, scale)}
    >
      {table.has_title && table.title_text && (
        <div
          className="truncate text-center font-bold"
          style={{
            fontSize: Math.max(7, (table.title_font_size_pt ?? 10) * 0.85),
            marginBottom: 2,
          }}
        >
          {table.title_text}
        </div>
      )}
      <table
        className="w-full border-collapse"
        style={{ tableLayout: "fixed" }}
      >
        <tbody>
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }, (_, c) => {
                const cell = cellMap.get(`${r},${c}`);
                const bg = toCssColor(
                  cell?.fill_hex ?? (r === 0 ? table.header_row_fill_hex : undefined),
                );
                return (
                  <td
                    key={c}
                    className="overflow-hidden align-top"
                    style={{
                      width: cellW,
                      height: cellH,
                      backgroundColor: bg,
                      color: toCssColor(cell?.font_color_hex),
                      fontWeight: cell?.bold ? "bold" : "normal",
                      fontStyle: cell?.italic ? "italic" : "normal",
                      fontSize: cell?.font_size_pt
                        ? Math.max(5, cell.font_size_pt * 0.75)
                        : Math.max(5, 7 * (scale / 80)),
                      textAlign: (cell?.alignment as CSSProperties["textAlign"]) ?? "left",
                      borderTop: cell?.border_top ? "1px solid #333" : "1px solid #ccc",
                      borderBottom: cell?.border_bottom ? "1px solid #333" : "1px solid #ccc",
                      borderLeft: cell?.border_left ? "1px solid #333" : "1px solid #ccc",
                      borderRight: cell?.border_right ? "1px solid #333" : "1px solid #ccc",
                      padding: "1px 2px",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {cell?.text ?? ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function HtmlSlideFallback({
  slide,
  scale,
  fontScale,
}: {
  slide: SlideMetadata;
  scale: number;
  fontScale: number;
}) {
  const titleId = slide.title?.shape_id;
  const bodyTexts = slide.texts.filter((t) => t.shape_id !== titleId && !t.is_title);

  return (
    <>
      {/* Decorative shapes (background layer) */}
      {slide.shapes.map((shape) => (
        <ShapeLayer key={shape.shape_id} shape={shape} scale={scale} />
      ))}

      {/* Tables */}
      {slide.tables.map((table) => (
        <TableLayer key={table.shape_id} table={table} scale={scale} />
      ))}

      {/* Charts — placeholder box with title */}
      {slide.charts.map((chart) => (
        <div
          key={chart.shape_id}
          className="absolute flex flex-col items-center justify-center border border-dashed border-gray-300 bg-gray-50/80"
          style={posStyle(chart.position, scale)}
        >
          {chart.title_text && (
            <span
              className="px-1 text-center font-bold"
              style={{ fontSize: Math.max(7, (chart.title_font_size_pt ?? 10) * 0.8) }}
            >
              {chart.title_text}
            </span>
          )}
          <span className="text-[8px] text-gray-400">[chart]</span>
        </div>
      ))}

      {/* Title */}
      {slide.title && (
        <TextBoxLayer text={slide.title} scale={scale} fontScale={fontScale} />
      )}

      {/* Body text boxes */}
      {bodyTexts.map((text) => (
        <TextBoxLayer key={text.shape_id} text={text} scale={scale} fontScale={fontScale} />
      ))}

      {/* Confidentiality footer */}
      {slide.confidentiality && (
        <TextBoxLayer
          text={slide.confidentiality}
          scale={scale}
          fontScale={fontScale * 0.7}
        />
      )}
    </>
  );
}
