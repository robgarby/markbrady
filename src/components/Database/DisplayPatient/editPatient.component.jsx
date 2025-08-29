import React, { useState } from 'react';
import { useGlobalContext } from '../../../Context/global.context';

const LabResultsEditor = () => {
     const { activePatient,setActivePatient,setVisibleBox} = useGlobalContext();
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

     const handleChange = (field, value) => {
          setLabData(prev => ({ ...prev, [field]: value }));
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
          // TODO: submit to backend or update global state
           try {
               const response = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({hcn: activePatient.healthNumber, labs : labData, script: "updateLabs" }),
               });
               const data = await response.json();
               if (data.success) {
               // ✅ Merge labData directly into activePatient
               const updatedPatient = { ...activePatient, ...labData };

               // ✅ Update the global state via context
               setActivePatient(updatedPatient);
               setVisibleBox("ClientDetails");


          } else {
               alert("Failed to update lab results.");
          }
              
          } catch (error) {
               console.error('Error checking health number:', error);
          }
     };

     return (
          <div className="container-fluid px-4 py-3">
               <div className="d-flex mb-3">
                    <h4>Edit Lab Results</h4>
                    <div className="ms-auto text-danger fs-6 me-3">{activePatient.clientName} - {activePatient.healthNumber}</div>
               </div>
               <form>
                    <div className="row">
                         {/* Column 1 */}
                         <div className="col-24">
                              {renderInputRow("Cholesterol", "cholesterol", "cholesterolDate")}
                              {renderInputRow("Triglyceride", "triglyceride", "triglycerideDate")}
                              {renderInputRow("HDL", "hdl", "hdlDate")}
                              {renderInputRow("LDL", "ldl", "ldlDate")}
                              {renderInputRow("Non-HDL", "nonHdl", "nonHdlDate")}
                              {renderInputRow("Cholesterol/HDL Ratio", "cholesterolHdlRatio", "cholesterolHdlRatioDate")}
                              {renderInputRow("Creatine Kinase", "creatineKinase", "creatineKinaseDate")}
                              {renderInputRow("ALT (Alanine Aminotransferase)", "alanineAminotransferase", "alanineAminotransferaseDate")}
                              {renderInputRow("Lipoprotein A", "lipoproteinA", "lipoproteinADate")}
                              {renderInputRow("Apolipoprotein B", "apolipoproteinB", "apolipoproteinBDate")}
                              {renderInputRow("BNP", "natriureticPeptideB", "natriureticPeptideBDate")}
                         </div>

                         {/* Column 2 */}
                         <div className="col-24">
                              {renderInputRow("Urea", "urea", "ureaDate")}
                              {renderInputRow("Creatinine", "creatinine", "creatinineDate")}
                              {renderInputRow("GFR", "gfr", "gfrDate")}
                              {renderInputRow("Albumin", "albumin", "albuminDate")}
                              {renderInputRow("Sodium", "sodium", "sodiumDate")}
                              {renderInputRow("Potassium", "potassium", "potassiumDate")}
                              {renderInputRow("Vitamin B12", "vitaminB12", "vitaminB12Date")}
                              {renderInputRow("Ferritin", "ferritin", "ferritinDate")}
                              {renderInputRow("Hemoglobin A1C", "hemoglobinA1C", "hemoglobinA1CDate")}
                              {renderInputRow("Urine Albumin", "urineAlbumin", "urineAlbuminDate")}
                              {renderInputRow("Albumin/Creatinine Ratio", "albuminCreatinineRatio", "albuminCreatinineRatioDate")}
                         </div>
                    </div>
                    <div className="d-flex gap-2 justify-content-end mt-4 me-3">
                         <div className="col-8"><div className="btn btn-primary w-100 text-white" onClick={()=>handleSave()}>Save</div></div>
                         <div className="col-8"><div className="btn btn-danger w-100 text-white" onClick={()=>setVisibleBox("ClientDetails")}>Cancel</div></div>
                    </div>
               </form>

          </div>
     );
};

export default LabResultsEditor;
