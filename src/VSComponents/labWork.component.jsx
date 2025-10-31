import React, { useEffect } from "react";
import PatientInfo from './PopUpBoxes/Patientbox/patientBox.component';
import { ZStackProvider } from "../Context/ZStack.context.jsx";
import DynacareLab from "./LabWork/dynacareLab.component.jsx";


const LabWork = ({
  selectedTopButtons = [],
  theUser = null, // this is the actual user logged in
  activePatient = null,  // this is the active patient
}) => {

    

  return (
    <>
      <ZStackProvider>
        {activePatient && (
          <PatientInfo user={theUser} thePatient={activePatient} loading={false} />
        )}
        <DynacareLab onParsed={(data) => console.log("Parsed data:", data)} />
      </ZStackProvider>
    </>
  );
};


function EmptyState() {
  return <div className="text-center text-muted"></div>;
}
export default LabWork;
