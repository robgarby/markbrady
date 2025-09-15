// src/components/Labs/criteriaSearch.component.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useGlobalContext } from "../../../Context/global.context";

const STORAGE_KEY = "patientSearch";                 // existing persisted search
const COND_CODES_KEY = "criteriaSearch.conditionCodes"; // NEW: persist selected condition codes

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

const hasVal = (v) => String(v ?? "").trim() !== "";

// Split FIELDS into two 24-column stacks for the 48-col grid
const splitFields = (arr) => {
  const mid = Math.ceil(arr.length / 2);
  return [arr.slice(0, mid), arr.slice(mid)];
};
const COLS = splitFields(FIELDS);

const CriteriaSearch = ({ onResults }) => {
  const {
    // Labs criteria API (existing)
    labCriteria,
    updateLabCriteria,
    clearLabCriteria,

    // Existing search plumbing
    patientSearch,
    updatePatientSearch,
    setVisibleBox,

    // Conditions master list from Context
    conditionData,
    updateConditions,      // if your context exposes this
    updateConditionData,   // or this name; we’ll use whichever exists
  } = useGlobalContext();

  // =========================
  // CONDITION SEARCH
  // =========================

  // If conditionData is empty, fetch once and push into context
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
      .catch(() => {});
  }, [conditionData, updateConditions, updateConditionData]);

  // Normalize the list to an array
  const allConditions = useMemo(() => {
    if (Array.isArray(conditionData)) return conditionData;
    if (conditionData && typeof conditionData === "object") return Object.values(conditionData);
    return [];
  }, [conditionData]);

  // Filter box + selected condition codes (as toggles)
  const [condQuery, setCondQuery] = useState("");
  const [condCodes, setCondCodes] = useState(() => new Set());
  const [condLoading, setCondLoading] = useState(false);
  const [condErr, setCondErr] = useState("");

  // HYDRATE persisted toggles on mount
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(COND_CODES_KEY));
      if (Array.isArray(saved) && saved.length) {
        setCondCodes(new Set(saved.map((s) => String(s).toUpperCase()).filter(Boolean)));
      }
    } catch (e) {
      console.error("Failed to load saved condition codes:", e);
    }
  }, []);

  const filteredConditions = useMemo(() => {
    const q = condQuery.trim().toLowerCase();
    if (!q) return allConditions;
    return allConditions.filter((c) => {
      const name = (c?.conditionName ?? c?.name ?? "").toLowerCase();
      const code = (c?.conditionCode ?? c?.code ?? "").toLowerCase();
      return name.includes(q) || code.includes(q);
    });
  }, [condQuery, allConditions]);

  const toggleCondCode = (code) => {
    const normalized = String(code || "").toUpperCase();
    if (!normalized) return;
    setCondCodes((prev) => {
      const next = new Set(prev);
      next.has(normalized) ? next.delete(normalized) : next.add(normalized);
      try {
        localStorage.setItem(COND_CODES_KEY, JSON.stringify([...next]));
      } catch (e) {
        console.error("Failed to persist condition codes:", e);
      }
      return next;
    });
  };

  const clearCond = () => {
    setCondQuery("");
    setCondCodes(new Set());
    setCondErr("");
    try {
      localStorage.removeItem(COND_CODES_KEY);
    } catch (e) {
      console.error("Failed to clear condition codes:", e);
    }
  };

  // Persist to localStorage and surface Results view (matches existing helper)
  const persistAndShow = (nextSearch) => {
    updatePatientSearch?.(nextSearch);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSearch));
    } catch (e) {
      console.error("Failed to persist patientSearch:", e);
    }
    setVisibleBox?.("searchResults");
  };

  const handleConditionSearch = async () => {
    const codes = [...condCodes]; // array of selected condition codes
    setCondLoading(true);
    setCondErr("");
    try {
      const res = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: "conditionSearch", codes }),
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
        mode: "condition",
        conditionCodes: codes,
        results: Array.isArray(data) ? data : [],
      };
      persistAndShow(next);
    } catch (e) {
      console.error(e);
      const next = {
        ...patientSearch,
        didSearch: true,
        mode: "condition",
        conditionCodes: [...condCodes],
        results: [],
      };
      persistAndShow(next);
      setCondErr("Condition search failed. Check console.");
    } finally {
      setCondLoading(false);
    }
  };

  // =========================
  // LAB RANGE SEARCH (existing)
  // =========================

  // Detect if lab criteria lives in context; otherwise fall back to local state + localStorage
  const hasCtxAPI =
    typeof updateLabCriteria === "function" &&
    typeof clearLabCriteria === "function" &&
    labCriteria;

  const [localCriteria, setLocalCriteria] = useState(() => {
    if (hasCtxAPI) return labCriteria || makeEmptyCriteria();
    try {
      const saved = JSON.parse(localStorage.getItem("labCriteria"));
      return saved && typeof saved === "object"
        ? { ...makeEmptyCriteria(), ...saved }
        : makeEmptyCriteria();
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

  const handleSearch = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
        conditionCodes: [...condCodes], // carry along current toggles
        results: Array.isArray(data) ? data : [],
      };
      persistAndShow(next);
    } catch (e) {
      console.error(e);
      const next = {
        ...patientSearch,
        didSearch: true,
        mode: "criteria",
        conditionCodes: [...condCodes],
        results: [],
      };
      persistAndShow(next);
      setErr("Search failed. Check console.");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // RENDER
  // =========================
  return (
    <div className="p-2">
      {/* ======================= Condition Search ======================= */}
      <div className="d-flex align-items-center justify-content-between mb-2">
        <h5 className="m-0">Condition Search</h5>
        <div className="d-flex gap-2">
          <button className="btn btn-danger" onClick={clearCond} disabled={condLoading}>
            Clear
          </button>
          <button
            className="btn btn-success text-white"
            style={{ width: "140px" }}
            onClick={handleConditionSearch}
            disabled={condLoading}
          >
            {condLoading ? "Searching…" : "Search"}
          </button>
        </div>
      </div>

      {condErr && <div className="alert alert-danger py-1">{condErr}</div>}

      <div className="border rounded p-2 mb-3">
        {/* Filter box */}
        <div className="d-flex align-items-center mb-2">
          <div className="ms-auto" style={{ width: 260 }}>
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Filter by name or code…"
              value={condQuery}
              onChange={(e) => setCondQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Conditions grid with toggles */}
        <div className="row g-2">
          {filteredConditions.map((c, idx) => {
            const label = c?.conditionName ?? c?.name ?? String(c ?? "");
            const code = (c?.conditionCode ?? c?.code ?? "").toUpperCase();
            const id = `cond_${code || idx}`;
            const checked = condCodes.has(code);

            return (
              <div key={id} className="col-24 col-md-16 col-lg-12">
                <div className="border rounded p-2 d-flex align-items-center">
                  <span
                    className="flex-grow-1 min-w-0 text-truncate me-2 small"
                    title={`${label}${code ? ` (${code})` : ""}`}
                  >
                    {label}
                  </span>
                  {/* Intentionally no code text before the toggle */}
                  <div className="form-check form-switch m-0">
                    <input
                      id={id}
                      type="checkbox"
                      className="form-check-input"
                      checked={checked}
                      onChange={() => toggleCondCode(code)}
                      aria-label={`Include ${label}${code ? ` (${code})` : ""} in search`}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {filteredConditions.length === 0 && (
            <div className="col-48 text-muted small">
              <em>No conditions match your filter.</em>
            </div>
          )}
        </div>
      </div>

      {/* ======================= Lab Range Search (existing) ======================= */}
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

      {/* Debug payload (optional)
      <pre className="small text-muted mt-2" style={{ whiteSpace: "pre-wrap" }}>
        {JSON.stringify({ conditionCodes: [...condCodes], payload }, null, 2)}
      </pre> */}
    </div>
  );
};

export default CriteriaSearch;
