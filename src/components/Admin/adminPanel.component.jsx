// src/components/Admin/adminPanel.component.jsx
import React, { useEffect, useMemo, useState, Suspense, lazy } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalContext } from "../../Context/global.context";

// Lazy-load editors (add more as you create them)
const ConditionAdminPanel = lazy(() => import("./editConditions.component.jsx"));
// Example placeholders: create these files later and add lazy() imports
const MedsAdminPanel = lazy(() => import("./editMedications.component.jsx"));
// const UsersAdminPanel = lazy(() => import("../admin/UsersAdminPanel.jsx"));

const PANELS = {
  conditions: ConditionAdminPanel,
  meds: MedsAdminPanel,
  // users: UsersAdminPanel,
};

const StatusPill = ({ on }) => (
  <span
    className={`badge ${on ? "bg-danger" : "bg-success"} ms-2`}
    title={on ? "Private Mode is ON: sensitive data is masked" : "Private Mode is OFF: full data shown"}
  >
    {on ? "Private Mode: ON" : "Private Mode: OFF"}
  </span>
);

const PatientAdminPanel = () => {
  const gc = useGlobalContext();
  const navigate = useNavigate();

  const { privateMode: ctxPrivateMode, updatePrivateMode: setCtxPrivateMode } = gc || {};

  // Local safety state; initialize from context if present, else default false
  const [localPrivate, setLocalPrivate] = useState(Boolean(ctxPrivateMode ?? false));

  // Persist which sub-panel is open
  const [activeTool, setActiveTool] = useState(() => localStorage.getItem("adminActiveTool") || "");
  useEffect(() => {
    localStorage.setItem("adminActiveTool", activeTool || "");
  }, [activeTool]);

  // Keep local private state in sync with context
  useEffect(() => {
    if (typeof ctxPrivateMode === "boolean") setLocalPrivate(ctxPrivateMode);
  }, [ctxPrivateMode]);

  const effectivePrivate = useMemo(
    () => (typeof ctxPrivateMode === "boolean" ? ctxPrivateMode : localPrivate),
    [ctxPrivateMode, localPrivate]
  );

  const handleToggle = () => {
    const next = !effectivePrivate;
    if (typeof setCtxPrivateMode === "function") {
      setCtxPrivateMode(next);
    } else {
      console.warn("[PatientAdminPanel] updatePrivateMode not found on GlobalContext. Using local state fallback.");
      setLocalPrivate(next);
    }
  };

  const handleReturn = () => navigate("/dashboard");

  // Button config for toolbar
  const BUTTONS = [
    { key: "conditions", label: "Conditions" },
    { key: "meds", label: "Medications" },
    { key: "Med Cats", label: "Med Categories" },
    { key: "users", label: "Users" },
  ];

  const ActivePanel = PANELS[activeTool] || null;

  return (
    <div className="container-fluid">
      <div className="row g-3">
        <div className="col-48">
          <div className="card shadow-sm">
            <div className="card-body">
              {/* Header */}
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div>
                  <h5 className="card-title mb-1">Patient Admin Panel</h5>
                  <small className="text-muted">
                    Global settings and editors for patient data and reference lists.
                  </small>
                </div>
                <div className="d-flex align-items-center">
                  <button className="btn btn-outline-secondary me-2" onClick={handleReturn}>
                    ← Return to Dashboard
                  </button>
                  <StatusPill on={effectivePrivate} />
                </div>
              </div>

              <hr className="my-3" />

              {/* Private Mode row */}
              <div className="d-flex align-items-center justify-content-between">
                <div className="me-3">
                  <div className="fw-semibold">Private Mode</div>
                  <div className="text-muted small">
                    When enabled, names are masked (e.g., “Patient 1234”) and identifiers are hidden where applicable.
                  </div>
                </div>
                <div className="form-check form-switch fs-5">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="privateModeSwitch"
                    role="switch"
                    checked={effectivePrivate}
                    onChange={handleToggle}
                    aria-checked={effectivePrivate}
                  />
                  <label className="form-check-label ms-2" htmlFor="privateModeSwitch">
                    {effectivePrivate ? "On" : "Off"}
                  </label>
                </div>
              </div>

              {/* ========= Toolbar ========= */}
              <hr className="my-3" />
              <div className="d-flex flex-wrap gap-2" role="tablist" aria-label="Admin sections">
                {BUTTONS.map((b) => {
                  const active = activeTool === b.key;
                  const cls = active ? "btn btn-primary" : "btn btn-outline-primary";
                  return (
                    <button
                      key={b.key}
                      type="button"
                      className={cls}
                      aria-selected={active}
                      aria-controls={`outlet-${b.key}`}
                      onClick={() => setActiveTool((prev) => (prev === b.key ? "" : b.key))}
                    >
                      {b.label}
                    </button>
                  );
                })}
              </div>

              {/* ========= Outlet (appears under this line) ========= */}
              <div className="mt-3" id={`outlet-${activeTool || "none"}`}>
                {!activeTool ? (
                  <div className="alert alert-light border">Select a section above to begin editing.</div>
                ) : ActivePanel ? (
                  <div className="border rounded p-2">
                    <Suspense fallback={<div className="alert alert-info mb-0">Loading editor…</div>}>
                      <ActivePanel />
                    </Suspense>
                  </div>
                ) : (
                  <div className="alert alert-warning mb-0">
                    “{BUTTONS.find((b) => b.key === activeTool)?.label}” editor not implemented yet.
                  </div>
                )}
              </div>

              {/* Add more admin toggles here if needed */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientAdminPanel;
