// patientSearch.component.jsx
import React, { useState } from 'react';
import { useGlobalContext } from '../../../Context/global.context';

const PatientSearch = () => {
     const [query, setQuery] = useState('');
     const [noteQuery, setNoteQuery] = useState('');
     const [results, setResults] = useState([]);
     const [didSearch, setDidSearch] = useState(false);
     const [mode, setMode] = useState('identity'); // 'identity' | 'notes'
     const [loading, setLoading] = useState(false);
     const { setActivePatient, setClientBox, setVisibleBox } = useGlobalContext();

     const handleSearchIdentity = async () => {
          const value = query.trim();
          if (!value) return;
          setLoading(true);
          setMode('identity');
          setDidSearch(true);
          try {
               const response = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ searchTerm: value, script: "patientSearch" }),
               });
               const data = await response.json();
               setResults(Array.isArray(data) ? data : []);
          } catch (error) {
               console.error('Error searching:', error);
               setResults([]);
          } finally {
               setLoading(false);
          }
     };

     const handleSearchNotes = async () => {
          const value = noteQuery.trim();
          if (!value) return;
          setLoading(true);
          setMode('notes');
          setDidSearch(true);
          try {
               const response = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ noteTerm: value, script: "patientNoteSearch" }),
               });
               const data = await response.json();
               setResults(Array.isArray(data) ? data : []);
          } catch (error) {
               console.error('Error searching:', error);
               setResults([]);
          } finally {
               setLoading(false);
          }
     };

     const clearAll = () => {
          setQuery('');
          setNoteQuery('');
          setResults([]);
          setDidSearch(false);
          setMode('identity');
     };

     const editClient = (activeClient) => {
          setActivePatient(activeClient);
          setClientBox(true);
          setVisibleBox('ClientDetails');
     };

     const onKeyDownIdentity = (e) => {
          if (e.key === 'Enter') handleSearchIdentity();
     };
     const onKeyDownNotes = (e) => {
          if (e.key === 'Enter') handleSearchNotes();
     };

     const highlight = (text, term) => {
          if (!text || !term) return text;
          const idx = text.toLowerCase().indexOf(term.toLowerCase());
          if (idx < 0) return text;
          const before = text.slice(0, idx);
          const hit = text.slice(idx, idx + term.length);
          const after = text.slice(idx + term.length);
          return (<>{before}<mark>{hit}</mark>{after}</>);
     };

     return (
          <div>
               {/* Identity / HCN Search */}
               <div className="d-flex align-items-center justify-content-center mb-3">
                    <div className="col-16">
                         <input
                              type="text"
                              placeholder="Search by Last Name, First Name, or HCN"
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              onKeyDown={onKeyDownIdentity}
                              style={{ width: '100%' }}
                         />
                    </div>
                    <div className="justify-content-end">
                         <button
                              className="btn btn-success text-white"
                              onClick={handleSearchIdentity}
                              style={{ width: "150px", marginLeft: '8px', marginTop: '2px' }}
                              disabled={loading}
                         >
                              {loading && mode === 'identity' ? 'Searching…' : 'Search'}
                         </button>
                         <button
                              className="btn btn-danger"
                              onClick={clearAll}
                              style={{ width: "150px", marginLeft: '8px', marginTop: '2px' }}
                              disabled={loading}
                         >
                              Clear
                         </button>
                    </div>
               </div>

               {/* Patient Note Search */}
               <div className="d-flex align-items-center justify-content-center mb-3">
                    <div className="col-16">
                         <input
                              type="text"
                              placeholder="Search Patient Notes"
                              value={noteQuery}
                              onChange={(e) => setNoteQuery(e.target.value)}
                              onKeyDown={onKeyDownNotes}
                              style={{ width: '100%' }}
                         />
                    </div>
                    <div className="justify-content-end">
                         <button
                              className="btn btn-success text-white"
                              onClick={handleSearchNotes}
                              style={{ width: "150px", marginLeft: '8px', marginTop: '2px' }}
                              disabled={loading}
                         >
                              {loading && mode === 'notes' ? 'Searching…' : 'Search'}
                         </button>
                         <button
                              className="btn btn-danger"
                              onClick={clearAll}
                              style={{ width: "150px", marginLeft: '8px', marginTop: '2px' }}
                              disabled={loading}
                         >
                              Clear
                         </button>
                    </div>
               </div>

               {/* Results */}
               <div>
                    {didSearch && results.length === 0 && (
                         <div className="text-muted">
                              {mode === 'notes'
                                   ? `No notes matched “${noteQuery}”.`
                                   : `No patients matched “${query}”.`}
                         </div>
                    )}

                    {results.map((patient) => (
                         <div key={patient.id || patient.healthNumber} className='border-bottom border-navy py-2 d-flex align-items-center fs-7'>
                              <div className="col-12 fw-bold">
                                   {mode === 'identity' ? highlight(patient.clientName || '', query) : (patient.clientName || '—')}
                              </div>
                              <div className="col-6">
                                   {mode === 'identity' ? highlight(patient.healthNumber || '', query) : (patient.healthNumber || '—')}
                              </div>
                              <div className="col-8">{patient.city || '—'}</div>
                              <div className="col-6">{patient.dateOfBirth || '—'}</div>
                              <div className="ms-auto flex-grow-1 d-flex justify-content-end">
                                   <button
                                        className="btn-sm btn btn-info"
                                        onClick={() => editClient(patient)}
                                        style={{ width: "100px", marginLeft: '8px' }}
                                   >
                                        Select
                                   </button>
                              </div>
                         </div>
                    ))}
               </div>
          </div>
     );
};

export default PatientSearch;
