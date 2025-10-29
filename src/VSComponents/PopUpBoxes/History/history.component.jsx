import React from 'react';
import DragBox from '../../DragBox/Drag/dragBox.component.jsx';
import PatientConditionBox from '../../../components/Database/DisplayPatient/Patient/patientCondition.component.jsx';
import { useGlobalContext } from "../../../Context/global.context.jsx";

// Adjust the path to DragBox as needed

const HistoryBox = ({ activePatient, user }) => {
    const { selectedTopButtons, setSelectedTopButtons } = useGlobalContext();

    const patient = activePatient || {};

    const renderRow = (label, value) => (
      <div className="d-flex mb-2 fs-7">
        <strong className="me-2" style={{ minWidth: '150px' }}>{label}:</strong>
        <span>{value || '—'}</span>
      </div>
    );  

    const editBox = () => {
      // Logic to open the address edit box goes here
      console.log("Edit Address box opened");
    };

    return (
        <DragBox
            storageKey="HISTORY_POSITION"
            defaultPos={{ x: 300, y: 340 }}
            title= "Patient History"
            width={800}
            onAdd={null}
            zIndex={2050}
            addNote="Edit History"
            onAddText='Edit History'
            onAddFunction={editBox}
            onClose={() => {
                const updatedButtons = selectedTopButtons.filter(btn => btn !== 'history');
                setSelectedTopButtons(updatedButtons);
            }}
        >
           <div>Patient History Content</div>
        </DragBox>
    );
};

export default HistoryBox;