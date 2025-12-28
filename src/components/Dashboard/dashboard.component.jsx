// src/components/Dashboard/dashboard.component.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/markbrady.png';

import { getUserFromToken } from '../../Context/functions';

// Read values forwarded from package.json via env (see package.json scripts)
const version = process.env.REACT_APP_VERSION ?? 'Version 3.0.7';  // updated 9:00 am Oct 16
const builtAt = process.env.REACT_APP_BUILT_AT ?? 'Oct 20th, 4:00 AM';
const fixNote = process.env.REACT_APP_FIX_NOTE ?? 'Vaccine Recommendations Added to Doctors Form';

const DashBoard = () => {
  const navigate = useNavigate();
  const [user, setUser] = React.useState(null);
  const [dayOfWeek, setDayOfWeek] = React.useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const userData = await getUserFromToken();
      return userData;
    };

    fetchUser().then((userT) => {
      if (userT && userT.dayOfWeek) {
        setDayOfWeek(userT.dayOfWeek.toString());
        setUser(userT);
        console.log('User data:', userT);
      }
      if (!userT) {
        // If no user is found, redirect to sign-in page
        navigate('/signin');
        return;
      }
    });
  }, []);

  


  const logout = () => {
    localStorage.removeItem('creds');
    localStorage.removeItem('gdmtToken');
    window.location.href = '/signin'
  };


  const handleUploadClick = () => navigate('/upload');
  const handleDatabase = () => navigate('/database');
  const handleAdminPanel = () => navigate('/admin');


  return (
    <div className="container min-vh-100 d-flex align-items-center justify-content-center">
      <div className="col-36">
        <div className="col-48 text-center mb-5 bg-light">
          <img src={logo} alt="Dashboard Logo" style={{ maxWidth: '300px', height: 'auto' }} />
        </div>

        {/* Version banner (from package.json via env) */}
        <div className="col-48 text-muted text-center fs-7 mb-3">
          Version {version}{builtAt ? ` — ${builtAt}` : ''}
        </div>
        <div className="col-48 text-danger text-center fs-7 mb-3">
          {fixNote}
        </div>
        {dayOfWeek && dayOfWeek === '1' && (
        <div className="d-flex gap-2 justify-content-center">
          <div className="col-18 text-center mb-3">
            <button className="btn btn-primary w-100" onClick={handleUploadClick}>
              Upload New Lab
            </button>
          </div>
        </div>
        )}
    
        <div className="d-flex gap-2 justify-content-center">
          {dayOfWeek && dayOfWeek === '1' && (
          <div className="col-18 text-center mb-3">
            <button className="btn btn-purple w-100" onClick={handleAdminPanel}>
              Admin Panel
            </button>
          </div>
          )}
          <div className="col-18 text-center mb-3">
            <button className="btn btn-info w-100" onClick={handleDatabase}>
              Work on Database
            </button>
          </div>
        </div>
        
          <div className="d-flex gap-2 justify-content-center mt-5">
            <div className="col-8 text-center">
              <button className="btn btn-danger w-100" onClick={logout}>
                Log Out
              </button>
            </div>
          </div>
        
      </div>
    </div >
  );
};

export default DashBoard;
