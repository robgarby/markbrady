// src/components/Labs/pharmacyMedHistory.component.jsx
import React, { useRef, useState, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import DragBox from "../DragBox/Drag/dragBox.component.jsx";

// Keep worker consistent with your stack
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

// ---------- Helpers ----------

// Read all text from a PDF file client-side (similar to Dynacare)
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

const normalizeText = (txt) =>
  (txt || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();

/**
 * Extract basic patient meta from the pharmacy med history PDF.
 * Target fields:
 *  - name: line like "Andrews, Dana"
 *  - HCN: first "Billing Info XXXXX" pattern
 *  - address: street + city/province/postal inferred around postal code
 *  - allergies: after "Allergies - ..."
 *  - conditions: after "Conditions - ..."
 */
const extractPatientMetaFromPharm = (rawText) => {
  const text = normalizeText(rawText);
  const meta = {
    name: "",
    healthNumber: "",
    street: "",
    city: "",
    province: "",
    postalCode: "",
    allergies: [],
    conditions: [],
  };

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // --- Name: first line that looks like "Last, First" ---
  for (const line of lines) {
    const m = line.match(/^([A-ZÀ-Ÿ][^,]+,\s*[A-ZÀ-Ÿ][^,]+)$/);
    if (m) {
      meta.name = m[1].trim();
      break;
    }
  }

  // --- HCN: first "Billing Info XXXXXX" ---
  const hcnMatch = text.match(/Billing Info\s+([A-Z0-9 ]{6,})\s+Rel:/i);
  if (hcnMatch) {
    meta.healthNumber = hcnMatch[1].trim();
  }

  // --- Address: find line with Canadian postal code, use previous line as street ---
  const postalRegex = /\b([A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const pm = line.match(postalRegex);
    if (pm) {
      meta.postalCode = pm[1];
      // crude split: city + province before postal
      const before = line.substring(0, line.indexOf(pm[1])).trim();
      const parts = before.split(/\s+/);
      if (parts.length >= 2) {
        meta.province = parts[parts.length - 1];
        meta.city = parts.slice(0, parts.length - 1).join(" ");
      } else {
        meta.city = before;
      }
      // previous non-empty line as street
      for (let j = i - 1; j >= 0; j--) {
        if (lines[j] && !/Patient Medical History Report/i.test(lines[j])) {
          meta.street = lines[j];
          break;
        }
      }
      break;
    }
  }

  // --- Allergies ---
  const allergyMatch = text.match(/Allergies\s*-\s*([^\n]+)/i);
  if (allergyMatch) {
    meta.allergies = allergyMatch[1]
      .split(/[;,\|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // --- Conditions ---
  const condMatch = text.match(/Conditions?\s*-\s*([^\n]+)/i);
  if (condMatch) {
    meta.conditions = condMatch[1]
      .split(/[;,\|]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return meta;
};

/**
 * Extract medication names from the Drug Name table.
 * We use a pattern like:
 *   "1048132 1071853 28 310 TAB Irbesartan 150mg 02317079 Dr."
 *
 * Capture group:
 *   - Form: TAB|CAP|ML|DEV|SUSP etc.
 *   - Name + dose: up to 8-digit DIN, right before it.
 */
const extractMedicationsFromPharm = (rawText) => {
  const text = normalizeText(rawText);

  // Expand accepted forms as needed
  const formPattern = "(?:TAB|CAP|ML|DEV|SUSP|INJ|SOLN|SR|CR|ER)";
  const regex = new RegExp(
    `\\b${formPattern}\\s+(.+?)\\s+(\\d{8})\\s+Dr\\.`,
    "g"
  );

  const meds = [];
  const seen = new Set();

  let m;
  while ((m = regex.exec(text)) !== null) {
    const fullName = m[1].trim(); // e.g. "Irbesartan 150mg"
    const din = m[2];
    const key = `${fullName}__${din}`;
    if (!seen.has(key)) {
      seen.add(key);
      meds.push({
        medication: fullName,
        din,
      });
    }
  }

  return meds;
};

// ---------- Component ----------

export default function PharmacyMedHistory({ onParsed }) {
  const [msg, setMsg] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const fileInputRef = useRef(null);

  const [record, setRecord] = useState(null);
  // record = {
  //   name, healthNumber, street, city, province, postalCode,
  //   allergies: [], conditions: [], medications: []
  // }

  useEffect(() => {
    if (onParsed && record) {
      onParsed(record);
    }
  }, [record, onParsed]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;

    try {
      setMsg("Reading PDF…");
      const rawText = await readPdfToText(file);

      const meta = extractPatientMetaFromPharm(rawText);
      const meds = extractMedicationsFromPharm(rawText);

      const next = {
        ...meta,
        medications: meds,
        rawText, // keep for debugging if needed
      };

      setRecord(next);
      setMsg("");
    } catch (err) {
      console.error(err);
      setMsg("Could not read/parse PDF.");
      setRecord(null);
    }
  };

  const resetAll = () => {
    setRecord(null);
    setMsg("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFileKey((k) => k + 1);
  };

  const hasAny = (arr) => Array.isArray(arr) && arr.length > 0;

  return (
    <DragBox
      id="PharmacyMedHistory"
      storageKey="PharmacyMedHistory_POSITION"
      defaultPos={{ x: 260, y: 320 }}
      title="Pharmacy Medication History Parser [LOCAL ONLY]"
      width={1400}
      onAdd={null}
      zIndex={2050}
      addNote="-"
    >
      <div
        className="container my-3"
        style={{ maxHeight: "75vh", overflowY: "auto", overflowX: "hidden" }}
      >
        {/* Header + controls */}
        <div className="row mb-2">
          <div className="col-48 d-flex align-items-center">
            <h5 className="m-0">Monthly Pharmacy Medication History – Parse & Review</h5>
            <div className="ms-auto d-flex gap-2">
              <button className="btn btn-outline-secondary" onClick={resetAll}>
                Clear
              </button>
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

        {/* Empty state */}
        {!record && !msg && (
          <div className="row">
            <div className="col-48 text-muted">
              <em>Select a Pharmacy Medication History PDF to parse and review.</em>
            </div>
          </div>
        )}

        {/* Parsed content */}
        {record && (
          <>
            {/* Patient summary */}
            <div className="row g-3 mb-3">
              <div className="col-48">
                <div className="card p-2">
                  <div className="row">
                    <div className="col-24">
                      <div className="fw-bold">Name</div>
                      <div>{record.name || <em>Unknown</em>}</div>
                    </div>
                    <div className="col-24">
                      <div className="fw-bold">Health Card Number</div>
                      <div>{record.healthNumber || <em>Unknown</em>}</div>
                    </div>
                  </div>

                  <div className="row mt-2">
                    <div className="col-24">
                      <div className="fw-bold">Street</div>
                      <div>{record.street || <em>Unknown</em>}</div>
                    </div>
                    <div className="col-24">
                      <div className="fw-bold">City / Prov / Postal</div>
                      <div>
                        {record.city || record.province || record.postalCode ? (
                          <>
                            {record.city && <span>{record.city}</span>}{" "}
                            {record.province && <span>{record.province}</span>}{" "}
                            {record.postalCode && <span>{record.postalCode}</span>}
                          </>
                        ) : (
                          <em>Unknown</em>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="row mt-2">
                    <div className="col-24">
                      <div className="fw-bold">Allergies</div>
                      {hasAny(record.allergies) ? (
                        <ul className="mb-0">
                          {record.allergies.map((a) => (
                            <li key={a}>{a}</li>
                          ))}
                        </ul>
                      ) : (
                        <div><em>None listed</em></div>
                      )}
                    </div>
                    <div className="col-24">
                      <div className="fw-bold">Conditions</div>
                      {hasAny(record.conditions) ? (
                        <ul className="mb-0">
                          {record.conditions.map((c) => (
                            <li key={c}>{c}</li>
                          ))}
                        </ul>
                      ) : (
                        <div><em>None listed</em></div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Medications list */}
            <div className="row mt-3">
              <div className="col-48">
                <div className="card">
                  <div className="card-header">Medications (from Pharmacy History)</div>
                  <div className="card-body">
                    {!hasAny(record.medications) ? (
                      <div className="text-muted small">
                        <em>No medications parsed from this file.</em>
                      </div>
                    ) : (
                      <div className="row fs-7">
                        <div className="col-48">
                          <table className="table table-sm table-striped mb-0">
                            <thead>
                              <tr>
                                <th style={{ width: "60%" }}>Medication</th>
                                <th style={{ width: "40%" }}>DIN</th>
                              </tr>
                            </thead>
                            <tbody>
                              {record.medications.map((m, idx) => (
                                <tr key={`${m.medication}_${m.din}_${idx}`}>
                                  <td>{m.medication}</td>
                                  <td>{m.din}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
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
