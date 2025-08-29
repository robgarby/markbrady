import React, { useState } from 'react';
import { useGlobalContext } from '../../../Context/global.context';

const PatientFilesUpload = () => {
    const { activePatient } = useGlobalContext();
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadStatus, setUploadStatus] = useState(null);

    if (!activePatient) {
        return <div className="text-muted">No patient selected for file upload.</div>;
    }

    const handleFileChange = (e) => {
        setSelectedFile(e.target.files[0]);
        setUploadStatus(null);
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append('pdf', selectedFile);
        formData.append('healthNumber', activePatient.healthNumber);
        formData.append('note', 'NOT A LAB REPORT');

        try {
            const response = await fetch("https://optimizingdyslipidemia.com/PHP/uploadClientPDF.php", {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                setUploadStatus('✅ File uploaded successfully.');
                setSelectedFile(null);
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
                <strong className="text-danger">NOTE: This is NOT for lab reports</strong>. This document will not be processed for Lab Results, just uploaded to Client File
            </p>

            <div className="mb-2">
                <strong>Client:</strong> {activePatient.clientName}
            </div>

            <form onSubmit={handleUpload}>
                <div className="mb-3">
                    <input
                        type="file"
                        accept="application/pdf"
                        className="form-control"
                        onChange={handleFileChange}
                    />
                </div>
                <button
                    type="submit"
                    className="btn btn-success"
                    disabled={!selectedFile}
                >
                    Upload PDF
                </button>
            </form>

            {uploadStatus && (
                <div className="mt-3 alert alert-info">
                    {uploadStatus}
                </div>
            )}
        </div>
    );
};

export default PatientFilesUpload;
