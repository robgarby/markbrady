import React, { createContext, useContext, useState, useCallback } from "react";

const ZStackContext = createContext({ topKey: null, bringToFront: () => {} });

export const useZStack = () => useContext(ZStackContext);

export const ZStackProvider = ({ children }) => {
  const [topKey, setTopKey] = useState(null);
  const bringToFront = useCallback((key) => setTopKey(key), []);
  return (
    <ZStackContext.Provider value={{ topKey, bringToFront }}>
      {children}
    </ZStackContext.Provider>
  );
};
