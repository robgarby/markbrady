// /Context/global.context.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';

const AppContext = createContext();

// --- Helper: persistent state synced to localStorage (for selected slices only) ---
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
      // ignore quota/serialization errors
    }
  }, [key, value]);

  return [value, setValue];
};

const defaultPatientSearch = {
  mode: 'identity',
  query: '',
  noteQuery: '',
  providerQuery: '',
  appointmentDate: '',
  results: [],
  didSearch: false,
};

export const GlobalContext = ({ children }) => {
  // --- Non-persistent (in-memory) UI/data slices ---
  const [visibleBox, setVisibleBox] = useState(null);
  const [activePatient, setActivePatient] = useState(null);
  const [clientBox, setClientBox] = useState(false);

  // Conditions master list: IN MEMORY ONLY
  const [conditionData, setConditionData] = useState([]);
  const updateConditions = (newData) => setConditionData(newData);

  // Medications master list: IN MEMORY ONLY
  // Shape: [{ name, defaultDose?, category? }, ...]
  const [medsArray, setMedsArray] = useState([]);
  const updateMedsArray = (next) =>
    setMedsArray((prev) => (typeof next === 'function' ? next(prev) : next));

  // Categories master list: IN MEMORY ONLY
  // Shape: ["No Category", "Statin", ...] — always keep "No Category" present (and first).
  const ensureNoCategoryFirst = (arr) => {
    const flat = (arr || [])
      .map((c) => (c?.name ?? c ?? '').toString().trim())
      .filter(Boolean);
    const dedup = Array.from(new Set(flat));
    return ['No Category', ...dedup.filter((c) => c !== 'No Category')];
  };

  const [medsCategory, setMedsCategory] = useState(['No Category']);
  const updateMedsCategory = (next) =>
    setMedsCategory((prev) =>
      ensureNoCategoryFirst(typeof next === 'function' ? next(prev) : next)
    );

  // --- Persistent slices (saved to localStorage) ---
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
        // UI state
        visibleBox, setVisibleBox,
        activePatient, setActivePatient,
        clientBox, setClientBox,

        // Conditions (in-memory)
        conditionData,
        updateConditions,

        // Meds (in-memory)
        medsArray,
        updateMedsArray,

        // Categories (in-memory)
        medsCategory,
        updateMedsCategory,

        // Patient search (persistent)
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
