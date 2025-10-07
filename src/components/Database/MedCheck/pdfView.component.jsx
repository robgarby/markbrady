// PdfViewerBox.jsx
import React, { useState, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";

// pdf.js worker (CDN)
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

/**
 * Props:
 * - fileUrl: string   -> relative path/filename (e.g., "abc.pdf"). Will be prefixed by uploadsBase.
 * - src: string       -> full URL to a PDF. If provided, takes precedence over fileUrl.
 * - uploadsBase: string -> prefix used with fileUrl (default: "https://optimizingdyslipidemia.com/PHP/uploads/")
 * - initialScale: number -> starting zoom (default 1.2)
 */
export default function PdfViewerBox({
  fileUrl,
  src,
  uploadsBase = "https://optimizingdyslipidemia.com/PHP/uploads/",
  initialScale = 1.2,
}) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(initialScale);
  const [loadError, setLoadError] = useState("");

  // Which URL to use: src (full) or fileUrl + uploadsBase
  const pdfUrl = src || (fileUrl ? `${uploadsBase}${fileUrl}` : "");

  useEffect(() => {
    // reset on file change
    setNumPages(null);
    setPageNumber(1);
    setScale(initialScale);
    setLoadError("");
  }, [pdfUrl, initialScale]);

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
    setPageNumber(1);
    setLoadError("");
  };

  const onDocumentLoadError = (err) => {
    console.error(err);
    setLoadError("The PDF could not be loaded in the in-browser viewer.");
  };

  if (!pdfUrl) {
    return (
      <div className="alert alert-warning my-3" role="alert">
        No PDF source provided.
      </div>
    );
  }

  const canPrev = pageNumber > 1;
  const canNext = numPages ? pageNumber < numPages : false;

  return (
    <div>
      {/* Demo banner */}
      <div
        style={{
          padding: "10px 14px",
          background: "#fff3cd",
          color: "#664d03",
          border: "1px solid #ffecb5",
          borderRadius: 8,
          marginBottom: 12,
          fontWeight: 700,
            textAlign: "center",
        }}
        role="alert"
        aria-live="polite"
      >
        DATA IS NOT IMPORTED INTO FORM AS THE SOFTWARE IS IN DEMONSTRATION MODE
      </div>

      {/* Controls */}
      <div className="mb-3 d-flex justify-content-center gap-2 flex-wrap">
        <button
          onClick={() => setScale((prev) => prev + 0.2)}
          className="btn btn-sm btn-primary"
        >
          Zoom In
        </button>
        <button
          onClick={() => setScale((prev) => Math.max(prev - 0.2, 0.4))}
          className="btn btn-sm btn-secondary"
        >
          Zoom Out
        </button>

        {numPages > 1 && (
          <>
            <button
              className="btn btn-sm btn-outline-primary"
              disabled={!canPrev}
              onClick={() => canPrev && setPageNumber((p) => p - 1)}
            >
              Previous
            </button>
            <span style={{ lineHeight: "30px" }}>
              Page {pageNumber} of {numPages}
            </span>
            <button
              className="btn btn-sm btn-outline-primary"
              disabled={!canNext}
              onClick={() => canNext && setPageNumber((p) => p + 1)}
            >
              Next
            </button>
          </>
        )}
      </div>

      {/* Viewer */}
      <div className="d-flex justify-content-center">
        <Document
          key={pdfUrl}
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={<div className="text-muted p-3">Loading PDF…</div>}
          error=""
          noData=""
        >
          {/* Keep text/annotation layers enabled for selectable text */}
          <Page pageNumber={pageNumber} scale={scale} />
        </Document>
      </div>

      {/* Fallback / error message + open link */}
      {loadError && (
        <div className="mt-3 alert alert-info" role="alert">
          {loadError}{" "}
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
            Open in a new tab
          </a>{" "}
          or download and open with a desktop PDF reader.
        </div>
      )}
    </div>
  );
}
