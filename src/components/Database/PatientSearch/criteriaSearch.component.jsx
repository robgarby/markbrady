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
    patientProvider,
    setPatientArray
  } = useGlobalContext();

  const [user, setUser] = React.useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await getUserFromToken();
      return userData;
    };
    fetchUser().then((userT) => {
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

  // Provider ID
  const [providerId, setProviderID] = useState(null);

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

  // ─────────────── SUPER SEARCH ───────────────
  const [superLoading, setSuperLoading] = useState(false);

  const handleSuperSearch = async () => {
    setPatientArray([])
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
          providerId,
          nonMedCategoryIds,
          patientDB: user?.patientTable || "Patient",
          historyDB: user?.historyTable || "Patient_History"
        }),
      });
      const text = await res.text();
      let data; try { data = JSON.parse(text); } catch { data = []; }

      onResults?.(data);
      setPatientArray?.(Array.isArray(data) ? data : []);
      updatePatientSearch?.({
        ...(patientSearch || {}),
        didSearch: true,
        mode: "super",
        results: Array.isArray(data) ? data : [],
      });
      setVisibleBox?.("results");
    } catch (e) {
      console.error("Super Search failed:", e);
      updatePatientSearch?.({
        ...(patientSearch || {}),
        didSearch: true,
        mode: "super",
        results: [],
      });
      setVisibleBox?.("results");
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
    setProviderID(null);
  };

  const hasOn = Array.isArray(catSearchArray) && catSearchArray.length > 0;
  const hasNot = Array.isArray(nonMedCatSearchArray) && nonMedCatSearchArray.length > 0;

  // ─────────────── UI ───────────────
  return (
    <div className="p-2">
      <div className="col-48">
        <div className="d-flex align-items-center justify-content-between">
          <h5 className="m-0">Super Search</h5>
          <div className="d-flex gap-2">
            <button className="btn btn-outline-danger btn-sm" onClick={clearAll}>
              Clear All
            </button>
            <button
              className="btn btn-success btn-sm text-white"
              onClick={handleSuperSearch}
              disabled={false}
              title="Runs one query using all selected criteria"
            >
              {superLoading ? "Super Searching…" : "Run Super Search"}
            </button>
          </div>
        </div>
      </div>

      {/* Extra Search Details — horizontal layout for the four columns */}
      <div className="col-48 border rounded p-3 mt-3">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <div className="d-flex gap-2 align-items-center col-25">
            <label htmlFor="AppointmentDate" className="me-2 mb-0">Appointment Date:</label>
            <input
              type="date"
              id="AppointmentDate"
              className="form-control form-control-sm"
              style={{ width: 180 }}
              value={appointmentDate}
              onChange={(e) => setAppointmentDate(e.target.value)}
            />
            <button className="btn btn-outline-danger" onClick={() => setAppointmentDate("")} disabled={superLoading}>
              Clear Date
            </button>
          </div>
          <div className="flex-grow-1  d-flex align-items-center justify-content-center gap-2 rounded">
            <div className={`col-22 text-end`}>Choose Provider</div>
            <div className="col-24">
              <select
                className={`form-select fs-7 ${providerId !== null ? 'alert-success' : ''}`}
                value={providerId ?? ""}
                onChange={(e) => {
                  const val = e.target.value || null; // "" -> null
                  setProviderID(val);
                }}
              >
                <option value="">Select Provider</option>
                {Array.isArray(patientProvider) && patientProvider.map((p) => {
                  const id = p?.id != null ? String(p.id) : "";
                  const label = String(p?.providerName ?? p?.name ?? p?.displayName ?? id);
                  return (
                    <option key={id || label} value={id}>
                      {label}
                    </option>
                  );
                })}
              </select>

            </div>
          </div>
        </div>

        {/* Four-column horizontal layout */}
        <div className="row g-1">
          {/* Conditions */}
          <div className="col-11 p-0">
            <div className="d-flex align-items-center justify-content-between mb-2 ps-3 pe-2">
              <h6 className="m-0">Conditions</h6>
              <button className="btn btn-sm btn-outline-danger" onClick={clearConditions} disabled={condLoading}>
                Clear
              </button>
            </div>
            {condErr &&
              <div className="alert alert-danger py-1">{condErr}</div>}
            <div className="p-2">
              <select
                className="form-select form-select-sm mb-2"
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

              {displayConds.length === 0 ? (
                <div className="text-muted small"><em>No conditions added.</em></div>
              ) : (
                <div className="row row-cols-1 g-2">
                  {conditionSearchArray.map((c, i) => (
                    <div key={i} className="col">
                      <div className="text-start ps-1 text-purple border-bottom border-navy border-1 fs-6" style={{ height: "50px", lineHeight: "50px" }}>
                        <span className="text-truncate fs-7">{c.condition_name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Lab Ranges */}
          <div className="col-17">
            <div className="d-flex align-items-center justify-content-between mb-2 ps-3 pe-2">
              <h6 className="m-0">Lab Ranges</h6>
              <button className="btn btn-sm btn-outline-danger" onClick={clearLabs} disabled={labLoading}>
                Clear
              </button>
            </div>
            {labErr &&
              <div className="py-1">{labErr}</div>}
            <div className="p-2">
              <select
                className="form-select form-select-sm mb-2"
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

              {labs.length === 0 ? (
                <div className="text-muted small"><em>No labs added.</em></div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {labs.map((r, i) => {
                    const label = LAB_FIELDS.find(([k]) => k === r.field)?.[1] || r.field;
                    return (
                      <div key={`${r.field}_${i}`} className="d-flex align-items-center border-bottom border-secondary" style={{ height: "50px", lineHeight: "50px" }}>
                        <div className="text-purple fs-7 col-20 overflow-hidden">{`${label}`}</div>
                        <div className="d-flex align-items-center gap-2 flex-grow-1">

                          <div className="col-16">
                            <input
                              className={`form-control form-control-sm ${r.gt ? "alert-success" : ""}`}
                              placeholder="min"
                              value={r.gt}
                              onChange={(e) => updateLabBound(i, "gt", e.target.value)}
                              style={{ width: 90 }}
                              inputMode="decimal"
                            />
                          </div>
                          <div className="col-16 ps-1">
                            <input
                              className={`form-control form-control-sm ${r.lt ? "alert-success" : ""}`}
                              placeholder="max"
                              value={r.lt}
                              onChange={(e) => updateLabBound(i, "lt", e.target.value)}
                              style={{ width: 90 }}
                              inputMode="decimal"
                            />
                          </div>
                          <div className="col-16 text-end pe-3">
                            <button className="btn btn-sm btn-outline-danger" onClick={() => removeLab(i)}>
                              X
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

          {/* Medication Category (ON) */}
          <div className="col-10">
            <div className="d-flex align-items-center justify-content-between mb-2 ps-3 pe-2">
              <h6 className="m-0">On Medication</h6>
              <button className="btn btn-sm btn-outline-danger" onClick={clearMeds} disabled={medLoading}>
                Clear
              </button>
            </div>
            {medErr &&
              <div className="alert alert-danger py-1">{medErr}</div>}
            <div className="p-2">
              <select
                className="form-select form-select-sm mb-2"
                value={medSelect}
                onChange={(e) => addMed(e.target.value)}
              >
                <option value="">— Choose medication</option>
                {Array.isArray(medsCategory) && medsCategory.length > 0
                  ? medsCategory.map((m) => {
                    const id = String(m?.ID ?? m?.id ?? "");
                    const label = String(m?.medication_cat);
                    return <option key={id} value={id}>{label}</option>;
                  })
                  : null}
              </select>

              {catSearchArray.length === 0 ? (
                <div className="text-muted small"><em>No medications added.</em></div>
              ) : (
                <div className="row row-cols-1 g-2">
                  {catSearchArray.map((c, i) => (
                    <div key={c.ID ?? i} className="col">
                      <div
                        className="text-start ps-1 text-purple border-bottom border-navy border-1 fs-6"
                        style={{ height: "50px", lineHeight: "50px" }}
                      >
                        <span className="text-truncate fs-7" title={c.medication_cat}>
                          {c.medication_cat}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>

          {/* Not on Medication (OFF) */}
          <div className="col-10">
            <div className="d-flex align-items-center justify-content-between mb-2 ps-3 pe-2">
              <h6 className="m-0 text-danger">Not On Medication</h6>
              <button className="btn btn-sm btn-outline-danger" onClick={clearNonMeds} disabled={nonMedLoading}>
                Clear
              </button>
            </div>
            {nonMedErr && <div className="alert alert-danger py-1">{nonMedErr}</div>}
            <div className="p-2">
              <select
                className="form-select form-select-sm mb-2"
                value={nonMedSelect}
                onChange={(e) => addNonMed(e.target.value)}
              >
                <option value="">— Choose a medication —</option>
                {Array.isArray(medsCategory) && medsCategory.length > 0
                  ? medsCategory.map((m) => {
                    const id = String(m?.ID ?? m?.id ?? "");
                    const label = String(m?.medication_cat);
                    return <option key={id} value={id}>{label}</option>;
                  })
                  : null}
              </select>

              {nonMedCatSearchArray.length === 0 ? (
                <div className="text-muted small"><em>No categories selected.</em></div>
              ) : (
                <div className="row row-cols-1 g-2">
                  {nonMedCatSearchArray.map((c, i) => (
                    <div key={c.ID ?? i} className="col">
                      <div
                        className="text-start ps-1 text-danger border-bottom border-navy border-1 fs-6"
                        style={{ height: "50px", lineHeight: "50px" }}
                      >
                        <span className="text-truncate fs-7" title={c.medication_cat}>
                          {c.medication_cat}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CriteriaSearch;
