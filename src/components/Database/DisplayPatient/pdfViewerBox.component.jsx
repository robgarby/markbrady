import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PdfViewer = ({ fileUrl }) => {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.2); // Default zoom level

    useEffect(() => {
        setPageNumber(1); // reset to first page on file change
    }, [fileUrl]);

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
        setPageNumber(1);
    };

    if (!fileUrl) {
        return <div style={{ padding: '1rem', color: 'red' }}>PDF URL not provided.</div>;
    }

    const fullUrl = 'https://optimizingdyslipidemia.com/PHP/uploads/' + fileUrl;

    return (
        <div className="text-center">
            <div className="mb-3 d-flex justify-content-center gap-2 flex-wrap">
                <button onClick={() => setScale(prev => prev + 0.2)} className="btn btn-sm btn-primary">Zoom In</button>
                <button onClick={() => setScale(prev => Math.max(prev - 0.2, 0.4))} className="btn btn-sm btn-secondary">Zoom Out</button>
                {numPages > 1 && (
                    <>
                        <button
                            className="btn btn-sm btn-outline-primary"
                            disabled={pageNumber <= 1}
                            onClick={() => setPageNumber(prev => prev - 1)}
                        >
                            Previous
                        </button>
                        <span style={{ lineHeight: '30px' }}>Page {pageNumber} of {numPages}</span>
                        <button
                            className="btn btn-sm btn-outline-primary"
                            disabled={pageNumber >= numPages}
                            onClick={() => setPageNumber(prev => prev + 1)}
                        >
                            Next
                        </button>
                    </>
                )}
            </div>

            <div className="d-flex justify-content-center">
                <Document
                    key={fileUrl}
                    file={fullUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={console.error}
                >
                    <Page pageNumber={pageNumber} scale={scale} />
                </Document>
            </div>
        </div>
    );
};

export default PdfViewer;
