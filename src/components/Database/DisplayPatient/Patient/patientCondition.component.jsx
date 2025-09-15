// src/components/patient/patientConditionsBox.component.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGlobalContext } from '../../../Context/global.context';

const PatientConditionsBox = ({ patient, setPatient }) => {
  const gc = useGlobalContext();
  const { conditionData, updateConditions } = gc || {};

  // Selected codes (derived from patient.conditionData)
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

  // Toggle & save
  const toggleConditionCode = (code) => {
    if (!code || !patient?.id) return;
    setSelectedCodes((prev) => {
      const next = prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [...prev, code];

      // Mirror locally
      setPatient((p) => ({ ...p, conditionData: next.join(',') }));

      // Persist (fire-and-forget)
      try {
        fetch('https://optimizingdyslipidemia.com/PHP/database.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
          body: JSON.stringify({
            script: 'updatePatientConditions',
            patientID: patient.id,
            conditionCodes: next.join(','),
          }),
        }).catch(() => {});
      } catch (_) {}

      return next;
    });
  };

  // ----- Effects -----

  // Keep selectedCodes in sync with patient
  useEffect(() => {
    setSelectedCodes(parseCodes(patient?.conditionData ?? ''));
  }, [patient?.conditionData]);

  // Fetch master conditions once if empty
  const conditionsFetchedRef = useRef(false);
  useEffect(() => {
    if (
      !conditionsFetchedRef.current &&
      Array.isArray(conditionData) &&
      conditionData.length === 0 &&
      typeof updateConditions === 'function'
    ) {
      conditionsFetchedRef.current = true;
      fetch('https://optimizingdyslipidemia.com/PHP/database.php', {
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
        .catch(() => {
          conditionsFetchedRef.current = false;
        });
    }
  }, [conditionData?.length, updateConditions]);

  // ----- Render -----
  return (
    <div className="d-flex flex-column" style={{ flex: '1 1 0', minHeight: 0 }}>
      <div className="flex-grow-1" style={{ overflowY: 'auto', minHeight: 0 }}>
        <div className="container-fluid px-1">
          <div className="row g-2">
            {normalizedConditions.map((c, idx) => {
              const label = labelForCondition(c);
              const code = codeForCondition(c, label);
              const id = `cond_${c?.ID || code || idx}`;
              const checked = !!code && selectedCodes.includes(code);

              return (
                <div key={id} className="col-24 col-md-16 col-lg-12">
                  <div className="border rounded p-2 d-flex align-items-center">
                    <span
                      className="flex-grow-1 min-w-0 text-truncate me-2 small"
                      title={`${label}${code ? ` (${code})` : ''}`}
                    >
                      {label}
                    </span>
                    <div className="form-check form-switch m-0">
                      <input
                        id={id}
                        type="checkbox"
                        className="form-check-input"
                        checked={checked}
                        onChange={() => toggleConditionCode(code)}
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
  );
};

export default PatientConditionsBox;
