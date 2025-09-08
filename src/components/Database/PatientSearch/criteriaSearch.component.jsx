// src/components/Labs/criteriaSearch.component.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useGlobalContext } from "../../../Context/global.context";

const STORAGE_KEY = "patientSearch";

// All value fields (exact DB column names, no dates)
const FIELDS = [
  "cholesterol",
  "triglyceride",
  "hdl",
  "ldl",
  "nonHdl",
  "cholesterolHdlRatio",
  "creatineKinase",
  "alanineAminotransferase",
  "lipoproteinA",
  "apolipoproteinB",
  "natriureticPeptideB",
  "urea",
  "creatinine",
  "gfr",
  "albumin",
  "sodium",
  "potassium",
  "vitaminB12",
  "ferritin",
  "hemoglobinA1C",
  "urineAlbumin",
  "albuminCreatinineRatio",
];

// Build an empty criteria object: { field: { gt:'', lt:'' }, ... }
const makeEmptyCriteria = () =>
  FIELDS.reduce((acc, key) => {
    acc[key] = { gt: "", lt: "" };
    return acc;
  }, {});

// Simple numeric input sanitizer: allow digits + one dot
const cleanNum = (v) => {
  const s = (v ?? "").toString().replace(/[^\d.]/g, "");
  const parts = s.split(".");
  if (parts.length > 2) return `${parts[0]}.${parts.slice(1).join("")}`; // collapse extra dots
  return s;
};

const CriteriaSearch = ({ onResults }) => {
  const {
    labCriteria,
    updateLabCriteria,
    clearLabCriteria,
    patientSearch,
    updatePatientSearch,
    setVisibleBox,
  } = useGlobalContext();

  // Detect if lab criteria lives in context; otherwise fall back to local state + localStorage
  const hasCtxAPI =
    typeof updateLabCriteria === "function" &&
    typeof clearLabCriteria === "function" &&
    labCriteria;

  const [localCriteria, setLocalCriteria] = useState(() => {
    if (hasCtxAPI) return labCriteria || makeEmptyCriteria();
    try {
      const saved = JSON.parse(localStorage.getItem("labCriteria"));
      return saved && typeof saved === "object" ? { ...makeEmptyCriteria(), ...saved } : makeEmptyCriteria();
    } catch {
      return makeEmptyCriteria();
    }
  });

  // Keep fallback state persisted
  useEffect(() => {
    if (!hasCtxAPI) {
      try {
        localStorage.setItem("labCriteria", JSON.stringify(localCriteria));
      } catch {}
    }
  }, [hasCtxAPI, localCriteria]);

  const criteria = hasCtxAPI ? labCriteria : localCriteria;

  const setCrit = (field, bound, val) => {
    const nextVal = cleanNum(val);
    const next = {
      ...criteria,
      [field]: { ...criteria[field], [bound]: nextVal },
    };
    if (hasCtxAPI) updateLabCriteria({ [field]: next[field] });
    else setLocalCriteria(next);
  };

  const clearAll = () => {
    if (hasCtxAPI) clearLabCriteria();
    else setLocalCriteria(makeEmptyCriteria());
  };

  const payload = useMemo(() => {
    // Only include fields with at least one bound set
    const filters = {};
    for (const key of FIELDS) {
      const { gt, lt } = criteria[key] || {};
      if (gt !== "" || lt !== "") {
        filters[key] = {};
        if (gt !== "") filters[key].gt = parseFloat(gt);
        if (lt !== "") filters[key].lt = parseFloat(lt);
      }
    }
    // Backend expects { script: "labRangeSearch", filters }
    return { script: "labRangeSearch", filters };
  }, [criteria]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Persist to localStorage and surface Results view (matches PatientSearch behavior)
  const persistAndShow = (nextSearch) => {
    updatePatientSearch?.(nextSearch);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSearch));
    } catch (e) {
      console.error("Failed to persist patientSearch:", e);
    }
    setVisibleBox?.("searchResults");
  };

  const handleSearch = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload), // send as {script, filters}
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
        ...patientSearch,
        didSearch: true,
        mode: "criteria",
        results: Array.isArray(data) ? data : [],
      };
      persistAndShow(next);
    } catch (e) {
      console.error(e);
      const next = { ...patientSearch, didSearch: true, mode: "criteria", results: [] };
      persistAndShow(next);
      setErr("Search failed. Check console.");
    } finally {
      setLoading(false);
    }
  };

  // 2 equal columns of fields
  const mid = Math.ceil(FIELDS.length / 2);
  const COLS = [FIELDS.slice(0, mid), FIELDS.slice(mid)];

  // helper: is a single bound filled?
  const hasVal = (v) => v !== "" && v != null;

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h5 className="m-0">Lab Range Search</h5>
        <div className="d-flex gap-2">
          <button className="btn btn-danger" onClick={clearAll} disabled={loading}>
            Clear
          </button>
          <button
            className="btn btn-success text-white"
            style={{ width: "140px" }}
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </div>

      {err && <div className="alert alert-danger py-1">{err}</div>}

      <div className="border rounded p-2">
        <div className="d-flex gap-2">
          {COLS.map((list, idx) => (
            <div key={idx} className="col-24">
              {list.map((key) => {
                const gtVal = criteria[key]?.gt ?? "";
                const ltVal = criteria[key]?.lt ?? "";
                const gtClass = `form-control form-control-sm ${hasVal(gtVal) ? "alert-success" : ""}`;
                const ltClass = `form-control form-control-sm ${hasVal(ltVal) ? "alert-success" : ""}`;

                return (
                  <div key={key} className="d-flex align-items-center py-1 border-bottom">
                    <div className="col-22 fw-bold text-capitalize" style={{ textTransform: "none" }}>
                      {key}
                    </div>

                    <div className="col-auto text-danger px-3 fw-bold fs-5">&gt;</div>
                    <div className="col-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        className={gtClass}
                        placeholder="min"
                        value={gtVal}
                        onChange={(e) => setCrit(key, "gt", e.target.value)}
                      />
                    </div>

                    <div className="col-3"></div>

                    <div className="col-auto px-3 text-danger fs-5 fw-bold">&lt;</div>
                    <div className="col-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        className={ltClass}
                        placeholder="max"
                        value={ltVal}
                        onChange={(e) => setCrit(key, "lt", e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Debug payload (optional) */}
      {/* <pre className="small text-muted mt-2" style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify(payload, null, 2)}
      </pre> */}
    </div>
  );
};

export default CriteriaSearch;
