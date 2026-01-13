import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGlobalContext } from "../../../Context/global.context.jsx";

import medIdon from "../../../assets/icons/meds.svg";
import searchIcon from "../../../assets/icons/search.svg";
import resultIcon from "../../../assets/icons/results.svg";
import printIcon from "../../../assets/icons/print.svg";
import conditionsIcon from "../../../assets/icons/health.svg";
import logOutIcon from "../../../assets/icons/logout.svg";
import allergyIcont from "../../../assets/icons/allergy.svg";
import pharmacyUploadIcon from "../../../assets/icons/pharmacy.svg";
import hospitalUploadIcon from "../../../assets/icons/hospital.svg";
import catIcon from "../../../assets/icons/catEdit.svg";

// -----------------------------------------
// Internal component (NOT imported)
// Props: divColor, icon, title, onClick
// -----------------------------------------
function SideButton({ divColor = "#f8f9fa", textColor = "#000", icon, title = "", onClick }) {
  const [hovered, setHovered] = useState(false);

  const handleKeyDown = (e) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(e);
    }
  };

  return (
    <div
      title={title}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="d-flex align-items-center justify-content-center"
      style={{
        width: "44px",
        height: "44px",
        borderRadius: "10px",
        backgroundColor: divColor,
        color: textColor,
        opacity: hovered ? 0.75 : 1,
        cursor: "pointer",
        userSelect: "none",
        transition: "opacity 120ms ease",
        border: "1px solid rgba(255,255,255,0.15)",
      }}
    >
      <div style={{ fontSize: "18px", lineHeight: "18px" }}>
        <img
          src={icon}
          alt={title}
          style={{
            width: "33px",
            height: "33px",
            display: "block",
            objectFit: "contain",
          }}
        />
      </div>
    </div>
  );
}

export default function SideButtons() {
  const navigate = useNavigate();

  const {
    setDisplayMain,
    setMainButton,
    setActivePatient,
    setVisibleBox,
    setSelectedTopButtons,
    updateMedsArray,
    updateConditionData,
    setPatientProvider,
  } = useGlobalContext();

  const handleLogout = () => {
    if (!window.confirm("Log out?")) return;

    localStorage.removeItem("token");
    localStorage.removeItem("gdmtButtons");

    // clear global state
    setActivePatient(null);
    setVisibleBox("");
    setDisplayMain(false);
    setMainButton(null);
    setSelectedTopButtons([]);
    updateMedsArray([]);
    updateConditionData([]);
    setPatientProvider([]);

    navigate("/login");
  };

  return (
    <>
      <SideButton
        title="Search"
        divColor="#f8f9fa"
        icon={searchIcon}
        onClick={() => {
          setActivePatient(null);
          setVisibleBox("search");
        }}
      />

      <SideButton
        title="Results"
        divColor="#f8f9fa"
        icon={resultIcon}
        onClick={() => {
          setActivePatient(null);
          setVisibleBox("results");
        }}
      />

      <SideButton
        title="Print Doctor Form"
        divColor="#f8f9fa"
        icon={printIcon}
        onClick={() => {
          navigate("/print");
        }}
      />

      {/* keep your placeholder block exactly as-is (but using SideButton now) */}
      <div className="mt-3 py-3 rounded d-flex flex-column align-items-center gap-2">
        <SideButton
          title="Edit Medications"
          divColor="#077ef6ff"
          icon={medIdon}
          onClick={() => {
            // ✅ opens the full-screen med admin overlay in Layout
            setVisibleBox("medAdmin");
          }}
        />
        <SideButton
          title="Edit Categories"
          divColor="#ffffffff"
          icon={catIcon}
           onClick={() => {
            // ✅ opens the full-screen med admin overlay in Layout
            setVisibleBox("catAdmin");
          }}
        />
        <SideButton
          title="Edit Conditions"
          divColor="#366c13ff"
          icon={conditionsIcon}
          onClick={() => navigate("/print")}
        />
        <SideButton
          title="Edit Alergies"
          divColor="#ebeb31ff"
          icon={allergyIcont}
          onClick={() => navigate("/print")}
        />

        <div className="mt-5">
          <SideButton
            title="Upload Pharmacy Reports"
            divColor="#ffffffff"
            icon={pharmacyUploadIcon}
            onClick={() => {
            setVisibleBox("pharmacy");
          }}
          />
          {/* <SideButton
            title="Upload Hospital Reports"
            divColor="#0b9c3eff"
            icon={hospitalUploadIcon}
            onClick={() => navigate("/print")}
          /> */}
        </div>
      </div>

      <div className="mt-auto">
        <div className="mb-2">
          <SideButton title="Log out" divColor="#dc3545" icon={logOutIcon} onClick={handleLogout} />
        </div>
      </div>
    </>
  );
}
