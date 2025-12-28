// src/components/DragBox/Drag/dragBox.component.jsx
import React from "react";

const ZBus = (() => {
  let top = 500;
  const zmap = new Map();
  return {
    bringToFront(id) {
      const next = ++top;
      if (id) zmap.set(id, next);
      return next;
    },
    getZ(id, fallback = top) {
      return id ? (zmap.get(id) ?? fallback) : fallback;
    },
    peekTop() { return top; }
  };
})();

const genId = (() => {
  let n = 0;
  return (prefix = "DRAGBOX") => `${prefix}_${++n}_${Date.now()}`;
})();

export default function DragBox({
  id: propId,
  title = "Window",
  isOpen = true,
  defaultPos = { x: 80, y: 80 },
  storageKey,
  width = 540,
  zIndexBase = 500,
  onClose,
  className = "",
  headerRight = null,
  children,
}) {
  const idRef = React.useRef(propId || genId());
  const id = idRef.current;
  const boxWidth = typeof width === "number" ? `${width}px` : width;

  const loadPos = React.useCallback(() => {
    if (!storageKey) return defaultPos;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return defaultPos;
      const p = JSON.parse(raw);
      if (typeof p?.x === "number" && typeof p?.y === "number") return p;
      return defaultPos;
    } catch {
      return defaultPos;
    }
  }, [storageKey, defaultPos]);

  const [pos, setPos] = React.useState(loadPos);
  const posRef = React.useRef(pos);
  React.useEffect(() => { posRef.current = pos; }, [pos]);

  const [z, setZ] = React.useState(() => ZBus.getZ(id, zIndexBase));

  // bring to front on mount
  React.useEffect(() => {
    setZ(ZBus.bringToFront(id));
  }, [id]);

  // bring to front when re-shown
  const prevOpen = usePrevious(isOpen);
  React.useEffect(() => {
    if (isOpen && prevOpen === false) {
      setZ(ZBus.bringToFront(id));
    }
  }, [isOpen, prevOpen, id]);

  const dragRef = React.useRef({
    active: false, startX: 0, startY: 0, origX: 0, origY: 0,
  });

  const startDrag = (clientX, clientY) => {
    dragRef.current.active = true;
    dragRef.current.startX = clientX;
    dragRef.current.startY = clientY;
    dragRef.current.origX = posRef.current.x;
    dragRef.current.origY = posRef.current.y;
  };
  const moveDrag = (clientX, clientY) => {
    if (!dragRef.current.active) return;
    const dx = clientX - dragRef.current.startX;
    const dy = clientY - dragRef.current.startY;
    setPos({ x: dragRef.current.origX + dx, y: dragRef.current.origY + dy });
  };
  const endDrag = () => {
    if (!dragRef.current.active) return;
    dragRef.current.active = false;
    // Persist using the ref (latest position)
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(posRef.current));
      } catch {}
    }
    // remove listeners
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    document.removeEventListener("touchmove", onTouchMove);
    document.removeEventListener("touchend", onTouchEnd);
  };

  const onMouseDownHeader = (e) => {
    setZ(ZBus.bringToFront(id));
    startDrag(e.clientX, e.clientY);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };
  const onMouseMove = (e) => moveDrag(e.clientX, e.clientY);
  const onMouseUp = () => endDrag();

  const onTouchStartHeader = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    setZ(ZBus.bringToFront(id));
    startDrag(t.clientX, t.clientY);
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.addEventListener("touchend", onTouchEnd);
  };
  const onTouchMove = (e) => {
    const t = e.touches?.[0];
    if (!t) return;
    e.preventDefault();
    moveDrag(t.clientX, t.clientY);
  };
  const onTouchEnd = () => endDrag();

  const onBoxMouseDown = () => {
    if (z < ZBus.peekTop()) setZ(ZBus.bringToFront(id));
  };

  const [minimized, setMinimized] = React.useState(false);

  if (!isOpen) return null;

  return (
    <div
      className={`dragbox shadow ${className}`}
      onMouseDown={onBoxMouseDown}
      style={{ position: "absolute", left: `${pos.x}px`, top: `${pos.y}px`, width: boxWidth, zIndex: z }}
    >
      <div
        className="d-flex align-items-center bg-light border-bottom px-2 py-1"
        style={{ cursor: "move", userSelect: "none", touchAction: "none" }}
        onMouseDown={onMouseDownHeader}
        onTouchStart={onTouchStartHeader}
      >
        <button
          type="button"
          className="btn btn-sm btn-outline-primary me-2"
          onClick={(e) => { e.stopPropagation(); setMinimized((m) => !m); }}
          title={minimized ? "Restore" : "Minimize"}
        >
          {minimized ? "▢" : "—"}
        </button>

        <div className="flex-grow-1 text-truncate" title={title}><strong>{title}</strong></div>

        {headerRight && (
          <div className="d-flex align-items-center me-2" onMouseDown={(e) => e.stopPropagation()}>
            {headerRight}
          </div>
        )}

        <button
          type="button"
          className="btn btn-sm btn-outline-danger"
          onClick={(e) => { e.stopPropagation(); onClose?.(); }}
          title="Close"
        >
          ×
        </button>
      </div>

      {!minimized && <div className="bg-white p-2">{children}</div>}
    </div>
  );
}

function usePrevious(value) {
  const ref = React.useRef();
  React.useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
}
