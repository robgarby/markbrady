// src/components/DisplayPatient/Patient/patientConditionDisplay.componentl.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useGlobalContext } from "../../../../Context/global.context";

const PatientConditionDisplay = ({}) => {
  const gc = useGlobalContext();
  const { conditionData, activePatient, setActivePatient } = gc || {};

  // Normalize condition list (array or object map)
  const list = useMemo(() => {
    if (Array.isArray(conditionData)) return conditionData;
    if (conditionData && typeof conditionData === "object") return Object.values(conditionData);
    return [];
  }, [conditionData]);

  // Parse CSV codes -> array -> Set
  const parseCodes = (str) =>
    (str || "")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

  // Pre-checked codes from patient
  const preChecked = useMemo(
    () => new Set(parseCodes(activePatient?.conditionData)),
    [activePatient?.conditionData]
  );

  // Local toggles (start with patient's codes)
  const [onCodes, setOnCodes] = useState(() => new Set());
  useEffect(() => {
    setOnCodes(new Set(preChecked));
  }, [preChecked]);

  // Save helper: send-it-and-leave-it
  const saveCodes = (codesSet) => {
    if (!activePatient?.id) return;
    const csv = [...codesSet].join(",");

    // Mirror into context's activePatient so other panes stay in sync
    if (typeof setActivePatient === "function") {
      setActivePatient((prev) =>
        prev && prev.id === activePatient.id ? { ...prev, conditionData: csv } : prev
      );
    }

    // Fire-and-forget to backend (same script/shape as your original)
    try {
      fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          script: "updatePatientConditions",
          patientID: activePatient.id,
          conditionCodes: csv,
        }),
      }).catch(() => {});
    } catch (_) {}
  };

  // Toggle handler: update local set, then persist
  const toggle = (code) => {
    if (!code || !activePatient?.id) return;
    const next = new Set(onCodes);
    next.has(code) ? next.delete(code) : next.add(code);
    setOnCodes(next);
    saveCodes(next);
  };

  return (
    <div className="container-fluid px-1">
      <div className="row g-2">
        {list.map((c, idx) => {
          const label = c?.conditionName ?? c?.name ?? String(c ?? "");
          const code = (c?.conditionCode ?? c?.code ?? "").toUpperCase();
          const id = `cond_${code || idx}`;
          const checked = onCodes.has(code);

          return (
            <div key={id} className="col-24 col-md-16 col-lg-12">
              <div className="border rounded p-2 d-flex align-items-center">
                <span className="flex-grow-1 min-w-0 text-truncate me-2 small" title={label}>
                  {label}
                </span>
                <div className="form-check form-switch m-0">
                  <input
                    id={id}
                    type="checkbox"
                    className="form-check-input"
                    checked={checked}
                    onChange={() => toggle(code)}
                  />
                </div>
              </div>
            </div>
          );
        })}

        {list.length === 0 && (
          <div className="col-48 text-muted small">
            <em>No conditions to display.</em>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientConditionDisplay;
