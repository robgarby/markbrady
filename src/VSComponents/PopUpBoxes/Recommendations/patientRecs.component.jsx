// src/components/Patient/patientRecs.component.jsx
import React, { useEffect, useRef, useState } from "react";
import { useGlobalContext } from "../../../Context/global.context";
import { getUserFromToken } from '../../../Context/functions';

const PatientRecs = () => {
  const gc = useGlobalContext();
  const { activePatient, setActivePatient } = gc || {};

  const [text, setText] = useState(activePatient?.recommendations ?? "");
  const originalRef = useRef(activePatient?.recommendations ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // "ok" | "err" | null

  useEffect(() => {
    const next = activePatient?.recommendations ?? "";
    originalRef.current = next;
    setText(next);
    setStatus(null); // reset badges when switching patients
  }, [activePatient]);

  const [user, setUser] = useState(null);
  const [patientDB, setPatientDB] = useState(null);
  const [historyDB, setHistoryDB] = useState(null);
  useEffect(() => {
    (async () => {
      const userT = await getUserFromToken();
      if (userT) {
        setUser(userT);
        setPatientDB(userT.patientTable);
        setHistoryDB(userT.historyTable);
      }
    })();
  }, []);

  const isDirty = (text ?? "") !== (originalRef.current ?? "");
  const canSave = !!activePatient?.id && !saving && isDirty;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setStatus(null);

    try {
      const res = await fetch("https://gdmt.ca/PHP/special.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          script: "updateRecommendations",
          patientID: activePatient.id,
          recommendations: text,
          patientDB,
          historyDB,
        }),
      });

      let data = null;
      try { data = await res.json(); } catch {}
      const ok = !!(data && data.success === true && Number(data.affected_rows) === 1);

      if (res.ok && ok) {
        // commit locally (mirror Private/Doctor Note behavior)
        originalRef.current = text;
        setActivePatient?.({ ...(activePatient || {}), recommendations: text });
        setStatus("ok");
      } else {
        setStatus("err");
      }
    } catch {
      setStatus("err");
    } finally {
      setSaving(false);
    }
  };

  const onCancel = () => {
    setText(originalRef.current);  // revert to original
    setStatus(null);
  };

  return (
    <div className="d-flex flex-column w-100 h-100" style={{ minHeight: 0 }}>
      <label htmlFor="patient-recs-textarea" className="form-label fw-bold mb-2">
        Recommendations
      </label>

      {/* Textarea */}
      <div className="flex-grow-1 d-flex" style={{ minHeight: 0 }}>
        <textarea
          id="patient-recs-textarea"
          className="form-control fs-7 flex-grow-1"
          value={text}
          maxLength={5000} // ← limit to 500
          onChange={(e) => { setStatus(null); setText(e.target.value); }}
          placeholder="Enter recommendations for this patient…"
          style={{ whiteSpace: "pre-wrap", minHeight: 0, overflow: "auto" }}
          rows={7}
        />
      </div>

      {/* Actions under textarea (like Doctor/Private Note) */}
      <div className="d-flex align-items-center mt-2 gap-2">
        {/* Save: outline+disabled until dirty; solid when dirty */}
        <button
          type="button"
          className={`btn btn-sm ${isDirty ? "btn-success text-white" : "btn-outline-success"}`}
          disabled={!canSave}
          onClick={onSave}
          title={saving ? "Saving…" : (isDirty ? "Save changes" : "No changes to save")}
        >
          {saving ? "Saving…" : "Save Recommendations"}
        </button>

        {/* Cancel shows only when dirty, reverts text */}
        {isDirty && (
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            disabled={saving}
            onClick={onCancel}
            title="Revert to previous text"
          >
            Cancel
          </button>
        )}

        {/* Status + Counter on the right */}
        <div className="ms-auto d-flex align-items-center gap-2 pe-2">
          <small className="text-muted">{(text || "").length}/5000</small>
        </div>
      </div>

      {/* Optional tiny footnote */}
      {!activePatient?.id && (
        <div className="text-muted small mt-1">(No active patient selected)</div>
      )}
    </div>
  );
};

export default PatientRecs;
