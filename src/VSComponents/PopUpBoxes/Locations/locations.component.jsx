import React, { useEffect, useState, useContext } from "react";
import DragBox from '../../DragBox/Drag/dragBox.component.jsx';
import { useGlobalContext } from "../../../Context/global.context.jsx";
import { getProviderList } from "../../../Context/functions.jsx";

/*
    Adjust these imports to match your project structure:
    - DragBox: a wrapper component for draggable popups
    - PatientContext: must provide { patientProvider, setPatientProvider }
*/

export default function Locations() {
    const [locations, setLocations] = useState([]);
    const [editing, setEditing] = useState({}); // { [id]: name }
    const [newName, setNewName] = useState("");
    const { setPatientProvider, selectedTopButtons, setSelectedTopButtons } = useGlobalContext();

    const API_ENDPOINT = "https://gdmt.ca/PHP/special.php";

    useEffect(() => {
        (async () => {
            try {
                const providers = await getProviderList();
                if (typeof setPatientProvider === "function") {
                    setPatientProvider(providers);
                    setLocations(providers);
                }
            } catch (err) {
                console.error("Failed to load providers", err);
            }
        })(); // <- invoke the async IIFE
    }, []);

    async function postToSpecial(payload) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
        const res = await fetch(API_ENDPOINT, {
            method: "POST",
            script: "saveLocation",
            body: fd,
        });
        return res.json();
    }

    async function saveLocation(id) {
        const name = editing[id];
        if (!name) return;
        try {
            const resp = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script: 'saveLocation',
                    theType: 'update',
                    name,
                    id,
                }),
            });

            const data = await resp.json();

            if (data.success) {
                const providers = await getProviderList();
                if (typeof setPatientProvider === "function") {
                    setPatientProvider(providers);
                    setLocations(providers);
                }

            } else {
                console.log('Failed to save location.');
            }
        } catch (e) {
            console.error('Error saving location:', e);
        }
    }

    async function insertLocation() {
        const name = (newName || "").trim();
        if (!name) return;
        try {
            const resp = await fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script: 'saveLocation',
                    theType: 'create',
                    name,
                }),
            });
            const data = await resp.json();
            if (data.success) {
                const providers = await getProviderList();
                if (typeof setPatientProvider === "function") {
                    setPatientProvider(providers);
                    setLocations(providers);
                    setNewName("");
                }
            } else {
                console.log('Failed to save location.');
            }
        } catch (e) {
            console.error('Error saving location:', e);
        }
    }

    const closeBox = (box) => () => {
        const updatedButtons = (selectedTopButtons || []).filter(btn => btn !== box);
        setSelectedTopButtons?.(updatedButtons);
    };

    // helper to know if a specific loc is edited
    const isEdited = (loc) => {
        const original = (loc?.providerName ?? "").trim();
        const current = ((editing[loc.id] ?? loc?.providerName) ?? "").trim();
        return current !== original;
    };

    const canInsert = (newName || "").trim().length > 0;
    const insertBtnClass = canInsert ? "btn btn-purple" : "btn btn-outline-purple";

    return (
        <DragBox
            id="LOCATIONS_BOX"
            storageKey="LOCATIONS_BOX_POSITION"
            defaultPos={{ x: 300, y: 340 }}
            title="Locations [FULLY WORKING]"
            width={600}
            onAdd={null}
            zIndex={2050}
            addNote="-"
            onClose={closeBox('locations')}>
            <div style={{ padding: 12, minWidth: 320 }}>
                <div style={{ marginBottom: 10 }}>
                    <strong>Existing locations</strong>
                </div>

                <div>
                    {locations.length === 0 && <div>No locations found.</div>}
                    {locations.map((loc) => {
                        const edited = isEdited(loc);
                        const saveBtnClass = edited ? "btn btn-success" : "btn btn-outline-success";
                        return (
                            <div key={loc.id} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                                <input
                                    className="fs-7"
                                    style={{ flex: 1, padding: "6px 8px" }}
                                    value={editing[loc.id] ?? loc.providerName}
                                    onChange={(e) => setEditing((s) => ({ ...s, [loc.id]: e.target.value }))}
                                />
                                <button
                                    className={saveBtnClass}
                                    onClick={() => saveLocation(loc.id)}
                                    style={{ padding: "6px 10px" }}
                                >
                                    Save
                                </button>
                            </div>
                        );
                    })}
                </div>

                <hr style={{ margin: "12px 0" }} />

                <div>
                    <div style={{ marginBottom: 8 }}>
                        <strong>Add new location</strong>
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                        <input
                            className="fs-7"
                            placeholder="New location name"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            style={{ flex: 1, padding: "6px 8px" }}
                        />
                        <button
                            className={insertBtnClass}
                            onClick={insertLocation}
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
