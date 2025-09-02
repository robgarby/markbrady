// PatientAddressOnly.jsx
// Full component: extracts & displays Street, City, Province, Postal Code, Telephone (read-only).
// NOTE: Does NOT modify or reference your lab extractors; labs remain 100% unchanged.

import React, { useMemo } from "react";
// If scrub is exported from your helpers, import it. Otherwise remove this import and rely on it being in scope.
// import { scrub } from "./uploadFunction"; 

// ----------------- Helper: Extract Address from PATIENT panel only -----------------
const extractPatientAddress = (raw) => {
  const cleaned = scrub(raw);

  // Scope strictly inside PATIENT ... PROVIDER to avoid provider address.
  const patStart = cleaned.search(/\bPATIENT\b/i);
  const provStart = cleaned.search(/\bPROVIDER\b/i);
  const panel =
    patStart >= 0
      ? cleaned.slice(patStart, provStart > patStart ? provStart : patStart + 2000)
      : cleaned;

  const norm = (s) => (s || "").replace(/\s+/g, " ").trim();

  const normalizePostal = (pcRaw) => {
    // Canonical Canadian postal format A1A 1A1
    const m = (pcRaw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (/^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(m)) return `${m.slice(0, 3)} ${m.slice(3)}`;
    return "";
  };

  // Telephone: handles "Telephone 613-676-0199 (Home)" or with line break after label
  const telMatch =
    panel.match(/Telephone\s+([+()\- 0-9]{7,})(?:\s*\(Home\)|\s*\(.*?\))?/i) ||
    panel.match(/Telephone\s*\n\s*([+()\- 0-9]{7,})(?:\s*\(.*?\))?/i);
  const telephone = norm(telMatch?.[1] || "");

  // Address block: two lines after "Address"
  // Line 1: street
  // Line 2: CITY PROV POSTAL (commas optional, multi-word cities OK)
  const addrBlock =
    panel.match(/Address\s*\n([^\n]+)\n([^\n]+)(?:\s*\(Home\))?/i) ||
    // some PDFs have a blank line after the label
    panel.match(/Address\s*\n\s*\n([^\n]+)\n([^\n]+)(?:\s*\(Home\))?/i);

  let street = "", city = "", province = "", postalCode = "";
  if (addrBlock) {
    street = norm(addrBlock[1] || "");
    const line2 = norm(addrBlock[2] || "");

    // Preferred: CITY PROV POSTAL
    let m = line2.match(/^(.+?)\s+([A-Z]{2})\s+([A-Z]\d[A-Z][ -]?\d[A-Z]\d)$/i);
    if (m) {
      city = norm(m[1]);
      province = m[2].toUpperCase();
      postalCode = normalizePostal(m[3]);
    } else {
      // Try commas or missing space in postal
      m = line2.match(/^(.+?)[,\s]+([A-Z]{2})[,\s]+([A-Z]\d[A-Z][ -]?\d[A-Z]\d)$/i);
      if (m) {
        city = norm(m[1]);
        province = m[2].toUpperCase();
        postalCode = normalizePostal(m[3]);
      } else {
        // Fallback: detect PROV + POSTAL anywhere; treat the left part as city
        const pp = line2.match(/\b([A-Z]{2})\b\s+([A-Z]\d[A-Z][ -]?\d[A-Z]\d)/i);
        if (pp) {
          province = pp[1].toUpperCase();
          postalCode = normalizePostal(pp[2]);
          city = norm(line2.slice(0, pp.index).replace(/[,\s]+$/g, ""));
        } else {
          // last resort: keep everything as city to avoid losing data
          city = line2;
        }
      }
    }
  }

  const fullAddress = [street, [city, province].filter(Boolean).join(" "), postalCode]
    .filter(Boolean)
    .join(", ");

  return { street, city, province, postalCode, telephone, fullAddress };
};

// ----------------- UI Component (read-only display) -----------------
const PatientAddressOnly = ({ raw }) => {
  const data = useMemo(() => extractPatientAddress(raw || ""), [raw]);
  const ok = (v) => (v && String(v).trim().length ? " alert-success" : "");

  return (
    <div className="container-fluid">
      <div className="row g-2">
        <div className="col-12">
          <h5 className="mb-2">Patient Address</h5>
        </div>

        <div className="col-12">
          <label className="form-label mb-1">Full Address</label>
          <input
            className={`form-control${ok(data.fullAddress)}`}
            value={data.fullAddress || ""}
            readOnly
          />
        </div>

        <div className="col-md-6">
          <label className="form-label mb-1">Street</label>
          <input
            className={`form-control${ok(data.street)}`}
            value={data.street || ""}
            readOnly
          />
        </div>

        <div className="col-md-6">
          <label className="form-label mb-1">City</label>
          <input
            className={`form-control${ok(data.city)}`}
            value={data.city || ""}
            readOnly
          />
        </div>

        <div className="col-md-4">
          <label className="form-label mb-1">Province</label>
          <input
            className={`form-control${ok(data.province)}`}
            value={data.province || ""}
            readOnly
          />
        </div>

        <div className="col-md-4">
          <label className="form-label mb-1">Postal Code</label>
          <input
            className={`form-control${ok(data.postalCode)}`}
            value={data.postalCode || ""}
            readOnly
          />
        </div>

        <div className="col-md-4">
          <label className="form-label mb-1">Telephone</label>
          <input
            className={`form-control${ok(data.telephone)}`}
            value={data.telephone || ""}
            readOnly
          />
        </div>
      </div>
    </div>
  );
};

export default PatientAddressOnly;
