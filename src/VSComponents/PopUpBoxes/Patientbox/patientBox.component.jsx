import React from "react";

import { useGlobalContext } from '../../../Context/global.context';
import { getRecommendationText } from "../../../Context/variables";
import { getUserFromToken } from "../../../Context/functions";
import { useNavigate } from "react-router-dom";

export default function PatientInfo({ user, thePatient, loading = false }) {

  const gc = useGlobalContext();
  const {
    setActivePatient,
    patientProvider,
    setDisplayMain,
    mainButton,
    setMainButton
  } = gc || {};

  const navigate = useNavigate();

  const [patient, setPatient] = React.useState([]);
  const [providerId, setProviderId] = React.useState("");   // <-- use proper setter name
  const currentPayment = patient?.paymentMethod || patient?.paymentMethof || '?';
  const [recommendedMeds, setRecommendedMeds] = React.useState([]);

  // --- Local modal state lives in patientBox now ---
  const [showRecModal, setShowRecModal] = React.useState(false);
  const [recTitle, setRecTitle] = React.useState("Recommendation");
  const [recText, setRecText] = React.useState("");
  const [currentKey, setCurrentKey] = React.useState("");

  const changeMainDisplay = (button) => {
    if (button === mainButton) {
      setMainButton(null);
      setDisplayMain(false);
      return;
    }
    setMainButton(button);
    setDisplayMain(true);
  }

  React.useEffect(() => {
    // parse recommendedMeds (CSV / semicolon / newline or already-array) into an array
    const rawMeds = thePatient?.recommendedMed ?? '';
    let meds = [];
    if (Array.isArray(rawMeds)) {
      meds = rawMeds.map(String).map(s => s.trim()).filter(Boolean);
    } else if (typeof rawMeds === 'string') {
      meds = rawMeds.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    }
    setRecommendedMeds(meds);

    // copy patient in
    setPatient(thePatient);

    // sync providerId state from incoming patient (as a string for the <select>)
    const incomingProviderId =
      thePatient?.providerId != null ? String(thePatient.providerId) : "";
    setProviderId(incomingProviderId);
  }, [thePatient]);

  const calculateAge = (dob) => {
    if (!dob) return "—";
    const birthDate = new Date(dob);
    if (isNaN(birthDate.getTime())) return "—";
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age >= 0 ? age : "—";
  };

  const setPaymentMethod = (methodLabel) => {
    const method = methodLabel; // keep labels exactly: 'CASH' | 'Government' | 'Private' | '?'
    setPatient((prev) => {
      const next = { ...prev, paymentMethod: method, paymentMethof: method }; // mirror both keys for safety
      if (typeof setActivePatient === 'function') setActivePatient(next);
      return next;
    });
    if (!patient?.id) return;
    fetch('https://gdmt.ca/PHP/database.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        script: 'updatePaymentMethod',
        patientID: patient.id,
        paymentMethod: method,
        patientDB: user?.patientTable || "Patient",
        historyDB: user?.historyTable || "Patient_History"
      }),
    }).catch(() => { });
  };

  const SetAppointment = (dateStr) => {
    const iso = dateStr ? new Date(dateStr).toISOString().slice(0, 10) : null;
    setPatient((prev) => {
      const next = { ...prev, nextAppointment: iso };
      if (typeof setActivePatient === 'function') setActivePatient(next);
      return next;
    });
    if (!patient?.id) return;
    fetch('https://gdmt.ca/PHP/database.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        script: 'updateAppointment',
        patientID: patient.id,
        appointmentDate: iso,
        patientDB: user?.patientTable || "Patient",
        historyDB: user?.historyTable || "Patient_History"
      }),
    }).catch(() => { });
  };

  // --- Modal helpers (now owned by patientBox) ---
  const openRecModal = (keyOrLabel) => {
    const key = String(keyOrLabel || "").trim().toLowerCase();
    const text = getRecommendationText(key) || String(keyOrLabel || "");
    setCurrentKey(key);
    setRecTitle(`Recommendation: ${String(keyOrLabel || "").toUpperCase()}`);
    setRecText(text);
    setShowRecModal(true);
  };

  const closeRecModal = () => setShowRecModal(false);

  const UpdateRecommendations = async () => {
    // Auth guard
    const userData = await getUserFromToken();
    if (!userData) {
      navigate("/login");
      return;
    }

    // Current recommendations as plain text
    const existingText = String(thePatient?.recommendations || "").trim();

    // What we plan to add (from the modal)
    const candidate = String(recText || "").trim();
    if (!candidate) {
      console.log("No recommendation text to add");
      return;
    }

    // The key we use to detect duplicates (prefer the normalized currentKey)
    const key = String(currentKey || "").trim().toLowerCase();

    // Duplicate detection: check by key if available, otherwise by full candidate text
    const lowerExisting = existingText.toLowerCase();
    const exists =
      (key && lowerExisting.includes(key)) ||
      lowerExisting.includes(candidate.toLowerCase());

    if (exists) {
      console.log("Already exists:", key || candidate.slice(0, 40));
      setShowRecModal(false);
      return;
    }

    // Append neatly (two newlines between blocks if something is already there)
    const updatedText = existingText ? `${existingText}\n\n${candidate}` : candidate;

    // Update local state
    const updatedPatient = { ...thePatient, recommendations: updatedText };
    setPatient(updatedPatient);
    if (typeof setActivePatient === "function") setActivePatient(updatedPatient);

    const patientDB = userData?.patientTable || "Patient";
    const historyDB = userData?.historyTable || "Patient_History";
    try {
      await fetch("https://gdmt.ca/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "updateRecommendations",
          patientID: thePatient.id,
          recommendations: updatedText,
          patientDB: patientDB,
          historyDB: historyDB,
        }),
      });
    } catch (e) {
      console.log("Error updating recommendations:", e);
    }
    setShowRecModal(false);
  };

  // Map button click → open local modal with text from variables.jsx
  const handleMapClick = (evt, fallback) => {
    const v = evt?.currentTarget?.value ?? fallback ?? "";
    openRecModal(v);
  };

  // NEW: proper provider change handler
  const handleProviderChange = (val) => {
    console.log("Setting providerId:", val);
    console.log("previous patient:", patient);

    const newProviderId = val || ""; // keep as string for the <select>

    // local state for the select
    setProviderId(newProviderId);

    // update patient + global active patient
    setPatient((prev) => {
        const next = {
            ...prev,
            providerId: newProviderId,
        };

        // sync to GlobalContext, but only if available
        if (typeof setActivePatient === "function") {
            setActivePatient(next);
        }

        return next;
    });

    // fire-and-forget DB update
    if (!patient?.id) return; // nothing to save yet

    fetch("https://gdmt.ca/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            script: "updateProvider",
            patientID: patient.id,
            providerId: newProviderId,
            patientDB: user?.patientTable || "Patient",
            historyDB: user?.historyTable || "Patient_History",
        }),
    }).catch((e) => {
        console.log("Error updating provider:", e);
    });
};


  return (
    <>
      {patient && !loading && (
        <div className="d-flex" style={{ flex: '0 0 auto' }}>
          <div className="col-48 mt-0 rounded offset-0 p-3 alert-secondary">
            <h3 className="mb-3 text-dark">
              {patient.clientName} [Age: {calculateAge(patient.dateOfBirth)}]
            </h3>

            <div className="mb-1">
              <div className="row align-items-center g-4 fs-7 mb-4">
                {/* Left info */}
                <div className="col-auto fw-bold text-start">
                  Health Number: {patient.healthNumber}
                </div>
                <div className="col-auto text-start">
                  Sex: {patient.sex}
                </div>
                <div className="col-auto text-start">
                  Date of Birth: {patient.dateOfBirth}
                </div>

                {/* Right side: pushed to the edge */}
                <div className="col-auto ms-auto d-flex align-items-center gap-2 pe-3">
                  <div className="text-end pe-1">Medication Recommendations:</div>
                  <div className="d-flex flex-wrap gap-1 me-3">
                    {Array.isArray(recommendedMeds) && recommendedMeds.length > 0 ? (
                      recommendedMeds.map((med, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className=" ms-1 btn btn-sm btn-outline-warning"
                          value={med}
                          onClick={(e) => handleMapClick(e, med)}
                        >
                          {med}
                        </button>
                      ))
                    ) : (
                      <span className="text-muted">No recommendations</span>
                    )}
                  </div>
                  <div className="text-end fw-bold fs-7">
                    Naive LDLC: <span className="text-purple">N/A</span>
                  </div>
                </div>
              </div>

              <div
                className="alert alert-light p-2 d-flex gap-3 flex-wrap"
                role="region"
                aria-label="Patient additional information"
              >
                <div className="d-flex mt-1  flex-column col-16" >
                  <label className="form-label mb-1">Medication Coverage</label>
                  <div className="d-flex w-100" role="group" aria-label="Payment method">
                    {/* ? */}
                    <input
                      type="radio"
                      className="btn-check col-12"
                      name="paymentMethod"
                      id="pm-unknown"
                      autoComplete="off"
                      checked={currentPayment === '?'}
                      onChange={() => setPaymentMethod('?')}
                    />
                    <label
                      className={`btn btn-sm flex-grow-1 ${currentPayment === '?' ? 'btn-primary' : 'btn-outline-primary'}`}
                      htmlFor="pm-unknown"
                      style={{ minWidth: 0 }}
                    >?</label>
                    {/* CASH */}
                    <input
                      type="radio"
                      className="btn-check col-12"
                      name="paymentMethod"
                      id="pm-cash"
                      autoComplete="off"
                      checked={currentPayment.toUpperCase() === 'CASH'}
                      onChange={() => setPaymentMethod('CASH')}
                    />
                    <label
                      className={`btn btn-sm flex-grow-1 ${currentPayment.toUpperCase() === 'CASH' ? 'btn-primary' : 'btn-outline-primary'}`}
                      htmlFor="pm-cash"
                      style={{ minWidth: 0 }}
                    >CASH</label>
                    {/* Government */}
                    <input
                      type="radio"
                      className="btn-check col-12"
                      name="paymentMethod"
                      id="pm-gov"
                      autoComplete="off"
                      checked={currentPayment.toLowerCase() === 'government'}
                      onChange={() => setPaymentMethod('Government')}
                    />
                    <label
                      className={`btn btn-sm col-12 ${currentPayment.toLowerCase() === 'government' ? 'btn-primary' : 'btn-outline-primary'}`}
                      htmlFor="pm-gov"
                      style={{ minWidth: 0 }}
                    >Government</label>
                    {/* Private */}
                    <input
                      type="radio"
                      className="btn-check col-12"
                      name="paymentMethod"
                      id="pm-private"
                      autoComplete="off"
                      checked={currentPayment.toLowerCase() === 'private'}
                      onChange={() => setPaymentMethod('Private')}
                    />
                    <label
                      className={`btn btn-sm col-12 ${currentPayment.toLowerCase() === 'private' ? 'btn-primary' : 'btn-outline-primary'}`}
                      htmlFor="pm-private"
                      style={{ minWidth: 0 }}
                    >Private</label>
                  </div>
                </div>
                {/* Next Appointment (narrower) */}
                <div className="d-flex align-items-end col-6">
                  <div className="w-100">
                    <label className="form-label mb-1">Next Appointment</label>
                    <div className="input-group input-group-sm">
                      <span className="input-group-text" aria-hidden="true">📅</span>
                      <input
                        type="date"
                        id="nextAppointment"
                        className="form-control form-control-sm"
                        value={patient.nextAppointment ? patient.nextAppointment.substring(0, 10) : ''}
                        onChange={(e) => SetAppointment(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="col-6">
                  {/* line above */}
                  <div className="text-start">
                    <label className="form-label mb-1">Provider</label>
                  </div>

                  {/* select below */}
                  <select
                    className={`form-select fs-7 ${providerId ? "alert-success" : ""}`}
                    value={providerId || ""}
                    onChange={(e) => {
                      const val = e.target.value || ""; // "" -> ""
                      handleProviderChange(val);
                    }}
                  >
                    <option value="">Select Provider</option>
                    {Array.isArray(patientProvider) &&
                      patientProvider.map((p) => {
                        const id = p?.id != null ? String(p.id) : "";
                        const label = String(p?.providerName ?? p?.name ?? p?.displayName ?? id);
                        return (
                          <option key={id || label} value={id}>
                            {label}
                          </option>
                        );
                      })}
                  </select>
                </div>
                {user?.userName !== 'Molly' && (
                  <div className="d-flex align-content-center col-8">
                    <div className="w-100 mb-1">
                      <label
                        htmlFor="nextAppointment"
                        className="form-label mb-1"
                      >
                        Upload
                      </label>
                      <div className="d-flex gap-1 align-content-center">
                        <div className="col-16">
                          <button
                            className={`btn-sm btn  w-100 fs-7 ${
                              mainButton === 'dynacare' ? 'btn-warning' : 'btn-outline-primary'
                            }`}
                            onClick={() => changeMainDisplay('dynacare')}
                          >
                            Dynacare
                          </button>
                        </div>
                        <div className="col-16">
                          <button
                            className={`btn-sm btn  w-100 fs-7 ${
                              mainButton === 'lifelab' ? 'btn-warning' : 'btn-outline-primary'
                            }`}
                            onClick={() => changeMainDisplay('lifelab')}
                          >
                            Life Lab
                          </button>
                        </div>
                        <div className="col-16">
                          <button
                            className={`btn-sm btn disabled  w-100 fs-7 ${
                              mainButton === 'newLab' ? 'btn-warning' : 'btn-outline-primary'
                            }`}
                            onClick={() => changeMainDisplay('newLab')}
                          >
                            new Lab
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {user?.userName !== 'Molly' && (
                  <div className="d-flex align-content-center col-8 offset-1">
                    <div className="w-100 mb-1">
                      <label
                        htmlFor="nextAppointment"
                        className="form-label mb-1"
                      >
                        Special
                      </label>
                      <div className="d-flex gap-1 align-content-center">
                        <div className="col-16">
                          <button
                            className={`btn-sm btn  w-100 fs-7 ${
                              mainButton === 'hospital' ? 'btn-warning' : 'btn-outline-primary'
                            }`}
                            onClick={() => changeMainDisplay('hospital')}
                          >
                            Hospital
                          </button>
                        </div>
                        <div className="col-16">
                          <button
                            className={`btn-sm btn  w-100 fs-7 ${
                              mainButton === 'pharmacy' ? 'btn-warning' : 'btn-outline-primary'
                            }`}
                            onClick={() => changeMainDisplay('pharmacy')}
                          >
                            Pharmacy
                          </button>
                        </div>
                        <div className="col-16">
                          <button
                            className={`btn-sm btn  w-100 fs-7 ${
                              mainButton === 'alergy' ? 'btn-warning' : 'btn-outline-primary'
                            }`}
                            onClick={() => changeMainDisplay('alergy')}
                          >
                            Alergy
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* --- Local Modal rendered here --- */}
            {showRecModal && (
              <div
                className="modal fade show"
                role="dialog"
                aria-modal="true"
                style={{ display: "block", background: "rgba(0,0,0,0.4)" }}
              >
                <div className="modal-dialog modal-lg modal-dialog-centered">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h5 className="modal-title">{recTitle}</h5>
                      <button
                        type="button"
                        className="btn-close"
                        onClick={closeRecModal}
                        aria-label="Close"
                      />
                    </div>
                    <div className="modal-body">
                      <pre className="mb-0" style={{ whiteSpace: "pre-wrap" }}>
                        {recText}
                      </pre>
                    </div>
                    <div className="modal-footer">
                      <button className="btn btn-secondary" onClick={closeRecModal}>
                        Cancel
                      </button>
                      <button className="btn btn-primary" onClick={UpdateRecommendations}>
                        Add This Recommendation
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
