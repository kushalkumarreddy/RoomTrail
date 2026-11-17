import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { isValidEmail, isValidPhone, isValidCoordinate } from '../../utils/validators';
import { formatDate } from '../../utils/formatters';

const ProfilePage = () => {
  const { user, updateProfile, changePassword } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();

  const [activeTab, setActiveTab] = useState('profile'); // 'profile', 'travel', 'security'

  // Profile Form state
  const [profileData, setProfileData] = useState({
    fullName: '',
    email: '',
    phone: '',
    bio: '',
    city: '',
    homeLat: '',
    homeLng: '',
  });

  // Travel Preferences Form state
  const [travelData, setTravelData] = useState({
    travelMode: 'car',
    notificationRadiusMeters: 100,
    role: 'Traveler & Renter',
  });

  // Password state
  const [securityData, setSecurityData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [locatingGPS, setLocatingGPS] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingTravel, setSavingTravel] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileData({
        fullName: user.fullName || '',
        email: user.email || '',
        phone: user.phone || '',
        bio: user.bio || '',
        city: user.city || '',
        homeLat: user.homeCoordinates?.lat ?? '',
        homeLng: user.homeCoordinates?.lng ?? '',
      });

      setTravelData({
        travelMode: user.travelMode || 'car',
        notificationRadiusMeters: user.notificationRadiusMeters || 100,
        role: user.role || 'Traveler & Renter',
      });
    }
  }, [user]);

  // Handle detecting current GPS location
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      showError('Geolocation is not supported by your browser.');
      return;
    }

    setLocatingGPS(true);
    showInfo('Requesting GPS coordinates from browser...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setProfileData((prev) => ({
          ...prev,
          homeLat: lat,
          homeLng: lng,
        }));
        setLocatingGPS(false);
        showSuccess(`GPS coordinates detected: ${lat}, ${lng}`);
      },
      (err) => {
        setLocatingGPS(false);
        showError(`Could not obtain GPS location: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Submit Profile Updates
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!profileData.fullName.trim()) {
      showError('Full name cannot be empty.');
      return;
    }
    if (!isValidEmail(profileData.email)) {
      showError('Please enter a valid email address.');
      return;
    }
    if (profileData.phone && !isValidPhone(profileData.phone)) {
      showError('Please enter a valid phone number.');
      return;
    }

    if (
      (profileData.homeLat || profileData.homeLng) &&
      !isValidCoordinate(profileData.homeLat, profileData.homeLng)
    ) {
      showError('Please enter valid latitude (-90 to 90) and longitude (-180 to 180).');
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile({
        fullName: profileData.fullName.trim(),
        email: profileData.email.trim(),
        phone: profileData.phone.trim(),
        bio: profileData.bio.trim(),
        city: profileData.city.trim(),
        homeCoordinates: {
          lat: profileData.homeLat !== '' ? parseFloat(profileData.homeLat) : null,
          lng: profileData.homeLng !== '' ? parseFloat(profileData.homeLng) : null,
        },
      });
      showSuccess('Profile updated successfully.');
    } catch (err) {
      showError(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Submit Travel Preferences Updates
  const handleSaveTravel = async (e) => {
    e.preventDefault();
    setSavingTravel(true);
    try {
      await updateProfile({
        travelMode: travelData.travelMode,
        notificationRadiusMeters: parseInt(travelData.notificationRadiusMeters, 10),
        role: travelData.role,
      });
      showSuccess('Travel & tracking preferences saved.');
    } catch (err) {
      showError(err.message || 'Failed to save travel preferences.');
    } finally {
      setSavingTravel(false);
    }
  };

  // Submit Password Change
  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (!securityData.currentPassword) {
      showError('Please enter your current password.');
      return;
    }
    if (!securityData.newPassword || securityData.newPassword.length < 6) {
      showError('New password must be at least 6 characters.');
      return;
    }
    if (securityData.newPassword !== securityData.confirmPassword) {
      showError('New passwords do not match.');
      return;
    }

    setSavingPassword(true);
    try {
      await changePassword(securityData.currentPassword, securityData.newPassword);
      showSuccess('Password updated successfully.');
      setSecurityData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      showError(err.message || 'Failed to update password.');
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">User Profile & Settings</h2>
          <p className="page-subtitle">
            Manage your personal profile, GPS home base coordinates, and route preferences
          </p>
        </div>
      </div>

      <div className="row g-4">
        {/* Left Sidebar: User Summary Card */}
        <div className="col-lg-4">
          <div className="rt-card mb-4 text-center p-4">
            <div className="rt-avatar rt-avatar-lg mx-auto mb-3">
              {user?.fullName
                ? user.fullName
                    .split(' ')
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()
                : 'RT'}
            </div>
            <h5 className="fw-bold mb-1 text-dark">{user?.fullName || 'Traveler'}</h5>
            <p className="text-muted small mb-2">@{user?.username || 'user'}</p>
            <span className="badge rounded-pill bg-primary-subtle text-primary border border-primary-subtle px-3 py-1 small">
              {user?.role || 'Traveler & Renter'}
            </span>

            <div className="border-top mt-4 pt-3 text-start small">
              <div className="d-flex justify-content-between py-1 text-muted">
                <span>Account Created:</span>
                <span className="fw-medium text-dark">{formatDate(user?.createdAt)}</span>
              </div>
              <div className="d-flex justify-content-between py-1 text-muted">
                <span>Last Updated:</span>
                <span className="fw-medium text-dark">{formatDate(user?.updatedAt)}</span>
              </div>
              <div className="d-flex justify-content-between py-1 text-muted">
                <span>Base City:</span>
                <span className="fw-medium text-dark">{user?.city || 'Not set'}</span>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="rt-card p-2">
            <button
              type="button"
              className={`btn w-100 text-start py-2 px-3 mb-1 d-flex align-items-center gap-2 ${
                activeTab === 'profile' ? 'btn-rt-primary' : 'btn-rt-ghost'
              }`}
              onClick={() => setActiveTab('profile')}
            >
              <i className="bi bi-person"></i>
              Personal Information
            </button>
            <button
              type="button"
              className={`btn w-100 text-start py-2 px-3 mb-1 d-flex align-items-center gap-2 ${
                activeTab === 'travel' ? 'btn-rt-primary' : 'btn-rt-ghost'
              }`}
              onClick={() => setActiveTab('travel')}
            >
              <i className="bi bi-geo"></i>
              Travel & GPS Preferences
            </button>
            <button
              type="button"
              className={`btn w-100 text-start py-2 px-3 d-flex align-items-center gap-2 ${
                activeTab === 'security' ? 'btn-rt-primary' : 'btn-rt-ghost'
              }`}
              onClick={() => setActiveTab('security')}
            >
              <i className="bi bi-shield-lock"></i>
              Security & Password
            </button>
          </div>
        </div>

        {/* Right Form Panels */}
        <div className="col-lg-8">
          {/* TAB 1: Personal Profile */}
          {activeTab === 'profile' && (
            <div className="rt-card">
              <div className="rt-card-header">
                <div>
                  <h5 className="fw-bold mb-0 text-dark">Personal Information</h5>
                  <p className="text-muted small mb-0">Update your account name, contact and home base</p>
                </div>
              </div>
              <div className="rt-card-body">
                <form onSubmit={handleSaveProfile}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Full Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={profileData.fullName}
                        onChange={(e) =>
                          setProfileData({ ...profileData, fullName: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Email Address</label>
                      <input
                        type="email"
                        className="form-control"
                        value={profileData.email}
                        onChange={(e) =>
                          setProfileData({ ...profileData, email: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Phone Number</label>
                      <input
                        type="tel"
                        className="form-control"
                        placeholder="+91 98765 43210"
                        value={profileData.phone}
                        onChange={(e) =>
                          setProfileData({ ...profileData, phone: e.target.value })
                        }
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Base City / Region</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Bengaluru, India"
                        value={profileData.city}
                        onChange={(e) =>
                          setProfileData({ ...profileData, city: e.target.value })
                        }
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label">Bio / Travel Notes</label>
                      <textarea
                        className="form-control"
                        rows="3"
                        placeholder="Brief description of what you are searching for (e.g. 2BHK flat near Indiranagar, PGs with parking...)"
                        value={profileData.bio}
                        onChange={(e) =>
                          setProfileData({ ...profileData, bio: e.target.value })
                        }
                      />
                    </div>

                    {/* Coordinates & GPS */}
                    <div className="col-12 border-top pt-3 mt-4">
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div>
                          <label className="form-label fw-bold mb-0">Home Base GPS Coordinates</label>
                          <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            Used for starting route calculations and nearby search proximity
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1"
                          onClick={handleDetectGPS}
                          disabled={locatingGPS}
                        >
                          {locatingGPS ? (
                            <>
                              <span className="spinner-border spinner-border-sm" role="status"></span>
                              Locating...
                            </>
                          ) : (
                            <>
                              <i className="bi bi-geo-alt"></i>
                              Detect Current GPS
                            </>
                          )}
                        </button>
                      </div>

                      <div className="row g-2">
                        <div className="col-sm-6">
                          <input
                            type="number"
                            step="any"
                            className="form-control"
                            placeholder="Latitude (e.g. 12.9716)"
                            value={profileData.homeLat}
                            onChange={(e) =>
                              setProfileData({ ...profileData, homeLat: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-sm-6">
                          <input
                            type="number"
                            step="any"
                            className="form-control"
                            placeholder="Longitude (e.g. 77.5946)"
                            value={profileData.homeLng}
                            onChange={(e) =>
                              setProfileData({ ...profileData, homeLng: e.target.value })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-top d-flex justify-content-end">
                    <button
                      type="submit"
                      className="btn-rt-primary"
                      disabled={savingProfile}
                    >
                      {savingProfile ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                          Saving...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-lg"></i>
                          Save Profile Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: Travel Preferences */}
          {activeTab === 'travel' && (
            <div className="rt-card">
              <div className="rt-card-header">
                <div>
                  <h5 className="fw-bold mb-0 text-dark">Travel & GPS Preferences</h5>
                  <p className="text-muted small mb-0">Configure proximity threshold and travel modes</p>
                </div>
              </div>
              <div className="rt-card-body">
                <form onSubmit={handleSaveTravel}>
                  <div className="mb-4">
                    <label className="form-label fw-bold">Primary Travel Mode</label>
                    <p className="text-muted small mb-2">
                      Defines the default routing profile for road directions and speed estimates
                    </p>
                    <div className="row g-2">
                      {[
                        { id: 'car', label: 'Car / Driving', icon: 'bi-car-front' },
                        { id: 'bicycle', label: 'Bicycle / 2-Wheeler', icon: 'bi-bicycle' },
                        { id: 'walking', label: 'Walking / Foot', icon: 'bi-person-walking' },
                        { id: 'transit', label: 'Public Transit', icon: 'bi-bus-front' },
                      ].map((item) => (
                        <div key={item.id} className="col-sm-6">
                          <div
                            className={`p-3 rounded border cursor-pointer d-flex align-items-center gap-3 ${
                              travelData.travelMode === item.id
                                ? 'border-primary bg-primary-subtle text-primary'
                                : 'bg-white'
                            }`}
                            style={{ cursor: 'pointer' }}
                            onClick={() =>
                              setTravelData({ ...travelData, travelMode: item.id })
                            }
                          >
                            <i className={`bi ${item.icon} fs-4`}></i>
                            <div>
                              <div className="fw-bold small">{item.label}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="form-label fw-bold">Proximity Detection Threshold</label>
                    <p className="text-muted small mb-2">
                      When your live GPS coordinates enter this distance from a saved destination, RoomTrail will prompt you to confirm your visit.
                    </p>
                    <select
                      className="form-select"
                      value={travelData.notificationRadiusMeters}
                      onChange={(e) =>
                        setTravelData({
                          ...travelData,
                          notificationRadiusMeters: parseInt(e.target.value, 10),
                        })
                      }
                    >
                      <option value="50">50 meters (Strict - walking/dense buildings)</option>
                      <option value="100">100 meters (Recommended - balanced urban detection)</option>
                      <option value="250">250 meters (Moderate - driving & roadside)</option>
                      <option value="500">500 meters (Wide - rural or highway detection)</option>
                    </select>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold">User Role Description</label>
                    <input
                      type="text"
                      className="form-control"
                      value={travelData.role}
                      onChange={(e) =>
                        setTravelData({ ...travelData, role: e.target.value })
                      }
                      placeholder="e.g. Traveler, Rental Seeker, Surveyor"
                    />
                  </div>

                  <div className="mt-4 pt-3 border-top d-flex justify-content-end">
                    <button
                      type="submit"
                      className="btn-rt-primary"
                      disabled={savingTravel}
                    >
                      {savingTravel ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                          Saving...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-check-lg"></i>
                          Save Preferences
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: Security & Password */}
          {activeTab === 'security' && (
            <div className="rt-card">
              <div className="rt-card-header">
                <div>
                  <h5 className="fw-bold mb-0 text-dark">Security & Password</h5>
                  <p className="text-muted small mb-0">Update your account login password</p>
                </div>
              </div>
              <div className="rt-card-body">
                <form onSubmit={handleSavePassword}>
                  <div className="mb-3">
                    <label className="form-label">Current Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={securityData.currentPassword}
                      onChange={(e) =>
                        setSecurityData({
                          ...securityData,
                          currentPassword: e.target.value,
                        })
                      }
                      placeholder="Enter existing password"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">New Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={securityData.newPassword}
                      onChange={(e) =>
                        setSecurityData({ ...securityData, newPassword: e.target.value })
                      }
                      placeholder="At least 6 characters"
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label className="form-label">Confirm New Password</label>
                    <input
                      type="password"
                      className="form-control"
                      value={securityData.confirmPassword}
                      onChange={(e) =>
                        setSecurityData({
                          ...securityData,
                          confirmPassword: e.target.value,
                        })
                      }
                      placeholder="Repeat new password"
                      required
                    />
                  </div>

                  <div className="mt-4 pt-3 border-top d-flex justify-content-end">
                    <button
                      type="submit"
                      className="btn-rt-primary"
                      disabled={savingPassword}
                    >
                      {savingPassword ? (
                        <>
                          <span className="spinner-border spinner-border-sm" role="status"></span>
                          Updating Password...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-lock"></i>
                          Update Password
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
