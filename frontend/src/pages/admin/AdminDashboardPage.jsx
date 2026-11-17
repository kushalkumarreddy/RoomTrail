import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { adminService } from '../../services/adminService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatDate } from '../../utils/formatters';

const AdminDashboardPage = ({ defaultTab = 'overview' }) => {
  const { user: currentAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState(defaultTab || 'overview');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Core Data States (Strictly Anonymized & Minimized)
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    activeAccounts: 0,
    deactivatedAccounts: 0,
    totalProperties: 0,
    totalTrips: 0,
    totalVisits: 0,
    applicationHealth: { status: 'HEALTHY', database: 'CONNECTED', security: 'ENFORCED' },
  });
  const [usersList, setUsersList] = useState([]);
  const [overviewData, setOverviewData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);

  // Search & Filtering States
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Deletion Modal State
  const [accountToDelete, setAccountToDelete] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (defaultTab) {
      if (defaultTab === 'properties' || defaultTab === 'trips') {
        setActiveTab('platform');
      } else {
        setActiveTab(defaultTab);
      }
    }
  }, [defaultTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [metricsRes, usersRes, overviewRes, auditLogsRes] = await Promise.all([
        adminService.getMetrics().catch(() => ({})),
        adminService.getUsers().catch(() => []),
        adminService.getOverview().catch(() => null),
        adminService.getAuditLogs().catch(() => []),
      ]);

      setMetrics(metricsRes || {});
      setUsersList(usersRes || []);
      setOverviewData(overviewRes || null);
      setAuditLogs(auditLogsRes || []);
    } catch (err) {
      console.error('Failed to load administrative console data', err);
      setFeedback({ type: 'danger', text: 'Error loading administration data. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter accounts
  const filteredUsers = usersList.filter((acc) => {
    const matchesSearch =
      !searchTerm ||
      (acc.accountRef && acc.accountRef.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (acc.id && String(acc.id).includes(searchTerm));

    const matchesRole =
      roleFilter === 'ALL' ||
      (acc.role && acc.role.toUpperCase() === roleFilter);

    const matchesStatus =
      statusFilter === 'ALL' ||
      (acc.status && acc.status.toUpperCase() === statusFilter);

    return matchesSearch && matchesRole && matchesStatus;
  });

  const activeAdminsCount = usersList.filter(
    (u) => (u.role === 'ADMIN' || u.role === 'ROLE_ADMIN') && u.status === 'ACTIVE'
  ).length;

  // Account Status Toggle (Deactivate / Reactivate)
  const handleToggleStatus = async (targetUser) => {
    const nextStatus = targetUser.status === 'ACTIVE' ? 'DEACTIVATED' : 'ACTIVE';
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await adminService.updateUserStatus(targetUser.id, nextStatus);
      setFeedback({
        type: 'success',
        text: res.message || `Account ${targetUser.accountRef} updated to ${nextStatus}.`,
      });
      await loadData();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to update account status.';
      setFeedback({ type: 'danger', text: errMsg });
    } finally {
      setActionLoading(false);
    }
  };

  // Trigger Permanent Delete Modal
  const handlePromptDelete = (targetUser) => {
    setAccountToDelete(targetUser);
    setShowDeleteModal(true);
  };

  // Confirm Permanent Deletion
  const handleConfirmDelete = async () => {
    if (!accountToDelete) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await adminService.deleteUser(accountToDelete.id);
      setFeedback({
        type: 'success',
        text: res.message || `Account ${accountToDelete.accountRef} permanently deleted.`,
      });
      setShowDeleteModal(false);
      setAccountToDelete(null);
      await loadData();
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to delete account.';
      setFeedback({ type: 'danger', text: errMsg });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner fullPage text="Loading Administration Console..." />;
  }

  return (
    <div className="container-fluid py-4 px-md-4" style={{ backgroundColor: '#f8fafc', minHeight: '85vh' }}>
      {/* Console Top Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center pb-3 mb-4 border-bottom">
        <div>
          <div className="d-flex align-items-center gap-2 mb-1">
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle fw-semibold px-2 py-1">
              <i className="bi bi-shield-check me-1"></i> Governance Console
            </span>
            <span className="badge bg-success-subtle text-success border border-success-subtle fw-medium px-2 py-1">
              <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }}></i> Operational
            </span>
          </div>
          <h2 className="h4 fw-bold text-dark mb-0">Platform Administration</h2>
          <p className="text-secondary small mb-0">
            System telemetry, platform monitoring, and privacy-compliant account governance.
          </p>
        </div>

        {/* Action Controls & Navigation Pills */}
        <div className="d-flex align-items-center gap-2 mt-3 mt-md-0">
          <button
            onClick={loadData}
            className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1 shadow-sm"
            disabled={actionLoading}
            title="Refresh console telemetry"
          >
            <i className={`bi bi-arrow-clockwise ${actionLoading ? 'spin' : ''}`}></i>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Global Alert Notification Banner */}
      {feedback && (
        <div className={`alert alert-${feedback.type} alert-dismissible fade show shadow-sm py-2 px-3 mb-4`} role="alert">
          <div className="d-flex align-items-center gap-2 small">
            <i className={`bi ${feedback.type === 'success' ? 'bi-check-circle-fill' : 'bi-exclamation-triangle-fill'}`}></i>
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            className="btn-close py-2 px-3"
            aria-label="Close"
            onClick={() => setFeedback(null)}
          ></button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <ul className="nav nav-pills mb-4 p-1 bg-white rounded-3 border shadow-sm" style={{ width: 'fit-content' }}>
        <li className="nav-item">
          <button
            className={`nav-link py-2 px-3 d-flex align-items-center gap-2 fw-medium ${activeTab === 'overview' ? 'active shadow-sm' : 'text-secondary'}`}
            onClick={() => setActiveTab('overview')}
          >
            <i className="bi bi-speedometer2"></i>
            <span>Overview</span>
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link py-2 px-3 d-flex align-items-center gap-2 fw-medium ${activeTab === 'users' ? 'active shadow-sm' : 'text-secondary'}`}
            onClick={() => setActiveTab('users')}
          >
            <i className="bi bi-people"></i>
            <span>Registered Accounts</span>
            <span className="badge bg-secondary-subtle text-secondary ms-1">{usersList.length}</span>
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link py-2 px-3 d-flex align-items-center gap-2 fw-medium ${activeTab === 'platform' ? 'active shadow-sm' : 'text-secondary'}`}
            onClick={() => setActiveTab('platform')}
          >
            <i className="bi bi-bar-chart-line"></i>
            <span>Platform Overview</span>
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link py-2 px-3 d-flex align-items-center gap-2 fw-medium ${activeTab === 'profile' ? 'active shadow-sm' : 'text-secondary'}`}
            onClick={() => setActiveTab('profile')}
          >
            <i className="bi bi-journal-text"></i>
            <span>Admin Profile & Logs</span>
          </button>
        </li>
      </ul>

      {/* TAB 1: OVERVIEW METRICS */}
      {activeTab === 'overview' && (
        <div>
          {/* Top 4 Metrics Grid */}
          <div className="row g-3 mb-4">
            {/* Total Accounts */}
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card h-100 border shadow-sm">
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className="text-muted small fw-medium text-uppercase">Total Accounts</span>
                    <span className="p-2 bg-primary-subtle text-primary rounded-2">
                      <i className="bi bi-people-fill"></i>
                    </span>
                  </div>
                  <h3 className="h3 fw-bold text-dark mb-1">{metrics.totalUsers ?? usersList.length}</h3>
                  <div className="d-flex align-items-center gap-2 small">
                    <span className="badge bg-success-subtle text-success border border-success-subtle px-1 py-0">
                      {metrics.activeAccounts ?? 0} Active
                    </span>
                    <span className="badge bg-secondary-subtle text-secondary border px-1 py-0">
                      {metrics.deactivatedAccounts ?? 0} Deactivated
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Total Saved Rooms */}
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card h-100 border shadow-sm">
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className="text-muted small fw-medium text-uppercase">Saved Room Records</span>
                    <span className="p-2 bg-info-subtle text-info rounded-2">
                      <i className="bi bi-door-open-fill"></i>
                    </span>
                  </div>
                  <h3 className="h3 fw-bold text-dark mb-1">{metrics.totalProperties ?? 0}</h3>
                  <p className="text-secondary small mb-0">Platform-wide saved listings</p>
                </div>
              </div>
            </div>

            {/* Total Recorded Trips */}
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card h-100 border shadow-sm">
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className="text-muted small fw-medium text-uppercase">Recorded Trips</span>
                    <span className="p-2 bg-success-subtle text-success rounded-2">
                      <i className="bi bi-compass-fill"></i>
                    </span>
                  </div>
                  <h3 className="h3 fw-bold text-dark mb-1">{metrics.totalTrips ?? 0}</h3>
                  <p className="text-secondary small mb-0">{metrics.totalVisits ?? 0} visits recorded</p>
                </div>
              </div>
            </div>

            {/* System Health */}
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card h-100 border shadow-sm">
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className="text-muted small fw-medium text-uppercase">Application Health</span>
                    <span className="p-2 bg-warning-subtle text-warning-emphasis rounded-2">
                      <i className="bi bi-activity"></i>
                    </span>
                  </div>
                  <h3 className="h5 fw-bold text-success mb-1 d-flex align-items-center gap-1">
                    <i className="bi bi-check-circle-fill"></i>
                    <span>{metrics.applicationHealth?.status || 'HEALTHY'}</span>
                  </h3>
                  <div className="d-flex align-items-center gap-2 small text-secondary">
                    <span>DB: {metrics.applicationHealth?.database || 'CONNECTED'}</span>
                    <span>•</span>
                    <span>Security: {metrics.applicationHealth?.security || 'ACTIVE'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Platform Telemetry & Privacy Cards */}
          <div className="row g-4 mb-4">
            {/* System Architecture */}
            <div className="col-12 col-lg-7">
              <div className="card border shadow-sm h-100">
                <div className="card-header bg-white py-3 border-bottom">
                  <h5 className="h6 fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-server text-primary"></i>
                    <span>System Telemetry & Platform Stack</span>
                  </h5>
                </div>
                <div className="card-body p-3">
                  <div className="table-responsive">
                    <table className="table table-sm table-borderless align-middle mb-0">
                      <tbody>
                        <tr>
                          <td className="text-muted small py-2" style={{ width: '35%' }}>Backend Framework</td>
                          <td className="small fw-semibold py-2">Spring Boot 3.3.5 (Java 21 LTS)</td>
                        </tr>
                        <tr>
                          <td className="text-muted small py-2">Database Engine</td>
                          <td className="small fw-semibold py-2">MySQL 8.0 (InnoDB, utf8mb4)</td>
                        </tr>
                        <tr>
                          <td className="text-muted small py-2">Security Enforcement</td>
                          <td className="small fw-semibold py-2">Spring Security 6 · BCrypt Hash · Stateless JWT</td>
                        </tr>
                        <tr>
                          <td className="text-muted small py-2">Mapping Engine</td>
                          <td className="small fw-semibold py-2">Leaflet & OpenStreetMap (Zero Google Dependencies)</td>
                        </tr>
                        <tr>
                          <td className="text-muted small py-2">Privacy Architecture</td>
                          <td className="small fw-semibold text-success py-2">
                            <i className="bi bi-shield-lock-fill me-1"></i> Tier 1 Zero PII Isolation (Admin Minimisation)
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions & Privacy Shield Notice */}
            <div className="col-12 col-lg-5">
              <div className="card border shadow-sm h-100">
                <div className="card-header bg-white py-3 border-bottom">
                  <h5 className="h6 fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-shield-check text-success"></i>
                    <span>Governance & Privacy Shield</span>
                  </h5>
                </div>
                <div className="card-body p-3 d-flex flex-column justify-content-between">
                  <p className="text-secondary small mb-3">
                    RoomTrail strictly enforces administrative data minimisation. Administrative accounts cannot inspect personal user credentials, GPS traces, contact info, or saved property notes.
                  </p>
                  <div className="d-flex flex-column gap-2">
                    <button
                      className="btn btn-outline-primary btn-sm d-flex align-items-center justify-content-between"
                      onClick={() => setActiveTab('users')}
                    >
                      <span className="d-flex align-items-center gap-2">
                        <i className="bi bi-people"></i> Manage Registered Accounts
                      </span>
                      <i className="bi bi-chevron-right"></i>
                    </button>
                    <button
                      className="btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-between"
                      onClick={() => setActiveTab('profile')}
                    >
                      <span className="d-flex align-items-center gap-2">
                        <i className="bi bi-journal-text"></i> View Administrative Audit Logs
                      </span>
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REGISTERED ACCOUNTS */}
      {activeTab === 'users' && (
        <div className="card border shadow-sm">
          {/* Action & Filter Bar */}
          <div className="card-header bg-white py-3 border-bottom">
            <div className="row g-2 align-items-center">
              {/* Search by account reference */}
              <div className="col-12 col-md-4">
                <div className="input-group input-group-sm">
                  <span className="input-group-text bg-white border-end-0">
                    <i className="bi bi-search text-muted"></i>
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0 ps-0"
                    placeholder="Search account reference (e.g. USR-001)..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {searchTerm && (
                    <button className="btn btn-outline-secondary" onClick={() => setSearchTerm('')}>
                      <i className="bi bi-x"></i>
                    </button>
                  )}
                </div>
              </div>

              {/* Role filter */}
              <div className="col-6 col-md-3">
                <select
                  className="form-select form-select-sm"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="ALL">All Roles</option>
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>

              {/* Status filter */}
              <div className="col-6 col-md-3">
                <select
                  className="form-select form-select-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="DEACTIVATED">DEACTIVATED</option>
                </select>
              </div>

              {/* Count badge */}
              <div className="col-12 col-md-2 text-md-end">
                <span className="text-muted small">
                  Showing <strong>{filteredUsers.length}</strong> of {usersList.length}
                </span>
              </div>
            </div>
          </div>

          {/* Privacy-Compliant Accounts Table */}
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-muted small text-uppercase">
                  <tr>
                    <th className="ps-3 py-3" style={{ width: '15%' }}>Account Ref</th>
                    <th style={{ width: '12%' }}>Role</th>
                    <th style={{ width: '15%' }}>Status</th>
                    <th style={{ width: '18%' }}>Registered Date</th>
                    <th style={{ width: '20%' }}>Platform Activity</th>
                    <th className="text-end pe-3" style={{ width: '20%' }}>Governance Actions</th>
                  </tr>
                </thead>
                <tbody className="small">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5 text-muted">
                        <i className="bi bi-people d-block mb-2 text-secondary" style={{ fontSize: '2rem' }}></i>
                        No accounts found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((acc) => {
                      const isSelf = currentAdmin && currentAdmin.id === acc.id;
                      const isLastAdmin = acc.role === 'ADMIN' && activeAdminsCount <= 1 && acc.status === 'ACTIVE';

                      return (
                        <tr key={acc.id}>
                          {/* Masked Account Reference */}
                          <td className="ps-3 py-3">
                            <span className="badge bg-light text-dark border font-monospace px-2 py-1">
                              {acc.accountRef || `USR-${String(acc.id).padStart(3, '0')}`}
                            </span>
                            {isSelf && (
                              <span className="badge bg-info-subtle text-info border ms-1" style={{ fontSize: '0.7rem' }}>
                                You
                              </span>
                            )}
                          </td>

                          {/* Role */}
                          <td>
                            <span
                              className={`badge ${
                                acc.role === 'ADMIN'
                                  ? 'bg-dark text-white'
                                  : 'bg-primary-subtle text-primary border border-primary-subtle'
                              } px-2 py-1`}
                            >
                              {acc.role}
                            </span>
                          </td>

                          {/* Status */}
                          <td>
                            {acc.status === 'ACTIVE' ? (
                              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 d-inline-flex align-items-center gap-1">
                                <i className="bi bi-check-circle-fill" style={{ fontSize: '0.65rem' }}></i> Active
                              </span>
                            ) : (
                              <span className="badge bg-danger-subtle text-danger border border-danger-subtle px-2 py-1 d-inline-flex align-items-center gap-1">
                                <i className="bi bi-dash-circle-fill" style={{ fontSize: '0.65rem' }}></i> Deactivated
                              </span>
                            )}
                          </td>

                          {/* Registered Date */}
                          <td className="text-muted">
                            {acc.registeredAt ? formatDate(acc.registeredAt) : 'N/A'}
                          </td>

                          {/* Aggregate Counts */}
                          <td>
                            <span className="badge bg-light text-secondary border me-1">
                              {acc.totalRooms || 0} Rooms
                            </span>
                            <span className="badge bg-light text-secondary border">
                              {acc.totalTrips || 0} Trips
                            </span>
                          </td>

                          {/* Governance Actions */}
                          <td className="text-end pe-3">
                            <div className="btn-group btn-group-sm">
                              {/* Status Toggle Button */}
                              <button
                                className={`btn btn-sm ${
                                  acc.status === 'ACTIVE' ? 'btn-outline-warning' : 'btn-outline-success'
                                }`}
                                onClick={() => handleToggleStatus(acc)}
                                disabled={actionLoading || isSelf || isLastAdmin}
                                title={
                                  isSelf
                                    ? 'Cannot deactivate your own account'
                                    : isLastAdmin
                                    ? 'Cannot deactivate the last active administrator'
                                    : acc.status === 'ACTIVE'
                                    ? 'Deactivate account login access'
                                    : 'Reactivate account login access'
                                }
                              >
                                {acc.status === 'ACTIVE' ? (
                                  <>
                                    <i className="bi bi-pause-circle me-1"></i>Deactivate
                                  </>
                                ) : (
                                  <>
                                    <i className="bi bi-play-circle me-1"></i>Reactivate
                                  </>
                                )}
                              </button>

                              {/* Permanent Delete Button */}
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handlePromptDelete(acc)}
                                disabled={actionLoading || isSelf || isLastAdmin}
                                title={
                                  isSelf
                                    ? 'Cannot delete your own account'
                                    : isLastAdmin
                                    ? 'Cannot delete the last active administrator'
                                    : 'Permanently purge this account and all associated data'
                                }
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PLATFORM OVERVIEW */}
      {activeTab === 'platform' && (
        <div className="row g-4">
          {/* Room Categories Breakdown */}
          <div className="col-12 col-lg-6">
            <div className="card border shadow-sm h-100">
              <div className="card-header bg-white py-3 border-bottom">
                <h5 className="h6 fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-door-open text-primary"></i>
                  <span>Saved Rooms by Category</span>
                </h5>
              </div>
              <div className="card-body p-3">
                {overviewData?.roomsByCategory && Object.keys(overviewData.roomsByCategory).length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light text-muted small text-uppercase">
                        <tr>
                          <th>Category</th>
                          <th className="text-end">Total Listings</th>
                        </tr>
                      </thead>
                      <tbody className="small">
                        {Object.entries(overviewData.roomsByCategory).map(([cat, count]) => (
                          <tr key={cat}>
                            <td className="text-capitalize fw-medium">
                              <span className="badge bg-light text-dark border me-2">{cat}</span>
                            </td>
                            <td className="text-end fw-semibold">{count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted small mb-0">No room category statistics recorded yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Trips by Status Breakdown */}
          <div className="col-12 col-lg-6">
            <div className="card border shadow-sm h-100">
              <div className="card-header bg-white py-3 border-bottom">
                <h5 className="h6 fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-compass text-success"></i>
                  <span>Trip Lifecycle Distribution</span>
                </h5>
              </div>
              <div className="card-body p-3">
                {overviewData?.tripsByStatus && Object.keys(overviewData.tripsByStatus).length > 0 ? (
                  <div className="table-responsive">
                    <table className="table table-sm align-middle mb-0">
                      <thead className="table-light text-muted small text-uppercase">
                        <tr>
                          <th>Trip Status</th>
                          <th className="text-end">Count</th>
                        </tr>
                      </thead>
                      <tbody className="small">
                        {Object.entries(overviewData.tripsByStatus).map(([st, count]) => (
                          <tr key={st}>
                            <td className="text-capitalize fw-medium">
                              <span className="badge bg-light text-dark border me-2">{st}</span>
                            </td>
                            <td className="text-end fw-semibold">{count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-muted small mb-0">No trip status statistics recorded yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Aggregate Telemetry Summary */}
          <div className="col-12">
            <div className="card border shadow-sm bg-white p-4">
              <div className="d-flex align-items-center gap-3">
                <span className="p-3 bg-primary-subtle text-primary rounded-circle">
                  <i className="bi bi-shield-lock" style={{ fontSize: '1.5rem' }}></i>
                </span>
                <div>
                  <h6 className="fw-bold text-dark mb-1">Administrative Data Minimisation Standard</h6>
                  <p className="text-secondary small mb-0">
                    RoomTrail strictly prevents administrators from browsing individual users' route points, GPS coordinates, saved property notes, contact numbers, or travel records. All data above is aggregated strictly at the platform level.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: ADMIN PROFILE & AUDIT LOGS */}
      {activeTab === 'profile' && (
        <div className="row g-4">
          {/* Admin Profile Session Card */}
          <div className="col-12 col-lg-4">
            <div className="card border shadow-sm h-100">
              <div className="card-header bg-white py-3 border-bottom">
                <h5 className="h6 fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-person-badge text-primary"></i>
                  <span>Administrator Session</span>
                </h5>
              </div>
              <div className="card-body p-3">
                <div className="text-center py-3 border-bottom mb-3">
                  <div className="avatar-circle mx-auto mb-2 bg-dark text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '56px', height: '56px', fontSize: '1.4rem' }}>
                    <i className="bi bi-shield-shaded"></i>
                  </div>
                  <h6 className="fw-bold text-dark mb-0">ADM-{String(currentAdmin?.id || 5).padStart(3, '0')}</h6>
                  <span className="badge bg-dark text-white mt-1">Platform Administrator</span>
                </div>
                <div className="small">
                  <div className="d-flex justify-content-between py-1 border-bottom">
                    <span className="text-muted">Username</span>
                    <span className="fw-semibold font-monospace">{currentAdmin?.username || 'admink'}</span>
                  </div>
                  <div className="d-flex justify-content-between py-1 border-bottom">
                    <span className="text-muted">Security Role</span>
                    <span className="fw-semibold">{currentAdmin?.role || 'ROLE_ADMIN'}</span>
                  </div>
                  <div className="d-flex justify-content-between py-1 border-bottom">
                    <span className="text-muted">Access Level</span>
                    <span className="badge bg-success-subtle text-success">Super Admin / Governance</span>
                  </div>
                  <div className="d-flex justify-content-between py-1">
                    <span className="text-muted">Session Status</span>
                    <span className="text-success fw-medium">Active JWT</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Logs Table */}
          <div className="col-12 col-lg-8">
            <div className="card border shadow-sm h-100">
              <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                <h5 className="h6 fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                  <i className="bi bi-journal-text text-secondary"></i>
                  <span>Administrative Action Audit Log</span>
                </h5>
                <span className="badge bg-secondary-subtle text-secondary small">Last 50 Events</span>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light text-muted small text-uppercase">
                      <tr>
                        <th className="ps-3 py-2" style={{ width: '22%' }}>Timestamp</th>
                        <th style={{ width: '15%' }}>Admin</th>
                        <th style={{ width: '22%' }}>Action</th>
                        <th style={{ width: '15%' }}>Target</th>
                        <th className="pe-3" style={{ width: '26%' }}>Details</th>
                      </tr>
                    </thead>
                    <tbody className="small">
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="text-center py-4 text-muted">
                            No administrative events recorded yet.
                          </td>
                        </tr>
                      ) : (
                        auditLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="ps-3 py-2 text-muted">
                              {log.timestamp ? formatDate(log.timestamp) : 'N/A'}
                            </td>
                            <td>
                              <span className="badge bg-light text-dark border font-monospace">
                                {log.adminReference}
                              </span>
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  log.actionPerformed === 'DELETE_ACCOUNT'
                                    ? 'bg-danger-subtle text-danger border border-danger-subtle'
                                    : log.actionPerformed === 'DEACTIVATE_ACCOUNT'
                                    ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                                    : 'bg-success-subtle text-success border border-success-subtle'
                                }`}
                              >
                                {log.actionPerformed}
                              </span>
                            </td>
                            <td>
                              <span className="badge bg-light text-dark border font-monospace">
                                {log.targetAccountReference}
                              </span>
                            </td>
                            <td className="pe-3 text-secondary text-truncate" style={{ maxWidth: '220px' }}>
                              {log.details}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Permanent Account Deletion Confirmation */}
      {showDeleteModal && accountToDelete && (
        <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-danger text-white border-0 py-3">
                <h5 className="modal-title h6 fw-bold d-flex align-items-center gap-2">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  <span>Confirm Permanent Account Deletion</span>
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  aria-label="Close"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setAccountToDelete(null);
                  }}
                  disabled={actionLoading}
                ></button>
              </div>
              <div className="modal-body p-4">
                <div className="alert alert-danger-subtle border-danger-subtle py-2 px-3 mb-3 small text-danger">
                  <i className="bi bi-shield-slash me-1"></i>
                  <strong>Warning: This action is permanent and irreversible.</strong>
                </div>
                <p className="text-secondary small mb-3">
                  You are about to permanently delete account{' '}
                  <strong className="text-dark font-monospace">{accountToDelete.accountRef}</strong>.
                </p>
                <div className="p-3 bg-light rounded-2 border mb-3 small text-muted">
                  <ul className="mb-0 ps-3">
                    <li>The user will be immediately purged from the database.</li>
                    <li>All associated route points and GPS coordinates will be deleted.</li>
                    <li>All trips, trip summaries, visits, and saved rooms will be deleted.</li>
                    <li>A permanent record will be stored in the administrative audit log.</li>
                  </ul>
                </div>
                <p className="text-danger small fw-medium mb-0">
                  Are you absolutely certain you want to proceed?
                </p>
              </div>
              <div className="modal-footer bg-light border-top py-2 px-3">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setAccountToDelete(null);
                  }}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm d-flex align-items-center gap-1 shadow-sm"
                  onClick={handleConfirmDelete}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <i className="bi bi-trash-fill"></i>
                      <span>Permanently Delete Account</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
