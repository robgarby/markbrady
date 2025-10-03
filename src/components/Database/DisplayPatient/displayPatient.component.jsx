// src/components/.../displayPatient.component.jsx
import React, { useEffect, useState, useRef } from 'react';
import { useGlobalContext } from '../../../Context/global.context';
import PatientMedsBox from "./patientMedsBox.component.jsx";
import PatientConditionDisplay from "./Patient/patientConditionDisplay.componentl.jsx";
import { useNavigate } from 'react-router-dom';

const PatientDetails = () => {
  const gc = useGlobalContext();
  const {
    activePatient,
    setActivePatient,
    conditionData,
    updateConditions,
    medsArray,
    updateMedsArray,
    privateMode,
  } = gc || {};
  const navigate = useNavigate();

  const [patient, setPatient] = useState(activePatient || {});
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [privateNoteChanged, setPrivateNoteChanged] = useState(false);
  const [privateNote, setPrivateNote] = useState(activePatient?.privateNote || '');
  const [privateMsg, setPrivateMsg] = useState('');

  // NEW: Demo-mode modal state
  const [showDemoModal, setShowDemoModal] = useState(false);

  // Tabs (unused in this file, kept for parity)
  const [moTab, setMoTab] = useState('conditions');

  // ===== Helpers =====
  const parseCodes = (str) =>
    (str || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

  // Demo label for private mode
  const demoPatientLabel = (healthNumber) => {
    const digits = String(healthNumber || "").replace(/\D/g, "");
    const first4 = digits.slice(0, 4) || "XXXX";
    return `Patient ${first4}`;
  };

  // Real display name (non-private)
  const realPatientName = (p) => {
    const raw =
      p?.clientName ||
      p?.name ||
      (p?.firstName && p?.lastName ? `${p.firstName} ${p.lastName}` : p?.lastFirstName || "");
    if (!raw) return "—";
    const s = String(raw).trim();
    if (s.includes(",")) {
      const [last = "", first = ""] = s.split(",");
      return `${first.trim()} ${last.trim()}`.trim();
    }
    return s;
  };

  // 🔒 Apply private mode across the component
  const isPrivate = Boolean(privateMode);

  // Mask 3 middle digits when private → 123 XXX 7890 (best with 10-digit HCN)
  const maskHealthNumber3 = (hcn) => {
    const digits = String(hcn || "").replace(/\D/g, "");
    if (!digits) return hcn || "—";
    const first3 = digits.slice(0, 3);
    const last4  = digits.slice(-4);
    return `${first3} XXX ${last4}`;
  };

  const displayName = isPrivate ? demoPatientLabel(patient.healthNumber) : realPatientName(patient);
  const displayHCN  = isPrivate ? maskHealthNumber3(patient.healthNumber) : (patient.healthNumber || "—");

  // ===== Meds helpers carried over (kept minimal for context) =====
  const parseMeds = (str) => {
    const tokens = (str || '').split(',').map((s) => s.trim()).filter(Boolean);
    const out = [];
    for (const t of tokens) {
      const m = t.match(/^([A-Z0-9]+)\s*[\[\{]\s*([^\]\}]*)\s*[\]\}]$/i);
      if (m) out.push({ code: m[1].toUpperCase(), dose: String(m[2] ?? '').trim() });
      else if (t) out.push({ code: t.toUpperCase(), dose: '' });
    }
    return out;
  };

  const [selectedCodes, setSelectedCodes] = useState([]);
  const [medList, setMedList] = useState([]);

  // ===== Bootstrapping =====
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

  const lastLoadedIdRef = useRef(null);
  useEffect(() => {
    const id = activePatient?.id;

    if (!id) {
      setPatient(activePatient || {});
      setSelectedCodes(parseCodes(activePatient?.conditionData ?? ''));
      setMedList(parseMeds(activePatient?.medsData ?? activePatient?.medications ?? ''));
      lastLoadedIdRef.current = null;
      return;
    }

    if (lastLoadedIdRef.current === id) {
      setPatient((prev) => (prev?.id === id ? prev : activePatient));
      setSelectedCodes(parseCodes(activePatient?.conditionData ?? ''));
      setMedList(parseMeds(activePatient?.medsData ?? activePatient?.medications ?? ''));
      return;
    }

    let aborted = false;
    fetch('https://optimizingdyslipidemia.com/PHP/database.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script: 'getPatientById', patientID: id }),
    })
      .then((resp) => resp.json())
      .then((data) => {
        if (aborted) return;
        lastLoadedIdRef.current = id;
        if (data?.success && data.patient) {
          setPatient(data.patient);
          setSelectedCodes(parseCodes(data.patient?.conditionData ?? ''));
          setMedList(parseMeds(data.patient?.medsData ?? data.patient?.medications ?? ''));
        } else {
          setPatient(activePatient);
          setSelectedCodes(parseCodes(activePatient?.conditionData ?? ''));
          setMedList(parseMeds(activePatient?.medsData ?? activePatient?.medications ?? ''));
        }
      })
      .catch(() => {
        if (aborted) return;
        lastLoadedIdRef.current = id;
        setPatient(activePatient);
        setSelectedCodes(parseCodes(activePatient?.conditionData ?? ''));
        setMedList(parseMeds(activePatient?.medsData ?? activePatient?.medications ?? ''));
      });

    return () => { aborted = true; };
  }, [activePatient?.id]);

  if (!patient) return <div className="text-muted">No patient selected.</div>;

  // ===== Common UI helper =====
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

  // ===== Doctor note (moved Save button below textarea) =====
  const onNoteChange = (e) => {
    const next = { ...patient, patientNote: e.target.value };
    setPatient(next);
    if (typeof setActivePatient === 'function') setActivePatient(next);
  };

  const saveDoctorNote = async () => {
    if (!patient) return;
    setSaving(true);
    setMsg('');
    try {
      const resp = await fetch('https://optimizingdyslipidemia.com/PHP/database.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: 'updatePatientNote',
          healthNumber: patient.healthNumber,
          patientNote: patient.patientNote,
        }),
      });
      const text = await resp.text();
      let data; try { data = JSON.parse(text); } catch { data = { message: text }; }
      setMsg(resp.ok ? (data?.message || 'Doctor note saved.') : (data?.error || 'Error saving note.'));
    } catch {
      setMsg('Error saving note.');
    } finally {
      setSaving(false);
    }
  };

  // ===== Private note (unchanged) =====
  const savePrivateNote = async () => {
    const updatedPatient = { ...patient, privateNote };
    setPatient(updatedPatient);
    if (typeof setActivePatient === 'function') setActivePatient(updatedPatient);
    setSaving(true); setPrivateMsg('');
    try {
      const resp = await fetch('https://optimizingdyslipidemia.com/PHP/database.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ script: 'updatePrivateNote', patientID: patient.id, privateNote }),
      });
      let data; try { data = await resp.json(); } catch { data = {}; }
      if (resp.ok) { setPrivateMsg('Private Note Saved'); setPrivateNoteChanged(false); }
      else { setPrivateMsg(data?.error || 'Error saving private note.'); }
    } catch {
      setPrivateMsg('Error saving private note.');
    } finally { setSaving(false); }
  };

  // ===== Next Appointment (slightly smaller) =====
  const SetAppointment = (dateStr) => {
    const iso = dateStr ? new Date(dateStr).toISOString().slice(0, 10) : null;
    setPatient((prev) => {
      const next = { ...prev, nextAppointment: iso };
      if (typeof setActivePatient === 'function') setActivePatient(next);
      return next;
    });
    if (!patient?.id) return;
    fetch('https://optimizingdyslipidemia.com/PHP/database.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({ script: 'updateAppointment', patientID: patient.id, appointmentDate: iso }),
    }).catch(() => { });
  };

  // ===== Payment Method toggles (CASH / Government / Private) =====
  const currentPayment = String(
    patient?.paymentMethod ??
    patient?.paymentMethof ?? // fallback for legacy typo
    'CASH'
  );

  const setPaymentMethod = (methodLabel) => {
    const method = methodLabel; // keep labels exactly: 'CASH' | 'Government' | 'Private' | '?'
    setPatient((prev) => {
      const next = { ...prev, paymentMethod: method, paymentMethof: method }; // mirror both keys for safety
      if (typeof setActivePatient === 'function') setActivePatient(next);
      return next;
    });
    if (!patient?.id) return;
    fetch('https://optimizingdyslipidemia.com/PHP/database.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        script: 'updatePaymentMethod',
        patientID: patient.id,
        paymentMethod: method,
      }),
    }).catch(() => { });
  };

  // ===== UI =====
  return (
    <div className="container-fluid" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top panel (fixed height) */}
      <div className="d-flex" style={{ flex: '0 0 auto' }}>
        <div className="col-24 offset-0 p-3 alert-secondary">
          <h3 className="mb-3 text-dark">Patient Information</h3>

          <div className="mb-4">
            <h5>Personal Info</h5>
            <div className="d-flex gap-2">
              <div className="col-24 text-start">Name: {displayName}</div>
              <div className="col-24 text-start">Health Number: {displayHCN}</div>
            </div>
            <div className="d-flex gap-2 mt-2">
              <div className="col-24 text-start">Sex: {patient.sex}</div>
              <div className="col-24 text-start">Date of Birth: {patient.dateOfBirth}</div>
            </div>

            <div className="d-flex gap-2 mt-4">
              <textarea
                value={privateNote}
                onChange={(e) => { setPrivateNote(e.target.value); setPrivateNoteChanged(true); setPrivateMsg(''); }}
                className="form-control"
                rows="4"
                placeholder="Add a Private note..."
              />
            </div>

            <div className="d-flex mt-1 align-items-center">
              <div className="ms-auto pe-1 mt-1 d-flex align-items-center gap-2">
                <button onClick={savePrivateNote} className="btn btn-primary" disabled={!privateNoteChanged}>
                  Save Private Note
                </button>
                <small className="text-muted">{privateMsg}</small>
              </div>
            </div>
          </div>

          <button className="btn btn-secondary mb-3" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? 'Hide Address & Provider Info' : 'Show Address & Provider Info'}
          </button>

          {showDetails && (
            <div className="border p-3 rounded bg-light">
              <div className="mb-4">
                <h5>Address & Contact</h5>
                {renderRow('Full Address', patient.fullAddress)}
                {renderRow('Street', patient.street)}
                {renderRow('City', patient.city)}
                {renderRow('Province', patient.province)}
                {renderRow('Postal Code', patient.postalCode)}
                {renderRow('Telephone', patient.telephone)}
              </div>
              <div>
                <h5>Provider Info</h5>
                {renderRow('Provider Name', patient.providerName)}
                {renderRow('Provider Number', patient.providerNumber)}
                {renderRow('Order Date', patient.orderDate)}
              </div>
            </div>
          )}
        </div>

        <div className="flex-grow-1 p-3">
          <div className="card shadow-sm h-100">
            <div className="card-header d-flex align-items-end gap-3 flex-wrap">

              {/* Next Appointment (narrower) */}
              <div className="d-flex align-items-end" style={{ minWidth: 180, maxWidth: 260 }}>
                <div className="w-100">
                  <label htmlFor="nextAppointment" className="form-label mb-1">Next Appointment</label>
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

              {/* Payment Method Toggles */}
              <div className="d-flex flex-column flex-grow-1" style={{ minWidth: 240 }}>
                <label className="form-label mb-1 text-muted fw-bold">Medication Coverage</label>
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

            </div>

            {/* DEMO ACTIONS: any button in this bar will trigger the Demo Mode modal */}
            <div
              className="p-2 alert alert-warning d-flex align-items-center m-3 gap-2"
              onClick={(e) => {
                // if any button inside this container is clicked -> show demo modal
                if (e.target.closest('button')) setShowDemoModal(true);
              }}
            >
              <span className="me-2" role="img" aria-label="Info">ℹ️</span>
              <button type="button" className="btn btn-sm btn-light">Omega 3</button>
              <button type="button" className="btn btn-sm btn-light">SGLT2i</button>
              <button type="button" className="btn btn-sm btn-light">nsMRA</button>
              <button type="button" className="btn btn-sm btn-light">GLP1a/GIP</button>
              <button type="button" className="btn btn-sm btn-light">PCSK9i</button>
              {/* You can add more buttons here; any of them will open the modal */}
              {/* <button type="button" className="btn btn-sm btn-light">Another Action</button> */}
            </div>

            {/* Demo Mode Modal */}
            {typeof window !== "undefined" && showDemoModal && (
              <div
                className="modal fade show"
                tabIndex="-1"
                style={{
                  display: "block",
                  background: "rgba(0,0,0,0.4)",
                  position: "fixed",
                  zIndex: 1050,
                  left: 0,
                  top: 0,
                  width: "100vw",
                  height: "100vh",
                }}
                aria-modal="true"
                role="dialog"
              >
                <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 420 }}>
                  <div className="modal-content">
                    <div className="modal-header">
                      <h5 className="modal-title">Demonstration Mode</h5>
                      <button
                        type="button"
                        className="btn-close"
                        aria-label="Close"
                        onClick={() => setShowDemoModal(false)}
                      />
                    </div>
                    <div className="modal-body">
                      <p className="mb-0">
                        This is <strong className='text-danger'>Demonstration Mode</strong>. When in Use Mode, This will print a patient referral letter for the Medication in question that can be faxed, emailed or printed and given to the provider
                      </p>
                    </div>
                    <div className="modal-footer">
                      <button className="btn btn-primary" onClick={() => setShowDemoModal(false)}>
                        OK
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="card-body">
              <label htmlFor="patientNote" className="form-label fw-bold text-primary">Note to Doctor</label>
              <textarea
                id="patientNote"
                className="form-control"
                rows={5}
                value={patient.patientNote || ''}
                onChange={onNoteChange}
                placeholder="Enter notes about this patient..."
                maxLength={3000}
              />

              <div className="d-flex align-items-center mt-2">
                <button className="btn btn-success text-white" disabled={saving} onClick={saveDoctorNote}>
                  {saving ? 'Saving…' : 'Save Doctor Note'}
                </button>
                <small className="text-muted ms-3">{msg}</small>
                <small className="text-muted ms-auto">{(patient.patientNote || '').length}/3000</small>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Lower panel */}
      <div className="col-48 offset-0 border-top px-3 pb-3 d-flex flex-column" style={{ flex: '1 1 0', minHeight: 0 }}>
        <div className="d-flex alert-light align-items-center justify-content-between p-3 mt-2" style={{ flex: '0 0 auto' }}>
          <h5 className="m-0">Lab Results</h5>
        </div>

        <div className="d-flex gap-2 flex-grow-1" style={{ minHeight: 0, overflow: 'hidden' }}>
          {/* Left column: scrollable labs */}
          <div className="col-16" style={{ overflowY: 'auto', minHeight: 0 }}>
            {renderRow('Cholesterol', patient.cholesterol, patient.cholesterolDate)}
            {renderRow('Triglyceride', patient.triglyceride, patient.triglycerideDate)}
            {renderRow('HDL', patient.hdl, patient.hdlDate)}
            {renderRow('LDL', patient.ldl, patient.ldlDate)}
            {renderRow('Non-HDL', patient.nonHdl, patient.nonHdlDate)}
            {renderRow('Cholesterol/HDL Ratio', patient.cholesterolHdlRatio, patient.cholesterolHdlRatioDate)}
            {renderRow('Creatine Kinase', patient.creatineKinase, patient.creatineKinotransferaseDate)}
            {renderRow('ALT (Alanine Aminotransferase)', patient.alanineAminotransferase, patient.alanineAminotransferaseDate)}
            {renderRow('Lipoprotein A', patient.lipoproteinA, patient.lipoproteinADate)}
            {renderRow('Apolipoprotein B', patient.apolipoproteinB, patient.apolipoproteinBDate)}
            {renderRow('BNP', patient.natriureticPeptideB, patient.natriureticPeptideBDate)}
            {renderRow('Urea', patient.urea, patient.ureaDate)}
            {renderRow('Creatinine', patient.creatinine, patient.creatinineDate)}
            {renderRow('GFR', patient.gfr, patient.gfrDate)}
            {renderRow('Albumin', patient.albumin, patient.albuminDate)}
            {renderRow('Sodium', patient.sodium, patient.sodiumDate)}
            {renderRow('Potassium', patient.potassium, patient.potassiumDate)}
            {renderRow('Vitamin B12', patient.vitaminB12, patient.vitaminB12Date)}
            {renderRow('Ferritin', patient.ferritin, patient.ferritinDate)}
            {renderRow('Hemoglobin A1C', patient.hemoglobinA1C, patient.hemoglobinA1CDate)}
            {renderRow('Urine Albumin', patient.urineAlbumin, patient.urineAlbuminDate)}
            {renderRow('Albumin/Creatinine Ratio', patient.albuminCreatinineRatio, patient.albuminCreatinineRatioDate)}
          </div>

          <div className="flex-grow-1 d-flex" style={{ minHeight: 0 }}>
            <PatientMedsBox patient={activePatient} />
          </div>

        </div>
      </div>
    </div>
  );
};

export default PatientDetails;
