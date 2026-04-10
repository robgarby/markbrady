import React, { useEffect, useMemo, useRef, useState } from "react";

const CATS_ENDPOINT = "https://gdmt.ca/PHP/medication.php";

const toNumber = (v, fallback = 0) => {
  if (v === null || v === undefined) return fallback;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : fallback;
};

const EditCats = () => {
  const [catsArray, setCatsArray] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState("ALL"); // ALL | USED | NOTUSED

  const didInitRef = useRef(false);

  // EDIT POINTS modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    ID: "",
    catName: "",
    displayName: "",
    catStatus: "No",
    catPoints: 0,
  });

  // ADD CATEGORY modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    catName: "",
    displayName: "",
    catStatus: "Yes",
    catPoints: 0,
  });

  const closeEditModal = () => setShowEditModal(false);
  const closeAddModal = () => {
    setShowAddModal(false);
    setAddForm({
      catName: "",
      displayName: "",
      catStatus: "Yes",
      catPoints: 0,
    });
  };

  const normalizeCats = (payload) => {
    const list =
      (Array.isArray(payload?.cats) && payload.cats) ||
      (Array.isArray(payload?.categories) && payload.categories) ||
      (Array.isArray(payload?.medCats) && payload.medCats) ||
      (Array.isArray(payload?.data) && payload.data) ||
      (Array.isArray(payload) && payload) ||
      [];

    return (Array.isArray(list) ? list : []).map((c) => ({
      ...c,
      ID: c.ID ?? c.id ?? "",
      catName: String(c.catName ?? c.category ?? c.cat ?? c.name ?? "").trim(),
      displayName: String(c.displayName ?? c.display ?? c.display_category ?? "").trim(),
      catStatus: String(c.catStatus ?? c.used ?? c.categoryUsed ?? "No"),
      catPoints: toNumber(c.catPoints ?? c.pointValue ?? 0, 0),
    }));
  };

  const loadCats = async () => {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch(CATS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: "getCats" }),
      });

      const text = await res.text();
      const data = JSON.parse(text);
      const normalized = normalizeCats(data);

      setCatsArray(normalized);
      if (!normalized.length) setMsg("No categories returned.");
    } catch (e) {
      console.error("Load categories failed:", e);
      setCatsArray([]);
      setMsg("Failed to load categories (see console).");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    loadCats();
  }, []);

  const openEdit = (c) => {
    setEditForm({
      ID: String(c.ID ?? c.id ?? ""),
      catName: String(c.catName ?? "").trim(),
      displayName: String(c.displayName ?? "").trim(),
      catStatus: String(c.catStatus ?? "No"),
      catPoints: toNumber(c.catPoints ?? c.pointValue ?? 0, 0),
    });
    setShowEditModal(true);
  };

  const processUsed = (row) => {
    const ID = String(row?.ID ?? "").trim();
    if (!ID) return;

    const current = String(row?.catStatus ?? "No").toLowerCase();
    const nextValue = current === "yes" ? "No" : "Yes";

    setCatsArray((curr) =>
      (Array.isArray(curr) ? curr : []).map((r) => {
        if (String(r.ID ?? "").trim() !== ID) return r;
        return { ...r, catStatus: nextValue };
      })
    );

    fetch(CATS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: "toggleCatUsed", ID, nextValue }),
    }).catch((e) => console.error("toggleCatUsed failed:", e));
  };

  const savePoints = async () => {
    const ID = String(editForm?.ID ?? "").trim();
    if (!ID) return;

    const catPoints = toNumber(editForm?.catPoints ?? 0, 0);

    setMsg("");

    try {
      const res = await fetch(CATS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "saveCatPoints",
          ID,
          catPoints,
        }),
      });

      const text = await res.text();
      const data = JSON.parse(text);

      if (!data?.success) {
        setMsg(data?.error || "Failed to save category points.");
        return;
      }

      setCatsArray((curr) =>
        (Array.isArray(curr) ? curr : []).map((r) => {
          if (String(r.ID ?? "").trim() !== ID) return r;
          return { ...r, catPoints };
        })
      );

      setShowEditModal(false);
      setMsg("Category points saved.");
    } catch (e) {
      console.error("saveCatPoints failed:", e);
      setMsg("Failed to save category points.");
    }
  };

  const saveAddCategory = async () => {
    const catName = String(addForm?.catName ?? "").trim();
    const displayName = String(addForm?.displayName ?? "").trim();
    const catStatus = String(addForm?.catStatus ?? "Yes").trim() === "No" ? "No" : "Yes";
    const catPoints = toNumber(addForm?.catPoints ?? 0, 0);

    if (!catName) {
      setMsg("Category Name is required.");
      return;
    }

    setMsg("");

    try {
      const res = await fetch(CATS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "addCategory",
          catName,
          displayName,
          catStatus,
          catPoints,
        }),
      });

      const text = await res.text();
      const data = JSON.parse(text);

      if (!data?.success) {
        setMsg(data?.error || "Failed to add category.");
        return;
      }

      const newRow = {
        ID: data?.category?.ID ?? data?.insertID ?? "",
        catName: data?.category?.catName ?? catName,
        displayName: data?.category?.displayName ?? displayName,
        catStatus: data?.category?.catStatus ?? catStatus,
        catPoints: toNumber(data?.category?.catPoints ?? catPoints, 0),
      };

      setCatsArray((curr) => {
        const next = Array.isArray(curr) ? [...curr, newRow] : [newRow];
        next.sort((a, b) => String(a.catName).localeCompare(String(b.catName)));
        return next;
      });

      closeAddModal();
      setMsg("Category added.");
    } catch (e) {
      console.error("addCategory failed:", e);
      setMsg("Failed to add category.");
    }
  };

  const baseShown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (Array.isArray(catsArray) ? catsArray : []).filter((c) => {
      const catName = String(c.catName ?? "").trim();
      const displayName = String(c.displayName ?? "").trim();
      const status = String(c.catStatus ?? "No");
      const pts = String(c.catPoints ?? "");
      const hay = `${catName} ${displayName} ${status} ${pts}`.toLowerCase();
      return !q || hay.includes(q);
    });
  }, [catsArray, filter]);

  const counts = useMemo(() => {
    let used = 0;
    for (const c of baseShown) {
      if (String(c.catStatus ?? "No").toLowerCase() === "yes") used++;
    }
    const all = baseShown.length;
    return { all, used, notUsed: all - used };
  }, [baseShown]);

  const shown = useMemo(() => {
    if (catFilter === "ALL") return baseShown;
    return baseShown.filter((c) => {
      const used = String(c.catStatus ?? "No").toLowerCase() === "yes";
      return catFilter === "USED" ? used : !used;
    });
  }, [baseShown, catFilter]);

  return (
    <div className="container-fluid p-0">
      <div className="row g-2">
        <div className="col-48">
          <div className="alert alert-secondary py-2 mb-2 d-flex align-items-center justify-content-between">
            <div className="fw-bold">Medication Category Admin</div>

            <div className="d-flex gap-2 align-items-center col-30 justify-content-end">
              <button
                className="btn btn-sm btn-success"
                type="button"
                onClick={() => setShowAddModal(true)}
                disabled={loading}
              >
                Add Category
              </button>

              <div className="btn-group flex-grow-1" role="group" aria-label="Used filter">
                <button
                  className={`btn btn-sm col-15 ${catFilter === "ALL" ? "btn-primary" : "btn-outline-primary"}`}
                  onClick={() => setCatFilter("ALL")}
                  type="button"
                >
                  All ({counts.all})
                </button>

                <button
                  className={`btn btn-sm col-15 ${catFilter === "USED" ? "btn-primary" : "btn-outline-primary"}`}
                  onClick={() => setCatFilter("USED")}
                  type="button"
                >
                  Used ({counts.used})
                </button>

                <button
                  className={`btn btn-sm col-18 ${catFilter === "NOTUSED" ? "btn-primary" : "btn-outline-primary"}`}
                  onClick={() => setCatFilter("NOTUSED")}
                  type="button"
                >
                  Not Used ({counts.notUsed})
                </button>
              </div>

              <input
                className="form-control form-control-sm col-18"
                style={{ width: 280 }}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter categories…"
                disabled={loading}
              />
            </div>
          </div>

          {loading ? <div className="alert alert-secondary py-2 mb-2">Loading categories…</div> : null}
          {msg ? <div className="alert alert-info py-2 mb-2">{msg}</div> : null}

          {!loading ? (
            <div className="table-responsive">
              {(() => {
                const left = shown.slice(0, Math.ceil(shown.length / 2));
                const right = shown.slice(Math.ceil(shown.length / 2));

                const renderColumn = (items) => (
                  <div className="border rounded p-2">
                    <div className="d-flex fw-bold small border-bottom pb-1 mb-2">
                      <div className="col-16">Category</div>
                      <div className="col-16">Display Category</div>
                      <div className="col-6">Used</div>
                      <div className="col-4 text-center">Points</div>
                      <div className="flex-grow-1 text-end">Actions</div>
                    </div>

                    {items.length === 0 ? (
                      <div className="text-muted small">
                        <em>No categories.</em>
                      </div>
                    ) : (
                      items.map((c, idx) => {
                        const ID = String(c.ID ?? "");
                        const catName = String(c.catName ?? "").trim();
                        const displayName = String(c.displayName ?? "").trim();
                        const status = String(c.catStatus ?? "No");
                        const usedYes = status.toLowerCase() === "yes";

                        const pts = toNumber(c.catPoints ?? 0, 0);
                        const ptsDisplay = pts === 0 ? "-" : pts;

                        return (
                          <div key={ID || `${catName}-${idx}`} className="border-bottom fs-7">
                            <div className="d-flex py-1 align-items-center">
                              <div className="col-16 text-truncate" title={catName}>
                                {catName || <span className="text-muted">—</span>}
                              </div>

                              <div className="col-16 text-truncate" title={displayName}>
                                {displayName || <span className="text-muted">—</span>}
                              </div>

                              <div className="col-6">
                                <button
                                  type="button"
                                  onClick={() => processUsed(c)}
                                  className={`btn btn-sm py-0 px-2 w-100 ${
                                    usedYes ? "btn-primary" : "btn-warning"
                                  }`}
                                  disabled={!ID}
                                  title={!ID ? "Missing ID" : "Toggle Used"}
                                >
                                  {status}
                                </button>
                              </div>

                              <div className="col-4 text-center">
                                <span className="text-bg-dark px-2 rounded">{ptsDisplay}</span>
                              </div>

                              <div className="flex-grow-1 text-end gap-2 d-flex justify-content-end">
                                <button
                                  className="btn btn-sm btn-outline-warning"
                                  onClick={() => openEdit(c)}
                                  disabled={!ID}
                                >
                                  Edit Points
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
            </div>
          ) : null}
        </div>
      </div>

      {/* EDIT POINTS MODAL */}
      <div
        className={`modal fade ${showEditModal ? "show d-block" : ""}`}
        tabIndex="-1"
        role="dialog"
        aria-modal={showEditModal ? "true" : "false"}
        aria-hidden={showEditModal ? "false" : "true"}
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
              <h5 className="modal-title">Edit Category Points</h5>
              <button type="button" className="btn-close" onClick={closeEditModal} aria-label="Close" />
            </div>

            <div className="modal-body">
              <div className="row g-2">
                <div className="col-24">
                  <label className="form-label mb-1">Category</label>
                  <input className="form-control form-control-sm" value={editForm.catName} readOnly />
                </div>

                <div className="col-24">
                  <label className="form-label mb-1">Display Category</label>
                  <input className="form-control form-control-sm" value={editForm.displayName} readOnly />
                </div>

                <div className="col-16">
                  <label className="form-label mb-1">Status</label>
                  <input className="form-control form-control-sm" value={editForm.catStatus} readOnly />
                </div>

                <div className="col-16">
                  <label className="form-label mb-1">Points</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={String(editForm.catPoints ?? 0)}
                    onChange={(e) =>
                      setEditForm((s) => ({
                        ...s,
                        catPoints: e.target.value === "" ? 0 : toNumber(e.target.value, 0),
                      }))
                    }
                  />
                </div>

                <div className="col-48">
                  <div className="alert alert-secondary py-2 my-2 mb-0">
                    Only <strong>Points</strong> can be edited here.
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={closeEditModal}>
                Cancel
              </button>
              <button className="btn btn-warning" onClick={savePoints}>
                Save Points
              </button>
            </div>
          </div>
        </div>
      </div>

      {showEditModal ? <div className="modal-backdrop fade show" onClick={closeEditModal} /> : null}

      {/* ADD CATEGORY MODAL */}
      <div
        className={`modal fade ${showAddModal ? "show d-block" : ""}`}
        tabIndex="-1"
        role="dialog"
        aria-modal={showAddModal ? "true" : "false"}
        aria-hidden={showAddModal ? "false" : "true"}
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
              <h5 className="modal-title">Add Category</h5>
              <button type="button" className="btn-close" onClick={closeAddModal} aria-label="Close" />
            </div>

            <div className="modal-body">
              <div className="row g-2">
                <div className="col-24">
                  <label className="form-label mb-1">Category Name (catName)</label>
                  <input
                    className="form-control form-control-sm"
                    value={addForm.catName}
                    onChange={(e) => setAddForm((s) => ({ ...s, catName: e.target.value }))}
                  />
                </div>

                <div className="col-24">
                  <label className="form-label mb-1">Display Category (displayName)</label>
                  <input
                    className="form-control form-control-sm"
                    value={addForm.displayName}
                    onChange={(e) => setAddForm((s) => ({ ...s, displayName: e.target.value }))}
                  />
                </div>

                <div className="col-24">
                  <label className="form-label mb-1">Used</label>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className={`btn btn-sm ${addForm.catStatus === "Yes" ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={() => setAddForm((s) => ({ ...s, catStatus: "Yes" }))}
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${addForm.catStatus === "No" ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={() => setAddForm((s) => ({ ...s, catStatus: "No" }))}
                    >
                      No
                    </button>
                  </div>
                </div>

                <div className="col-24">
                  <label className="form-label mb-1">Points</label>
                  <input
                    type="number"
                    className="form-control form-control-sm"
                    value={String(addForm.catPoints ?? 0)}
                    onChange={(e) =>
                      setAddForm((s) => ({
                        ...s,
                        catPoints: e.target.value === "" ? 0 : toNumber(e.target.value, 0),
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={closeAddModal}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={saveAddCategory}>
                Add Category
              </button>
            </div>
          </div>
        </div>
      </div>

      {showAddModal ? <div className="modal-backdrop fade show" onClick={closeAddModal} /> : null}
    </div>
  );
};

export default EditCats;