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
  const [visibleBox, setVisibleBox] = useState("search");       // e.g., "searchResults", "meds", "conditions"
  const [activePatient, setActivePatient] = useState(null); // selected patient object or null
  const [clientBox, setClientBox] = useState(false);        // toggles client panel visibility
  const [patientProvider, setPatientProvider] = useState(''); // Provider category for Patient - Field in Patient is providerSort
  const [patientArray, setPatientArray] = useState([]); 
  const [displayMain, setDisplayMain] = useState(false); 
  const [mainButton, setMainButton] = useState(null); // The main button that was pressed

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

  const [selectedTopButtons, setSelectedTopButtons] = usePersistentState("gc.selectedTopButtons", []);


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
        patientArray,  // this is the list of all found patients
        setPatientArray,
        selectedTopButtons, // this is the navigation bar buttons as what is selected
        setSelectedTopButtons, 

        displayMain ,  // This is the value that changes when Labs are pressed
        setDisplayMain,
        mainButton ,
        setMainButton, // This is the Actual Button Pressed to switch to Main

        // Meds & categories
        medsArray,
        updateMedsArray, // Medicine array
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
        privateMode,  // use to mask hcn and names
        updatePrivateMode,

        patientProvider, // Category for Database - Field in Patient is providerSort
        setPatientProvider, // set the Provider category - Field in Patient is providerSort
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useGlobalContext = () => useContext(AppContext);
