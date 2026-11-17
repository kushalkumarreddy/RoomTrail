import React from 'react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
  return (
    <div className="min-vh-100 d-flex flex-column bg-white">
      {/* Top Navbar */}
      <header className="rt-navbar">
        <div className="container-fluid d-flex align-items-center justify-content-between px-3 px-md-4">
          <Link to="/" className="rt-brand">
            <div className="rt-brand-badge">
              <i className="bi bi-compass"></i>
            </div>
            <span>Room<span style={{ color: 'var(--rt-blue-400)' }}>Trail</span></span>
          </Link>

          <div className="d-flex align-items-center gap-2">
            <Link to="/login" className="btn btn-sm btn-outline-light px-3">
              Sign In
            </Link>
            <Link to="/register" className="btn btn-sm btn-rt-accent px-3">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero text-center text-lg-start">
        <div className="container py-4">
          <div className="row align-items-center g-5">
            <div className="col-lg-7">
              <div className="landing-badge">
                <i className="bi bi-shield-check"></i>
                Location-Based Travel & Rental Discovery
              </div>
              <h1 className="landing-title">
                Never lose track of your rental visits or travel routes.
              </h1>
              <p className="landing-subtitle">
                Designed for PG seekers, apartment hunters, and travelers. Save potential places, track live GPS trails, detect nearby destinations, and avoid revisiting the same location twice.
              </p>
              <div className="d-flex flex-wrap gap-3 justify-content-center justify-content-lg-start">
                <Link to="/register" className="btn btn-rt-accent btn-lg px-4 py-2">
                  <i className="bi bi-compass me-2"></i>
                  Start Exploring Free
                </Link>
                <Link to="/login" className="btn btn-outline-light btn-lg px-4 py-2">
                  <i className="bi bi-box-arrow-in-right me-2"></i>
                  Sign In with Demo
                </Link>
              </div>
            </div>

            <div className="col-lg-5">
              <div className="rt-card p-4 shadow-lg border-0" style={{ backgroundColor: 'rgba(255, 255, 255, 0.96)' }}>
                <div className="d-flex align-items-center justify-content-between mb-3 border-bottom pb-2">
                  <div className="d-flex align-items-center gap-2">
                    <span className="tracking-radar-indicator active"></span>
                    <span className="fw-bold small text-dark">Live Proximity Radar</span>
                  </div>
                  <span className="badge-rt badge-rt-primary">GPS Ready</span>
                </div>

                <div className="p-3 rounded mb-3" style={{ backgroundColor: 'var(--rt-blue-50)', border: '1px solid #bfdbfe' }}>
                  <div className="d-flex justify-content-between align-items-start mb-1">
                    <span className="badge category-pg">PG / Co-Living</span>
                    <span className="badge priority-badge-high">High Priority</span>
                  </div>
                  <h6 className="fw-bold text-dark mb-1">Indiranagar 2BHK Rental Flat</h6>
                  <p className="text-muted small mb-2">100 Feet Rd, HAL 2nd Stage, Bengaluru</p>
                  <div className="d-flex justify-content-between align-items-center small text-muted border-top pt-2">
                    <span>Rent: <strong className="text-dark">₹32,000 / mo</strong></span>
                    <span>Proximity: <strong className="text-primary">85m away</strong></span>
                  </div>
                </div>

                <div className="p-3 rounded bg-light border text-center">
                  <i className="bi bi-bell text-warning fs-4 d-block mb-1"></i>
                  <div className="fw-bold small text-dark">Destination Approaching!</div>
                  <div className="text-muted small">Confirm visit when you arrive on site.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 Pillars Section */}
      <section className="py-5" style={{ backgroundColor: 'var(--rt-bg-app)' }}>
        <div className="container py-4">
          <div className="text-center mb-5">
            <span className="badge rounded-pill bg-primary-subtle text-primary px-3 py-1 fw-bold small text-uppercase">
              Core Capabilities
            </span>
            <h2 className="fw-bold text-dark mt-2 mb-3">Engineered for Smart Mobility</h2>
            <p className="text-muted mx-auto mb-0" style={{ maxWidth: '600px' }}>
              Whether you are evaluating dozens of flats across neighborhoods or tracking road trips, RoomTrail keeps you organized.
            </p>
          </div>

          <div className="row g-4">
            <div className="col-md-6 col-lg-3">
              <div className="feature-card">
                <div className="feature-icon-wrap" style={{ backgroundColor: 'var(--rt-blue-50)', color: 'var(--rt-blue-500)' }}>
                  <i className="bi bi-pin-map"></i>
                </div>
                <h5 className="fw-bold text-dark mb-2">Save & Categorize</h5>
                <p className="text-muted small mb-0">
                  Store flats, PGs, rooms, houses, and travel spots with budgets, phone numbers, amenities, and GPS coordinates.
                </p>
              </div>
            </div>

            <div className="col-md-6 col-lg-3">
              <div className="feature-card">
                <div className="feature-icon-wrap" style={{ backgroundColor: '#f0fdf4', color: '#16a34a' }}>
                  <i className="bi bi-signpost-split"></i>
                </div>
                <h5 className="fw-bold text-dark mb-2">Trip Itineraries</h5>
                <p className="text-muted small mb-0">
                  Group saved places into organized travel trips and plan the best order to visit without doubling back.
                </p>
              </div>
            </div>

            <div className="col-md-6 col-lg-3">
              <div className="feature-card">
                <div className="feature-icon-wrap" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
                  <i className="bi bi-broadcast"></i>
                </div>
                <h5 className="fw-bold text-dark mb-2">Proximity Radar</h5>
                <p className="text-muted small mb-0">
                  Sensors detect when you reach a saved destination and prompt for confirmation before logging a visit.
                </p>
              </div>
            </div>

            <div className="col-md-6 col-lg-3">
              <div className="feature-card">
                <div className="feature-icon-wrap" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
                  <i className="bi bi-shield-x"></i>
                </div>
                <h5 className="fw-bold text-dark mb-2">Anti-Duplicate Engine</h5>
                <p className="text-muted small mb-0">
                  Never accidentally revisit a place you rejected. Clearly see visited vs pending destinations on your map.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works / 4-Step Process */}
      <section className="py-5 bg-white">
        <div className="container py-4">
          <div className="text-center mb-5">
            <span className="badge rounded-pill bg-info-subtle text-info px-3 py-1 fw-bold small text-uppercase">
              Workflow
            </span>
            <h2 className="fw-bold text-dark mt-2 mb-3">How RoomTrail Works</h2>
            <p className="text-muted mx-auto mb-0" style={{ maxWidth: '600px' }}>
              From discovering a listing online to standing outside the door, follow your trail with zero confusion.
            </p>
          </div>

          <div className="row g-4">
            <div className="col-md-6 col-lg-3">
              <div className="step-card">
                <div className="step-number">01</div>
                <i className="bi bi-bookmark-plus fs-3 text-primary mb-3 d-block"></i>
                <h6 className="fw-bold text-dark">Save Destinations</h6>
                <p className="text-muted small mb-0">
                  Input addresses, rent details, contact numbers, and drop map pins for places you intend to visit.
                </p>
              </div>
            </div>

            <div className="col-md-6 col-lg-3">
              <div className="step-card">
                <div className="step-number">02</div>
                <i className="bi bi-map fs-3 text-success mb-3 d-block"></i>
                <h6 className="fw-bold text-dark">Build a Travel Trip</h6>
                <p className="text-muted small mb-0">
                  Select 3-10 destinations for your weekend tour and let RoomTrail structure your route.
                </p>
              </div>
            </div>

            <div className="col-md-6 col-lg-3">
              <div className="step-card">
                <div className="step-number">03</div>
                <i className="bi bi-cursor fs-3 text-warning mb-3 d-block"></i>
                <h6 className="fw-bold text-dark">Track Your Route</h6>
                <p className="text-muted small mb-0">
                  Start tracking. Real road coordinates guide your journey and proximity radar alerts you as you approach.
                </p>
              </div>
            </div>

            <div className="col-md-6 col-lg-3">
              <div className="step-card">
                <div className="step-number">04</div>
                <i className="bi bi-check2-circle fs-3 text-danger mb-3 d-block"></i>
                <h6 className="fw-bold text-dark">Confirm & Log Visit</h6>
                <p className="text-muted small mb-0">
                  Record on-site visit notes, confirm arrival, and maintain an immutable historical log of all visits.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to Action Banner */}
      <section className="py-5" style={{ background: 'linear-gradient(135deg, var(--rt-navy-900) 0%, var(--rt-navy-800) 100%)' }}>
        <div className="container py-4 text-center text-white">
          <h2 className="fw-bold mb-3 text-white">Ready to streamline your travel and rental search?</h2>
          <p className="text-white-50 mx-auto mb-4" style={{ maxWidth: '560px' }}>
            Experience smart destination management, live proximity alerts, and anti-duplicate route tracking today.
          </p>
          <div className="d-flex justify-content-center gap-3">
            <Link to="/register" className="btn btn-rt-accent btn-lg px-4">
              Create Free Account
            </Link>
            <Link to="/login" className="btn btn-outline-light btn-lg px-4">
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="rt-footer mt-auto">
        <div className="container d-flex flex-wrap align-items-center justify-content-between gap-3 py-2">
          <div className="d-flex align-items-center gap-2">
            <span className="fw-bold text-dark">RoomTrail</span>
            <span>•</span>
            <span>Smart Travel, Location Discovery & Route Tracking</span>
          </div>
          <div className="d-flex align-items-center gap-3">
            <span className="badge rounded-pill bg-light text-secondary border">v1.0.0 Production</span>
            <span>&copy; {new Date().getFullYear()} RoomTrail. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
