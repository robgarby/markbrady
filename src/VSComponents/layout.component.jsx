import React, { useEffect, useState } from "react";
import { useGlobalContext } from "../Context/global.context.jsx";
import TopBarNav from "./Design/TopBar/navbar.component.jsx";
import {
  getMedicationData,
  getConditionData,
  getButtonsFromToken,
  getProviderList,
  getUserFromToken,
} from "../Context/functions.jsx";
import { navButtons } from "../Context/variables.jsx";
import PatientDisplay from "./patientDisplay.component.jsx";
import NewSearchCombo from "./newSearchCombo.component.jsx";
import ResultsPage from "../components/Database/PatientSearch/results.component.jsx";
import { useNavigate } from "react-router-dom";
import logo from "../assets/GMDT_Alone.svg";
import LabWork from "./labWork.component.jsx";
import AsideNav from "./Universal/SideButtons/sideButtons.component.jsx";

import MedBoxComplete from "./SideButtonBoxes/Medications/editMedications.component.jsx";
import EditCats from "./SideButtonBoxes/Category/editCats.component.jsx";
import PharmacyUpload from "./SideButtonBoxes/Pharmacy/pharmacy.component.jsx";
import PharmacyMultiple from "./SideButtonBoxes/Pharmacy/pharmacyMultiple.component.jsx";

export default function Layout() {
  const {
    displayMain,
    setDisplayMain,
    setMainButton,
    activePatient,
    setActivePatient,
    medsArray,
    conditionData,
    updateMedsArray,
    updateConditionData,
    patientProvider,
    setPatientProvider,
    visibleBox,
    setVisibleBox,
    selectedTopButtons,
    setSelectedTopButtons,
  } = useGlobalContext();

  const [loading, setLoading] = useState(true);
  const [topBarButtons] = useState(navButtons);
  const [theUser, setTheUser] = useState(null);
  const [showPatient, setShowPatient] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        if (!theUser) {
          const u = await getUserFromToken();
          if (u == null || (Array.isArray(u) && u.length === 0)) {
            navigate("/login");
            return;
          }
          setTheUser(u);
        }

        if (!Array.isArray(selectedTopButtons) || selectedTopButtons.length === 0) {
          const b = await getButtonsFromToken();
          setSelectedTopButtons(Array.isArray(b) ? b : []);
        }

        if (!Array.isArray(medsArray) || medsArray.length === 0) {
          const medications = await getMedicationData();
          updateMedsArray(Array.isArray(medications) ? medications : []);
        }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setShowPatient(!!activePatient);
  }, [activePatient]);

  function displayClick(text) {
    const current = Array.isArray(selectedTopButtons) ? selectedTopButtons : [];
    const updated = current.includes(text) ? current.filter((i) => i !== text) : [...current, text];
    setSelectedTopButtons(updated);
    setDisplayMain(false);
    setMainButton(null);
  }

  useEffect(() => {
    if (Array.isArray(selectedTopButtons)) {
      localStorage.setItem("gdmtButtons", JSON.stringify(selectedTopButtons));
    }
  }, [selectedTopButtons]);

  const isMedAdmin = visibleBox === "medAdmin";
  const isCatAdmin = visibleBox === "catAdmin";
  const isPharmacy = visibleBox === "pharmacy";
  const isMultiPharmacy = visibleBox === "multiPharmacy";
  const isOverlayOpen = isMedAdmin || isCatAdmin || isPharmacy;

  return (
    <>
      {theUser ? (
        <div className="app-container d-flex flex-column">
          {/* Top navbar (fixed 60px height) */}
          <div className="bg-black text-white px-0 w-100 d-flex" style={{ height: "60px", lineHeight: "60px" }}>
            <div className="ms-4 d-flex align-items-center fw-bold text-white">
              <img src={logo} alt="GDMT" style={{ height: "36px", marginRight: "8px" }} />
              <span style={{ color: "#e2e7d6ff" }}>[{theUser.userName}]</span>
            </div>

            {activePatient && showPatient && theUser && (
              <TopBarNav
                navBarButtons={topBarButtons}
                selectedTopButtons={selectedTopButtons}
                user={theUser}
                onClick={displayClick}
              />
            )}
          </div>

          {/* Body: fill viewport minus navbar */}
          <div
            className="d-flex position-relative"
            style={{
              height: "calc(100vh - 60px)",
              overflow: "hidden",
            }}
          >
            {/* ✅ Full-screen overlay for Med Admin */}
            {isMedAdmin && (
              <div className="position-absolute top-0 start-0 w-100 h-100 bg-white" style={{ zIndex: 3000 }}>
                <div className="d-flex align-items-center px-3 border-bottom" style={{ height: "56px" }}>
                  <div className="fw-bold">Medication Admin</div>

                  <div className="ms-auto">
                    <button className="btn btn-outline-danger btn-sm" onClick={() => setVisibleBox("")}
                      disabled={loading}
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div style={{ height: "calc(100% - 56px)", overflow: "auto" }} className="p-3">
                  <MedBoxComplete />
                </div>
              </div>
            )}

            {/* ✅ Full-screen overlay for Category Admin */}
            {isCatAdmin && (
              <div className="position-absolute top-0 start-0 w-100 h-100 bg-white" style={{ zIndex: 3000 }}>
                <div className="d-flex align-items-center px-3 border-bottom" style={{ height: "56px" }}>
                  <div className="fw-bold">Category Admin</div>

                  <div className="ms-auto">
                    <button className="btn btn-outline-danger btn-sm" onClick={() => setVisibleBox("")}
                      disabled={loading}
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div style={{ height: "calc(100% - 56px)", overflow: "auto" }} className="p-3">
                  <EditCats />
                </div>
              </div>
            )}

            {/* ✅ Full-screen overlay for Pharmacy Upload (same pattern as Med/Cats) */}
            {isPharmacy && (
              <div className="position-absolute top-0 start-0 w-100 h-100 bg-white" style={{ zIndex: 3000 }}>
                <div className="d-flex align-items-center px-3 border-bottom" style={{ height: "56px" }}>
                  <div className="fw-bold">Upload Pharmacy Reports</div>

                  <div className="ms-auto">
                    <button className="btn btn-outline-danger btn-sm" onClick={() => setVisibleBox("")}
                      disabled={loading}
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div style={{ height: "calc(100% - 56px)", overflow: "auto" }} className="p-0">
                  <div className="p-2" style={{ height: "100%" }}>
                    <PharmacyUpload />
                  </div>
                </div>
              </div>
            )}
            {isMultiPharmacy && (
              <div className="position-absolute top-0 start-0 w-100 h-100 bg-white" style={{ zIndex: 3000 }}>
                <div className="d-flex align-items-center px-3 border-bottom" style={{ height: "56px" }}>
                  <div className="fw-bold">Upload Multi Pharmacy Reports</div>

                  <div className="ms-auto">
                    <button className="btn btn-outline-danger btn-sm" onClick={() => setVisibleBox("")}
                      disabled={loading}
                    >
                      Close
                    </button>
                  </div>
                </div>

                <div style={{ height: "calc(100% - 56px)", overflow: "auto" }} className="p-0">
                  <div className="p-2" style={{ height: "100%" }}>
                    <PharmacyMultiple />
                  </div>
                </div>
              </div>
            )}

            {/* Sidebar */}
            <aside className="d-flex flex-column align-items-center pt-1 bg-black gap-2 h-100" style={{ width: "60px" }}>
              <AsideNav />
            </aside>

            {/* Main area */}
            <main className="display flex-grow-1 p-3 h-100 overflow-auto">
              {/* ✅ Hide main content whenever an overlay is open */}
              {!isOverlayOpen && (
                <>
                  {activePatient && !displayMain && (
                    <PatientDisplay
                      selectedTopButtons={selectedTopButtons}
                      theUser={theUser}
                      activePatient={activePatient}
                    />
                  )}

                  {activePatient && displayMain && (
                    <LabWork
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
              )}
            </main>
          </div>
        </div>
      ) : (
        <div>Nothing to Display</div>
      )}
    </>
  );
}
