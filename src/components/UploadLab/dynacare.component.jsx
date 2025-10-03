// src/components/.../dynacare.component.jsx
import React, { useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { scrub, extractPatientMeta, runAllExtractors } from "./uploadFunction.jsx";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

export default function Dynacare({ onParsed, onBindSave }) {
  const [msg, setMsg] = useState("");
  const fileInputRef = useRef(null);
  const [fileKey, setFileKey] = useState(0); // lets us reset the file input

  const readPdfToText = async (file) => {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;

    let rawText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent({ normalizeWhitespace: true });
      let pageText = "";
      for (const it of content.items) {
        const s = typeof it.str === "string" ? it.str : "";
        pageText += s;
        pageText += it.hasEOL ? "\n" : " ";
      }
      rawText += pageText + "\n";
    }
    return rawText;
  };

  const toYMD = (maybeDate) => {
    if (!maybeDate) return maybeDate;
    const t = Date.parse(maybeDate);
    if (Number.isNaN(t)) return maybeDate;
    const d = new Date(t);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // ⚠️ Bind save only after a file is chosen/parsed
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || file.type !== "application/pdf") return;

    try {
      setMsg("Reading PDF…");
      const rawText = await readPdfToText(file);
      const text = scrub(rawText);
      const meta = extractPatientMeta(text);
      const labResults = runAllExtractors(text);

      if (meta && meta.orderDate) meta.orderDate = toYMD(meta.orderDate);

      setMsg("Checking client status…");
      const res = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: "getStatus",
          healthNumber: meta.healthNumber,
          labdate: meta.orderDate,
        }),
      });

      const txt = await res.text();
      let status = {};
      try { status = JSON.parse(txt); } catch { status = {}; }

      const payload = {
        patient: { ...meta, labResults },
        patientStatus: status?.status || null,
        labExists: status?.lab === "Exists",
      };

      onParsed?.(payload);
      setMsg("");

      // ✅ bind the correct save function for THIS uploader now
      onBindSave?.(() => saveBound);
    } catch (err) {
      console.error(err);
      setMsg("Could not read/parse PDF.");
    }
  };

  // Save the selected PDF + DB update
  const saveBound = async (nextAppointment, patient, patientStatus) => {
    try {
      const f = fileInputRef.current?.files?.[0];
      if (!f) {
        console.warn("No PDF file selected to upload.");
        return { ok: false, reason: "nofile" };
      }

      const formData = new FormData();
      formData.append("pdf", f, f.name);
      formData.append("healthNumber", String(patient.healthNumber || "").replace(/\D+/g, ""));
      formData.append("patientStatus", patientStatus || "");
      if (nextAppointment) formData.append("nextAppointment", nextAppointment);
      if (patient.orderDate) formData.append("orderDate", patient.orderDate);

      const uploadResp = await fetch(
        "https://optimizingdyslipidemia.com/PHP/uploadClientPDF.php",
        { method: "POST", body: formData }
      );
      const uploadJson = await uploadResp.json().catch(() => ({}));
      if (uploadJson?.success !== "Yes") {
        return { ok: false, reason: "upload_failed", detail: uploadJson };
      }

      const endpointBody =
        patientStatus === "new"
          ? { script: "saveTheDataButton", nextAppointment, patient, patientStatus }
          : { script: "updatePatient", nextAppointment, patient };

      const dbResp = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(endpointBody),
      });
      const dbJson = await dbResp.json().catch(() => ({}));

      if (patientStatus === "new") {
        const ok = dbJson?.success === "Yes";
        return { ok, detail: dbJson };
      } else {
        const ok = dbJson?.status === "updated";
        const duplicate = dbJson?.status === "duplicate";
        return { ok, duplicate, detail: dbJson };
      }
    } catch (err) {
      console.error("Save failed:", err);
      return { ok: false, reason: "exception", error: err };
    } finally {
      // optional: reset input so same file can be chosen again later
      // setFileKey((k) => k + 1);
    }
  };

  return (
    <div className="d-flex flex-column gap-2">
      <input
        key={fileKey}
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileChange}
      />
      {msg && <div className="text-muted fs-8">{msg}</div>}
    </div>
  );
}
