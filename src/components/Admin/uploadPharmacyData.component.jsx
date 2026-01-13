// src/components/Labs/pharmacyMedHistory.component.jsx
import React, { useRef, useState, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

const API_Endpoint = "https://www.gdmt.ca/PHP/labData.php";

// ---------- Helpers ----------
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

const digitsOnly = (v) => (v || "").toString().replace(/\D+/g, "");
const hasAlpha = (v) => /[a-z]/i.test((v || "").toString());

const formatHcn = (raw) => {
  const d = digitsOnly(raw);
  if (d.length !== 10) return (raw || "").toString().trim();
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 10)}`;
};

const isValidHcn = (hcn) => {
  const raw = (hcn || "").toString().trim();
  const d = digitsOnly(raw);
  return d.length === 10 && !hasAlpha(raw);
};

const isBadName = (name) => {
  const s = (name || "").toString().trim();
  if (!s) return true;
  if (!s.includes(",")) return true;

  const norm = normalizeText(s).toLowerCase();

  const badPhrases = [
    "continue using",
    "report parameters",
    "billing info",
    "exclude inactive",
    "home/ward",
    "fill date",
    "date of birth",
    "patient medical history report",
  ];
  if (badPhrases.some((p) => norm.includes(p))) return true;

  const parts = s.split(",");
  const left = (parts[0] || "").trim();
  const right = (parts[1] || "").trim();
  if (!left || !right) return true;

  const letters = (s.match(/[a-z]/gi) || []).length;
  if (letters < 3) return true;

  return false;
};

const parseCsvInput = (s) =>
  (s || "")
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);

const normalizeAllergies = (arr) => {
  const clean = (Array.isArray(arr) ? arr : [])
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  if (clean.length === 1 && /no known/i.test(clean[0])) return [];
  if (clean.length === 1 && /^n\/?k\/?a$/i.test(clean[0])) return [];
  if (clean.length === 1 && /^[-—]+$/.test(clean[0])) return [];
  return clean;
};

const normalizeConditions = (arr) => {
  const clean = (Array.isArray(arr) ? arr : [])
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  if (clean.length === 1 && /^[-—]+$/.test(clean[0])) return [];
  return clean;
};

// ----- DIN scanning fallback (spaced digits supported) -----
const countUniqueDINsFallback = (rawText) => {
  const s = rawText || "";
  const matches = s.match(/(?<!\d)(?:\d[\s-]*){8}(?!\d)/g) || [];
  const set = new Set();
  for (const m of matches) {
    const din = (m || "").replace(/\D+/g, "").slice(0, 8);
    if (din.length === 8) set.add(din);
  }
  return set.size;
};

/**
 * Extract a trailing dose/strength from a medication string WITHOUT removing it from the name.
 */
const extractDoseFromMedicationName = (full) => {
  const s = (full || "").trim();
  if (!s) return "";

  let m = s.match(/(\d+(?:\.\d+)?\s*mm\s*\/\s*\d+(?:\.\d+)?\s*g)\s*$/i);
  if (m) return m[1].replace(/\s+/g, "").toUpperCase();

  m = s.match(
    /(\d+(?:\.\d+)?\s*(?:mcg|mg|g|kg|ml|mL|l|L|%|units|iu|IU)\s*(?:\/\s*\d+(?:\.\d+)?\s*(?:mcg|mg|g|kg|ml|mL|l|L|%|units|iu|IU))+)\s*$/i
  );
  if (m) return m[1].replace(/\s+/g, "").replace(/ml/gi, "mL").replace(/iu/gi, "IU");

  m = s.match(/(\d+(?:\.\d+)?\s*(?:mcg|mg|g|kg|ml|mL|l|L|%|units|iu|IU))\s*$/i);
  if (m) return m[1].replace(/\s+/g, "").replace(/ml/gi, "mL").replace(/iu/gi, "IU");

  return "";
};

// ---------- Parsing (Name/HCN/Allergies/Conditions) ----------
const extractPatientHeaderBlock = (rawText) => {
  const t = normalizeText(rawText);

  // Use LAST match (grouped PDFs can repeat headers)
  const re =
    /Report Parameters[\s\S]*?Fill Date[^\n]*\n([\s\S]*?)\nPatient Medical History Report Printed on:/gi;

  let last = null;
  let m;
  while ((m = re.exec(t)) !== null) {
    last = m[1];
  }
  return last ? last.trim() : "";
};

const extractNameFromHeaderBlock = (block) => {
  if (!block) return "";
  const lines = block
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!line.includes(",")) continue;
    if (/billing info/i.test(line)) continue;
    if (/plan:/i.test(line)) continue;
    if (/date of birth/i.test(line)) continue;
    if (/allergies/i.test(line)) continue;
    if (/conditions/i.test(line)) continue;

    const digitCount = (line.match(/\d/g) || []).length;
    if (digitCount > 2) continue;

    return line.trim();
  }
  return "";
};

const extractHcnFromHeaderBlock = (block) => {
  if (!block) return "";

  // Billing Info <HCN> Rel:
  const re = /Billing Info\s+([^\n]+?)\s+Rel:/gi;
  let m;
  while ((m = re.exec(block)) !== null) {
    const raw = (m[1] || "").trim();
    const d = digitsOnly(raw);
    if (d.length >= 10) return d.slice(0, 10);
  }

  const any = block.match(/\b(\d{10,})\b/);
  if (any) return any[1].slice(0, 10);

  return "";
};

const extractDOB = (rawText) => {
  const t = normalizeText(rawText);
  const m = t.match(
    /date\s*of\s*birth\s*[-–—]?\s*([0-3]?\d[-\/][0-1]?\d[-\/][12]\d{3})/i
  );
  return m ? (m[1] || "").trim() : "";
};

// IMPORTANT CHANGE:
// If we found a headerBlock, ONLY parse allergies/conditions from that block.
// Do NOT fallback to the full raw text, because it can pick up other occurrences and inflate counts.
const extractAllergies = (headerBlock, rawTextFallback) => {
  const hb = normalizeText(headerBlock || "");
  if (hb) {
    const m1 = hb.match(/Allergies\s*-\s*([^\n\r]+)/i);
    if (!m1) return [];
    const raw = (m1[1] || "").trim();
    if (!raw) return [];
    return raw.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
  }

  const t2 = normalizeText(rawTextFallback || "");
  const m2 = t2.match(/Allergies\s*-\s*([^\n\r]+)/i);
  if (!m2) return [];
  const raw = (m2[1] || "").trim();
  if (!raw) return [];
  return raw.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
};

const extractConditions = (headerBlock, rawTextFallback) => {
  const hb = normalizeText(headerBlock || "");
  if (hb) {
    const m1 = hb.match(/Conditions\s*-\s*([^\n\r]+)/i);
    if (!m1) return [];
    const raw = (m1[1] || "").trim();
    if (!raw) return [];
    if (/^[-—]+$/.test(raw)) return [];
    return raw.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
  }

  const t2 = normalizeText(rawTextFallback || "");
  const m2 = t2.match(/Conditions\s*-\s*([^\n\r]+)/i);
  if (!m2) return [];
  const raw = (m2[1] || "").trim();
  if (!raw) return [];
  if (/^[-—]+$/.test(raw)) return [];
  return raw.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
};

const extractPatientMetaFromPharm = (rawText) => {
  const headerBlock = extractPatientHeaderBlock(rawText);

  const meta = {
    name: extractNameFromHeaderBlock(headerBlock),
    healthNumberRaw: extractHcnFromHeaderBlock(headerBlock),
    healthNumber: "",
    dateOfBirth: extractDOB(rawText),
    street: "",
    city: "",
    province: "",
    postalCode: "",
    allergies: normalizeAllergies(extractAllergies(headerBlock, rawText)),
    conditions: normalizeConditions(extractConditions(headerBlock, rawText)),
  };

  meta.healthNumber = formatHcn(meta.healthNumberRaw);
  return meta;
};

// ---------- Med extraction ----------
const extractMedicationsFromPharm = (rawText) => {
  const text = normalizeText(rawText);

  const dateRe = /\b[0-3][0-9]-[A-Za-z]{3}-[12][0-9]{3}\b/g;

  // DIN can appear spaced: "0 2 2 4 5 3 6 7"
  const dinChunk = "((?:\\d[\\s-]*){8})";
  const formPattern =
    "(?:TAB|CAP|ML|DEV|SUSP|INJ|SOLN|SR|CR|ER|GM|DOS|RNG|PEN|PATCH|SPRAY|DROP|SUPP)";

  // Pass A: "<qty> <FORM> <name...> <DIN...>"
  const rxA = new RegExp(
    `\\b(\\d+(?:\\.\\d+)?)\\s+(${formPattern})\\s+(.+?)\\s+${dinChunk}\\b`,
    "gi"
  );

  // Pass B: "<FORM> <name> <DIN> Dr. ... <dates>"
  const rxB = new RegExp(
    `\\b${formPattern}\\s+(.+?)\\s+${dinChunk}\\s+Dr\\..*?([0-3][0-9]-[A-Za-z]{3}-[12][0-9]{3})(?:\\s+([0-3][0-9]-[A-Za-z]{3}-[12][0-9]{3}))?`,
    "gi"
  );

  const meds = [];
  const seen = new Set();

  const pushMed = (fullName, din, firstFill, lastFill) => {
    const medication = (fullName || "").trim();
    if (!medication) return;

    const cleanDin = (din || "").replace(/\D+/g, "").slice(0, 8);
    if (cleanDin.length !== 8) return;

    const dose = extractDoseFromMedicationName(medication);
    const key = `${medication}__${dose}__${cleanDin}__${firstFill || ""}__${lastFill || ""}`;

    if (seen.has(key)) return;
    seen.add(key);

    meds.push({
      medication,
      medication_dose: dose || "",
      din: cleanDin,
      firstFill: firstFill || "",
      lastFill: lastFill || "",
    });
  };

  // Pass A
  let m;
  while ((m = rxA.exec(text)) !== null) {
    const name = m[3] || "";
    const din = m[4] || "";

    const look = text.slice(m.index, Math.min(text.length, m.index + 220));
    const dates = look.match(dateRe) || [];
    const firstFill = dates[0] || "";
    const lastFill = dates[1] || "";

    pushMed(name, din, firstFill, lastFill);
  }

  // Pass B
  while ((m = rxB.exec(text)) !== null) {
    const name = m[1] || "";
    const din = m[2] || "";
    const firstFill = m[3] || "";
    const lastFill = m[4] || "";
    pushMed(name, din, firstFill, lastFill);
  }

  return meds;
};

// ---------- Small UI helper ----------
const CountBox = ({ label, count, colClass = "col-6 p-2" }) => {
  const n = Number(count || 0);
  return (
    <div className={`border rounded px-2 py-1 col-6`}>
      <div className="small text-muted">{label}</div>
      <div className="fw-semibold text-truncate" title={label || ""}>
        {n}
      </div>
    </div>
  );
};

// ---------- Component ----------
export default function PharmacyMedHistory({ onParsed, onClose }) {
  const [msg, setMsg] = useState("");
  const [fileKey, setFileKey] = useState(0);
  const fileInputRef = useRef(null);

  const [record, setRecord] = useState(null);
  const [processing, setProcessing] = useState(false);

  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    healthNumber: "",
    allergiesCsv: "",
    conditionsCsv: "",
  });

  useEffect(() => {
    if (onParsed && record) onParsed(record);
  }, [record, onParsed]);

  const resetAll = () => {
    setRecord(null);
    setMsg("");
    setProcessing(false);
    setShowEdit(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFileKey((k) => k + 1);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;

    try {
      setMsg("Reading PDF…");
      const rawText = await readPdfToText(file);

      const meta = extractPatientMetaFromPharm(rawText);
      const meds = extractMedicationsFromPharm(rawText);

      // Prefer count from parsed meds (more accurate). Fallback to DIN-scan if parser got 0.
      const dinCountFromParsed = new Set((meds || []).map((x) => x?.din).filter(Boolean)).size;
      const dinCountFallback = countUniqueDINsFallback(rawText);
      const medsCount = dinCountFromParsed > 0 ? dinCountFromParsed : dinCountFallback;

      const next = {
        ...meta,
        medications: meds,
        medsCount,
        rawText,
      };

      setRecord(next);
      setMsg("");
    } catch (err) {
      console.error(err);
      setMsg("Could not read/parse PDF.");
      setRecord(null);
    }
  };

  const openEdit = () => {
    if (!record) return;
    setEditForm({
      name: record.name || "",
      healthNumber: record.healthNumber || record.healthNumberRaw || "",
      allergiesCsv: (Array.isArray(record.allergies) ? record.allergies : []).join(", "),
      conditionsCsv: (Array.isArray(record.conditions) ? record.conditions : []).join(", "),
    });
    setShowEdit(true);
  };

  const applyEdit = () => {
    if (!record) return;

    const next = {
      ...record,
      name: (editForm.name || "").trim(),
      healthNumberRaw: digitsOnly(editForm.healthNumber || ""),
      healthNumber: formatHcn(editForm.healthNumber || ""),
      allergies: normalizeAllergies(parseCsvInput(editForm.allergiesCsv)),
      conditions: normalizeConditions(parseCsvInput(editForm.conditionsCsv)),
    };

    setRecord(next);
    setShowEdit(false);
  };

  const canProcess = (() => {
    if (!record) return false;
    const nameBad = isBadName(record.name);
    const hcnOk = isValidHcn(record.healthNumber || record.healthNumberRaw);
    return !nameBad && hcnOk && !processing;
  })();

  const handleProcess = async () => {
    if (!record) return;

    const nameBad = isBadName(record.name);
    const hcnOk = isValidHcn(record.healthNumber || record.healthNumberRaw);
    if (nameBad || !hcnOk) return;

    try {
      setProcessing(true);
      setMsg("Processing…");

      const patientData = {
        name: record.name,
        healthNumber: formatHcn(record.healthNumber || record.healthNumberRaw),
        healthNumberRaw: digitsOnly(record.healthNumber || record.healthNumberRaw),
        dateOfBirth: record.dateOfBirth || "",
        street: record.street || "",
        city: record.city || "",
        province: record.province || "",
        postalCode: record.postalCode || "",
        allergies: Array.isArray(record.allergies) ? record.allergies : [],
        conditions: Array.isArray(record.conditions) ? record.conditions : [],
      };

      // Step 1: merge allergies/conditions + ensure patient exists (backend)
      const hcnRes = await fetch(API_Endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scriptName: "getHealthCardNumber", patientData }),
      });
      const hcnJson = await hcnRes.json();

      if (!hcnJson?.success) {
        setMsg(hcnJson?.error || "Patient step failed.");
        setProcessing(false);
        return;
      }

      const finalHcn = hcnJson?.healthNumberFormatted || patientData.healthNumber;

      // Step 2: overwrite meds (NO merge)
      const medsRes = await fetch(API_Endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scriptName: "processPharmacyMeds",
          healthNumber: finalHcn,
          medications: Array.isArray(record.medications) ? record.medications : [],
        }),
      });
      const medsJson = await medsRes.json();

      setMsg(
        medsJson?.success
          ? `Done. Meds processed. Inserted: ${medsJson.inserted ?? 0}`
          : "Patient updated; meds call did not return success=true."
      );

      setRecord((prev) =>
        prev
          ? {
              ...prev,
              healthNumber: finalHcn,
              healthNumberRaw: hcnJson?.healthNumber || prev.healthNumberRaw,
            }
          : prev
      );
    } catch (err) {
      console.error(err);
      setMsg("Process failed (see console).");
    } finally {
      setProcessing(false);
    }
  };

  const hcnDisplay = record ? formatHcn(record.healthNumber || record.healthNumberRaw) : "";
  const hcnOk = record ? isValidHcn(hcnDisplay) : false;
  const nameBad = record ? isBadName(record.name) : true;

  const allergyCount = record && Array.isArray(record.allergies) ? record.allergies.length : 0;
  const conditionCount = record && Array.isArray(record.conditions) ? record.conditions.length : 0;
  const medsCount = record ? Number(record.medsCount || 0) : 0;

  const uploadMultipleHref = "/BETA/#/pharmacy-multi";

  const handleClose = () => {
    if (processing) return;
    if (typeof onClose === "function") {
      onClose();
      return;
    }

    // Safe fallback if no onClose handler was provided
    try {
      if (window?.history && window.history.length > 1) window.history.back();
      else window.location.hash = "#/";
    } catch {
      // no-op
    }
  };

  return (
    <div className="position-fixed top-0 start-0 w-100 h-100 bg-white" style={{ zIndex: 2050 }}>
      <div className="container-fluid p-2 h-100">
        <div className="card shadow h-100">
          {/* Top bar */}
          <div className="card-header py-2">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <div className="fw-semibold">Pharmacy Medication History – Single Upload (Review First)</div>

              <div className="ms-auto d-flex gap-2 align-items-center flex-wrap">
                <a className="btn btn-outline-primary btn-sm" href={uploadMultipleHref}>
                  Upload Multiple
                </a>

                <button className="btn btn-outline-secondary btn-sm" onClick={resetAll} disabled={processing}>
                  Clear
                </button>

                <button className="btn btn-outline-danger btn-sm" onClick={handleClose} disabled={processing}>
                  Close
                </button>
              </div>
            </div>
          </div>

          {/* Scroll area */}
          <div className="card-body overflow-auto" style={{ overflowX: "hidden" }}>
            {/* File picker + status */}
            <div className="row g-2 mb-3">
              <div className="col-24">
                <input
                  key={fileKey}
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  disabled={processing}
                />
              </div>

              <div className="col-24">{msg && <div className="alert alert-info py-2 m-0">{msg}</div>}</div>
            </div>

            {/* Empty state */}
            {!record && !msg && (
              <div className="row">
                <div className="col-48 text-muted">
                  <em>
                    Select a Pharmacy Medication History PDF to parse and review (no backend processing until you click
                    Process).
                  </em>
                </div>
              </div>
            )}

            {/* One-liner review row */}
            {record && (
              <div className="row g-2 align-items-center">
                {/* Name */}
                <div className="col-12">
                  <div className={`border rounded px-2 py-1 ${nameBad ? "bg-danger-subtle" : "bg-light"}`}>
                    <div className="small text-muted">Patient</div>
                    <div className="fw-semibold text-truncate" title={record.name || ""}>
                      {record.name || (
                        <span className="text-muted">
                          <em>—</em>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* HCN */}
                <div className="col-8">
                  <div className={`border rounded px-2 py-1 ${hcnOk ? "bg-light" : "bg-danger-subtle"}`}>
                    <div className="small text-muted">HCN</div>
                    <div className={`fw-semibold ${hcnOk ? "" : "text-danger"}`}>
                      {hcnDisplay || (
                        <span className="text-muted">
                          <em>—</em>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Counts only */}
                <CountBox label="Allergies" count={allergyCount} colClass="col-6" />
                <CountBox label="Conditions" count={conditionCount} colClass="col-6" />
                <CountBox label="Meds" count={medsCount} colClass="col-6" />

                {/* Actions */}
                <div className="col d-flex gap-2 justify-content-end">
                  <button className="btn btn-outline-primary btn-sm" onClick={openEdit} disabled={processing}>
                    Edit
                  </button>

                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleProcess}
                    disabled={!canProcess}
                    title={
                      !record
                        ? ""
                        : nameBad
                        ? "Name looks wrong (must be 'Last, First' and not contain report text)."
                        : !hcnOk
                        ? "HCN invalid (must be 10 digits, no letters)."
                        : processing
                        ? "Processing…"
                        : ""
                    }
                  >
                    {processing ? "Processing…" : "Process"}
                  </button>
                </div>

                {/* Validation note */}
                {(nameBad || !hcnOk) && (
                  <div className="col-48 mt-2">
                    <div className="alert alert-warning py-2 m-0">
                      {nameBad ? (
                        <div>
                          <strong>Name looks wrong.</strong> It must contain a comma (Last, First) and not be report
                          text.
                        </div>
                      ) : null}
                      {!hcnOk ? (
                        <div>
                          <strong>HCN invalid.</strong> Must be 10 digits (letters / wrong length will block
                          processing).
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Edit modal */}
            {showEdit && (
              <div
                className="modal fade show d-block"
                tabIndex="-1"
                role="dialog"
                aria-modal="true"
                style={{ background: "rgba(0,0,0,0.35)" }}
              >
                <div className="modal-dialog modal-lg" role="document">
                  <div className="modal-content shadow">
                    <div className="modal-header">
                      <h5 className="modal-title">Edit Parsed Fields</h5>
                      <button type="button" className="btn-close" onClick={() => setShowEdit(false)} />
                    </div>

                    <div className="modal-body">
                      <div className="row g-2">
                        <div className="col-48">
                          <label className="form-label mb-1">Name (Last, First)</label>
                          <input
                            className="form-control form-control-sm"
                            value={editForm.name}
                            onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))}
                          />
                        </div>

                        <div className="col-28">
                          <label className="form-label mb-1">Health Card Number</label>
                          <input
                            className="form-control form-control-sm"
                            value={editForm.healthNumber}
                            onChange={(e) => setEditForm((s) => ({ ...s, healthNumber: e.target.value }))}
                          />
                          <div className="form-text">Must be 10 digits to enable Process.</div>
                        </div>

                        <div className="col-24">
                          <label className="form-label mb-1">Meds</label>
                          <input className="form-control form-control-sm" value={record?.medsCount || 0} readOnly />
                        </div>

                        <div className="col-24">
                          <label className="form-label mb-1">Allergies (comma separated)</label>
                          <textarea
                            className="form-control form-control-sm"
                            rows={4}
                            value={editForm.allergiesCsv}
                            onChange={(e) => setEditForm((s) => ({ ...s, allergiesCsv: e.target.value }))}
                          />
                        </div>

                        <div className="col-24">
                          <label className="form-label mb-1">Conditions (comma separated)</label>
                          <textarea
                            className="form-control form-control-sm"
                            rows={4}
                            value={editForm.conditionsCsv}
                            onChange={(e) => setEditForm((s) => ({ ...s, conditionsCsv: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="modal-footer">
                      <button className="btn btn-outline-secondary" onClick={() => setShowEdit(false)}>
                        Cancel
                      </button>
                      <button className="btn btn-primary" onClick={applyEdit}>
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
