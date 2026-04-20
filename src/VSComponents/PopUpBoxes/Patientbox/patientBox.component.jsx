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
  const [providerId, setProviderId] = React.useState("");
  const currentPayment = patient?.paymentMethod || patient?.paymentMethof || '?';
  const [recommendedMeds, setRecommendedMeds] = React.useState([]);

  const [showRecModal, setShowRecModal] = React.useState(false);
  const [recTitle, setRecTitle] = React.useState("Recommendation");
  const [recText, setRecText] = React.useState("");
  const [currentKey, setCurrentKey] = React.useState("");

  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editName, setEditName] = React.useState("");
  const [editHealthNumber, setEditHealthNumber] = React.useState("");
  const [savingEdit, setSavingEdit] = React.useState(false);

  const changeMainDisplay = (button) => {
    if (button === mainButton) {
      setMainButton(null);
      setDisplayMain(false);
      return;
    }
    setMainButton(button);
    setDisplayMain(true);
  };

  const openDoctorPrint = () => {
    setActivePatient(patient || thePatient || null);
    navigate("/print");
  };

  React.useEffect(() => {
    const rawMeds = thePatient?.recommendedMed ?? '';
    let meds = [];
    if (Array.isArray(rawMeds)) {
      meds = rawMeds.map(String).map(s => s.trim()).filter(Boolean);
    } else if (typeof rawMeds === 'string') {
      meds = rawMeds.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
    }
    setRecommendedMeds(meds);

    setPatient(thePatient);

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

  const formatHealthNumber = (value) => {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 10);
    if (digits.length <= 4) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 4)} ${digits.slice(4)}`;
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
  };

  const digitsOnlyHealthNumber = (value) => {
    return String(value || "").replace(/\D/g, "").slice(0, 10);
  };

  const copyHealthNumber = async () => {
    const rawHCN = digitsOnlyHealthNumber(patient?.healthNumber || "");
    if (!rawHCN) return;

    try {
      await navigator.clipboard.writeText(rawHCN);
    } catch (e) {
      console.log("Could not copy health number:", e);
    }
  };

  const openEditModal = () => {
    setEditName(String(patient?.clientName || ""));
    setEditHealthNumber(digitsOnlyHealthNumber(patient?.healthNumber || ""));
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    if (savingEdit) return;
    setShowEditModal(false);
  };

  const savePatientBasics = async () => {
    const cleanedName = String(editName || "").trim();
    const rawDigits = digitsOnlyHealthNumber(editHealthNumber);
    const formattedHCN = formatHealthNumber(rawDigits);

    if (!cleanedName || rawDigits.length !== 10 || !patient?.id) {
      return;
    }

    setSavingEdit(true);

    const updatedPatient = {
      ...patient,
      clientName: cleanedName,
      healthNumber: formattedHCN,
      healthNumberRaw: rawDigits,
    };

    setPatient(updatedPatient);
    if (typeof setActivePatient === "function") {
      setActivePatient(updatedPatient);
    }

    try {
      await fetch("https://gdmt.ca/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "updatePatientBasicInfo",
          patientID: patient.id,
          clientName: cleanedName,
          healthNumber: formattedHCN,
          healthNumberRaw: rawDigits,
          patientDB: user?.patientTable || "Patient",
          historyDB: user?.historyTable || "Patient_History",
        }),
      });

      setShowEditModal(false);
    } catch (e) {
      console.log("Error updating patient basic info:", e);
    } finally {
      setSavingEdit(false);
    }
  };

  const setPaymentMethod = (methodLabel) => {
    const method = methodLabel;
    setPatient((prev) => {
      const next = { ...prev, paymentMethod: method, paymentMethof: method };
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
    const userData = await getUserFromToken();
    if (!userData) {
      navigate("/login");
      return;
    }

    const existingText = String(thePatient?.recommendations || "").trim();
    const candidate = String(recText || "").trim();
    if (!candidate) {
      return;
    }

    const key = String(currentKey || "").trim().toLowerCase();
    const lowerExisting = existingText.toLowerCase();
    const exists =
      (key && lowerExisting.includes(key)) ||
      lowerExisting.includes(candidate.toLowerCase());

    if (exists) {
      setShowRecModal(false);
      return;
    }

    const updatedText = existingText ? `${existingText}\n\n${candidate}` : candidate;
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

  const handleMapClick = (evt, fallback) => {
    const v = evt?.currentTarget?.value ?? fallback ?? "";
    openRecModal(v);
  };

  const handleProviderChange = (val) => {
    const newProviderId = val || "";
    setProviderId(newProviderId);

    setPatient((prev) => {
      const next = {
        ...prev,
        providerId: newProviderId,
      };

      if (typeof setActivePatient === "function") {
        setActivePatient(next);
      }

      return next;
    });

    if (!patient?.id) return;

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
                <div className="col-auto fw-bold text-start d-flex align-items-center gap-2">
                  <span>Health Number: {patient.healthNumber}</span>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={copyHealthNumber}
                    title="Copy HCN without spaces"
                  >
                    Copy
                  </button>
                </div>

                <div className="col-auto text-start">
                  Sex: {patient.sex}
                </div>
                <div className="col-auto text-start">
                  Date of Birth: {patient.dateOfBirth}
                </div>
                <div className="col-auto text-start fw-bold text-danger">
                  Points: {patient.totalPoints != null ? patient.totalPoints : "—"}
                </div>
                <div className="col-auto text-start fw-bold text-danger">
                  Labs: {patient.labCount != null ? patient.labCount : "—"}
                </div>
                <div className="col-auto text-start">
                  <button
                    className="btn btn-sm btn-outline-navy"
                    onClick={openEditModal}
                  >
                    Edit
                  </button>
                </div>

                <div className="col-auto ms-auto d-flex align-items-center gap-2 pe-3">
                  <div className="text-end pe-1">Medication Recommendations:</div>
                  <div className="d-flex flex-wrap gap-1 me-3">
                    {Array.isArray(recommendedMeds) && recommendedMeds.length > 0 ? (
                      recommendedMeds.map((med, idx) => (
                        <button
                          key={idx}
                          type="button"
                          className="ms-1 btn btn-sm btn-outline-warning"
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
                    Naive LDLC: <span className="text-purple">{patient.nativeLDLC}</span>
                  </div>
                </div>
              </div>

              <div
                className="alert alert-light p-2 d-flex gap-3 flex-wrap"
                role="region"
                aria-label="Patient additional information"
              >
                <div className="d-flex mt-1 flex-column col-16">
                  <label className="form-label mb-1">Medication Coverage</label>
                  <div className="d-flex w-100" role="group" aria-label="Payment method">
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

                <div className="d-flex align-content-center col-8 offset-1">
                  <div className="w-100 mb-1">
                    <label
                      htmlFor="nextAppointment"
                      className="form-label mb-1"
                    >
                      Uploads
                    </label>

                    <div className="d-flex gap-1 align-items-center w-100">
                      <div className="col-16">
                        <button
                          className={`btn-sm btn w-100 fs-7 ${mainButton === 'hospital' ? 'btn-warning' : 'btn-outline-primary'
                            }`}
                          onClick={() => changeMainDisplay('hospital')}
                        >
                          Hospital
                        </button>
                      </div>

                      <div className="col-16">
                        <button
                          className="btn-sm btn btn-outline-success w-100 fs-7"
                          onClick={openDoctorPrint}
                        >
                          Doctor Form
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className={`ms-auto text-primary px-2 small fw-bold text-nowrap align-content-center pe-2 ${
                  String(patient?.HospitalLoaded || "").toLowerCase() === "yes" ? "alert-success" : ""
                }`}>
                  Hospital Report :{" "}
                  {String(patient?.HospitalLoaded || "").toLowerCase() === "yes"
                    ? `Yes${patient?.lastHospitalUpload ? ` - ${patient.lastHospitalUpload}` : ""}`
                    : "No"}
                </div>
              </div>
            </div>

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

            {showEditModal && (
              <div
                className="modal fade show"
                role="dialog"
                aria-modal="true"
                style={{ display: "block", background: "rgba(0,0,0,0.4)" }}
              >
                <div className="modal-dialog modal-dialog-centered">
                  <div className="modal-content">
                    <div className="modal-header">
                      <h5 className="modal-title">Edit Patient Info</h5>
                      <button
                        type="button"
                        className="btn-close"
                        onClick={closeEditModal}
                        aria-label="Close"
                        disabled={savingEdit}
                      />
                    </div>

                    <div className="modal-body">
                      <div className="row g-2">
                        <div className="col-48">
                          <label className="form-label mb-1">Name</label>
                          <input
                            className="form-control form-control-sm"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        </div>

                        <div className="col-48">
                          <label className="form-label mb-1">Health Card Number</label>
                          <input
                            className="form-control form-control-sm"
                            value={editHealthNumber}
                            onChange={(e) => setEditHealthNumber(digitsOnlyHealthNumber(e.target.value))}
                            maxLength={10}
                            inputMode="numeric"
                            placeholder="##########"
                          />
                          <div className="small text-muted mt-1">
                            Saved as: {formatHealthNumber(editHealthNumber) || "#### ### ###"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="modal-footer">
                      <button
                        className="btn btn-secondary"
                        onClick={closeEditModal}
                        disabled={savingEdit}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn btn-primary"
                        onClick={savePatientBasics}
                        disabled={savingEdit || !editName.trim() || digitsOnlyHealthNumber(editHealthNumber).length !== 10}
                      >
                        {savingEdit ? "Saving..." : "Save"}
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