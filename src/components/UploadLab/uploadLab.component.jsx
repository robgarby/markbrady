// src/components/.../uploadLab.component.jsx
import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { scrub, extractPatientMeta, runAllExtractors } from "./uploadFunction.jsx";
import { useNavigate } from "react-router-dom";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

const isFilled = (v) => v !== undefined && v !== null && String(v).trim() !== "";

const UploadLab = () => {
  const [patient, setPatient] = useState(null);
  const [msg, setMsg] = useState("");
  const [patientStatus, setPatientStatus] = useState(null); // "new" or "existing"
  const [labExists, setLabExists] = useState(false);
  const [nextAppointment, setNextAppointment] = useState(null);

  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [fileKey, setFileKey] = useState(0);

  const resetForm = (message = "") => {
    setPatient(null);
    setPatientStatus(null);
    setLabExists(false);
    setMsg(message);
    setNextAppointment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFileKey((k) => k + 1);
  };

  const setTheDate = (dateString) => {
    const parsed = Date.parse(dateString);
    if (!isNaN(parsed)) {
      const d = new Date(parsed);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      setNextAppointment(`${yyyy}-${mm}-${dd}`);
    }
    setNextAppointment(dateString);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    setLabExists(false);
    if (!file || file.type !== "application/pdf") return;

    try {
      setMsg("Reading PDF…");
      const buf = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

      let rawText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent({ normalizeWhitespace: true });
        let pageText = "";
        for (const it of content.items) {
          const s = typeof it.str === "string" ? it.str : "";
          pageText += s;
          pageText += it.hasEOL ? "\n" : " ";
        }
        rawText += pageText + "\n";
      }

      const text = scrub(rawText);
      const meta = extractPatientMeta(text);
      const labResults = runAllExtractors(text);

      if (meta.orderDate) {
        const parsed = Date.parse(meta.orderDate);
        if (!isNaN(parsed)) {
          const d = new Date(parsed);
          const yyyy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          meta.orderDate = `${yyyy}-${mm}-${dd}`;
        }
      }

      setMsg("Checking client status…");
      try {
        const response = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            healthNumber: meta.healthNumber,
            labdate: meta.orderDate,
            script: "getStatus",
          }),
        });
        const status = await response.json();
        setPatientStatus(status.status);
        if (status.lab === "Exists") setLabExists(true);
        setPatient({ ...meta, labResults });
        setMsg("");
      } catch (err) {
        setMsg("Error checking client status.");
        setPatient(null);
        setPatientStatus(null);
        console.error(err);
      }
    } catch (err) {
      console.error(err);
      setMsg("Could not read/parse PDF.");
      setPatient(null);
    }
  };

  const letsSaveTheData = async () => {
    setMsg("Saving data…");
    if (patientStatus === "new" && patient && fileInputRef.current && fileInputRef.current.files[0]) {
      try {
        const f = fileInputRef.current.files[0];
        const formData = new FormData();
        formData.append("pdf", f, f.name);
        formData.append("healthNumber", (patient.healthNumber || "").replace(/\D+/g, ""));
        formData.append("patientStatus", patientStatus || "");
        formData.append("nextAppointment", nextAppointment || "");
        if (patient.orderDate) formData.append("orderDate", patient.orderDate);

        const response = await fetch(
          "https://optimizingdyslipidemia.com/PHP/uploadClientPDF.php",
          { method: "POST", body: formData }
        );
        const result = await response.json();

        if (result?.success === "Yes") {
          setMsg("Updating Database");
          const db = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nextAppointment: nextAppointment,
              patient,
              patientStatus,
              script: "saveTheDataButton",
            }),
          });

          const dbRes = await db.json().catch(() => ({}));
          if (dbRes.success === "Yes") {
            setMsg("Database updated successfully.");
            resetForm("Saved! You can upload the next PDF.");
          } else {
            setMsg("This is a Duplicate Record");
          }
        }
      } catch (err) {
        console.error(err);
        setMsg("Error uploading PDF.");
      }
    } else {
      // existing patient update
      const f = fileInputRef.current.files[0];
      const formData = new FormData();
      formData.append("pdf", f, f.name);
      formData.append("healthNumber", (patient.healthNumber || "").replace(/\D+/g, ""));
      formData.append("patientStatus", patientStatus || "");
      if (patient.orderDate) formData.append("orderDate", patient.orderDate);

      const response = await fetch(
        "https://optimizingdyslipidemia.com/PHP/uploadClientPDF.php",
        { method: "POST", body: formData }
      );
      const result = await response.json();

      if (result?.success === "Yes") {
        setMsg("Updating Database");
        const db = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nextAppointment: nextAppointment,
            patient,
            script: "updatePatient",
          }),
        });

        const dbRes = await db.json().catch(() => ({}));
        if (dbRes.status === "updated") {
          setMsg("Database updated successfully.");
          resetForm("Saved! You can upload the next PDF.");
        } else if (dbRes.status === "duplicate") {
          setMsg("This is a Duplicate Record - Please upload a new Lab");
        }
      }
    }
  };

  return (
    <div className="container my-3">
      <div className="row mb-2">
        <div className="col-48 d-flex">
          <h5 className="mb-2">Upload &amp; Parse Lab PDF</h5>
          <div className="ms-auto">
            <button className="btn btn-primary" onClick={() => navigate("/dashboard")}>
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="row g-2 mb-3">
        <div className="col-24">
          <input
            key={fileKey}
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
          />
        </div>
        <div className="col-24">
          {msg && <div className="alert alert-info py-2 m-0">{msg}</div>}
        </div>
      </div>

      {/* Patient & Results */}
      {patient ? (
        <div className="row g-3">
          {/* Patient */}
          <div className="col-48 d-flex gap-2">
            <div className="card col-36">
              <div className="card-header">Patient</div>
              <div className="card-body">
                {/* Identity row */}
                <div className="row mb-2">
                  <div className="col-24 col-md-12">
                    <strong>Name:</strong> {patient.name || "—"}
                  </div>
                  <div className="col-24 col-md-12">
                    <strong>HCN:</strong> {patient.healthNumber || "—"}
                  </div>
                </div>

                {/* Demographics row */}
                <div className="row mb-2">
                  <div className="col-12">
                    <strong>Sex:</strong> {patient.sex || "—"}
                  </div>
                  <div className="col-12">
                    <strong>DOB:</strong> {patient.dateOfBirth || "—"}
                  </div>
                  <div className="col-24">
                    <strong>Order Date:</strong> {patient.orderDate || "—"}
                  </div>
                </div>

                {/* Provider row */}
                <div className="row mb-2">
                  <div className="col-48">
                    <strong>Provider:</strong> {patient.providerName || "—"}{" "}
                    {patient.providerNumber ? `(${patient.providerNumber})` : ""}
                  </div>
                </div>

                {/* Address rows */}
                <div className="row g-2">
                  <div className="col-48">
                    <label className="form-label mb-1">Full Address</label>
                    <input
                      className={`form-control ${isFilled(patient.fullAddress) ? "alert-success" : ""}`}
                      value={patient.fullAddress || ""}
                      readOnly
                      placeholder="—"
                    />
                  </div>

                  <div className="col-24">
                    <label className="form-label mb-1">Street</label>
                    <input
                      className={`form-control ${isFilled(patient.street) ? "alert-success" : ""}`}
                      value={patient.street || ""}
                      readOnly
                      placeholder="—"
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">City</label>
                    <input
                      className={`form-control ${isFilled(patient.city) ? "alert-success" : ""}`}
                      value={patient.city || ""}
                      readOnly
                      placeholder="—"
                    />
                  </div>

                  <div className="col-6">
                    <label className="form-label mb-1">Province</label>
                    <input
                      className={`form-control ${isFilled(patient.province) ? "alert-success" : ""}`}
                      value={patient.province || ""}
                      readOnly
                      placeholder="—"
                    />
                  </div>

                  <div className="col-6">
                    <label className="form-label mb-1">Postal Code</label>
                    <input
                      className={`form-control ${isFilled(patient.postalCode) ? "alert-success" : ""}`}
                      value={patient.postalCode || ""}
                      readOnly
                      placeholder="—"
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label mb-1">Telephone</label>
                    <input
                      className={`form-control ${isFilled(patient.telephone) ? "alert-success" : ""}`}
                      value={patient.telephone || ""}
                      readOnly
                      placeholder="—"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="col-11">
              <div className="d-flex flex-column justify-content-center align-items-center h-100 border rounded p-3">
                {labExists ? (
                  <div className="alert alert-danger text-center m-0 w-100">
                    This Lab Exists in DB
                  </div>
                ) : (
                  <button
                    onClick={letsSaveTheData}
                    className={`btn text-white ${patientStatus === "new" ? "btn-success" : "btn-warning"}`}
                    style={{ minWidth: 220 }}
                  >
                    {patientStatus === "new" ? "Add New Patient" : "Update Existing Client"}
                  </button>
                )}

                <div className="w-100 mt-3">
                  <label className="form-label mb-1">Next Appointment</label>
                  <input
                    type="date"
                    className="form-control"
                    value={nextAppointment || ""}
                    onChange={(e) => setTheDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ---------- Three horizontal columns (flex-based) ---------- */}
          <div className="col-48">
            <div
              className="d-flex gap-3"
              style={{ flexWrap: "nowrap" }}
            >
              {/* Column 1: Current Lab (functional) */}
              <div className="card h-100" style={{ flex: "0 0 33.333%", minWidth: 0 }}>
                <div className="card-header">Current Lab</div>
                <div className="card-body">
                  <div className="row g-2">
                    {Object.entries(patient.labResults || {}).map(([key, value]) => (
                      <div key={key} className="col-24 d-flex align-items-center">
                        <div className="col-16 text-end pe-2 fw-bold text-capitalize">{key}:</div>
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
                </div>
              </div>

              {/* Column 2: Life Lab Lab (coming soon) */}
              <div className="card h-100 d-flex align-items-center justify-content-center"
                   style={{ flex: "0 0 33.333%", minWidth: 0 }}>
                <div className="w-100">
                  <div className="card-header">Life Lab Lab</div>
                  <div className="card-body d-flex align-items-center justify-content-center">
                    <div className="text-muted">Coming soon</div>
                  </div>
                </div>
              </div>

              {/* Column 3: Hospital Record (coming soon) */}
              <div className="card h-100 d-flex align-items-center justify-content-center"
                   style={{ flex: "0 0 33.333%", minWidth: 0 }}>
                <div className="w-100">
                  <div className="card-header">Hospital Record</div>
                  <div className="card-body d-flex align-items-center justify-content-center">
                    <div className="text-muted">Coming soon</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* ---------- /Three horizontal columns ---------- */}
        </div>
      ) : (
        <div className="row">
          <div className="col-48">
            <em>No data extracted yet.</em>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadLab;
