import React, { useEffect } from "react";
import { useGlobalContext } from "../Context/global.context.jsx";
import PatientInfo from "./PopUpBoxes/Patientbox/patientBox.component";
import { ZStackProvider } from "../Context/ZStack.context.jsx";
import DynacareLab from "./SideButtonBoxes/LabUpload/dynacareLab.component.jsx";
import LifeLab from "./SideButtonBoxes/LabUpload/lifeLab.component.jsx";
import PharmacyMedHistory from "./LabWork/pharmacy.component.jsx";
import ReadHospitalConditions from "../components/UploadLab/readHospital.component.jsx";

const LabWork = ({
  selectedTopButtons = [],
  theUser = null,
  activePatient = null,
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

        {mainButton === "pharmacy" && (
          <PharmacyMedHistory onParsed={(data) => console.log("Pharmacy parsed data:", data)} />
        )}

        {mainButton === "hospital" && (
          <div className="mt-2">
            <ReadHospitalConditions
              onHospitalParsed={() => console.log("Hospital parsed")}
              onHospitalSaved={() => console.log("Hospital saved")}
            />
          </div>
        )}
      </ZStackProvider>
    </>
  );
};

function EmptyState() {
  return <div className="text-center text-muted"></div>;
}

export default LabWork;