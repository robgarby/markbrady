// displayPatient.component.jsx
import React, { useEffect, useState } from 'react';
import { useGlobalContext } from '../../../Context/global.context';
import { useNavigate } from 'react-router-dom';

const PatientDetails = () => {
  // If your context exposes a setter, we’ll use it; otherwise we’ll just keep local state in sync.
  const gc = useGlobalContext();
  const { activePatient, setActivePatient, setVisibleBox } = gc || {};
  const navigate = useNavigate();

  // Local copy so edits (like patientNote) immediately re-render the component
  const [patient, setPatient] = useState(activePatient);
  const [showDetails, setShowDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Keep local state synced if the selected patient changes elsewhere
  useEffect(() => {
    setPatient(activePatient);
  }, [activePatient]);

  if (!patient) return <div className="text-muted">No patient selected.</div>;

  const renderRow = (label, value, date) => {
    if (
      value === null ||
      value === '' ||
      (typeof value === 'string' && value.trim() === '') ||
      (!isNaN(parseFloat(value)) && parseFloat(value) === 0)
    ) return null;

    const displayValue = date ? `${value} (${date})` : value;

    return (
      <div className="d-flex justify-content-between py-1 border-bottom">
        <strong>{label}:</strong> <span>{displayValue}</span>
      </div>
    );
  };

  const onNoteChange = (e) => {
    const next = { ...patient, patientNote: e.target.value };
    setPatient(next);                         // immediate local render
    if (typeof setActivePatient === 'function') {
      setActivePatient(next);                 // optional: update global if available
    }
  };

  const saveTheNote = async () => {
    if (!patient) return;
    console.log(patient);
    setSaving(true);
    setMsg('');
    try {
      // TODO: point this at your real API. Example sends JSON the same way your PHP `database.php` expects.
      const resp = await fetch('https://optimizingdyslipidemia.com/PHP/database.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: 'updatePatientNote',        // implement this on server
          healthNumber: patient.healthNumber, // or patient.id if you use IDs
          patientNote: patient.patientNote,
        }),
      });

      // Be resilient if server still outputs debug text
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { message: text }; }

      if (resp.ok) {
        setMsg(data?.message || 'Note saved.');
      } else {
        setMsg(data?.error || 'Error saving note.');
      }
    } catch (err) {
      console.error(err);
      setMsg('Error saving note.');
    } finally {
      setSaving(false);
    }
  };

  // Opens a future print view (stub route). Pass whatever params you’ll need server-side.
  const openPrintView = () => {
    const params = new URLSearchParams();
    if (patient?.healthNumber) params.set('healthNumber', String(patient.healthNumber).replace(/\s+/g, ''));
    if (patient?.orderDate) params.set('orderDate', patient.orderDate);
    window.open(`/print/labs?${params.toString()}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="container-fluid" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Fixed Header Section */}
      <div className="d-flex">
        <div className="col-24 offset-0 p-3 alert-secondary" style={{ flex: '0 0 auto' }}>
          <h3 className="mb-3 text-danger">Patient Information</h3>

          <div className="mb-4">
            <h5>Personal Info</h5>
            {renderRow("Client Name", patient.clientName)}
            {renderRow("Health Number", patient.healthNumber)}
            {renderRow("Sex", patient.sex)}
            {renderRow("Date of Birth", patient.dateOfBirth)}
          </div>

          <button
            className="btn btn-secondary mb-3"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? "Hide Address & Provider Info" : "Show Address & Provider Info"}
          </button>

          {showDetails && (
            <div className="border p-3 rounded bg-light">
              <div className="mb-4">
                <h5>Address & Contact</h5>
                {renderRow("Full Address", patient.fullAddress)}
                {renderRow("Street", patient.street)}
                {renderRow("City", patient.city)}
                {renderRow("Province", patient.province)}
                {renderRow("Postal Code", patient.postalCode)}
                {renderRow("Telephone", patient.telephone)}
              </div>

              <div>
                <h5>Provider Info</h5>
                {renderRow("Provider Name", patient.providerName)}
                {renderRow("Provider Number", patient.providerNumber)}
                {renderRow("Order Date", patient.orderDate)}
              </div>
            </div>
          )}
        </div>

        <div className="flex-grow-1 p-3 alert-navy">
          <div>
            <label htmlFor="patientNote" className="form-label">
              Patient Note (Searchable in Database)
            </label>
            <textarea
              id="patientNote"
              className="form-control"
              rows={6}
              value={patient.patientNote || ''}
              onChange={onNoteChange}
              placeholder="Enter notes about this patient..."
            />
          </div>

          <div className="d-flex mt-3">
            <div className="me-2 align-self-center small text-muted">
              {msg}
            </div>
            <div className="ms-auto">
              <button
                className="btn btn-success text-white"
                disabled={saving}
                onClick={saveTheNote}
              >
                {saving ? 'Saving…' : 'Save This Note'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Labs Section */}
      <div
        className="col-48 offset-0 border-top px-3 pb-3"
        style={{ flex: '1 1 auto', overflowY: 'auto', minHeight: 0 }}
      >
        <div className="d-flex alert-light align-items-center justify-content-between p-3 mt-2">
          <h5 className="m-0">Lab Results</h5>

          {/* Printed Version button (opens a future print view in a new tab) */}
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            title="Open a printable version in a new tab"
            onClick={() => setVisibleBox('printView')}
          >
            Printed Version
          </button>
        </div>

        {renderRow("Cholesterol", patient.cholesterol, patient.cholesterolDate)}
        {renderRow("Triglyceride", patient.triglyceride, patient.triglycerideDate)}
        {renderRow("HDL", patient.hdl, patient.hdlDate)}
        {renderRow("LDL", patient.ldl, patient.ldlDate)}
        {renderRow("Non-HDL", patient.nonHdl, patient.nonHdlDate)}
        {renderRow("Cholesterol/HDL Ratio", patient.cholesterolHdlRatio, patient.cholesterolHdlRatioDate)}

        {renderRow("Creatine Kinase", patient.creatineKinase, patient.creatineKinaseDate)}
        {renderRow("ALT (Alanine Aminotransferase)", patient.alanineAminotransferase, patient.alanineAminotransferaseDate)}
        {renderRow("Lipoprotein A", patient.lipoproteinA, patient.lipoproteinADate)}
        {renderRow("Apolipoprotein B", patient.apolipoproteinB, patient.apolipoproteinBDate)}

        {renderRow("BNP", patient.natriureticPeptideB, patient.natriureticPeptideBDate)}
        {renderRow("Urea", patient.urea, patient.ureaDate)}
        {renderRow("Creatinine", patient.creatinine, patient.creatinineDate)}
        {renderRow("GFR", patient.gfr, patient.gfrDate)}
        {renderRow("Albumin", patient.albumin, patient.albuminDate)}
        {renderRow("Sodium", patient.sodium, patient.sodiumDate)}
        {renderRow("Potassium", patient.potassium, patient.potassiumDate)}

        {renderRow("Vitamin B12", patient.vitaminB12, patient.vitaminB12Date)}
        {renderRow("Ferritin", patient.ferritin, patient.ferritinDate)}
        {renderRow("Hemoglobin A1C", patient.hemoglobinA1C, patient.hemoglobinA1CDate)}
        {renderRow("Urine Albumin", patient.urineAlbumin, patient.urineAlbuminDate)}
        {renderRow("Albumin/Creatinine Ratio", patient.albuminCreatinineRatio, patient.albuminCreatinineRatioDate)}
      </div>
    </div>
  );
};

export default PatientDetails;
