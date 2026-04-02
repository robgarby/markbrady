// src/components/Conditions/conditionTranslation.component.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useGlobalContext } from "../../../Context/global.context.jsx";

const CONDITION_ENDPOINT = "https://www.gdmt.ca/PHP/conditions.php";

const FILTERS = {
    UNLINKED: "UNLINKED",
    LINKED: "LINKED",
    IGNORED: "IGNORED",
    ALL: "ALL",
};

const ConditionTranslation = ({ onClose }) => {
    const { conditionData = [] } = useGlobalContext();

    const [conditionArray, setConditionArray] = useState([]);
    const [selectedFilter, setSelectedFilter] = useState(FILTERS.UNLINKED);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [rebuilding, setRebuilding] = useState(false);
    const [savingRowId, setSavingRowId] = useState(null);
    const [errorMessage, setErrorMessage] = useState("");

    const [editingRow, setEditingRow] = useState(null);
    const [selectedConditionCode, setSelectedConditionCode] = useState("");
    const [selectedConditionName, setSelectedConditionName] = useState("");

    const dropdownOptions = useMemo(() => {
        if (!Array.isArray(conditionData)) return [];

        return [...conditionData]
            .filter((item) => item?.conditionCode && item?.conditionName)
            .sort((a, b) =>
                String(a?.conditionName || "").localeCompare(String(b?.conditionName || ""))
            );
    }, [conditionData]);

    const readJsonResponse = async (response) => {
        const text = await response.text();

        try {
            return JSON.parse(text);
        } catch (error) {
            console.error("Bad JSON from PHP:", text);
            throw new Error("PHP did not return valid JSON.");
        }
    };

    const loadConditionTranslation = async (filterValue = "All") => {
        try {
            setLoading(true);
            setErrorMessage("");

            const response = await fetch(CONDITION_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    script: "getConditionTranslation",
                    isLinked: filterValue,
                }),
            });

            const data = await readJsonResponse(response);

            if (!data?.success) {
                throw new Error(data?.message || "Unable to load condition translation.");
            }

            setConditionArray(Array.isArray(data?.data) ? data.data : []);
        } catch (error) {
            console.error("Error loading conditionTranslation:", error);
            setErrorMessage(error.message || "Unable to load condition translation.");
            setConditionArray([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConditionTranslation("All");
    }, []);

    const handleRebuild = async () => {
        try {
            setRebuilding(true);
            setErrorMessage("");

            const response = await fetch(CONDITION_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    script: "rebuildConditionTranslation",
                }),
            });

            const data = await readJsonResponse(response);

            if (!data?.success) {
                throw new Error(data?.message || "Rebuild failed.");
            }

            setConditionArray(Array.isArray(data?.data) ? data.data : []);
            setSelectedFilter(FILTERS.UNLINKED);
            closeEditModal();
        } catch (error) {
            console.error("Error rebuilding conditionTranslation:", error);
            setErrorMessage(error.message || "Unable to rebuild condition translation.");
        } finally {
            setRebuilding(false);
        }
    };

    const handleProcess = async () => {
        try {
            setProcessing(true);
            setErrorMessage("");

            const response = await fetch(CONDITION_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    script: "processConditionTranslation",
                }),
            });

            const data = await readJsonResponse(response);

            if (!data?.success) {
                throw new Error(data?.message || "Process failed.");
            }

            await loadConditionTranslation("All");
        } catch (error) {
            console.error("Error processing conditionTranslation:", error);
            setErrorMessage(error.message || "Unable to process condition translation.");
        } finally {
            setProcessing(false);
        }
    };

    const visibleArray = useMemo(() => {
        if (selectedFilter === FILTERS.ALL) return conditionArray;

        if (selectedFilter === FILTERS.UNLINKED) {
            return conditionArray.filter(
                (item) => String(item?.IsLinked ?? "").trim() === "No"
            );
        }

        if (selectedFilter === FILTERS.LINKED) {
            return conditionArray.filter(
                (item) =>
                    String(item?.IsLinked ?? "").trim() === "Yes" &&
                    String(item?.conditionCode ?? "").trim().toUpperCase() !== "IGNORE"
            );
        }

        if (selectedFilter === FILTERS.IGNORED) {
            return conditionArray.filter(
                (item) => String(item?.conditionCode ?? "").trim().toUpperCase() === "IGNORE"
            );
        }

        return conditionArray;
    }, [conditionArray, selectedFilter]);

    const splitIntoColumns = useMemo(() => {
        const midpoint = Math.ceil(visibleArray.length / 2);
        return {
            leftColumn: visibleArray.slice(0, midpoint),
            rightColumn: visibleArray.slice(midpoint),
        };
    }, [visibleArray]);

    const openEditModal = (row) => {
        const rowCode = String(row?.conditionCode ?? "");
        const safeCode = rowCode !== "-" && rowCode !== "IGNORE" ? rowCode : "";

        setSavingRowId(null);
        setEditingRow(row);
        setSelectedConditionCode(safeCode);

        const foundMatch = dropdownOptions.find(
            (item) => String(item?.conditionCode ?? "") === safeCode
        );

        setSelectedConditionName(foundMatch?.conditionName || "");
    };

    const closeEditModal = () => {
        setEditingRow(null);
        setSelectedConditionCode("");
        setSelectedConditionName("");
        setSavingRowId(null);
    };

    const handleDropdownChange = (e) => {
        const newCode = e.target.value;

        const found = dropdownOptions.find(
            (item) => String(item?.conditionCode ?? "") === String(newCode)
        );

        setSelectedConditionCode(newCode);
        setSelectedConditionName(found?.conditionName || "");
    };

    const handleIgnore = async () => {
        try {
            if (!editingRow?.ID) {
                throw new Error("Missing conditionTranslation ID.");
            }

            setSavingRowId(editingRow.ID);
            setErrorMessage("");

            const response = await fetch(CONDITION_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    script: "saveConditionTranslation",
                    translationID: Number(editingRow.ID),
                    conditionCode: "IGNORE",
                    IsLinked: "Yes",
                }),
            });

            const data = await readJsonResponse(response);

            if (!data?.success) {
                throw new Error(data?.message || "Unable to save ignore condition.");
            }

            setConditionArray((prev) =>
                prev.map((item) =>
                    Number(item?.ID) === Number(editingRow?.ID)
                        ? {
                              ...item,
                              conditionCode: "IGNORE",
                              IsLinked: "Yes",
                          }
                        : item
                )
            );

            closeEditModal();
        } catch (error) {
            console.error("Error saving ignore condition:", error);
            setErrorMessage(error.message || "Unable to save ignore condition.");
        } finally {
            setSavingRowId(null);
        }
    };

    const handleSaveEdit = async () => {
        try {
            if (!editingRow?.ID) {
                throw new Error("Missing conditionTranslation ID.");
            }

            if (!selectedConditionCode) {
                throw new Error("Please choose a condition before saving.");
            }

            setSavingRowId(editingRow.ID);
            setErrorMessage("");

            const response = await fetch(CONDITION_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    script: "saveConditionTranslation",
                    translationID: Number(editingRow.ID),
                    conditionCode: selectedConditionCode,
                    IsLinked: "Yes",
                }),
            });

            const data = await readJsonResponse(response);

            if (!data?.success) {
                throw new Error(data?.message || "Unable to save condition translation.");
            }

            setConditionArray((prev) =>
                prev.map((item) =>
                    Number(item?.ID) === Number(editingRow?.ID)
                        ? {
                              ...item,
                              conditionCode: selectedConditionCode,
                              IsLinked: "Yes",
                          }
                        : item
                )
            );

            closeEditModal();
        } catch (error) {
            console.error("Error saving condition translation:", error);
            setErrorMessage(error.message || "Unable to save condition translation.");
        } finally {
            setSavingRowId(null);
        }
    };

    const renderRow = (item, index) => {
        return (
            <div className="col-48 mb-2" key={`${item?.ID ?? "row"}-${index}`}>
                <div className="row g-2 align-items-center border rounded p-2 bg-white">
                    <div className="col-22">
                        <div className="fw-bold text-navy small">Condition Name</div>
                        <div>{item?.conditionName || <span className="text-muted">-</span>}</div>
                    </div>

                    <div className="col-14">
                        <div className="fw-bold text-navy small">Link Code</div>
                        <div>{item?.conditionCode || <span className="text-muted">-</span>}</div>
                    </div>

                    <div className="col-12 text-end">
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-primary w-100"
                            onClick={() => openEditModal(item)}
                        >
                            Edit
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const isSavingThisRow =
        editingRow?.ID != null &&
        savingRowId != null &&
        Number(savingRowId) === Number(editingRow.ID);

    return (
        <>
            <div className="container-fluid px-2 py-2">
                <div className="row g-2 mb-3 align-items-center">
                    <div className="col-48">
                        <div className="alert alert-primary mb-0 py-2">
                            <div className="row g-2 align-items-center">
                                <div className="col-48 col-md-12">
                                    <div className="fw-bold fs-5">Condition Translation</div>
                                </div>

                                <div className="col-48 col-md-36">
                                    <div className="row g-2 justify-content-end">
                                        <div className="col-12 col-md-5">
                                            <button
                                                type="button"
                                                className={`btn w-100 ${
                                                    selectedFilter === FILTERS.UNLINKED
                                                        ? "btn-primary"
                                                        : "btn-outline-primary"
                                                }`}
                                                onClick={() => setSelectedFilter(FILTERS.UNLINKED)}
                                            >
                                                Not Linked
                                            </button>
                                        </div>

                                        <div className="col-12 col-md-5">
                                            <button
                                                type="button"
                                                className={`btn w-100 ${
                                                    selectedFilter === FILTERS.LINKED
                                                        ? "btn-primary"
                                                        : "btn-outline-primary"
                                                }`}
                                                onClick={() => setSelectedFilter(FILTERS.LINKED)}
                                            >
                                                Linked
                                            </button>
                                        </div>

                                        <div className="col-12 col-md-5">
                                            <button
                                                type="button"
                                                className={`btn w-100 ${
                                                    selectedFilter === FILTERS.IGNORED
                                                        ? "btn-primary"
                                                        : "btn-outline-primary"
                                                }`}
                                                onClick={() => setSelectedFilter(FILTERS.IGNORED)}
                                            >
                                                Ignored
                                            </button>
                                        </div>

                                        <div className="col-12 col-md-5">
                                            <button
                                                type="button"
                                                className={`btn w-100 ${
                                                    selectedFilter === FILTERS.ALL
                                                        ? "btn-primary"
                                                        : "btn-outline-primary"
                                                }`}
                                                onClick={() => setSelectedFilter(FILTERS.ALL)}
                                            >
                                                All
                                            </button>
                                        </div>

                                        <div className="col-24 col-md-5">
                                            <button
                                                type="button"
                                                className="btn btn-warning w-100 fw-bold"
                                                onClick={handleRebuild}
                                                disabled={rebuilding}
                                            >
                                                {rebuilding ? "..." : "Rebuild"}
                                            </button>
                                        </div>

                                        <div className="col-24 col-md-5">
                                            <button
                                                type="button"
                                                className="btn btn-success w-100 fw-bold"
                                                onClick={handleProcess}
                                                disabled={processing}
                                            >
                                                {processing ? "..." : "Process"}
                                            </button>
                                        </div>

                                        {onClose ? (
                                            <div className="col-24 col-md-6">
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger w-100 fw-bold"
                                                    onClick={onClose}
                                                >
                                                    Close
                                                </button>
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {errorMessage ? (
                        <div className="col-48">
                            <div className="alert alert-danger py-2 mb-0">{errorMessage}</div>
                        </div>
                    ) : null}

                    <div className="col-48">
                        <div className="d-flex justify-content-end">
                            <div className="small text-muted">
                                Showing {visibleArray.length} record{visibleArray.length === 1 ? "" : "s"}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="row g-3">
                    <div className="col-48 col-lg-24">
                        <div className="border rounded p-2 h-100 bg-light">
                            <div className="fw-bold text-purple border-bottom pb-2 mb-2">
                                Column 1
                            </div>
                            <div className="row g-2">
                                {loading ? (
                                    <div className="col-48 text-muted"><em>Loading...</em></div>
                                ) : splitIntoColumns.leftColumn.length === 0 ? (
                                    <div className="col-48 text-muted"><em>No records found.</em></div>
                                ) : (
                                    splitIntoColumns.leftColumn.map((item, index) =>
                                        renderRow(item, index)
                                    )
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="col-48 col-lg-24">
                        <div className="border rounded p-2 h-100 bg-light">
                            <div className="fw-bold text-purple border-bottom pb-2 mb-2">
                                Column 2
                            </div>
                            <div className="row g-2">
                                {loading ? (
                                    <div className="col-48 text-muted"><em>Loading...</em></div>
                                ) : splitIntoColumns.rightColumn.length === 0 ? (
                                    <div className="col-48 text-muted"><em>No records found.</em></div>
                                ) : (
                                    splitIntoColumns.rightColumn.map((item, index) =>
                                        renderRow(item, index)
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {editingRow ? (
                <>
                    <div
                        className="modal fade show"
                        style={{ display: "block", backgroundColor: "rgba(0,0,0,0.5)" }}
                        tabIndex="-1"
                        role="dialog"
                    >
                        <div className="modal-dialog modal-lg modal-dialog-centered" role="document">
                            <div className="modal-content">
                                <div className="modal-header bg-light">
                                    <h5 className="modal-title">Edit Condition Translation</h5>
                                    <button
                                        type="button"
                                        className="btn-close"
                                        onClick={closeEditModal}
                                        disabled={false}
                                    ></button>
                                </div>

                                <div className="modal-body">
                                    <div className="mb-3">
                                        <div className="fw-bold text-navy small">Condition Name</div>
                                        <div className="fs-5">{editingRow?.conditionName}</div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-bold">
                                            Select Patient Condition
                                        </label>
                                        <select
                                            className="form-select"
                                            value={selectedConditionCode}
                                            onChange={handleDropdownChange}
                                            disabled={isSavingThisRow}
                                        >
                                            <option value="">Select condition...</option>
                                            {dropdownOptions.map((option) => (
                                                <option
                                                    key={`${option?.ID}-${option?.conditionCode}`}
                                                    value={option?.conditionCode}
                                                >
                                                    {option?.conditionName} ({option?.conditionCode})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mb-3">
                                        <div className="small text-muted">
                                            Selected: {selectedConditionName || "None"}
                                        </div>
                                    </div>

                                    <div className="row g-2">
                                        <div className="col-24">
                                            <button
                                                type="button"
                                                className="btn btn-outline-danger w-100"
                                                onClick={handleIgnore}
                                                disabled={isSavingThisRow}
                                            >
                                                {isSavingThisRow ? "Saving..." : "Ignore"}
                                            </button>
                                        </div>

                                        <div className="col-24">
                                            <button
                                                type="button"
                                                className="btn btn-success w-100"
                                                onClick={handleSaveEdit}
                                                disabled={isSavingThisRow}
                                            >
                                                {isSavingThisRow ? "Saving..." : "Save"}
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={closeEditModal}
                                        disabled={false}
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="modal-backdrop fade show"></div>
                </>
            ) : null}
        </>
    );
};

export default ConditionTranslation;