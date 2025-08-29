import React, { useState } from 'react';
import { useGlobalContext } from '../../../Context/global.context';

const PatientDetails = () => {
     const { activePatient } = useGlobalContext();
     const [showDetails, setShowDetails] = useState(false);

     if (!activePatient) return <div className="text-muted">No patient selected.</div>;

     const renderRow = (label, value, date) => {
          if (
               value === null ||
               value === '' ||
               (typeof value === 'string' && value.trim() === '') ||
               (!isNaN(parseFloat(value)) && parseFloat(value) === 0)
          ) return null; // skip the row entirely if value is empty or 0

          const displayValue = date ? `${value} (${date})` : value;

          return (
               <div className="d-flex justify-content-between py-1 border-bottom">
                    <strong>{label}:</strong> <span>{displayValue}</span>
               </div>
          );
     };


     const patient = activePatient;

     return (
          <div className="container-fluid" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
               {/* Fixed Header Section */}
               <div className="col-48 offset-0 p-3 alert-secondary" style={{ flex: '0 0 auto' }}>
                    <h3 className="mb-3 text-danger">Patient Information</h3>

                    <div className="mb-4">
                         <h5>Personal Info</h5>
                         {renderRow("Client Name", patient.clientName)}
                         {renderRow("Health Number", patient.healthNumber)}
                         {renderRow("Sex", patient.sex)}
                         {renderRow("Date of Birth", patient.dateOfBirth)}
                    </div>

                    <button
                         className="btn btn-secondary mb-3"
                         onClick={() => setShowDetails(!showDetails)}
                    >
                         {showDetails ? "Hide Address & Provider Info" : "Show Address & Provider Info"}
                    </button>

                    {showDetails && (
                         <div className="border p-3 rounded bg-light">
                              <div className="mb-4">
                                   <h5>Address & Contact</h5>
                                   {renderRow("Full Address", patient.fullAddress)}
                                   {renderRow("Street", patient.street)}
                                   {renderRow("City", patient.city)}
                                   {renderRow("Province", patient.province)}
                                   {renderRow("Postal Code", patient.postalCode)}
                                   {renderRow("Telephone", patient.telephone)}
                              </div>

                              <div>
                                   <h5>Provider Info</h5>
                                   {renderRow("Provider Name", patient.providerName)}
                                   {renderRow("Provider Number", patient.providerNumber)}
                                   {renderRow("Order Date", patient.orderDate)}
                              </div>
                         </div>
                    )}
               </div>

               {/* Scrollable Labs Section */}
               <div
                    className="col-48 offset-0 border-top px-3 pb-3"
                    style={{
                         flex: '1 1 auto',
                         overflowY: 'auto',
                         minHeight: 0
                    }}
               >
                    <h5 className="pt-3">Lab Results</h5>

                    {renderRow("Cholesterol", patient.cholesterol, patient.cholesterolDate)}
                    {renderRow("Triglyceride", patient.triglyceride, patient.triglycerideDate)}
                    {renderRow("HDL", patient.hdl, patient.hdlDate)}
                    {renderRow("LDL", patient.ldl, patient.ldlDate)}
                    {renderRow("Non-HDL", patient.nonHdl, patient.nonHdlDate)}
                    {renderRow("Cholesterol/HDL Ratio", patient.cholesterolHdlRatio, patient.cholesterolHdlRatioDate)}

                    {renderRow("Creatine Kinase", patient.creatineKinase, patient.creatineKinaseDate)}
                    {renderRow("ALT (Alanine Aminotransferase)", patient.alanineAminotransferase, patient.alanineAminotransferaseDate)}
                    {renderRow("Lipoprotein A", patient.lipoproteinA, patient.lipoproteinADate)}
                    {renderRow("Apolipoprotein B", patient.apolipoproteinB, patient.apolipoproteinBDate)}

                    {renderRow("BNP", patient.natriureticPeptideB, patient.natriureticPeptideBDate)}
                    {renderRow("Urea", patient.urea, patient.ureaDate)}
                    {renderRow("Creatinine", patient.creatinine, patient.creatinineDate)}
                    {renderRow("GFR", patient.gfr, patient.gfrDate)}
                    {renderRow("Albumin", patient.albumin, patient.albuminDate)}
                    {renderRow("Sodium", patient.sodium, patient.sodiumDate)}
                    {renderRow("Potassium", patient.potassium, patient.potassiumDate)}

                    {renderRow("Vitamin B12", patient.vitaminB12, patient.vitaminB12Date)}
                    {renderRow("Ferritin", patient.ferritin, patient.ferritinDate)}
                    {renderRow("Hemoglobin A1C", patient.hemoglobinA1C, patient.hemoglobinA1CDate)}
                    {renderRow("Urine Albumin", patient.urineAlbumin, patient.urineAlbuminDate)}
                    {renderRow("Albumin/Creatinine Ratio", patient.albuminCreatinineRatio, patient.albuminCreatinineRatioDate)}

               </div>
          </div>
     );
};

export default PatientDetails;
