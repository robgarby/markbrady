import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import {
  scrub,
  extractPatientMeta,
  runAllExtractors,
} from "../../LabWork/uploadFunction.jsx";
import { getUserFromToken } from "../../../Context/functions.jsx";
import { useGlobalContext } from "../../../Context/global.context.jsx";
import { useNavigate } from "react-router-dom";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

const LAB_API = "https://www.gdmt.ca/PHP/labData.php";

const isFilled = (v) => v !== undefined && v !== null && String(v).trim() !== "";

const normalizeHealthNumber = (value) => {
  const digits = String(value || "").replace(/\D+/g, "");
  if (digits.length >= 10) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
  }
  return String(value || "").trim();
};

const toYMD = (maybeDate) => {
  if (!maybeDate) return "";
  const parsed = Date.parse(maybeDate);
  if (!Number.isNaN(parsed)) {
    const d = new Date(parsed);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  const raw = String(maybeDate).trim();
  const match = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (match) {
    const month = String(match[1]).padStart(2, "0");
    const day = String(match[2]).padStart(2, "0");
    const year = match[3].length === 2 ? `20${match[3]}` : match[3];
    return `${year}-${month}-${day}`;
  }

  return raw;
};

const readPdfToText = async (file) => {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let rawText = "";

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent({ normalizeWhitespace: true });
    let pageText = "";

    for (const it of content.items) {
      const s = typeof it.str === "string" ? it.str : "";
      pageText += s;
      pageText += it.hasEOL ? "\n" : " ";
    }

    rawText += `${pageText}\n`;
  }

  return rawText;
};

const splitIntoCols = (obj, n = 4) => {
  const entries = Object.entries(obj || {});
  const buckets = Array.from({ length: n }, () => []);
  entries.forEach((kv, i) => buckets[i % n].push(kv));
  return buckets;
};

const bannerForMode = ({ mode, metaData, patient, onSave, onReset, busy }) => {
  if (mode === "missingPatient") {
    return (
      <div className="alert alert-danger d-flex flex-column gap-2 p-3 mb-3">
        <div className="fw-bold">This HCN does not exist in the database.</div>
        <div className="small">
          You need to upload this person through a pharmacy report.
        </div>
        <div className="small text-muted">
          Patient: <span className="fw-semibold">{metaData.name || patient?.name || "Unknown Patient"}</span>
          <br />
          Health Number: <span className="fw-semibold">{patient?.healthNumber || "Unknown HCN"}</span>
          <br />
          Lab order date: {metaData.orderDate || patient?.orderDate || "Unknown date"}
        </div>
        <div className="d-flex flex-wrap gap-2 justify-content-end mt-1">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onReset}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mode === "exists") {
    return (
      <div className="alert alert-warning d-flex flex-column gap-2 p-3 mb-3">
        <div className="fw-bold">This lab already exists.</div>
        <div className="small">
          This lab already exists for this patient history record.
        </div>
        <div className="small text-muted">
          Patient: <span className="fw-semibold">{metaData.name || patient?.name || "Unknown Patient"}</span>
          <br />
          Health Number: <span className="fw-semibold">{patient?.healthNumber || "Unknown HCN"}</span>
          <br />
          Lab order date: {metaData.orderDate || patient?.orderDate || "Unknown date"}
        </div>
        <div className="d-flex flex-wrap gap-2 justify-content-end mt-1">
          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onReset}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mode === "update") {
    return (
      <div className="alert alert-success d-flex flex-column gap-2 p-3 mb-3">
        <div className="fw-bold">Patient exists and this lab does not already exist.</div>
        <div className="small text-muted">
          Patient: <span className="fw-semibold">{metaData.name || patient?.name || "Unknown Patient"}</span>
          <br />
          Health Number: <span className="fw-semibold">{patient?.healthNumber || "Unknown HCN"}</span>
          <br />
          Lab order date: {metaData.orderDate || patient?.orderDate || "Unknown date"}
        </div>
        <div className="d-flex flex-wrap gap-2 justify-content-end mt-1">
          <button
            type="button"
            className="btn btn-success btn-sm"
            onClick={onSave}
            disabled={busy}
          >
            {busy ? "Saving..." : "Add Lab Data"}
          </button>
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm"
            onClick={onReset}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default function DynacareLab({ onParsed, onChange }) {
  const { setActivePatient } = useGlobalContext();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [msg, setMsg] = useState("");
  const [patient, setPatient] = useState(null);
  const [metaData, setMetaData] = useState({});
  const [fileKey, setFileKey] = useState(0);
  const [saveMode, setSaveMode] = useState("");
  const [patientExists, setPatientExists] = useState(false);
  const [historyExists, setHistoryExists] = useState(false);
  const [isReadingLab, setIsReadingLab] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (onChange && patient) onChange(patient);
  }, [onChange, patient]);

  const resetAll = () => {
    setMsg("");
    setPatient(null);
    setMetaData({});
    setSaveMode("");
    setPatientExists(false);
    setHistoryExists(false);
    setIsReadingLab(true);
    setIsSaving(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFileKey((k) => k + 1);
  };

  const updateLabField = (k, v) => {
    setPatient((prev) => (
      prev
        ? {
            ...prev,
            labResults: { ...(prev.labResults || {}), [k]: v },
          }
        : prev
    ));
  };

  const validateByHCN = async (record) => {
    try {
      const user = await getUserFromToken();
      if (!user || (Array.isArray(user) && user.length === 0)) {
        navigate("/login");
        return;
      }

      const resp = await fetch(LAB_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptName: "validateLabByHCN",
          healthNumber: record.healthNumber || "",
          orderDate: record.orderDate || "",
          patientDB: user?.patientTable || "",
          historyDB: user?.historyTable || "",
        }),
      });

      const result = await resp.json();
      console.log("Validation result:", result);  
      const patientExistsBool = Number(result.patientExists || 0) > 0;
      const historyExistsBool = Number(result.historyExists || result.HistoryExists || 0) > 0;

      setPatientExists(patientExistsBool);
      setHistoryExists(historyExistsBool);
      setIsReadingLab(false);

      if (!patientExistsBool) {
        setSaveMode("missingPatient");
      } else if (!historyExistsBool) {
        setSaveMode("update");
      } else {
        setSaveMode("exists");
      }
    } catch (err) {
      console.error("Validation error:", err);
      setIsReadingLab(false);
      setMsg("Could not validate patient/lab.");
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;

    try {
      setMsg("Reading PDF...");
      setIsReadingLab(true);

      const rawText = await readPdfToText(file);
      const text = scrub(rawText);
      const meta = extractPatientMeta(text) || {};
      const labResults = runAllExtractors(text) || {};

      const next = {
        ...meta,
        healthNumber: normalizeHealthNumber(meta.healthNumber || ""),
        orderDate: toYMD(meta.orderDate || ""),
        labResults,
      };

      setMetaData(next);
      setPatient(next);
      setMsg("");
      onParsed?.(next);

      await validateByHCN(next);
    } catch (err) {
      console.error(err);
      setMsg("Could not read/parse PDF.");
      setPatient(null);
      setMetaData({});
      setSaveMode("");
      setIsReadingLab(true);
    }
  };

  const saveLabToExistingPatient = async () => {
    if (!patient || saveMode !== "update") return;

    try {
      setIsSaving(true);
      setMsg("");

      const user = await getUserFromToken();
      if (!user || (Array.isArray(user) && user.length === 0)) {
        navigate("/login");
        return;
      }

      const saveResp = await fetch(LAB_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptName: "updateExistingLabByHCN",
          patient,
          patientDB: user?.patientTable || "",
          historyDB: user?.historyTable || "",
        }),
      });

      const saveResult = await saveResp.json();
      if (!saveResult.success || saveResult.success === "No") {
        setMsg(saveResult.error || "Save failed.");
        setIsSaving(false);
        return;
      }

      const patientResp = await fetch(LAB_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptName: "getPatientByHealthNumber",
          healthNumber: patient.healthNumber || "",
          patientDB: user?.patientTable || "",
          historyDB: user?.historyTable || "",
        }),
      });

      const patientData = await patientResp.json();
      if (patientData?.patient) {
        setActivePatient(patientData.patient);
      }

      resetAll();
    } catch (err) {
      console.error("Save error:", err);
      setMsg("Could not save lab.");
      setIsSaving(false);
    }
  };

  const [c0, c1, c2, c3] = splitIntoCols(patient?.labResults, 4);

  const renderCol = (col) => (
    col.length === 0 ? (
      <div className="text-muted small"><em>No values.</em></div>
    ) : (
      col.map(([key, value]) => (
        <div key={key} className="col-48 d-flex align-items-center mb-2">
          <div className="col-28 text-end pe-2 fw-bold text-capitalize">{key}:</div>
          <div className="col-20">
            <input
              type="text"
              className={`form-control ${isFilled(value) ? "alert-success" : ""}`}
              value={value || ""}
              onChange={(e) => updateLabField(key, e.target.value)}
              placeholder="—"
            />
          </div>
        </div>
      ))
    )
  );

  return (
    <div className="container my-3" style={{ maxHeight: "75vh", overflowY: "auto", overflowX: "hidden" }}>
      <div className="row mb-2">
        <div className="col-48 d-flex align-items-center">
          <h5 className="m-0">Dynacare Lab: Parse &amp; Review</h5>
          <div className="ms-auto d-flex gap-2">
            <button className="btn btn-outline-secondary" onClick={resetAll} disabled={isSaving}>
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-24">
          <input
            key={fileKey}
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            disabled={isSaving}
          />
        </div>
        <div className="col-24">
          {msg && <div className="alert alert-info py-2 m-0">{msg}</div>}
        </div>
      </div>

      {!patient ? (
        <div className="row">
          <div className="col-48 text-muted">
            <em>Select a Dynacare PDF lab report to parse and review.</em>
          </div>
        </div>
      ) : (
        <>
          <div className="row g-3">
            <div className="col-48">
              <div className="card p-2">
                <div className="col-36 offset-6 d-flex">
                  <div className="col-24">
                    <div className="w-100 fw-bold mb-2">Patient : {patient.name || "-"}</div>
                  </div>
                  <div className="col-24">
                    <div className="w-100 fw-bold mb-2">Health Number : {patient.healthNumber || "-"}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-100" />

            <div className="col-48 mt-2">
              <div className="card h-100">
                <div className="card-header">Actions</div>
                <div className="card-body">
                  {bannerForMode({
                    mode: saveMode,
                    metaData,
                    patient,
                    onSave: saveLabToExistingPatient,
                    onReset: resetAll,
                    busy: isSaving,
                  })}

                  {!isReadingLab && saveMode === "" && (
                    <div className="text-muted small"><em>No action available.</em></div>
                  )}

                  {!isReadingLab && (
                    <div className="small text-muted mt-2">
                      Patient exists: {patientExists ? "Yes" : "No"} &nbsp;|&nbsp; Lab already in history: {historyExists ? "Yes" : "No"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="row mt-3">
            <div className="col-48">
              <div className="card">
                <div className="card-header">Labs</div>
                <div className="card-body">
                  <div className="row g-3">
                    <div className="col-12 fs-7">{renderCol(c0)}</div>
                    <div className="col-12 fs-7">{renderCol(c1)}</div>
                    <div className="col-12 fs-7">{renderCol(c2)}</div>
                    <div className="col-12 fs-7">{renderCol(c3)}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
