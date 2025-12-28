import React, { useEffect, useState } from "react";
import DragBox from "../../DragBox/Drag/dragBox.component.jsx";
import { useGlobalContext } from "../../../Context/global.context.jsx";
import { fetchUsers } from "../../../Context/functions.jsx";

export default function Users() {
    const [users, setUsers] = useState([]);                // array of user rows from server
    const [editing, setEditing] = useState({});            // { [id]: { ...editedFields } }
    const [newUser, setNewUser] = useState({
        userName: "",
        password: "",
        dayOfWeek: "",
        ipAddress: "",
        patientTable: "",
        historyTable: "",
    });

    const { selectedTopButtons, setSelectedTopButtons } = useGlobalContext();
    const API_ENDPOINT = "https://gdmt.ca/PHP/special.php";

    // Load users on mount
    useEffect(() => {
        (async () => {
            try {
                const list = await fetchUsers();
                setUsers(Array.isArray(list) ? list : []);
            } catch (err) {
                console.error("Failed to load users", err);
            }
        })();
    }, []);

    // ---- helpers -------------------------------------------------------------

    // Grab the “current” value for a given field on a given row (merge local edits over original)
    const fieldValue = (row, field) =>
        editing[row.id]?.[field] ?? row?.[field] ?? "";

    // Determine if any of the editable fields differ from original for this row
    const isRowEdited = (row) => {
        const fields = ["userName", "password"];
        return fields.some((f) => {
            const orig = (row?.[f] ?? "").toString().trim();
            const cur = (fieldValue(row, f) ?? "").toString().trim();
            return orig !== cur;
        });
    };

    // Simple validation: enable “Insert” once userName has content
    const canInsert = (newUser.userName || "").trim().length > 0;
    const insertBtnClass = canInsert ? "btn btn-purple" : "btn btn-outline-purple";

    const closeBox = (box) => () => {
        const updated = (selectedTopButtons || []).filter((b) => b !== box);
        setSelectedTopButtons?.(updated);
    };

    // ---- API helpers ---------------------------------------------------------

    async function saveUser(row) {
        if (!row?.id) return;
        if (!isRowEdited(row)) return;

        const payload = {
            script: "saveUser",
            theType: "update",
            id: row.id,
            userName: fieldValue(row, "userName"),
            password: fieldValue(row, "password"),
        };

        try {
            const resp = await fetch(API_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await resp.json();
            if (data?.success) {
                // Refresh list from source of truth
                const list = await fetchUsers();
                console.log("Fetched users:", list);
                setUsers(Array.isArray(list) ? list : []);
                // Clear edits for this row
                setEditing((prev) => {
                    const next = { ...prev };
                    delete next[row.id];
                    return next;
                });
            } else {
                console.warn("Failed to save user.");
            }
        } catch (e) {
            console.error("Error saving user:", e);
        }
    }

    async function createUser() {
        if (!canInsert) return;

        const payload = {
            script: "saveUser",
            theType: "create",
            userName: (newUser.userName || "").trim(),
            password: (newUser.password || "").trim(),
        };
        try {
            const resp = await fetch(API_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const data = await resp.json();
            if (data?.success) {
                // Refresh list from source of truth
                const list = await fetchUsers();
                console.log("Fetched users:", list);
                setUsers(Array.isArray(list) ? list : []);
               setNewUser({
                    userName: "",
                    password: "",
                    dayOfWeek: "",
                    ipAddress: "",
                    patientTable: "",
                    historyTable: "",
                });
            } else {
                console.warn("Failed to save user.");
            }
        } catch (e) {
            console.error("Error saving user:", e);
        }
    }

    // ---- render --------------------------------------------------------------

    return (
        <DragBox
            id="USERS_BOX"
            storageKey="USERS_BOX_POSITION"
            defaultPos={{ x: 320, y: 360 }}
            title="Users"
            width={960}
            onAdd={null}
            zIndex={2050}
            addNote="-"
            onClose={closeBox("users")}
        >
            <div style={{ padding: 12, minWidth: 600 }}>
                <div style={{ marginBottom: 10 }}>
                    <strong>Existing users</strong>
                </div>

                {/* header row */}
                <div
                    className="border-bottom pb-1 mb-2 d-flex gap-2"
                >
                    <div className="ps-1 col-10 fw-bold small">Username</div>
                    <div className="ps-1 col-10 fw-bold small ps-2">Password</div>
                    <div className="ps-1 col-12 fw-bold small">Patient Table</div>
                    <div className="ps-1 col-12 fw-bold small">History Table</div>
                    <div className="flex-grow-1 fw-bold small">Save</div>
                </div>

                {/* rows */}
                {users.length === 0 && <div>No users found.</div>}
                {users.map((row) => {
                    const edited = isRowEdited(row);
                    const saveBtnClass = edited ? "btn btn-success" : "btn btn-outline-success";

                    return (
                        <div
                            key={row.id}
                            className="d-flex gap-2 mb-2 align-items-center"
                        >
                            <input
                                className="fs-7 col-10"
                                value={fieldValue(row, "userName")}
                                onChange={(e) =>
                                    setEditing((s) => ({ ...s, [row.id]: { ...s[row.id], userName: e.target.value } }))
                                }
                                style={{ padding: "6px 8px" }}
                            />
                            <input
                                className="fs-7 col-10"
                                type="text"
                                value={fieldValue(row, "password")}
                                onChange={(e) =>
                                    setEditing((s) => ({ ...s, [row.id]: { ...s[row.id], password: e.target.value } }))
                                }
                                style={{ padding: "6px 8px" }}
                            />
                            <input
                                readOnly
                                className="fs-7 alert-secondary"
                                value={fieldValue(row, "patientTable")}
                                onChange={(e) =>
                                    setEditing((s) => ({ ...s, [row.id]: { ...s[row.id], patientTable: e.target.value } }))
                                }
                                style={{ padding: "6px 8px" }}
                            />
                            <input
                                readOnly
                                className="fs-7 alert-secondary"
                                value={fieldValue(row, "historyTable")}
                                onChange={(e) =>
                                    setEditing((s) => ({ ...s, [row.id]: { ...s[row.id], historyTable: e.target.value } }))
                                }
                                style={{ padding: "6px 8px" }}
                            />

                            <button
                                className={saveBtnClass}
                                onClick={() => saveUser(row)}
                                style={{ padding: "6px 10px" }}
                                disabled={!edited}
                            >
                                Save
                            </button>
                        </div>
                    );
                })}

                <hr style={{ margin: "12px 0" }} />

                <div style={{ marginBottom: 8 }}>
                    <strong>Create new user</strong>
                </div>

                <div className="d-flex gap-2">
                    <input
                        className="fs-7 col-10"
                        placeholder="Username"
                        value={newUser.userName}
                        onChange={(e) => setNewUser((s) => ({ ...s, userName: e.target.value }))}
                        style={{ padding: "6px 8px" }}
                    />
                    <input
                        className="fs-7 col-10"
                        type="text"
                        placeholder="Password"
                        value={newUser.password}
                        onChange={(e) => setNewUser((s) => ({ ...s, password: e.target.value }))}
                        style={{ padding: "6px 8px" }}
                    />
                    <input
                        className="fs-7 alert-secondary"
                        readOnly
                        placeholder="Patient Table"
                        value="Patient_DEMO"
                        onChange={(e) => setNewUser((s) => ({ ...s, patientTable: e.target.value }))}
                        style={{ padding: "6px 8px" }}
                    />
                    <input
                        readOnly
                        className="fs-7 alert-secondary"
                        placeholder="History Table"
                        value="Patient_History_DEMO"
                        onChange={(e) => setNewUser((s) => ({ ...s, historyTable: e.target.value }))}
                        style={{ padding: "6px 8px" }}
                    />
                    <div className="flex-grow-1">
                        <button
                            className={insertBtnClass}
                            onClick={createUser}
                            disabled={!canInsert}
                            style={{ padding: "6px 10px" }}
                        >
                            Insert
                        </button>
                    </div>
                </div>
            </div>
        </DragBox>
    );
}
