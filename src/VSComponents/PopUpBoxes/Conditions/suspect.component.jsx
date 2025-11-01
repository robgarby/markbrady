// src/components/patient/patientConditionsBox.component.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalContext } from "../../../Context/global.context.jsx";
import DragBox from "../../DragBox/Drag/dragBox.component.jsx";

const SuspectConditionsBox = ({ patient, user }) => {
  const gc = useGlobalContext();
  const {
    conditionData,
    setActivePatient,
    selectedTopButtons,
    setSelectedTopButtons
  } = gc || {};

  // Selected codes (derived from patient.suspectedCon)
  const [selectedCodes, setSelectedCodes] = useState([]);

  // Helpers (same shapes you used)
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

  // Normalize condition list (array or object map)
  const normalizedConditions = useMemo(() => {
    if (Array.isArray(conditionData)) return conditionData;
    if (conditionData && typeof conditionData === 'object') {
      return Object.values(conditionData);
    }
    return [];
  }, [conditionData]);

  // Toggle & save (local mirror -> suspectedCon)
  const toggleConditionCode = (code) => {
    if (!code) return;
    const norm = String(code).toUpperCase();

    setSelectedCodes((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const next = safePrev.includes(norm)
        ? safePrev.filter((c) => c !== norm)
        : [...safePrev, norm];

      // Optional persist only if we actually have an ID
      // Mirror locally
      setActivePatient((p) => ({ ...p, suspectedCon: next.join(',') }));
      if (patient?.id) {
        try {
          fetch('https://gdmt.ca/PHP/database.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            keepalive: true,
            body: JSON.stringify({
              script: 'updatePatientSuspected',
              patientID: patient.id,
              conditionCodes: next.join(','),   // keeping your existing payload shape
              patientDB : user?.patientTable,
              historyDB : user?.historyTable,
            }),
          }).catch(() => {});
        } catch (_) {}
      }

      return next;
    });
  };

  // ----- Effects -----

  // Keep selectedCodes in sync with patient.suspectedCon (UPPERCASED)
  useEffect(() => {
    setSelectedCodes(parseCodes(patient?.suspectedCon ?? ''));
  }, [patient?.suspectedCon]); // ← key fix

  // Fetch master conditions once if empty (left as-is if you re-enable later)
  const conditionsFetchedRef = useRef(false);

  const closeBox = (boxKey) => () => {
    const updated = (selectedTopButtons || []).filter((b) => b !== boxKey);
    setSelectedTopButtons?.(updated);
  };

  // ----- Render -----
  const codes = Array.isArray(selectedCodes) ? selectedCodes : []; // render safety

  return (
    <DragBox
      id="SUSPECT_BOX"
      storageKey="SUSPECT_BOX_POSITION"
      defaultPos={{ x: 300, y: 280 }}
      title="Suspected Conditions [FULLY WORKING]"
      width={860}
      onAdd={null}
      zIndex={2050}
      addNote="-"
      onClose={closeBox("suspected")}
    >
      <div className="d-flex flex-column" style={{ flex: '1 1 0', minHeight: 0, backgroundColor: '#f7dbdbff' }}>
        <div className="flex-grow-1" style={{ overflowY: 'auto', minHeight: 0 }}>
          <div className="container-fluid px-1">
            <div className="row g-2">
              {normalizedConditions.map((c, idx) => {
                const label = labelForCondition(c);
                const code = codeForCondition(c, label);
                const normCode = (code || '').toUpperCase(); // normalize for compare
                const id = `cond_${c?.ID || normCode || idx}`;
                const checked = !!normCode && codes.includes(normCode);

                return (
                  <div key={id} className="col-24 col-md-18 col-lg-16">
                    <div className="border rounded p-2 d-flex align-items-center">
                      <span
                        className="flex-grow-1 min-w-0 text-truncate me-2 small"
                        title={`${label}${normCode ? ` (${normCode})` : ''}`}
                      >
                        {label}
                      </span>
                      <div className="form-check form-switch m-0">
                        <input
                          id={id}
                          type="checkbox"
                          className="form-check-input"
                          checked={checked}
                          onChange={() => toggleConditionCode(normCode)}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {normalizedConditions.length === 0 && (
                <div className="col-48 text-muted small">
                  <em>No conditions to display.</em>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DragBox>
  );
};

export default SuspectConditionsBox;
