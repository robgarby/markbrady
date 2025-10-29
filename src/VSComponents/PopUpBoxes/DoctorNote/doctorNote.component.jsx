import React from 'react';
import DragBox from '../../DragBox/Drag/dragBox.component.jsx';
import { useGlobalContext } from "../../../Context/global.context.jsx";

const DoctorNote = ({ setActivePatient, activePatient, user }) => {
  const { selectedTopButtons, setSelectedTopButtons } = useGlobalContext();

  // keep an immutable copy of the original to detect dirty + enable cancel
  const originalRef = React.useRef(activePatient?.patientNote ?? "");
  const [note, setNote] = React.useState(activePatient?.patientNote ?? "");
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState('');

  // refresh local state when switching patients
  React.useEffect(() => {
    const next = activePatient?.patientNote ?? "";
    originalRef.current = next;
    setNote(next);
  }, [activePatient?.id]);

  const isDirty = note !== originalRef.current;

  const onNoteChange = (e) => setNote(e.target.value); // local only; do NOT push to context yet

  // === mirror savePrivateNote logic exactly ===
  const saveDoctorNote = async () => {
    if (!activePatient) return;

    setSaving(true);
    setMsg("");

    // keep your table defaults; change if your app expects "User"/"User_History"
    const patientDB  = user?.patientTable || "Patient";
    const historyDB  = user?.historyTable || "Patient_History";

    try {
      const resp = await fetch('https://gdmt.ca/PHP/database.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: 'updatePatientNote',
          // keep using healthNumber here (you said PHP will return the same shape as private)
          healthNumber: activePatient.healthNumber,
          patientNote: note,
          patientDB,
          historyDB,
        }),
      });

      const data = await resp.json();

      if (data.success) {
        // Only commit locally when the DB confirms a write
        if (Number(data.affected_rows) === 1) {
          // 1) update “original” so we’re no longer dirty
          originalRef.current = note;

          // 2) push the change into the activePatient object in context
          const updated = { ...(activePatient || {}), patientNote: note };
          if (typeof setActivePatient === 'function') {
            setActivePatient(updated);
          } else if (typeof (window.updateActivePatient) === 'function') {
            // optional fallback if you expose a global/update fn elsewhere
            window.updateActivePatient(updated);
          }

          setMsg("Saved.");
        } else {
          setMsg("Nothing changed.");
        }
      } else {
        setMsg(data.message || 'Error saving note.');
      }
    } catch (e) {
      setMsg('Error saving note.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setNote(originalRef.current); // revert to original text
    setMsg("Reverted.");
  };

  const closeBox = (box) => () => {
    const updatedButtons = (selectedTopButtons || []).filter(btn => btn !== box);
    setSelectedTopButtons?.(updatedButtons);
  };

  return (
    <DragBox
      storageKey="DOCTOR_NOTE_POSITION"
      defaultPos={{ x: 300, y: 340 }}
      title="Doctor Note [FULLY WORKING]"
      width={600}
      onAdd={null}
      zIndex={2050}
      addNote="-"
      onClose={closeBox('dr')}
    >
      <div className="card-body">
        <label htmlFor="patientNote" className="form-label fw-bold text-primary">Note to Doctor</label>
        <textarea
          id="patientNote"
          className="form-control fs-7"
          rows={5}
          value={note}
          onChange={onNoteChange}
          placeholder="Enter notes about this patient..."
          maxLength={500}  // match Private Note capacity
        />

        <div className="d-flex align-items-center mt-2 gap-2">
          {/* Save: outline + disabled until dirty; solid when dirty */}
          <button
            className={`btn ${isDirty ? 'btn-success text-white' : 'btn-outline-success'}`}
            disabled={!isDirty || saving}
            onClick={saveDoctorNote}
            title={isDirty ? 'Save changes' : 'No changes to save'}
          >
            {saving ? 'Saving…' : 'Save Doctor Note'}
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

export default DoctorNote;
