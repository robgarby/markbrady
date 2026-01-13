// src/VSComponents/SideButtonBoxes/Medications/editMedications.component.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGlobalContext } from "../../../Context/global.context.jsx"; // ✅ category context

const MEDS_ENDPOINT = "https://gdmt.ca/PHP/medication.php";

// Endpoint for saving + propagating
const UPDATE_ENDPOINT = "https://gdmt.ca/PHP/database.php";
const UPDATE_SCRIPT = "updateMedicationAndPropagate";

const pickFirstArray = (...vals) => vals.find((v) => Array.isArray(v));

const getCatId = (c) => String(c?.ID ?? c?.id ?? c?.catID ?? c?.categoryID ?? "");
const getCatLabel = (c) =>
  String(c?.displayName ?? c?.categoryName ?? c?.medication_cat ?? c?.name ?? "");
const getCatRaw = (c) => String(c?.medication_cat ?? c?.categoryName ?? c?.displayName ?? "");
const getCatPoints = (c) => Number(c?.catPoints ?? c?.pointValue ?? 0);

const formatPoints = (v) => {
  const n = Number(v ?? 0);
  return n === 0 ? "—" : String(n);
};

const MedsAdminPanel = (props) => {
  // ✅ allow either prop-driven categories OR context-driven categories
  const ctx = useGlobalContext?.() || {};

  const categoriesFromProps = props?.categories;
  const categoriesFromCtx = useMemo(() => {
    return (
      pickFirstArray(
        ctx?.medsCategory,
        ctx?.categoryArray,
        ctx?.catsArray,
        ctx?.categoriesArray,
        ctx?.catArray
      ) || []
    );
  }, [ctx?.medsCategory, ctx?.categoryArray, ctx?.catsArray, ctx?.categoriesArray, ctx?.catArray]);

  const catsArray = useMemo(() => {
    return pickFirstArray(categoriesFromProps, categoriesFromCtx) || [];
  }, [categoriesFromProps, categoriesFromCtx]);

  // local state only (no context) — meds loaded from backend
  const [medsArray, setMedsArray] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("");
  const [medFilter, setMedFilter] = useState("ALL"); // ALL | USED | NOTUSED

  // React 18 StrictMode runs effects twice in dev — this prevents double-fetch + flicker
  const didInitRef = useRef(false);

  // ---------- Modal state ----------
  const [showModal, setShowModal] = useState(false);
  const [editForm, setEditForm] = useState({
    ID: "",
    medication: "",
    medication_brand: "",
    medication_cat: "",
    medication_dose: "",
    catID: "",
    medPoints: 0,
  });
  const [origEdit, setOrigEdit] = useState(null);

  const deriveCatFromExisting = (snap) => {
    // if catID missing but medication_cat exists, try to find matching category
    if (snap.catID) return snap;

    const label = String(snap.medication_cat ?? "").trim().toLowerCase();
    if (!label) return snap;

    const match = (Array.isArray(catsArray) ? catsArray : []).find((c) => {
      const a = getCatLabel(c).trim().toLowerCase();
      const b = getCatRaw(c).trim().toLowerCase();
      return a === label || b === label;
    });

    if (!match) return snap;

    return {
      ...snap,
      catID: getCatId(match),
      // keep whatever is already displayed in meds table unless blank
      medication_cat: snap.medication_cat || getCatLabel(match),
      medPoints: Number(snap.medPoints ?? getCatPoints(match) ?? 0),
    };
  };

  const openEdit = (m) => {
    const snap = {
      ID: String(m.ID ?? ""),
      medication: String(m.medication ?? m.medication_name ?? ""),
      medication_brand: String(m.medication_brand ?? ""),
      medication_cat: String(m.medication_cat ?? ""),
      medication_dose: String(m.medication_dose ?? ""),
      catID: String(m.catID ?? m.CatID ?? m.categoryID ?? ""),
      medPoints: Number(m.medPoints ?? 0),
    };

    const fixed = deriveCatFromExisting(snap);

    setOrigEdit(fixed);
    setEditForm(fixed);
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setOrigEdit(null);
  };

  // ---------- Load meds on mount ----------
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    let cancelled = false;

    (async () => {
      setLoading(true);
      setMsg("");

      try {
        const medsRes = await fetch(MEDS_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: "getMeds2026" }),
        });

        const raw = await medsRes.text();

        let medsData = null;
        try {
          medsData = JSON.parse(raw);
        } catch (e) {
          throw new Error("Backend did not return valid JSON.");
        }

        const list = Array.isArray(medsData?.meds)
          ? medsData.meds
          : Array.isArray(medsData?.medications)
            ? medsData.medications
            : Array.isArray(medsData)
              ? medsData
              : [];

        if (!cancelled) setMedsArray(list);

        if (!medsRes.ok) {
          setMsg("Failed to load medications (server error).");
        } else if (!list.length) {
          setMsg("No medications returned from server.");
        }
      } catch (e) {
        console.error("Load meds failed:", e);
        if (!cancelled) {
          setMsg("Failed to load medications: " + (e?.message || "Unknown error"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- Toggle Used (local optimistic + backend) ----------
  const processUsed = async (din, currentValue) => {
    const cleanDin = String(din ?? "").trim();
    if (!cleanDin) return;

    const current = String(currentValue ?? "No").toLowerCase();
    const nextValue = current === "yes" ? "No" : "Yes"; // what you're switching TO

    const prev = medsArray;

    // optimistic local update (set to nextValue)
    setMedsArray((curr) =>
      (Array.isArray(curr) ? curr : []).map((row) => {
        const rowDin = String(row.DIN ?? row.medication_din ?? "").trim();
        if (rowDin !== cleanDin) return row;
        return { ...row, medicationUsed: nextValue };
      })
    );

    try {
      const res = await fetch(MEDS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "toggleMedicationUsed",
          DIN: cleanDin,
          currentValue: currentValue, // what it WAS
          nextValue: nextValue, // what it should become
        }),
      });

      const text = await res.text();
      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch { }

      if (!res.ok || (payload && payload.success === false)) {
        throw new Error((payload && payload.error) || "Update failed");
      }
    } catch (e) {
      console.error("Toggle medicationUsed error:", e);
      setMsg("Update failed: " + (e?.message || "Unknown error"));
      setMedsArray(prev); // rollback
    }
  };

  // ---------- Category dropdown (sets catID + medPoints) ----------
  const handleCategoryChange = (catIdValue) => {
    const catID = String(catIdValue ?? "");
    const found = (Array.isArray(catsArray) ? catsArray : []).find(
      (c) => getCatId(c) === catID
    );

    if (!found) {
      // user picked blank
      setEditForm((s) => ({
        ...s,
        catID: "",
        medication_cat: "",
        medPoints: 0,
      }));
      return;
    }

    setEditForm((s) => ({
      ...s,
      catID,
      medication_cat: getCatLabel(found), // what you store on the medication row
      medPoints: getCatPoints(found), // ✅ auto from category points
    }));
  };

  // ---------- SAVE (local optimistic + SEND-AND-FORGET backend) ----------
  const saveEdit = () => {
    if (!editForm.ID) return;

    const unchanged =
      origEdit &&
      origEdit.medication === editForm.medication &&
      origEdit.medication_brand === editForm.medication_brand &&
      origEdit.medication_cat === editForm.medication_cat &&
      origEdit.medication_dose === editForm.medication_dose &&
      String(origEdit.catID ?? "") === String(editForm.catID ?? "") &&
      Number(origEdit.medPoints ?? 0) === Number(editForm.medPoints ?? 0);

    if (unchanged) {
      setShowModal(false);
      setOrigEdit(null);
      return;
    }

    setSaving(true);
    setMsg("");

    // optimistic local update (NO waiting)
    setMedsArray((curr) =>
      (Array.isArray(curr) ? curr : []).map((row) =>
        String(row.ID) === String(editForm.ID)
          ? {
            ...row,
            medication: editForm.medication,
            medication_brand: editForm.medication_brand,
            medication_cat: editForm.medication_cat,
            medication_dose: editForm.medication_dose,
            catID: editForm.catID,
            medPoints: editForm.medPoints,
          }
          : row
      )
    );

    const requestBody = {
      script: UPDATE_SCRIPT,
      ID: editForm.ID,
      oldMedication: origEdit?.medication || "",
      newMedication: editForm.medication,
      medication_brand: editForm.medication_brand,
      medication_cat: editForm.medication_cat,
      medication_dose: editForm.medication_dose,
      catID: editForm.catID,
      medPoints: editForm.medPoints,
      propagate: true,
    };


    // close immediately (send & forget)
    setShowModal(false);
    setOrigEdit(null);
    setSaving(false);
    setMsg("Saved locally. Update sent to server (check console for payload).");

    // fire request in background (log response, but do not block UI)
    try {
      fetch(UPDATE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })
        .then(async (res) => {
          const text = await res.text();

          let payload = null;
          try {
            payload = JSON.parse(text);
          } catch { }

          console.log("parsed payload:", payload);

          if (!res.ok || (payload && payload.success === false)) {
            console.error("Server reported save failure:", payload);
          }
        })
        .catch((e) => {
          console.error("Save error (background):", e);
        });
    } catch (e) {
      console.error("Save error (sync):", e);
    }
  };

  const baseShown = useMemo(() => {
    const q = filter.trim().toLowerCase();

    return (Array.isArray(medsArray) ? medsArray : []).filter((m) => {
      const medication = String(m.medication ?? m.medication_name ?? "");
      const medication_brand = String(m.medication_brand ?? "");
      const medication_din = String(m.DIN ?? m.medication_din ?? "");
      const medication_cat = String(m.medication_cat ?? "");
      const medication_dose = String(m.medication_dose ?? "");
      const hay = `${medication} ${medication_brand} ${medication_din} ${medication_cat} ${medication_dose}`.toLowerCase();
      return !q || hay.includes(q);
    });
  }, [medsArray, filter]);

  const counts = useMemo(() => {
    let used = 0;
    for (const m of baseShown) {
      const isUsed = String(m.medicationUsed ?? m.medication_used ?? "").toLowerCase() === "yes";
      if (isUsed) used++;
    }
    const all = baseShown.length;
    return { all, used, notUsed: all - used };
  }, [baseShown]);

  const shown = useMemo(() => {
    if (medFilter === "ALL") return baseShown;

    return baseShown.filter((m) => {
      const used = String(m.medicationUsed ?? m.medication_used ?? "").toLowerCase() === "yes";
      return medFilter === "USED" ? used : !used;
    });
  }, [baseShown, medFilter]);

  return (
    <div className="container-fluid p-0">
      <div className="row g-2">
        <div className="col-48">
          <div className="alert alert-secondary py-2 mb-2 d-flex align-items-center justify-content-between">
            <div className="fw-bold">Medication Admin</div>

            <div className="d-flex gap-2 align-items-center col-24 jsutify-content-end">
              <div className="btn-group flex-grow-1" role="group" aria-label="Used filter">
                <button
                  className={`btn btn-sm col-15 ${medFilter === "ALL" ? "btn-primary" : "btn-outline-primary"}`}
                  onClick={() => setMedFilter("ALL")}
                  type="button"
                >
                  All ({counts.all})
                </button>
                <button
                  className={`btn btn-sm col-15 ${medFilter === "USED" ? "btn-primary" : "btn-outline-primary"}`}
                  onClick={() => setMedFilter("USED")}
                  type="button"
                >
                  Used ({counts.used})
                </button>
                <button
                  className={`btn btn-sm col-18 ${medFilter === "NOTUSED" ? "btn-primary" : "btn-outline-primary"}`}
                  onClick={() => setMedFilter("NOTUSED")}
                  type="button"
                >
                  Not Used ({counts.notUsed})
                </button>
              </div>

              <input
                className="form-control form-control-sm col-24"
                style={{ width: 280 }}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter meds (name, DIN, category, dose)…"
                disabled={loading}
              />
            </div>
          </div>

          {loading ? <div className="alert alert-secondary py-2 mb-2">Loading medications…</div> : null}
          {msg ? <div className="alert alert-info py-2 mb-2">{msg}</div> : null}

          {!loading ? (
            <div className="table-responsive">
              {(() => {
                const left = shown.slice(0, Math.ceil(shown.length / 2));
                const right = shown.slice(Math.ceil(shown.length / 2));

                const renderColumn = (items) => (
                  <div className="border rounded p-2">
                    {/* Header */}
                    <div className="d-flex fw-bold small border-bottom pb-1 mb-2 align-items-center">
                      <div className="col-19">Medication</div>
                      <div className="col-5">DIN</div>
                      <div className="col-9">Category</div>
                      <div className="col-4">Dose</div>
                      <div className="col-3 text-center">Pts</div>

                      {/* ✅ right side has 2 separate columns */}
                      <div className="flex-grow-1 d-flex gap-1">
                        <div className="w-50 text-end pe-2">Used</div>
                        <div className="w-50 text-end pe-2">Edit</div>
                      </div>
                    </div>

                    {items.length === 0 ? (
                      <div className="text-muted small">
                        <em>No medications.</em>
                      </div>
                    ) : (
                      items.map((m, idx) => {
                        const medication = String(m.medication ?? m.medication_name ?? "");
                        const medication_brand = String(m.medication_brand ?? "");
                        const medication_cat = String(m.medication_cat ?? "");
                        const medication_dose = String(m.medication_dose ?? "");
                        const medication_din = String(m.DIN ?? m.medication_din ?? "");
                        const medication_used = String(m.medicationUsed ?? m.medication_used ?? "No");
                        const usedYes = medication_used.toLowerCase() === "yes";
                        const pts = Number(m.medPoints ?? 0);

                        return (
                          <div key={m.ID ?? `${medication_din}-${idx}`} className="border-bottom fs-7">
                            <div className="d-flex py-1 align-items-center">
                              <div className="col-19 text-truncate" title={medication}>
                                {medication || <span className="text-muted">—</span>}
                                {medication_brand ? (
                                  <span className="text-muted ms-2">({medication_brand})</span>
                                ) : null}
                              </div>

                              <div className="col-5 text-start text-truncate" title={medication_din}>
                                {medication_din || <span className="text-muted">—</span>}
                              </div>

                              <div className="col-9 text-truncate" title={medication_cat}>
                                {medication_cat || <span className="text-muted">—</span>}
                              </div>

                              <div className="col-4 text-truncate" title={medication_dose}>
                                {medication_dose || <span className="text-muted">—</span>}
                              </div>

                              <div className="col-3 text-center" title={String(pts)}>
                                {formatPoints(pts)}
                              </div>

                              {/* ✅ Two separate columns (Used | Edit) */}
                              <div className="flex-grow-1 d-flex gap-1 align-items-center">
                                {/* USED column */}
                                <div className="w-50 d-flex justify-content-end">
                                  <span
                                    className={`px-3 text-center ${usedYes ? "bg-success" : "bg-secondary"
                                      }`}
                                    style={{
                                      height: "26px",
                                      lineHeight: "26px",
                                      borderRadius: "4px",
                                      color: "white",
                                      minWidth: "56px",
                                    }}
                                    title={!medication_din ? "No DIN" : "Toggle Used"}
                                    onClick={() =>
                                      medication_din ? processUsed(medication_din, medication_used) : null
                                    }
                                    onKeyDown={(e) => {
                                      if (!medication_din) return;
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        processUsed(medication_din, medication_used);
                                      }
                                    }}
                                  >
                                    {usedYes ? "Yes" : "No"}
                                  </span>
                                </div>

                                {/* EDIT column */}
                                <div className="w-50 d-flex justify-content-end">
                                  <button
                                    className="btn btn-sm btn-outline-warning"
                                    onClick={() =>
                                      openEdit({
                                        ID: m.ID,
                                        medication,
                                        medication_brand,
                                        medication_cat,
                                        medication_dose,
                                        catID: m.catID,
                                        medPoints: m.medPoints,
                                      })
                                    }
                                  >
                                    Edit
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                );

                return (
                  <div className="row g-2">
                    <div className="col-24">{renderColumn(left)}</div>
                    <div className="col-24">{renderColumn(right)}</div>
                  </div>
                );
              })()}
            </div>
          ) : null}
        </div>
      </div>

      {/* ---------- Modal ---------- */}
      <div
        className={`modal fade ${showModal ? "show d-block" : ""}`}
        tabIndex="-1"
        role="dialog"
        aria-modal={showModal ? "true" : "false"}
        aria-hidden={showModal ? "false" : "true"}
      >
        <div
          className="modal-dialog col-24 modal-dialog-centered"
          style={{
            ["--bs-modal-width"]: "50vw",
            width: "50vw",
            maxWidth: "50vw",
          }}
        >
          <div className="modal-content shadow">
            <div className="modal-header">
              <h5 className="modal-title">Edit Medication</h5>
              <button
                type="button"
                className="btn-close"
                onClick={closeModal}
                aria-label="Close"
                disabled={saving}
              />
            </div>

            <div className="modal-body">
              <div className="row g-2">
                <div className="col-24">
                  <label className="form-label mb-1">Medication</label>
                  <input
                    className="form-control form-control-sm"
                    value={editForm.medication}
                    onChange={(e) => setEditForm((s) => ({ ...s, medication: e.target.value }))}
                  />
                </div>

                <div className="col-24">
                  <label className="form-label mb-1">Brand (optional)</label>
                  <input
                    className="form-control form-control-sm"
                    value={editForm.medication_brand}
                    onChange={(e) => setEditForm((s) => ({ ...s, medication_brand: e.target.value }))}
                    placeholder="e.g. Lipitor"
                  />
                </div>

                <div className="col-24">
                  <label className="form-label mb-1">Category</label>
                  <select
                    className="form-select form-select-sm"
                    value={String(editForm.catID ?? "")}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                  >
                    <option value="">— Choose a category —</option>
                    {(Array.isArray(catsArray) ? catsArray : []).map((opt) => {
                      const id = getCatId(opt);
                      const label = getCatLabel(opt);
                      const pts = getCatPoints(opt);
                      return (
                        <option key={id || label} value={id}>
                          {label} {pts ? `(${pts})` : ""}
                        </option>
                      );
                    })}
                  </select>

                  <div className="form-text text-muted">
                    Selecting a category sets <strong>catID</strong> and <strong>medPoints</strong> automatically.
                  </div>
                </div>

                <div className="col-24">
                  <label className="form-label mb-1">Dose</label>
                  <input
                    className="form-control form-control-sm"
                    value={editForm.medication_dose}
                    onChange={(e) => setEditForm((s) => ({ ...s, medication_dose: e.target.value }))}
                    placeholder="e.g. 20 mg"
                  />
                </div>

                <div className="col-12">
                  <label className="form-label mb-1">Points (medPoints)</label>
                  <input
                    className="form-control form-control-sm"
                    value={formatPoints(editForm.medPoints)}
                    disabled
                    readOnly
                  />
                </div>

                <div className="col-12">
                  <label className="form-label mb-1">Category ID (catID)</label>
                  <input
                    className="form-control form-control-sm"
                    value={String(editForm.catID ?? "")}
                    disabled
                    readOnly
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer d-flex justify-content-between">
              <div className="text-muted small">
                <em>Save is “send & forget” — check the console log for the exact payload.</em>
              </div>

              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary" onClick={closeModal} disabled={saving}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* backdrop */}
      {showModal ? <div className="modal-backdrop fade show" onClick={closeModal} /> : null}
    </div>
  );
};

export default MedsAdminPanel;
