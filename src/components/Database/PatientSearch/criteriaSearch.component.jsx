// src/components/Labs/criteriaSearch.component.jsx
import React, { use, useEffect, useMemo, useState } from "react";
import { useGlobalContext } from "../../../Context/global.context";
import { getUserFromToken } from '../../../Context/functions';
import { useNavigate } from 'react-router-dom';

// ───────────────────────── constants / helpers ─────────────────────────
const LAB_FIELDS = [
  ["cholesterol", "Cholesterol"],
  ["triglyceride", "Triglyceride"],
  ["hdl", "HDL"],
  ["ldl", "LDL"],
  ["nonHdl", "Non-HDL"],
  ["cholesterolHdlRatio", "Chol/HDL Ratio"],
  ["creatineKinase", "Creatine Kinase"],
  ["alanineAminotransferase", "ALT"],
  ["lipoproteinA", "Lipoprotein(a)"],
  ["apolipoproteinB", "Apolipoprotein B"],
  ["natriureticPeptideB", "BNP"],
  ["urea", "Urea"],
  ["creatinine", "Creatinine"],
  ["gfr", "GFR"],
  ["albumin", "Albumin"],
  ["sodium", "Sodium"],
  ["potassium", "Potassium"],
  ["vitaminB12", "Vitamin B12"],
  ["ferritin", "Ferritin"],
  ["hemoglobinA1C", "Hemoglobin A1C"],
  ["urineAlbumin", "Urine Albumin"],
  ["albuminCreatinineRatio", "Alb/Cr Ratio"],
];

const CAT_ENDPOINT = "https://gdmt.ca/PHP/special.php";
const GET_SCRIPT = "getMedsCategory";

const LS_KEYS = {
  conds: "criteria.conditions",
  labs: "criteria.labs",
  medCats: "criteria.medCats",
  nonMedCats: "criteria.nonMedCats",
  appt: "criteria.apptDate",
};

const cleanNum = (v) => {
  const s = (v ?? "").toString().replace(/[^\d.]/g, "");
  const parts = s.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : s;
};

const readJSON = (k, fallback) => {
  try {
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

// ───────────────────────── component ─────────────────────────
const CriteriaSearch = ({ onResults }) => {
  const {
    patientSearch,
    updatePatientSearch,
    setVisibleBox,
    conditionData,
    updateConditions,
    updateConditionData,
    medsArray,
    medsCategory,
    updateMedsCategory,
  } = useGlobalContext();

  const [user, setUser] = React.useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await getUserFromToken();
      return userData;
    };
    fetchUser().then((userT) => {
      console.log({userT});
      if (userT) {
        setUser(userT);
      }
      if (!userT) {
        // If no user is found, redirect to sign-in page
        navigate('/signin');
        return;
      }
    });
  }, []);

  // ─────────────── PERSISTED UI STATE ───────────────
  const [appointmentDate, setAppointmentDate] = useState(() => {
    return localStorage.getItem(LS_KEYS.appt) || "";
  });

  // CONDITIONS
  const [condFilter, setCondFilter] = useState("");
  const [condSelect, setCondSelect] = useState("");
  const [conditionSearchArray, setConditionSearchArray] = useState(() =>
    readJSON(LS_KEYS.conds, [])
  );
  const [condLoading, setCondLoading] = useState(false);
  const [condErr, setCondErr] = useState("");

  // LABS
  const [labSelect, setLabSelect] = useState("");
  const [labs, setLabs] = useState(() => readJSON(LS_KEYS.labs, []));
  const [labErr, setLabErr] = useState("");
  const [labLoading, setLabLoading] = useState(false);

  // MED CATS
  const medsMaster = Array.isArray(medsArray) ? medsArray : [];
  const [medSelect, setMedSelect] = useState("");
  const [meds, setMeds] = useState([]); // kept for compatibility
  const [medErr, setMedErr] = useState("");
  const [medLoading, setMedLoading] = useState(false);
  const [catSearchArray, setCatSearchArray] = useState(() =>
    readJSON(LS_KEYS.medCats, [])
  );

  // NOT‑ON MED CATS
  const [nonMedSelect, setNonMedSelect] = useState("");
  const [nonMedCatSearchArray, setNonMedCatSearchArray] = useState(() =>
    readJSON(LS_KEYS.nonMedCats, [])
  );
  const [nonMedErr, setNonMedErr] = useState("");
  const [nonMedLoading, setNonMedLoading] = useState(false);

  // Hydration guard
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Persist
  useEffect(() => { if (hydrated) localStorage.setItem(LS_KEYS.conds, JSON.stringify(conditionSearchArray)); }, [conditionSearchArray, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(LS_KEYS.labs, JSON.stringify(labs)); }, [labs, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(LS_KEYS.medCats, JSON.stringify(catSearchArray)); }, [catSearchArray, hydrated]);
  useEffect(() => { if (hydrated) localStorage.setItem(LS_KEYS.nonMedCats, JSON.stringify(nonMedCatSearchArray)); }, [nonMedCatSearchArray, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    if (appointmentDate) localStorage.setItem(LS_KEYS.appt, appointmentDate);
    else localStorage.removeItem(LS_KEYS.appt);
  }, [appointmentDate, hydrated]);

  // Load meds categories
  useEffect(() => {
    if (!Array.isArray(medsCategory) || medsCategory.length === 0) {
      (async () => {
        try {
          const res = await fetch(CAT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ script: GET_SCRIPT }),
          });
          const text = await res.text();
          let data = null;
          try { data = JSON.parse(text); } catch { }
          if (typeof updateMedsCategory === "function") updateMedsCategory(data);
        } catch (e) { console.error(e); }
      })();
    }
  }, [medsCategory, updateMedsCategory]);

  // Load condition master
  useEffect(() => {
    const needsLoad = !Array.isArray(conditionData) || conditionData.length === 0;
    const setConditions =
      typeof updateConditions === "function"
        ? updateConditions
        : typeof updateConditionData === "function"
          ? updateConditionData
          : null;
    if (!needsLoad || !setConditions) return;

    fetch("https://gdmt.ca/PHP/noDB.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: "getConditionData" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.conditions)) setConditions(data.conditions);
        else if (Array.isArray(data)) setConditions(data);
      })
      .catch(() => { });
  }, [conditionData, updateConditions, updateConditionData]);

  const allConditions = useMemo(() => {
    if (Array.isArray(conditionData)) return conditionData;
    if (conditionData && typeof conditionData === "object") return Object.values(conditionData);
    return [];
  }, [conditionData]);

  // Options
  const filteredConditions = useMemo(() => {
    const q = condFilter.trim().toLowerCase();
    const src = allConditions.map((c) => ({
      code: String(c?.conditionCode ?? c?.code ?? "").toUpperCase(),
      label: String(c?.conditionName ?? c?.name ?? ""),
      id: String(c?.ID ?? c?.id ?? c?.conditionID ?? ""),
    }));
    if (!q) return src;
    return src.filter((c) => c.label.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [allConditions, condFilter]);

  const normalizedConditions = useMemo(
    () => filteredConditions.map((c) => {
      const code = (c.code || "").trim().toUpperCase();
      const label = (c.label || "").trim();
      const value = code || label;
      return { value, code, label, id: c.id };
    }),
    [filteredConditions]
  );

  const displayConds = useMemo(
    () =>
      (Array.isArray(conditionSearchArray) ? conditionSearchArray : []).map((c) => ({
        id: String(c?.ID ?? ""),
        name: String(c?.condition_name ?? ""),
        code: String(c?.condition_code ?? "").toUpperCase(),
      })),
    [conditionSearchArray]
  );

  // Condition handlers
  const addCondition = (val) => {
    const selectedVal = (typeof val === "string" ? val : "") || condSelect;
    if (!selectedVal) return;

    const chosen =
      normalizedConditions.find((c) => c.value === selectedVal) || {
        value: selectedVal,
        code: selectedVal.toUpperCase(),
        label: selectedVal,
        id: "",
      };

    const exists = displayConds.some((c) =>
      chosen.code ? c.code === chosen.code : c.name === chosen.label
    );
    if (exists) return;

    setConditionSearchArray((prev) => [
      ...prev,
      { ID: String(chosen.id || ""), condition_name: chosen.label, condition_code: chosen.code || "" },
    ]);
    setCondSelect("");
  };

  const clearConditions = () => {
    setCondFilter("");
    setCondSelect("");
    setConditionSearchArray([]);
    setCondErr("");
  };

  // const handleConditionSearch = async () => {
  //   const items = displayConds;
  //   if (!items.length) { setCondErr("Add at least one condition."); return; }
  //   const codes = items.map((x) => x.code).filter(Boolean);
  //   const labels = items.map((x) => x.name).filter(Boolean);

  //   setCondLoading(true); setCondErr("");
  //   try {
  //     const res = await fetch("https://gdmt.ca/PHP/database.php", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ script: "conditionSearch", codes, labels }),
  //     });
  //     const text = await res.text();
  //     let data; try { data = JSON.parse(text); } catch { data = []; }

  //     onResults?.(data);
  //     updatePatientSearch?.({
  //       ...(patientSearch || {}),
  //       didSearch: true,
  //       mode: "condition",
  //       conditionCodes: codes,
  //       results: Array.isArray(data) ? data : [],
  //     });
  //     setVisibleBox?.("searchResults");
  //   } catch (e) {
  //     setCondErr("Condition search failed. Check console.");
  //     updatePatientSearch?.({
  //       ...(patientSearch || {}),
  //       didSearch: true,
  //       mode: "condition",
  //       conditionCodes: [],
  //       results: [],
  //     });
  //     setVisibleBox?.("searchResults");
  //   } finally {
  //     setCondLoading(false);
  //   }
  // };

  // Labs
  
  const addLab = (field) => {
    const key = String(field || "");
    if (!key || labs.some((r) => r.field === key)) return;
    setLabs((prev) => [...prev, { field: key, gt: "", lt: "" }]);
  };

  const updateLabBound = (idx, bound, val) => {
    setLabs((prev) => prev.map((r, i) => (i === idx ? { ...r, [bound]: cleanNum(val) } : r)));
  };

  const removeLab = (idx) => setLabs((prev) => prev.filter((_, i) => i !== idx));
  const clearLabs = () => { setLabSelect(""); setLabs([]); setLabErr(""); };

  // const handleLabSearch = async () => {
  //   const labsWithDefaults = labs.map((r) => ({
  //     ...r,
  //     gt: String(r.gt).trim() === "" ? -1 : r.gt,
  //     lt: String(r.lt).trim() === "" ? 10000 : r.lt,
  //   }));
  //   const invalid = labsWithDefaults.find((r) => r.gt === -1 && r.lt === 10000);
  //   if (invalid) { setLabErr("Each lab needs at least one value."); return; }

  //   const filters = {};
  //   for (const r of labsWithDefaults) filters[r.field] = { gt: parseFloat(r.gt), lt: parseFloat(r.lt) };

  //   setLabLoading(true); setLabErr("");
  //   try {
  //     const res = await fetch("https://gdmt.ca/PHP/database.php", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ script: "labRangeSearch", filters }),
  //     });
  //     const text = await res.text();
  //     let data; try { data = JSON.parse(text); } catch { data = []; }

  //     onResults?.(data);
  //     updatePatientSearch?.({
  //       ...(patientSearch || {}),
  //       didSearch: true,
  //       mode: "labs",
  //       labFilters: filters,
  //       results: Array.isArray(data) ? data : [],
  //     });
  //     setVisibleBox?.("searchResults");
  //   } catch (e) {
  //     setLabErr("Lab search failed. Check console.");
  //     updatePatientSearch?.({
  //       ...(patientSearch || {}),
  //       didSearch: true,
  //       mode: "labs",
  //       labFilters: {},
  //       results: [],
  //     });
  //     setVisibleBox?.("searchResults");
  //   } finally {
  //     setLabLoading(false);
  //   }
  // };

  // Med Category (ON)

  const addMed = (val) => {
    const selectedMed = Array.isArray(medsCategory)
      ? medsCategory.find((m) => String(m.ID ?? m.id ?? "") === String(val))
      : null;
    if (!selectedMed) return;
    const id = String(selectedMed.ID ?? selectedMed.id ?? "");
    const exists = catSearchArray.some((c) => String(c.ID) === id);
    if (!exists) {
      setCatSearchArray((prev) => [...prev, { ID: id, medication_cat: selectedMed.medication_cat }]);
    }
    setMedSelect("");
  };
  const clearMeds = () => { setCatSearchArray([]); setMedSelect(""); setMeds([]); setMedErr(""); };

  // const handleMedSearch = async () => {
  //   if (!catSearchArray.length) { setMedErr("Add at least one medication."); return; }
  //   const ids = catSearchArray.map((m) => m.ID);
  //   setMedLoading(true); setMedErr("");
  //   try {
  //     const res = await fetch("https://gdmt.ca/PHP/special.php", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ script: "medicationSearchByIds", ids }),
  //     });
  //     const text = await res.text();
  //     let data; try { data = JSON.parse(text); } catch { data = []; }

  //     onResults?.(data);
  //     updatePatientSearch?.({
  //       ...(patientSearch || {}),
  //       didSearch: true,
  //       mode: "medications",
  //       meds: ids,
  //       results: Array.isArray(data) ? data : [],
  //     });
  //     setVisibleBox?.("searchResults");
  //   } catch (e) {
  //     setMedErr("Medication search failed. Check console.");
  //     updatePatientSearch?.({
  //       ...(patientSearch || {}),
  //       didSearch: true,
  //       mode: "medications",
  //       meds: [],
  //       results: [],
  //     });
  //     setVisibleBox?.("searchResults");
  //   } finally { setMedLoading(false); }
  // };

  // Not-on Med Category (OFF)
  const addNonMed = (val) => {
    const selected = Array.isArray(medsCategory)
      ? medsCategory.find((m) => String(m.ID ?? m.id ?? "") === String(val))
      : null;
    if (!selected) return;
    const id = String(selected.ID ?? selected.id ?? "");
    if (nonMedCatSearchArray.some((c) => String(c.ID) === id)) return;
    setNonMedCatSearchArray((prev) => [...prev, { ID: id, medication_cat: selected.medication_cat }]);
    setNonMedSelect("");
  };
  const clearNonMeds = () => { setNonMedCatSearchArray([]); setNonMedSelect(""); setNonMedErr(""); };

  // const handleNonMedSearch = async () => {
  //   if (!nonMedCatSearchArray.length) { setNonMedErr("Add at least one medication category to exclude."); return; }
  //   const ids = nonMedCatSearchArray.map((m) => m.ID);
  //   setNonMedLoading(true); setNonMedErr("");
  //   try {
  //     const res = await fetch("https://gdmt.ca/PHP/special.php", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ script: "notOnMedicationByCategoryIds", ids }),
  //     });
  //     const text = await res.text();
  //     let data; try { data = JSON.parse(text); } catch { data = []; }

  //     onResults?.(data);
  //     updatePatientSearch?.({
  //       ...(patientSearch || {}),
  //       didSearch: true,
  //       mode: "not-on-meds",
  //       nonMedCats: ids,
  //       results: Array.isArray(data) ? data : [],
  //     });
  //     setVisibleBox?.("searchResults");
  //   } catch (e) {
  //     setNonMedErr("Not-on-medication search failed. Check console.");
  //     updatePatientSearch?.({
  //       ...(patientSearch || {}),
  //       didSearch: true,
  //       mode: "not-on-meds",
  //       nonMedCats: [],
  //       results: [],
  //     });
  //     setVisibleBox?.("searchResults");
  //   } finally { setNonMedLoading(false); }
  // };

  // ─────────────── SUPER SEARCH ───────────────
  const [superLoading, setSuperLoading] = useState(false);

  const handleSuperSearch = async () => {
    const conditionCodes = displayConds.map((x) => x.code).filter(Boolean);

    // Only send labs that have at least one bound filled
    const labsPayload = labs.map((r) => ({
      field: r.field,
      gt: String(r.gt ?? "").trim(),
      lt: String(r.lt ?? "").trim(),
    }));

    const medCategoryIds = catSearchArray.map((m) => m.ID);
    const nonMedCategoryIds = nonMedCatSearchArray.map((m) => m.ID);

    setSuperLoading(true);
    try {
      const res = await fetch("https://gdmt.ca/PHP/supersearch.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "superSearch",
          labs: labsPayload,
          conditionCodes,
          appointmentDate,
          medCategoryIds,        // ✅ on-meds
          nonMedCategoryIds,
          patientDB: user?.patientTable || "Patient",
          historyDB: user?.historyTable || "Patient_History"
        }),
      });
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { data = []; }

      onResults?.(data);
      updatePatientSearch?.({
        ...(patientSearch || {}),
        didSearch: true,
        mode: "super",
        results: Array.isArray(data) ? data : [],
      });
      setVisibleBox?.("searchResults");
    } catch (e) {
      console.error("Super Search failed:", e);
      updatePatientSearch?.({
        ...(patientSearch || {}),
        didSearch: true,
        mode: "super",
        results: [],
      });
      setVisibleBox?.("searchResults");
    } finally {
      setSuperLoading(false);
    }
  };

  const clearAll = () => {
    clearConditions();
    clearLabs();
    clearMeds();
    clearNonMeds();
    setAppointmentDate("");
  };

  const hasOn = Array.isArray(catSearchArray) && catSearchArray.length > 0;
  const hasNot = Array.isArray(nonMedCatSearchArray) && nonMedCatSearchArray.length > 0;

  // ─────────────── UI ───────────────
  return (
    <div className="p-2">
      <div className="row g-2">
        {/* LEFT: Builders */}
        <div className="col-32">
          {/* Extra Search Details */}
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h5 className="m-0 ps-4">Extra Search Details</h5>
            <div className="d-flex gap-2 align-items-center">
              <label htmlFor="AppointmentDate" className="me-2 mb-0">Appointment Date:</label>
              <input
                type="date"
                id="AppointmentDate"
                className="form-control form-control-sm"
                style={{ width: 180 }}
                value={appointmentDate}
                onChange={(e) => setAppointmentDate(e.target.value)}
              />
              <button className="btn btn-danger" onClick={() => setAppointmentDate("")} disabled={superLoading}>
                Clear Date
              </button>
            </div>
            <div className="text-center alert-warning">
              <select className="form-select form-select-sm" disabled>
                <option value="">Provider (Coming Soon)</option>
              </select>
            </div>
          </div>

          {/* Condition Search */}
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h5 className="m-0 ps-4">Condition Search</h5>
            <div className="d-flex gap-2">
              <button className="btn btn-danger" onClick={clearConditions} disabled={condLoading}>
                Clear
              </button>
            </div>
          </div>
          {condErr && <div className="alert alert-danger py-1">{condErr}</div>}

          <div className="border rounded p-2 mb-3">
            <div className="row g-2 align-items-end mb-2">
              <div className="col-20">
                <select
                  className="form-select form-select-sm"
                  value={condSelect}
                  onChange={(e) => addCondition(e.target.value)}
                >
                  <option value="">— Choose a condition —</option>
                  {normalizedConditions.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}{c.code ? ` (${c.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border rounded p-2">
              {displayConds.length === 0 ? (
                <div className="text-muted small"><em>No conditions added.</em></div>
              ) : (
                <div className="row row-cols-4 g-2">
                  {conditionSearchArray.map((c, i) => (
                    <div key={i} className="col">
                      <div className="text-start p-1 fw-bold text-navy border-bottom border-navy border-2">
                        <span>{c.condition_name}</span>
                        {c.condition_code ? <span>{` (${c.condition_code})`}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Lab Search */}
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h5 className="m-0 ps-4">Lab Search</h5>
            <div className="d-flex gap-2">
              <button className="btn btn-danger" onClick={clearLabs} disabled={labLoading}>
                Clear
              </button>
            </div>
          </div>
          {labErr && <div className="alert alert-danger py-1">{labErr}</div>}

          <div className="border rounded p-2 mb-3">
            <div className="row g-2 align-items-end mb-2">
              <div className="col-20">
                <select
                  className="form-select form-select-sm"
                  value={labSelect}
                  onChange={(e) => {
                    setLabSelect(e.target.value);
                    if (e.target.value) addLab(e.target.value);
                  }}
                >
                  <option value="">— Choose a lab —</option>
                  {LAB_FIELDS.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="border rounded p-2">
              {labs.length === 0 ? (
                <div className="text-muted small"><em>No labs added.</em></div>
              ) : (
                <div className="row g-2">
                  {labs.map((r, i) => {
                    const label = LAB_FIELDS.find(([k]) => k === r.field)?.[1] || r.field;
                    return (
                      <div key={`${r.field}_${i}`} className="col-24">
                        <div className="border rounded p-2 d-flex align-items-center gap-2">
                          <div className="text-purple fw-bold flex-grow-1">{`Search Lab ${i + 1}: ${label}`}</div>
                          <div className="d-flex align-items-center gap-2">
                            <span className="text-danger fw-bold">&gt;</span>
                            <input
                              className={`form-control form-control-sm ${r.gt ? "alert-success" : ""}`}
                              placeholder="min"
                              value={r.gt}
                              onChange={(e) => updateLabBound(i, "gt", e.target.value)}
                              style={{ width: 90 }}
                              inputMode="decimal"
                            />
                            <span className="text-danger fw-bold">&lt;</span>
                            <input
                              className={`form-control form-control-sm ${r.lt ? "alert-success" : ""}`}
                              placeholder="max"
                              value={r.lt}
                              onChange={(e) => updateLabBound(i, "lt", e.target.value)}
                              style={{ width: 90 }}
                              inputMode="decimal"
                            />
                            <button className="btn btn-sm btn-outline-danger" onClick={() => removeLab(i)}>
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Medication Category Search (ON) */}
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h5 className="m-0 ps-4">Medication Category Search</h5>
            <div className="d-flex gap-2">
              <button className="btn btn-danger" onClick={clearMeds} disabled={medLoading}>
                Clear
              </button>
            </div>
          </div>
          {medErr && <div className="alert alert-danger py-1">{medErr}</div>}

          <div className="border rounded p-2 mb-3">
            <div className="row g-2 align-items-end mb-2">
              <div className="col-24 col-md-20">
                <select
                  className="form-select form-select-sm"
                  value={medSelect}
                  onChange={(e) => addMed(e.target.value)}
                >
                  <option value="">— Choose a medication category —</option>
                  {Array.isArray(medsCategory) && medsCategory.length > 0
                    ? medsCategory.map((m) => {
                      const id = String(m?.ID ?? m?.id ?? "");
                      const label = String(m?.medication_cat);
                      return <option key={id} value={id}>{label}</option>;
                    })
                    : null}
                </select>
              </div>
            </div>

            <div className="border rounded p-2">
              {catSearchArray.length === 0 ? (
                <div className="text-muted small"><em>No medication categories added.</em></div>
              ) : (
                <div className="row row-cols-4 g-2">
                  {catSearchArray.map((c, i) => (
                    <div key={c.ID ?? i} className="col">
                      <div className="text-start p-1 text-purple fw-bold">
                        <span>{c.medication_cat}</span>{c.ID ? <span>{` (#${c.ID})`}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Not on Medication Search (OFF) */}
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h5 className="m-0 ps-4 text-danger mt-3 mb-1">Not on Medication Search</h5>
            <div className="d-flex gap-2">
              <button className="btn btn-danger" onClick={clearNonMeds} disabled={nonMedLoading}>
                Clear
              </button>
            </div>
          </div>
          {nonMedErr && <div className="alert alert-danger py-1">{nonMedErr}</div>}

          <div className="border rounded p-2">
            <div className="row g-2 align-items-end mb-2">
              <div className="col-24 col-md-20">
                <select
                  className="form-select form-select-sm"
                  value={nonMedSelect}
                  onChange={(e) => addNonMed(e.target.value)}
                >
                  <option value="">— Choose a medication category —</option>
                  {Array.isArray(medsCategory) && medsCategory.length > 0
                    ? medsCategory.map((m) => {
                      const id = String(m?.ID ?? m?.id ?? "");
                      const label = String(m?.medication_cat);
                      return <option key={id} value={id}>{label}</option>;
                    })
                    : null}
                </select>
              </div>
            </div>

            <div className="border rounded p-2">
              {nonMedCatSearchArray.length === 0 ? (
                <div className="text-muted small"><em>No categories selected.</em></div>
              ) : (
                <div className="row row-cols-4 g-2">
                  {nonMedCatSearchArray.map((c, i) => (
                    <div key={c.ID ?? i} className="col">
                      <div className="text-start p-1 text-purple fw-bold">
                        <span>{c.medication_cat}</span>{c.ID ? <span>{` (#${c.ID})`}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT: Super Search Mirror */}
        <div className="col-16">
          <div className="border rounded p-3 h-100">
            <div className="d-flex align-items-center justify-content-between">
              <h5 className="m-0">Super Search</h5>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" onClick={clearAll}>
                  Clear All
                </button>
                <button
                  className="btn btn-primary btn-sm text-white"
                  onClick={handleSuperSearch}
                  disabled={false}
                  title="Runs one query using all selected criteria"
                >
                  {superLoading ? "Super Searching…" : "Run Super Search"}
                </button>
              </div>
            </div>

            {/* Summary mirror */}
            <div className="mt-3">
              <div className="mb-2">
                <div className="fw-semibold small text-primary fw-bold">Appointment Date</div>
                <div className="alert alert-light py-2 mb-0">
                  {appointmentDate ? appointmentDate : <em>None selected</em>}
                </div>
              </div>

              <div className="mb-2">
                <div className="fw-semibold small text-primary fw-bold">Conditions</div>
                {displayConds.length ? (
                  <ul className="mb-0">
                    {displayConds.map((c, i) => (
                      <li key={i}>
                        {c.name}{c.code ? ` (${c.code})` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted small"><em>No conditions selected</em></div>
                )}
              </div>

              <div className="mb-2">
                <div className="fw-semibold small text-primary fw-bold">Lab Ranges</div>
                {labs.length ? (
                  <ul className="mb-0">
                    {labs.map((r, i) => {
                      const label = LAB_FIELDS.find(([k]) => k === r.field)?.[1] || r.field;
                      const min = String(r.gt ?? "").trim();
                      const max = String(r.lt ?? "").trim();
                      const parts = [];
                      if (min) parts.push(`>${min}`);
                      if (max) parts.push(`<${max}`);
                      return (
                        <li key={`${r.field}-${i}`}>
                          {label}: {parts.length ? parts.join(" & ") : "—"}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="text-muted small"><em>No labs selected</em></div>
                )}
              </div>

              {/* ✅ Always show both ON and OFF medication selections — no restriction */}
              <div className="mb-2">
                <div className="fw-semibold small text-primary fw-bold">On Medication</div>
                {hasOn ? (
                  <ul className="mb-0">
                    {catSearchArray.map((c, i) => (
                      <li key={c?.ID ?? `on-${i}`}>
                        {c?.medication_cat}{c?.ID ? ` (#${c.ID})` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted small"><em>No Medications selected</em></div>
                )}
              </div>

              <div className="mb-2">
                <div className="fw-semibold small text-danger fw-bold">NOT On Medications</div>
                {hasNot ? (
                  <ul className="mb-0">
                    {nonMedCatSearchArray.map((c, i) => (
                      <li key={c?.ID ?? `not-${i}`}>
                        {c?.medication_cat}{c?.ID ? ` (#${c.ID})` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-muted small"><em>No Non Medications selected</em></div>
                )}
              </div>
              {/* End summary mirror */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CriteriaSearch;
