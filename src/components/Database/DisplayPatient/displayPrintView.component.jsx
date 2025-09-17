// displayPrintView.component.jsx (aka PrintLabView.jsx)
import React, { useEffect, useMemo, useState } from "react";
import { useGlobalContext } from "../../../Context/global.context";

// ---------- helpers ----------
const norm = (s) => (s ?? "").toString().trim();

// Parse meds CSV (aligned with patientMeds.component.jsx)
const parseMeds = (str) => {
  if (!str) return [];
  return String(str)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      // Allow "Name[dose]" or "Name{dose}"
      const m = t.match(/^\s*([^[\]{},]+?)\s*[\[\{]\s*([^\]\}]*)\s*[\]\}]\s*$/);
      if (m) return { name: m[1].trim(), category: "No Category", dose: String(m[2] ?? "").trim() };
      // Primary format "Name:Category:Dose"
      const parts = t.split(":").map((x) => x.trim());
      if (parts.length >= 3) return { name: parts[0], category: parts[1] || "No Category", dose: parts[2] || "" };
      // Fallback "Name"
      return { name: t, category: "No Category", dose: "" };
    });
};

// Parse condition codes CSV -> array of UPPER codes
const parseConditionCodes = (csv) =>
  (csv || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toUpperCase());

// Build code -> label map from context.conditionData
const buildConditionMap = (conditionData) => {
  const list = Array.isArray(conditionData)
    ? conditionData
    : conditionData && typeof conditionData === "object"
    ? Object.values(conditionData)
    : [];
  const map = new Map();
  for (const c of list) {
    const label = c?.conditionName ?? c?.name ?? String(c ?? "");
    const code = (c?.conditionCode ?? c?.code ?? "").toUpperCase();
    if (code) map.set(code, label);
  }
  return map;
};

// Labs to display (keys correspond to fields on patient_history rows)
const LAB_FIELDS = [
  ["cholesterol", "Cholesterol"],
  ["triglyceride", "Triglyceride"],
  ["hdl", "HDL"],
  ["ldl", "LDL"],
  ["nonHdl", "Non-HDL"],
  ["cholesterolHdlRatio", "Chol/HDL Ratio"],
  ["creatineKinase", "Creatine Kinase"],
  ["alanineAminotransferase", "ALT"],
  ["lipoproteinA", "Lipoprotein(a)"],
  ["apolipoproteinB", "ApoB"],
  ["natriureticPeptideB", "BNP"],
  ["urea", "Urea"],
  ["creatinine", "Creatinine"],
  ["gfr", "GFR"],
  ["albumin", "Albumin"],
  ["sodium", "Sodium"],
  ["potassium", "Potassium"],
  ["vitaminB12", "Vitamin B12"],
  ["ferritin", "Ferritin"],
  ["hemoglobinA1C", "Hemoglobin A1C"],
  ["urineAlbumin", "Urine Albumin"],
  ["albuminCreatinineRatio", "Alb/Cr Ratio"],
];

// Show "-" for truly blank values but keep zeroes like 0 or "0.00"
const printVal = (v) => (v === null || v === undefined || String(v).trim() === "" ? "-" : String(v));

// Mask for demos: "Patient ####" using first 4 digits of healthNumber
const demoPatientLabel = (healthNumber) => {
  const digits = String(healthNumber || "").replace(/\D/g, "");
  const first4 = digits.slice(0, 4) || "XXXX";
  return `Patient ${first4}`;
};

const PrintLabView = () => {
  // 👇 now reading privateMode from context too
  const { activePatient, setActivePatient, setVisibleBox, conditionData, privateMode } = useGlobalContext();
  const [fresh, setFresh] = useState(activePatient || {});
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  // Refresh latest patient on mount / when ID changes; mirror into context + set history
  useEffect(() => {
    const id = activePatient?.id ? Number(activePatient.id) : null;
    const hcn = activePatient?.healthNumber
      ? String(activePatient.healthNumber).replace(/\s+/g, " ").trim()
      : null;

    if (!id) {
      setFresh(activePatient || {});
      setHistory([]);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch("https://optimizingdyslipidemia.com/PHP/special.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          cache: "no-store",
          body: JSON.stringify({
            script: "getPatientById",
            patientID: id,
            healthNumber: hcn, // server can also fall back to patient's record
          }),
        });

        const text = await res.text();
        console.log("Raw response text:", text);

        let data = null;
        try { data = JSON.parse(text); } catch (e) {}

        const latest = res.ok && data && data.patient ? data.patient : activePatient;

        // Take up to 3; ensure newest first even if server didn’t sort
        let last3 = Array.isArray(data?.history) ? data.history.slice(0, 3) : [];
        last3 = last3.sort((a, b) => {
          const da = new Date(a?.orderDate || 0).getTime();
          const db = new Date(b?.orderDate || 0).getTime();
          return db - da;
        });

        if (!cancelled) {
          setFresh(latest || {});
          setActivePatient?.(latest || {});
          setHistory(last3);
        }
      } catch (e) {
        if (!cancelled) {
          setFresh(activePatient || {});
          setHistory([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [activePatient?.id]);

  // Derived display data
  const patientName =
    fresh?.clientName ||
    fresh?.name ||
    (fresh?.firstName && fresh?.lastName ? `${fresh.firstName} ${fresh.lastName}` : "") ||
    fresh?.lastFirstName ||
    "—";

  // 👇 choose name based on privateMode
  const isPrivate = Boolean(privateMode);
  const headerName = isPrivate ? demoPatientLabel(fresh?.healthNumber) : (patientName || "—");

  // Doctor's note (prefer privateNote if present)
  const doctorNote = fresh?.patientNote ?? fresh?.patientNote ?? "";

  // Conditions list
  const codeToLabel = useMemo(() => buildConditionMap(conditionData), [conditionData]);
  const patientConditionCodes = useMemo(
    () => parseConditionCodes(fresh?.conditionData || fresh?.conditions || ""),
    [fresh?.conditionData, fresh?.conditions]
  );
  const patientConditions = useMemo(
    () => patientConditionCodes.map((code) => ({ code, label: codeToLabel.get(code) || code })),
    [patientConditionCodes, codeToLabel]
  );

  // Meds
  const patientMeds = useMemo(
    () => parseMeds(fresh?.medsData ?? fresh?.medications ?? ""),
    [fresh?.medsData, fresh?.medications]
  );

  // Build 3 “date” columns from history (headers only; no dates in cells)
  const { headings, cols } = useMemo(() => {
    const sorted = Array.isArray(history)
      ? [...history].sort((a, b) => new Date(b?.orderDate || 0) - new Date(a?.orderDate || 0))
      : [];
    const c0 = sorted[0] || {};
    const c1 = sorted[1] || {};
    const c2 = sorted[2] || {};
    return {
      headings: [
        c0?.orderDate ? c0.orderDate : "Not Entered",
        c1?.orderDate ? c1.orderDate : "Not Entered",
        c2?.orderDate ? c2.orderDate : "Not Entered",
      ],
      cols: [c0, c1, c2],
    };
  }, [history]);

  return (
    <div className="mx-auto" style={{ width: "210mm", minHeight: "297mm", maxWidth: "100%" }}>
      {/* Header: Name + HealthNumber + Back/Print (print-hidden controls) */}
      <div className="row align-items-start g-2 mb-2">
        <div className="col-36">
          <h1 className="h3 mb-1">{headerName}</h1>
          <div className="small">
            <strong>Health Number:</strong> {fresh?.healthNumber || "—"}
          </div>
        </div>
        <div className="col-12 d-flex justify-content-end gap-2 d-print-none">
          <button className="btn btn-outline-secondary btn-sm" onClick={() => setVisibleBox?.("ClientDetails")}>
            Back
          </button>
          <button className="btn btn-outline-primary btn-sm" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      {/* Doctor’s Note */}
      <div className="py-2 mb-3">
        <div className="d-flex align-items-center justify-content-between mb-2">
          <div className="mb-2 h4" style={{ borderBottom: "2px solid" }}>Doctor’s Note</div>
          {loading && <span className="badge bg-info text-dark">Refreshing…</span>}
        </div>
        <div className="fs-7">
          {doctorNote ? doctorNote : <em>No note on file.</em>}
        </div>
      </div>

      {/* Lab Results — use history as 3 columns (headers = orderDate or Not Entered) */}
      <div className="mb-2 mt-2">
        <div className="mb-2 h4" style={{ borderBottom: "2px solid" }}>Lab Results</div>

        {(!history || history.length === 0) ? (
          <div className="border-bottom p-2"><em>No labs on file.</em></div>
        ) : (
          <div className="row g-1">
            {/* Header row: Test | Date1 | Date2 | Date3 */}
            <div className="col-48">
              <div className="row g-1 fw-bold">
                <div className="col-12"></div>
                <div className="col-12 text-center">{headings[0]}</div>
                <div className="col-12 text-center">{headings[1]}</div>
                <div className="col-12 text-center">{headings[2]}</div>
              </div>
            </div>

            {/* One row per lab, values pulled from each history column (no dates in cells) */}
            {LAB_FIELDS.map(([key, label]) => (
              <div key={key} className="col-48 border-bottom py-1">
                <div className="row g-1 align-items-baseline">
                  {/* Label */}
                  <div className="col-12 fw-bold text-truncate" title={label}>{label}</div>
                  {/* Values for last 3 history entries */}
                  <div className="col-12 text-center fw-semibold">{printVal(cols[0][key])}</div>
                  <div className="col-12 text-center fw-semibold">{printVal(cols[1][key])}</div>
                  <div className="col-12 text-center fw-semibold">{printVal(cols[2][key])}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conditions — 3 across (col-16) */}
      <div className="mb-2">
        <div className="mb-2 h4" style={{ borderBottom: "2px solid" }}>Conditions</div>
        {patientConditions.length === 0 ? (
          <div className="border rounded p-2"><em>No conditions on file.</em></div>
        ) : (
          <div className="row g-1">
            {patientConditions.map((c) => (
              <div key={c.code} className="col-16">
                <div className="p-1">
                  <div className="row g-1 align-items-baseline">
                    <div className="col-48 fw-semibold text-truncate" title={c.label}>
                      {c.label}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Medications — single-line with 5px gap before [dose] */}
      <div className="mb-2 mt-2">
        <div className="mb-2 h4" style={{ borderBottom: "2px solid" }}>Medications</div>
        {patientMeds.length === 0 ? (
          <div className="border rounded p-2"><em>No medications on file.</em></div>
        ) : (
          <div className="row g-1">
            {patientMeds.map((m, idx) => (
              <div key={`med_${idx}`} className="col-48">
                <div className="border-bottom p-1">
                  <div className="row g-0 align-items-baseline">
                    {/* Left: Name (bold) + [dose] on SAME line */}
                    <div className="col-36 d-flex flex-nowrap align-items-baseline" style={{ minWidth: 0 }}>
                      <strong className="text-truncate" title={m.name} style={{ minWidth: 0 }}>
                        {m.name}
                      </strong>
                      {m.dose ? <span style={{ marginLeft: 5 }}>[{m.dose}]</span> : null}
                    </div>
                    {/* Right: Category at end of line */}
                    <div className="col-12 text-end">
                      {m.category === "No Category" ? "" : m.category}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations — bottom */}
      <div className="mb-2">
        <div className="mb-2 h4" style={{ borderBottom: "2px solid" }}>Recommendations</div>
        <div className="py-2">
          {fresh?.recommendations && String(fresh.recommendations).trim()
            ? fresh.recommendations
            : <em>No recommendations yet.</em>}
        </div>
      </div>
    </div>
  );
};

export default PrintLabView;
