import React from 'react';
import DragBox from '../../DragBox/Drag/dragBox.component.jsx';
import { useGlobalContext } from "../../../Context/global.context.jsx";

const PrivateNote = ({ activePatient, user }) => {
    const {
        selectedTopButtons,
        setSelectedTopButtons,
        activePatient: ctxPatient,              // in case you expose it in context
        setActivePatient,                       // preferred setter if available
        updateActivePatient,                    // fallback name if used in your app
    } = useGlobalContext();

    const originalRef = React.useRef(activePatient?.privateNote ?? "");
    const [note, setNote] = React.useState(activePatient?.privateNote ?? "");
    const [saving, setSaving] = React.useState(false);
    const [msg, setMsg] = React.useState("");

    // keep local note in sync if the active patient changes
    React.useEffect(() => {
        const next = activePatient?.privateNote ?? "";
        originalRef.current = next;
        setNote(next);
    }, [activePatient?.id]); // change on patient switch

    const isDirty = note !== originalRef.current;

    const handleNoteChange = (e) => setNote(e.target.value);

    // ==== DO NOT change your save logic – we only add post-success updates ====
    const savePrivateNote = async () => {
        setSaving(true);
        setMsg("");

        const patientID = activePatient.id;
        const patientDB = user.patientTable || "User";
        const historyDB = user.historyTable || "User_History";

        try {
            const resp = await fetch('https://gdmt.ca/PHP/database.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script: 'updatePrivateNote',
                    patientID: patientID,
                    privateNote: note,
                    patientDB: patientDB,
                    historyDB: historyDB,
                }),
            });

            const data = await resp.json();
            if (data.success) {
                // Only commit locally when the DB confirms a write
                if (Number(data.affected_rows) === 1) {
                    // 1) update “original” so we’re no longer dirty
                    originalRef.current = note;

                    // 2) push the change into the activePatient object in context
                    const updated = { ...(activePatient || {}), privateNote: note };
                    if (typeof setActivePatient === 'function') {
                        setActivePatient(updated);
                    } else if (typeof updateActivePatient === 'function') {
                        updateActivePatient(updated);
                    }
                    setMsg("Saved.");
                } else {
                    setMsg("Nothing changed.");
                }
            } else {
                console.log(data.message);
                setMsg(data.message || 'Error saving note.');
            }
        } catch (e) {
            setMsg('Error saving note.');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setNote(originalRef.current); // revert to original
        setMsg("Reverted.");
    };

    const closeBox = (box) => () => {
        const updatedButtons = (selectedTopButtons || []).filter((btn) => btn !== box);
        setSelectedTopButtons?.(updatedButtons);
    };

    return (
        <DragBox
            storageKey="PRIVATE_NOTE_POSITION"
            defaultPos={{ x: 300, y: 340 }}
            title="Private Note [FULLY WORKING]"
            width={600}
            onAdd={null}
            zIndex={2050}
            addNote="-"
            onClose={closeBox('private')}
        >
            <div className="card-body">
                <label htmlFor="privateNote" className="form-label fw-bold text-primary">Private Note</label>
                <textarea
                    id="privateNote"
                    className="form-control fs-7"
                    rows={5}
                    value={note}
                    onChange={handleNoteChange}
                    placeholder="Enter private notes..."
                    maxLength={500}
                />

                <div className="d-flex align-items-center mt-2 gap-2">
                    {/* Save: outline + disabled until dirty; solid when dirty */}
                    <button
                        className={`btn ${isDirty ? 'btn-success text-white' : 'btn-outline-success'}`}
                        disabled={!isDirty || saving}
                        onClick={savePrivateNote}
                        title={isDirty ? 'Save changes' : 'No changes to save'}
                    >
                        {saving ? 'Saving…' : 'Save Private Note'}
                    </button>

                    {/* Cancel: only visible when dirty */}
                    {isDirty && (
                        <button
                            className="btn btn-outline-secondary"
                            disabled={saving}
                            onClick={handleCancel}
                            title="Revert to previous text"
                        >
                            Cancel
                        </button>
                    )}

                    <small className="text-muted ms-auto">{note.length}/500</small>
                </div>
            </div>
        </DragBox>
    );
};

export default PrivateNote;
