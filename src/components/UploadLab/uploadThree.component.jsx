// src/components/.../uploadThree.component.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Dynacare from "./dynacare.component.jsx";
import LabResult from "./labResult.component.jsx";
import LifeLab from "./lifelab.component.jsx";
import ReadHospitalConditions from "./readHospital.component";
import { useGlobalContext } from "../../Context/global.context";

export default function UploadThree() {
  const navigate = useNavigate();

  const [labData, setLabData] = useState(null);
  const [nextAppointment, setNextAppointment] = useState(null);
  const [saveFn, setSaveFn] = useState(null);

  // 🔑 Split the reset keys so we don't nuke Hospital when hospital parses
  const [labUploaderKey, setLabUploaderKey] = useState(0); // Dynacare + LifeLab
  const [hospitalKey, setHospitalKey] = useState(0);       // Hospital panel only

  // ADDED: simple success modal state
  const [showSavedModal, setShowSavedModal] = useState(false);

  const gc = useGlobalContext() || {};
  const {
    conditionData,
    updateConditionData,
    medsArray,
    updateMedsArray,
    updateMedsCategory,
  } = gc;

  // -------- One-time bootstrap: conditions --------
  const didRunCondRef = useRef(false);
  useEffect(() => {
    if (didRunCondRef.current) return;
    didRunCondRef.current = true;

    if (!(Array.isArray(conditionData) && conditionData.length === 0)) return;

    (async () => {
      try {
        const resp = await fetch("https://optimizingdyslipidemia.com/PHP/special.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: "loadConditionData" }),
        });
        if (!resp.ok) return;
        const payload = await resp.json();
        const list = Array.isArray(payload?.conditions) ? payload.conditions
          : Array.isArray(payload) ? payload
            : [];
        if (list.length && typeof updateConditionData === "function") {
          updateConditionData(list);
        }
      } catch (err) {
        console.error("Failed to load conditionData:", err);
      }
    })();
  }, []);

  // -------- One-time bootstrap: meds --------
  const didRunMedsRef = useRef(false);
  useEffect(() => {
    if (didRunMedsRef.current) return;
    didRunMedsRef.current = true;

    const need = !Array.isArray(medsArray) || medsArray.length === 0;
    if (!need || !updateMedsArray) return;

    (async () => {
      try {
        const resp = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: "getMeds" }),
        });
        const text = await resp.text();
        let data = null;
        try { data = JSON.parse(text); } catch { }

        const meds = Array.isArray(data?.meds) ? data.meds
          : Array.isArray(data) ? data
            : [];
        if (meds.length) updateMedsArray(meds);
        if (Array.isArray(data?.cats) && typeof updateMedsCategory === "function") {
          updateMedsCategory(data.cats);
        }
      } catch (err) {
        console.error("Failed to load medsArray:", err);
      }
    })();
  }, []);

  // -------- Child callbacks --------

  // When a LAB (Dynacare/LifeLab) is parsed → open LabResult AND clear Hospital UI
  const handleParsed = useCallback((data) => {
    setLabData(data);
    setNextAppointment(null);
    setSaveFn(null);
    // Clear Hospital (only hospital, not the whole row)
    setHospitalKey((k) => k + 1);
  }, []);

  const handleBindSave = useCallback((maybeGetter) => {
    let realSave = maybeGetter;
    if (typeof maybeGetter === "function") {
      const candidate = maybeGetter();
      if (typeof candidate === "function") realSave = candidate;
    }
    setSaveFn(() => (typeof realSave === "function" ? realSave : maybeGetter));
  }, []);

  const setPatientStable = useCallback((updater) => {
    setLabData((prev) => {
      if (!prev) return prev;
      const updatedPatient =
        typeof updater === "function" ? updater(prev.patient) : updater;
      return { ...prev, patient: updatedPatient };
    });
  }, []);

  const handleSave = useCallback(() => {
    if (typeof saveFn === "function" && labData?.patient) {
      return saveFn(nextAppointment, labData.patient, labData.patientStatus);
    }
  }, [saveFn, nextAppointment, labData]);

  // After LabResult save-success: clear everything & reset both sides
  const clearForNextUpload = useCallback(() => {
    setLabData(null);
    setNextAppointment(null);
    setSaveFn(null);
    setLabUploaderKey((k) => k + 1); // reset lab uploaders
    setHospitalKey((k) => k + 1);    // reset hospital panel

    // ADDED: show confirmation modal after successful save & clear
    setShowSavedModal(true);
  }, []);

  // ---------- Hospital-specific ----------

  // When hospital is parsed → hide any LabResult and reset ONLY the lab uploaders
  const handleHospitalParsed = useCallback(() => {
    // Close LabResult if it was open
    setLabData(null);
    setNextAppointment(null);
    setSaveFn(null);
    // IMPORTANT: reset only the lab uploaders so the hospital panel stays mounted with its parsed data
    setLabUploaderKey((k) => k + 1);
  }, []);

  // NEW: when the Hospital save finishes successfully
  const handleHospitalSaved = useCallback(() => {
    // mirror the lab success clear
    setLabData(null);
    setNextAppointment(null);
    setSaveFn(null);
    setLabUploaderKey((k) => k + 1); // reset lab uploaders
    setHospitalKey((k) => k + 1);    // reset hospital panel

    // show the same success modal
    setShowSavedModal(true);
  }, []);


  // When "Save Hospital Report (Reset)" is pressed → full reset (no DB save)
  const handleHospitalReset = useCallback(() => {
    clearForNextUpload();
  }, [clearForNextUpload]);

  return (
    <div className="container mt-2">
      {/* Back to Dashboard */}
      <div className="mb-2">
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={() => navigate("/dashboard")}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* Uploaders row */}
      <div className="d-flex flex-wrap gap-1 justify-content-between">
        {/* Lab uploaders (key only here) */}
        <div className="col-15" key={`dyn-${labUploaderKey}`}>
          <div className="card h-100">
            <div className="card-body">
              <div className="col-48 text-center mb-3 fw-bold">Dynacare Labs</div>
              <Dynacare onParsed={handleParsed} onBindSave={handleBindSave} />
            </div>
          </div>
        </div>

        <div className="col-15" key={`life-${labUploaderKey}`}>
          <div className="card h-100">
            <div className="card-body">
              <div className="col-48 text-center mb-3 fw-bold">LifeLabs Labs</div>
              <LifeLab onParsed={handleParsed} onBindSave={handleBindSave} />
            </div>
          </div>
        </div>

        {/* Hospital panel (separate key so it won't be remounted on hospital parse) */}
        <div className="col-15" key={`hosp-${hospitalKey}`}>
          <div className="card h-100">
            <div className="card-body">
              <div className="col-48 text-center mb-3 fw-bold">Hospital Discharge</div>
              <ReadHospitalConditions
                onHospitalParsed={handleHospitalParsed}
                onHospitalReset={handleHospitalReset}
                onHospitalSaved={handleHospitalSaved}   // <-- NEW
              />
            </div>
          </div>
        </div>
      </div>

      {/* LabResult panel (only when a lab is parsed) */}
      {labData?.patient && (
        <LabResult
          patient={labData.patient}
          setPatient={setPatientStable}
          patientStatus={labData.patientStatus}
          labExists={labData.labExists}
          nextAppointment={nextAppointment}
          setNextAppointment={setNextAppointment}
          onSave={handleSave}
          onSavedOk={clearForNextUpload}
        />
      )}

      {/* ADDED: Minimal modal, no dependency changes */}
      {showSavedModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed-top w-100 h-100 d-flex align-items-center justify-content-center"
          style={{ background: "rgba(0,0,0,0.5)", zIndex: 1050 }}
          onClick={() => setShowSavedModal(false)}
        >
          <div
            className="bg-white rounded shadow p-4"
            style={{ maxWidth: 480, width: "92%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h5 className="mb-2 text-success">Information saved</h5>
            <p className="mb-3">
              It is safe to remove the file from your computer.
            </p>
            <div className="text-end">
              <button
                className="btn btn-primary"
                onClick={() => setShowSavedModal(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
