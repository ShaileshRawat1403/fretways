import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

import type { LabelMode, NeckCell } from "@/lib/fretways/neck";
import { stringRowKey } from "@/lib/fretways/neck";

const INLAYS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);
const ZOOM_KEY = "fretways-neck-zoom";
const MIN_FRET = 34;
const MAX_FRET = 112;

export type NeckHandle = {
  scrollToFret: (fret: number) => void;
};

function clampFret(size: number): number {
  return Math.min(MAX_FRET, Math.max(MIN_FRET, size));
}

function readZoom(): number {
  if (typeof window === "undefined") return 58;
  const stored = Number(window.localStorage.getItem(ZOOM_KEY));
  return Number.isFinite(stored) ? clampFret(stored) : 58;
}

export const Neck = forwardRef<NeckHandle, {
  frets: number[];
  rows: NeckCell[][];
  stringLabels: string[];
  labelMode: LabelMode;
  marks: Record<string, "draft" | "yours">;
  mutedStrings: number[];
  shapeKeys: string[];
  moves: { key: string; word: string }[];
  activeKey: string | null;
  heardKey: string | null;
  onTap: (cell: NeckCell) => void;
  onVisibleFret: (fret: number) => void;
}>(function Neck(props, ref) {
  const scroller = useRef<HTMLDivElement>(null);
  const fretPx = useRef(58);
  const [size, setSize] = useState(58);
  const [pinching, setPinching] = useState(false);
  const [zoomNote, setZoomNote] = useState<string | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef({ mode: "none" as "none" | "pan" | "pinch", startX: 0, scroll: 0, distance: 0, size: 58, moved: false });
  const suppressClick = useRef(false);
  const noteTimer = useRef<number>(0);
  fretPx.current = size;

  useEffect(() => {
    const next = readZoom();
    fretPx.current = next;
    setSize(next);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(ZOOM_KEY, String(Math.round(size)));
  }, [size]);

  function flashZoom(next: number) {
    const node = scroller.current;
    const count = node ? Math.max(1, Math.round(node.clientWidth / next)) : 0;
    setZoomNote(count ? `${count} frets across` : "Neck size");
    window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setZoomNote(null), 700);
  }

  function zoomAt(next: number, anchor: number) {
    const node = scroller.current;
    const old = fretPx.current;
    const clamped = clampFret(next);
    if (!node || old === 0) {
      setSize(clamped);
      return;
    }
    const focus = node.scrollLeft + node.clientWidth * anchor;
    const index = focus / old;
    fretPx.current = clamped;
    setSize(clamped);
    flashZoom(clamped);
    requestAnimationFrame(() => {
      node.scrollLeft = index * clamped - node.clientWidth * anchor;
    });
  }

  useImperativeHandle(ref, () => ({
    scrollToFret(fret: number) {
      const node = scroller.current;
      const target = node?.querySelector<HTMLElement>(`[data-fret-col="${fret}"]`);
      if (!node || !target) return;
      node.scrollTo({ left: Math.max(0, target.offsetLeft - 36), behavior: "smooth" });
    },
  }));

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const rect = node.getBoundingClientRect();
        const anchor = rect.width === 0 ? 0.5 : (event.clientX - rect.left) / rect.width;
        zoomAt(fretPx.current * (event.deltaY > 0 ? 0.92 : 1.08), anchor);
        return;
      }
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        event.preventDefault();
        node.scrollLeft += event.deltaY;
      }
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  function distance(): number {
    const points = [...pointers.current.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size >= 2) {
      event.currentTarget.setPointerCapture(event.pointerId);
      gesture.current = { mode: "pinch", startX: 0, scroll: 0, distance: distance(), size: fretPx.current, moved: true };
      setPinching(true);
      return;
    }
    gesture.current = { mode: "pan", startX: event.clientX, scroll: scroller.current?.scrollLeft ?? 0, distance: 0, size: fretPx.current, moved: false };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const node = scroller.current;
    if (!node) return;
    if (gesture.current.mode === "pinch" && pointers.current.size >= 2) {
      const next = distance();
      if (gesture.current.distance > 0 && next > 0) zoomAt(gesture.current.size * (next / gesture.current.distance), 0.5);
      return;
    }
    if (gesture.current.mode === "pan") {
      const delta = event.clientX - gesture.current.startX;
      if (Math.abs(delta) > 6) {
        gesture.current.moved = true;
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.setPointerCapture(event.pointerId);
      }
      if (gesture.current.moved) node.scrollLeft = gesture.current.scroll - delta;
    }
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2 && gesture.current.mode === "pinch") {
      gesture.current.mode = "none";
      setPinching(false);
    }
    if (pointers.current.size === 0) {
      if (gesture.current.moved) suppressClick.current = true;
      gesture.current.mode = "none";
      setPinching(false);
    }
  }

  function onScroll() {
    const node = scroller.current;
    if (!node) return;
    const fret = Math.round(node.scrollLeft / fretPx.current);
    props.onVisibleFret(Math.max(0, Math.min(props.frets[props.frets.length - 1] ?? 0, fret)));
  }

  const hummed = props.activeKey?.split("-")[0];

  return (
    <div
      ref={scroller}
      className={`neck-frame ${pinching ? "is-pinching" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onScroll={onScroll}
    >
      <div className="board" style={{ ["--fret" as string]: `${size}px` }}>
        <div className="fret-head">
          <div className="nut-label" />
          {props.frets.map((fret) => (
            <div key={fret} className="fret-no" data-fret-col={fret}>
              {fret === 0 ? "open" : fret}
              {fret === 12 ? <span className="inlay inlay-pair" /> : null}
              {INLAYS.has(fret) ? <span className="inlay" /> : null}
            </div>
          ))}
        </div>
        {props.rows.map((row, rowIndex) => (
          <div key={stringRowKey(row[0].stringIndex)} className={`string-row ${hummed === String(row[0].stringIndex) ? "is-hum" : ""}`}>
            <div className={`string-name gauge-${rowIndex}`}>
              {props.stringLabels[rowIndex]}
              {props.mutedStrings.includes(row[0].stringIndex) ? "×" : ""}
            </div>
            {row.map((cell) => {
              const key = `${cell.stringIndex}-${cell.fret}`;
              const mark = props.marks[key];
              const letter = cell.noteName.replace(/[0-9-]/g, "");
              const caption =
                props.labelMode === "intervals"
                  ? cell.intervalLabel
                  : props.labelMode === "names" || cell.role
                    ? letter
                    : "";
              const move = props.moves.find((item) => item.key === key);
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={`String ${cell.conventionalString}, fret ${cell.fret}, ${cell.noteName}`}
                  onClick={() => {
                    if (suppressClick.current) {
                      suppressClick.current = false;
                      return;
                    }
                    props.onTap(cell);
                  }}
                  className={`fret-cell ${cell.fret === 0 ? "is-open" : ""} ${mark === "draft" ? "is-draft" : ""} ${props.activeKey === key ? "is-live" : ""}`}
                >
                  <span className={`wire gauge-line-${rowIndex}`} />
                  {cell.role ? <span className={`tone tone-${cell.role}`} /> : null}
                  {props.shapeKeys.includes(key) ? <span className="shape-ring" /> : null}
                  {move ? <span className="move-ring" /> : null}
                  {props.heardKey === key ? <span className="heard-ring" /> : null}
                  {mark === "yours" ? <span className="yours-ring" /> : null}
                  {caption ? <span className={cell.role ? "cap on-tone" : "cap"}>{caption}</span> : null}
                  {move && !caption ? <span className="move-word">{move.word}</span> : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {zoomNote ? <p className="zoom-note">{zoomNote}</p> : null}
    </div>
  );
});
