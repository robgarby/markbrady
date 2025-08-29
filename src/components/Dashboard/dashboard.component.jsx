import React from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../../assets/markbrady.png';
import { useGlobalContext } from '../../Context/global.context';

const DashBoard = () => {
  const navigate = useNavigate();
  const { setVisibleBox,visibleBox } = useGlobalContext();

  const logout = () => {
    localStorage.removeItem('creds');
    window.location.href = '/signin';
  };

  const handleUploadClick = () => {
    navigate('/upload');
  };

  const handleDatabase = () => {
    navigate('/database');
  }

  return (
    <div className="container-fluid bg-light min-vh-100 d-flex align-items-center justify-content-center">
      <div className="col-36 bg-light">
        <div className="col-48 text-center mb-5">
          <img src={logo} alt="Dashboard Logo" style={{ maxWidth: '400px', height: 'auto' }} />
        </div>
        <div className="d-flex gap-2 flex-wrap justify-content-center">
          <div className="col-48 col-md-16 text-center mb-3">
            <button className="btn btn-primary w-100" onClick={handleUploadClick}>
              Upload New Lab
            </button>
          </div>
          <div className="col-48 col-md-16 text-center mb-3">
            <button className="btn btn-info w-100" onClick={handleDatabase}>Work on Database</button>
          </div>
          <div className="col-48 col-md-16 text-center">
            <button className="btn btn-danger w-100" onClick={logout}>Log Out</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashBoard;
