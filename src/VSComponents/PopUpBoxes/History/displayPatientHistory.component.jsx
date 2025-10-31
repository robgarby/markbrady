// src/components/Patient/displayPatientHistory.component.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useGlobalContext } from "../../../Context/global.context";
import { getUserFromToken } from '../../../Context/functions';

const CAT_ENDPOINT = "https://gdmt.ca/PHP/special.php";

// Lab catalog: [Label, valueField, dateField]
const LABS = [
  ["Cholesterol", "cholesterol", "cholesterolDate"],
  ["Triglyceride", "triglyceride", "triglycerideDate"],
  ["HDL", "hdl", "hdlDate"],
  ["LDL", "ldl", "ldlDate"],
  ["Non-HDL", "nonHdl", "nonHdlDate"],
  ["Cholesterol/HDL Ratio", "cholesterolHdlRatio", "cholesterolHdlRatioDate"],
  ["Creatine Kinase", "creatineKinase", "creatineKinaseDate"],
  ["ALT (Alanine Aminotransferase)", "alanineAminotransferase", "alanineAminotransferaseDate"],
  ["Lipoprotein(a)", "lipoproteinA", "lipoproteinADate"],
  ["Apolipoprotein B", "apolipoproteinB", "apolipoproteinBDate"],
  ["BNP", "natriureticPeptideB", "natriureticPeptideBDate"],
  ["Urea", "urea", "ureaDate"],
  ["Creatinine", "creatinine", "creatinineDate"],
  ["GFR", "gfr", "gfrDate"],
  ["Albumin", "albumin", "albuminDate"],
  ["Sodium", "sodium", "sodiumDate"],
  ["Potassium", "potassium", "potassiumDate"],
  ["Vitamin B12", "vitaminB12", "vitaminB12Date"],
  ["Ferritin", "ferritin", "ferritinDate"],
  ["Hemoglobin A1C", "hemoglobinA1C", "hemoglobinA1CDate"],
  ["Urine Albumin", "urineAlbumin", "urineAlbuminDate"],
  ["Albumin/Creatinine Ratio", "albuminCreatinineRatio", "albuminCreatinineRatioDate"],
];

// value truthiness helper (keeps 0)
const hasVal = (v) =>
  !(v === null || v === undefined || (typeof v === "string" && v.trim() === ""));

// detect if a history row “exists” for a lab (even if blank value)
const rowHasLabFields = (row, valueField, dateField) =>
  !!row &&
  (Object.prototype.hasOwnProperty.call(row, valueField) ||
    Object.prototype.hasOwnProperty.call(row, dateField));

// best-effort reader for a history row ID
const readHistId = (row) =>
  String(row?.historyId ?? row?.historyID ?? row?.ID ?? row?.id ?? "");

// ────────────────────────────────────────────────────────────
// Private-mode helpers
// ────────────────────────────────────────────────────────────
const demoPatientLabel = (healthNumber) => {
  const digits = String(healthNumber || "").replace(/\D/g, "");
  const first4 = digits.slice(0, 4) || "XXXX";
  return `Patient ${first4}`;
};
const maskHealthNumber3 = (hcn) => {
  const digits = String(hcn || "").replace(/\D/g, "");
  if (!digits) return hcn || "—";
  const first3 = digits.slice(0, 3);
  const last4 = digits.slice(-4);
  return `${first3} XXX ${last4}`;
};

const DisplayPatientHistory = () => {
  const { activePatient, privateMode } = useGlobalContext();
  const [historyArray, setHistoryArray] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalMeta, setModalMeta] = useState(null); // { label, valueField, dateField }

  // Editable rows in modal
  const [originalRows, setOriginalRows] = useState([]); // [{id, date, value}]
  const [editRows, setEditRows] = useState([]);         // same shape, user-edited

  const isPrivate = Boolean(privateMode);

  // Central loader you can call from anywhere


  const [user, setUser] = React.useState(null);
  const [patientDB, setPatientDB] = useState("");
  const [historyDB, setHistoryDB] = useState("");
  const dbReady = Boolean(patientDB && historyDB);
  const [reloadTick, setReloadTick] = useState(0);


  useEffect(() => {
    const fetchUser = async () => {
      const userData = await getUserFromToken();
      return userData;
    };

    fetchUser().then((userT) => {
      if (userT && userT.dayOfWeek) {
        setUser(userT);
        console.log('User data:', userT);
        setPatientDB(userT.patientTable);
        setHistoryDB(userT.historyTable);
        console.log('User data:', userT);
      }
    });
  }, []);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      try {
        const res = await fetch(CAT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: "getHistory",
            patientID: activePatient?.id,
            hcn: activePatient?.healthNumber,
            patientDB: patientDB,
            historyDB: historyDB
          }),
        });
        const text = await res.text();
        let data = null;
        try {
          data = JSON.parse(text);
        } catch { }
        const payload = Array.isArray(data) ? data : [];
        setHistoryArray(payload);
      } catch {
        setHistoryArray([]);
      } finally {
        setLoading(false);
      }
    };

    if (activePatient?.id && dbReady) {
      fetchHistory();
    }
  }, [activePatient?.id, dbReady, patientDB, historyDB, reloadTick]);




  // 1) valueCounts: how many entries have a VALUE (for the (N) badge)
  // 2) rowCounts: how many rows “exist” for that lab (enables Show History even if all values blank)
  const { valueCounts, rowCounts } = useMemo(() => {
    const v = {};
    const r = {};
    for (const [, valueField, dateField] of LABS) {
      v[valueField] = (historyArray || []).reduce(
        (acc, row) => acc + (hasVal(row?.[valueField]) ? 1 : 0),
        0
      );
      r[valueField] = (historyArray || []).reduce(
        (acc, row) => acc + (rowHasLabFields(row, valueField, dateField) ? 1 : 0),
        0
      );
    }
    return { valueCounts: v, rowCounts: r };
  }, [historyArray]);

  // Open modal for a lab
  const openHistory = (label, valueField, dateField) => {
    setModalMeta({ label, valueField, dateField });

    // Include ALL rows that have fields for this lab, even if the value is blank
    const base = (historyArray || [])
      .filter((row) => rowHasLabFields(row, valueField, dateField))
      .map((row) => ({
        id: readHistId(row),
        date: row?.[dateField] ?? "",
        value: row?.[valueField] ?? "",
      }))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    setOriginalRows(base);
    setEditRows(base.map((r) => ({ ...r }))); // shallow copy for editing
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setModalMeta(null);
    setOriginalRows([]);
    setEditRows([]);
  };

  // Map of original rows by ID (for diff)
  const originalById = useMemo(() => {
    const m = new Map();
    for (const r of originalRows) m.set(r.id, r);
    return m;
  }, [originalRows]);

  // Detect changed rows
  const changed = useMemo(
    () => editRows.filter((r) => (originalById.get(r.id)?.value ?? "") !== r.value),
    [editRows, originalById]
  );

  const onEditValue = (idx, nextVal) => {
    setEditRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], value: nextVal };
      return next;
    });
  };

  // Save -> POST changes -> reload -> close
  const saveModal = async () => {
    if (!modalMeta) return;
    const payload = changed.map((row) => ({
      historyId: row.id,
      field: modalMeta.valueField,
      oldValue: originalById.get(row.id)?.value ?? "",
      newValue: row.value,
      patientId: activePatient?.id ?? null,
    }));

    try {
      await fetch(CAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "saveHistoryValues",
          payload,
          patientDB: patientDB,
          historyDB: historyDB
        }),
      });
      // Refresh the grid/counters with latest server data
      setReloadTick(t => t + 1);
      closeModal();
    } catch {
      // optional: toast error
      closeModal();
    }
  };

  if (!activePatient?.id) {
    return <div className="text-muted">No patient selected.</div>;
  }

  // ────────────────────────────────────────────────────────────
  // Private-safe header display
  // ────────────────────────────────────────────────────────────
  const realName =
    activePatient?.clientName ||
    activePatient?.name ||
    (activePatient?.firstName && activePatient?.lastName
      ? `${activePatient.firstName} ${activePatient.lastName}`
      : activePatient?.lastFirstName) ||
    "—";

  const headerName = isPrivate
    ? demoPatientLabel(activePatient?.healthNumber)
    : realName;

  const headerHCN = isPrivate
    ? maskHealthNumber3(activePatient?.healthNumber)
    : (activePatient?.healthNumber || "—");

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center mb-2">
        <h5 className="mb-0">Patient History</h5>
        {loading && <span className="badge bg-info text-dark ms-2">Loading…</span>}
        <div className="ms-auto small text-muted">
          {headerName} — {headerHCN}
        </div>
      </div>

      {/* Grid: one row per lab with Show History (N) */}
      <div className="row g-2">
        {LABS.map(([label, valueField, dateField]) => (
          <div key={valueField} className="col-24">
            <div className="border rounded p-2 d-flex align-items-center justify-content-between">
              <div className="fw-semibold">{label}</div>
              <button
                type="button"
                className={`btn btn-sm ${valueCounts[valueField] > 0
                  ? "btn-outline-primary fw-bold"
                  : "btn-outline-secondary"
                  }`}
                style={{ width: "200px" }}
                onClick={() => openHistory(label, valueField, dateField)}
                disabled={rowCounts[valueField] === 0}
                title={
                  valueCounts[valueField]
                    ? `Show ${valueCounts[valueField]} entr${valueCounts[valueField] === 1 ? "y" : "ies"
                    }`
                    : rowCounts[valueField] > 0
                      ? "All entries are blank — click to edit"
                      : "No history"
                }
              >
                Show History
                {valueCounts[valueField] ? ` (${valueCounts[valueField]})` : ""}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <div
        className={`modal fade ${showModal ? "show d-block" : ""}`}
        tabIndex="-1"
        role="dialog"
        aria-modal={showModal ? "true" : "false"}
        aria-hidden={showModal ? "false" : "true"}
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content shadow">
            <div className="modal-header">
              <h5 className="modal-title">
                {modalMeta ? `History: ${modalMeta.label}` : "History"}
              </h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowModal(false)}
                aria-label="Close"
              />
            </div>
            <div className="modal-body">
              {editRows.length === 0 ? (
                <div className="text-muted">No history rows for this lab.</div>
              ) : (
                <div className="table-responsive">
                  {/* Custom div-based grid for history rows */}
                  <div className="d-flex flex-column">
                    {/* Header */}
                    <div
                      className="d-flex border-bottom pb-2 mb-2"
                      style={{ fontWeight: "bold" }}
                    >
                      <div className="col-12">Date</div>
                      <div className="col-5 text-center">Value</div>
                      <div className="ms-auto d-flex flex-grow-1 justify-content-end">
                        <div className="col-12 text-center">Lab</div>
                        <div className="col-12 text-center offset-1">Re-Scan</div>
                      </div>
                    </div>
                    {/* Rows */}
                    {editRows.map((e, i) => (
                      <div
                        key={e.id || i}
                        className="d-flex align-items-center mb-1"
                      >
                        <div className="col-12">{e.date || "—"}</div>
                        <div className="col-5">
                          <input
                            className="form-control form-control-sm"
                            value={e.value}
                            onChange={(ev) => onEditValue(i, ev.target.value)}
                            placeholder="Value"
                          />
                        </div>
                        <div className="ms-auto d-flex flex-grow-1 justify-content-end">
                          <div className="col-12 text-center">Soon</div>
                          <div className="col-12 text-center offset-1">Soon</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                className={`btn ${changed.length ? "btn-warning" : "btn-primary"}`}
                onClick={saveModal}
                disabled={!changed.length}
                title={changed.length ? "Save changes" : "No changes"}
              >
                {changed.length ? `Save (${changed.length})` : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
      {showModal && <div className="modal-backdrop fade show" onClick={() => setShowModal(false)} />}
    </div>
  );
};

export default DisplayPatientHistory;
