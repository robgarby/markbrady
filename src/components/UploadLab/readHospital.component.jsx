// src/components/UploadLab/readHospital.component.jsx
import React, { useState, useEffect, useMemo } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { useGlobalContext } from "../../Context/global.context";

// pdf.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export default function ReadHospitalConditions({
  onHospitalParsed,  // () => void
  onHospitalReset,   // () => void
}) {
  const ENDPOINT = "https://optimizingdyslipidemia.com/PHP/special.php";
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [bulletData, setBulletData] = useState([]);
  const [matchedConditions, setMatchedConditions] = useState([]);
  const [hcn, setHcn] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [medsModified, setMedsModified] = useState([]);
  const [foundMeds, setFoundMeds] = useState([]);

  const gc = useGlobalContext();
  const { conditionData, medsArray: ctxMedsArray } = gc || {};

  // ---------- helpers ----------
  const readPdfAsText = async (file) => {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((it) => ("str" in it ? it.str : (it && it.item && it.item.str) || ""))
        .join(" ");
      text += (i > 1 ? "\n" : "") + pageText;
    }
    return text.replace(/\u00A0/g, " ").replace(/[ \t]+/g, " ").trim();
  };

  const extractBulletLines = (t) => {
    const normalized = t
      .replace(/[ \t]*([•●◦▪])[ \t]*/g, "\n$1 ")
      .replace(/\n{2,}/g, "\n")
      .trim();

    const bulletRegex = /^[•●◦▪]\s+(.*)$/;
    const bullets = [];
    for (const line of normalized.split("\n")) {
      const m = line.match(bulletRegex);
      if (m && m[1]) {
        const cleaned = m[1].replace(/[ \t]+$/g, "").replace(/[.,;:]+$/g, "").trim();
        if (cleaned) bullets.push(cleaned);
      }
    }
    return bullets;
  };

  // Ontario HCN (with/without Version Code)
  // Replace existing extractOntarioHCN with this:
  const extractOntarioHCN = (t) => {
    // Normalize spaces/hyphens and ignore case
    const norm = String(t || "")
      .replace(/\u00A0/g, " ")
      .replace(/[ \t]+/g, " ")
      .trim();

    // Try patterns in order of specificity
    const patterns = [
      // 1) Exact phrase WITH version code (e.g., "... WITH VERSION CODE 9231677098BX")
      /ontario\s+health\s+card\s+number\s+with\s+version\s+code\s*[:#-]?\s*([A-Za-z]?\s*[\d\s-]{9,}\s*[A-Za-z]{2})/i,

      // 2) Exact phrase WITHOUT version code (just 10 digits, possibly spaced)
      /ontario\s+health\s+card\s+number\s*[:#-]?\s*([A-Za-z]?\s*[\d\s-]{10,})/i,

      // 3) Fallback labels (HCN, OHIP, Health Number, Health Card Number)
      /\b(?:HCN|OHIP|Health\s*Number|Health\s*Card(?:\s*Number)?)\b\s*[:#-]?\s*([A-Za-z]?\s*[\d\s-]{10,}(?:[A-Za-z]{2})?)/i,
    ];

    let raw = "";
    for (const rx of patterns) {
      const m = norm.match(rx);
      if (m && m[1]) { raw = m[1]; break; }
    }
    if (!raw) return ""; // nothing found

    // Strip spaces/hyphens, then separate digits from any trailing letters
    const compact = raw.replace(/[ -]/g, "");
    const digits = compact.replace(/\D+/g, ""); // all digits in the token

    // If token ends with two letters (version), we still only want the *first* 10 digits
    if (digits.length < 10) return "";
    const ten = digits.slice(0, 10);

    // Format #### ### ###
    return `${ten.slice(0, 4)} ${ten.slice(4, 7)} ${ten.slice(7, 10)}`;
  };


  const extractName = (t) => {
    let first = "";
    let last = "";
    const lastLabel = t.match(/Last\s*Name\s*[:#]?\s*([A-Za-z' -]+)/i);
    const firstLabel = t.match(/First\s*Name\s*[:#]?\s*([A-Za-z' -]+)/i);
    if (lastLabel) last = (lastLabel[1] || "").trim();
    if (firstLabel) first = (firstLabel[1] || "").trim();
    if (!last || !first) {
      const commaStyle = t.match(/\b([A-Z][A-Za-z' -]+)\s*,\s*([A-Z][A-Za-z' -]+)\b/);
      if (commaStyle) {
        last = last || commaStyle[1];
        first = first || commaStyle[2];
      }
    }
    return {
      first: (first || "").replace(/\s+/g, " ").trim(),
      last: (last || "").replace(/\s+/g, " ").trim(),
    };
  };

  const readCondName = (c) => String(c?.conditionName ?? c?.name ?? c ?? "").trim();

  const readMedName = (m) => String(m?.medication ?? m?.name ?? m?.Medication ?? m ?? "").trim();

  const splitMedsString = (s) =>
    s.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);

  const medsCatalog = useMemo(() => {
    if (!ctxMedsArray) return [];
    if (Array.isArray(ctxMedsArray)) return ctxMedsArray.map((m) => readMedName(m)).filter(Boolean);
    if (typeof ctxMedsArray === "string") return splitMedsString(ctxMedsArray);
    return [];
  }, [ctxMedsArray]);

  const medsCatalogLower = useMemo(
    () => medsCatalog.map((s) => s.toLowerCase()),
    [medsCatalog]
  );

  const stripTrailingDose = (name) =>
    name
      .replace(/[.,;:]+$/g, "")
      .replace(
        /\s+\d+(?:\.\d+)?(?:\s*(?:mg|mcg|µg|ug|mmol\/?L?|iu|u|units?|g|kg|ml|mL|mcL|L|%|mg\/dL|mmol\/L))?(?:\s*\/[a-z]+)?$/i,
        ""
      )
      .trim();

  // build unique base med list
  useEffect(() => {
    if (!medsCatalog.length) {
      setMedsModified([]);
      return;
    }
    const unique = [];
    const seen = new Set();
    for (const raw of medsCatalog) {
      const base = stripTrailingDose(readMedName(raw));
      if (!base) continue;
      const key = base.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(base);
      }
    }
    setMedsModified(unique);
  }, [medsCatalog]);

  const extractDoseNear = (bullet, medTokenLower) => {
    const lower = bullet.toLowerCase();
    const idx = lower.indexOf(medTokenLower);
    if (idx < 0) return null;
    const windowText = lower.slice(idx + medTokenLower.length, idx + medTokenLower.length + 80);
    const m = windowText.match(
      /(\d+(?:\.\d+)?)(?:\s*)(mg|mcg|µg|ug|mmol\/?l?|iu|u|unit|units|g|kg|ml|m|ml|mcl|l|%|mg\/dl|mmol\/l)?/i
    );
    if (!m) return null;
    const num = m[1];
    const unit = (m[2] || "").toLowerCase();
    const unitNorm = unit
      .replace("µg", "mcg")
      .replace("ug", "mcg")
      .replace("mg/dl", "mg/dL")
      .replace("mmol/l", "mmol/L");
    return { num, unit: unitNorm, text: unitNorm ? `${num} ${unitNorm}` : num };
  };

  const buildCandidates = (base, doseObj) => {
    if (!doseObj) return [base];
    const { num, unit } = doseObj;
    const noSpace = unit ? `${num}${unit}` : `${num}`;
    const withSpace = unit ? `${num} ${unit}` : `${num}`;
    return [`${base} ${withSpace}`, `${base} ${noSpace}`, `${base} ${num}`];
  };

  const [hcnInDatabase, setHcnInDatabase] = useState(false);

  const processHospital = async () => {
    const medsArrayNumbers = [];
    if (!hcn) {
      return;
    }
    // Loop through ctxMedsArray and push matching medication ids to medsArrayNumbers
    if (Array.isArray(ctxMedsArray) && Array.isArray(foundMeds)) {
      for (const found of foundMeds) {
        const foundName = (found.name).toLowerCase(); // name to find in ctxMedsArray
        const match = ctxMedsArray.find(
          (med) => (med.medication || med.name || "").toLowerCase() === foundName
        );
        if (match && match.ID) {
          medsArrayNumbers.push(match.ID);
        }
      }
    }
    const sendMeds =  medsArrayNumbers.join(',');
    // Loop through conditionData and push matching condition ids to condArrayCodes
    const condArrayCodes = [];
    if (Array.isArray(conditionData) && Array.isArray(matchedConditions)) {
      for (const found of matchedConditions) {
      const foundName = (found.name).toLowerCase(); // name to find in conditionData
      const match = conditionData.find(
        (cond) => (cond.conditionName || cond.name || "").toLowerCase() === foundName
      );
      if (match) {
        condArrayCodes.push(match.conditionCode);
      }
      }
    }
    const sendConds = condArrayCodes.join(',');
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          script: 'postMeds',
          healthNumber: hcn,
          conditionCodes: sendConds,
          medicationIDs: sendMeds,
        }),
      });
      const data = await res.json();
      if (data.success) {
        onHospitalReset();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ---------- events ----------
  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErr("");
    setLoading(true);

    try {
      const rawText = await readPdfAsText(file);

      // Patient meta
      const h = extractOntarioHCN(rawText);
      let isInDatabase = false;
      if (h) {
        try {
          const res = await fetch("https://optimizingdyslipidemia.com/PHP/special.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              script: "getStatus",
              healthNumber: h,
            }),
          });
          const data = await res.json();
          isInDatabase = !!data.exists;
          setHcnInDatabase(isInDatabase);
        } catch (e) {
          setHcnInDatabase(false);
        }
      } else {
        setHcnInDatabase(false);
      }

      const { first, last } = extractName(rawText);
      setHcn(h);
      setFirstName(first);
      setLastName(last);

      // Bullets
      const bullets = extractBulletLines(rawText);
      setBulletData(bullets);

      // Match conditions
      const list = Array.isArray(conditionData) ? conditionData : [];
      const lowerBullets = bullets.map((b) => b.toLowerCase());
      const found = [];
      const seen = new Set();
      for (const c of list) {
        const name = readCondName(c);
        if (!name) continue;
        const lname = name.toLowerCase();
        const hit = lowerBullets.some((b) => b.includes(lname));
        if (hit && !seen.has(lname)) {
          seen.add(lname);
          found.push({ name, raw: c });
        }
      }
      setMatchedConditions(found);

      // Meds from bullets vs catalog (optional display)
      const results = [];
      const seenKeys = new Set();
      for (const bullet of bullets) {
        const bLower = bullet.toLowerCase();
        for (const base of medsModified) {
          const baseLower = base.toLowerCase();
          if (!bLower.includes(baseLower)) continue;
          const dose = extractDoseNear(bullet, baseLower);
          const candidates = buildCandidates(base, dose);
          let catalogHit = null, catalogHitLower = null;
          for (const cand of candidates) {
            const idx = medsCatalogLower.indexOf(cand.toLowerCase());
            if (idx >= 0) {
              catalogHit = medsCatalog[idx];
              catalogHitLower = medsCatalogLower[idx];
              break;
            }
          }
          if (catalogHit) {
            if (!seenKeys.has(catalogHitLower)) {
              seenKeys.add(catalogHitLower);
              results.push({ name: catalogHit, matched: true, fromBullet: bullet, doseText: dose?.text || "" });
            }
          } else {
            const missKey = `miss:${baseLower}:${dose?.text || ""}`;
            if (!seenKeys.has(missKey)) {
              seenKeys.add(missKey);
              results.push({ name: `${base} ?`, matched: false, fromBullet: bullet, doseText: dose?.text || "" });
            }
          }
        }
      }
      setFoundMeds(results);

      // 🔔 Notify parent: hospital report parsed → clear any labResults in parent state
      if (typeof onHospitalParsed === "function") onHospitalParsed();
    } catch (ex) {
      setErr(ex?.message || "Failed to process PDF");
    } finally {
      setLoading(false);
    }
  };

  // ---------- UI ----------
  const BulletIcon = () => (
    <span
      style={{
        display: "inline-block",
        width: 20,
        height: 20,
        backgroundColor: "#28a745",
        borderRadius: 4,
        verticalAlign: "middle",
        marginRight: 8,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" style={{ display: "block", margin: "2px auto" }}>
        <polyline
          points="4,9 7,12 12,5"
          fill="none"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );

  const RedX = () => (
    <span
      style={{
        display: "inline-block",
        width: 20,
        height: 20,
        backgroundColor: "#dc3545",
        borderRadius: 4,
        verticalAlign: "middle",
        marginRight: 8,
        color: "#fff",
        fontWeight: 800,
        lineHeight: "20px",
        textAlign: "center",
      }}
      aria-label="Not found in catalog"
      title="Not found in catalog"
    >
      ×
    </span>
  );

  // Handler to remove a medication from foundMeds by index
  const handleRemoveMed = (idx) => {
    setFoundMeds((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className={`p-2 ${!hcnInDatabase ? "alert-danger" : "alert-light"} alert`}>
      <input
        type="file"
        accept="application/pdf"
        className="form-control"
        onChange={onUpload}
      />

      {/* Patient Meta */}
      {(hcn || lastName || firstName) && (
        <div className="mt-3 mb-2">
          <div className="fw-bold">
            HCN:&nbsp;<span className="text-danger fw-bold">{hcn || "—"}</span>
          </div>
          <div className="fw-bold">
            {lastName || firstName ? `${lastName || ""}${lastName && firstName ? ", " : ""}${firstName || ""}` : "Name: —"}
          </div>
        </div>
      )}

      {/* Conditions */}
      <div className="mt-3">
        <div className="d-flex align-items-center justify-content-between">
          <h6 className="m-0">Conditions Found</h6>
          {hcnInDatabase && hcn && (
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => processHospital()}
              title="Save Hospital Report (Reset)"
              disabled={foundMeds.some((m) => !m.matched)}
            >
              Save Hospital Report (Reset)
            </button>
          )}
        </div>

        {matchedConditions.length === 0 ? (
          <div className="text-muted mt-2">
            {bulletData.length === 0 ? "No file processed yet." : "No known conditions detected in the bullet points."}
          </div>
        ) : (
          <div className="mb-0 mt-2 text-start">
            {matchedConditions.map((c, idx) => (
              <div className="mb-2" key={idx}>
                <button
                  type="button"
                  className="btn btn-success btn-sm me-2"
                  style={{
                    width: 28,
                    height: 28,
                    padding: 0,
                    borderRadius: 4,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  tabIndex={-1}
                  aria-label="Condition found"
                  disabled
                >
                  <svg width="16" height="16" viewBox="0 0 16 16">
                    <polyline
                      points="4,9 7,12 12,5"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {c.name}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Medications */}
      <div className="mt-3">
        <h6>Medications Found</h6>
        {/* Add Medication Select */}
        <div className="mb-3 d-flex align-items-center">
          <select
            className="form-select me-2"
            style={{ maxWidth: 250 }}
            value=""
            onChange={e => {
              const medName = e.target.value;
              if (!medName) return;
              // Prevent duplicates
              if (foundMeds.some(m => m.name === medName && m.matched)) return;
              setFoundMeds(prev => [
                ...prev,
                {
                  name: medName,
                  matched: true,
                  fromBullet: "Added manually",
                  doseText: ""
                }
              ]);
            }}
          >
            <option value="">Add Medication...</option>
            {medsCatalog.map((med, idx) => (
              <option key={idx} value={med}>
                {med}
              </option>
            ))}
          </select>
        </div>
        {foundMeds.length === 0 ? (
          <div className="text-muted">
            {bulletData.length === 0 ? "No file processed yet." : "No medications detected in the bullet points."}
          </div>
        ) : (
          <>
            <div className="mb-0 text-start mt-2">
              {foundMeds.map((m, idx) => (
                <div className="mb-2 d-flex align-items-start" key={idx}>
                  <button
                    type="button"
                    className={m.matched ? "btn btn-success btn-sm me-2" : "btn btn-danger btn-sm me-2"}
                    style={{
                      width: 28,
                      height: 28,
                      padding: 0,
                      borderRadius: 4,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: m.matched ? undefined : 800,
                      fontSize: m.matched ? undefined : 20,
                      lineHeight: "20px",
                    }}
                    aria-label="Remove medication"
                    title="Remove medication"
                    onClick={() => handleRemoveMed(idx)}
                  >
                    {m.matched ? (
                      <svg width="16" height="16" viewBox="0 0 16 16">
                        <polyline
                          points="4,9 7,12 12,5"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      "×"
                    )}
                  </button>
                  <div>
                    <div className={m.matched ? "" : "text-danger"}>{m.name}</div>
                    {m.doseText ? <div className="small text-muted">Dose seen in text: {m.doseText}</div> : null}
                    <div className="small text-muted">From: {m.fromBullet}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
