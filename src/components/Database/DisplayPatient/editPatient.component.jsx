// src/components/Patient/editPatient.component.jsx
import React, { useState,useEffect } from 'react';
import { useGlobalContext } from '../../../Context/global.context';
import { getUserFromToken } from '../../../Context/functions';

const LabResultsEditor = () => {
  const { activePatient, setActivePatient, setVisibleBox, privateMode } = useGlobalContext();

  const [user, setUser] = React.useState(null);
  const [patientDB, setPatientDB] = useState("");
  const [historyDB, setHistoryDB] = useState("");
  const dbReady = Boolean(patientDB && historyDB);

  useEffect(() => {
      const fetchUser = async () => {
        const userData = await getUserFromToken();
        return userData;
      };
      fetchUser().then((userT) => {
        if (userT) {
          setUser(userT);
          setPatientDB(userT.patientTable);
          setHistoryDB(userT.historyTable);
          console.log('User data:', userT);
        }
      });
    }, []);


  const [labData, setLabData] = useState(() => ({
    cholesterol: activePatient?.cholesterol || '',
    cholesterolDate: activePatient?.cholesterolDate || '',
    triglyceride: activePatient?.triglyceride || '',
    triglycerideDate: activePatient?.triglycerideDate || '',
    hdl: activePatient?.hdl || '',
    hdlDate: activePatient?.hdlDate || '',
    ldl: activePatient?.ldl || '',
    ldlDate: activePatient?.ldlDate || '',
    nonHdl: activePatient?.nonHdl || '',
    nonHdlDate: activePatient?.nonHdlDate || '',
    cholesterolHdlRatio: activePatient?.cholesterolHdlRatio || '',
    cholesterolHdlRatioDate: activePatient?.cholesterolHdlRatioDate || '',
    creatineKinase: activePatient?.creatineKinase || '',
    creatineKinaseDate: activePatient?.creatineKinaseDate || '',
    alanineAminotransferase: activePatient?.alanineAminotransferase || '',
    alanineAminotransferaseDate: activePatient?.alanineAminotransferaseDate || '',
    lipoproteinA: activePatient?.lipoproteinA || '',
    lipoproteinADate: activePatient?.lipoproteinADate || '',
    apolipoproteinB: activePatient?.apolipoproteinB || '',
    apolipoproteinBDate: activePatient?.apolipoproteinBDate || '',
    natriureticPeptideB: activePatient?.natriureticPeptideB || '',
    natriureticPeptideBDate: activePatient?.natriureticPeptideBDate || '',
    urea: activePatient?.urea || '',
    ureaDate: activePatient?.ureaDate || '',
    creatinine: activePatient?.creatinine || '',
    creatinineDate: activePatient?.creatinineDate || '',
    gfr: activePatient?.gfr || '',
    gfrDate: activePatient?.gfrDate || '',
    albumin: activePatient?.albumin || '',
    albuminDate: activePatient?.albuminDate || '',
    sodium: activePatient?.sodium || '',
    sodiumDate: activePatient?.sodiumDate || '',
    potassium: activePatient?.potassium || '',
    potassiumDate: activePatient?.potassiumDate || '',
    vitaminB12: activePatient?.vitaminB12 || '',
    vitaminB12Date: activePatient?.vitaminB12Date || '',
    ferritin: activePatient?.ferritin || '',
    ferritinDate: activePatient?.ferritinDate || '',
    hemoglobinA1C: activePatient?.hemoglobinA1C || '',
    hemoglobinA1CDate: activePatient?.hemoglobinA1CDate || '',
    urineAlbumin: activePatient?.urineAlbumin || '',
    urineAlbuminDate: activePatient?.urineAlbuminDate || '',
    albuminCreatinineRatio: activePatient?.albuminCreatinineRatio || '',
    albuminCreatinineRatioDate: activePatient?.albuminCreatinineRatioDate || '',
  }));

  // -------- Private-mode helpers (display only) --------
  const isPrivate = Boolean(privateMode);
  const demoPatientLabel = (healthNumber) => {
    const digits = String(healthNumber || '').replace(/\D/g, '');
    const first4 = digits.slice(0, 4) || 'XXXX';
    return `Patient ${first4}`;
  };
  const maskHealthNumber3 = (hcn) => {
    const digits = String(hcn || '').replace(/\D/g, '');
    if (!digits) return hcn || '—';
    const first3 = digits.slice(0, 3);
    const last4 = digits.slice(-4);
    return `${first3} XXX ${last4}`;
  };
  const realName =
    activePatient?.clientName ||
    activePatient?.name ||
    (activePatient?.firstName && activePatient?.lastName
      ? `${activePatient.firstName} ${activePatient.lastName}`
      : activePatient?.lastFirstName) ||
    '—';
  const displayName = isPrivate ? demoPatientLabel(activePatient?.healthNumber) : realName;
  const displayHCN = isPrivate ? maskHealthNumber3(activePatient?.healthNumber) : (activePatient?.healthNumber || '—');

  const handleChange = (field, value) => {
    setLabData((prev) => ({ ...prev, [field]: value }));
  };

  const renderInputRow = (label, valueField, dateField) => (
    <div className="row mb-3">
      <label className="col-23 col-form-label fw-bold">{label}</label>
      <div className="col-24 d-flex gap-2">
        <input
          type="number"
          step="any"
          className="form-control"
          value={labData[valueField]}
          onChange={(e) => handleChange(valueField, e.target.value)}
          placeholder="Value"
        />
        <input
          type="date"
          className="form-control"
          value={labData[dateField]}
          onChange={(e) => handleChange(dateField, e.target.value)}
          placeholder="Date"
        />
      </div>
    </div>
  );

  const handleSave = async () => {
    try {
      const response = await fetch('https://gdmt.ca/PHP/database.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          hcn: activePatient.healthNumber,
          labs: labData, 
          script: 'updateLabs',
          patientDB: patientDB, 
          historyDB: historyDB
         }),
      });
      const data = await response.json();
      if (data.success) {
        // merge into activePatient and go back
        const updatedPatient = { ...activePatient, ...labData };
        setActivePatient(updatedPatient);
        setVisibleBox('ClientDetails');
      } else {
        alert('Failed to update lab results.');
      }
    } catch (error) {
      console.error('Error checking health number:', error);
    }
  };

  return (
    <div className="container-fluid px-4 py-3">
      <div className="d-flex mb-3">
        <h4>Edit Lab Results</h4>
        {/* Private-aware header: Name — HCN */}
        <div className="ms-auto text-danger fs-6 me-3">
          {displayName} — {displayHCN}
        </div>
      </div>

      <form>
        <div className="row">
          {/* Column 1 */}
          <div className="col-24">
            {renderInputRow('Cholesterol', 'cholesterol', 'cholesterolDate')}
            {renderInputRow('Triglyceride', 'triglyceride', 'triglycerideDate')}
            {renderInputRow('HDL', 'hdl', 'hdlDate')}
            {renderInputRow('LDL', 'ldl', 'ldlDate')}
            {renderInputRow('Non-HDL', 'nonHdl', 'nonHdlDate')}
            {renderInputRow('Cholesterol/HDL Ratio', 'cholesterolHdlRatio', 'cholesterolHdlRatioDate')}
            {renderInputRow('Creatine Kinase', 'creatineKinase', 'creatineKinaseDate')}
            {renderInputRow('ALT (Alanine Aminotransferase)', 'alanineAminotransferase', 'alanineAminotransferaseDate')}
            {renderInputRow('Lipoprotein A', 'lipoproteinA', 'lipoproteinADate')}
            {renderInputRow('Apolipoprotein B', 'apolipoproteinB', 'apolipoproteinBDate')}
            {renderInputRow('BNP', 'natriureticPeptideB', 'natriureticPeptideBDate')}
          </div>

          {/* Column 2 */}
          <div className="col-24">
            {renderInputRow('Urea', 'urea', 'ureaDate')}
            {renderInputRow('Creatinine', 'creatinine', 'creatinineDate')}
            {renderInputRow('GFR', 'gfr', 'gfrDate')}
            {renderInputRow('Albumin', 'albumin', 'albuminDate')}
            {renderInputRow('Sodium', 'sodium', 'sodiumDate')}
            {renderInputRow('Potassium', 'potassium', 'potassiumDate')}
            {renderInputRow('Vitamin B12', 'vitaminB12', 'vitaminB12Date')}
            {renderInputRow('Ferritin', 'ferritin', 'ferritinDate')}
            {renderInputRow('Hemoglobin A1C', 'hemoglobinA1C', 'hemoglobinA1CDate')}
            {renderInputRow('Urine Albumin', 'urineAlbumin', 'urineAlbuminDate')}
            {renderInputRow('Albumin/Creatinine Ratio', 'albuminCreatinineRatio', 'albuminCreatinineRatioDate')}
          </div>
        </div>

        <div className="d-flex gap-2 justify-content-end mt-4 me-3">
          <div className="col-8">
            <div className="btn btn-primary w-100 text-white" onClick={handleSave}>
              Save
            </div>
          </div>
          <div className="col-8">
            <div className="btn btn-danger w-100 text-white" onClick={() => setVisibleBox('ClientDetails')}>
              Cancel
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default LabResultsEditor;
