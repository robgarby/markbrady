import React, { act, useEffect, useState } from "react";
import { useGlobalContext } from "../Context/global.context.jsx";
import TopBarNav from "./Design/TopBar/navbar.component.jsx";
import { getMedicationData, getConditionData, getButtonsFromToken, getProviderList } from "../Context/functions.jsx";
import { getUserFromToken } from "../Context/functions.jsx";
import { navButtons } from "../Context/variables.jsx";
import PatientDisplay from "./patientDisplay.component.jsx";
import NewSearchCombo from "./newSearchCombo.component.jsx";
import ResultsPage from "../components/Database/PatientSearch/results.component.jsx";
import logo from "../assets/GMDT_Alone.svg";

export default function Layout() {


  const { activePatient, setActivePatient, medsArray, conditionData, updateMedsArray, updateConditionData, patientProvider, setPatientProvider, visibleBox, setVisibleBox, selectedTopButtons, setSelectedTopButtons } = useGlobalContext();
  const [loading, setLoading] = useState(true);
  const [topBarButtons] = useState(navButtons);
  const [theUser, setTheUser] = useState(null);
  const [showPatient, setShowPatient] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Ensure we have the user
        if (!theUser) {
          const u = await getUserFromToken();
          setTheUser(u);
        }

        // Ensure top/selected buttons are loaded (selectedTopButtons is initialized as [])
        if (!Array.isArray(selectedTopButtons) || selectedTopButtons.length === 0) {
          const b = await getButtonsFromToken();
          setSelectedTopButtons(Array.isArray(b) ? b : []);

        }

        // Load medications if none
        if (!Array.isArray(medsArray) || medsArray.length === 0) {
          const medications = await getMedicationData();
          updateMedsArray(Array.isArray(medications) ? medications : []);
        }

        // Load conditions if none
        if (!Array.isArray(conditionData) || conditionData.length === 0) {
          const conditions = await getConditionData();
          updateConditionData(Array.isArray(conditions) ? conditions : []);
        }

        if (!Array.isArray(patientProvider) || patientProvider.length === 0) {
          const providers = await getProviderList();
          setPatientProvider(Array.isArray(providers) ? providers : []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (activePatient) {
      setShowPatient(true);
    } else {
      setShowPatient(false);
    }
  }, [activePatient]);



  function displayClick(text) {
    const current = Array.isArray(selectedTopButtons) ? selectedTopButtons : [];
    let updated;
    if (current.includes(text)) {
      updated = current.filter(item => item !== text);
    } else {
      updated = [...current, text];
    }
    setSelectedTopButtons(updated);
  }

  useEffect(() => {
    if (Array.isArray(selectedTopButtons)) {
      localStorage.setItem('gdmtButtons', JSON.stringify(selectedTopButtons));
    }
  }, [selectedTopButtons]);

  const [searchMode, setSearchMode] = useState("search");

  return (
    <>
      {theUser ? (
        <div className="app-container d-flex flex-column">
          <div className="bg-black text-white px-0 w-100 d-flex" style={{ height: "60px", lineHeight: "60px" }}>
            <div className="ms-4 d-flex align-items-center fw-bold text-white">
              <img src={logo} alt="GDMT" style={{ height: "36px", marginRight: "8px" }} />
              <span style={{ color: "#e2e7d6ff" }}>[{theUser.userName}]</span>
            </div>
            {activePatient && showPatient && (
              <TopBarNav navBarButtons={topBarButtons} selectedTopButtons={selectedTopButtons} onClick={displayClick} />
            )}
          </div>

          <div className="d-flex flex-grow-1">
            <aside className="d-flex flex-column align-items-center pt-1 bg-black vh-100 gap-2" style={{ width: "60px" }}>
              <button title ="Display This" className="btn btn-light" onClick={() => { setActivePatient(null); setVisibleBox('search'); }}>🔍</button>
              <button title ="Display This" className="btn btn-light" onClick={() => { setActivePatient(null); setVisibleBox('results'); }}>⚙️</button>
              <button title ="Print Doctor Form" className="btn btn-light" onClick={() => { console.log('print doctor'); }}>🖨️</button>
            </aside>

            <main className="display flex-grow-1 p-3 overflow-auto">
              <>
                {activePatient && showPatient && (
                  <PatientDisplay
                    selectedTopButtons={selectedTopButtons}
                    theUser={theUser}
                    activePatient={activePatient}
                  />
                )}
                {visibleBox === "search" && (
                  <NewSearchCombo
                    onPatientSelect={(patient) => {
                      setActivePatient(patient);
                      setShowPatient(false);
                    }}
                  />
                )}
                {visibleBox === "results" && (
                  <ResultsPage
                    onPatientSelect={(patient) => {
                      setActivePatient(patient);
                      setShowPatient(false);
                    }}
                  />
                )}
              </>
            </main >
          </div >
        </div >
      ) : (
        <div>Nothing to Display</div>
      )
      }
    </>
  );
}


function Box({ id, title = "Untitled", content = "" }) {
  return (
    <div>
      <div>{title}</div>
      <div>{content}</div>
    </div>
  );
}

function EmptyState() {
  return <div className="text-center text-muted"></div>;
}
