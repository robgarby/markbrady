// src/components/.../dynacareLab.component.jsx
import React, { useRef, useState, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import DragBox from "../DragBox/Drag/dragBox.component.jsx";
import { scrub, extractPatientMeta, runAllExtractors } from "./uploadFunction.jsx";
import { getUserFromToken } from "../../Context/functions.jsx";
import { useGlobalContext } from "../../Context/global.context.jsx";
import { useNavigate } from "react-router-dom";

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
  const { activePatient } = useGlobalContext();

  const [sameClient, setSameClient] = useState(false);
  const [isNewLab, setIsNewLab] = useState(false);
  const [newClientLab, setNewClientLab] = useState(false);
  const [isreadingLab, setIsreadingLab] = useState(true);

  const LAB_API = "https://www.gdmt.ca/PHP/labData.php"; // replace with real endpoint

  const navigate = useNavigate();

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

      // update local view state
      setPatient(next);
      setMsg("");

      // notify parent (existing)
      onParsed?.(next);

      // immediately run your decision function with the full record
      makeDecision(next, activePatient);
    } catch (err) {
      console.error(err);
      setMsg("Could not read/parse PDF.");
      setPatient(null);
    }
  };

  const resetAll = () => {
    setIsreadingLab(true);
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

  // simple decision hook (kept as-is)
  const makeDecision = (record, currentPatient) => {
    let healthNumber = record.healthNumber || "";
    let orderDate = record.orderDate || "";
    let scriptName = 'validateLab';
    console.log(currentPatient);
    (async () => {
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
            healthNumber,
            orderDate,
            scriptName,
            patientDB: user?.patientTable || "",
            historyDB: user?.historyTable || ""
          }),
        });

        const txt = await resp.text();
        let result = {};
        try {
          result = JSON.parse(txt);
          setIsreadingLab(false);
          if (currentPatient.healthNumber === healthNumber) {
            setSameClient(true);
          } else {
            setSameClient(false);
          }
          // if (result.HistoryExists && result.HistoryExists > 0) {
          //   setIsNewLab(false);
          // } else {
          //   setIsNewLab(true);
          // }
          if (result.patientExists && result.patientExists > 0) {
            setNewClientLab(false);
          } else {
            setNewClientLab(true);
            setIsNewLab(false);
          }
        } catch {
          // try to recover if the server returned a quoted JSON string
          try {
            result = JSON.parse(JSON.parse(txt));
          } catch (err) {
            console.warn("Could not parse decision response:", err, txt);
          }
        }

        // Normalize expected fields onto the record so the caller can inspect them
        record.exists = result.exists === true || result.exists === "true";
        record.orderDateStatus = result.orderdate || result.orderDate || null;

        console.log("Decision result:", result);
      } catch (err) {
        console.error("Decision fetch error:", err);
      }
    })();
  };

  const letsSaveTheData = async (status) => {
    let scriptName = null;
    console.log("letsSaveTheData called with status:", status);
    if (status === 'new') {
      scriptName = 'newClientLab';
    } else if (status === 'update') {
      scriptName = 'updateExistingLab';
    }
    if (!scriptName) return;
    const user = await getUserFromToken();
    if (!user || (Array.isArray(user) && user.length === 0)) {
      navigate("/login");
      return;
    }
    const resp = await fetch(LAB_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patient,
        scriptName,
        patientDB: user?.patientTable || "",
        historyDB: user?.historyTable || ""
      }),
    });

    const txt = await resp.text();
    let result = {};
    try {
      result = JSON.parse(txt);
      console.log("Save result:", result);
    } catch {
      console.warn("Could not parse save response:", txt);
    }
  }

  return (
    <DragBox
      id="Dynacare"
      storageKey="Dynacare_POSITION"
      defaultPos={{ x: 300, y: 340 }}
      title="Dynacare Lab Parser [LOCAL ONLY]"
      width={1400}
      onAdd={null}
      zIndex={2050}
      addNote="-"
    >
      <div
        className="container my-3"
        style={{ maxHeight: '75vh', overflowY: 'auto', overflowX: 'hidden' }}
      >
        {isreadingLab && (
          <div className="">
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
          </div>
        )}

        {/* Parsed content */}
        {!patient ? (
          <>
            {isreadingLab && (
              <div className="">
                <div className="row">
                  <div className="col-48 text-muted">
                    <em>Select a Dynacare (PDF) lab report to parse and review.</em>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Patient summary (READ-ONLY) + actions */}
            <div className="row g-3">
              <div className="col-48">
                <div className="card p-2">
                  <div className="col-36 offset-6 d-flex">
                    <div className="col-24"><div className="w-100 fw-bold mb-2">Patient : {patient.name}</div></div>
                    <div className="col-24"><div className="w-100 fw-bold mb-2">Health Number : {patient.healthNumber}</div></div>
                    {/* <ReadOnlyLine label="Sex" value={patient.sex} /> */}
                    {/* <ReadOnlyLine label="Order Date" value={patient.orderDate} /> */}
                  </div>
                </div>
              </div>

              {/* force a new line so the Actions card sits below the patient summary */}
              <div className="w-100" />

              <div className="col-48 mt-2">
                <div className="card h-100">
                  <div className="card-header">Actions</div>

                  {/* UPDATED BUTTON BLOCKS: each option has a Cancel */}
                  {sameClient ? (
                    <div className="alert-success d-flex flex-column justify-content-center align-items-center p-3">
                      <div className="text-success fw-bold row">This Matches The Same Patient</div>

                      {isNewLab ? (
                        <div className="small text-muted mt-2 d-flex gap-2">
                          <div className="btn btn-success">This is a New Lab</div>
                          <div className="btn btn-outline-secondary" onClick={resetAll}>Cancel</div>
                        </div>
                      ) : (
                        <div className="small text-muted mt-2 d-flex gap-2">
                          <div className="btn btn-danger" onClick={() => letsSaveTheData('update')}>This Lab Already Exists 1</div>
                          <div className="btn btn-outline-secondary" onClick={resetAll}>Cancel</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="alert-danger d-flex flex-column justify-content-center align-items-center p-3">
                      <div className="text-danger fw-bold row">This is NOT THE SAME PATIENT</div>

                      <div className="small text-muted mt-2 d-flex gap-2">
                        {newClientLab && (
                          <>
                            <div className="btn btn-success" onClick={() => letsSaveTheData('new')}>New Patient - Add This Lab</div>
                            <div className="btn btn-outline-secondary" onClick={resetAll}>Cancel</div>
                          </>
                        )}
                      </div>

                      <div className="small text-muted mt-2 d-flex gap-2">
                        {isNewLab && !newClientLab && (
                          <>
                            <div className="btn btn-warning">But Since This Patient Exists, You can Add This Lab</div>
                            <div className="btn btn-outline-secondary" onClick={resetAll}>Cancel</div>
                          </>
                        )}
                      </div>

                      <div className="small text-muted mt-2 d-flex gap-2">
                        {!isNewLab && !newClientLab && (
                          <>
                            <div className="btn btn-danger" onClick={resetAll}>This Lab Already Exists For This Patient, You cannot load it</div>
                            <div className="btn btn-outline-secondary" onClick={resetAll}>Cancel</div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                  {/* END UPDATED BUTTON BLOCKS */}
                </div>
              </div>
            </div>

            {/* ONE box with Labs laid out in FOUR columns */}
            <div className="row mt-3">
              <div className="col-48">
                <div className="card">
                  <div className="card-header">Labs</div>
                  <div className="card-body">
                    {(() => {
                      // local splitter so we don't touch any top logic
                      const splitIntoCols = (obj, n = 4) => {
                        const entries = Object.entries(obj || {});
                        const buckets = Array.from({ length: n }, () => []);
                        entries.forEach((kv, i) => buckets[i % n].push(kv));
                        return buckets;
                      };

                      const [c0, c1, c2, c3] = splitIntoCols(patient.labResults, 4);

                      return (
                        <div className="row g-3">
                          {/* Each column spans 12 of your 48-grid = 4 columns */}
                          <div className="col-12 fs-7">
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

                          <div className="col-12 fs-7">
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

                          <div className="col-12 fs-7">
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

                          <div className="col-12 fs-7">
                            {c3.length === 0 ? (
                              <div className="text-muted small"><em>No values.</em></div>
                            ) : (
                              c3.map(([key, value]) => (
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
