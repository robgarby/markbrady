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
    privateMode, // 👈 read private mode from context
  } = gc || {};
  const navigate = useNavigate();

  const [patient, setPatient] = useState(activePatient || {});
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [privateNoteChanged, setPrivateNoteChanged] = useState(false);
  const [privateNote, setPrivateNote] = useState(activePatient?.privateNote || '');
  const [privateMsg, setPrivateMsg] = useState('');

  // Tabs: 'conditions' | 'meds' | 'recs'
  const [moTab, setMoTab] = useState('conditions');

  // ===== Conditions =====
  const [selectedCodes, setSelectedCodes] = useState([]);
  const labelForCondition = (c) => c?.conditionName ?? c?.name ?? c?.label ?? String(c ?? '');
  const codeForCondition = (c, fallbackLabel) =>
    c?.conditionCode ?? c?.code ?? c?.shortCode ?? c?.abbr ??
    (fallbackLabel ? fallbackLabel.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : null);
  const parseCodes = (str) =>
    (str || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);

  // Mask for demos: "Patient ####" using first 4 digits of healthNumber
  const demoPatientLabel = (healthNumber) => {
    const digits = String(healthNumber || "").replace(/\D/g, "");
    const first4 = digits.slice(0, 4) || "XXXX";
    return `Patient ${first4}`;
  };

  // Compute a readable real name from record
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

  const isPrivate = Boolean(privateMode);
  const displayName = isPrivate ? demoPatientLabel(patient.healthNumber) : realPatientName(patient);

  const toggleConditionCode = (code) => {
    if (!code || !patient?.id) return;
    setSelectedCodes((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      setPatient((p) => ({ ...p, conditionData: next.join(',') })); // mirror locally
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
        }).catch(() => { });
      } catch (_) { }
      return next;
    });
  };

  // ===== Meds =====
  // Patient-specific meds list (local): [{ code, dose }]
  const [medList, setMedList] = useState([]);

  // Add box inputs
  // We no longer auto-generate code letter-by-letter; we build it on add/pick.
  const [newMedCode, setNewMedCode] = useState('');
  const [newMedDose, setNewMedDose] = useState('');

  // Typeahead state (filter medsArray)
  const [medQuery, setMedQuery] = useState('');
  const [showMedSuggestions, setShowMedSuggestions] = useState(false);
  const medInputWrapRef = useRef(null);

  // --- Code Builder ---
  // Build up-to-8-char code: 3 letters of name + dose + '-' + 2 random (trim dose to fit)
  const randomPair = () => Math.random().toString(36).slice(2, 4).toUpperCase();
  const normalizeDoseForCode = (dose) => (dose || '').toString().replace(/[^A-Za-z0-9]/g, '');
  const firstThreeLetters = (name) => (name || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'MED';

  const buildMedCode = (name, dose, existing = []) => {
    const prefix = firstThreeLetters(name);
    const rand = randomPair();
    let doseNorm = normalizeDoseForCode(dose);

    // target max length = 8 total: [prefix(3)] + [doseVar(?)] + '-' + [rand(2)]
    // => dose length must be <= (8 - 3 - 1 - 2) = 2
    const maxDoseLen = Math.max(0, 8 - (3 + 1 + 2));
    doseNorm = doseNorm.slice(0, maxDoseLen);

    let candidate = `${prefix}${doseNorm}-${rand}`;

    // Ensure uniqueness vs medsArray codes (just in case)
    if (Array.isArray(existing) && existing.length) {
      let tries = 0;
      while (existing.some((m) => String(m.code || '').toUpperCase() === candidate) && tries < 10) {
        candidate = `${prefix}${doseNorm}-${randomPair()}`;
        tries++;
      }
    }
    return candidate;
  };

  // Ensure a med exists in global medsArray (in-memory only)
  const ensureMedInArray = (name, code, dose) => {
    if (typeof updateMedsArray !== 'function') return;
    updateMedsArray((prev = []) => {
      const prevArr = Array.isArray(prev) ? prev : [];
      const existsByCode = prevArr.find((m) => (m.code || '').toUpperCase() === (code || '').toUpperCase());
      const existsByName = prevArr.find((m) => (m.name || '').toLowerCase() === (name || '').toLowerCase());

      if (existsByCode || existsByName) {
        // If it exists but has no dose, set a default dose if provided
        const next = prevArr.map((m) => {
          if (
            (m.code && code && m.code.toUpperCase() === code.toUpperCase()) ||
            (m.name && name && m.name.toLowerCase() === name.toLowerCase())
          ) {
            const mergedDose = m.dose || dose || '';
            return { ...m, dose: mergedDose };
          }
          return m;
        });
        return next;
      }

      return [...prevArr, { name: name || code, code, dose: dose || '' }];
    });
  };

  // Parse "ASP[50],TLL{30}" -> [{code:"ASP", dose:"50"}, {code:"TLL", dose:"30"}]
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
  // Serialize back to "CODE[dose]"
  const serializeMeds = (arr) =>
    (arr || [])
      .filter((m) => m?.code)
      .map((m) => `${m.code.toUpperCase()}[${(m.dose ?? '').toString().trim()}]`)
      .join(',');

  // Update dose inline in patient list
  const updateMedDose = (code, dose) => {
    if (!code) return;
    setMedList((prev) => {
      const next = prev.map((m) => (m.code === code ? { ...m, dose } : m));
      setPatient((p) => ({ ...p, medsData: serializeMeds(next) }));
      return next;
    });
  };

  // Remove med from patient list
  const removeMedication = (code) => {
    if (!code) return;
    if (!window.confirm(`Remove ${code}?`)) return;
    setMedList((prev) => {
      const next = prev.filter((m) => m.code !== code);
      setPatient((p) => ({ ...p, medsData: serializeMeds(next) }));
      return next;
    });
  };

  // Internal adder used by both: button and suggestion
  const addMedicationInternal = (code, name, dose) => {
    if (!code) return;
    ensureMedInArray(name || code, code, dose); // add to global ref list (no DB)
    setMedList((prev) => {
      const idx = prev.findIndex((m) => m.code === code);
      const next = idx >= 0 ? prev.map((m, i) => (i === idx ? { ...m, dose } : m)) : [...prev, { code, dose }];
      setPatient((p) => ({ ...p, medsData: serializeMeds(next) }));
      return next;
    });
    // reset add box
    setNewMedCode('');
    setNewMedDose('');
    setMedQuery('');
    setShowMedSuggestions(false);
  };

  // Add via button (from inputs)
  const addMedication = () => {
    const name = medQuery.trim();
    const dose = (newMedDose || '').toString().trim();
    // Build code deterministically from name+dose; fall back to typed code if provided
    const existing = Array.isArray(medsArray) ? medsArray : [];
    const autoCode = buildMedCode(name, dose, existing);
    const code = (newMedCode || autoCode).toUpperCase().replace(/[^A-Z0-9-]/g, '');
    addMedicationInternal(code, name || code, dose);
  };

  // Add via suggestion click
  const pickSuggestedMed = (med) => {
    const name = med?.name || med?.code || '';
    const doseFromList = (med?.dose ?? med?.defaultDose ?? med?.usualDose ?? '').toString().trim();
    const dose = doseFromList || newMedDose || '';
    const existing = Array.isArray(medsArray) ? medsArray : [];
    const code = buildMedCode(name, dose, existing);
    addMedicationInternal(code, name, dose);
  };

  // Close suggestions on outside click
  useEffect(() => {
    const onDocDown = (e) => {
      if (!medInputWrapRef.current) return;
      if (!medInputWrapRef.current.contains(e.target)) setShowMedSuggestions(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, []);

  // Lazy-load medsArray when opening Meds tab
  const medsFetchInFlightRef = useRef(false);
  const handleMedsTabClick = () => {
    setMoTab('meds');
    if (medsFetchInFlightRef.current) return;
    if (Array.isArray(medsArray) && medsArray.length > 0) return;
    if (typeof updateMedsArray !== 'function') return;
    medsFetchInFlightRef.current = true;
    try {
      fetch('https://optimizingdyslipidemia.com/PHP/database.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({ script: 'getMeds' }),
      })
        .then((resp) => resp.json())
        .then((data) => {
          if (Array.isArray(data?.meds)) updateMedsArray(data.meds);
          else if (Array.isArray(data?.medications)) updateMedsArray(data.medications);
          else if (Array.isArray(data)) updateMedsArray(data);
        })
        .catch(() => { })
        .finally(() => {
          medsFetchInFlightRef.current = false;
        });
    } catch {
      medsFetchInFlightRef.current = false;
    }
  };

  // ===== Recommendations =====
  const [recs, setRecs] = useState('');
  const saveRecommendations = () => {
    if (!patient?.id) return;
    setPatient((p) => ({ ...p, recommendations: recs }));
    try {
      fetch('https://optimizingdyslipidemia.com/PHP/database.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          script: 'updatePatientRecommendations', // implement on backend when ready
          patientID: patient.id,
          recommendations: recs,
        }),
      }).catch(() => { });
    } catch (_) { }
  };

  // ===== Bootstrapping =====
  // Load master condition list ONCE
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

  // Fetch local patient snapshot on ID change
  const lastLoadedIdRef = useRef(null);
  useEffect(() => {
    const id = activePatient?.id;

    if (!id) {
      setPatient(activePatient || {});
      setSelectedCodes(parseCodes(activePatient?.conditionData ?? ''));
      setMedList(parseMeds(activePatient?.medsData ?? activePatient?.medications ?? ''));
      setRecs(activePatient?.recommendations ?? '');
      lastLoadedIdRef.current = null;
      return;
    }

    if (lastLoadedIdRef.current === id) {
      setPatient((prev) => (prev?.id === id ? prev : activePatient));
      setSelectedCodes(parseCodes(activePatient?.conditionData ?? ''));
      setMedList(parseMeds(activePatient?.medsData ?? activePatient?.medications ?? ''));
      setRecs(activePatient?.recommendations ?? '');
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
          setRecs(data.patient?.recommendations ?? '');
        } else {
          setPatient(activePatient);
          setSelectedCodes(parseCodes(activePatient?.conditionData ?? ''));
          setMedList(parseMeds(activePatient?.medsData ?? activePatient?.medications ?? ''));
          setRecs(activePatient?.recommendations ?? '');
        }
      })
      .catch(() => {
        if (aborted) return;
        lastLoadedIdRef.current = id;
        setPatient(activePatient);
        setSelectedCodes(parseCodes(activePatient?.conditionData ?? ''));
        setMedList(parseMeds(activePatient?.medsData ?? activePatient?.medications ?? ''));
        setRecs(activePatient?.recommendations ?? '');
      });

    return () => { aborted = true; };
  }, [activePatient?.id]);

  if (!patient) return <div className="text-muted">No patient selected.</div>;

  // ===== Common UI helpers =====
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

  const onNoteChange = (e) => {
    const next = { ...patient, patientNote: e.target.value };
    setPatient(next);
    if (typeof setActivePatient === 'function') setActivePatient(next);
  };

  const saveTheNote = async () => {
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
      setMsg(resp.ok ? (data?.message || 'Note saved.') : (data?.error || 'Error saving note.'));
    } catch {
      setMsg('Error saving note.');
    } finally {
      setSaving(false);
    }
  };

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

  // ===== UI =====
  return (
    <div className="container-fluid" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top panel (fixed height) */}
      <div className="d-flex" style={{ flex: '0 0 auto' }}>
        <div className="col-24 offset-0 p-3 alert-secondary">
          <h3 className="mb-3 text-danger">Patient Information</h3>

          <div className="mb-4">
            <h5>Personal Info</h5>
            <div className="d-flex gap-2">
              {/* 👇 Name obeys privateMode */}
              <div className="col-24 text-start">Name: {displayName}</div>

              <div className="col-24 text-start">Health Number: {patient.healthNumber}</div>
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
              <div className="me-auto">
                <h6 className="m-0">Notes &amp; Follow-up</h6>
                <small className="text-muted">Patient Note is searchable</small>
              </div>

              <div className="d-flex align-items-end" style={{ minWidth: 260 }}>
                <div className="w-100">
                  <label htmlFor="nextAppointment" className="form-label mb-1">Next Appointment</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text" aria-hidden="true">📅</span>
                    <input
                      type="date"
                      id="nextAppointment"
                      className="form-control"
                      value={patient.nextAppointment ? patient.nextAppointment.substring(0, 10) : ''}
                      onChange={(e) => SetAppointment(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <button className="btn btn-success text-white ms-2" disabled={saving} onClick={saveTheNote}>
                {saving ? 'Saving…' : 'Save Note'}
              </button>
            </div>

            <div className="card-body">
              <label htmlFor="patientNote" className="form-label fw-bold text-primary">Note to Doctor</label>
              <textarea
                id="patientNote"
                className="form-control"
                rows={8}
                value={patient.patientNote || ''}
                onChange={onNoteChange}
                placeholder="Enter notes about this patient..."
                maxLength={3000}
              />
              <div className="d-flex align-items-center mt-2">
                <small className="text-muted">{msg}</small>
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
