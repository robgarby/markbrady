// src/components/Labs/criteriaSearch.component.jsx
import React, { use, useEffect, useMemo, useState } from "react";
import { useGlobalContext } from "../../../Context/global.context";

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

const CAT_ENDPOINT = "https://optimizingdyslipidemia.com/PHP/special.php";
const GET_SCRIPT = "getMedsCategory";

const cleanNum = (v) => {
  const s = (v ?? "").toString().replace(/[^\d.]/g, "");
  const parts = s.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : s;
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
    updateMedsCategory
  } = useGlobalContext();

  useEffect(() => {
    if (!Array.isArray(medsCategory) || medsCategory.length === 0) {
      (async () => {
        try {
          console.log("Loading medication categories...");
          const res = await fetch(CAT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ script: GET_SCRIPT }),
          });
          const text = await res.text();
          let data = null;
          try { data = JSON.parse(text);} catch { }
          const payload = data;
          console.log(payload);
          if (typeof updateMedsCategory === "function") updateMedsCategory(payload);
        } catch (e) {
          console.error(e);
        } finally {
        }
      })();
    } 
  }, [medsCategory]);
  
  // ─────────────── Load condition master if needed ───────────────
  useEffect(() => {
    const needsLoad = !Array.isArray(conditionData) || conditionData.length === 0;
    const setConditions =
      typeof updateConditions === "function"
        ? updateConditions
        : typeof updateConditionData === "function"
          ? updateConditionData
          : null;

    if (!needsLoad || !setConditions) return;

    fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
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

  // ─────────────── CONDITIONS PANE (state-only) ───────────────
  const [condFilter, setCondFilter] = useState("");
  const [condSelect, setCondSelect] = useState("");
  // In-memory list you asked for: { ID, condition_name, condition_code }
  const [conditionSearchArray, setConditionSearchArray] = useState([]);
  const [condLoading, setCondLoading] = useState(false);
  const [condErr, setCondErr] = useState("");

  // Filtered + normalized options for the select
  const filteredConditions = useMemo(() => {
    const q = condFilter.trim().toLowerCase();
    const src = allConditions.map((c) => ({
      code: String(c?.conditionCode ?? c?.code ?? "").toUpperCase(),
      label: String(c?.conditionName ?? c?.name ?? ""),
      id: String(c?.ID ?? c?.id ?? c?.conditionID ?? ""),
    }));
    if (!q) return src;
    return src.filter(
      (c) => c.label.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [allConditions, condFilter]);

  const normalizedConditions = useMemo(
    () =>
      filteredConditions.map((c) => {
        const code = (c.code || "").trim().toUpperCase();
        const label = (c.label || "").trim();
        const value = code || label; // fallback to label if no code
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

    // prevent duplicates by code if present, otherwise by name
    const exists = displayConds.some((c) =>
      chosen.code ? c.code === chosen.code : c.name === chosen.label
    );
    if (exists) return;

    setConditionSearchArray((prev) => [
      ...prev,
      {
        ID: String(chosen.id || ""),
        condition_name: chosen.label,
        condition_code: chosen.code || "",
      },
    ]);
    setCondSelect("");
  };

  const clearConditions = () => {
    setCondFilter("");
    setCondSelect("");
    setConditionSearchArray([]);
    setCondErr("");
  };

  const handleConditionSearch = async () => {
    const items = displayConds;
    if (!items.length) {
      setCondErr("Add at least one condition.");
      return;
    }
    const codes = items.map((x) => x.code).filter(Boolean);
    const labels = items.map((x) => x.name).filter(Boolean);

    setCondLoading(true);
    setCondErr("");
    try {
      const res = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: "conditionSearch", codes, labels }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = [];
      }

      if (typeof onResults === "function") onResults(data);

      const next = {
        ...(patientSearch || {}),
        didSearch: true,
        mode: "condition",
        conditionCodes: codes,
        results: Array.isArray(data) ? data : [],
      };
      updatePatientSearch?.(next);
      setVisibleBox?.("searchResults");
    } catch (e) {
      setCondErr("Condition search failed. Check console.");
      const next = {
        ...(patientSearch || {}),
        didSearch: true,
        mode: "condition",
        conditionCodes: [],
        results: [],
      };
      updatePatientSearch?.(next);
      setVisibleBox?.("searchResults");
    } finally {
      setCondLoading(false);
    }
  };

  // ─────────────── LABS PANE (state-only) ───────────────
  const [labSelect, setLabSelect] = useState("");
  // In-memory array of { field, gt, lt }
  const [labs, setLabs] = useState([]);
  const [labErr, setLabErr] = useState("");
  const [labLoading, setLabLoading] = useState(false);

  const addLab = () => {
    const field = String(labSelect || "");
    if (!field || labs.some((r) => r.field === field)) return;
    setLabs((prev) => [...prev, { field, gt: "", lt: "" }]);
    setLabSelect("");
  };

  const updateLabBound = (idx, bound, val) => {
    setLabs((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [bound]: cleanNum(val) } : r))
    );
  };

  const removeLab = (idx) => {
    setLabs((prev) => prev.filter((_, i) => i !== idx));
  };

  const clearLabs = () => {
    setLabSelect("");
    setLabs([]);
    setLabErr("");
  };

  const handleLabSearch = async () => {
    // require both bounds for each lab
    const invalid = labs.find((r) => !String(r.gt).trim() || !String(r.lt).trim());
    if (invalid) {
      setLabErr("Each lab needs both a > and < value.");
      return;
    }
    const filters = {};
    for (const r of labs) {
      filters[r.field] = { gt: parseFloat(r.gt), lt: parseFloat(r.lt) };
    }

    setLabLoading(true);
    setLabErr("");
    try {
      const res = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: "labRangeSearch", filters }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = [];
      }

      if (typeof onResults === "function") onResults(data);

      const next = {
        ...(patientSearch || {}),
        didSearch: true,
        mode: "labs",
        labFilters: filters,
        results: Array.isArray(data) ? data : [],
      };
      updatePatientSearch?.(next);
      setVisibleBox?.("searchResults");
    } catch (e) {
      setLabErr("Lab search failed. Check console.");
      const next = {
        ...(patientSearch || {}),
        didSearch: true,
        mode: "labs",
        labFilters: {},
        results: [],
      };
      updatePatientSearch?.(next);
      setVisibleBox?.("searchResults");
    } finally {
      setLabLoading(false);
    }
  };

  // ─────────────── MEDICATIONS PANE (state-only) ───────────────
  const medsMaster = Array.isArray(medsArray) ? medsArray : [];
  const medOptions = useMemo(
    () =>
      medsMaster.map((m) => ({
        id: String(m?.ID ?? m?.id ?? ""),
        label: String(m?.medication_name ?? m?.medication ?? m?.name ?? `#${m?.ID ?? ""}`),
      })),
    [medsMaster]
  );

  const [medSelect, setMedSelect] = useState("");
  // In-memory array of { id, label }
  const [meds, setMeds] = useState([]);
  const [medErr, setMedErr] = useState("");
  const [medLoading, setMedLoading] = useState(false);

  const [catSearchArray, setCatSearchArray] = useState([]); // { ID, medication_cat }

  const addMed = () => {
    const selectedMed = Array.isArray(medsCategory)
      ? medsCategory.find((m) => String(m.ID ?? m.id ?? "") === String(medSelect))
      : null;
    if (!selectedMed) return;
    const id = String(selectedMed.ID ?? selectedMed.id ?? "");
    // Check if already exists in catSearchArray
    const exists = catSearchArray.some((c) => String(c.ID) === id);
    if (!exists) {
      setCatSearchArray((prev) => [
      ...prev,
      { ID: id, medication_cat: selectedMed.medication_cat }
      ]);
    }
    setMedSelect("");
  };

  useEffect(() => {
    console.log("catSearchArray changed:", catSearchArray);
  }, [catSearchArray]);

  const removeMed = (id) => {
    setMeds((prev) => prev.filter((m) => m.id !== id));
  };

  const clearMeds = () => {
    setCatSearchArray([]);
    setMedSelect("");
    setMeds([]);
    setMedErr("");
  };

  const handleMedSearch = async () => {
    if (!catSearchArray.length) {
      setMedErr("Add at least one medication.");
      return;
    }
    const ids = catSearchArray.map((m) => m.ID);
    setMedLoading(true);
    setMedErr("");
    try {
      // Rename the script if your backend expects a different name
      const res = await fetch("https://optimizingdyslipidemia.com/PHP/special.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: "medicationSearchByIds", ids }),
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = [];
      }

      if (typeof onResults === "function") onResults(data);

      const next = {
        ...(patientSearch || {}),
        didSearch: true,
        mode: "medications",
        meds: ids,
        results: Array.isArray(data) ? data : [],
      };
      updatePatientSearch?.(next);
      setVisibleBox?.("searchResults");
    } catch (e) {
      setMedErr("Medication search failed. Check console.");
      const next = {
        ...(patientSearch || {}),
        didSearch: true,
        mode: "medications",
        meds: [],
        results: [],
      };
      updatePatientSearch?.(next);
      setVisibleBox?.("searchResults");
    } finally {
      setMedLoading(false);
    }
  };

  // ─────────────── UI ───────────────
  return (
    <div className="p-2">
      {/* ───────────── Conditions ───────────── */}
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h5 className="m-0">Condition Search</h5>
        <div className="d-flex gap-2">
          <button className="btn btn-danger" onClick={clearConditions} disabled={condLoading}>Clear</button>
          <button className="btn btn-success text-white" onClick={handleConditionSearch} disabled={condLoading} style={{ width: 140 }}>
            {condLoading ? "Searching…" : "Search"}
          </button>
        </div>
      </div>
      {condErr && <div className="alert alert-danger py-1">{condErr}</div>}

      <div className="border rounded p-2 mb-3">
        {/* Add Search For */}
        <div className="row g-2 align-items-end mb-2">
          <div className="col-20">
            <label className="form-label mb-1">Add Search For</label>
            <select
              className="form-select form-select-sm"
              value={condSelect}
              onChange={(e) => setCondSelect(e.target.value)}
            >
              <option value="">— Choose a condition —</option>
              {normalizedConditions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}{c.code ? ` (${c.code})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="col-auto">
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => addCondition(condSelect)}
            >
              Add to Search
            </button>
          </div>
        </div>

        {/* Selected conditions */}
        <div className="border rounded p-2">
          <div className="fw-bold mb-2">Selected</div>
          {displayConds.length === 0 ? (
            <div className="text-muted small"><em>No conditions added.</em></div>
          ) : (
            <div className="row row-cols-4 g-2">
              {conditionSearchArray.map((c, i) => (
                <div key={i} className="col">
                  <div className="text-start p-1">
                    <span>{c.condition_name}</span>
                    {c.condition_code ? <span>{` (${c.condition_code})`}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ───────────── Labs ───────────── */}
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h5 className="m-0">Lab Search</h5>
        <div className="d-flex gap-2">
          <button className="btn btn-danger" onClick={clearLabs} disabled={labLoading}>Clear</button>
          <button className="btn btn-success text-white" onClick={handleLabSearch} disabled={labLoading} style={{ width: 140 }}>
            {labLoading ? "Searching…" : "Search"}
          </button>
        </div>
      </div>
      {labErr && <div className="alert alert-danger py-1">{labErr}</div>}

      <div className="border rounded p-2 mb-3">
        {/* Add Search For lab */}
        <div className="row g-2 align-items-end mb-2">
          <div className="col-20">
            <label className="form-label mb-1">Add Search For</label>
            <select
              className="form-select form-select-sm"
              value={labSelect}
              onChange={(e) => setLabSelect(e.target.value)}
            >
              <option value="">— Choose a lab —</option>
              {LAB_FIELDS.map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="col-auto">
            <button className="btn btn-outline-primary btn-sm" onClick={addLab}>Add to Search</button>
          </div>
        </div>

        {/* Selected labs with > and < */}
        <div className="border rounded p-2">
          <div className="fw-bold mb-2">Selected</div>
          {labs.length === 0 ? (
            <div className="text-muted small"><em>No labs added.</em></div>
          ) : (
            <div className="row g-2">
              {labs.map((r, i) => {
                const label = LAB_FIELDS.find(([k]) => k === r.field)?.[1] || r.field;
                return (
                  <div key={`${r.field}_${i}`} className="col-24">
                    <div className="border rounded p-2 d-flex align-items-center gap-2">
                      <div className="fw-semibold flex-grow-1">{`Search Lab ${i + 1}: ${label}`}</div>
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
                        <button className="btn btn-sm btn-outline-danger" onClick={() => removeLab(i)}>Remove</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ───────────── Medications ───────────── */}
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h5 className="m-0">Medication Category Search</h5>
        <div className="d-flex gap-2">
          <button className="btn btn-danger" onClick={clearMeds} disabled={medLoading}>Clear</button>
          <button className="btn btn-success text-white" onClick={handleMedSearch} disabled={medLoading} style={{ width: 140 }}>
            {medLoading ? "Searching…" : "Search"}
          </button>
        </div>
      </div>
      {medErr && <div className="alert alert-danger py-1">{medErr}</div>}

      <div className="border rounded p-2">
        <div className="row g-2 align-items-end mb-2">
          <div className="col-24 col-md-20">
            <label className="form-label mb-1">Add Search For</label>
            <select
              className="form-select form-select-sm"
              value={medSelect}
              onChange={(e) => setMedSelect(e.target.value)}
            >
              <option value="">— Choose a medication category —</option>
              {Array.isArray(medsCategory) && medsCategory.length > 0
                ? medsCategory.map((m) => {
                  const id = String(m?.ID ?? m?.id ?? "");
                  const label = String(m?.medication_cat);
                  return (
                    <option key={id} value={id}>{label}</option>
                  );
                })
                : null}
            </select>
          </div>
          <div className="col-auto">
            <button className="btn btn-outline-primary btn-sm" onClick={addMed}>Add to Search</button>
          </div>
        </div>

        {/* Selected meds */}
        <div className="border rounded p-2">
          <div className="fw-bold mb-2">Selected</div>
          {catSearchArray.length === 0 ? (
            <div className="text-muted small"><em>No medications category added.</em></div>
          ) : (
           <div className="row row-cols-4 g-2">
              {catSearchArray.map((c, i) => (
                <div key={c.ID ?? i} className="col">
                  <div className="text-start p-1">
                    <span>{c.medication_cat}</span>
                    {c.ID ? <span>{` (${c.ID})`}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CriteriaSearch;
