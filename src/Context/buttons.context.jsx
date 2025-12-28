// /Context/global.context.jsx
import React, { createContext, useContext, useMemo, useState } from "react";

const ButtonsContext = createContext(null);

export const AllButtonsProvider = ({ children }) => {
  // const [navBarButtons, setNavBarButtons] = useState([]);
  const [sideBarButtons, setSideBarButtons] = useState([]);
  // const [theUser, setTheUser] = useState([]);

  const value = useMemo(
    () => ({ 
      sideBarButtons, 
      setSideBarButtons }),
    [sideBarButtons]
  );

  return <ButtonsContext.Provider value={value}>{children}</ButtonsContext.Provider>;
};

export const useButtonContext = () => {
  const ctx = useContext(ButtonsContext);
  if (!ctx) {
    throw new Error("useButtonContext must be used within <AllButtonsProvider>");
  }
  return ctx;
};
