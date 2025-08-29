// uploadLab.component.jsx — 48-col layout, results-only UI, using uploadFunction.jsx
import React, { useState } from "react";
import * as pdfjsLib from "pdfjs-dist";

import {
  scrub,
  extractPatientMeta,
  runAllExtractors,        // one-call all tests
  EXTRACTORS,           // (optional) import this if you want to call individual extractors
} from "./uploadFunction.jsx";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

const isFilled = (v) => v !== undefined && v !== null && String(v).trim() !== "";

const UploadLab = () => {
  const [patient, setPatient] = useState(null);
  const [msg, setMsg] = useState("");

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;

    try {
      setMsg("Reading PDF…");
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

      // Gather text from pdf.js
      let rawText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        rawText += content.items.map((it) => (typeof it.str === "string" ? it.str : "")).join(" ") + "\n";
      }

      const text = scrub(rawText);
      const meta = extractPatientMeta(text);
      const labResults = runAllExtractors(text); // cholesterol uses the special routine under the hood

      setPatient({ ...meta, labResults });
      setMsg("");
    } catch (err) {
      console.error(err);
      setMsg("Could not read/parse PDF.");
      setPatient(null);
    }
  };

  return (
    <div className="container my-3">
      {/* Header */}
      <div className="row mb-2">
        <div className="col-48">
          <h5 className="mb-2">Upload &amp; Parse Lab PDF</h5>
        </div>
      </div>

      {/* Controls */}
      <div className="row g-2 mb-3">
        <div className="col-24">
          <input type="file" accept="application/pdf" onChange={handleFileChange} />
        </div>
        <div className="col-24">{msg && <div className="alert alert-info py-2 m-0">{msg}</div>}</div>
      </div>

      {/* Patient & Results */}
      {patient ? (
        <div className="row g-3">
          {/* Patient */}
          <div className="col-48">
            <div className="card">
              <div className="card-header">Patient</div>
              <div className="card-body">
                <div className="row mb-2">
                  <div className="col-24 col-md-12"><strong>Name:</strong> {patient.name || "—"}</div>
                  <div className="col-24 col-md-12"><strong>HCN:</strong> {patient.healthNumber || "—"}</div>
                </div>
                <div className="row mb-2">
                  <div className="col-12"><strong>Sex:</strong> {patient.sex || "—"}</div>
                  <div className="col-12"><strong>DOB:</strong> {patient.dateOfBirth || "—"}</div>
                  <div className="col-24"><strong>Order Date:</strong> {patient.orderDate || "—"}</div>
                </div>
                <div className="row">
                  <div className="col-48">
                    <strong>Provider:</strong> {patient.providerName || "—"} {patient.providerNumber ? `(${patient.providerNumber})` : ""}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="col-48">
            <div className="card">
              <div className="card-header">Lab Results</div>
              <div className="card-body">
                <div className="row g-2">
                  {Object.entries(patient.labResults || {}).map(([key, value]) => (
                    <div key={key} className="col-24 col-md-16 d-flex align-items-center">
                      <div className="col-36 text-end pe-2 fw-bold text-capitalize">{key}:</div>
                      <div className="col-8">
                        <input
                          type="text"
                          className={`form-control ${isFilled(value) ? "alert-success" : ""}`}
                          value={value || ""}
                          onChange={(e) =>
                            setPatient((prev) => ({
                              ...prev,
                              labResults: { ...prev.labResults, [key]: e.target.value },
                            }))
                          }
                          placeholder="—"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Add Save/Cancel here if persisting */}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="row"><div className="col-48"><em>No data extracted yet.</em></div></div>
      )}
    </div>
  );
};

export default UploadLab;
