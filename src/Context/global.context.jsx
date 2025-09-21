// /Context/global.context.jsx
import React, { createContext, useContext, useEffect, useState } from "react";

const AppContext = createContext();

// Persist a slice to localStorage
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
    } catch {}
  }, [key, value]);
  return [value, setValue];
};

// Default shape for patient search (matches component usage)
const defaultPatientSearch = {
  mode: "identity",
  query: "",
  noteQuery: "",
  privateNoteQuery: "",
  providerQuery: "",
  appointmentDate: "",
  results: [],
  didSearch: false,
};

export const GlobalContext = ({ children }) => {
  // --- Core UI ---
  const [visibleBox, setVisibleBox] = useState(null);       // e.g., "searchResults", "meds", "conditions"
  const [activePatient, setActivePatient] = useState(null); // selected patient object or null
  const [clientBox, setClientBox] = useState(false);        // toggles client panel visibility

  // --- Medications master data ---
  const [medsArray, setMedsArray] = useState([]); // [{ ID, medication, medication_cat, medication_dose }, ...]
  const updateMedsArray = (next) =>
    setMedsArray((prev) => (typeof next === "function" ? next(prev) : next));

  // --- Medication categories (INIT = []) ---
  const [medsCategory, setMedsCategory] = useState([]); // [{ ID, medication_cat }, ...] or []
  const updateMedsCategory = (next) =>
    setMedsCategory((prev) => (typeof next === "function" ? next(prev) : next));

  // --- Conditions data ---
  const [conditionData, setConditionData] = useState([]); // [{ id|ID, code|conditionCode, name|conditionName, category }, ...]
  // Keep existing name
  const updateConditionData = (next) =>
    setConditionData((prev) => (typeof next === "function" ? next(prev) : next));
  // Alias expected by some components (PatientConditionsBox / ConditionAdminPanel)
  const updateConditions = (next) =>
    setConditionData((prev) => (typeof next === "function" ? next(prev) : next));

  // --- Patient search (persisted) ---
  const [patientSearch, setPatientSearch] = usePersistentState(
    "gc.patientSearch",
    defaultPatientSearch
  );
  // Merge-style updater for convenience in handlers
  const updatePatientSearch = (patch) =>
    setPatientSearch((prev) => ({ ...prev, ...(patch || {}) }));
  const clearPatientSearch = () => setPatientSearch(defaultPatientSearch);

  // --- Misc (persisted) ---
  const [privateMode, setPrivateMode] = usePersistentState("gc.privateMode", false);
  const updatePrivateMode = (v) =>
    setPrivateMode(typeof v === "function" ? v(privateMode) : v);

  return (
    <AppContext.Provider
      value={{
        // Core UI
        visibleBox,
        setVisibleBox,
        activePatient,
        setActivePatient,
        clientBox,
        setClientBox,

        // Meds & categories
        medsArray,
        updateMedsArray,
        medsCategory,
        updateMedsCategory,

        // Conditions
        conditionData,
        updateConditions,     // ← alias added
        updateConditionData,  // ← original name kept

        // Patient search
        patientSearch,
        setPatientSearch,     // replace wholesale if needed
        updatePatientSearch,  // merge helper used by components
        clearPatientSearch,

        // Misc
        privateMode,
        updatePrivateMode,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useGlobalContext = () => useContext(AppContext);
