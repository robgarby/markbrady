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
  // UI mode: collapsed = only selected; expanded = all
  const [showAll, setShowAll] = useState(false);

  // ---------- helpers ----------
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

  // Normalize master condition list
  const normalizedConditions = useMemo(() => {
    if (Array.isArray(conditionData)) return conditionData;
    if (conditionData && typeof conditionData === 'object') {
      return Object.values(conditionData);
    }
    return [];
  }, [conditionData]);

  // Build items with checked flag
  const items = useMemo(() => {
    const sel = Array.isArray(selectedCodes) ? selectedCodes : [];
    return normalizedConditions.map((c, idx) => {
      const label = labelForCondition(c);
      const code = (codeForCondition(c, label) || '').toUpperCase();
      const id = `sus_${c?.ID || code || idx}`;
      const checked = !!code && sel.includes(code);
      return { id, label, code, checked, raw: c };
    });
  }, [normalizedConditions, selectedCodes]);

  // What to render in current mode
  const selectedItems = useMemo(() => items.filter(i => i.checked), [items]);
  const visibleItems = showAll ? items : selectedItems;

  // ---------- persist ----------
  const persistSuspected = (codesArray) => {
    // mirror locally
    setActivePatient?.((p) => ({ ...p, suspectedCon: codesArray.join(',') }));

    // optional server save if we have an ID
    if (!patient?.id) return;
    try {
      fetch('https://gdmt.ca/PHP/database.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          script: 'updatePatientSuspected',
          patientID: patient.id,
          conditionCodes: codesArray.join(','), // same payload as before
          patientDB: user?.patientTable,
          historyDB: user?.historyTable,
        }),
      }).catch(() => {});
    } catch (_) {}
  };

  const toggleConditionCode = (code) => {
    if (!code) return;
    setSelectedCodes((prev) => {
      const safePrev = Array.isArray(prev) ? prev : [];
      const next = safePrev.includes(code)
        ? safePrev.filter((c) => c !== code) // turn OFF
        : [...safePrev, code];               // turn ON (visible in Show All)
      persistSuspected(next);
      return next;
    });
  };

  // ---------- effects ----------
  // keep local selection synced with patient.suspectedCon
  useEffect(() => {
    setSelectedCodes(parseCodes(patient?.suspectedCon ?? ''));
  }, [patient?.suspectedCon]);

  // Close handler for DragBox
  const closeBox = (boxKey) => () => {
    const updated = (selectedTopButtons || []).filter((b) => b !== boxKey);
    setSelectedTopButtons?.(updated);
  };

  // ---------- render ----------
  return (
    <DragBox
      id="SUSPECT_BOX"
      storageKey="SUSPECT_BOX_POSITION"
      defaultPos={{ x: 300, y: 280 }}
      title="Suspected Conditions"
      width={860}
      onAdd={null}
      zIndex={2050}
      addNote="-"
      onClose={closeBox("suspected")}
    >
      {/* Keep light pink background at all times */}
      <div
        className="d-flex flex-column"
        style={{ flex: '1 1 0', minHeight: 0, backgroundColor: '#f7dbdbff' }}
      >
        <div className="flex-grow-1" style={{ overflowY: 'auto', minHeight: 0 }}>
          <div className="container-fluid px-1">
            <div className="row g-2">
              {visibleItems.length > 0 ? (
                visibleItems.map((it) => (
                  <div key={it.id} className="col-24 col-md-18 col-lg-16">
                    <div className="border rounded p-2 d-flex align-items-center">
                      <span
                        className="flex-grow-1 min-w-0 text-truncate me-2 small"
                        title={`${it.label}${it.code ? ` (${it.code})` : ''}`}
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
                  <em>{showAll ? "No conditions available." : "No suspected conditions."}</em>
                </div>
              )}
            </div>

            {/* Bottom control stays inside the pink DragBox content */}
            <div className="d-flex justify-content-center mt-3 pb-2">
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
    </DragBox>
  );
};

export default SuspectConditionsBox;
