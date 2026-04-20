import React, { useEffect, useMemo, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { useGlobalContext } from "../../Context/global.context";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const ENDPOINT = "https://gdmt.ca/PHP/special.php";

const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const cleanLine = (s) =>
  String(s || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[•●◦▪\-\*]+\s*/, "")
    .replace(/[|]+/g, " ")
    .replace(/[.,;:]+$/g, "")
    .trim();

const uniqueStrings = (arr) => {
  const out = [];
  const seen = new Set();

  for (const item of arr) {
    const val = cleanLine(item);
    const key = normalize(val);
    if (!val || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(val);
  }

  return out;
};

const readCondName = (c) => String(c?.conditionName ?? c?.name ?? "").trim();
const readCondCode = (c) => String(c?.conditionCode ?? c?.code ?? "").trim();
const readCondId = (c) => String(c?.ID ?? c?.id ?? "").trim();

const digitsOnly = (value) => String(value || "").replace(/\D/g, "").slice(0, 10);

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

  return text
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
};

const extractPatientName = (text) => {
  const src = String(text || "").replace(/\u00A0/g, " ");

  const labelMatch = src.match(/Patient\s+Name\s+([A-Za-z' -]+,\s*[A-Za-z' -]+)/i);
  if (labelMatch?.[1]) {
    return cleanLine(labelMatch[1]);
  }

  const demoMatch = src.match(/^\s*([A-Za-z' -]+,\s*[A-Za-z' -]+)\s*\(MRN/i);
  if (demoMatch?.[1]) {
    return cleanLine(demoMatch[1]);
  }

  const consultMatch = src.match(/([A-Za-z' -]+)\s+is\s+a\s+\d{1,3}\s*y\.o\./i);
  if (consultMatch?.[1]) {
    return cleanLine(consultMatch[1]);
  }

  return "";
};

const extractPastMedicalHistoryBlock = (text) => {
  const src = String(text || "")
    .replace(/\u00A0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n");

  const match = src.match(
    /Past\s+Medical\s+History\s*:?\s*([\s\S]*?)(?=\bFamily\s+History\b|\bCurrent\s+Outpatient\s+Medications\b|\bCardiovascular\s+History\b|$)/i
  );

  return match?.[1]?.trim() || "";
};

const extractConditionLines = (text) => {
  const pmhBlock = extractPastMedicalHistoryBlock(text);
  if (!pmhBlock) return [];

  const bulletMatches = [...pmhBlock.matchAll(/[•●◦▪]\s*([^\n•●◦▪]+)/g)];

  let out = bulletMatches
    .map((m) => cleanLine(m[1]))
    .filter(Boolean);

  if (!out.length) {
    out = pmhBlock
      .replace(/[•●◦▪]/g, "\n• ")
      .replace(/\s{2,}/g, " ")
      .split("\n")
      .map((s) => cleanLine(s))
      .filter(Boolean);
  }

  return uniqueStrings(out);
};

const findBestConditionMatch = (text, catalog) => {
  const source = normalize(text);
  if (!source) return null;

  let best = null;

  for (const cond of catalog) {
    const name = readCondName(cond);
    const code = readCondCode(cond);
    const id = readCondId(cond);
    const nameNorm = normalize(name);

    if (!nameNorm) continue;

    let score = 0;

    if (source === nameNorm) score = 100;
    else if (source.includes(nameNorm) || nameNorm.includes(source)) score = 85;
    else {
      const sourceWords = source.split(" ").filter(Boolean);
      const nameWords = nameNorm.split(" ").filter(Boolean);
      const overlap = nameWords.filter((w) => sourceWords.includes(w)).length;
      if (overlap > 0) score = Math.min(75, overlap * 20);
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { id, conditionName: name, conditionCode: code, score };
    }
  }

  return best;
};

export default function ReadHospitalConditions({
  onHospitalParsed,
  onHospitalSaved,
}) {
  const gc = useGlobalContext() || {};
  const {
    conditionData,
    updateConditionData,
    activePatient,
    setActivePatient,
    updateActivePatient,
    setDisplayMain,
    setMainButton,
  } = gc;

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [rows, setRows] = useState([]);
  const [confirmedPatient, setConfirmedPatient] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [confirmHCN, setConfirmHCN] = useState("");

  useEffect(() => {
    if (Array.isArray(conditionData) && conditionData.length > 0) return;

    let isMounted = true;

    (async () => {
      try {
        const resp = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: "loadConditionData" }),
        });

        const payload = await resp.json();
        const list = Array.isArray(payload?.conditions)
          ? payload.conditions
          : Array.isArray(payload)
            ? payload
            : [];

        if (isMounted && list.length && typeof updateConditionData === "function") {
          updateConditionData(list);
        }
      } catch (e) {
        console.error("Could not load conditionData for hospital parser", e);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [conditionData, updateConditionData]);

  const conditionOptions = useMemo(
    () =>
      (Array.isArray(conditionData) ? conditionData : []).map((c) => ({
        id: readCondId(c),
        conditionName: readCondName(c),
        conditionCode: readCondCode(c),
      })),
    [conditionData]
  );

  const activePatientHCN = digitsOnly(activePatient?.healthNumber || "");
  const enteredHCN = digitsOnly(confirmHCN || "");
  const hcnMatchesActivePatient =
    activePatientHCN.length === 10 && enteredHCN === activePatientHCN;

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErr("");
    setRows([]);
    setConfirmedPatient(false);
    setPatientName("");
    setConfirmHCN("");
    setLoading(true);

    try {
      const rawText = await readPdfAsText(file);
      const extractedName = extractPatientName(rawText);
      const extractedConditions = extractConditionLines(rawText);

      setPatientName(extractedName);

      const preparedRows = extractedConditions.map((condition, index) => {
        const best = findBestConditionMatch(condition, conditionOptions);

        return {
          rowId: `${Date.now()}-${index}`,
          condition,
          linkedId: best?.id || "",
          linkedName: best?.conditionName || "",
          linkedCode: best?.conditionCode || "",
          status: best?.conditionCode ? "linked" : "pending",
        };
      });

      setRows(preparedRows);

      if (!extractedConditions.length) {
        setErr("No conditions were found in the Past Medical History section.");
      }

      if (typeof onHospitalParsed === "function") {
        onHospitalParsed({
          patientName: extractedName,
          conditions: extractedConditions,
        });
      }
    } catch (ex) {
      console.error(ex);
      setErr(ex?.message || "Failed to process PDF");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  const updateRow = (rowId, patch) => {
    setRows((prev) =>
      prev.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row))
    );
  };

  const handleSelectExisting = (rowId, optionId) => {
    const option = conditionOptions.find(
      (opt) => String(opt.id) === String(optionId)
    );

    if (!option) {
      updateRow(rowId, {
        linkedId: "",
        linkedName: "",
        linkedCode: "",
        status: "pending",
      });
      return;
    }

    updateRow(rowId, {
      linkedId: option.id,
      linkedName: option.conditionName,
      linkedCode: option.conditionCode,
      status: "linked",
    });
  };

  const allRowsResolved =
    rows.length > 0 &&
    rows.every(
      (row) =>
        row.status === "ignored" ||
        (row.status === "linked" && row.linkedId && row.linkedCode)
    );

  const canSave = confirmedPatient && allRowsResolved && hcnMatchesActivePatient;

  const refreshActivePatientFromPhp = async () => {
    if (!activePatient?.id) return null;

    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        script: "getPatientById",
        patientID: activePatient.id,
        healthNumber: activePatient.healthNumber || "",
      }),
    });

    const result = await resp.json();
    if (result?.success && result?.patient) {
      if (typeof updateActivePatient === "function") {
        updateActivePatient(result.patient);
      } else if (typeof setActivePatient === "function") {
        setActivePatient(result.patient);
      }
      return result.patient;
    }

    return null;
  };

  const saveAllResolvedConditions = async () => {
    if (!canSave) return;

    const resolvedConditions = rows
      .filter((row) => row.status === "linked" && row.linkedCode)
      .map((row) => ({
        originalCondition: row.condition,
        conditionName: row.linkedName || row.condition,
        conditionCode: row.linkedCode,
        conditionId: row.linkedId || "",
      }));

    const ignoredConditions = rows
      .filter((row) => row.status === "ignored")
      .map((row) => row.condition);

    const payload = {
      script: "updatePatientConditionsFromHospital",
      confirmedPatient: true,
      patientName,
      patientId: activePatient?.id || "",
      healthNumber: activePatient?.healthNumber || "",
      resolvedConditions,
      ignoredConditions,
    };

    try {
      const resp = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await resp.json();

      if (!result?.success) {
        setErr(result?.error || "Could not save hospital conditions.");
        return;
      }

      const refreshedPatient = await refreshActivePatientFromPhp();

      if (typeof onHospitalSaved === "function") {
        onHospitalSaved({
          ...result,
          patient: refreshedPatient,
        });
      }

      setRows([]);
      setConfirmedPatient(false);
      setPatientName("");
      setConfirmHCN("");
      setErr("");

      if (typeof setMainButton === "function") {
        setMainButton(null);
      }
      if (typeof setDisplayMain === "function") {
        setDisplayMain(false);
      }
    } catch (error) {
      console.error(error);
      setErr("Failed to save hospital conditions.");
    }
  };

  return (
    <div className="p-2 alert alert-light">
      <input
        type="file"
        accept="application/pdf"
        className="form-control"
        onChange={onUpload}
      />

      {loading ? (
        <div className="mt-2 text-muted">Reading hospital report…</div>
      ) : null}

      {err ? <div className="mt-2 text-danger small">{err}</div> : null}

      {rows.length > 0 && (
        <div className="mt-3">
          <div className="alert alert-warning py-2 mb-3">
            <div className="fw-bold mb-1">
              Warning: You must confirm that this hospital record belongs to the patient before saving.
            </div>

            <div className="mb-2">
              Patient from hospital record:{" "}
              <span className="fw-bold text-danger">
                {patientName || "Unknown Patient"}
              </span>
            </div>

            <div className="mb-2">
              Active Patient HCN:{" "}
              <span className="fw-bold text-primary">
                {activePatient?.healthNumber || "No Active Patient"}
              </span>
            </div>

            <div className="mb-2">
              <label className="form-label mb-1">
                Enter HCN for confirmation
              </label>
              <input
                type="text"
                className={`form-control form-control-sm ${
                  confirmHCN.length === 0
                    ? ""
                    : hcnMatchesActivePatient
                      ? "is-valid"
                      : "is-invalid"
                }`}
                value={confirmHCN}
                onChange={(e) => setConfirmHCN(digitsOnly(e.target.value))}
                maxLength={10}
                inputMode="numeric"
                placeholder="Enter patient HCN with no spaces"
              />
              <div className="small mt-1">
                {confirmHCN.length === 0 ? (
                  <span className="text-muted">
                    Enter the patient HCN. It must match the active patient.
                  </span>
                ) : hcnMatchesActivePatient ? (
                  <span className="text-success">
                    HCN matches active patient.
                  </span>
                ) : (
                  <span className="text-danger">
                    HCN does not match active patient.
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              className={`btn btn-sm ${confirmedPatient ? "btn-success" : "btn-outline-warning"}`}
              onClick={() => setConfirmedPatient((prev) => !prev)}
            >
              {confirmedPatient ? "Confirmed" : "Confirm"}
            </button>
          </div>

          <div className="d-flex align-items-center justify-content-between mb-2">
            <h6 className="m-0">Conditions from hospital form</h6>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              disabled={!canSave}
              onClick={saveAllResolvedConditions}
            >
              Save Conditions
            </button>
          </div>

          <div className="table-responsive">
            <table className="table table-sm align-middle">
              <thead>
                <tr>
                  <th>Condition</th>
                  <th>Choose Condition</th>
                  <th>Condition Code</th>
                  <th className="text-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.rowId}
                    className={row.status === "ignored" ? "table-secondary" : ""}
                  >
                    <td>{row.condition}</td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        value={row.linkedId}
                        disabled={row.status === "ignored"}
                        onChange={(e) => handleSelectExisting(row.rowId, e.target.value)}
                      >
                        <option value="">Select condition…</option>
                        {conditionOptions.map((opt) => (
                          <option
                            key={opt.id || `${opt.conditionName}-${opt.conditionCode}`}
                            value={opt.id}
                          >
                            {opt.conditionName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={row.linkedCode}
                        disabled
                        readOnly
                      />
                    </td>
                    <td className="text-nowrap">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() =>
                          updateRow(row.rowId, {
                            status: row.status === "ignored" ? "pending" : "ignored",
                            ...(row.status === "ignored"
                              ? {}
                              : { linkedId: "", linkedName: "", linkedCode: "" }),
                          })
                        }
                      >
                        {row.status === "ignored" ? "Unignore" : "Ignore"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="small text-muted">
            Every condition must be either chosen from the dropdown or ignored, the record must be confirmed, and the HCN must match the active patient before saving.
          </div>
        </div>
      )}
    </div>
  );
}