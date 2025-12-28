// DemoPdfPage.jsx
import React from "react";
import PdfViewer from "./pdfView.component.jsx";
import pdfUrl from "../../../assets/pdf/4967-47e_fw.pdf"; // Ensure this path is correct

export default function DemoPdfPage() {
  return (
    <div className="container">
      <PdfViewer src={pdfUrl} height={"900"} />
    </div>
  );
}
