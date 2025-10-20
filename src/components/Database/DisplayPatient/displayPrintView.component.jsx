// src/components/Patient/displayPrintView.component.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useGlobalContext } from "../../../Context/global.context";
import { getUserFromToken } from '../../../Context/functions';
import { useNavigate } from 'react-router-dom';

// ---------- helpers ----------
const norm = (s) => (s ?? "").toString().trim();

// Legacy parser (kept as fallback only)
const parseLegacyMeds = (str) => {
  if (!str) return [];
  return String(str)
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      const m = t.match(/^\s*([^[\]{},]+?)\s*[\[\{]\s*([^\]\}]*)\s*[\]\}]\s*$/);
      if (m) return { name: m[1].trim(), category: "No Category", dose: String(m[2] ?? "").trim() };
      const parts = t.split(":").map((x) => x.trim());
      if (parts.length >= 3) return { name: parts[0], category: parts[1] || "No Category", dose: parts[2] || "" };
      return { name: t, category: "No Category", dose: "" };
    });
};

// ID-based helpers (mirrors PatientMeds)
const readMasterId = (m) => String(m?.ID ?? m?.id ?? "");
const readMasterName = (m) => String(m?.medication_name ?? m?.medication ?? m?.name ?? "");
const readMasterDose = (m) => String(m?.medication_dose ?? m?.defaultDose ?? m?.dose ?? "");
const readMasterCat = (m) => String(m?.medication_cat ?? m?.category ?? "");
const parseIdCSV = (str) => (str || "").split(",").map((t) => t.trim()).filter(Boolean);

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

// Mask for demos: "Patient ####"
const demoPatientLabel = (healthNumber) => {
  const digits = String(healthNumber || "").replace(/\D/g, "");
  const first4 = digits.slice(0, 4) || "XXXX";
  return `Patient ${first4}`;
};

// NEW: mask 3 middle digits of HCN when printing privately -> 123 XXX 7890
const maskHealthNumber3 = (hcn) => {
  const digits = String(hcn || "").replace(/\D/g, "");
  if (!digits) return hcn || "—";
  const first3 = digits.slice(0, 3);
  const last4 = digits.slice(-4);
  return `${first3} XXX ${last4}`;
};

const PrintLabView = () => {

  const [user, setUser] = React.useState(null);
  const [patientDB, setPatientDB] = useState(null);
  const [historyDB, setHistoryDB] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    console.log(user);
  }, [user]);

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await getUserFromToken();
      return userData;
    };
    fetchUser().then((userT) => {
      if (userT) {
        console.log('User data:', userT);
        setUser(userT);
        setPatientDB(userT.patientTable);
        setHistoryDB(userT.historyTable);
      }
      if (!userT) {
        // If no user is found, redirect to sign-in page
        navigate('/signin');
        return;
      }
    });
  }, []);

  const { activePatient, setActivePatient, setVisibleBox, conditionData, privateMode, medsArray, updateMedsArray } = useGlobalContext();
  const [fresh, setFresh] = useState(activePatient || {});
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);

  // Refresh latest patient on mount / when ID changes; also set a short history snapshot
  useEffect(() => {
    // 🚫 Don’t run until we know who the user is (so tables are correct)
    if (!user) {
      setFresh(activePatient || {});
      setHistory([]);
      return;
    }

    const id = activePatient?.id ? Number(activePatient.id) : null;
    const hcn = activePatient?.healthNumber
      ? String(activePatient.healthNumber).replace(/\s+/g, " ").trim()
      : null;

    if (!id) {
      setFresh(activePatient || {});
      setHistory([]);
      return;
    }

    // Pull meds master list (only if empty) with the CORRECT tables
    if (Array.isArray(medsArray) && medsArray.length === 0) {
      fetch("https://gdmt.ca/PHP/noDB.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        cache: "no-store",
        body: JSON.stringify({ script: "getMeds" }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data?.meds)) {
            updateMedsArray?.(data.meds);
          }
        })
        .catch(() => { });
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch("https://gdmt.ca/PHP/special.php", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
          cache: "no-store",
          body: JSON.stringify({
            script: "getPatientById",
            patientID: id,
            healthNumber: hcn,
            patientDB: patientDB || 'Patient',
            historyDB: historyDB || 'Patient_History'
          }),
        });

        const text = await res.text();
        let data = null;
        try { data = JSON.parse(text); } catch { }
        console.log('Fetched patient data:', data);
        const latest = res.ok && data && data.patient ? data.patient : activePatient;
        const last3 = Array.isArray(data?.history) ? data.history.slice(0, 3) : [];

        if (!cancelled) {
          setFresh(latest || {});
          setActivePatient?.(latest || {});
          setHistory(last3);
        }
      } catch {
        if (!cancelled) {
          setFresh(activePatient || {});
          setHistory([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // 👇 Re-run when patient changes OR when the user’s table names change
  }, [activePatient?.id, patientDB, historyDB, user]);


  // Derived display data
  const patientName =
    fresh?.clientName ||
    fresh?.name ||
    (fresh?.firstName && fresh?.lastName ? `${fresh.firstName} ${fresh.lastName}` : "") ||
    fresh?.lastFirstName ||
    "—";

  const isPrivate = Boolean(privateMode);
  const headerName = isPrivate ? demoPatientLabel(fresh?.healthNumber) : (patientName || "—");
  const displayHCN = isPrivate ? maskHealthNumber3(fresh?.healthNumber) : (fresh?.healthNumber || "—");

  const paymentMethod = String(
    fresh?.paymentMethod ?? fresh?.paymentMethof ?? "CASH"
  );

  const doctorNote = fresh?.patientNote ?? "";

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

  // ---------- Medications (ID CSV → resolve via medsArray) ----------
  const master = Array.isArray(medsArray) ? medsArray : [];
  const masterById = useMemo(() => {
    const map = new Map();
    for (const m of master) map.set(readMasterId(m), m);
    return map;
  }, [master]);

  const patientMeds = useMemo(() => {
    const ids = parseIdCSV(fresh?.medsData);
    if (ids.length > 0) {
      return ids.map((id) => {
        const m = masterById.get(String(id));
        return {
          name: readMasterName(m) || `#${id}`,
          category: readMasterCat(m) || "No Category",
          dose: readMasterDose(m) || "",
        };
      });
    }
    // Fallback for legacy data
    return parseLegacyMeds(fresh?.medsData);
  }, [fresh?.medsData, masterById]);

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
      {/* Header */}
      <div className="row align-items-start g-2 mb-2">
        <div className="col-36">
          <h1 className="h3 mb-1">{headerName}</h1>
          <div className="small">
            <strong>Health Number:</strong> {displayHCN}
          </div>
          {/* Payment Method */}
          <div className="small mt-1">
            <strong>Medication Coverage:</strong>{" "}
            <span className="fw-semibold">{paymentMethod}</span>
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

      <div className="mb-2 mt-2">
        <div className="mb-2 h4" style={{ borderBottom: "2px solid" }}>Lab Results</div>
        {(!history || history.length === 0) ? (
          <div className="border-bottom p-2"><em>No labs on file.</em></div>
        ) : (
          <div className="row g-1">
            <div className="col-48">
              <div className="row g-1 fw-bold">
                <div className="col-12"></div>
                <div className="col-12 text-center">{headings[0]}</div>
                <div className="col-12 text-center">{headings[1]}</div>
                <div className="col-12 text-center">{headings[2]}</div>
              </div>
            </div>
            {LAB_FIELDS.map(([key, label]) => (
              <div key={key} className="col-48 border-bottom py-1">
                <div className="row g-1 align-items-baseline">
                  <div className="col-12 fw-bold text-truncate" title={label}>{label}</div>
                  <div className="col-12 text-center fw-semibold">
                    {cols[0][key] === 0.00 || cols[0][key] === "0.00" ? "-" : printVal(cols[0][key])}
                  </div>
                  <div className="col-12 text-center fw-semibold">
                    {cols[1][key] === 0.00 || cols[1][key] === "0.00" ? "-" : printVal(cols[1][key])}
                  </div>
                  <div className="col-12 text-center fw-semibold">
                    {cols[2][key] === 0.00 || cols[2][key] === "0.00" ? "-" : printVal(cols[2][key])}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conditions */}
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

      {/* Medications — resolved from medsArray via ID CSV */}
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
                    <div className="col-36 d-flex flex-nowrap align-items-baseline" style={{ minWidth: 0 }}>
                      <strong className="text-truncate" title={m.name} style={{ minWidth: 0 }}>
                        {m.name}
                      </strong>
                      {m.dose ? <span style={{ marginLeft: 5 }}>[{m.dose}]</span> : null}
                    </div>
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

      {/* Recommendations */}
      <div className="mb-2">
        <div className="mb-2 h4" style={{ borderBottom: "2px solid" }}>Recommendations</div>
        <div className="py-2">
          {fresh?.recommendations && String(fresh.recommendations).trim()
            ? fresh.recommendations
            : <em>No recommendations yet.</em>}
        </div>
      </div>

      {/* Vaccinations */}
      <div>
        <table border={1} cellPadding={6} cellSpacing={0} style={{ borderCollapse: "collapse", width: "100%", fontFamily: "Arial, sans-serif" }}>
          <caption style={{ captionSide: "top", fontWeight: "bold", padding: "8px 0" }}>
            VACCINE STATUS REVIEW — Recommended for ASCVD, CKD, HF, and Diabetes Patients
          </caption>
          <thead style={{ background: "#f2f2f2" }}>
            <tr>
              <th style={{ textAlign: "left" }}>Vaccine</th>
              <th style={{ textAlign: "left" }}>Indicated For</th>
              <th style={{ textAlign: "left" }}>Patient Status</th>
              <th style={{ textAlign: "left" }}>Notes / Action</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-bottom border-2">
              <td>COVID-19 (Comirnaty&reg;)</td>
              <td>Age ≥18; all with ASCVD, CKD, diabetes</td>
              <td>
                <label><input type="checkbox" /> Up to date</label><br />
                <label><input type="checkbox" /> Not reviewed</label><br />
                <label><input type="checkbox" /> Needs update</label>
              </td>
              <td>Booster recommended annually or per NACI</td>
            </tr>
            <tr className="border-bottom border-2">
              <td>Pneumococcal (Prevnar 20&reg;)</td>
              <td>Age ≥65 or high-risk adults (CKD, diabetes)</td>
              <td>
                <label><input type="checkbox" /> Received</label><br />
                <label><input type="checkbox" /> Not reviewed</label><br />
                <label><input type="checkbox" /> Needs update</label>
              </td>
              <td>Consider if not given in past 5 years</td>
            </tr>
            <tr className="border-bottom border-2">
              <td>Influenza (seasonal)</td>
              <td>All adults, especially with comorbidities</td>
              <td>
                <label><input type="checkbox" /> Received this year</label><br />
                <label><input type="checkbox" /> Needs update</label>
              </td>
              <td>Strongly recommended annually</td>
            </tr>
            <tr className="border-bottom border-2">
              <td>RSV (Abrysvo&reg;)</td>
              <td>Age ≥60 or CKD, HF, diabetes (if available)</td>
              <td>
                <label><input type="checkbox" /> Received</label><br />
                <label><input type="checkbox" /> Not reviewed</label><br />
                <label><input type="checkbox" /> N/A</label>
              </td>
              <td>Evaluate per NACI and patient risk</td>
            </tr>
            <tr className="border-bottom border-2">
              <td>Shingles (Shingrix&reg;)</td>
              <td>Age ≥50, or younger with immunosuppression</td>
              <td>
                <label><input type="checkbox" /> Dose 1</label><br />
                <label><input type="checkbox" /> Dose 2</label><br />
                <label><input type="checkbox" /> Not reviewed</label>
              </td>
              <td>Reduces VZV-related complications</td>
            </tr>
            <tr className="border-bottom border-2">
              <td>Hepatitis B</td>
              <td>Diabetes, CKD, immunosuppressed</td>
              <td>
                <label><input type="checkbox" /> Complete</label><br />
                <label><input type="checkbox" /> Partial</label><br />
                <label><input type="checkbox" /> Not reviewed</label>
              </td>
              <td>Confirm serology or vaccinate</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PrintLabView;
