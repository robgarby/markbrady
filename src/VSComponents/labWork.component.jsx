import React, { useEffect } from "react";
import { useGlobalContext } from '../Context/global.context.jsx';
import PatientInfo from './PopUpBoxes/Patientbox/patientBox.component';
import { ZStackProvider } from "../Context/ZStack.context.jsx";
import DynacareLab from "./LabWork/dynacareLab.component.jsx";
import LifeLab from "./LabWork/lifeLab.component.jsx";

const LabWork = ({
  selectedTopButtons = [],
  theUser = null, // this is the actual user logged in
  activePatient = null,  // this is the active patient
}) => {

  const { mainButton } = useGlobalContext();

  useEffect(() => {
    console.log("LabWork component mounted or updated " + mainButton);
    return () => {
      console.log("LabWork component unmounted or about to update " + mainButton);
    };
  }, [mainButton]);

  return (
    <>
      <ZStackProvider>
        {activePatient && (
          <PatientInfo user={theUser} thePatient={activePatient} loading={false} />
        )}

        {mainButton === "dynacare" && (
          <DynacareLab onParsed={(data) => console.log("Dynacare parsed data:", data)} />
        )}

        {mainButton === "lifelab" && (
          <LifeLab onParsed={(data) => console.log("LifeLab parsed data:", data)} />
        )}
      </ZStackProvider>
    </>
  );
};

function EmptyState() {
  return <div className="text-center text-muted"></div>;
}

export default LabWork;
