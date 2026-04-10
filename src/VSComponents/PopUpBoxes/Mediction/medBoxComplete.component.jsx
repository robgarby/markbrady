// src/components/Patient/medBoxComplete.component.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGlobalContext } from "../../../Context/global.context";

const API_URL = "https://gdmt.ca/PHP/special.php";

const norm = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();
const unique = (arr) => [...new Set((arr || []).filter(Boolean))];

const readMasterId = (m) => String(m?.ID ?? m?.id ?? "").trim();
const readMasterDIN = (m) => String(m?.DIN ?? m?.din ?? "").trim();
const readMasterName = (m) =>
  String(m?.medication_name ?? m?.medication ?? m?.name ?? "").trim();
const readMasterDose = (m) =>
  String(m?.medication_dose ?? m?.defaultDose ?? m?.dose ?? "").trim();
const readMasterCat = (m) =>
  String(m?.medication_cat ?? m?.category ?? "").trim();
const readMasterBrand = (m) =>
  String(m?.medication_brand ?? m?.brand ?? "").trim();
const readMasterPoints = (m) =>
  Number(m?.medPoints ?? m?.points ?? m?.catPoints ?? 0);

const parseCSV = (str) =>
  String(str || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

const serializeCSV = (vals) =>
  (vals || [])
    .map((x) => String(x).trim())
    .filter(Boolean)
    .join(",");

const MedBoxComplete = ({ user }) => {
  const { activePatient, setActivePatient, medsArray } = useGlobalContext() || {};

  const master = Array.isArray(medsArray) ? medsArray : [];

  const masterById = useMemo(() => {
    const m = new Map();
    for (const row of master) {
      const id = readMasterId(row);
      if (id) m.set(id, row);
    }
    return m;
  }, [master]);

  const masterByDIN = useMemo(() => {
    const m = new Map();
    for (const row of master) {
      const din = readMasterDIN(row);
      if (din) m.set(din, row);
    }
    return m;
  }, [master]);

  const masterByName = useMemo(() => {
    const m = new Map();
    for (const row of master) {
      const name = norm(readMasterName(row));
      if (name) m.set(name, row);
    }
    return m;
  }, [master]);

  const [medDins, setMedDins] = useState(() => parseCSV(activePatient?.medsData));
  const lastPidRef = useRef(activePatient?.id ?? null);

  useEffect(() => {
    const id = activePatient?.id ?? null;
    if (id !== lastPidRef.current) {
      lastPidRef.current = id;
      setMedDins(parseCSV(activePatient?.medsData));
    }
  }, [activePatient?.id, activePatient?.medsData]);

  const rows = useMemo(() => {
    return (medDins || []).map((din) => {
      const dinStr = String(din).trim();

      let m = masterByDIN.get(dinStr);
      if (!m) m = masterById.get(dinStr);

      return {
        din: dinStr,
        id: readMasterId(m) || "",
        name: readMasterName(m) || "(Unknown)",
        category: readMasterCat(m) || "unknown",
        dose: readMasterDose(m) || "",
        brand: readMasterBrand(m) || "unknown",
        pts: readMasterPoints(m) || 0,
      };
    });
  }, [medDins, masterByDIN, masterById]);

  const totalPts = useMemo(() => {
    return (rows || []).reduce((sum, r) => sum + Number(r.pts ?? 0), 0);
  }, [rows]);

  const nameRef = useRef(null);
  const [nameQ, setNameQ] = useState("");
  const [doseQ, setDoseQ] = useState("");
  const [catQ, setCatQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [msg, setMsg] = useState("");

  const medNameOptions = useMemo(
    () => unique(master.map(readMasterName).filter(Boolean)),
    [master]
  );

  const pickedExisting = useMemo(
    () => masterByName.get(norm(nameQ)) || null,
    [nameQ, masterByName]
  );

  const commitPatientMeds = (nextDins, auditMed = null) => {
    const patientId = activePatient?.id;
    if (!patientId) return;

    const dinsCSV = serializeCSV(nextDins);

    setMedDins(nextDins);

    if (typeof setActivePatient === "function") {
      setActivePatient({
        ...(activePatient || {}),
        medsData: dinsCSV,
      });
    }

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        script: "SaveMedication",
        patientId,
        medId: readMasterId(auditMed) || "",
        din: readMasterDIN(auditMed) || "",
        medIdsCSV: dinsCSV,
        medsData: dinsCSV,
        patientDB: user?.patientTable || "Patient",
        historyDB: user?.historyTable || "Patient_History",
      }),
    }).catch(() => {});
  };

  const addExisting = (m) => {
    const patientId = activePatient?.id || null;
    const din = readMasterDIN(m);
    if (!patientId || !din) return;

    const currentDins = parseCSV(activePatient?.medsData);
    if (currentDins.includes(din)) {
      setNameQ("");
      setDoseQ("");
      setCatQ("");
      nameRef.current?.focus();
      return;
    }

    const nextDins = unique([...currentDins, din]);
    commitPatientMeds(nextDins, m);

    setNameQ("");
    setDoseQ("");
    setCatQ("");
    nameRef.current?.focus();
  };

  const createAndAdd = async (name, category, dose) => {
    const patientId = activePatient?.id || null;
    if (!patientId || !name.trim()) return;

    setSaving(true);
    setMsg("");

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "CreateMedication",
          medication_name: name.trim(),
          medication_cat: category.trim(),
          medication_dose: dose.trim(),
        }),
      });

      const text = await res.text();
      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {}

      if (!res.ok || !payload?.success || !payload?.med) {
        throw new Error(payload?.error || "Create failed");
      }

      const newRow = payload.med;
      const newDIN = readMasterDIN(newRow);

      if (!newDIN) {
        throw new Error("Medication created but no DIN was returned.");
      }

      const next = unique([...parseCSV(activePatient?.medsData), newDIN]);
      commitPatientMeds(next, newRow);

      setMsg("Medication created and added.");
      setNameQ("");
      setDoseQ("");
      setCatQ("");
      nameRef.current?.focus();
    } catch (e) {
      setMsg(e?.message || "Error creating medication.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const removeMedication = (dinIn) => {
    const patientId = activePatient?.id || null;
    if (!patientId) return;

    const dinStr = String(dinIn).trim();
    const currentDins = parseCSV(activePatient?.medsData);
    const nextDins = currentDins.filter((din) => String(din).trim() !== dinStr);

    setMedDins(nextDins);

    if (typeof setActivePatient === "function") {
      setActivePatient({
        ...(activePatient || {}),
        medsData: serializeCSV(nextDins),
      });
    }

    const matched = masterByDIN.get(dinStr) || null;

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        script: "SaveMedication",
        patientId,
        medId: readMasterId(matched) || "",
        din: dinStr,
        medIdsCSV: serializeCSV(nextDins),
        medsData: serializeCSV(nextDins),
        patientDB: user?.patientTable || "Patient",
        historyDB: user?.historyTable || "Patient_History",
      }),
    }).catch(() => {});
  };

  const recalculateCurrentPatientPoints = async () => {
    const patientId = Number(activePatient?.id ?? 0);
    if (!patientId || recalculating) return;

    setRecalculating(true);
    setMsg("Re-calculating points...");

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "recalculateSinglePatientPoints",
          patientId,
          patientDB: user?.patientTable || "Patient",
        }),
      });

      const text = await res.text();

      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error("Backend did not return valid JSON.");
      }

      if (!res.ok || payload?.success === false) {
        throw new Error(payload?.error || "Re-calculate failed.");
      }

      const rebuiltPoints = Number(payload?.totalPoints ?? 0);

      if (typeof setActivePatient === "function") {
        setActivePatient({
          ...(activePatient || {}),
          totalPoints: rebuiltPoints,
        });
      }

      setMsg(`Points re-calculated: ${rebuiltPoints} Pts`);
    } catch (e) {
      console.error("recalculateSinglePatientPoints failed:", e);
      setMsg(e?.message || "Failed to re-calculate points.");
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div
      className="d-flex flex-column fs-7"
      style={{ position: "relative", maxHeight: 500, overflowY: "auto" }}
    >
      <div className="d-flex align-items-center mb-2">
        <div className="fw-bold">Medications</div>
      </div>

      <div className="border rounded p-2 mb-2 position-relative">
        <div className="row g-2 align-items-end">
          <div className="col-18">
            <label className="form-label mb-1">Medication</label>
            <input
              ref={nameRef}
              type="text"
              className="form-control fs-7"
              value={nameQ}
              onChange={(e) => setNameQ(e.target.value)}
              placeholder="Type to search or enter a new name…"
              list="medBoxComplete-name-datalist"
            />
            <datalist id="medBoxComplete-name-datalist">
              {medNameOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          {pickedExisting ? (
            <>
              <div className="col-12">
                <label className="form-label mb-1">Category</label>
                <input
                  className="form-control fs-7"
                  value={readMasterCat(pickedExisting) || "unknown"}
                  readOnly
                />
              </div>
              <div className="col-6">
                <label className="form-label mb-1">Dose</label>
                <input
                  className="form-control fs-7"
                  value={readMasterDose(pickedExisting) || ""}
                  readOnly
                />
              </div>
              <div className="col-9 d-flex align-items-end">
                <button
                  type="button"
                  className="btn btn-outline-primary w-100 fs-7"
                  onClick={() => addExisting(pickedExisting)}
                >
                  Add
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="col-12">
                <label className="form-label mb-1">Category</label>
                <input
                  type="text"
                  className="form-control fs-7"
                  value={catQ}
                  onChange={(e) => setCatQ(e.target.value)}
                  placeholder="e.g., Statin"
                />
              </div>
              <div className="col-8">
                <label className="form-label mb-1">Dose</label>
                <input
                  type="text"
                  className="form-control fs-7"
                  value={doseQ}
                  onChange={(e) => setDoseQ(e.target.value)}
                  placeholder="e.g., 20 mg"
                />
              </div>
              <div className="col-9">
                <button
                  type="button"
                  className="btn btn-outline-primary w-100 fs-7"
                  onClick={() => createAndAdd(nameQ.trim(), catQ.trim(), doseQ.trim())}
                  disabled={saving || !nameQ.trim()}
                  title={saving ? "Saving…" : "Create"}
                >
                  {saving ? "Saving…" : "Create & Add"}
                </button>
              </div>
            </>
          )}
        </div>

        {msg && <div className="small text-muted mt-2">{msg}</div>}
      </div>

      <div className="container-fluid px-1">
        <div className="row g-2">
          {rows.map((r, idx) => (
            <div key={`med_${r.din}_${idx}`} className="col-48">
              <div className="border rounded p-1 d-flex align-items-center">
                <div
                  className="fw-semibold text-truncate col-16 text-start ps-2"
                  title={r.name}
                >
                  {r.name}
                </div>

                <div
                  className="text-muted small text-truncate col-12 text-start ps-2"
                  title={r.category}
                >
                  {r.category}
                </div>

                <div
                  className="small text-truncate col-6 ps-2"
                  title={r.dose}
                >
                  {r.dose || "-"}
                </div>

                <div
                  className="small text-truncate col-6 ps-2"
                  title={r.din}
                >
                  {r.din}
                </div>

                <div
                  className="small text-truncate col-4 ps-2 text-center"
                  title={String(r.pts)}
                >
                  {r.pts}
                </div>

                <div className="col-4 text-end pe-2">
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm ms-2"
                    onClick={() => removeMedication(r.din)}
                    aria-label={`Remove ${r.name}`}
                    title={`Remove ${r.name}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))}

          {rows.length === 0 && (
            <div className="col-48 text-muted small">
              <em>No medications yet. Add one above.</em>
            </div>
          )}

          {rows.length > 0 && (
            <div className="col-48">
              <div className="border-top pt-2 mt-1 d-flex justify-content-end align-items-center gap-2 pe-2">
                <div className="fw-bold">{totalPts} Pts</div>
                <button
                  type="button"
                  className="btn btn-outline-primary btn-sm"
                  onClick={recalculateCurrentPatientPoints}
                  disabled={recalculating || !activePatient?.id}
                >
                  {recalculating ? "Re Calculating..." : "Re Calculate"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MedBoxComplete;