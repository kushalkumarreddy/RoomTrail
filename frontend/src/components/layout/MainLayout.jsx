import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import Footer from './Footer';
import { storage } from '../../utils/storage';

const MainLayout = () => {
  const [isCollapsed, setIsCollapsed] = useState(() => storage.getSidebarCollapsed());
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleToggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      storage.setSidebarCollapsed(next);
      return next;
    });
  };

  const handleToggleMobileSidebar = () => {
    setIsMobileOpen((prev) => !prev);
  };

  const handleCloseMobile = () => {
    setIsMobileOpen(false);
  };

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <Navbar
        onToggleSidebar={handleToggleSidebar}
        onToggleMobileSidebar={handleToggleMobileSidebar}
      />

      <div className="app-body">
        {/* Desktop & Mobile Sidebar */}
        <Sidebar
          isCollapsed={isCollapsed}
          isMobileOpen={isMobileOpen}
          onCloseMobile={handleCloseMobile}
        />

        {/* Mobile Backdrop */}
        <div
          className={`rt-sidebar-backdrop ${isMobileOpen ? 'mobile-open' : ''}`}
          onClick={handleCloseMobile}
          aria-hidden="true"
        />

        {/* Dynamic Route Content */}
        <main className="rt-content-area">
          <Outlet />
        </main>
      </div>

      {/* Global Footer */}
      <Footer />
    </div>
  );
};

export default MainLayout;
