// src/components/.../labResult.component.jsx
import React, { useState } from "react";

const isFilled = (v) => v !== undefined && v !== null && String(v).trim() !== "";

export default function LabResult({
  patient,              // { name, healthNumber, sex, dateOfBirth, orderDate, providerName, providerNumber, street, city, province, postalCode, telephone, labResults: {...} }
  setPatient,           // setter from parent
  patientStatus,        // "new" | "existing" | null
  labExists,            // boolean
  nextAppointment,      // string (YYYY-MM-DD) or ""
  setNextAppointment,   // setter for above
  onSave,               // () => Promise<{ ok: boolean } | any>
  onSavedOk,            // ✅ NEW: callback to parent to clear panel + reset uploaders
}) {
  const [saving, setSaving] = useState(false);

  if (!patient) return null;

  const handleSave = async () => {
    if (saving) return;

    setSaving(true);
    try {
      // Call the provided save function
      const res = await (typeof onSave === "function" ? onSave() : Promise.resolve({ ok: false }));

      // Interpret success: treat anything truthy (except explicit ok:false) as success
      const ok = (res && typeof res === "object") ? (res.ok !== false) : !!res;

      if (ok) {
        // ✅ Tell parent to remove the entire LabResult box and reset uploaders
        if (typeof onSavedOk === "function") onSavedOk();

        // (No partial clearing here—panel will unmount.)
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mt-3">
      {/* Patient summary + action */}
      <div className="row g-2">
        <div className="col-48 d-flex gap-2 flex-wrap">
          {/* Patient Card */}
          <div className="card col-36">
            <div className="card-header">Patient</div>
            <div className="card-body">
              {/* Identity */}
              <div className="row mb-2">
                <div className="col-24 col-md-12">
                  <strong>Name:</strong> {patient.name || "—"}
                </div>
                <div className="col-24 col-md-12">
                  <strong>HCN:</strong> {patient.healthNumber || "—"}
                </div>
              </div>

              {/* Demographics */}
              <div className="row mb-2">
                <div className="col-12"><strong>Sex:</strong> {patient.sex || "—"}</div>
                <div className="col-12"><strong>DOB:</strong> {patient.dateOfBirth || "—"}</div>
                <div className="col-24"><strong>Order Date:</strong> {patient.orderDate || "—"}</div>
              </div>

              {/* Provider */}
              <div className="row mb-2">
                <div className="col-48">
                  <strong>Provider:</strong>{" "}
                  {patient.providerName || "—"}{" "}
                  {patient.providerNumber ? `(${patient.providerNumber})` : ""}
                </div>
              </div>

              {/* Address (read-only, green if filled) */}
              <div className="row g-2">
                <div className="col-24">
                  <input
                    className={`form-control ${isFilled(patient.street) ? "alert-success" : ""}`}
                    value={patient.street || ""}
                    readOnly
                    placeholder="Street"
                  />
                </div>
                <div className="col-12">
                  <input
                    className={`form-control ${isFilled(patient.city) ? "alert-success" : ""}`}
                    value={patient.city || ""}
                    readOnly
                    placeholder="City"
                  />
                </div>
                <div className="col-6">
                  <input
                    className={`form-control ${isFilled(patient.province) ? "alert-success" : ""}`}
                    value={patient.province || ""}
                    readOnly
                    placeholder="Province"
                  />
                </div>
                <div className="col-6">
                  <input
                    className={`form-control ${isFilled(patient.postalCode) ? "alert-success" : ""}`}
                    value={patient.postalCode || ""}
                    readOnly
                    placeholder="Postal"
                  />
                </div>
                <div className="col-12">
                  <input
                    className={`form-control ${isFilled(patient.telephone) ? "alert-success" : ""}`}
                    value={patient.telephone || ""}
                    readOnly
                    placeholder="Phone"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Action Panel */}
          <div className="col-11">
            <div className="d-flex flex-column justify-content-center align-items-center h-100 border rounded p-3">
              {labExists ? (
                <div className="alert alert-danger text-center m-0 w-100">
                  This Lab Exists in DB
                </div>
              ) : (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className={`btn text-white ${patientStatus === "new" ? "btn-success" : "btn-warning"}`}
                  style={{ minWidth: 220 }}
                >
                  {saving
                    ? "Saving..."
                    : patientStatus === "new"
                    ? "Add New Patient"
                    : "Update Existing Client"}
                </button>
              )}

              <div className="w-100 mt-3">
                <label className="form-label mb-1">Next Appointment</label>
                <input
                  type="date"
                  className="form-control"
                  value={nextAppointment || ""}
                  onChange={(e) => setNextAppointment && setNextAppointment(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Current Lab (editable fields) */}
      <div className="row g-3 mt-3">
        <div className="col-48">
          <div className="card">
            <div className="card-header">Current Lab</div>
            <div className="card-body">
              <div className="row g-2">
                {Object.entries(patient.labResults || {}).map(([key, value]) => (
                  <div key={key} className="col-24 d-flex align-items-center">
                    <div className="col-18 text-end pe-2 fw-bold text-capitalize" style={{ textTransform: "none" }}>
                      {key}:
                    </div>
                    <div className="col-6">
                      <input
                        type="text"
                        className={`form-control ${isFilled(value) ? "alert-success" : ""}`}
                        value={value || ""}
                        onChange={(e) =>
                          setPatient((prev) => ({
                            ...prev,
                            labResults: { ...(prev?.labResults || {}), [key]: e.target.value },
                          }))
                        }
                        placeholder="—"
                      />
                    </div>
                  </div>
                ))}

                {(!patient.labResults || Object.keys(patient.labResults).length === 0) && (
                  <div className="text-muted">No lab values parsed.</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
