// src/components/admin/ConditionAdminPanel.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useGlobalContext } from "../../../Context/global.context.jsx";

// --- Normalize backend rows -> { ID, code, conditionName, _new }
const normalizeRows = (list = []) => {
  const raw = (Array.isArray(list) ? list : []).map((c) => {
    const code = String(c.conditionCode ?? c.code ?? "").toUpperCase();
    const name = String(c.conditionName ?? c.name ?? "").trim();
    const ID = String(c.ID); // backend returns ID in caps
    return { ID, code, conditionName: name, _new: false };
  });

  // De-dup IDs defensively (shouldn't happen, but won’t synthesize cond-… IDs)
  const seen = new Set();
  return raw.map((r, idx) => {
    if (!r.ID || seen.has(r.ID)) {
      r.ID = `${r.ID || "DUP"}-${idx}`;
    }
    seen.add(r.ID);
    return r;
  });
};

const ensureUniqueCode = (want, takenSet) => {
  const base = String(want || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "COND";
  if (!takenSet.has(base)) return base;
  let i = 2;
  while (takenSet.has(`${base}${i}`) && i < 999) i++;
  return `${base}${i}`;
};

const codeFromName = (name = "") =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.slice(0, 3))
    .join("")
    .slice(0, 4) || "COND";

const ConditionAdminPanel = () => {
  const { conditionData, updateConditions } = useGlobalContext() || {};
  const [rows, setRows] = useState(() => normalizeRows(conditionData));
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const fetchedRef = useRef(false);
  const originalRef = useRef(rows);

  // Load from DB if context list is empty
  useEffect(() => {
    if (fetchedRef.current) return;
    if (!Array.isArray(conditionData) || conditionData.length === 0) {
      fetchedRef.current = true;
      fetch("https://gdmt.ca/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: "getConditionData" }),
      })
        .then((r) => r.json())
        .then((data) => {
          const list = Array.isArray(data?.conditions) ? data.conditions : Array.isArray(data) ? data : [];
          const normalized = normalizeRows(list);
          setRows(normalized);
          originalRef.current = normalized;
          if (typeof updateConditions === "function") updateConditions(list);
        })
        .catch(() => setMsg("Could not load conditions from server."));
    }
  }, [conditionData, updateConditions]);

  // Keep local rows in sync if context changes elsewhere
  useEffect(() => {
    if (Array.isArray(conditionData) && conditionData.length > 0) {
      const normalized = normalizeRows(conditionData);
      setRows(normalized);
      originalRef.current = normalized;
    }
  }, [conditionData]);

  // Filter by ID / code / name
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        String(r.ID).toLowerCase().includes(q) ||
        r.code.toLowerCase().includes(q) ||
        r.conditionName.toLowerCase().includes(q)
    );
  }, [rows, filter]);

  // Update a field on a specific row (by ID)
  const setField = (ID, key, val) => {
    setRows((prev) =>
      prev.map((r) =>
        r.ID === ID
          ? { ...r, [key]: key === "code" ? String(val).toUpperCase() : val }
          : r
      )
    );
  };

  // Add a new client-side row (unsaved); keep an obvious ID but still in ID field (caps)
  const addRow = () => {
    const taken = new Set(rows.map((r) => String(r.code || "").toUpperCase()).filter(Boolean));
    const want = ensureUniqueCode(codeFromName("New Condition"), taken);
    let newID = `new-${Date.now()}`;
    const existingIDs = new Set(rows.map((r) => r.ID));
    while (existingIDs.has(newID)) newID = `new-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const newItem = { ID: newID, code: want, conditionName: "New Condition", _new: true };
    setRows((prev) => [newItem, ...prev]);
  };

  // Enable “Save Condition Name” ONLY for existing rows whose name changed (not for new rows)
  const isNameChanged = (row) => {
    if (!row || row._new) return false;
    const orig = (originalRef.current || []).find((o) => o.ID === row.ID);
    const baseline = orig?.conditionName ?? row.conditionName;
    return String(row.conditionName || "").trim() !== String(baseline || "").trim();
  };

  // Inline save of condition name (existing rows only)
  const onEdit = (ID, conditionName) => {
    // optimistic local update
    setRows((prev) => prev.map((r) => (r.ID === ID ? { ...r, conditionName } : r)));
    if (typeof updateConditions === "function") {
      const updated = rows.map((r) => (r.ID === ID ? { ...r, conditionName } : r));
      updateConditions(updated);
    }
    // persist
    fetch("https://gdmt.ca/PHP/special.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ script: "updateConditionName", ID, conditionName }),
    }).catch(() => {});
  };

  // Delete by ID
  const removeRow = (ID) => {
    const rowToRemove = rows.find((r) => r.ID === ID);
    if (!window.confirm(`Remove "${rowToRemove?.conditionName || ID}"?`)) return;

    fetch("https://gdmt.ca/PHP/special.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ script: "removeConditionByID", ID }),
    }).catch(() => {});

    setRows((prev) => {
      const updated = prev.filter((r) => r.ID !== ID);
      if (typeof updateConditions === "function") updateConditions(updated);
      return updated;
    });
  };

  const resetChanges = () => {
    setRows(originalRef.current);
    setMsg("");
  };

  const validate = () => {
    const errors = [];
    const seenCodes = new Set();
    rows.forEach((r, i) => {
      if (!r.conditionName.trim()) errors.push(`Row ${i + 1}: Name is required`);
      if (!/^[A-Z0-9]{2,6}$/.test(r.code || "")) errors.push(`Row ${i + 1}: Code must be 2–6 A–Z/0–9`);
      const codeKey = (r.code || "").toUpperCase();
      if (seenCodes.has(codeKey)) errors.push(`Row ${i + 1}: Duplicate code ${codeKey}`);
      seenCodes.add(codeKey);
    });
    return errors;
  };

  // Save: send only the new record (if any), matching your existing pattern
  const saveAll = async () => {
    const errs = validate();
    if (errs.length) {
      setMsg(errs.join(" • "));
      return;
    }

    const newRecord = rows.find((r) => r._new === true);
    if (!newRecord) {
      setMsg("Nothing to save.");
      return;
    }

    setSaving(true);
    setMsg("");
    try {
      const resp = await fetch("https://gdmt.ca/PHP/special.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          script: "saveConditionData",
          conditions: newRecord, // contains ID (caps) for new row
        }),
      });

      let data;
      try {
        data = await resp.json();
      } catch {
        data = {};
      }

      const saved = Array.isArray(data?.conditions) ? normalizeRows(data.conditions) : rows;
      originalRef.current = saved;
      setRows(saved);
      if (typeof updateConditions === "function") updateConditions(saved);
      setMsg("Saved.");
    } catch (e) {
      setMsg("Network error while saving.");
    } finally {
      setSaving(false);
    }
  };

  const dirty = useMemo(() => JSON.stringify(rows) !== JSON.stringify(originalRef.current), [rows]);

  // Duplicate code detector (only matters for new rows while typing)
  const isDuplicateCode = (ID, code) => {
    const target = String(code || "").toUpperCase();
    if (!target) return false;
    return rows.some((r) => r.ID !== ID && String(r.code || "").toUpperCase() === target);
  };

  return (
    <div className="container-fluid">
      <div className="row g-3">
        <div className="col-48">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <div>
                  <h5 className="card-title mb-1">Condition Admin Panel</h5>
                  <small className="text-muted">
                    Edit the master list of conditions (code, name).{" "}
                    <span className="fw-semibold text-danger">Only new rows can change the code. Codes must be unique.</span>
                  </small>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-primary" onClick={addRow}>+ Add Condition</button>
                </div>
              </div>

              <div className="d-flex align-items-center gap-2 mb-2">
                <input
                  className="form-control"
                  placeholder="Filter by ID, code or name…"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                />
                <button className="btn btn-outline-secondary" onClick={resetChanges} disabled={!dirty}>
                  Reset
                </button>
                <button className="btn btn-primary" onClick={saveAll} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>

              {msg && <div className="alert alert-info py-2 mb-2">{msg}</div>}

              <div className="table-responsive">
                <table className="table table-sm align-middle">
                  <thead>
                    <tr>
                      <th style={{ width: 80 }}>Code</th>
                      <th>Name · Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="text-muted">No conditions found.</td>
                      </tr>
                    ) : (
                      filtered.map((r) => {
                        const dup = r._new && isDuplicateCode(r.ID, r.code);
                        const codeInputClasses =
                          "form-control form-control-sm" + (dup ? " is-invalid text-danger border-danger" : "");
                        const codeInputStyle = dup ? { color: "var(--bs-danger)" } : undefined;

                        return (
                          <tr key={r.ID}>
                            {/* Code (80px) */}
                            <td>
                              <input
                                className={codeInputClasses}
                                style={{ ...codeInputStyle, width: "80px" }}
                                value={r.code}
                                onChange={(e) => setField(r.ID, "code", e.target.value.toUpperCase())}
                                maxLength={6}
                                placeholder="CODE"
                                readOnly={!r._new} // only new rows can edit code
                                aria-invalid={dup ? "true" : "false"}
                              />
                              {dup && <div className="invalid-feedback d-block">This code already exists.</div>}
                            </td>

                            {/* Name + Actions (same line) */}
                            <td>
                              <div className="d-flex align-items-center">
                                <input
                                  className="form-control form-control-sm"
                                  style={{ flex: 1, minWidth: 0 }}
                                  value={r.conditionName}
                                  onChange={(e) => setField(r.ID, "conditionName", e.target.value)}
                                  placeholder="Condition name"
                                />

                                {/* Save Condition Name: disabled/outline by default; solid when changed (not for new rows) */}
                                <button
                                  type="button"
                                  className={`btn btn-sm ms-2 ${isNameChanged(r) ? "btn-warning" : "btn-outline-warning"}`}
                                  disabled={!isNameChanged(r)}
                                  onClick={() => onEdit(r.ID, r.conditionName)}
                                  title="Save Condition Name"
                                  style={{ whiteSpace: "nowrap" }}
                                >
                                  Save Condition Name
                                </button>

                                {/* Delete (always available) */}
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger ms-2"
                                  onClick={() => removeRow(r.ID)}
                                  title="Delete condition"
                                  style={{ whiteSpace: "nowrap" }}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="small text-muted">
                Codes must be <strong>2–6</strong> characters (A–Z / 0–9) and unique across all conditions.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConditionAdminPanel;
