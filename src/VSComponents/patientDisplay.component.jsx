import React, { useEffect } from "react";
import Medications from "./PopUpBoxes/Mediction/medications.component";
import PrivateNote from "./PopUpBoxes/PrivateNote/privateNote.component";
import LabResults from "./PopUpBoxes/LabResults/labResults.component";
import DoctorNote from "./PopUpBoxes/DoctorNote/doctorNote.component";
import HistoryBox from "./PopUpBoxes/History/history.component";
import Conditions from "./PopUpBoxes/Conditions/condition.component";
import Recommendations from "./PopUpBoxes/Recommendations/recomment.component";
import AddressBox from "./PopUpBoxes/AddressBox/address.component";
import PatientInfo from './PopUpBoxes/Patientbox/patientBox.component';
import { ZStackProvider } from "../Context/ZStack.context.jsx";


const PatientDisplay = ({
  selectedTopButtons = [],
  theUser = null, // this is the actual user logged in
  activePatient = null,  // this is the active patient

}) => {
  const showMeds = Array.isArray(selectedTopButtons) && selectedTopButtons.includes("medications");
  const showPN = Array.isArray(selectedTopButtons) && selectedTopButtons.includes("private");
  const showLab = Array.isArray(selectedTopButtons) && selectedTopButtons.includes("lab");
  const showDoc = Array.isArray(selectedTopButtons) && selectedTopButtons.includes("dr");
  const showConditions = Array.isArray(selectedTopButtons) && selectedTopButtons.includes("conditions");
  const showRecommendations = Array.isArray(selectedTopButtons) && selectedTopButtons.includes("recommendations");
  const showAddress = Array.isArray(selectedTopButtons) && selectedTopButtons.includes("address");
  const showHistory = Array.isArray(selectedTopButtons) && selectedTopButtons.includes("history");

  useEffect(() => {

  }, [activePatient]);

  return (
    <>
      <ZStackProvider>
        {activePatient && (
          <PatientInfo user={theUser} thePatient={activePatient} loading={false} />
        )}
        {showMeds ? <Medications /> : <EmptyState />}
        {showPN
          ? (activePatient ? <PrivateNote activePatient={activePatient} user={theUser} /> : <EmptyState />)
          : <EmptyState />
        }
        {showLab
          ? (activePatient ? <LabResults activePatient={activePatient} user={theUser} /> : <EmptyState />)
          : <EmptyState />
        }
        {showDoc
          ? (activePatient ? <DoctorNote activePatient={activePatient} user={theUser} /> : <EmptyState />)
          : <EmptyState />
        }
        {showConditions ? <Conditions patient={activePatient} user={theUser}  /> : <EmptyState />}
        {showRecommendations ? <Recommendations /> : <EmptyState />}
        {showAddress ? <AddressBox activePatient={activePatient} user={theUser}  /> : <EmptyState />}
        {showHistory ? (activePatient ? <HistoryBox activePatient={activePatient} user={theUser} /> : <EmptyState />) : <EmptyState />}
      </ZStackProvider>
    </>
  );
};


function EmptyState() {
  return <div className="text-center text-muted"></div>;
}
export default PatientDisplay;
