import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GlobalContext } from './Context/global.context.jsx';
import SignIn from './components/SignIn/signIn.component';
import Dashboard from './components/Dashboard/dashboard.component';
import PDFUploadViewer from './components/UploadLab/uploadLab.component';
import Database from './components/Database/Database/database.component';

function App() {
  return (
    <GlobalContext>
      <Router>
        <Routes>
          <Route path="/signin" element={<SignIn />} />
          <Route path="/database" element={<Database />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/upload" element={<PDFUploadViewer />} />
          <Route path="*" element={<Navigate to="/signin" />} />
        </Routes>
      </Router>
    </GlobalContext>
  );
}

export default App;

