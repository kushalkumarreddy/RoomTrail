import React from 'react';

const Footer = () => {
  return (
    <footer className="rt-footer">
      <div className="d-flex align-items-center gap-2">
        <span className="fw-semibold text-dark">RoomTrail</span>
        <span>•</span>
        <span>Smart Travel, Location Discovery & Route Tracking</span>
      </div>
      <div className="d-flex align-items-center gap-3">
        <span className="badge rounded-pill bg-light text-secondary border">v1.0.0 Production</span>
        <span>&copy; {new Date().getFullYear()} RoomTrail. All rights reserved.</span>
      </div>
    </footer>
  );
};

export default Footer;
