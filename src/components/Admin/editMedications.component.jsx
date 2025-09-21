// src/components/admin/MedsAdminPanel.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useGlobalContext } from "../../Context/global.context";

const CAT_ENDPOINT = "https://optimizingdyslipidemia.com/PHP/special.php";
const CAT_SCRIPT = "getMedsCategory";

const MEDS_ENDPOINT = "https://optimizingdyslipidemia.com/PHP/database.php";
const MEDS_SCRIPT = "getMeds";

// Endpoint for saving + propagating
const UPDATE_ENDPOINT = "https://optimizingdyslipidemia.com/PHP/database.php";
const UPDATE_SCRIPT = "updateMedicationAndPropagate";

const MedsAdminPanel = () => {
  const { medsArray, updateMedsArray, medsCategory, updateMedsCategory } = useGlobalContext() || {};
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("");

  const catFetchRef = useRef(false);
  const medsFetchRef = useRef(false);

  // ---------- Modal state ----------
  const [showModal, setShowModal] = useState(false);
  const [editForm, setEditForm] = useState({
    ID: "",
    medication: "",
    medication_brand: "",      // <-- NEW
    medication_cat: "",
    medication_dose: "",
  });
  // Snapshot of the original row (used to diff and send old values if needed)
  const [origEdit, setOrigEdit] = useState(null);

  const openEdit = (m) => {
    const snap = {
      ID: String(m.ID ?? ""),
      medication: String(m.medication ?? m.medication_name ?? ""),
      medication_brand: String(m.medication_brand ?? ""), // <-- NEW
      medication_cat: String(m.medication_cat ?? ""),
      medication_dose: String(m.medication_dose ?? ""),
    };
    setOrigEdit(snap);
    setEditForm(snap);
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setOrigEdit(null);
  };

  // ---------- SAVE (update medsArray + write to DB + propagate) ----------
  const saveEdit = async () => {
    if (!editForm.ID) return;

    // Fire-and-forget call to update the single medication record quickly
    fetch(CAT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        script: "updateMedication",
        ...editForm, // includes medication_brand
      }),
    }).catch((err) => console.error("Fire-and-forget updateMedication error:", err));

    const unchanged =
      origEdit &&
      origEdit.medication === editForm.medication &&
      origEdit.medication_brand === editForm.medication_brand && // <-- NEW in comparison
      origEdit.medication_cat === editForm.medication_cat &&
      origEdit.medication_dose === editForm.medication_dose;

    if (unchanged) {
      setShowModal(false);
      setOrigEdit(null);
      return;
    }

    setSaving(true);

    // Optimistic UI update
    if (typeof updateMedsArray === "function") {
      updateMedsArray((prev) =>
        (Array.isArray(prev) ? prev : []).map((row) =>
          String(row.ID) === String(editForm.ID)
            ? {
                ...row,
                medication: editForm.medication,
                medication_brand: editForm.medication_brand, // <-- NEW
                medication_cat: editForm.medication_cat,
                medication_dose: editForm.medication_dose,
              }
            : row
        )
      );
    }

    // Backend write: also instruct server to update ALL patients on this med if name changed
    try {
      const res = await fetch(UPDATE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: UPDATE_SCRIPT,
          ID: editForm.ID,
          oldMedication: origEdit?.medication || "",
          newMedication: editForm.medication,
          medication_brand: editForm.medication_brand, // <-- NEW
          medication_cat: editForm.medication_cat,
          medication_dose: editForm.medication_dose,
          propagate: true,
        }),
      });

      const text = await res.text();
      let payload = null;
      try {
        payload = JSON.parse(text);
      } catch {}
      if (!res.ok || (payload && payload.success === false)) {
        throw new Error((payload && payload.error) || "Save failed");
      }

      setMsg("Saved and propagated successfully.");
    } catch (e) {
      setMsg("Save failed: " + (e?.message || "Unknown error"));
      console.error("Save error:", e);
    } finally {
      setSaving(false);
      setShowModal(false);
      setOrigEdit(null);
    }
  };

  // ---------- Load categories once if empty ----------
  useEffect(() => {
    const needsLoad = !Array.isArray(medsCategory) || medsCategory.length === 0;
    if (!needsLoad || catFetchRef.current) return;

    catFetchRef.current = true;
    const ac = new AbortController();

    (async () => {
      try {
        const res = await fetch(CAT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: CAT_SCRIPT }),
          signal: ac.signal,
        });

        const text = await res.text();
        let data = null;
        try {
          data = JSON.parse(text);
        } catch {
          console.error("Non-JSON response for medsCategory:", text);
        }

        // Accept an array of {ID, medication_cat}
        let payload = Array.isArray(data?.cats) ? data.cats : Array.isArray(data) ? data : [];
        payload = payload
          .map((x) =>
            x && x.medication_cat
              ? { ID: String(x.ID ?? ""), medication_cat: String(x.medication_cat) }
              : null
          )
          .filter(Boolean);

        payload.sort((a, b) => a.medication_cat.localeCompare(b.medication_cat));
        if (typeof updateMedsCategory === "function") updateMedsCategory(payload);
      } catch (err) {
        if (!(err && err.name && String(err.name).includes("AbortError"))) {
          console.error("Failed to load medsCategory:", err);
        }
      } finally {
        catFetchRef.current = false;
      }
    })();

    return () => ac.abort();
  }, [medsCategory, updateMedsCategory]);

  // ---------- Load meds once if empty ----------
  useEffect(() => {
    if (medsFetchRef.current) return;
    const empty = !Array.isArray(medsArray) || medsArray.length === 0;
    if (!empty) return;

    medsFetchRef.current = true;
    setLoading(true);
    fetch(MEDS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: MEDS_SCRIPT }),
    })
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data?.meds)
          ? data.meds
          : Array.isArray(data?.medications)
          ? data.medications
          : Array.isArray(data)
          ? data
          : [];
        if (typeof updateMedsArray === "function") updateMedsArray(list);
        if (!list.length) setMsg("No medications returned from server.");
      })
      .catch(() => setMsg("Could not load medications from server."))
      .finally(() => {
        setLoading(false);
        medsFetchRef.current = false;
      });
  }, [medsArray, updateMedsArray]);

  const meds = Array.isArray(medsArray) ? medsArray : [];

  // Add row (left as-is; you can add brand here later if you want)
  const [newMedication, setNewMedication] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newDose, setNewDose] = useState("");
  const handleAdd = () => {
    (async () => {
      try {
        const res = await fetch(CAT_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            script: "addMedication",
            medication: newMedication.trim(),
            medication_cat: newCategory.trim(),
            medication_dose: newDose.trim(),
          }),
        });
        const data = await res.json();
        if (typeof updateMedsArray === "function") {
          updateMedsArray(Array.isArray(data) ? data : []);
        }
        setMsg("Medication added successfully.");
      } catch (err) {
        setMsg("Failed to add medication.");
        console.error("Add medication error:", err);
      }
    })();
    setNewMedication("");
    setNewCategory("");
    setNewDose("");
  };

  // Filter
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return meds;
    return meds.filter((m) => {
      const name = String(m?.medication ?? m?.medication_name ?? "").toLowerCase();
      const brand = String(m?.medication_brand ?? "").toLowerCase(); // <-- NEW in filter
      const cat = String(m?.medication_cat ?? "").toLowerCase();
      const dose = String(m?.medication_dose ?? "").toLowerCase();
      const id = String(m?.ID ?? "").toLowerCase();
      return name.includes(q) || brand.includes(q) || cat.includes(q) || dose.includes(q) || id.includes(q);
    });
  }, [meds, filter]);

  return (
    <div className="container-fluid">
      <div className="row g-3">
        <div className="col-48">
          <div className="card shadow-sm">
            <div className="card-body">
              {/* Header */}
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div>
                  <h5 className="card-title mb-1">Medications Admin</h5>
                  <small className="text-muted">
                    Reference list (medication, brand, category, default dose). Edit → Save will also propagate changes.
                  </small>
                </div>
                {(loading || saving) && (
                  <span className="badge bg-info text-dark">{saving ? "Saving…" : "Loading…"}</span>
                )}
              </div>

              {/* Add row (brand not required here yet) */}
              <div className="border rounded p-2 mb-3">
                <div className="row g-2 align-items-end">
                  <div className="col">
                    <label className="form-label mb-1">Medication</label>
                    <input
                      className="form-control form-control-sm"
                      value={newMedication}
                      onChange={(e) => setNewMedication(e.target.value)}
                      placeholder="e.g. Atorvastatin"
                    />
                  </div>

                  <div className="col-8">
                    <label className="form-label mb-1">Category</label>
                    <select
                      className="form-select form-select-sm"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                    >
                      <option value="">— Choose a category —</option>
                      {(Array.isArray(medsCategory) ? medsCategory : []).map((opt) => (
                        <option key={opt.ID || opt.medication_cat} value={opt.medication_cat}>
                          {opt.medication_cat}
                        </option>
                      ))}
                    </select>
                    {!Array.isArray(medsCategory) || medsCategory.length === 0 ? (
                      <div className="form-text text-warning">No categories loaded.</div>
                    ) : null}
                  </div>

                  <div className="col-8">
                    <label className="form-label mb-1">Default Dose</label>
                    <input
                      className="form-control form-control-sm"
                      value={newDose}
                      onChange={(e) => setNewDose(e.target.value)}
                      placeholder="e.g. 20 mg"
                    />
                  </div>

                  <div className="col-auto">
                    <button className="btn btn-sm btn-primary" onClick={handleAdd}>
                      Add Medication
                    </button>
                  </div>
                </div>
              </div>

              {/* Filter */}
              <div className="d-flex align-items-center gap-2 mb-2">
                <input
                  className="form-control"
                  placeholder="Filter by medication, brand, category, dose, or ID…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
              </div>

              {msg && <div className="alert alert-info py-2 mb-2">{msg}</div>}

              {/* Two-column listing */}
              <div className="table-responsive">
                {(() => {
                  const left = shown.slice(0, Math.ceil(shown.length / 2));
                  const right = shown.slice(Math.ceil(shown.length / 2));

                  const renderColumn = (items) => (
                    <div className="border rounded">
                      <div className="px-2 py-2 fw-bold border-bottom">Medication • Brand • Category • Dose</div>

                      {items.length === 0 ? (
                        <div className="p-2 text-muted">No medications found.</div>
                      ) : (
                        items.map((m) => {
                          const key = String(m.ID);
                          const medication = String(m.medication ?? m.medication_name ?? "");
                          const medication_brand = String(m.medication_brand ?? ""); // <-- NEW
                          const medication_cat = String(m.medication_cat ?? "");
                          const medication_dose = String(m.medication_dose ?? "");

                          return (
                            <div key={key} className="p-1 border-bottom fs-7">
                              <div className="row align-items-center">
                                {/* 48-col inner grid: 14 / 10 / 12 / 6 / 6 */}
                                <div className="col-12 text-truncate" title={medication}>
                                  {medication || <span className="text-muted">—</span>}
                                </div>
                                <div className="col-9 text-truncate" title={medication_brand}>
                                  {medication_brand || <span className="text-muted">—</span>}
                                </div>
                                <div className="col-8 text-truncate" title={medication_cat}>
                                  {medication_cat || <span className="text-muted">—</span>}
                                </div>
                                <div className="col-12 text-truncate" title={medication_dose}>
                                  {medication_dose || <span className="text-muted">—</span>}
                                </div>
                                <div className="col-6 text-end">
                                  <button
                                    className="btn btn-sm btn-outline-warning"
                                    onClick={() =>
                                      openEdit({
                                        ID: m.ID,
                                        medication,
                                        medication_brand, // <-- NEW
                                        medication_cat,
                                        medication_dose,
                                      })
                                    }
                                  >
                                    Edit
                                  </button>
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

                <div className="small text-muted mt-2">
                  Edit → Save updates this list immediately and requests a propagate update on the server.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---------- Controlled Bootstrap-style Modal ---------- */}
      <div
        className={`modal fade ${showModal ? "show d-block" : ""}`}
        tabIndex="-1"
        role="dialog"
        aria-modal={showModal ? "true" : "false"}
        aria-hidden={showModal ? "false" : "true"}
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content shadow">
            <div className="modal-header">
              <h5 className="modal-title">Edit Medication</h5>
              <button type="button" className="btn-close" onClick={closeModal} aria-label="Close" disabled={saving} />
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
                    value={editForm.medication_cat}
                    onChange={(e) => setEditForm((s) => ({ ...s, medication_cat: e.target.value }))}
                  >
                    <option value="">— Choose a category —</option>
                    {(Array.isArray(medsCategory) ? medsCategory : []).map((opt) => (
                      <option key={opt.ID || opt.medication_cat} value={opt.medication_cat}>
                        {opt.medication_cat}
                      </option>
                    ))}
                  </select>
                  {!Array.isArray(medsCategory) || medsCategory.length === 0 ? (
                    <div className="form-text text-warning">No categories loaded.</div>
                  ) : null}
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

                <div className="col-48">
                  <div className="alert alert-warning py-2 my-2">
                    Changing any of these values will update <strong>all patients</strong> on this medication.
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-warning" onClick={saveEdit} disabled={saving}>
                {saving ? "Saving…" : "Yes, Save"}
              </button>
            </div>
          </div>
        </div>
      </div>
      {showModal && <div className="modal-backdrop fade show" onClick={closeModal} />}
    </div>
  );
};

export default MedsAdminPanel;
