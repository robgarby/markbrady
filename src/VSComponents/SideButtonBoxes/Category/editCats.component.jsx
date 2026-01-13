// src/VSComponents/SideButtonBoxes/Medications/editCats.component.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

// Use your global API_Endpoint if it exists, otherwise fall back
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

  // ---------- Modal state ----------
  const [showModal, setShowModal] = useState(false);
  const [editForm, setEditForm] = useState({
    ID: "",
    catName: "",
    displayName: "",
    catStatus: "No",
    catPoints: 0, // ✅ NEW (real column)
  });

  const closeModal = () => setShowModal(false);

  const openEdit = (c) => {
    const snap = {
      ID: String(c.ID ?? c.id ?? ""),
      catName: String(c.catName ?? "").trim(),
      displayName: String(c.displayName ?? "").trim(),
      catStatus: String(c.catStatus ?? "No"),
      // accept either catPoints or legacy pointValue if it comes back that way
      catPoints: toNumber(c.catPoints ?? c.pointValue ?? 0, 0),
    };
    setEditForm(snap);
    setShowModal(true);
  };

  // ---------- helpers ----------
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

  // ---------- Load categories on mount ----------
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    (async () => {
      setLoading(true);
      setMsg("");

      try {
        const res = await fetch(CATS_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ script: "getCats" }), // medication.php supports getCats :contentReference[oaicite:2]{index=2}
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
    })();
  }, []);

  // ---------- Toggle Used (optimistic + send-and-ignore) ----------
  const processUsed = (row) => {
    const ID = String(row?.ID ?? "").trim();
    if (!ID) return;

    const current = String(row?.catStatus ?? "No").toLowerCase();
    const nextValue = current === "yes" ? "No" : "Yes";

    // optimistic update
    setCatsArray((curr) =>
      (Array.isArray(curr) ? curr : []).map((r) => {
        if (String(r.ID ?? "").trim() !== ID) return r;
        return { ...r, catStatus: nextValue };
      })
    );

    // fire-and-forget backend update (medication.php supports toggleCatUsed by ID) :contentReference[oaicite:3]{index=3}
    fetch(CATS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: "toggleCatUsed", ID, nextValue }),
    }).catch((e) => console.error("toggleCatUsed failed:", e));
  };

  // ---------- Save Edit (optimistic + send-and-ignore) ----------
  const saveEdit = () => {
    const ID = String(editForm?.ID ?? "").trim();
    if (!ID) return;

    const displayName = String(editForm?.displayName ?? "").trim();
    const catPoints = toNumber(editForm?.catPoints ?? 0, 0);

    // ✅ optimistic update immediately
    setCatsArray((curr) =>
      (Array.isArray(curr) ? curr : []).map((r) => {
        if (String(r.ID ?? "").trim() !== ID) return r;
        return { ...r, displayName, catPoints };
      })
    );

    // close right away
    setShowModal(false);

    // ✅ send-and-ignore backend update
    fetch(CATS_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        script: "saveCatDisplayName",
        ID,
        displayName,
        catPoints, // ✅ NEW
      }),
    }).catch((e) => console.error("saveCatDisplayName failed:", e));
  };

  // ---------- filters / counts ----------
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

            <div className="d-flex gap-2 align-items-center col-24 jsutify-content-end">
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
                className="form-control form-control-sm col-24"
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
                      <div className="col-18">Category</div>
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
                              <div className="col-18 text-truncate" title={catName}>
                                {catName || <span className="text-muted">—</span>}
                              </div>

                              <div className="col-16 text-truncate" title={displayName}>
                                {displayName || <span className="text-muted">—</span>}
                              </div>

                              {/* smaller Yes/No */}
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

                              {/* catPoints column */}
                              <div className="col-4 text-center">
                                <span className="text-bg-dark px-2 rounded">{ptsDisplay}</span>
                              </div>

                              <div className="flex-grow-1 text-end gap-2 d-flex justify-content-end">
                                <button
                                  className="btn btn-sm btn-outline-warning"
                                  onClick={() => openEdit(c)}
                                  disabled={!ID}
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
              <h5 className="modal-title">Edit Category</h5>
              <button type="button" className="btn-close" onClick={closeModal} aria-label="Close" />
            </div>

            <div className="modal-body">
              <div className="row g-2">
                {/* catName read-only */}
                <div className="col-48">
                  <label className="form-label mb-1">Category (catName)</label>
                  <input className="form-control form-control-sm" value={editForm.catName} readOnly />
                </div>

                <div className="col-32">
                  <label className="form-label mb-1">Display Category (displayName)</label>
                  <input
                    className="form-control form-control-sm"
                    value={editForm.displayName}
                    onChange={(e) => setEditForm((s) => ({ ...s, displayName: e.target.value }))}
                  />
                </div>

                {/* catPoints in edit */}
                <div className="col-16">
                  <label className="form-label mb-1">Points (catPoints)</label>
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
                    Saving uses <strong>ID</strong> as the primary key. (Optimistic + send-and-ignore)
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-outline-secondary" onClick={closeModal}>
                Cancel
              </button>
              <button className="btn btn-warning" onClick={saveEdit}>
                Yes, Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {showModal ? <div className="modal-backdrop fade show" onClick={closeModal} /> : null}
    </div>
  );
};

export default EditCats;
