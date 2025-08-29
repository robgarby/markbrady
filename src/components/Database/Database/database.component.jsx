// database.component.jsx
import React, { useEffect, useState } from 'react';
import SideBar from '../SideBar/sidebar.component';
import DisplayBox from '../DisplayBox/displayBox.component';

const Database = () => {


     useEffect(() => {
          const token = localStorage.getItem('creds');
          if (!token) {
               window.location.href = '/signin';
          }
     }, []);

     return (
          <div className="layout" style={{ display: 'flex' }}>
               <SideBar />
               <DisplayBox />
          </div>
     );
};

export default Database;

