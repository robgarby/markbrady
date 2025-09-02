// displayPrintView.component.jsx (aka PrintLabView.jsx)
import React from 'react';
import { useGlobalContext } from '../../../Context/global.context';

const PrintLabView = () => {
  const { activePatient, setVisibleBox } = useGlobalContext();
  const p = activePatient || {};

  const renderRow = (label, value, date) => {
    const empty =
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (!isNaN(parseFloat(value)) && parseFloat(value) === 0);
    if (empty) return null;
    return (
      <div className="lab-row">
        <div className="lab-label">{label}</div>
        <div className="lab-value">
          {value}{date ? <span className="lab-date"> ({date})</span> : null}
        </div>
      </div>
    );
  };

  return (
    <div className="print-wrap">
      {/* Print-specific styles */}
      <style>{`
        .print-wrap {
          max-width: 900px;
          margin: 0 auto;
          padding: 24px;
          background: #fff;
          color: #111;
          font-size: 14px;
          line-height: 1.45;
        }
        .print-header {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }
        .print-title { flex: 1; }
        .print-title h1 {
          font-size: 28px;
          margin: 0 0 4px;
          line-height: 1.2;
        }
        .print-meta {
          font-size: 14px;
          color: #333;
          margin-bottom: 8px;
        }
        .no-print { }
        .btn {
          border: 1px solid #999;
          background: #f6f6f6;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn + .btn { margin-left: 8px; }
        .btn:hover { background:#eee; }
        .section {
          margin-top: 18px;
          padding-top: 10px;
          border-top: 1px solid #ddd;
        }
        .section h3 {
          margin: 0 0 8px;
          font-size: 16px;
          color: #222;
        }
        .note-box {
          white-space: pre-wrap;
          background: #fafafa;
          border: 1px solid #e5e5e5;
          border-radius: 8px;
          padding: 12px;
          min-height: 60px;
        }
        .labs {
          display: grid;
          grid-template-columns: 1fr;
          gap: 6px;
        }
        .lab-row {
          display: grid;
          grid-template-columns: 220px 1fr;
          gap: 8px;
          padding: 6px 0;
          border-bottom: 1px dashed #e5e5e5;
        }
        .lab-label { font-weight: 600; }
        .lab-date { color: #666; font-size: 12px; }
        @media print {
          .no-print { display: none !important; }
          .print-wrap { padding: 0; }
          @page { margin: 16mm; }
        }
      `}</style>

      {/* Header: Name + HealthNumber + Back/Print (hidden when printing) */}
      <div className="print-header">
        <div className="print-title">
          <h1>{p.clientName || '—'}</h1>
          <div className="print-meta"><strong>Health Number:</strong> {p.healthNumber || '—'}</div>
        </div>
        <div className="no-print">
          <button className="btn" onClick={() => setVisibleBox('ClientDetails')}>
            Back
          </button>
          <button className="btn" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      {/* Note at the top */}
      <div className="section">
        <h3>Patient Note</h3>
        <div className="note-box">
          {p.patientNote && p.patientNote.trim() ? p.patientNote : <em>No note on file.</em>}
        </div>
      </div>

      {/* Results below the note */}
      <div className="section">
        <h3>Lab Results</h3>
        <div className="labs">
          {renderRow("Cholesterol", p.cholesterol, p.cholesterolDate)}
          {renderRow("Triglyceride", p.triglyceride, p.triglycerideDate)}
          {renderRow("HDL", p.hdl, p.hdlDate)}
          {renderRow("LDL", p.ldl, p.ldlDate)}
          {renderRow("Non-HDL", p.nonHdl, p.nonHdlDate)}
          {renderRow("Cholesterol/HDL Ratio", p.cholesterolHdlRatio, p.cholesterolHdlRatioDate)}

          {renderRow("Creatine Kinase", p.creatineKinase, p.creatineKinaseDate)}
          {renderRow("ALT (Alanine Aminotransferase)", p.alanineAminotransferase, p.alanineAminotransferaseDate)}
          {renderRow("Lipoprotein A", p.lipoproteinA, p.lipoproteinADate)}
          {renderRow("Apolipoprotein B", p.apolipoproteinB, p.apolipoproteinBDate)}

          {renderRow("BNP", p.natriureticPeptideB, p.natriureticPeptideBDate)}
          {renderRow("Urea", p.urea, p.ureaDate)}
          {renderRow("Creatinine", p.creatinine, p.creatinineDate)}
          {renderRow("GFR", p.gfr, p.gfrDate)}
          {renderRow("Albumin", p.albumin, p.albuminDate)}
          {renderRow("Sodium", p.sodium, p.sodiumDate)}
          {renderRow("Potassium", p.potassium, p.potassiumDate)}

          {renderRow("Vitamin B12", p.vitaminB12, p.vitaminB12Date)}
          {renderRow("Ferritin", p.ferritin, p.ferritinDate)}
          {renderRow("Hemoglobin A1C", p.hemoglobinA1C, p.hemoglobinA1CDate)}
          {renderRow("Urine Albumin", p.urineAlbumin, p.ureaDate /* if you store a separate urineAlbuminDate, swap it in */)}
          {renderRow("Albumin/Creatinine Ratio", p.albuminCreatinineRatio, p.albuminCreatinineRatioDate)}
        </div>
      </div>
    </div>
  );
};

export default PrintLabView;
