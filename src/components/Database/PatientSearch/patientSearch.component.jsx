import React, { useState } from 'react';
import { useGlobalContext } from '../../../Context/global.context';

// Example patient data (replace with real data or fetch from API)
const patients = [
     { id: 1, firstName: 'John', lastName: 'Doe', hcn: '1234567890' },
     { id: 2, firstName: 'Jane', lastName: 'Smith', hcn: '0987654321' },
     { id: 3, firstName: 'Mark', lastName: 'Brady', hcn: '1122334455' },
];

const PatientSearch = () => {
     const [query, setQuery] = useState('');
     const [results, setResults] = useState([]);
     const [didSearch, setDidSearch] = useState(false);
     const { setActivePatient,setClientBox,setVisibleBox } = useGlobalContext();

     const handleSearch = async () => {
          const value = query.trim().toLowerCase();
          setDidSearch(true);
          try {
               const response = await fetch("https://optimizingdyslipidemia.com/PHP/database.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ searchTerm: query, script: "patientSearch" }),
               });
               const data = await response.json();
               setResults(data);
          } catch (error) {
               console.error('Error checking health number:', error);
          }
     };

     const editClient = (activeClient) => {
          setActivePatient(activeClient);
          setClientBox(true);
          setVisibleBox('ClientDetails');

     }

     return (
          <div>
               <div className="d-flex align-items-center justify-content-center mb-3">
                    <div className="col-16">
                         <input
                              type="text"
                              placeholder="Search by Last Name, First Name, or HCN"
                              value={query}
                              onChange={(e) => setQuery(e.target.value)}
                              style={{ width: '100%' }}
                         />
                    </div>
                    <div className="justify-content-end">
                         <button
                              className="btn btn-success text-white"
                              onClick={handleSearch}
                              style={{ width: "150px", marginLeft: '8px', marginTop: '2px' }}
                         >
                              Search
                         </button>
                         <button
                              className="btn btn-danger"
                              onClick={() => { setResults([]); setQuery(''); setDidSearch(false); }}
                              style={{ width: "150px", marginLeft: '8px', marginTop: '2px' }}
                         >
                              Clear
                         </button>
                    </div>
               </div>

               <div>
                    {results.length === 0 && query && didSearch && <div>No results found.</div>}
                    {results.map((patient) => (
                         <div key={patient.id} className='border-bottom border-navy py-2 d-flex align-items-center fs-7'>
                              <div className="col-12 fw-bold">{patient.clientName}</div>
                              <div className="col-6">{patient.healthNumber}</div>
                              <div className="col-8">{patient.city}</div>
                              <div className="col-6">{patient.dateOfBirth}</div>
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
