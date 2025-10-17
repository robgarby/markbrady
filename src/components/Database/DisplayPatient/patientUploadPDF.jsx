// src/components/.../patientUploadPDF.jsx
import React, { useRef, useState } from 'react';
import { useGlobalContext } from '../../../Context/global.context';

const PatientFilesUpload = () => {
  const { activePatient, privateMode } = useGlobalContext();
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState(null);
  const inputRef = useRef(null);

  if (!activePatient) {
    return <div className="text-muted">No patient selected for file upload.</div>;
  }

  const isPrivate = Boolean(privateMode);

  // "Patient ####" label (first 4 digits of HCN)
  const demoPatientLabel = (healthNumber) => {
    const digits = String(healthNumber || '').replace(/\D/g, '');
    const first4 = digits.slice(0, 4) || 'XXXX';
    return `Patient ${first4}`;
  };

  // Mask 3 middle digits → 123 XXX 7890
  const maskHealthNumber3 = (hcn) => {
    const digits = String(hcn || '').replace(/\D/g, '');
    if (!digits) return hcn || '—';
    const first3 = digits.slice(0, 3);
    const last4 = digits.slice(-4);
    return `${first3} XXX ${last4}`;
  };

  const displayClientName = isPrivate
    ? demoPatientLabel(activePatient.healthNumber)
    : (activePatient.clientName || '—');

  const displayHCN = isPrivate
    ? maskHealthNumber3(activePatient.healthNumber)
    : (activePatient.healthNumber || '—');

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files?.[0] || null);
    setUploadStatus(null);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('pdf', selectedFile);
    // Send the REAL health number to backend (do not mask for API)
    formData.append('healthNumber', activePatient.healthNumber);
    formData.append('note', 'NOT A LAB REPORT');

    try {
      const response = await fetch('https://gdmt.ca/PHP/uploadPDF.php', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        setUploadStatus('✅ File uploaded successfully.');
        setSelectedFile(null);
        if (inputRef.current) inputRef.current.value = '';
      } else {
        setUploadStatus('❌ Upload failed. Please try again.');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadStatus('❌ An error occurred during upload.');
    }
  };

  return (
    <div className="container-fluid mt-4 px-3 pb-4 border-top border-2 border-secondary">
      <h5 className="text-primary">Upload a File for the Client</h5>
      <p className="text-muted mb-3">
        <strong className="text-danger">NOTE: This is NOT for lab reports</strong>. This document will not be processed
        for Lab Results, just uploaded to Client File.
      </p>

      <div className="mb-1">
        <strong>Client:</strong> {displayClientName}
      </div>
      <div className="mb-3">
        <strong>Health Number:</strong> {displayHCN}
      </div>

      <form onSubmit={handleUpload}>
        <div className="mb-3">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="form-control"
            onChange={handleFileChange}
          />
        </div>
        <button type="submit" className="btn btn-success" disabled={!selectedFile}>
          Upload PDF
        </button>
      </form>

      {uploadStatus && <div className="mt-3 alert alert-info">{uploadStatus}</div>}
    </div>
  );
};

export default PatientFilesUpload;
