// src/components/admin/MedsAdminPanel.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import { useGlobalContext } from "../../Context/global.context";

const MedsAdminPanel = () => {
    const { medsArray, updateMedsArray } = useGlobalContext() || {};
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState("");
    const [filter, setFilter] = useState("");
    const fetchedRef = useRef(false);

    // Load from DB once if context is empty (no transformation)
    useEffect(() => {
        if (fetchedRef.current) return;
        const empty = !Array.isArray(medsArray) || medsArray.length === 0;
        if (!empty) return;

        fetchedRef.current = true;
        setLoading(true);
        fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ script: "getMeds" }),
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
            .finally(() => setLoading(false));
    }, [medsArray, updateMedsArray]);

    const meds = Array.isArray(medsArray) ? medsArray : [];

    // local edit drafts per row (UI-only)
    const [drafts, setDrafts] = useState({}); // { [ID]: { medication, medication_cat, medication_dose, ID } }
    const setDraft = (ID, field, value) =>
        setDrafts((prev) => ({ ...prev, [ID]: { ...(prev[ID] || {}), [field]: value, ID } }));

    // Add form (UI-only)
    const [newMedication, setNewMedication] = useState("");
    const [newCategory, setNewCategory] = useState("");
    const [newDose, setNewDose] = useState("");
    const handleAdd = () => {
        console.log("This would add medication", {
            medication: newMedication.trim(),
            medication_cat: newCategory.trim(),
            medication_dose: newDose.trim(),
        });
        setNewMedication("");
        setNewCategory("");
        setNewDose("");
        setMsg("Logged add intent in console.");
    };

    const shown = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return meds;
        return meds.filter((m) => {
            const name = String(m?.medication ?? "").toLowerCase();
            const cat = String(m?.medication_cat ?? "").toLowerCase();
            const dose = String(m?.medication_dose ?? "").toLowerCase();
            const id = String(m?.ID ?? "").toLowerCase();
            return name.includes(q) || cat.includes(q) || dose.includes(q) || id.includes(q);
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
                                        Reference list (medication, category, default dose). Buttons only log to console.
                                    </small>
                                </div>
                                {loading && <span className="badge bg-info text-dark">Loading…</span>}
                            </div>

                            {/* Add row (cosmetic) */}
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
                                    <div className="col-3">
                                        <label className="form-label mb-1">Category</label>
                                        <input
                                            className="form-control form-control-sm"
                                            value={newCategory}
                                            onChange={(e) => setNewCategory(e.target.value)}
                                            placeholder="e.g. Statin"
                                        />
                                    </div>
                                    <div className="col-3">
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
                                    placeholder="Filter by medication, category, dose, or ID…"
                                    value={filter}
                                    onChange={(e) => setFilter(e.target.value)}
                                />
                            </div>

                            {msg && <div className="alert alert-info py-2 mb-2">{msg}</div>}

                            {/* Table: loop medsArray -> medication / medication_cat / medication_dose */}
                            <div className="table-responsive">
                                {/* Split data into two columns */}
                                {(() => {
                                    const left = shown.slice(0, Math.ceil(shown.length / 2));
                                    const right = shown.slice(Math.ceil(shown.length / 2));

                                    const renderColumn = (items) => (
                                        <div className="border rounded">
                                            <div className="px-2 py-2 fw-bold border-bottom">
                                                Medication • Category • Dose
                                            </div>

                                            {items.length === 0 ? (
                                                <div className="p-2 text-muted">No medications found.</div>
                                            ) : (
                                                items.map((m) => {
                                                    const key = String(m.ID); // key is ALWAYS the data ID
                                                    const medication = (drafts[key]?.medication ?? m.medication) ?? "";
                                                    const medication_cat = (drafts[key]?.medication_cat ?? m.medication_cat) ?? "";
                                                    const medication_dose = (drafts[key]?.medication_dose ?? m.medication_dose) ?? "";

                                                    return (
                                                        <div key={key} className="p-1 border-bottom">
                                                            <div className="d-flex align-items-center">
                                                                {/* Inner 24-col grid within each 24-col column */}
                                                                <div className="col-20 text-truncate" title={medication}>
                                                                    {medication || <span className="text-muted">—</span>}
                                                                </div>
                                                                <div className="col-12 text-truncate" title={medication_cat}>
                                                                    {medication_cat || <span className="text-muted">—</span>}
                                                                </div>
                                                                <div className="flex-grow-1" title={medication_dose}>
                                                                    {medication_dose || <span className="text-muted">—</span>}
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
                                    UI lists data only; you can wire actions later.
                                </div>

                                <div className="small text-muted mt-2">
                                    UI lists data only; actions still use <code>console.log()</code> so you can wire PHP later.
                                </div>
                            </div>

                            <div className="small text-muted">
                                UI is wired, but all actions just <code>console.log()</code> so you can hook PHP endpoints later.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MedsAdminPanel;
