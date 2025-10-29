// src/components/Database/DisplayPatient/Patient/labResults.component.jsx
import React from 'react';
import DragBox from '../../DragBox/Drag/dragBox.component.jsx';
import { useGlobalContext } from "../../../Context/global.context.jsx";

const LabResults = ({ activePatient, user }) => {
  const p = activePatient || {};
  const { selectedTopButtons, setSelectedTopButtons, setActivePatient } = useGlobalContext();

  // ----- view/edit mode -----
  const [editMode, setEditMode] = React.useState(false);

  // Snapshot of original values for dirty/cancel logic (NOTE the fixed creatineKinaseDate)
  const originalRef = React.useRef({
    cholesterol: p.cholesterol ?? "",
    cholesterolDate: p.cholesterolDate ?? "",
    triglyceride: p.triglyceride ?? "",
    triglycerideDate: p.triglycerideDate ?? "",
    hdl: p.hdl ?? "",
    hdlDate: p.hdlDate ?? "",
    ldl: p.ldl ?? "",
    ldlDate: p.ldlDate ?? "",
    nonHdl: p.nonHdl ?? "",
    nonHdlDate: p.nonHdlDate ?? "",
    cholesterolHdlRatio: p.cholesterolHdlRatio ?? "",
    cholesterolHdlRatioDate: p.cholesterolHdlRatioDate ?? "",
    creatineKinase: p.creatineKinase ?? "",
    creatineKinaseDate: p.creatineKinaseDate ?? "",
    alanineAminotransferase: p.alanineAminotransferase ?? "",
    alanineAminotransferaseDate: p.alanineAminotransferaseDate ?? "",
    lipoproteinA: p.lipoproteinA ?? "",
    lipoproteinADate: p.lipoproteinADate ?? "",
    apolipoproteinB: p.apolipoproteinB ?? "",
    apolipoproteinBDate: p.apolipoproteinBDate ?? "",
    natriureticPeptideB: p.natriureticPeptideB ?? "",
    natriureticPeptideBDate: p.natriureticPeptideBDate ?? "",
    urea: p.urea ?? "",
    ureaDate: p.ureaDate ?? "",
    creatinine: p.creatinine ?? "",
    creatinineDate: p.creatinineDate ?? "",
    gfr: p.gfr ?? "",
    gfrDate: p.gfrDate ?? "",
    albumin: p.albumin ?? "",
    albuminDate: p.albuminDate ?? "",
    sodium: p.sodium ?? "",
    sodiumDate: p.sodiumDate ?? "",
    potassium: p.potassium ?? "",
    potassiumDate: p.potassiumDate ?? "",
    vitaminB12: p.vitaminB12 ?? "",
    vitaminB12Date: p.vitaminB12Date ?? "",
    ferritin: p.ferritin ?? "",
    ferritinDate: p.ferritinDate ?? "",
    hemoglobinA1C: p.hemoglobinA1C ?? "",
    hemoglobinA1CDate: p.hemoglobinA1CDate ?? "",
    urineAlbumin: p.urineAlbumin ?? "",
    urineAlbuminDate: p.urineAlbuminDate ?? "",
    albuminCreatinineRatio: p.albuminCreatinineRatio ?? "",
    albuminCreatinineRatioDate: p.albuminCreatinineRatioDate ?? "",
  });

  // Controlled form model (edit mode)
  const [form, setForm] = React.useState(originalRef.current);
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  // Sync when switching patients
  React.useEffect(() => {
    const next = {
      cholesterol: p.cholesterol ?? "",
      cholesterolDate: p.cholesterolDate ?? "",
      triglyceride: p.triglyceride ?? "",
      triglycerideDate: p.triglycerideDate ?? "",
      hdl: p.hdl ?? "",
      hdlDate: p.hdlDate ?? "",
      ldl: p.ldl ?? "",
      ldlDate: p.ldlDate ?? "",
      nonHdl: p.nonHdl ?? "",
      nonHdlDate: p.nonHdlDate ?? "",
      cholesterolHdlRatio: p.cholesterolHdlRatio ?? "",
      cholesterolHdlRatioDate: p.cholesterolHdlRatioDate ?? "",
      creatineKinase: p.creatineKinase ?? "",
      creatineKinaseDate: p.creatineKinaseDate ?? "",
      alanineAminotransferase: p.alanineAminotransferase ?? "",
      alanineAminotransferaseDate: p.alanineAminotransferaseDate ?? "",
      lipoproteinA: p.lipoproteinA ?? "",
      lipoproteinADate: p.lipoproteinADate ?? "",
      apolipoproteinB: p.apolipoproteinB ?? "",
      apolipoproteinBDate: p.apolipoproteinBDate ?? "",
      natriureticPeptideB: p.natriureticPeptideB ?? "",
      natriureticPeptideBDate: p.natriureticPeptideBDate ?? "",
      urea: p.urea ?? "",
      ureaDate: p.ureaDate ?? "",
      creatinine: p.creatinine ?? "",
      creatinineDate: p.creatinineDate ?? "",
      gfr: p.gfr ?? "",
      gfrDate: p.gfrDate ?? "",
      albumin: p.albumin ?? "",
      albuminDate: p.albuminDate ?? "",
      sodium: p.sodium ?? "",
      sodiumDate: p.sodiumDate ?? "",
      potassium: p.potassium ?? "",
      potassiumDate: p.potassiumDate ?? "",
      vitaminB12: p.vitaminB12 ?? "",
      vitaminB12Date: p.vitaminB12Date ?? "",
      ferritin: p.ferritin ?? "",
      ferritinDate: p.ferritinDate ?? "",
      hemoglobinA1C: p.hemoglobinA1C ?? "",
      hemoglobinA1CDate: p.hemoglobinA1CDate ?? "",
      urineAlbumin: p.urineAlbumin ?? "",
      urineAlbuminDate: p.urineAlbuminDate ?? "",
      albuminCreatinineRatio: p.albuminCreatinineRatio ?? "",
      albuminCreatinineRatioDate: p.albuminCreatinineRatioDate ?? "",
    };
    originalRef.current = next;
    setForm(next);
    setEditMode(false);
    setMsg("");
  }, [p.id]); // when activePatient changes

  // Dirty check
  const isDirty = React.useMemo(() => {
    const a = originalRef.current, b = form;
    for (const k in a) {
      if ((a[k] ?? "") !== (b[k] ?? "")) return true;
    }
    return false;
  }, [form]);

  const onChange = (field) => (e) => {
    const val = e.target.value;
    setForm((f) => ({ ...f, [field]: val }));
  };

  // -------- display row (skip empties) --------
  const renderRow = (label, value, date) => {
    if (
      value === null ||
      value === '' ||
      (typeof value === 'string' && value.trim() === '') ||
      (!isNaN(parseFloat(value)) && parseFloat(value) === 0)
    ) return null;

    const displayValue = date
      ? `<span class="fw-bold pe-5">${value}</span> <span class="text-muted">(${date})</span>`
      : value;

    return (
      <div className="d-flex justify-content-between py-1 border-bottom" key={label}>
        <span className='text-purple fw-bold'>{label}:</span>
        <span dangerouslySetInnerHTML={{ __html: displayValue }} />
      </div>
    );
  };

  // -------- edit row (always render) --------
  const renderEditRow = (label, value, date, keyName, keyDate) => {
    const inputId = keyName.toString().toLowerCase().replace(/\s+/g, "-");
    return (
      <div className="row align-items-center py-1 border-bottom" key={keyName}>
        <div className="col-16 text-start">
          <span className="text-danger fw-bold">{label}</span>
        </div>
        <div className="col-16">
          <input
            id={`${inputId}-value`}
            className="form-control form-control-sm"
            type="text"
            value={value ?? ""}
            placeholder="—"
            onChange={onChange(keyName)}
          />
        </div>
        <div className="col-16">
          <input
            id={`${inputId}-date`}
            className="form-control form-control-sm"
            type="date"
            value={date ?? ""}
            onChange={onChange(keyDate)}
          />
        </div>
      </div>
    );
  };

  // -------- actions --------
  const enterEdit = () => setEditMode(true);

  const cancelEdit = () => {
    setForm(originalRef.current); // revert values
    setEditMode(false);           // exit edit mode
    setMsg("");
  };

  const saveLabs = async () => {
    if (!activePatient?.id || !isDirty) {
      setEditMode(false); // no changes: just exit edit mode
      return;
    }

    setSaving(true);
    setMsg("");

    try {
      const resp = await fetch("https://gdmt.ca/PHP/special.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "saveLabs",
          patientID: activePatient.id,
          patientDB: user?.patientTable || "Patient",
          historyDB: user?.historyTable || "Patient_History",
          // send all fields (NOTE creatineKinaseDate)
          ...form,
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (resp.ok && data?.success === true && Number(data?.affected_rows) === 1) {
        // commit new originals
        originalRef.current = { ...form };
        // push into context so UI reflects immediately
        if (typeof setActivePatient === "function") {
          setActivePatient((prev) => ({ ...(prev || activePatient || {}), ...form }));
        }
        setMsg("Saved.");
        setEditMode(false); // exit edit mode
      } else {
        setMsg(data?.error || data?.message || "Save failed.");
      }
    } catch (e) {
      setMsg("Error saving lab results.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DragBox
      storageKey="LAB_RESULTS_POSITION"
      defaultPos={{ x: 300, y: 340 }}
      title="Lab Results [FULLY WORKING]"
      width={600}
      zIndex={2050}
      addNote="-" // no DragBox button; actions are inside the body
      onClose={() => {
        const updatedButtons = (selectedTopButtons || []).filter(btn => btn !== 'lab');
        setSelectedTopButtons?.(updatedButtons);
      }}
    >
      <div className='p-0' style={{ maxHeight: 400, overflowY: 'auto' }}>
        {/* In-body action bar (like Address) */}
        <div className="d-flex align-items-center p-0 mb-2">
          <div className="ms-auto d-flex gap-2">
            {!editMode ? (
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={enterEdit}
                title="Edit Lab Results"
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  className={`btn btn-sm ${isDirty ? 'btn-success text-white' : 'btn-outline-success'}`}
                  disabled={!isDirty || saving}
                  onClick={saveLabs}
                  title={isDirty ? 'Save changes' : 'No changes to save'}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  disabled={saving}
                  onClick={cancelEdit}
                  title="Cancel editing"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>

        {!editMode ? (
          <div className="small">
            {renderRow('Cholesterol', p.cholesterol, p.cholesterolDate)}
            {renderRow('Triglyceride', p.triglyceride, p.triglycerideDate)}
            {renderRow('HDL', p.hdl, p.hdlDate)}
            {renderRow('LDL', p.ldl, p.ldlDate)}
            {renderRow('Non-HDL', p.nonHdl, p.nonHdlDate)}
            {renderRow('Cholesterol/HDL Ratio', p.cholesterolHdlRatio, p.cholesterolHdlRatioDate)}
            {renderRow('Creatine Kinase', p.creatineKinase, p.creatineKinaseDate)}
            {renderRow('ALT (Alanine Aminotransferase)', p.alanineAminotransferase, p.alanineAminotransferaseDate)}
            {renderRow('Lipoprotein A', p.lipoproteinA, p.lipoproteinADate)}
            {renderRow('Apolipoprotein B', p.apolipoproteinB, p.apolipoproteinBDate)}
            {renderRow('BNP', p.natriureticPeptideB, p.natriureticPeptideBDate)}
            {renderRow('Urea', p.urea, p.ureaDate)}
            {renderRow('Creatinine', p.creatinine, p.creatinineDate)}
            {renderRow('GFR', p.gfr, p.gfrDate)}
            {renderRow('Albumin', p.albumin, p.albuminDate)}
            {renderRow('Sodium', p.sodium, p.sodiumDate)}
            {renderRow('Potassium', p.potassium, p.potassiumDate)}
            {renderRow('Vitamin B12', p.vitaminB12, p.vitaminB12Date)}
            {renderRow('Ferritin', p.ferritin, p.ferritinDate)}
            {renderRow('Hemoglobin A1C', p.hemoglobinA1C, p.hemoglobinA1CDate)}
            {renderRow('Urine Albumin', p.urineAlbumin, p.urineAlbuminDate)}
            {renderRow('Albumin/Creatinine Ratio', p.albuminCreatinineRatio, p.albuminCreatinineRatioDate)}
            {msg && <div className="small mt-2 text-muted">{msg}</div>}
          </div>
        ) : (
          <div className="small">
            {renderEditRow('Cholesterol', form.cholesterol, form.cholesterolDate, 'cholesterol', 'cholesterolDate')}
            {renderEditRow('Triglyceride', form.triglyceride, form.triglycerideDate, 'triglyceride', 'triglycerideDate')}
            {renderEditRow('HDL', form.hdl, form.hdlDate, 'hdl', 'hdlDate')}
            {renderEditRow('LDL', form.ldl, form.ldlDate, 'ldl', 'ldlDate')}
            {renderEditRow('Non-HDL', form.nonHdl, form.nonHdlDate, 'nonHdl', 'nonHdlDate')}
            {renderEditRow('Cholesterol/HDL Ratio', form.cholesterolHdlRatio, form.cholesterolHdlRatioDate, 'cholesterolHdlRatio', 'cholesterolHdlRatioDate')}
            {renderEditRow('Creatine Kinase', form.creatineKinase, form.creatineKinaseDate, 'creatineKinase', 'creatineKinaseDate')}
            {renderEditRow('ALT (Alanine Aminotransferase)', form.alanineAminotransferase, form.alanineAminotransferaseDate, 'alanineAminotransferase', 'alanineAminotransferaseDate')}
            {renderEditRow('Lipoprotein A', form.lipoproteinA, form.lipoproteinADate, 'lipoproteinA', 'lipoproteinADate')}
            {renderEditRow('Apolipoprotein B', form.apolipoproteinB, form.apolipoproteinBDate, 'apolipoproteinB', 'apolipoproteinBDate')}
            {renderEditRow('BNP', form.natriureticPeptideB, form.natriureticPeptideBDate, 'natriureticPeptideB', 'natriureticPeptideBDate')}
            {renderEditRow('Urea', form.urea, form.ureaDate, 'urea', 'ureaDate')}
            {renderEditRow('Creatinine', form.creatinine, form.creatinineDate, 'creatinine', 'creatinineDate')}
            {renderEditRow('GFR', form.gfr, form.gfrDate, 'gfr', 'gfrDate')}
            {renderEditRow('Albumin', form.albumin, form.albuminDate, 'albumin', 'albuminDate')}
            {renderEditRow('Sodium', form.sodium, form.sodiumDate, 'sodium', 'sodiumDate')}
            {renderEditRow('Potassium', form.potassium, form.potassiumDate, 'potassium', 'potassiumDate')}
            {renderEditRow('Vitamin B12', form.vitaminB12, form.vitaminB12Date, 'vitaminB12', 'vitaminB12Date')}
            {renderEditRow('Ferritin', form.ferritin, form.ferritinDate, 'ferritin', 'ferritinDate')}
            {renderEditRow('Hemoglobin A1C', form.hemoglobinA1C, form.hemoglobinA1CDate, 'hemoglobinA1C', 'hemoglobinA1CDate')}
            {renderEditRow('Urine Albumin', form.urineAlbumin, form.urineAlbuminDate, 'urineAlbumin', 'urineAlbuminDate')}
            {renderEditRow('Albumin/Creatinine Ratio', form.albuminCreatinineRatio, form.albuminCreatinineRatioDate, 'albuminCreatinineRatio', 'albuminCreatinineRatioDate')}

            {msg && <div className="small mt-2 text-muted">{msg}</div>}
          </div>
        )}
      </div>
    </DragBox>
  );
};

export default LabResults;
