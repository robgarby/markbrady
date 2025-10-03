// src/components/.../viewPatientPDF.component.jsx
import React, { useEffect, useState } from 'react';
import { useGlobalContext } from '../../../Context/global.context';
import PdfViewer from './pdfViewerBox.component';

const ViewPatientPDF = () => {
  const { activePatient, privateMode } = useGlobalContext(); // ⬅ pull privateMode
  const [labReports, setLabReports] = useState([]);
  const [patientReports, setPatientReports] = useState([]);
  const [pdfToShow, setPdfToShow] = useState(null);

  // Mask for demos: "Patient ####" using first 4 digits of healthNumber
  const demoPatientLabel = (healthNumber) => {
    const digits = String(healthNumber || "").replace(/\D/g, "");
    const first4 = digits.slice(0, 4) || "XXXX";
    return `Patient ${first4}`;
  };

  // NEW: mask 3 middle digits in private mode -> 123 XXX 7890
  const maskHealthNumber3 = (hcn, doMask) => {
    const digits = String(hcn || "").replace(/\D/g, "");
    if (!digits) return hcn || "—";
    if (!doMask) return hcn || "—";

    // Aim for 10 digits (OHIP); degrade gracefully if shorter/longer
    const first3 = digits.slice(0, 3);
    const last4 = digits.slice(-4);
    // If fewer than 7 digits, just return masked middle section best-effort
    if (digits.length < 7) {
      return `${first3}${digits.length > 3 ? " XXX " : ""}${digits.length > 3 ? last4 : ""}`.trim() || "—";
    }
    return `${first3} XXX ${last4}`;
  };

  useEffect(() => {
    const fetchLabReports = async () => {
      try {
        const response = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            healthNumber: activePatient.healthNumber,
            script: "getLabData"
          }),
        });
        const data = await response.json();
        if (data.success) {
          setLabReports(data.labReports || []);
        }
      } catch (error) {
        console.error("Error fetching lab reports:", error);
      }
    };

    const fetchPatientReports = async () => {
      try {
        const response = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            healthNumber: activePatient.healthNumber,
            script: "getPatientUploads"
          }),
        });
        const data = await response.json();

        if (data.success) {
          setPatientReports(data.patientUploads || []);
        }
      } catch (error) {
        console.error("Error fetching patient uploads:", error);
      }
    };

    if (activePatient?.healthNumber) {
      fetchLabReports();
      fetchPatientReports();
    }
  }, [activePatient]);

  const handleViewPDF = (url) => {
    setPdfToShow(url);
  };

  if (!activePatient) {
    return <div className="text-muted">No patient selected.</div>;
  }

  // Decide what to display for HCN
  const displayHCN = maskHealthNumber3(activePatient.healthNumber, Boolean(privateMode));

  return (
    <div className="container-fluid mt-4">
      {/* Header: Patient info */}
      <div className="p-3 mb-4 border rounded bg-light">
        <h4 className="text-primary mb-2">Patient Information</h4>
        <div className="d-flex justify-content-between">
          <strong>Client Name:</strong>{" "}
          <span>
            {/* In private mode you already hide the name via demo label */}
            {demoPatientLabel(activePatient.healthNumber)}
          </span>
        </div>
        <div className="d-flex justify-content-between">
          <strong>Health Number:</strong>{" "}
          <span>{displayHCN}</span>
        </div>
      </div>

      {/* Lab Uploads */}
      <h4 className="mb-3">Lab Uploads</h4>
      {labReports.length > 0 ? (
        labReports.map((report, idx) => (
          <div key={idx} className="d-flex align-items-center justify-content-between border-bottom py-2">
            <div style={{ minWidth: 250 }}>Lab Date: {report.labDate || 'N/A'}</div>
            <div style={{ minWidth: 300 }}>Uploaded: {report.PDFtimeStamp || 'N/A'}</div>
            <div style={{ flex: 1 }}>Client: {activePatient.clientName}</div>
            <button
              className="btn btn-outline-danger btn-sm d-flex align-items-center"
              title="View PDF"
              onClick={() => handleViewPDF(report.PDFfileName)}
            >
              View PDF
            </button>
          </div>
        ))
      ) : (
        <p className="text-muted">No lab uploads available.</p>
      )}

      {/* Patient Uploads */}
      <h4 className="mt-5 mb-3">Patient Uploads</h4>
      {patientReports.length > 0 ? (
        patientReports.map((report, idx) => (
          <div key={idx} className="d-flex align-items-center justify-content-between border-bottom py-2">
            <div style={{ minWidth: 250 }}>Upload Date: {report.labDate || 'N/A'}</div>
            <div style={{ minWidth: 300 }}>{report.shortName || 'Patient Document'}</div>
            <div style={{ flex: 1 }}></div>
            <button
              className="btn btn-outline-primary btn-sm d-flex align-items-center"
              title="View PDF"
              onClick={() => handleViewPDF(report.PDFfileName)}
            >
              View PDF
            </button>
          </div>
        ))
      ) : (
        <p className="text-muted">No patient uploads available.</p>
      )}

      {/* Modal for PDF viewing */}
      {pdfToShow && (
        <div
          className="modal fade show"
          style={{
            display: 'block',
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 1050
          }}
          tabIndex="-1"
          role="dialog"
        >
          <div className="modal-dialog modal-xl modal-dialog-centered" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Viewing PDF</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setPdfToShow(null)}
                ></button>
              </div>
              <div className="modal-body">
                <PdfViewer fileUrl={pdfToShow} />
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setPdfToShow(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewPatientPDF;
