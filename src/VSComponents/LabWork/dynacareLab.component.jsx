// src/components/.../dynacareLab.component.jsx
import React, { useRef, useState, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import DragBox from "../DragBox/Drag/dragBox.component.jsx";
import { scrub, extractPatientMeta, runAllExtractors } from "./uploadFunction.jsx";

// Keep worker consistent with your stack
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

const isFilled = (v) => v !== undefined && v !== null && String(v).trim() !== "";
const dashIfEmpty = (v) => (isFilled(v) ? v : "—");

// Normalize many date formats -> YYYY-MM-DD (if parsable)
const toYMD = (maybeDate) => {
  if (!maybeDate) return maybeDate;
  const t = Date.parse(maybeDate);
  if (Number.isNaN(t)) return maybeDate;
  const d = new Date(t);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Read all text from a PDF file client-side
const readPdfToText = async (file) => {
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
  return rawText;
};

export default function DynacareLab({ onParsed, onChange }) {
  const [msg, setMsg] = useState("");
  const [patient, setPatient] = useState(null); // { ...meta, labResults: {...} }
  const [fileKey, setFileKey] = useState(0);   // lets us reset the file input
  const fileInputRef = useRef(null);

  // Bubble changes up if parent wants them
  useEffect(() => {
    if (onChange && patient) onChange(patient);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;

    try {
      setMsg("Reading PDF…");
      const rawText = await readPdfToText(file);

      // Clean and parse
      const text = scrub(rawText);
      const meta = extractPatientMeta(text) || {};
      const labResults = runAllExtractors(text) || {};

      if (meta && meta.orderDate) meta.orderDate = toYMD(meta.orderDate);

      const next = { ...meta, labResults };
      setPatient(next);
      setMsg("");

      onParsed?.(next);
    } catch (err) {
      console.error(err);
      setMsg("Could not read/parse PDF.");
      setPatient(null);
    }
  };

  const resetAll = () => {
    setPatient(null);
    setMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFileKey((k) => k + 1);
  };

  // Only labs are editable
  const updateLabField = (k, v) =>
    setPatient((prev) =>
      prev ? { ...prev, labResults: { ...(prev.labResults || {}), [k]: v } } : prev
    );

  // Small read-only line item
  const ReadOnlyLine = ({ label, value }) => (
    <div className="d-flex align-items-center py-1 border-bottom">
      <div className="col-16 text-end pe-2 fw-bold">{label}</div>
      <div className="col-32">{dashIfEmpty(value)}</div>
    </div>
  );

  // Build 3 equal arrays for the single "Labs" card (3 columns inside one box)
  const splitIntoThree = (results) => {
    const entries = Object.entries(results || {});
    const cols = [[], [], []];
    entries.forEach((kv, i) => cols[i % 3].push(kv));
    return cols;
  };

  return (
    <DragBox
      id="Dynacare"
      storageKey="Dynacare_POSITION"
      defaultPos={{ x: 300, y: 340 }}
      title="Dynacare Lab Parser [LOCAL ONLY]"
      width={1200}
      onAdd={null}
      zIndex={2050}
      addNote="-"
    >
      <div className="container my-3">
        {/* Header + controls */}
        <div className="row mb-2">
          <div className="col-48 d-flex align-items-center">
            <h5 className="m-0">Dynacare Lab: Parse & Review (Local Only)</h5>
            <div className="ms-auto d-flex gap-2">
              <button className="btn btn-outline-secondary" onClick={resetAll}>Clear</button>
            </div>
          </div>
        </div>

        {/* File picker + status */}
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

        {/* Parsed content */}
        {!patient ? (
          <div className="row">
            <div className="col-48 text-muted">
              <em>Select a Dynacare (PDF) lab report to parse and review.</em>
            </div>
          </div>
        ) : (
          <>
            {/* Patient summary (READ-ONLY) + actions */}
            <div className="row g-3">
              <div className="col-36">
                <div className="card">
                  <div className="card-body">
                    <ReadOnlyLine label="Name" value={patient.name} />
                    <ReadOnlyLine label="Ontario Health Number (HCN)" value={patient.healthNumber} />
                    {/* <ReadOnlyLine label="Sex" value={patient.sex} /> */}
                    {/* Hide the rest for now per your simplification */}
                    {/* <ReadOnlyLine label="Order Date" value={patient.orderDate} /> */}
                  </div>
                </div>
              </div>

              <div className="col-12">
                <div className="card h-100">
                  <div className="card-header">Actions</div>
                  <div className="card-body d-flex flex-column gap-2">
                    <div className="small text-muted">This is where Add actions will go.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* ONE box with Labs laid out in THREE columns */}
            <div className="row mt-3">
              <div className="col-48">
                <div className="card">
                  <div className="card-header">Labs</div>
                  <div className="card-body">
                    {(() => {
                      const [c0, c1, c2] = splitIntoThree(patient.labResults);

                      return (
                        <div className="row g-3">
                          {/* Each column spans 16 of your 48-grid = 3 columns */}
                          <div className="col-16 fs-7">
                            {c0.length === 0 ? (
                              <div className="text-muted small"><em>No values.</em></div>
                            ) : (
                              c0.map(([key, value]) => (
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
                            )}
                          </div>

                          <div className="col-16 fs-7">
                            {c1.length === 0 ? (
                              <div className="text-muted small"><em>No values.</em></div>
                            ) : (
                              c1.map(([key, value]) => (
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
                            )}
                          </div>

                          <div className="col-16 fs-7">
                            {c2.length === 0 ? (
                              <div className="text-muted small"><em>No values.</em></div>
                            ) : (
                              c2.map(([key, value]) => (
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
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DragBox>
  );
}
