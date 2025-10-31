
import React from "react";

import { useGlobalContext } from '../../../Context/global.context';

export default function PatientInfo({ user, thePatient, loading = false }) {

  const gc = useGlobalContext();
  const {
    setActivePatient,
    patientProvider,
    displayMain,
    setDisplayMain,
    mainButton,
    setMainButton

  } = gc || {};

  const [patient, setPatient] = React.useState([]);
  const [providerId, setProviderID] = React.useState(null);
  const currentPayment = patient?.paymentMethod || patient?.paymentMethof || '?';

  const changeMainDisplay = (button) => {
    console.log(mainButton, button, displayMain);
    if (button === mainButton) {
      console.log("Toggling off");
      setMainButton(null);
      setDisplayMain(false);
      return;
    }
    setMainButton(button);
    setDisplayMain(true);
  }

  React.useEffect(() => {
    setPatient(thePatient);
    setProviderID(thePatient?.providerId || null);
  }, [thePatient]);

  const renderRow = (label, value, date) => {
    if (value === null || value === '' || (typeof value === 'string' && value.trim() === '') ||
      (!isNaN(parseFloat(value)) && parseFloat(value) === 0)) return null;
    const displayValue = date ? `${value} (${date})` : value;
    return (
      <div className="d-flex justify-content-between py-1 border-bottom">
        <strong>{label}:</strong> <span>{displayValue}</span>
      </div>
    );
  };

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
      body: JSON.stringify({ script: 'updateAppointment', patientID: patient.id, appointmentDate: iso, patientDB: user?.patientTable || "Patient", historyDB: user?.historyTable || "Patient_History" }),
    }).catch(() => { });
  };

  return (
    <>
      {patient && !loading && (
        <div className="d-flex" style={{ flex: '0 0 auto' }}>
          <div className="col-48 mt-0 rounded offset-0 p-3 alert-secondary">
            <h3 className="mb-3 text-dark">{patient.clientName} [Age: {calculateAge(patient.dateOfBirth)}]</h3>

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
                  <div className="text-end pe-3">Medictaion Recommendations:</div>
                  <div className="alert d-flex py-1 px-2 mb-0 gap-2 align-items-center" role="region" aria-label="Patient lipid information" >
                   <div className="btn btn-sm btn-outline-warning">Fertinand</div>
                   <div className="btn btn-sm btn-outline-warning">Repatha</div>
                   <div className="btn btn-sm btn-outline-warning">Button 3</div>
                  </div>
                  <div className="text-end fw-bold fs-6">
                    Naive LDLC: <span className="text-purple">N/A</span>
                  </div>
                </div>
              </div>

              <div className="alert alert-light p-2 d-flex gap-3 flex-wrap" role="region" aria-label="Patient additional information">
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
                    className={`form-select fs-7 ${providerId !== null ? "alert-success" : ""}`}
                    value={providerId ?? ""}
                    onChange={(e) => {
                      const val = e.target.value || null; // "" -> null
                      setProviderID(val);                 // <-- use the matching setter/case
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
                <div className="d-flex align-content-center col-8">
                  <div className="w-100 mb-1">
                    <label htmlFor="nextAppointment" className="form-label mb-1">Upload</label>
                    <div className="d-flex gap-1 align-content-center">
                      <div className="col-16">
                        <button className={`btn-sm btn  w-100 fs-7 ${mainButton === 'lifelab' ? 'btn-warning' : 'btn-outline-primary'}`} onClick={() => changeMainDisplay('lifelab')}>Life Lab</button>
                      </div>
                      <div className="col-16">
                        <button className={`btn-sm btn  w-100 fs-7 ${mainButton === 'dynacare' ? 'btn-warning' : 'btn-outline-primary'}`} onClick={() => changeMainDisplay('dynacare')}>Dynacare</button>
                      </div>
                      <div className="col-16">
                        <button className={`btn-sm btn  w-100 fs-7 ${mainButton === 'newLab' ? 'btn-warning' : 'btn-outline-primary'}`} onClick={() => changeMainDisplay('newLab')}>new Lab</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="d-flex align-content-center col-8 offset-1">
                  <div className="w-100 mb-1">
                    <label htmlFor="nextAppointment" className="form-label mb-1">Special</label>
                    <div className="d-flex gap-1 align-content-center">
                      <div className="col-16">
                         <button className={`btn-sm btn  w-100 fs-7 ${mainButton === 'hospital' ? 'btn-warning' : 'btn-outline-primary'}`} onClick={() => changeMainDisplay('hospital')}>Hospital</button>
                      </div>
                      <div className="col-16">
                        <button className={`btn-sm btn  w-100 fs-7 ${mainButton === 'pharmacy' ? 'btn-warning' : 'btn-outline-primary'}`} onClick={() => changeMainDisplay('pharmacy')}>Pharmacy</button>
                      </div>
                      <div className="col-16">
                        <button className={`btn-sm btn  w-100 fs-7 ${mainButton === 'alergy' ? 'btn-warning' : 'btn-outline-primary'}`} onClick={() => changeMainDisplay('alergy')}>Alergy</button>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

