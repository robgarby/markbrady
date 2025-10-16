// database.component.jsx
import React, { useEffect, useState } from 'react';
import SideBar from '../SideBar/sidebar.component';
import DisplayBox from '../DisplayBox/displayBox.component';
import { getUserFromToken } from '../../../Context/functions';
import { useNavigate } from 'react-router-dom';

const Database = () => {

     const [user, setUser] = React.useState(null);
     const navigate = useNavigate();

     useEffect(() => {
          const fetchUser = async () => {
               const userData = await getUserFromToken();
               return userData;
          };
          fetchUser().then((userT) => {
               if (userT && userT.dayOfWeek) {
                    setUser(userT);
               }
               if (!userT) {
                    // If no user is found, redirect to sign-in page
                    navigate('/signin');
                    return;
               }
          });
     }, []);

     return (
          <div className="layout" style={{ display: 'flex' }}>
               <SideBar />
               <DisplayBox />
          </div>
     );
};

export default Database;

