// src/components/Patient/fullCondition.component.jsx
import React, { useMemo, useState } from "react";
import DragBox from "../../DragBox/Drag/dragBox.component.jsx";
import { useGlobalContext } from "../../../Context/global.context.jsx";

// Keep your existing components exactly as-is:
import PatientConditionBox from './patientCondition.component.jsx';
import EditConditions from "./editConditions.component.jsx";
/**
 * Props:
 * - user:           object (must include dayOfWeek)
 * - activePatient:  object (the current patient record)
 * - onPatientChange?: function(nextPatient)  // optional bubble-up if you want to sync parent state
 */
const FullCondition = ({ user, activePatient, onPatientChange }) => {
  const [mode, setMode] = useState("display"); // "display" | "edit"
  const { selectedTopButtons, setSelectedTopButtons } = useGlobalContext();

  const canEdit = useMemo(() => Number(user?.dayOfWeek ?? 0) === 1, [user?.dayOfWeek]);

  const handlePatientChange = (nextPatient) => {
    if (typeof onPatientChange === "function") onPatientChange(nextPatient);
  };

  const closeBox = (boxKey) => () => {
    const updated = (selectedTopButtons || []).filter((b) => b !== boxKey);
    setSelectedTopButtons?.(updated);
  };

  return (
    <DragBox
      id="CONDITIONS_BOX"
      storageKey="CONDITIONS_BOX_POSITION"
      defaultPos={{ x: 300, y: 280 }}
      title="Conditions [FULLY WORKING with Edit]"
      width={860}
      onAdd={null}
      zIndex={2050}
      addNote="-"
      onClose={closeBox("conditions")}
    >
      <div className="container-fluid px-0">
        {/* Header / controls */}
        <div className="d-flex align-items-center justify-content-between mb-2">
          <h6 className="m-0">Patient Conditions</h6>

        {user.dayOfWeek === 1 && (
          <div className="d-flex gap-2">
            {mode === "edit" ? (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setMode("display")}
              >
                Back to Patient
              </button>
            ) : (
              canEdit && (
                <button
                  className="btn btn-sm btn-outline-primary"
                  onClick={() => setMode("edit")}
                  title="Edit Conditions"
                >
                  Edit Conditions
                </button>
              )
            )}
          </div>
        )}
        </div>

        {/* Body */}
        <div className="card shadow-sm">
          <div className="card-body p-2">
            {mode === "edit" ? (
              <EditConditions
                user={user}
                patient={activePatient}
                onPatientChange={handlePatientChange}
              />
            ) : (
              <PatientConditionBox
                user={user}
                patient={activePatient}
                onPatientChange={handlePatientChange}
              />
            )}
          </div>
        </div>
      </div>
    </DragBox>
  );
};

export default FullCondition;
