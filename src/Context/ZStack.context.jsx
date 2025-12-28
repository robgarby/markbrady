// ZStack.context.jsx (minimal API)
import React, { createContext, useContext, useRef } from "react";
const ZCtx = createContext(null);

export const ZStackProvider = ({ children, base = 500 }) => {
  const topRef = useRef(base);
  const zmap = useRef(new Map()); // id -> z

  const bringToFront = (id) => {
    const next = ++topRef.current;
    zmap.current.set(id, next);
    return next;
  };
  const getZ = (id) => zmap.current.get(id) ?? base;

  return <ZCtx.Provider value={{ bringToFront, getZ }}>{children}</ZCtx.Provider>;
};

export const useZStack = () => useContext(ZCtx);
