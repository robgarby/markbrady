// sidebar.component.jsx
import React, { useEffect } from "react";
import "./sidebar.styles.scss";
import { jwtDecode } from "jwt-decode";
import { useGlobalContext } from "../../../Context/global.context";
import { useNavigate } from "react-router-dom";

const SideBar = () => {
  const { setVisibleBox, visibleBox, clientBox, setClientBox } = useGlobalContext();
  const navigate = useNavigate();

  // ⬇️ Hide the entire sidebar when showing the print view
  if (visibleBox === "printView") {
    return null;
  }

  const logout = () => {
    localStorage.removeItem("creds");
    window.location.href = "/signin";
  };


  return (
    <>
      <div className="sidebar d-flex flex-column align-items-center bg-dark">
        <button
          className={`btn my-1 w-75 ${visibleBox !== "VerifyCount" ? "btn-light" : "btn-warning"}`}
          onClick={() => { setVisibleBox("VerifyCount"); setClientBox(false); }}
        >
          Patient Search
        </button>
        <button
          className={`btn my-1 w-75 ${visibleBox !== "CriteriaSearch" ? "btn-light" : "btn-warning"}`}
          onClick={() => setVisibleBox("CriteriaSearch")}
        >
          Criteria Search
        </button>
        <button
          className={`btn my-1 w-75 ${visibleBox !== "searchResults" ? "btn-light" : "btn-warning"}`}
          onClick={() => setVisibleBox("searchResults")}
        >
          Results
        </button>
        {clientBox && (
          <div className="client-box d-flex flex-column col-100 rounded  p-3 mt-3 fs-7" style={{ background: "#acb0b5ff" }}>
            <div className="text-center fw-bold mb-2 text-dark">Patient Specific</div>
            <button
              className={`btn my-1 w-100 fs-7 ${visibleBox !== "pdfViewer" ? "btn-light" : "btn-warning"}`}
              onClick={() => setVisibleBox("pdfViewer")}
            >
              All PDF's
            </button>
             <button
              className={`btn my-1 w-100 fs-7 ${visibleBox !== "uploadPDF" ? "btn-light" : "btn-warning"}`}
              onClick={() => setVisibleBox("uploadPDF")}
            >
              Upload PDF
            </button>
            <button
              className={`btn my-1 w-100 fs-7 ${visibleBox !== "viewHistory" ? "btn-light" : "btn-warning"}`}
              onClick={() => setVisibleBox("viewHistory")}
            >
              View History
            </button>
            <button
              className={`btn my-1 w-100 fs-7 ${visibleBox !== "EditLab" ? "btn-light" : "btn-warning"}`}
              onClick={() => setVisibleBox("EditLab")}
            >
              Edit Labs
            </button>
            <button
              className={`btn my-1 w-100 fs-7 ${visibleBox !== "referClient" ? "btn-light" : "btn-warning"}`}
              onClick={() => setVisibleBox("printView")}
            >
              Doc. Referral
            </button>
          </div>
        )}
        <div className="mt-auto w-75">
          <button className="btn btn-light my-1 w-100" onClick={() => navigate("/dashboard")}>
            Dashboard
          </button>
          <button
              className={`btn my-1 w-100 ${visibleBox !== "referClient" ? "btn-light" : "btn-warning"}`}
              onClick={() => navigate("/admin")}
            >
              Admin Panel
            </button>
             <button
              className={`btn my-1 w-100 ${visibleBox !== "referClient" ? "btn-light" : "btn-warning"}`}
              onClick={() => navigate("/upload")}
            >
              New Lab
            </button>
          <button className="btn btn-secondary text-white mt-5 w-100" onClick={logout}>
            Logout
          </button>
        </div>
      </div>
    </>
  );
};

export default SideBar;
