import React, { useEffect, useRef, useState } from "react";
import { useZStack } from "../../../Context/ZStack.context.jsx"; // keep this path

/**
 * DragBox
 * A generic, self-contained draggable card container.
 *
 * Props:
 * - storageKey: string (required)  // where we persist the position in localStorage
 * - defaultPos: { x:number, y:number } (required)
 * - title: string                   // main title text shown in the header
 * - width: number                   // fixed width (default 700)
 * - children: ReactNode             // content rendered inside card body
 * - onAddFunction?: () => void
 * - onAddText?: string
 * - addNote?: string               // send '-' to hide + button
 * - onClose?: () => void           // optional: parent callback when closed
 */
const DragBox = ({
  storageKey,
  defaultPos,
  title,
  width,
  children,
  onAddFunction = null,
  onAddText = "+",
  addNote,
  onClose,
}) => {
  // ---- load & persist position ----
  const loadSavedPosition = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : defaultPos;
    } catch {
      return defaultPos;
    }
  };

  const [position, setPosition] = useState(loadSavedPosition);
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // NEW: local UI state
  const [minimized, setMinimized] = useState(false);
  const [closed, setClosed] = useState(false);

  // ---- z-index stack ----
  const zCtx = useZStack?.();
  const bringToFront = zCtx?.bringToFront;
  const topKey = zCtx?.topKey;
  const isTop = topKey === storageKey;
  const zIndex = isTop ? 600 : 500; // active box sits on top

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    bringToFront?.(storageKey); // focus this box
    setDragging(true);
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    const next = {
      x: e.clientX - dragOffsetRef.current.x,
      y: e.clientY - dragOffsetRef.current.y,
    };
    setPosition(next);
  };

  const onMouseUp = (e) => {
    if (!dragging) return;
    setDragging(false);
    const finalPos = {
      x: e.clientX - dragOffsetRef.current.x,
      y: e.clientY - dragOffsetRef.current.y,
    };
    setPosition(finalPos);
    try {
      localStorage.setItem(storageKey, JSON.stringify(finalPos));
    } catch {}
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    } else {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging]);

  // Close handler: hide locally, notify parent if provided
  const handleClose = (e) => {
    e?.stopPropagation?.();
    setClosed(true);
    onClose?.();
  };

  if (closed) return null;

  return (
    <div
      onMouseDown={() => bringToFront?.(storageKey)} // bring to front on any click in the card
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        zIndex,
        minWidth: width,
        maxWidth: width,
        border: "2px solid var(--bs-secondary)",
        borderRadius: 8,
        backgroundColor: "var(--bs-body-bg)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
      className="card shadow-sm"
    >
      <div
        className="card-header d-flex align-items-center p-0"
        onMouseDown={onMouseDown}
        style={{ cursor: "grab", userSelect: "none" }}
        title="Drag"
      >
        <div
          className="d-flex align-items-center col-48 p-1"
          style={{ backgroundColor: "rgba(207, 237, 237, 0.1)" }}
        >
          {/* Minimize button (left) */}
          <button
            className="btn btn-sm btn-outline-primary me-2"
            style={{ height: 30, padding: "0 8px" }}
            onMouseDown={(e) => {
              // do not start drag when clicking
              e.stopPropagation();
              bringToFront?.(storageKey);
            }}
            onClick={(e) => {
              e.stopPropagation();
              setMinimized((m) => !m);
            }}
            title={minimized ? "Restore" : "Minimize"}
            aria-label={minimized ? "Restore" : "Minimize"}
          >
            {minimized ? "+" : "–"}
          </button>

          {/* Drag glyph */}
          {/* <div style={{ marginLeft: "5px", pointerEvents: "none" }} tabIndex={-1}>
            ⠿ Drag
          </div> */}

          {/* Title */}
          <div className="text-primary flex-grow-1 text-center fs-7 fw-bold">
            {title}
          </div>

          {/* + button (optional, right side) */}
          {addNote !== "-" && (
            <button
              className="btn btn-sm btn-outline-success"
              style={{ marginRight: "5px", height: 30, padding: "0 8px" }}
              onMouseDown={(e) => {
                e.stopPropagation();
                bringToFront?.(storageKey);
              }}
              onClick={(e) => {
                e.stopPropagation();
                onAddFunction && onAddFunction();
              }}
              aria-label="Add"
              title={addNote}
            >
              {onAddText}
            </button>
          )}

          {/* Close (red X) replaces old Reset */}
          <button
            type="button"
            className="btn btn-sm btn-outline-danger ms-auto"
            style={{ marginRight: "5px", height: 30, padding: "0 8px" }}
            onMouseDown={(e) => {
              e.stopPropagation();
              bringToFront?.(storageKey);
            }}
            onClick={handleClose}
            title="Close"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>

      {/* Body (hidden when minimized) */}
      {!minimized && children && <div className="card-body p-2">{children}</div>}
    </div>
  );
};

export default DragBox;
