// src/components/Patient/patientRecs.component.jsx
import React, { useEffect, useRef, useState } from "react";
import { useGlobalContext } from "../../../../Context/global.context";

const PatientRecs = () => {
  const gc = useGlobalContext();
  const { activePatient, setActivePatient } = gc || {};

  const [text, setText] = useState(activePatient?.recommendations ?? "");
  const [orig, setOrig] = useState(activePatient?.recommendations ?? "");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // "ok" | "err" | null
  const hasMountedRef = useRef(false);

  useEffect(() => {
    if (!hasMountedRef.current) hasMountedRef.current = true;
    setText(activePatient?.recommendations ?? "");
    setOrig(activePatient?.recommendations ?? "");
    setStatus(null); // reset any old badges when switching patients
  }, [activePatient?.id]);

  const canSave =
    !saving &&
    (activePatient?.id ?? null) &&
    (text ?? "") !== (orig ?? "");

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setStatus(null);

    try {
      const res = await fetch("https://optimizingdyslipidemia.com/PHP/special.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          script: "updateRecommendations",
          patientID: activePatient.id,
          recommendations: text,
        }),
      });

      let data = null;
      try { data = await res.json(); } catch {}

      if (res.ok && data && data.success) {
        setActivePatient?.({ ...(activePatient || {}), recommendations: text });
        setOrig(text);
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

  return (
    <div className="d-flex flex-column w-100 h-100" style={{ minHeight: 0 }}>
      <div className="d-flex align-items-center justify-content-between mb-2">
        <label htmlFor="patient-recs-textarea" className="form-label fw-bold mb-0">
          Recommendations
        </label>
        <div className="d-flex align-items-center gap-2">
          {status === "ok" && <span className="badge bg-success">Saved</span>}
          {status === "err" && <span className="badge bg-danger">Save failed</span>}
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!canSave}
            onClick={onSave}
            title={saving ? "Saving…" : "Save"}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Textarea fills remaining height; start typing clears badges */}
      <div className="flex-grow-1 d-flex" style={{ minHeight: 0 }}>
        <textarea
          id="patient-recs-textarea"
          className="form-control flex-grow-1"
          value={text}
          onChange={(e) => {
            setStatus(null);            // <-- hide "Saved"/"Save failed" as soon as typing begins
            setText(e.target.value);
          }}
          placeholder="Enter recommendations for this patient…"
          style={{ whiteSpace: "pre-wrap", minHeight: 0, overflow: "auto" }}
        />
      </div>

      <div className="text-muted small mt-2">
        {(text || "").length} characters
        {activePatient?.id ? "" : " • (No active patient selected)"}
        {canSave ? " • Unsaved changes" : ""}
      </div>
    </div>
  );
};

export default PatientRecs;
