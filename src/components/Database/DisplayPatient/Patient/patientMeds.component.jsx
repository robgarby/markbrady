// src/components/Patient/patientMeds.component.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useGlobalContext } from "../../../../Context/global.context";

/**
 * PatientMeds — read-only list + custom suggest boxes (name & category) + auto-save
 * Uses context (DO NOT RENAME/MODIFY):
 *   medsArray: [{ name|medication, defaultDose|medication_dose, category|medication_cat }, ...]
 *   medsCategory: ["No Category", "Statin", ...]  (strings or {name} objects)
 */

// ---------- Helpers ----------
const norm = (s) => (s || "").trim().replace(/\s+/g, " ").toLowerCase();
const unique = (arr) => [...new Set((arr || []).filter(Boolean))];

// Tolerate different DB shapes
const readMedName = (m) =>
  (m?.name ?? m?.medication ?? m?.title ?? m?.label ?? "").toString().trim();
const readMedDose = (m) =>
  (m?.defaultDose ?? m?.medication_dose ?? m?.dose ?? "").toString();
const readMedCategory = (m) =>
  (m?.category ?? m?.medication_cat ?? m?.cat ?? m?.medCategory ?? "").toString().trim();

const readCatName = (c) =>
  (c?.name ?? c?.category ?? c ?? "").toString().trim();

// Parse CSVs -> objects
const parseMeds = (str) => {
  if (!str) return [];
  return str
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => {
      // "Name[dose]" or "Name{dose}"
      const m = t.match(/^\s*([^[\]{},]+?)\s*[\[\{]\s*([^\]\}]*)\s*[\]\}]\s*$/);
      if (m) return { name: m[1].trim(), dose: String(m[2] ?? "").trim(), category: "No Category" };
      // "Name:Category:Dose"
      const parts = t.split(":").map((x) => x.trim());
      if (parts.length >= 3) return { name: parts[0], category: parts[1] || "No Category", dose: parts[2] || "" };
      return { name: t, dose: "", category: "No Category" };
    });
};

// Single CSV serializer: "Name:Category:Dose"
const serializeMedsCSV = (arr) =>
  (arr || [])
    .filter((m) => (m?.name || "").trim())
    .map((m) => `${m.name.trim()}:${(m.category || "No Category").trim()}:${(m.dose || "").toString().trim()}`)
    .join(",");

// ---------- Component ----------
const PatientMeds = () => {
  const gc = useGlobalContext();

  // Context (do not modify names)
  const {
    activePatient,
    setActivePatient,
    medsArray,
    updateMedsArray,
    medsCategory,
    updateMedsCategory,
  } = gc || {};

  // ---------- Local state ----------
  const [medList, setMedList] = useState(() => parseMeds(activePatient?.medsData));
  const lastIdRef = useRef(activePatient?.id ?? null);

  useEffect(() => {
    const id = activePatient?.id ?? null;
    if (id !== lastIdRef.current) {
      lastIdRef.current = id;
      setMedList(parseMeds(activePatient?.medsData ?? activePatient?.medications ?? ""));
    }
  }, [activePatient?.id]); // eslint-disable-line

  // ---------- Load masters if empty (UNCHANGED) ----------
  const loadedMedsRef = useRef(false);
  useEffect(() => {
    if (loadedMedsRef.current) return;
    const need = !Array.isArray(medsArray) || medsArray.length === 0;
    if (!need || !updateMedsArray) return;

    loadedMedsRef.current = true;

    fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: "getMedsArray" }),
    })
      .then((r) => r.json())
      .then((data) => {
        // Expecting { meds: [...], cats: [...] }
        updateMedsArray(data.meds);
        updateMedsCategory(data.cats);
        console.log("PatientMeds> Loaded medsArray from DB:", data.meds);
        console.log("PatientMeds> Loaded medsCategory from DB:", data.cats);
      })
      .catch(() => {
        loadedMedsRef.current = false;
      });
  }, [medsArray?.length]); // DO NOT CHANGE

  // ---------- Suggestions from context ----------
  const medNameOptions = useMemo(() => {
    const list = Array.isArray(medsArray) ? medsArray : [];
    return unique(list.map(readMedName).filter(Boolean));
  }, [medsArray]);

  const catOptions = useMemo(() => {
    const list = Array.isArray(medsCategory) ? medsCategory : [];
    return unique(list.map(readCatName).filter(Boolean));
  }, [medsCategory]);

  // ---------- Name suggestion pool (context + current patient list) ----------
  const [medSuggestArray, setMedSuggestArray] = useState(() => {
    const fromMaster = medNameOptions;
    const fromPatient = (medList || []).map((m) => m?.name || "");
    return unique([...fromMaster, ...fromPatient]);
  });

  const recomputeMedSuggestions = useCallback(() => {
    const fromMaster = medNameOptions;
    const fromPatient = (medList || []).map((m) => m?.name || "");
    setMedSuggestArray(unique([...fromMaster, ...fromPatient]));
  }, [medNameOptions, medList]);

  useEffect(() => {
    recomputeMedSuggestions();
  }, [recomputeMedSuggestions]);

  // ---------- Persist & log ----------
  const persistMeds = (nextList, reason = "auto") => {
    const medsCSV = serializeMedsCSV(nextList);
    const clientCSV = serializeMedsCSV(nextList);

    // mirror to activePatient
    const nextPatient = {
      ...(activePatient || {}),
      medsData: medsCSV,
      clientMedsArray: clientCSV,
    };
    if (typeof setActivePatient === "function") setActivePatient(nextPatient);

    // upsert defaults/category into medsArray (keeps master current)
    if (updateMedsArray) {
      const map = new Map((Array.isArray(medsArray) ? medsArray : []).map((m) => [norm(readMedName(m)), { ...m }]));
      for (const m of nextList) {
        const key = norm(m.name);
        const d = (m.dose || "").toString().trim();
        const cat = (m.category || "").toString().trim();
        if (!key) continue;

        if (map.has(key)) {
          const orig = map.get(key) || {};
          const merged = { ...orig };
          if ("defaultDose" in orig || !("medication_dose" in orig)) merged.defaultDose = d;
          if ("medication_dose" in orig) merged.medication_dose = d;
          if ("category" in orig || !("medication_cat" in orig)) merged.category = cat || orig.category || "";
          if ("medication_cat" in orig) merged.medication_cat = cat || orig.medication_cat || "";
          map.set(key, merged);
        } else {
          map.set(key, { name: m.name, defaultDose: d, category: cat });
        }
      }

      updateMedsArray([...map.values()]);
    }
    saveClientMedsToDB(nextPatient.id, clientCSV);
  };

  const saveClientMedsToDB = (patientId, clientCSV) => {
    if (!patientId) return;
    fetch("https://optimizingdyslipidemia.com/PHP/special.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        script: "updateClientMeds",
        patientId,
        clientMeds: clientCSV,
      }),
    }).catch(() => {
      // swallow network errors (optional: show toast)
    });
  };

  // ---------- Add row (TOP) ----------
  const nameRef = useRef(null);
  const [nameQ, setNameQ] = useState("");
  const [catQ, setCatQ] = useState(""); // empty until typed or auto-filled
  const [doseQ, setDoseQ] = useState("");

  // Locking when user selects an existing medication
  const [lockedFromMaster, setLockedFromMaster] = useState(false);
  const [lockedNameNorm, setLockedNameNorm] = useState("");

  // Submission guards
  const [isSaving, setIsSaving] = useState(false);
  const pendingInsertsRef = useRef(new Set()); // normalized names currently being inserted

  // Suggestions
  const [showNameSuggest, setShowNameSuggest] = useState(false);
  const nameSuggestions = useMemo(() => {
    const q = norm(nameQ);
    if (!q) return [];
    return medSuggestArray.filter((n) => norm(n).includes(q)).slice(0, 10);
  }, [nameQ, medSuggestArray]);

  const pickName = (n) => {
    setNameQ(n);
    const found = (Array.isArray(medsArray) ? medsArray : []).find((m) => norm(readMedName(m)) === norm(n));
    if (found) {
      setDoseQ(readMedDose(found));
      setCatQ(readMedCategory(found) || "No Category");
      setLockedFromMaster(true);
      setLockedNameNorm(norm(n));
    } else {
      setLockedFromMaster(false);
      setLockedNameNorm("");
    }
    setShowNameSuggest(false);
  };

  const [showCatSuggest, setShowCatSuggest] = useState(false);
  const catSuggestions = useMemo(() => {
    const q = norm(catQ);
    if (!q || (lockedFromMaster && norm(nameQ) === lockedNameNorm)) return [];
    return catOptions.filter((n) => norm(n).includes(q)).slice(0, 10);
  }, [catQ, catOptions, lockedFromMaster, nameQ, lockedNameNorm]);

  const pickCategory = (n) => {
    if (lockedFromMaster && norm(nameQ) === lockedNameNorm) return;
    setCatQ(n);
    setShowCatSuggest(false);
  };

  // Handlers
  const onNameChange = (e) => {
    const v = e.target.value;
    setNameQ(v);
    setShowNameSuggest(v.trim().length > 0);
    if (lockedFromMaster && norm(v) !== lockedNameNorm) {
      setLockedFromMaster(false);
      setLockedNameNorm("");
    }
  };

  const onCatChange = (e) => {
    if (lockedFromMaster && norm(nameQ) === lockedNameNorm) return;
    const v = e.target.value;
    setCatQ(v);
    setShowCatSuggest(v.trim().length > 0);
  };

  const onDoseChange = (e) => {
    if (lockedFromMaster && norm(nameQ) === lockedNameNorm) return;
    setDoseQ(e.target.value);
  };

  // --- SINGLE insert path ---
  const saveNewMedicationToDB = (name, category, defaultDose) => {
    return fetch("https://optimizingdyslipidemia.com/PHP/special.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        script: "insertMedication",
        name,
        category,
        defaultDose,
      }),
    });
  };

  const addCatToDB = (category) => {
    return fetch("https://optimizingdyslipidemia.com/PHP/special.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        script: "insertMedicationCategory",
        category,
      }),
    });
  };

  const checkCats = (cat) => {
    const exists = (Array.isArray(medsCategory) ? medsCategory : []).some(
      (c) => norm(readCatName(c)) === norm(cat)
    );
    if (!exists) {
      console.log("This is a new Category, adding to master list:", cat);
      if (typeof updateMedsCategory === "function") {
        updateMedsCategory([...(Array.isArray(medsCategory) ? medsCategory : []), cat]);
      }
      addCatToDB(cat);
    }
  };

  const addMedication = () => {
    const name = (nameQ || "").trim();
    const category = (catQ || "No Category").trim() || "No Category";
    const dose = (doseQ || "").toString().trim();
    if (!name || isSaving) return;

    checkCats(category);

    const normalized = norm(name);

    setMedList((prev) => {
      const idx = prev.findIndex((m) => norm(m.name) === normalized);
      const next =
        idx >= 0
          ? prev.map((m, i) => (i === idx ? { ...m, category, dose } : m))
          : [...prev, { name, category, dose }];

      const exists = (Array.isArray(medsArray) ? medsArray : []).some(
        (m) => norm(readMedName(m)) === normalized
      );

      // INSERT to DB only once for brand-new meds
      if (!exists && !pendingInsertsRef.current.has(normalized)) {
        pendingInsertsRef.current.add(normalized);
        setIsSaving(true);
        saveNewMedicationToDB(name, category, dose)
          .catch(() => {}) // swallow network errors (optional: show toast)
          .finally(() => {
            pendingInsertsRef.current.delete(normalized);
            setIsSaving(false);
          });
      }

      // Update local master list
      if (updateMedsArray) {
        if (exists) {
          updateMedsArray(
            (Array.isArray(medsArray) ? medsArray : []).map((m) => {
              if (norm(readMedName(m)) !== normalized) return m;
              const merged = { ...m };
              if ("defaultDose" in m || !("medication_dose" in m)) merged.defaultDose = dose;
              if ("medication_dose" in m) merged.medication_dose = dose;
              if ("category" in m || !("medication_cat" in m)) merged.category = category || m.category || "";
              if ("medication_cat" in m) merged.medication_cat = category || m.medication_cat || "";
              return merged;
            })
          );
        } else {
          updateMedsArray([
            ...(Array.isArray(medsArray) ? medsArray : []),
            { name, defaultDose: dose, category },
          ]);
        }
      }

      // keep suggestions fresh + persist
      setMedSuggestArray((prevS) => unique([...prevS, name]));
      persistMeds(next, "add");
      return next;
    });

    // reset + focus (unlock for next add)
    setNameQ("");
    setCatQ("");
    setDoseQ("");
    setLockedFromMaster(false);
    setLockedNameNorm("");
    nameRef.current?.focus();
    console.log(medList);
  };

  const handleKeyDownAdd = (e) => {
    if (e.key === "Enter") addMedication();
  };

  // Remove row
  const removeMedication = (idx) => {
    setMedList((prev) => {
      const name = prev[idx]?.name ?? "";
      if (!name) return prev;
      if (!window.confirm(`Remove ${name}?`)) return prev;
      const next = prev.filter((_, i) => i !== idx);
      persistMeds(next, "remove");
      return next;
    });
  };

  // ---------- UI ----------
  const isLocked = lockedFromMaster && norm(nameQ) === lockedNameNorm;

  return (
    <div className="d-flex flex-column" style={{ position: "relative" }}>
      {/* Top box */}
      <div className="border rounded p-2 mb-2 position-relative">
        <div className="row g-2 align-items-end">
          {/* Medication Name + suggestions */}
          <div className="col-18 position-relative">
            <label className="form-label mb-1">Medication Name</label>
            <input
              ref={nameRef}
              type="text"
              className="form-control"
              value={nameQ}
              onChange={onNameChange}
              onKeyDown={handleKeyDownAdd}
              onBlur={() => setTimeout(() => setShowNameSuggest(false), 150)}
              placeholder="Start typing (e.g., Apo 10, Aspirin)…"
            />
            {showNameSuggest && nameQ.trim() && nameSuggestions.length > 0 && (
              <div
                className="list-group shadow position-absolute w-100"
                style={{ zIndex: 10, maxHeight: 240, overflowY: "auto" }}
              >
                {nameSuggestions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="list-group-item list-group-item-action"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickName(n)}
                    title={n}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Category + suggestions */}
          <div className="col-18 position-relative">
            <label className="form-label mb-1">Medication Category</label>
            <input
              type="text"
              className="form-control"
              value={catQ}
              onChange={onCatChange}
              onKeyDown={handleKeyDownAdd}
              onBlur={() => setTimeout(() => setShowCatSuggest(false), 150)}
              placeholder="No Category"
              readOnly={isLocked}
              aria-readonly={isLocked}
            />
            {showCatSuggest && catQ.trim() && catSuggestions.length > 0 && !isLocked && (
              <div
                className="list-group shadow position-absolute w-100"
                style={{ zIndex: 10, maxHeight: 240, overflowY: "auto" }}
              >
                {catSuggestions.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="list-group-item list-group-item-action"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickCategory(n)}
                    title={n}
                  >
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dose */}
          <div className="col-6">
            <label className="form-label mb-1">Dose</label>
            <input
              type="text"
              className="form-control"
              value={doseQ}
              onChange={onDoseChange}
              onKeyDown={handleKeyDownAdd}
              placeholder="e.g., 30mg"
              readOnly={isLocked}
              aria-readonly={isLocked}
            />
          </div>

          {/* Add Medication */}
          <div className="col-6 d-flex align-items-end">
            <button
              type="button"
              className="btn btn-outline-primary w-100"
              onClick={addMedication}
              tabIndex={0}
              disabled={isSaving}
              title={isSaving ? "Saving…" : "Add"}
            >
              {isSaving ? "Saving…" : "Add"}
            </button>
          </div>
        </div>
      </div>

      {/* Read-only list */}
      <div style={{ overflowY: "auto", maxHeight: "60vh" }}>
        <div className="container-fluid px-1">
          <div className="row g-2">
            {(medList || []).map((m, idx) => (
              <div key={`med_${idx}`} className="col-48">
                <div className="border rounded p-1 d-flex align-items-center">
                  <div className="fw-semibold text-truncate col-18 text-start ps-2" title={m.name}>
                    {m.name || "(Unnamed)"}
                  </div>
                  <div className="text-muted  small text-truncate col-18 text-start ps-2" title={m.category || "No Category"}>
                    {m.category || "No Category"}
                  </div>
                  <div className="small text-truncate col-6 ps-2" title={m.dose || "No dose"}>
                    {m.dose || "No dose"}
                  </div>
                  <div className="col-6 text-end pe-2">
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm ms-2"
                      onClick={() => removeMedication(idx)}
                      aria-label={`Remove ${m.name}`}
                      title={`Remove ${m.name}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {(!medList || medList.length === 0) && (
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
