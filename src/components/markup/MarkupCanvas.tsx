"use client";

import { useRef, useState } from "react";
import {
  clampBox,
  SEVERITY_COLORS,
  type Finding,
  type MarkupBox,
} from "@/lib/markup";

/**
 * The photo with its mark-up drawn over it.
 *
 * Shapes live in an SVG using a 0–1000 × 0–1000 viewBox with
 * `preserveAspectRatio="none"`, so a normalised box maps straight onto the
 * image at any display size. `vector-effect="non-scaling-stroke"` keeps the
 * outlines an even weight despite that non-uniform scaling — without it the
 * strokes stretch with the photo's aspect ratio.
 */

interface MarkupCanvasProps {
  src: string;
  width: number;
  height: number;
  alt: string;
  findings: Finding[];
  /** Circles read as "look here" on a photo; boxes are tidier for tight areas. */
  shape: "ellipse" | "box";
  activeId: string | null;
  onActiveChange: (id: string | null) => void;
  /** When armed, dragging on the photo adds a region by hand. */
  drawing: boolean;
  onDraw: (box: MarkupBox) => void;
}

const VIEW = 1000;

/** Ignore stray clicks — a real region is at least ~2% of the photo. */
const MIN_DRAG = 0.02;

function boxFromPoints(
  ax: number,
  ay: number,
  bx: number,
  by: number
): MarkupBox {
  return clampBox({
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    width: Math.abs(bx - ax),
    height: Math.abs(by - ay),
  });
}

export function MarkupCanvas({
  src,
  width,
  height,
  alt,
  findings,
  shape,
  activeId,
  onActiveChange,
  drawing,
  onDraw,
}: MarkupCanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const [preview, setPreview] = useState<MarkupBox | null>(null);

  /** Pointer position as a 0–1 fraction of the photo. */
  const pointAt = (event: React.PointerEvent): { x: number; y: number } | null => {
    const frame = frameRef.current;
    if (!frame) return null;
    const rect = frame.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
    };
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    if (!drawing || event.button !== 0) return;
    const point = pointAt(event);
    if (!point) return;
    event.preventDefault();
    // Capture so the drag keeps tracking if the pointer leaves the photo.
    event.currentTarget.setPointerCapture(event.pointerId);
    startRef.current = point;
    setPreview({ x: point.x, y: point.y, width: 0, height: 0 });
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const start = startRef.current;
    if (!start) return;
    const point = pointAt(event);
    if (!point) return;
    setPreview(boxFromPoints(start.x, start.y, point.x, point.y));
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    const start = startRef.current;
    startRef.current = null;
    setPreview(null);
    if (!start) return;
    const point = pointAt(event);
    if (!point) return;
    const box = boxFromPoints(start.x, start.y, point.x, point.y);
    if (box.width < MIN_DRAG || box.height < MIN_DRAG) return;
    onDraw(box);
  };

  return (
    <div
      ref={frameRef}
      className={`relative w-full select-none overflow-hidden rounded-lg bg-zinc-100 ${
        drawing ? "cursor-crosshair" : ""
      }`}
      style={{ aspectRatio: `${width} / ${height}` }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {/* Photos are user data URLs, so next/image would add nothing here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="pointer-events-none block h-full w-full object-cover"
        draggable={false}
      />

      <svg
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {findings.map((finding) => {
          const color = SEVERITY_COLORS[finding.severity];
          const active = finding.id === activeId;
          const { x, y, width: w, height: h } = finding.box;
          const uncertain = finding.confidence < 0.5;
          const common = {
            fill: active ? color : "transparent",
            fillOpacity: active ? 0.18 : 0,
            stroke: color,
            strokeWidth: active ? 4 : 3,
            strokeDasharray: uncertain ? "9 7" : undefined,
            vectorEffect: "non-scaling-stroke" as const,
          };

          if (shape === "ellipse") {
            // Inflate slightly so the outline encircles the patch instead of
            // slicing through its edges.
            return (
              <ellipse
                key={finding.id}
                cx={(x + w / 2) * VIEW}
                cy={(y + h / 2) * VIEW}
                rx={Math.min((w / 2) * 1.08, 0.5) * VIEW}
                ry={Math.min((h / 2) * 1.08, 0.5) * VIEW}
                {...common}
              />
            );
          }
          return (
            <rect
              key={finding.id}
              x={x * VIEW}
              y={y * VIEW}
              width={w * VIEW}
              height={h * VIEW}
              rx={6}
              {...common}
            />
          );
        })}

        {preview && (
          <rect
            x={preview.x * VIEW}
            y={preview.y * VIEW}
            width={preview.width * VIEW}
            height={preview.height * VIEW}
            fill="#0ea5e9"
            fillOpacity={0.2}
            stroke="#0284c7"
            strokeWidth={3}
            strokeDasharray="8 6"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      {/* Numbered badges are HTML, not SVG text: they stay perfectly round and
          legible at any photo aspect ratio, and they can carry hover state. */}
      {findings.map((finding, index) => (
        <button
          key={finding.id}
          type="button"
          onMouseEnter={() => onActiveChange(finding.id)}
          onMouseLeave={() => onActiveChange(null)}
          onFocus={() => onActiveChange(finding.id)}
          onBlur={() => onActiveChange(null)}
          onClick={() => onActiveChange(finding.id)}
          title={finding.label}
          className={`absolute z-10 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold text-white shadow-md ring-2 ring-white transition-transform ${
            finding.id === activeId ? "scale-125" : ""
          } ${drawing ? "pointer-events-none" : ""}`}
          style={{
            left: `${Math.min(Math.max(finding.box.x, 0.03), 0.97) * 100}%`,
            top: `${Math.min(Math.max(finding.box.y, 0.04), 0.96) * 100}%`,
            backgroundColor: SEVERITY_COLORS[finding.severity],
          }}
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}
