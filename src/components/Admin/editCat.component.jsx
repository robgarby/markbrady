// src/components/admin/EditCat.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGlobalContext } from "../../Context/global.context";

// --- Adjust these to your actual endpoints/script names ---
const CAT_ENDPOINT  = "https://gdmt.ca/PHP/special.php";
const GET_SCRIPT    = "getMedsCategory";          // returns {cats:[{ID, medication_cat}, ...]} or an array
const ADD_SCRIPT    = "addMedsCategory";          // expects { medication_cat }
const UPDATE_SCRIPT = "updateMedsCategory";       // expects { ID, oldCategory, newCategory, propagate:true }

const EditCat = () => {
  const { medsCategory, updateMedsCategory } = useGlobalContext() || {};
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  // Add form
  const [newCat, setNewCat] = useState("");

  // Edit modal
  const [showModal, setShowModal] = useState(false);
  const [editForm, setEditForm] = useState({ ID: "", medication_cat: "" });
  const [origForm, setOrigForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // prevent double-load
  const fetchRef = useRef(false);

  // -------- helpers --------
  const normalizeRows = (rows) =>
    (Array.isArray(rows) ? rows : [])
      .map((x) =>
        x && x.medication_cat
          ? { ID: String(x.ID ?? ""), medication_cat: String(x.medication_cat) }
          : null
      )
      .filter(Boolean)
      .sort((a, b) => a.medication_cat.localeCompare(b.medication_cat));

  const reload = async () => {
    setLoading(true);
    try {
      const res = await fetch(CAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: GET_SCRIPT }),
      });
      const text = await res.text();
      let data = null;
      try { data = JSON.parse(text); } catch {}
      const payload = Array.isArray(data?.cats) ? data.cats : Array.isArray(data) ? data : [];
      const rows = normalizeRows(payload);
      if (typeof updateMedsCategory === "function") updateMedsCategory(rows);
    } catch (e) {
      console.error(e);
      setMsg("Failed to load categories.");
    } finally {
      setLoading(false);
    }
  };

  // -------- load once if empty --------
  useEffect(() => {
    const needs = !Array.isArray(medsCategory) || medsCategory.length === 0;
    if (!needs || fetchRef.current) return;
    fetchRef.current = true;
    reload().finally(() => {
      fetchRef.current = false;
    });
  }, [medsCategory, updateMedsCategory]);

  const list = Array.isArray(medsCategory) ? medsCategory : [];
  const left  = list.slice(0, Math.ceil(list.length / 2));
  const right = list.slice(Math.ceil(list.length / 2));

  const openEdit = (row) => {
    const snap = { ID: String(row.ID || ""), medication_cat: String(row.medication_cat || "") };
    setOrigForm(snap);
    setEditForm(snap);
    setShowModal(true);
  };
  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
    setOrigForm(null);
  };

  // -------- actions --------
const addCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    setSaving(true);
    try {
        const res = await fetch(CAT_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ script: ADD_SCRIPT, medication_cat: name }),
        });
        const text = await res.text();
        let data = null;
        try { data = JSON.parse(text); } catch {}
        if (typeof updateMedsCategory === "function") updateMedsCategory(data);
        setNewCat("");
        setMsg("Category added.");
    } catch (e) {
        console.error(e);
        setMsg("Failed to add category.");
    } finally {
        setSaving(false);
    }
};

  const saveEdit = async () => {
    if (!editForm.ID) return;
    const unchanged = origForm && origForm.medication_cat === editForm.medication_cat;
    if (unchanged) {
      setShowModal(false);
      setOrigForm(null);
      return;
    }
    setSaving(true);
    try {
      await fetch(CAT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: UPDATE_SCRIPT,
          ID: editForm.ID,
          newCategory: editForm.medication_cat,
          propagate: true, // tell backend to update across program where this category is referenced
        }),
      });
      await reload();
      setMsg("Category updated.");
      setShowModal(false);
      setOrigForm(null);
    } catch (e) {
      console.error(e);
      setMsg("Failed to update category.");
    } finally {
      setSaving(false);
    }
  };

  const renderCol = (items) => (
    <div className="border rounded">
      <div className="px-2 py-2 fw-bold border-bottom">Category</div>
      {items.length === 0 ? (
        <div className="p-2 text-muted">No categories.</div>
      ) : (
        items.map((row) => (
          <div key={row.ID || row.medication_cat} className="p-1 border-bottom">
            <div className="row align-items-center">
              {/* 48-col inner grid: name 36 / action 12 */}
              <div className="col-36 text-truncate" title={row.medication_cat}>
                {row.medication_cat}
                {row.ID ? <small className="ms-2 text-muted">#{row.ID}</small> : null}
              </div>
              <div className="col-12 text-end">
                <button
                  className="btn btn-sm btn-outline-warning"
                  onClick={() => openEdit(row)}
                >
                  Edit
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="container-fluid">
      <div className="row g-3">
        <div className="col-48">
          <div className="card shadow-sm">
            <div className="card-body">
              {/* Header */}
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div>
                  <h5 className="card-title mb-1">Edit Categories</h5>
                  <small className="text-muted">
                    Add new categories or edit existing ones. Changes will apply across the program.
                  </small>
                </div>
                {loading || saving ? (
                  <span className="badge bg-info text-dark">{saving ? "Saving…" : "Loading…"}</span>
                ) : null}
              </div>

              {/* Add Category */}
              <div className="border rounded p-2 mb-3">
                <div className="row g-2 align-items-end">
                  <div className="col">
                    <label className="form-label mb-1">New Category</label>
                    <input
                      className="form-control form-control-sm"
                      value={newCat}
                      onChange={(e) => setNewCat(e.target.value)}
                      placeholder="e.g. Statin"
                    />
                  </div>
                  <div className="col-auto">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={addCategory}
                      disabled={saving || !newCat.trim()}
                    >
                      Add Category
                    </button>
                  </div>
                </div>
              </div>

              {msg && <div className="alert alert-info py-2 mb-2">{msg}</div>}

              {/* Two-column list */}
              <div className="row g-2">
                <div className="col-24">{renderCol(left)}</div>
                <div className="col-24">{renderCol(right)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal */}
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
              <h5 className="modal-title">Edit Category</h5>
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
                <div className="col-48">
                  <label className="form-label mb-1">Category Name</label>
                  <input
                    className="form-control form-control-sm"
                    value={editForm.medication_cat}
                    onChange={(e) =>
                      setEditForm((s) => ({ ...s, medication_cat: e.target.value }))
                    }
                    placeholder="e.g. Statin"
                  />
                </div>
                <div className="col-48">
                  <div className="alert alert-warning py-2 my-2">
                    Changing this category will update it <strong>throughout the program</strong>.
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button className="btn btn-warning" onClick={saveEdit} disabled={saving || !editForm.medication_cat.trim()}>
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

export default EditCat;
