// pharmacyMultiple.component.jsx
import React, { useRef, useState, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { useGlobalContext } from "../../../Context/global.context.jsx";

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
const isValidHcn = (raw) => digitsOnly(raw).length === 10;

const formatHcn = (raw) => {
  const d = digitsOnly(raw);
  if (d.length !== 10) return (raw || "").toString().trim();
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 10)}`;
};

const parseDOB_DDMMYYYY = (dob) => {
  const s = (dob || "").trim();
  const m = s.match(/^([0-3]?\d)[-\/]([0-1]?\d)[-\/]([12]\d{3})$/);
  if (!m) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!dd || !mm || !yyyy) return null;

  const dt = new Date(yyyy, mm - 1, dd);
  if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return null;
  return dt;
};

const calcAge = (dobStr) => {
  const dob = parseDOB_DDMMYYYY(dobStr);
  if (!dob) return null;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age;
};

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

const parseCsvInput = (s) =>
  (s || "")
    .split(/[;,]/)
    .map((x) => x.trim())
    .filter(Boolean);

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

// ---------- Split + Parse ----------
const splitIntoPatientBlocks = (rawText) => {
  const t = normalizeText(rawText);
  const parts = t.split(/(?=Patient Medical History Report\s*\n)/g);

  return parts
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x.includes("Report Parameters") && x.includes("Date of Birth"));
};

const extractNameFromBlock = (block) => {
  const t = block || "";

  const m1 = t.match(/Fill Date[^\n]*\n([^\n]+)\n/i);
  if (m1) {
    const maybe = (m1[1] || "").trim();
    if (!isBadName(maybe)) return maybe;
  }

  const lines = t
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (!line.includes(",")) continue;
    if (/plan:/i.test(line)) continue;
    if (/billing info/i.test(line)) continue;
    if (/date of birth/i.test(line)) continue;
    if (/allergies/i.test(line)) continue;
    if (/conditions/i.test(line)) continue;

    const digitCount = (line.match(/\d/g) || []).length;
    if (digitCount > 2) continue;

    if (!isBadName(line)) return line;
  }

  return "";
};

const extractDOBFromBlock = (block) => {
  const t = block || "";
  const m = t.match(/Date of Birth\s*-\s*([0-3]?\d[-\/][0-1]?\d[-\/][12]\d{3})/i);
  return m ? (m[1] || "").trim() : "";
};

const extractAllergiesFromBlock = (block) => {
  const t = block || "";
  const m = t.match(/Allergies\s*-\s*([^\n\r]+)/i);
  if (!m) return [];
  const raw = (m[1] || "").trim();
  if (!raw) return [];
  return raw.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
};

const extractConditionsFromBlock = (block) => {
  const t = block || "";
  const m = t.match(/Conditions\s*-\s*([^\n\r]+)/i);
  if (!m) return [];
  const raw = (m[1] || "").trim();
  if (!raw) return [];
  if (/^[-—]+$/.test(raw)) return [];
  return raw.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
};

const extractHCNFromBlock = (block) => {
  const t = block || "";

  const billingMatches = t.match(/Billing Info\s+([^\n]+?)(?:\s+Rel:|\n)/gi) || [];
  for (const row of billingMatches) {
    const raw = row.replace(/Billing Info/i, "").trim();
    const d = digitsOnly(raw);
    if (d.length >= 10) return d.slice(0, 10);
  }

  const any = t.match(/\b(\d{10,})\b/);
  if (any) return any[1].slice(0, 10);

  return "";
};

// --------------------
// ✅ Address + Billing Info Chunk extraction
// --------------------
const extractAddressBillingChunk = (block, patientName) => {
  const lines = (block || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const name = (patientName || "").trim();
  if (!name) {
    return { chunk: "", chunkLines: [] };
  }

  // Find the name line in the block
  let nameIdx = lines.findIndex((l) => l === name);
  if (nameIdx === -1) nameIdx = lines.findIndex((l) => l.includes(name));
  if (nameIdx === -1) {
    return { chunk: "", chunkLines: [] };
  }

  // The address/billing section usually ends before "Date of Birth"
  let endIdx = -1;
  for (let i = nameIdx + 1; i < lines.length; i++) {
    const l = lines[i] || "";
    if (/^date of birth\b/i.test(l) || /date of birth\s*-/i.test(l)) {
      endIdx = i;
      break;
    }
  }

  const chunkLines = lines.slice(nameIdx + 1, endIdx === -1 ? nameIdx + 14 : endIdx);
  const chunk = chunkLines.join("\n").trim();

  return { chunk, chunkLines };
};

const extractBillingInfoFromChunkLines = (chunkLines) => {
  const list = (Array.isArray(chunkLines) ? chunkLines : []).filter((l) => /billing info/i.test(l));
  if (list.length === 0) return "";
  return list.join("\n").trim();
};

const extractAddressFromChunkLines = (chunkLines) => {
  const lines = Array.isArray(chunkLines) ? chunkLines : [];

  // street line often contains digits and "Plan:"
  let streetLine =
    lines.find((l) => /\d/.test(l) && /plan:/i.test(l)) ||
    lines.find(
      (l) =>
        /\d/.test(l) &&
        !/billing info/i.test(l) &&
        !/date of birth/i.test(l) &&
        !/allergies/i.test(l) &&
        !/conditions/i.test(l)
    ) ||
    "";

  let street = "";
  if (streetLine) {
    street = streetLine.split(/Plan:/i)[0].trim();
  }

  // city/province line usually has "ON" etc and can include Billing Info
  const cityProvLine =
    lines.find((l) => /\b[A-Z]{2}\b/.test(l) && /billing info/i.test(l)) ||
    lines.find((l) => /\b[A-Z]{2}\b/.test(l)) ||
    "";

  let city = "";
  let province = "";
  if (cityProvLine) {
    const cleaned = cityProvLine.replace(/Billing Info.*$/i, "").trim();
    const m = cleaned.match(/^(.+?)\s+([A-Z]{2})\b/i);
    if (m) {
      city = (m[1] || "").trim();
      province = (m[2] || "").trim().toUpperCase();
    }
  }

  // postal code line nearby
  const postalRe = /\b([A-Z]\d[A-Z])\s*([0-9][A-Z][0-9])\b/i;
  let postalCode = "";
  const postalLine = lines.find((l) => postalRe.test(l));
  if (postalLine) {
    const pm = postalLine.match(postalRe);
    if (pm) postalCode = `${pm[1].toUpperCase()} ${pm[2].toUpperCase()}`;
  }

  const fullAddress = [street, city, province, postalCode].filter(Boolean).join(", ");
  const hasAddress = !!(street || city || province || postalCode);

  return { street, city, province, postalCode, fullAddress, hasAddress };
};

// ---------- Medication parsing (MATCHES SINGLE UPLOADER) ----------
const extractDoseFromMedicationName = (full) => {
  const s = (full || "").trim();
  if (!s) return "";

  let m = s.match(/(\d+(?:\.\d+)?\s*mm\s*\/\s*\d+(?:\.\d+)?\s*g)\s*$/i);
  if (m) return m[1].replace(/\s+/g, "").toUpperCase();

  m = s.match(
    /(\d+(?:\.\d+)?\s*(?:mcg|mg|g|kg|ml|mL|l|L|%|units|iu|IU)\s*(?:\/\s*\d+(?:\.\d+)?\s*(?:mcg|mg|g|kg|ml|mL|l|L|%|units|iu|IU))+)\s*$/i
  );
  if (m)
    return m[1]
      .replace(/\s+/g, "")
      .replace(/ml/gi, "mL")
      .replace(/iu/gi, "IU");

  m = s.match(/(\d+(?:\.\d+)?\s*(?:mcg|mg|g|kg|ml|mL|l|L|%|units|iu|IU))\s*$/i);
  if (m)
    return m[1]
      .replace(/\s+/g, "")
      .replace(/ml/gi, "mL")
      .replace(/iu/gi, "IU");

  return "";
};

const extractMedicationsFromBlock_MATCH_SINGLE = (block) => {
  const text = normalizeText(block || "");

  const dateRe = /\b[0-3][0-9]-[A-Za-z]{3}-[12][0-9]{3}\b/g;
  const dinChunk = "((?:\\d[\\s-]*){8})";
  const formPattern =
    "(?:TAB|CAP|ML|DEV|SUSP|INJ|SOLN|SR|CR|ER|GM|DOS|RNG|PEN|PATCH|SPRAY|DROP|SUPP)";

  const rxA = new RegExp(
    `\\b(\\d+(?:\\.\\d+)?)\\s+(${formPattern})\\s+(.+?)\\s+${dinChunk}\\b`,
    "gi"
  );

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

  while ((m = rxB.exec(text)) !== null) {
    const name = m[1] || "";
    const din = m[2] || "";
    const firstFill = m[3] || "";
    const lastFill = m[4] || "";
    pushMed(name, din, firstFill, lastFill);
  }

  return meds;
};

// compress to UNIQUE DINs (prevents duplicates)
const compressMedsToUniqueDin = (meds) => {
  const list = Array.isArray(meds) ? meds : [];
  const map = new Map(); // din -> best record

  const parseDDMMMYYYY = (s) => {
    const v = (s || "").trim();
    const m = v.match(/^([0-3][0-9])-([A-Za-z]{3})-([12][0-9]{3})$/);
    if (!m) return null;

    const dd = Number(m[1]);
    const mon = (m[2] || "").toLowerCase();
    const yyyy = Number(m[3]);

    const months = {
      jan: 0,
      feb: 1,
      mar: 2,
      apr: 3,
      may: 4,
      jun: 5,
      jul: 6,
      aug: 7,
      sep: 8,
      oct: 9,
      nov: 10,
      dec: 11,
    };

    const mm = months[mon];
    if (mm === undefined) return null;

    const dt = new Date(yyyy, mm, dd);
    if (dt.getFullYear() !== yyyy || dt.getMonth() !== mm || dt.getDate() !== dd) return null;
    return dt;
  };

  const lastFillRank = (med) => {
    const lf = parseDDMMMYYYY(med?.lastFill || "");
    if (lf) return lf.getTime();
    const ff = parseDDMMMYYYY(med?.firstFill || "");
    if (ff) return ff.getTime();
    return 0;
  };

  for (const m of list) {
    const din = digitsOnly(m?.din || "").slice(0, 8);
    if (din.length !== 8) continue;

    const candidate = {
      medication: (m?.medication || "").toString().trim(),
      medication_dose: (m?.medication_dose || "").toString().trim(),
      din,
      firstFill: (m?.firstFill || "").toString().trim(),
      lastFill: (m?.lastFill || "").toString().trim(),
    };

    if (!map.has(din)) {
      map.set(din, candidate);
      continue;
    }

    const existing = map.get(din);
    if (lastFillRank(candidate) >= lastFillRank(existing)) {
      map.set(din, candidate);
    }
  }

  return Array.from(map.values());
};

// ---------- Provider helpers ----------
const getProviderLabel = (p) => {
  const name = (p?.pharmacyName ?? "").trim();
  const loc = (p?.pharmacyLocation ?? "").trim();
  const phone = (p?.pharmacyPhone ?? "").trim();
  return [name, loc, phone].filter(Boolean).join(" — ");
};

const renderUnknownBadge = (unknownCount) => {
  const n = Number(unknownCount);

  if (Number.isNaN(n) || n < 0) {
    return <span className="text-warning ms-1">[N/A]</span>;
  }

  if (n > 0) {
    return <span className="text-danger ms-1">[{n}]</span>;
  }

  return <span className="text-muted ms-1">[0]</span>;
};

// Step 1 totalPoints = N/A until pointsReady
const renderPointsValue = (points, pointsReady) => {
  if (!pointsReady) return <span className="text-warning fw-semibold">N/A</span>;
  const n = Number(points || 0);
  return <span className="text-primary fw-semibold">{Number.isFinite(n) ? n : 0}</span>;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

// unique key per patient
const makePatientKey = (index, hcnRaw, name) => {
  const a = String(index || "");
  const b = digitsOnly(hcnRaw || "") || "NOHCN";
  const c = (name || "").toString().slice(0, 12).replace(/\s+/g, "_");
  return `${Date.now()}_${a}_${b}_${c}`;
};

// ---------- Component ----------
export default function PharmacyMultiple() {
  const fileInputRef = useRef(null);
  const { setVisibleBox } = useGlobalContext();

  const [msg, setMsg] = useState("");
  const [parsing, setParsing] = useState(false);

  const [allPatients, setAllPatients] = useState([]);
  const [fileName, setFileName] = useState("");
  const [stepReady, setStepReady] = useState(false);

  // Step 2 state
  const [step2Running, setStep2Running] = useState(false);
  const [step2Done, setStep2Done] = useState(0);

  // Saving state
  const [savingKey, setSavingKey] = useState("");

  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editKey, setEditKey] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    healthNumberRaw: "",
    allergiesCsv: "",
    conditionsCsv: "",
  });

  // Pharmacy select
  const [providerData, setProviderData] = useState(null);
  const [selectedProviderId, setSelectedProviderId] = useState("");

  const providerOptions = Array.isArray(providerData)
    ? providerData
    : providerData
    ? [providerData]
    : [];

  const selectedProvider =
    providerOptions.find((p) => String(p?.ID ?? "") === String(selectedProviderId)) || null;

  useEffect(() => {
    let mounted = true;

    const fetchProviders = async () => {
      try {
        const res = await fetch(API_Endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scriptName: "getProvider" }),
        });

        const json = await res.json();
        if (!mounted) return;

        if (json?.success) {
          setProviderData(json.provider ?? json.providers ?? null);
        } else {
          setProviderData(null);
        }
      } catch (err) {
        console.error("getProvider failed:", err);
        if (mounted) setProviderData(null);
      }
    };

    fetchProviders();
    return () => {
      mounted = false;
    };
  }, []);

  const resetAll = () => {
    setMsg("");
    setParsing(false);
    setAllPatients([]);
    setFileName("");
    setStepReady(false);

    setStep2Running(false);
    setStep2Done(0);

    setSavingKey("");

    setShowEdit(false);
    setEditKey("");
    setEditForm({ name: "", healthNumberRaw: "", allergiesCsv: "", conditionsCsv: "" });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const goSingleUpload = () => {
    if (typeof setVisibleBox === "function") setVisibleBox("pharmacy");
  };

  const handleProviderChange = (e) => {
    setSelectedProviderId(e.target.value);
    resetAll();
  };

  const updatePatientByKey = (key, patch) => {
    setAllPatients((prev) =>
      prev.map((p) => {
        if (String(p._key || "") !== String(key || "")) return p;
        return { ...p, ...patch };
      })
    );
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;

    if (!selectedProviderId) {
      setMsg("Please select a Pharmacy first.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    try {
      setParsing(true);
      setMsg("Reading PDF…");
      setFileName(file.name);

      const rawText = await readPdfToText(file);

      setMsg("Splitting reports…");
      const blocks = splitIntoPatientBlocks(rawText);

      const patients = blocks
        .map((block, idx) => {
          const name = extractNameFromBlock(block);
          const dob = extractDOBFromBlock(block);
          const age = calcAge(dob);

          const hcnRaw = extractHCNFromBlock(block);
          const hcnFmt = formatHcn(hcnRaw);

          const allergies = normalizeAllergies(extractAllergiesFromBlock(block));
          const conditions = normalizeConditions(extractConditionsFromBlock(block));

          // ✅ MATCH SINGLE PARSER + compress to unique DINs
          const medsFull = extractMedicationsFromBlock_MATCH_SINGLE(block);
          const medsUnique = compressMedsToUniqueDin(medsFull);
          const medsCount = Array.isArray(medsUnique) ? medsUnique.length : 0;

          // ✅ capture address + billing section chunk
          const ab = extractAddressBillingChunk(block, name);
          const billingInfo = extractBillingInfoFromChunkLines(ab.chunkLines);
          const addr = extractAddressFromChunkLines(ab.chunkLines);

          // ✅ store these in objects so you can save the whole thing cleanly
          const addressData = {
            street: addr.street || "",
            city: addr.city || "",
            province: addr.province || "",
            postalCode: addr.postalCode || "",
            fullAddress: addr.fullAddress || "",
            hasAddress: !!addr.hasAddress,
          };

          const billingData = {
            billingInfo: billingInfo || "",
            addressBillingChunk: ab.chunk || "",
            hasBillingInfo: !!(billingInfo || "").trim(),
          };

          const _key = makePatientKey(idx + 1, hcnRaw, name);

          return {
            _key,
            index: idx + 1,

            name: name || "Unknown Name",
            dateOfBirth: dob || "",
            age: Number.isFinite(age) ? age : null,

            healthNumberRaw: hcnRaw || "",
            healthNumber: hcnFmt || "",

            // ✅ requested structured storage
            addressData,
            billingData,

            // ✅ flat fields (kept for compatibility / searching)
            street: addressData.street,
            city: addressData.city,
            province: addressData.province,
            postalCode: addressData.postalCode,
            fullAddress: addressData.fullAddress,
            hasAddress: addressData.hasAddress,

            billingInfo: billingData.billingInfo,
            hasBillingInfo: billingData.hasBillingInfo,
            addressBillingChunk: billingData.addressBillingChunk,

            allergies,
            conditions,

            // ✅ meds
            medications: medsUnique, // [{medication,dose,din,firstFill,lastFill}]
            medsCount,

            // Step 1 placeholders
            unknownCount: -1, // show [N/A]
            totalPoints: 0, // show N/A until step2
            pointsReady: false,
            pointsLoading: false,

            // process state
            saved: false,

            // saved/updated date
            dataPoint: todayISO(),

            rawBlock: block,
          };
        })
        .filter((p) => (p.name || "").trim() !== "" && p.name !== "Unknown Name");

      setAllPatients(patients);
      setMsg(`Done. Found ${patients.length} report(s).`);
      setStepReady(patients.length > 0);

      setStep2Done(0);
    } catch (err) {
      console.error("Multiple PDF parse failed:", err);
      setMsg("Failed to read PDF.");
      setAllPatients([]);
      setStepReady(false);
    } finally {
      setParsing(false);
    }
  };

  // --------------------
  // STEP 2 (findPoints)
  // --------------------
  const runStep2 = async () => {
    if (!selectedProviderId || allPatients.length === 0) return;

    setStep2Running(true);
    setStep2Done(0);
    setMsg("Step 2: Calculating points + unknown meds…");

    try {
      for (let i = 0; i < allPatients.length; i++) {
        const p = allPatients[i];

        updatePatientByKey(p._key, {
          pointsLoading: true,
          pointsReady: false,
          unknownCount: -1,
          totalPoints: 0,
        });

        // ✅ send meds in SAME SHAPE as single parser expects
        const medsForPoints = (Array.isArray(p.medications) ? p.medications : [])
          .map((m) => ({
            medication: (m?.medication || m?.din || "").toString().trim(),
            medication_dose: (m?.medication_dose || "").toString().trim(),
            din: digitsOnly(m?.din || "").slice(0, 8),
            firstFill: (m?.firstFill || "").toString().trim(),
            lastFill: (m?.lastFill || "").toString().trim(),
          }))
          .filter((m) => m.din && m.din.length === 8);

        const payload = {
          scriptName: "findPoints",
          providerID: String(selectedProviderId || ""),
          medications: medsForPoints,
        };

        try {
          const res = await fetch(API_Endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const json = await res.json();

          const pts = Number(json?.totalPoints ?? json?.points ?? 0);
          const unk = Number(json?.unknownCats ?? json?.unknown ?? json?.unfound ?? 0);

          updatePatientByKey(p._key, {
            totalPoints: Number.isFinite(pts) ? pts : 0,
            unknownCount: Number.isFinite(unk) ? unk : 0,
            pointsReady: true,
            pointsLoading: false,
          });
        } catch (err) {
          console.error("findPoints failed for:", p.healthNumberRaw, err);
          updatePatientByKey(p._key, {
            totalPoints: 0,
            unknownCount: -1,
            pointsReady: false,
            pointsLoading: false,
          });
        }

        setStep2Done((n) => n + 1);
      }

      setMsg("Step 2 complete.");
    } finally {
      setStep2Running(false);
    }
  };

  // --------------------
  // EDIT patient
  // --------------------
  const openEdit = (p) => {
    setEditKey(String(p._key || ""));
    setEditForm({
      name: p.name || "",
      healthNumberRaw: p.healthNumberRaw || "",
      allergiesCsv: (Array.isArray(p.allergies) ? p.allergies : []).join(", "),
      conditionsCsv: (Array.isArray(p.conditions) ? p.conditions : []).join(", "),
    });
    setShowEdit(true);
  };

  const applyEdit = () => {
    const key = String(editKey || "");
    if (!key) return;

    const newHcnRaw = digitsOnly(editForm.healthNumberRaw || "");

    setAllPatients((prev) =>
      prev.map((p) => {
        if (String(p._key || "") !== key) return p;

        const nextRaw = newHcnRaw || p.healthNumberRaw || "";
        return {
          ...p,
          name: (editForm.name || "").trim(),
          healthNumberRaw: nextRaw,
          healthNumber: formatHcn(nextRaw),
          allergies: normalizeAllergies(parseCsvInput(editForm.allergiesCsv)),
          conditions: normalizeConditions(parseCsvInput(editForm.conditionsCsv)),
        };
      })
    );

    setShowEdit(false);
    setEditKey("");
    setEditForm({ name: "", healthNumberRaw: "", allergiesCsv: "", conditionsCsv: "" });
  };

  // --------------------
  // PROCESS (savePatientInfo)
  // --------------------
  const canProcessPatient = (p) => {
    const hcnOk = isValidHcn(p.healthNumberRaw || p.healthNumber || "");
    const unk = Number(p.unknownCount);
    const loading = !!p.pointsLoading;
    const ready = !!p.pointsReady;

    return hcnOk && ready && !loading && unk === 0 && p.saved !== true && !!selectedProviderId;
  };

  const handleProcessPatient = async (p) => {
    if (!p || savingKey) return;
    if (!canProcessPatient(p)) return;

    // ✅ meds saved in DB: [{din,lastFill}] + medsData CSV
    const medsSlim = (Array.isArray(p.medications) ? p.medications : [])
      .map((m) => ({
        din: digitsOnly(m?.din || "").slice(0, 8),
        lastFill: (m?.lastFill || "").toString().trim(),
      }))
      .filter((m) => m.din && m.din.length === 8);

    const medsData = medsSlim.map((m) => m.din).join(",");

    // ✅ include billingInfo + address fields in patientData
    const patientDataForBackend = {
      name: p.name || "",
      healthNumber: formatHcn(p.healthNumberRaw || p.healthNumber || ""),
      healthNumberRaw: digitsOnly(p.healthNumberRaw || ""),
      dateOfBirth: p.dateOfBirth || "",

      // ✅ requested structured storage
      addressData: p.addressData || {
        street: "",
        city: "",
        province: "",
        postalCode: "",
        fullAddress: "",
        hasAddress: false,
      },

      billingData: p.billingData || {
        billingInfo: "",
        addressBillingChunk: "",
        hasBillingInfo: false,
      },

      // ✅ keep flat fields too (easy searching)
      street: p.street || "",
      city: p.city || "",
      province: p.province || "",
      postalCode: p.postalCode || "",
      fullAddress: p.fullAddress || "",

      billingInfo: p.billingInfo || "",
      addressBillingChunk: p.addressBillingChunk || "",

      allergies: Array.isArray(p.allergies) ? p.allergies : [],
      conditions: Array.isArray(p.conditions) ? p.conditions : [],
    };

    const payload = {
      scriptName: "savePatientInfo",

      patientSource: "pharmacy",
      healthNumber: formatHcn(p.healthNumberRaw || p.healthNumber || ""),
      dataPoint: p.dataPoint || todayISO(),
      pharmacyID: String(selectedProviderId || ""),
      totalPoints: Number(p.totalPoints || 0),

      medsData,
      medications: medsSlim,

      // ✅ this is what gets stored into allDataSave on backend (if you do that)
      patientData: patientDataForBackend,
    };

    setSavingKey(String(p._key || ""));
    setMsg(`Saving ${p.name || "patient"}…`);

    try {
      const res = await fetch(API_Endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (json?.success) {
        updatePatientByKey(p._key, {
          saved: true,
          dataPoint: json?.dataPoint || p.dataPoint || todayISO(),
        });
        setMsg("Saved.");
      } else {
        setMsg(json?.error || "Could not save.");
      }
    } catch (err) {
      console.error("savePatientInfo failed:", err);
      setMsg("Could not save (network/server error).");
    } finally {
      setSavingKey("");
    }
  };

  // ---------- UI ----------
  return (
    <div className="container-fluid p-2">
      {/* Header */}
      <div className="row g-2 align-items-center">
        <div className="col-30">
          <div className="fw-semibold">Pharmacy Multiple Upload</div>
          <div className="text-muted small">
            Step 1: Split file into reports. Step 2: Calculate unknown meds + points. Then Process each
            patient if allowed.
          </div>
        </div>

        <div className="col-18 text-end d-flex justify-content-end gap-2">
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={goSingleUpload}
            disabled={parsing || step2Running}
          >
            Upload Single PDF
          </button>

          <button
            className="btn btn-outline-danger btn-sm"
            onClick={resetAll}
            disabled={parsing || step2Running || !!savingKey}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Pharmacy Select */}
      <div className="row g-2 mt-2">
        <div className="col-48">
          <div className="border rounded p-2">
            <div className="row g-2 align-items-center">
              <div className="col-24">
                <label className="form-label mb-1">Pharmacy (required)</label>
                <select
                  className="form-select form-select-sm"
                  value={selectedProviderId}
                  onChange={handleProviderChange}
                  disabled={parsing || step2Running || !!savingKey || providerOptions.length === 0}
                >
                  <option value="">
                    {providerOptions.length === 0 ? "Loading pharmacies..." : "Select pharmacy..."}
                  </option>
                  {providerOptions.map((p, idx) => {
                    const pid = String(p?.ID ?? `ph_${idx}`);
                    return (
                      <option key={pid} value={String(p?.ID ?? "")}>
                        {getProviderLabel(p) || "(Unnamed Pharmacy)"}
                      </option>
                    );
                  })}
                </select>

                {!selectedProviderId ? (
                  <div className="form-text text-danger">Select a pharmacy before choosing a PDF.</div>
                ) : (
                  <div className="form-text text-muted">
                    Selected: <strong>{getProviderLabel(selectedProvider) || "—"}</strong>
                  </div>
                )}
              </div>

              <div className="col-24">
                <div className="small text-muted mb-1">Status</div>
                <div className="border rounded px-2 py-2">
                  {parsing || step2Running || savingKey ? (
                    <span className="text-muted">
                      <em>{msg || "Working…"}</em>
                    </span>
                  ) : (
                    <span>{msg || "Waiting…"}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Upload input */}
            <div className="row g-2 mt-2 align-items-center">
              <div className="col-24">
                <div className="small text-muted mb-1">Upload Multiple PDF</div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="form-control form-control-sm"
                  onChange={handleFileChange}
                  disabled={parsing || step2Running || !!savingKey || !selectedProviderId}
                  title={!selectedProviderId ? "Select a pharmacy first" : ""}
                />
                {fileName ? (
                  <div className="text-muted small mt-1">
                    <em>{fileName}</em>
                  </div>
                ) : null}
              </div>

              <div className="col-24 text-end d-flex justify-content-end gap-2">
                <button
                  className="btn btn-outline-primary btn-sm"
                  disabled={!stepReady || parsing || step2Running || !!savingKey}
                  onClick={runStep2}
                >
                  Move to Step 2
                </button>
              </div>
            </div>

            <div className="row g-2 mt-2">
              <div className="col-48 d-flex justify-content-between">
                <div className="small text-muted">
                  Found <span className="fw-semibold">{allPatients.length}</span> report(s) in this file.
                </div>
                <div className="small text-muted">
                  Step 2 Progress:{" "}
                  <span className="fw-semibold">
                    {step2Done}/{allPatients.length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="row g-2 mt-2">
        <div className="col-48">
          <div className="border rounded p-2">
            <div className="fw-semibold mb-2">
              Reports in File: <span className="text-primary">{allPatients.length}</span>
            </div>

            {allPatients.length === 0 ? (
              <div className="text-muted small">
                <em>No reports loaded yet.</em>
              </div>
            ) : (
              <div className="row row-cols-1 g-2">
                {allPatients.map((p) => {
                  const hcnOk = isValidHcn(p.healthNumberRaw || p.healthNumber || "");
                  const canProcess = canProcessPatient(p);

                  const processBtnClass = p.saved
                    ? "btn btn-success btn-sm"
                    : canProcess
                    ? "btn btn-primary btn-sm"
                    : "btn btn-outline-secondary btn-sm";

                  const processText = p.saved
                    ? "Saved"
                    : savingKey && String(savingKey) === String(p._key)
                    ? "Saving…"
                    : "Process";

                  return (
                    <div className="col" key={p._key}>
                      <div className="border rounded p-2">
                        {/* Top Line (Name + Meds + Address + Billing) */}
                        <div className="d-flex justify-content-between align-items-center">
                          {/* LEFT */}
                          <div
                            className="d-flex align-items-center gap-2 flex-wrap"
                            style={{ maxWidth: "70%" }}
                          >
                            <div className="fw-semibold text-truncate" style={{ maxWidth: "360px" }}>
                              {p.index}. {p.name}
                            </div>

                            <div className="small">
                              <span className="text-muted">Meds:</span>{" "}
                              <span className="fw-semibold">{Number(p.medsCount || 0)}</span>
                              {renderUnknownBadge(p.unknownCount)}
                            </div>

                            <div className="small">
                              <span className="text-muted">Points:</span>{" "}
                              <span className="fw-semibold">
                                {p.pointsLoading ? (
                                  <span className="text-muted">
                                    <em>…</em>
                                  </span>
                                ) : (
                                  renderPointsValue(p.totalPoints, p.pointsReady)
                                )}
                              </span>
                            </div>

                            <div className="small">
                              <span className="text-muted">Address:</span>{" "}
                              <span
                                className={
                                  p.addressData?.hasAddress
                                    ? "text-success fw-semibold"
                                    : "text-danger fw-semibold"
                                }
                              >
                                {p.addressData?.hasAddress ? "Yes" : "No"}
                              </span>
                            </div>

                            <div className="small">
                              <span className="text-muted">Billing:</span>{" "}
                              <span
                                className={
                                  p.billingData?.hasBillingInfo
                                    ? "text-success fw-semibold"
                                    : "text-danger fw-semibold"
                                }
                              >
                                {p.billingData?.hasBillingInfo ? "Yes" : "No"}
                              </span>
                            </div>

                            <div className="small text-muted">
                              {p.addressData?.hasAddress ? (
                                <em>
                                  {(p.addressData?.city || "-") +
                                    " " +
                                    (p.addressData?.province || "")}
                                </em>
                              ) : (
                                <em>-</em>
                              )}
                            </div>
                          </div>

                          {/* RIGHT */}
                          <div className="d-flex gap-2 align-items-center">
                            <div className="small text-muted">
                              {p.age !== null ? `Age: ${p.age}` : "Age: -"}
                            </div>

                            <button
                              className="btn btn-outline-primary btn-sm"
                              onClick={() => openEdit(p)}
                              disabled={parsing || step2Running || !!savingKey}
                            >
                              Edit
                            </button>

                            <button
                              className={processBtnClass}
                              onClick={() => handleProcessPatient(p)}
                              disabled={!canProcess || p.saved || parsing || step2Running || !!savingKey}
                            >
                              {processText}
                            </button>
                          </div>
                        </div>

                        {/* Compact Info Row */}
                        <div className="row g-2 mt-1 align-items-center">
                          <div className="col-10">
                            <div className="small text-muted">HCN</div>
                            <div className={`fw-semibold ${hcnOk ? "" : "text-danger"}`}>
                              {p.healthNumber || "-"}
                            </div>
                          </div>

                          <div className="col-6">
                            <div className="small text-muted">Meds</div>
                            <div className="fw-semibold">
                              {Number(p.medsCount || 0)}
                              {renderUnknownBadge(p.unknownCount)}
                            </div>
                          </div>

                          <div className="col-7">
                            <div className="small text-muted">Allergies</div>
                            <div className="fw-semibold">
                              {Array.isArray(p.allergies) ? p.allergies.length : 0}
                            </div>
                          </div>

                          <div className="col-7">
                            <div className="small text-muted">Conditions</div>
                            <div className="fw-semibold">
                              {Array.isArray(p.conditions) ? p.conditions.length : 0}
                            </div>
                          </div>

                          <div className="col-6 text-end">
                            <div className="small text-muted">Points</div>
                            <div className="fw-semibold">
                              {p.pointsLoading ? (
                                <span className="text-muted">
                                  <em>…</em>
                                </span>
                              ) : (
                                renderPointsValue(p.totalPoints, p.pointsReady)
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
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
                <h5 className="modal-title">Edit Patient</h5>
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

                  <div className="col-24">
                    <label className="form-label mb-1">Health Card Number</label>
                    <input
                      className="form-control form-control-sm"
                      value={editForm.healthNumberRaw}
                      onChange={(e) => setEditForm((s) => ({ ...s, healthNumberRaw: e.target.value }))}
                    />
                    <div className="form-text text-muted">
                      Formatted: <strong>{formatHcn(editForm.healthNumberRaw || "") || "-"}</strong>
                    </div>
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

                  <div className="col-48">
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
  );
}
