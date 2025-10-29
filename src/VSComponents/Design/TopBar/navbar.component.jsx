import React, { useEffect } from "react";
import PropTypes from "prop-types";
import NavButton from "../../Universal/NavButton/navButton.component.jsx";
import logo from "../../../assets/GDMT.svg";

// Adjust the import path to where your NavButton component actually lives

const TopBarNav = ({ navBarButtons, selectedTopButtons, onClick }) => {

    return (
        <div className="ms-auto me-4 gap-1 d-flex align-items-center">
            {navBarButtons.map((b) => (
                <NavButton
                    key={b.id}
                    buttons={selectedTopButtons}
                    id={b.id}
                    color="light"
                    text={b.text}
                    onClick={() => onClick(b.id)}
                />
            ))}
        </div>
    );
};



TopBarNav.propTypes = {
    navBarButtons: PropTypes.array,
    displayClick: PropTypes.func.isRequired,
};

TopBarNav.defaultProps = {
    navBarButtons: [],
};

export default TopBarNav;