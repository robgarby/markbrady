// src/components/Patient/medBoxComplete.component.jsx
import React, { use, useEffect, useMemo, useRef, useState } from "react";
import { useGlobalContext } from "../../../Context/global.context"; // adjust path if needed
import MedsAdminPanel from "../../../components/Admin/editMedications.component.jsx"; // your existing admin UI

const API_URL = "https://gdmt.ca/PHP/special.php";

const norm = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();
const unique = (arr) => [...new Set((arr || []).filter(Boolean))];

const readMasterId   = (m) => String(m?.ID ?? m?.id ?? "");
const readMasterName = (m) => String(m?.medication_name ?? m?.medication ?? m?.name ?? "");
const readMasterDose = (m) => String(m?.medication_dose ?? m?.defaultDose ?? m?.dose ?? "");
const readMasterCat  = (m) => String(m?.medication_cat ?? m?.category ?? "");

const parseIdCSV = (str) => (str || "").split(",").map((t) => t.trim()).filter(Boolean);
const serializeIdCSV = (ids) => (ids || []).map((x) => String(x).trim()).filter(Boolean).join(",");

const MedBoxComplete = ({ user }) => {
  const {
    activePatient,
    setActivePatient,
    medsArray,
    updateMedsArray,
  } = useGlobalContext() || {};

  useEffect(() => {
 console.log("MedBoxComplete: user changed:", user);
  }, [user]);

  // --- Admin session state ---
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminDraft, setAdminDraft] = useState(() => Array.isArray(medsArray) ? [...medsArray] : []);

  // Initialize draft when entering admin
  const openAdmin = () => {
    setAdminDraft(Array.isArray(medsArray) ? JSON.parse(JSON.stringify(medsArray)) : []);
    setShowAdmin(true);
  };
  const cancelAdmin = () => {
    setShowAdmin(false); // discard draft
  };
  const saveAdmin = () => {
    if (typeof updateMedsArray === "function") {
      updateMedsArray(adminDraft); // commit master meds list
    }
    setShowAdmin(false);
  };

  // --- Master lookups ---
  const master = Array.isArray(medsArray) ? medsArray : [];
  const masterById = useMemo(() => {
    const m = new Map();
    for (const row of master) m.set(readMasterId(row), row);
    return m;
  }, [master]);
  const masterByName = useMemo(() => {
    const m = new Map();
    for (const row of master) m.set(norm(readMasterName(row)), row);
    return m;
  }, [master]);

  // --- Patient meds (CSV of IDs) ---
  const [medIds, setMedIds] = useState(() => parseIdCSV(activePatient?.medsData));
  const lastPidRef = useRef(activePatient?.id ?? null);
  useEffect(() => {
    const id = activePatient?.id ?? null;
    if (id !== lastPidRef.current) {
      lastPidRef.current = id;
      setMedIds(parseIdCSV(activePatient?.medsData));
    }
  }, [activePatient?.id]); // keep in sync on patient switch

  const rows = useMemo(() => {
    return (medIds || []).map((id) => {
      const m = masterById.get(String(id));
      return {
        id: String(id),
        name: readMasterName(m) || "(Unknown)",
        category: readMasterCat(m) || "No Category",
        dose: readMasterDose(m) || "No dose",
      };
    });
  }, [medIds, masterById]);

  // --- Add box state ---
  const nameRef = useRef(null);
  const [nameQ, setNameQ] = useState("");
  const [doseQ, setDoseQ] = useState("");
  const [catQ, setCatQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const medNameOptions = useMemo(
    () => unique(master.map(readMasterName).filter(Boolean)),
    [master]
  );
  const pickedExisting = useMemo(
    () => masterByName.get(norm(nameQ)) || null,
    [nameQ, masterByName]
  );

  // --- Persist patient meds CSV to server + context ---
  const commitPatientMeds = (nextIds, reason = "add") => {
    const idsCSV = serializeIdCSV(nextIds);
    const patientId = activePatient?.id;
    if (!patientId) return;

    // Update UI/context
    setMedIds(nextIds);
    if (typeof setActivePatient === "function") {
      setActivePatient({ ...(activePatient || {}), medsData: idsCSV });
    }

    // Save to DB (idempotent full CSV)
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        script: "SaveMedication",
        patientId,
        medId: nextIds[nextIds.length - 1] || "", // last added (for auditing)
        medIdsCSV: idsCSV,
        patientDB: user?.patientTable || "Patient",
        historyDB: user?.historyTable || "Patient_History",
      }),
    }).catch(() => {});
  };

  // --- Add existing from master ---
  const addExisting = (m) => {
    const id = readMasterId(m);
    const patientId = activePatient?.id || null;
    if (!patientId || !id) return;

    const currentIds = parseIdCSV(activePatient?.medsData);
    if (currentIds.includes(String(id))) {
      setNameQ(""); setDoseQ(""); setCatQ("");
      nameRef.current?.focus();
      return;
    }
    const nextIds = unique([...currentIds, String(id)]);
    commitPatientMeds(nextIds, "add-existing");
    setNameQ(""); setDoseQ(""); setCatQ("");
    nameRef.current?.focus();
  };

  // --- Create in master, then add to patient ---
  const createAndAdd = async (name, category, dose) => {
    if (!name.trim()) return;
    const patientId = activePatient?.id || null;
    if (!patientId) return;

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
      try { payload = JSON.parse(text); } catch {}
      if (!res.ok || !payload?.success || !payload?.med?.ID) {
        throw new Error(payload?.error || "Create failed");
      }

      const newRow = payload.med; // {ID, medication_name, medication_cat, medication_dose}
      const newId = readMasterId(newRow);
      if (!newId) throw new Error("No ID returned");

      // We DO NOT immediately update medsArray here while in user mode.
      // (Admin updates happen only through the Admin Panel Save.)
      // Still, the patient add can proceed using the returned ID:
      const next = unique([...(parseIdCSV(activePatient?.medsData)), String(newId)]);
      commitPatientMeds(next, "create-and-add");

      setMsg("Medication created and added.");
      setNameQ(""); setDoseQ(""); setCatQ("");
      nameRef.current?.focus();
    } catch (e) {
      setMsg(e?.message || "Error creating medication.");
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  // --- Remove from patient ---
  const removeMedication = (medId) => {
    const patientId = activePatient?.id || null;
    if (!patientId) return;

    const idStr = String(medId);
    const currentIds = parseIdCSV(activePatient?.medsData);
    const nextIds = currentIds.filter((id) => String(id) !== idStr);

    setMedIds(nextIds);
    if (typeof setActivePatient === "function") {
      setActivePatient({ ...(activePatient || {}), medsData: serializeIdCSV(nextIds) });
    }

    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        script: "SaveMedication",
        patientId,
        medId: idStr,
        medIdsCSV: serializeIdCSV(nextIds),
        patientDB: user?.patientTable || "Patient",
        historyDB: user?.historyTable || "Patient_History",
      }),
    }).catch(() => {});
  };

  return (
    <div className="d-flex flex-column fs-7" style={{ position: "relative", maxHeight: 500, overflowY: "auto" }}>
      {/* Header bar */}
      <div className="d-flex align-items-center mb-2">
        <div className="fw-bold">Medications</div>
        <div className="ms-auto d-flex gap-2">
          {!showAdmin ? (
            parseInt(user?.dayOfWeek) === 1 && (
              <button type="button" className="btn btn-sm btn-outline-warning" onClick={openAdmin}>
                Admin Panel
              </button>
            )
          ) : (
            <>
              <button type="button" className="btn btn-sm btn-success" onClick={saveAdmin}>
                Save
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={cancelAdmin}>
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {/* When Admin is open, HIDE the add/list UI */}
      {!showAdmin && (
        <>
          {/* Add Med Box */}
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
                      value={readMasterCat(pickedExisting) || "No Category"}
                      readOnly
                    />
                  </div>
                  <div className="col-6">
                    <label className="form-label mb-1">Dose</label>
                    <input
                      className="form-control fs-7"
                      value={readMasterDose(pickedExisting) || "No dose"}
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

          {/* Patient med list */}
          <div className="container-fluid px-1">
            <div className="row g-2">
              {rows.map((r, idx) => (
                <div key={`med_${r.id}_${idx}`} className="col-48">
                  <div className="border rounded p-1 d-flex align-items-center">
                    <div className="fw-semibold text-truncate col-18 text-start ps-2" title={r.name}>
                      {r.name}
                    </div>
                    <div className="text-muted small text-truncate col-18 text-start ps-2" title={r.category}>
                      {r.category}
                    </div>
                    <div className="small text-truncate col-6 ps-2" title={r.dose}>
                      {r.dose}
                    </div>
                    <div className="col-6 text-end pe-2">
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm ms-2"
                        onClick={() => removeMedication(r.id)}
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
            </div>
          </div>
        </>
      )}

      {/* Admin Panel (visible only during admin session). 
          We pass both a value and a setter so your panel can edit the draft list.
          On Save: the header's Save button commits draft -> updateMedsArray.
      */}
      {showAdmin && (
        <div className="mt-2">
          <MedsAdminPanel
            value={adminDraft}
            setValue={setAdminDraft}
            onChange={setAdminDraft}
          />
        </div>
      )}
    </div>
  );
};

export default MedBoxComplete;
