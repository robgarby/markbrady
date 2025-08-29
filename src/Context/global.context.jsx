import React, { createContext, useState, useContext } from 'react';

const AppContext = createContext();

export const GlobalContext = ({ children }) => {
     const [visibleBox, setVisibleBox] = useState(null);
     const [activePatient, setActivePatient] = useState(null);
     const [clientBox, setClientBox] = useState(false);

     return (
          <AppContext.Provider value={{ 
               visibleBox, setVisibleBox, 
               activePatient, setActivePatient,
               clientBox,setClientBox }}>
               {children}
          </AppContext.Provider>
     );
};

export const useGlobalContext = () => useContext(AppContext);

