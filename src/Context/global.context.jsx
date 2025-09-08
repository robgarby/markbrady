import React, { createContext, useState, useContext, useEffect } from 'react';

const AppContext = createContext();

// --- Helper: persistent state synced to localStorage ---
const usePersistentState = (key, initialValue) => {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota or serialization errors
    }
  }, [key, value]);

  return [value, setValue];
};

// Default shape for the Patient Search slice
const defaultPatientSearch = {
  mode: 'identity',        // 'identity' | 'notes' | 'provider'
  query: '',
  noteQuery: '',
  providerQuery: '',
  appointmentDate: '',
  results: [],
  didSearch: false,
};

export const GlobalContext = ({ children }) => {
  // --- your existing, non-persistent UI slices ---
  const [visibleBox, setVisibleBox] = useState(null);
  const [activePatient, setActivePatient] = useState(null);
  const [clientBox, setClientBox] = useState(false);
  const [conditionData, setConditionData] = useState([]); // 👈 Only in memory

  const updateConditions = (newData) => {
    setConditionData(newData);
  };

  // --- persistent slices ---
  const [patientSearch, setPatientSearch] = usePersistentState(
    'patientSearch',
    defaultPatientSearch
  );

  const updatePatientSearch = (patch) =>
    setPatientSearch((prev) => ({ ...prev, ...patch }));

  const clearPatientSearch = () => setPatientSearch(defaultPatientSearch);

  return (
    <AppContext.Provider
      value={{
        // existing
        visibleBox, setVisibleBox,
        activePatient, setActivePatient,
        clientBox, setClientBox,

        // new: in-memory condition data
        conditionData,
        updateConditions,

        // patient search context
        patientSearch,
        updatePatientSearch,
        clearPatientSearch,
        setPatientSearch,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useGlobalContext = () => useContext(AppContext);
