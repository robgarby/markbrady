// displayBox.component.jsx
import React,{useState} from 'react';
import PatientSearch from '../PatientSearch/patientSearch.component';
import { useGlobalContext } from '../../../Context/global.context';
import PatientDetails from '../DisplayPatient/displayPatient.component';
import LabResultsEditor from '../DisplayPatient/editPatient.component';
import PatientSummary from '../DisplayPatient/viewPatientPDF.component';
import PatientFilesUpload from '../DisplayPatient/patientUploadPDF';

const DisplayBox = () => {

     const {visibleBox } = useGlobalContext();

    return (
        <div className='p-3 alert-light vh-100' style={{ width: '100%', height: '100%' }}>
            {visibleBox === 'VerifyCount' && <PatientSearch />}
            {visibleBox === 'ClientDetails' && <PatientDetails />}
            {visibleBox === 'EditLab' && <LabResultsEditor />}
            {visibleBox === 'pdfViewer' && <PatientSummary />}
            {visibleBox === 'uploadPDF' && <PatientFilesUpload />}
        </div>
    );
};

export default DisplayBox;
