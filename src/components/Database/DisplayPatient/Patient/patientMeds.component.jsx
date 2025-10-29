// src/components/Patient/patientMeds.component.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGlobalContext } from "../../../../Context/global.context";
import { getUserFromToken } from '../../../../Context/functions';

// ---------- Helpers (ID-based) ----------
const norm = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();
const unique = (arr) => [...new Set((arr || []).filter(Boolean))];

const readMasterId = (m) => String(m?.ID ?? m?.id ?? "");
const readMasterName = (m) => String(m?.medication_name ?? m?.medication ?? m?.name ?? "");
const readMasterDose = (m) => String(m?.medication_dose ?? m?.defaultDose ?? m?.dose ?? "");
const readMasterCat = (m) => String(m?.medication_cat ?? m?.category ?? "");

// CSV of IDs <-> array
const parseIdCSV = (str) =>
  (str || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

const serializeIdCSV = (ids) => (ids || []).map((x) => String(x).trim()).filter(Boolean).join(",");

const PatientMeds = () => {
  const gc = useGlobalContext() || {};
  const {
    activePatient,
    setActivePatient,
    medsArray,
    updateMedsArray,
    updateMedsCategory,
  } = gc;

  // -------- Master indexes (by ID & by normalized name) --------
  const master = Array.isArray(medsArray) ? medsArray : [];
  const masterById = useMemo(() => {
    const map = new Map();
    for (const m of master) map.set(readMasterId(m), m);
    return map;
  }, [master]);
  const masterByName = useMemo(() => {
    const map = new Map();
    for (const m of master) map.set(norm(readMasterName(m)), m);
    return map;
  }, [master]);

  // -------- Patient state: ids (strings) --------
  const [medIds, setMedIds] = useState(() => parseIdCSV(activePatient?.medsData));
  const lastIdRef = useRef(activePatient?.id ?? null);

  const [user, setUser] = React.useState(null);
  const [patientDB, setPatientDB] = useState(null);
  const [historyDB, setHistoryDB] = useState(null);
  useEffect(() => {
    const fetchUser = async () => {
      const userData = await getUserFromToken();
      return userData;
    };
    fetchUser().then((userT) => {
      if (userT) {
        setUser(userT);
        setPatientDB(userT.patientTable);
        setHistoryDB(userT.historyTable);
      }
    });
  }, []);

  useEffect(() => {
    const id = activePatient?.id ?? null;
    if (id !== lastIdRef.current) {
      lastIdRef.current = id;
      setMedIds(parseIdCSV(activePatient?.medsData));
    }
  }, [activePatient?.id]); // eslint-disable-line

  // -------- Load masters if empty (IDs + cats) --------
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    const need = !Array.isArray(medsArray) || medsArray.length === 0;
    if (!need || !updateMedsArray) return;

    loadedRef.current = true;
    fetch("https://gdmt.ca/PHP/noDB.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: "getMeds" }), // should return [{ID, medication_name, medication_cat, medication_dose}, ...]
    })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data?.meds) ? data.meds : Array.isArray(data) ? data : [];
        updateMedsArray(list);

        // categories if you need them for "new med" creation UX
        if (updateMedsCategory && Array.isArray(data?.cats)) updateMedsCategory(data.cats);
      })
      .catch(() => {
        loadedRef.current = false;
      });
  }, [medsArray?.length]); // DO NOT CHANGE

  // -------- Derived rows for display (join IDs -> master) --------
  const rows = useMemo(() => {
    return (medIds || []).map((id) => {
      const m = masterById.get(String(id));
      return {
        id: String(id),
        name: readMasterName(m) || "(Unknown)",
        category: readMasterCat(m) || "No Category",
        dose: readMasterDose(m) || "No dose",
        _raw: m,
      };
    });
  }, [medIds, masterById]);

  // -------- Suggestions (from master names) --------
  const medNameOptions = useMemo(() => unique(master.map(readMasterName).filter(Boolean)), [master]);

  // -------- Persist patient meds (IDs) --------
  const persistIds = (nextIds, reason = "auto") => {
    const idsCSV = serializeIdCSV(nextIds);

    // Mirror to activePatient
    const nextPatient = { ...(activePatient || {}), medsData: idsCSV };
    if (typeof setActivePatient === "function") setActivePatient(nextPatient);

    // Save to DB (IDs)
    saveClientMedIdsToDB(nextPatient.id, idsCSV);
  };

  const saveClientMedIdsToDB = (patientId, idsCSV) => {
    if (!patientId) return;
    fetch("https://gdmt.ca/PHP/special.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        script: "updateClientMedIds", // <-- update your PHP to expect ID CSV now
        patientId,
        medIds: idsCSV,
        patientDB: patientDB,
        historyDB: historyDB
      }),
    }).catch(() => { });
  };

  // -------- Add UI (by selecting an existing med OR creating one then adding) --------
  const nameRef = useRef(null);
  const [nameQ, setNameQ] = useState("");
  const [doseQ, setDoseQ] = useState("");
  const [catQ, setCatQ] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const pickedExisting = useMemo(() => masterByName.get(norm(nameQ)) || null, [nameQ, masterByName]);

  const addExisting = (m) => {
    const id = readMasterId(m);
    const patientId = activePatient?.id || null;
    if (!patientId || !id) return;

    // Read current medData CSV and parse to array
    const currentMedIds = (activePatient?.medsData || "").split(",").map((t) => t.trim()).filter(Boolean);

    // If already exists, do nothing
    if (currentMedIds.includes(String(id))) {
      setNameQ("");
      setDoseQ("");
      setCatQ("");
      nameRef.current?.focus();
      return;
    }

    // Add new ID and serialize back to CSV
    const nextMedIds = unique([...currentMedIds, String(id)]);
    const nextMedData = serializeIdCSV(nextMedIds);

    // Send to DB (fire and forget)
    fetch("https://gdmt.ca/PHP/special.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        script: "updateClientMedIds",
        patientId,
        medIds: nextMedData,
        patientDB: patientDB,
        historyDB: historyDB
      }),
    }).catch(() => { });

    // Update local state/UI
    setMedIds(nextMedIds);
    if (typeof setActivePatient === "function") {
      setActivePatient({ ...(activePatient || {}), medsData: nextMedData });
    }
    setNameQ("");
    setDoseQ("");
    setCatQ("");
    nameRef.current?.focus();
  };

  // Create in master then add ID to patient
  const createAndAdd = async (name, category, dose) => {
    if (!name.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch("https://gdmt.ca/PHP/special.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "insertMedicationReturnId", // make this return new { ID, ... } please
          medication_name: name,
          medication_cat: category,
          medication_dose: dose,
          patientDB: patientDB,
          historyDB: historyDB
        }),
      });
      const text = await res.text();
      let payload = null;
      try { payload = JSON.parse(text); } catch { }
      const newRow = payload?.med || payload; // tolerate {med:{ID,...}} or direct object
      const id = readMasterId(newRow);
      if (!id) throw new Error("No ID returned for new medication");

      // update master list so UI can resolve immediately
      if (typeof updateMedsArray === "function") {
        updateMedsArray((prev) => [...(Array.isArray(prev) ? prev : []), newRow]);
      }

      // add to patient by ID
      setMedIds((prev) => {
        const next = unique([...(prev || []), String(id)]);
        persistIds(next, "create-and-add");
        return next;
      });

      setNameQ("");
      setDoseQ("");
      setCatQ("");
      nameRef.current?.focus();
    } catch (e) {
      console.error(e);
      // optional: toast error
    } finally {
      setIsSaving(false);
    }
  };

  // Replace the existing removeMedication with this ID-based version
  const removeMedication = (medId) => {
    const patientId = activePatient?.id || null;
    if (!patientId) return;

    const idStr = String(medId);

    // 1) Read current CSV from activePatient
    const currentMedIds = parseIdCSV(activePatient?.medsData);

    // 2) Remove this ID
    const nextMedIds = currentMedIds.filter((id) => String(id) !== idStr);
    const nextMedData = serializeIdCSV(nextMedIds);

    // 3) Update local UI/state
    setMedIds(nextMedIds);
    if (typeof setActivePatient === "function") {
      setActivePatient({ ...(activePatient || {}), medsData: nextMedData });
    }

    // 4) Fire-and-forget to backend
    fetch("https://gdmt.ca/PHP/special.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        script: "updateClientMedIds",   // backend expects CSV of IDs now
        patientId,
        medIds: nextMedData,
        patientDB: patientDB,
        historyDB: historyDB
      }),
    }).catch(() => { });
  };


  // -------- UI --------
  return (
    <div className="d-flex flex-column fs-7" style={{ position: "relative" }}>
      {/* Top box */}
      <div className="border rounded p-2 mb-2 position-relative">
        <div className="row g-2 align-items-end">
          {/* Name selector (typeahead-ish) */}
          <div className="col-18">
            <label className="form-label mb-1">Medication</label>
            <input
              ref={nameRef}
              type="text"
              className="form-control fs-7"
              value={nameQ}
              onChange={(e) => setNameQ(e.target.value)}
              placeholder="Type to search master meds…"
              list="patient-meds-name-datalist"
            />
            <datalist id="patient-meds-name-datalist">
              {medNameOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>

          {/* If the typed name matches a master med, we show its cat/dose (read-only) and an Add button */}
          {pickedExisting ? (
            <>
              <div className="col-12">
                <label className="form-label mb-1">Category</label>
                <input className="form-control fs-7" value={readMasterCat(pickedExisting) || "No Category"} readOnly />
              </div>
              <div className="col-6">
                <label className="form-label mb-1">Dose</label>
                <input className="form-control fs-7" value={readMasterDose(pickedExisting) || "No dose"} readOnly />
              </div>
              <div className="flex-grow-1 d-flex align-items-end">
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
            // Otherwise, allow creating a new master med, then add by its new ID
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
                  disabled={isSaving || !nameQ.trim()}
                  title={isSaving ? "Saving…" : "Create"}
                >
                  {isSaving ? "Saving…" : "Create"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Read-only list (joined from IDs) */}
      <div style={{ overflowY: "auto", maxHeight: "60vh" }}>
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
      </div>
    </div>
  );
};

export default PatientMeds;
