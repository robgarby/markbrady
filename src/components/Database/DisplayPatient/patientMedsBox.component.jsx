// src/components/patient/patientMedsBox.component.jsx
import React, { useEffect, useState } from 'react';
import PatientConditionDisplay from './Patient/patientConditionDisplay.componentl.jsx';
import PatientMeds from './Patient/patientMeds.component.jsx';
// import PatientRecs from './patientRecs.component.jsx';


const PatientMedsBox = ({ Patient }) => {
  const [moTab, setMoTab] = useState('conditions');

  useEffect(() => {
    setMoTab('conditions'); // Reset to conditions when Patient changes
  }, [Patient]);

  return (
    <div
      className="flex-grow-1 ms-3 gap-2 d-flex flex-column"
      style={{ overflowY: 'hidden', minHeight: 0, minWidth: 0 }}
    >
      {/* Button bar (three equal tabs) */}
      <div className="alert-navy p-2 rounded-2 mb-1">
        <div className="row g-2">
          <div className="col-16">
            <button
              type="button"
              onClick={() => setMoTab('conditions')}
              className={`btn ${moTab === 'conditions' ? 'btn-primary' : 'btn-outline-primary'} w-100`}
              aria-pressed={moTab === 'conditions'}
            >
              Conditions
            </button>
          </div>
          <div className="col-16">
            <button
              type="button"
              onClick={() => setMoTab('meds')}
              className={`btn ${moTab === 'meds' ? 'btn-primary' : 'btn-outline-primary'} w-100`}
              aria-pressed={moTab === 'meds'}
            >
              Medications
            </button>
          </div>
          <div className="col-16">
            <button
              type="button"
              onClick={() => setMoTab('recs')}
              className={`btn ${moTab === 'recs' ? 'btn-primary' : 'btn-outline-primary'} w-100`}
              aria-pressed={moTab === 'recs'}
            >
              Recommendations
            </button>
          </div>
        </div>
      </div>

      {/* CONDITIONS */}
      {moTab === 'conditions' && (
        <div className="d-flex flex-column" style={{ flex: '1 1 0', minHeight: 0 }}>
          <div className="flex-grow-1" style={{ overflowY: 'auto', minHeight: 0 }}>
            <div className="border rounded p-3 h-100">
              <PatientConditionDisplay activePatient={Patient} />
            </div>
          </div>
        </div>
      )}

      {/* MEDS */}
      {moTab === 'meds' && (
        <div className="d-flex flex-column" style={{ flex: '1 1 0', minHeight: 0 }}>
          {/* scrolling area */}
          <div className="flex-grow-1" style={{ overflowY: 'auto', minHeight: 0 }}>
            {/* keep the border, but remove centering; stretch child */}
            <div className="border rounded p-0 h-100 d-flex flex-column align-items-stretch">
              <div className="w-100 h-100">
                <PatientMeds />
              </div>
            </div>
          </div>
        </div>
      )}


      {/* RECOMMENDATIONS */}
      {moTab === 'recs' && (
        <div className="d-flex flex-column" style={{ flex: '1 1 0', minHeight: 0 }}>
          <div className="flex-grow-1" style={{ overflowY: 'auto', minHeight: 0 }}>
            <div className="border rounded p-3 h-100 w-100 d-flex align-items-center justify-content-center">
              {/* <PatientRecs /> */}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default PatientMedsBox;
