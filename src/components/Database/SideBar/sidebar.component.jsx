// sidebar.component.jsx
import React, { useEffect } from "react";
import "./sidebar.styles.scss";
import { jwtDecode } from "jwt-decode";
import { useGlobalContext } from "../../../Context/global.context";
import { useNavigate } from "react-router-dom";


const SideBar = () => {

     const { setVisibleBox, visibleBox, clientBox, setClientBox } = useGlobalContext();

     const logout = () => {
          localStorage.removeItem("creds");
          window.location.href = "/signin";
     };

     useEffect(() => {
          console.log("SideBar component mounted");
     }, []);

     const navigate = useNavigate();


     return (
          <>
               <div className="sidebar d-flex flex-column align-items-center bg-navy">
                    <button
                         className={`btn my-3 w-75 ${visibleBox !== "VerifyCount" ? "btn-light" : "btn-warning"}`}
                         onClick={() => { setVisibleBox("VerifyCount"); setClientBox(false); }}
                    >
                         Patient Search
                    </button>
                    <button
                         className={`btn my-3 w-75 ${visibleBox !== "CriteriaSearch" ? "btn-light" : "btn-warning"}`}
                         onClick={() => setVisibleBox("CriteriaSearch")}
                    >
                         Criteria Search
                    </button>
                    {clientBox && (
                         <div className="client-box d-flex flex-column col-100 alert-purple p-3 mt-3">
                              <button
                                   className={`btn my-2 w-100 ${visibleBox !== "ClientDetails" ? "btn-purple" : "btn-warning"}`}
                                   onClick={() => setVisibleBox("ClientDetails")}
                              >
                                   Home
                              </button>
                              <button
                                   className={`btn my-2 w-100 ${visibleBox !== "pdfViewer" ? "btn-purple" : "btn-warning"}`}
                                   onClick={() => setVisibleBox("pdfViewer")}
                              >
                                   View PDF's
                              </button>
                              <button
                                   className={`btn my-2 w-100 ${visibleBox !== "viewHistory" ? "btn-purple" : "btn-warning"}`}
                                   onClick={() => setVisibleBox("viewHistory")}
                              >
                                   View History
                              </button>
                              <button
                                   className={`btn my-2 w-100 ${visibleBox !== "uploadPDF" ? "btn-purple" : "btn-warning"}`}
                                   onClick={() => setVisibleBox("uploadPDF")}
                              >
                                   Upload PDF
                              </button>
                              <button
                                   className={`btn my-2 w-100 ${visibleBox !== "referClient" ? "btn-purple" : "btn-warning"}`}
                                   onClick={() => navigate("/upload")}
                              >
                                   Upload New Lab
                              </button>

                              <button
                                   className={`btn my-2 w-100 ${visibleBox !== "EditLab" ? "btn-purple" : "btn-warning"}`}
                                   onClick={() => setVisibleBox("EditLab")}
                              >
                                   Edit Lab Results
                              </button>
                              <button
                                   className={`btn my-2 w-100 ${visibleBox !== "referClient" ? "btn-purple" : "btn-warning"}`}
                                   onClick={() => setVisibleBox("referClient")}
                              >
                                   Refer Client
                              </button>
                         </div>
                    )}
                    <div className="mt-auto w-75">
                         <button className="btn btn-warning my-3 w-100" onClick={() => navigate("/dashboard")}>
                              Dashboard
                         </button>
                         <button className="btn btn-danger my-3 w-100" onClick={logout}>
                              Logout
                         </button>
                    </div>
               </div>
          </>
     );
};

export default SideBar;
