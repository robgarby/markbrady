// src/components/patient/patientConditionsBox.component.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalContext } from "../../../Context/global.context.jsx";

const PatientConditionsBox = ({ patient, user }) => {
  const gc = useGlobalContext();
  const { conditionData, updateConditions, setActivePatient } = gc || {};

  const [selectedCodes, setSelectedCodes] = useState([]);
  const [showAll, setShowAll] = useState(false);

  // --- helpers --------------------------------------------------------------
  const labelForCondition = (c) =>
    c?.conditionName ?? c?.name ?? c?.label ?? String(c ?? '');
  const codeForCondition = (c, fallbackLabel) =>
    c?.conditionCode ??
    c?.code ??
    c?.shortCode ??
    c?.abbr ??
    (fallbackLabel
      ? fallbackLabel.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
      : null);

  const parseCodes = (str) =>
    (str || '')
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

  // Normalize master list from context (array or object map)
  const normalizedConditions = useMemo(() => {
    if (Array.isArray(conditionData)) return conditionData;
    if (conditionData && typeof conditionData === 'object') {
      return Object.values(conditionData);
    }
    return [];
  }, [conditionData]);

  // Build items (all), derive selected-only for collapsed view
  const items = useMemo(() => {
    return normalizedConditions.map((c, idx) => {
      const label = labelForCondition(c);
      const code = codeForCondition(c, label);
      const id = `cond_${c?.ID || code || idx}`;
      const checked = !!code && selectedCodes.includes(code);
      return { id, label, code, checked, raw: c };
    });
  }, [normalizedConditions, selectedCodes]);

  const selectedItems = useMemo(() => items.filter((it) => it.checked), [items]);
  const visibleItems = showAll ? items : selectedItems;

  // --- persistence ----------------------------------------------------------
  const persistConditions = (codesArray) => {
    if (typeof setActivePatient === 'function') {
      setActivePatient((p) => ({ ...p, conditionData: codesArray.join(',') }));
    }
    try {
      fetch('https://gdmt.ca/PHP/database.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          script: 'updatePatientConditions',
          patientID: patient?.id,
          conditionCodes: codesArray.join(','),
          patientDB: user?.patientTable,
          historyDB: user?.historyTable,
        }),
      }).catch(() => {});
    } catch (_) {}
  };

  const toggleConditionCode = (code) => {
    if (!code || !patient?.id) return;
    setSelectedCodes((prev) => {
      const next = prev.includes(code)
        ? prev.filter((c) => c !== code)   // turn OFF
        : [...prev, code];                 // turn ON (only visible in Show All)
      persistConditions(next);
      return next;
    });
  };

  // --- effects --------------------------------------------------------------
  useEffect(() => {
    setSelectedCodes(parseCodes(patient?.conditionData ?? ''));
  }, [patient?.conditionData]);

  // Fetch master list once if needed
  const conditionsFetchedRef = useRef(false);
  useEffect(() => {
    if (
      !conditionsFetchedRef.current &&
      Array.isArray(conditionData) &&
      conditionData.length === 0 &&
      typeof updateConditions === 'function'
    ) {
      conditionsFetchedRef.current = true;
      fetch('https://gdmt.ca/PHP/database.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: 'getConditionData' }),
      })
        .then((resp) => resp.json())
        .then((data) => {
          if (Array.isArray(data?.conditions)) updateConditions(data.conditions);
          else if (Array.isArray(data)) updateConditions(data);
          else conditionsFetchedRef.current = false;
        })
        .catch(() => { conditionsFetchedRef.current = false; });
    }
  }, [conditionData?.length, updateConditions]);

  // --- render ---------------------------------------------------------------
  return (
    <div className="d-flex flex-column" style={{ flex: '1 1 0', minHeight: 0 }}>
      <div className="d-flex align-items-center justify-content-between mb-2 px-1">
        <div className="fw-semibold">Conditions</div>
      </div>

      <div className="flex-grow-1" style={{ overflowY: 'auto', minHeight: 0 }}>
        <div className="container-fluid px-1">
          <div className="row g-2">
            {visibleItems.length > 0 ? (
              visibleItems.map((it) => (
                <div key={it.id} className="col-24 col-md-18 col-lg-16">
                  <div className="border rounded p-2 d-flex align-items-center">
                    <span
                      className="flex-grow-1 min-w-0 text-truncate me-2 small"
                      title={it.label + (it.code ? ` (${it.code})` : '')}
                    >
                      {it.label}
                    </span>
                    <div className="form-check form-switch m-0">
                      <input
                        id={it.id}
                        type="checkbox"
                        className="form-check-input"
                        checked={!!it.checked}
                        onChange={() => toggleConditionCode(it.code)}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-48 text-muted small">
                <em>{showAll ? "No conditions available." : "No current conditions."}</em>
              </div>
            )}
          </div>

          {/* Bottom action inside the DragBox */}
          <div className="d-flex justify-content-center mt-3 pb-1">
            <button
              type="button"
              className={showAll ? "btn btn-sm btn-primary" : "btn btn-sm btn-outline-primary"}
              onClick={() => setShowAll((s) => !s)}
            >
              {showAll ? "Hide Unused" : "Show All"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientConditionsBox;
