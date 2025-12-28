// displayBox.component.jsx
import React,{useState} from 'react';
import PatientSearch from '../PatientSearch/patientSearch.component';
import { useGlobalContext } from '../../../Context/global.context';
import PatientDetails from '../DisplayPatient/displayPatient.component';
import LabResultsEditor from '../DisplayPatient/editPatient.component';
import PatientSummary from '../DisplayPatient/viewPatientPDF.component';
import PatientFilesUpload from '../DisplayPatient/patientUploadPDF';
import PrintLabView from '../DisplayPatient/displayPrintView.component';
import LabRangeSearch from '../PatientSearch/criteriaSearch.component';
import ResultsPage from '../PatientSearch/results.component';
import PatientHistory from '../History/displayPatientHistory.component';
import UploadThree from '../../UploadLab/uploadThree.component';
import DemoPdfPage from '../MedCheck/medCheck.component';

const DisplayBox = () => {
  const { visibleBox } = useGlobalContext();
  const isPrintView = visibleBox === 'printView';

  return (
    <div
      className={isPrintView ? '' : 'p-3 alert-light vh-100'}
      style={isPrintView ? { width: '100%', height: 'auto', background: '#fff' } : { width: '100%', height: '100%' }}
    >
      {visibleBox === 'VerifyCount' && <PatientSearch />}
      {visibleBox === 'ClientDetails' && <PatientDetails />}
      {visibleBox === 'EditLab' && <LabResultsEditor />}
      {visibleBox === 'pdfViewer' && <PatientSummary />}
      {visibleBox === 'uploadPDF' && <PatientFilesUpload />}
      {visibleBox === 'printView' && <PrintLabView />}
      {visibleBox === 'CriteriaSearch' && <LabRangeSearch />}
      {visibleBox === 'searchResults' && <ResultsPage />}
      {visibleBox === 'viewHistory' && <PatientHistory />}
      {visibleBox === 'medsCheck' && <DemoPdfPage />}
    </div>
  );
};

export default DisplayBox;
