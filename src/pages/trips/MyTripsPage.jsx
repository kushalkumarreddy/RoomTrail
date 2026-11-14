import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { tripService, propertyService, routingService } from '../../services';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import { formatDate, formatDistance, getCategoryIcon } from '../../utils/formatters';

const MyTripsPage = () => {
  const { user } = useAuth();
  const { showSuccess, showError, showInfo, showWarning } = useNotification();
  const navigate = useNavigate();

  const [trips, setTrips] = useState([]);
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'active', 'planned', 'completed'

  // Create Trip Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTripData, setNewTripData] = useState({
    title: '',
    tripName: '',
    startLocation: user?.city || 'Bengaluru Base',
    endLocation: 'Indiranagar Central',
    description: '',
    travelMode: user?.travelMode || 'car',
    scheduledDate: new Date().toISOString().split('T')[0],
    startTime: new Date().toISOString().split('T')[0],
    selectedDestinationIds: [],
  });

  // Route Optimizer Modal State
  const [isOptimizerOpen, setIsOptimizerOpen] = useState(false);
  const [activeOptimizingTrip, setActiveOptimizingTrip] = useState(null);
  const [optimizerDestinations, setOptimizerDestinations] = useState([]);
  const [optimizingRoute, setOptimizingRoute] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [selectedPlaceToAdd, setSelectedPlaceToAdd] = useState('');
  const [revisitWarningPlace, setRevisitWarningPlace] = useState(null);

  // Delete Dialog State
  const [tripToDelete, setTripToDelete] = useState(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tripsData, placesData] = await Promise.all([
        tripService.getAll(),
        propertyService.getAll(),
      ]);

      const userTrips = user?.id ? tripsData.filter((t) => !t.userId || t.userId === user.id) : tripsData;
      const userPlaces = user?.id ? placesData.filter((p) => !p.userId || p.userId === user.id) : placesData;

      setTrips(userTrips);
      setPlaces(userPlaces);
    } catch (err) {
      showError('Failed to load trips data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  // Toggle selection for creating a new trip
  const handleDestinationToggle = (id) => {
    setNewTripData((prev) => {
      const exists = prev.selectedDestinationIds.includes(id);
      return {
        ...prev,
        selectedDestinationIds: exists
          ? prev.selectedDestinationIds.filter((dId) => dId !== id)
          : [...prev.selectedDestinationIds, id],
      };
    });
  };

  // Create Trip Submission
  const handleCreateTrip = async (e) => {
    e.preventDefault();
    const tripTitle = newTripData.title.trim() || newTripData.tripName.trim();
    if (!tripTitle) {
      showError('Trip name is required.');
      return;
    }

    try {
      const chosenPlaces = places.filter((p) =>
        newTripData.selectedDestinationIds.includes(p.id)
      );

      // Estimate distance and travel time based on stops
      const estimatedKm = chosenPlaces.length > 0 ? (chosenPlaces.length * 2.8).toFixed(1) : '1.5';
      const estimatedMins = chosenPlaces.length > 0 ? chosenPlaces.length * 20 : 15;

      const created = await tripService.create({
        tripName: tripTitle,
        title: tripTitle,
        description: newTripData.description.trim(),
        startLocation: newTripData.startLocation.trim() || 'Home Base',
        startCoordinates: user?.homeCoordinates || { lat: 12.9716, lng: 77.5946 },
        endLocation:
          newTripData.endLocation.trim() ||
          (chosenPlaces[chosenPlaces.length - 1]?.name || 'Final Stop'),
        endCoordinates: chosenPlaces[chosenPlaces.length - 1]
          ? {
              lat: chosenPlaces[chosenPlaces.length - 1].latitude || 12.9784,
              lng: chosenPlaces[chosenPlaces.length - 1].longitude || 77.6408,
            }
          : { lat: 12.9784, lng: 77.6408 },
        startTime: newTripData.startTime || newTripData.scheduledDate,
        scheduledDate: newTripData.scheduledDate,
        endTime: null,
        status: 'planned',
        totalDistance: `${estimatedKm} km`,
        totalDuration: `${estimatedMins} mins`,
        travelMode: newTripData.travelMode,
        userId: user?.id || '1',
        destinations: chosenPlaces.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          address: p.address,
          latitude: p.latitude,
          longitude: p.longitude,
          priority: p.priority || 'medium',
          visited: p.visited || false,
        })),
      });

      showSuccess(`Trip "${created.tripName}" created successfully!`);
      setIsCreateOpen(false);
      setNewTripData({
        title: '',
        tripName: '',
        startLocation: user?.city || 'Bengaluru Base',
        endLocation: 'Indiranagar Central',
        description: '',
        travelMode: user?.travelMode || 'car',
        scheduledDate: new Date().toISOString().split('T')[0],
        startTime: new Date().toISOString().split('T')[0],
        selectedDestinationIds: [],
      });
      loadData();
    } catch (err) {
      showError(err.message || 'Failed to create trip.');
    }
  };

  // Status changes: start, pause, complete
  const handleStatusChange = async (trip, newStatus) => {
    try {
      await tripService.update(trip.id, { status: newStatus });
      showSuccess(`Trip status updated to ${newStatus}.`);
      setTrips((prev) =>
        prev.map((t) => (t.id === trip.id ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      showError('Failed to update trip status.');
    }
  };

  // Delete trip
  const confirmDeleteTrip = async () => {
    if (!tripToDelete) return;
    try {
      await tripService.delete(tripToDelete.id);
      showSuccess(`Trip "${tripToDelete.title}" removed.`);
      setTrips((prev) => prev.filter((t) => t.id !== tripToDelete.id));
      setTripToDelete(null);
    } catch (err) {
      showError('Failed to delete trip.');
    }
  };

  // Open Route Optimizer Modal
  const handleOpenOptimizer = (trip) => {
    setActiveOptimizingTrip(trip);
    // Deep copy destinations to allow editing
    const currentDests = (trip.destinations || []).map((d) => {
      // Find matching place in places to ensure coordinates and latest visited status are present
      const matched = places.find((p) => p.id === d.id);
      return {
        ...d,
        latitude: d.latitude || matched?.latitude,
        longitude: d.longitude || matched?.longitude,
        priority: d.priority || matched?.priority || 'medium',
        visited: d.visited ?? matched?.visited ?? false,
      };
    });
    setOptimizerDestinations(currentDests);
    setOptimizationResult(null);
    setSelectedPlaceToAdd('');
    setRevisitWarningPlace(null);
    setIsOptimizerOpen(true);
  };

  // Manual Reordering: Move Up
  const handleMoveStopUp = (index) => {
    if (index <= 0) return;
    setOptimizerDestinations((prev) => {
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
    setOptimizationResult(null); // Invalidate previous calculation
  };

  // Manual Reordering: Move Down
  const handleMoveStopDown = (index) => {
    if (index >= optimizerDestinations.length - 1) return;
    setOptimizerDestinations((prev) => {
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      return copy;
    });
    setOptimizationResult(null);
  };

  // Exclude destination from itinerary
  const handleExcludeDestination = (id) => {
    setOptimizerDestinations((prev) => prev.filter((d) => d.id !== id));
    setOptimizationResult(null);
    showInfo('Destination excluded from this trip itinerary.');
  };

  // Add destination to itinerary (with duplicate visit warning)
  const handleAddDestinationToItinerary = () => {
    if (!selectedPlaceToAdd) return;
    const place = places.find((p) => p.id === selectedPlaceToAdd);
    if (!place) return;

    // Check if already in itinerary
    if (optimizerDestinations.some((d) => d.id === place.id)) {
      showWarning(`"${place.name}" is already in this trip itinerary.`);
      return;
    }

    // Check duplicate visit: if place is already visited
    if (place.visited && !revisitWarningPlace) {
      setRevisitWarningPlace(place);
      return;
    }

    // Add place
    const newEntry = {
      id: place.id,
      name: place.name,
      category: place.category,
      address: place.address,
      latitude: place.latitude,
      longitude: place.longitude,
      priority: place.priority || 'medium',
      visited: place.visited || false,
      isIntentionalRevisit: Boolean(place.visited),
    };

    setOptimizerDestinations((prev) => [...prev, newEntry]);
    setSelectedPlaceToAdd('');
    setRevisitWarningPlace(null);
    setOptimizationResult(null);
    showSuccess(`Added "${place.name}" to trip itinerary.`);
  };

  // Execute Route Optimization via OSRM
  const handleRunOptimization = async () => {
    if (!optimizerDestinations.length) {
      showWarning('Add at least one destination to optimize.');
      return;
    }

    setOptimizingRoute(true);
    setOptimizationResult(null);

    const startLoc = {
      lat: activeOptimizingTrip?.startCoordinates?.lat || user?.homeCoordinates?.lat || 12.9716,
      lng: activeOptimizingTrip?.startCoordinates?.lng || user?.homeCoordinates?.lng || 77.5946,
      name: activeOptimizingTrip?.startLocation || 'Home Base',
    };

    try {
      showInfo('Calculating optimal road route and destination sequence via OSRM...');
      const result = await routingService.optimizeTripRoute({
        startLocation: startLoc,
        destinations: optimizerDestinations,
        profile: activeOptimizingTrip?.travelMode || user?.travelMode || 'driving',
        factorPriority: true,
      });

      setOptimizationResult(result);
      if (result.orderedDestinations && result.orderedDestinations.length > 0) {
        setOptimizerDestinations(result.orderedDestinations);
      }
      showSuccess(
        `Route Optimized! Total: ${result.distanceKm} (${result.durationMinutes}). Savings: ${result.savingsKm}`
      );
    } catch (err) {
      console.error('Route optimization error', err);
      showError('Failed to optimize road route.');
    } finally {
      setOptimizingRoute(false);
    }
  };

  // Save changes to trip in JSON Server
  const handleSaveItinerary = async () => {
    if (!activeOptimizingTrip) return;

    try {
      const updatedTotalDistance =
        optimizationResult?.distanceKm || activeOptimizingTrip.totalDistance || '2.5 km';
      const updatedTotalDuration =
        optimizationResult?.durationMinutes || activeOptimizingTrip.totalDuration || '20 mins';

      await tripService.update(activeOptimizingTrip.id, {
        destinations: optimizerDestinations,
        totalDistance: updatedTotalDistance,
        totalDuration: updatedTotalDuration,
      });

      setTrips((prev) =>
        prev.map((t) =>
          t.id === activeOptimizingTrip.id
            ? {
                ...t,
                destinations: optimizerDestinations,
                totalDistance: updatedTotalDistance,
                totalDuration: updatedTotalDuration,
              }
            : t
        )
      );

      showSuccess('Trip itinerary sequence and route distance saved successfully!');
      setIsOptimizerOpen(false);
      setActiveOptimizingTrip(null);
    } catch (err) {
      showError('Failed to save updated itinerary.');
    }
  };

  // Open external turn-by-turn navigation for destination
  const handleOpenNavigation = (dest) => {
    if (!dest.latitude || !dest.longitude) {
      showWarning('Destination has no coordinates recorded.');
      return;
    }
    const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest.latitude},${dest.longitude}`;
    window.open(navUrl, '_blank', 'noopener,noreferrer');
  };

  const filteredTrips = trips.filter((t) => {
    if (activeTab === 'all') return true;
    return t.status === activeTab;
  });

  const getTravelModeIcon = (mode) => {
    switch (mode?.toLowerCase()) {
      case 'walking':
        return 'bi-person-walking';
      case 'bicycle':
        return 'bi-bicycle';
      case 'transit':
        return 'bi-bus-front';
      case 'car':
      default:
        return 'bi-car-front';
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Travel Trips & Itineraries</h2>
          <p className="page-subtitle">
            Smart multi-stop route optimization, duplicate visit prevention, and sequential travel management
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/map-explorer" className="btn btn-rt-secondary btn-sm">
            <i className="bi bi-map"></i> View Map Explorer
          </Link>
          <button
            type="button"
            className="btn btn-rt-primary btn-sm"
            onClick={() => setIsCreateOpen(true)}
          >
            <i className="bi bi-plus-lg"></i> Plan New Trip
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div className="btn-group btn-group-sm" role="group">
          <button
            type="button"
            className={`btn ${activeTab === 'all' ? 'btn-rt-primary' : 'btn-rt-secondary'}`}
            onClick={() => setActiveTab('all')}
          >
            All Trips ({trips.length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'active' ? 'btn-rt-primary' : 'btn-rt-secondary'}`}
            onClick={() => setActiveTab('active')}
          >
            Active ({trips.filter((t) => t.status === 'active').length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'planned' ? 'btn-rt-primary' : 'btn-rt-secondary'}`}
            onClick={() => setActiveTab('planned')}
          >
            Planned ({trips.filter((t) => t.status === 'planned').length})
          </button>
          <button
            type="button"
            className={`btn ${activeTab === 'completed' ? 'btn-rt-primary' : 'btn-rt-secondary'}`}
            onClick={() => setActiveTab('completed')}
          >
            Completed ({trips.filter((t) => t.status === 'completed').length})
          </button>
        </div>
      </div>

      {/* Listing Content */}
      {loading ? (
        <LoadingSpinner fullPage text="Loading trips..." />
      ) : filteredTrips.length === 0 ? (
        trips.length === 0 ? (
          <EmptyState
            icon="bi-signpost-split"
            title="No Travel Trips Created Yet"
            description="Bundle your saved destinations into a structured itinerary to track live progress, record routes, and avoid unnecessary visits."
            actionLabel="Create First Trip"
            actionIcon="bi-plus-lg"
            onAction={() => setIsCreateOpen(true)}
          />
        ) : (
          <EmptyState
            icon="bi-filter"
            title={`No ${activeTab} trips found`}
            description="There are currently no trips matching this status filter."
            actionLabel="View All Trips"
            onAction={() => setActiveTab('all')}
          />
        )
      ) : (
        <div className="row g-4">
          {filteredTrips.map((trip) => {
            const dests = trip.destinations || [];
            const visitedCount = dests.filter((d) => d.visited).length;
            const progressPercent =
              dests.length > 0 ? Math.round((visitedCount / dests.length) * 100) : 0;

            return (
              <div key={trip.id} className="col-md-6 col-xl-4">
                <div className="rt-card rt-card-interactive h-100 d-flex flex-column">
                  <div className="rt-card-header">
                    <div className="d-flex align-items-center gap-2">
                      <i className={`bi ${getTravelModeIcon(trip.travelMode)} text-primary fs-5`}></i>
                      <span className="badge rounded-pill bg-light text-dark border small text-capitalize">
                        {trip.travelMode || 'Car'}
                      </span>
                    </div>
                    <span
                      className={`badge ${
                        trip.status === 'active'
                          ? 'bg-warning text-dark'
                          : trip.status === 'completed'
                          ? 'bg-success'
                          : 'bg-primary'
                      }`}
                    >
                      {trip.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="rt-card-body flex-grow-1 d-flex flex-column">
                    <h5 className="fw-bold text-dark mb-1">{trip.tripName || trip.title}</h5>
                    <p className="text-muted small mb-2">
                      {trip.description || 'Destination route and travel plan.'}
                    </p>

                    <div className="d-flex justify-content-between align-items-center small text-muted mb-2 py-1 px-2 rounded bg-light border">
                      <span className="text-truncate" style={{ maxWidth: '65%' }}>
                        <i className="bi bi-geo me-1 text-primary"></i> {trip.startLocation || 'Base'} &rarr;{' '}
                        {trip.endLocation || 'End'}
                      </span>
                      <span className="fw-semibold text-dark">{trip.totalDistance || '1.5 km'}</span>
                    </div>

                    <div className="mb-3">
                      <div className="d-flex justify-content-between small text-muted mb-1">
                        <span>Visit Progress:</span>
                        <strong className="text-dark">
                          {visitedCount} / {dests.length} visited ({progressPercent}%)
                        </strong>
                      </div>
                      <div className="progress" style={{ height: '6px' }}>
                        <div
                          className="progress-bar bg-success"
                          role="progressbar"
                          style={{ width: `${progressPercent}%` }}
                          aria-valuenow={progressPercent}
                          aria-valuemin="0"
                          aria-valuemax="100"
                        ></div>
                      </div>
                    </div>

                    {dests.length > 0 && (
                      <div className="p-2 rounded bg-light border mb-3 small">
                        <div
                          className="fw-bold text-muted text-uppercase mb-1"
                          style={{ fontSize: '0.7rem' }}
                        >
                          Scheduled Destinations ({dests.length})
                        </div>
                        <ul className="list-unstyled mb-0">
                          {dests.slice(0, 3).map((d, idx) => (
                            <li key={idx} className="text-truncate text-secondary mb-1">
                              <i
                                className={`bi ${
                                  d.visited ? 'bi-check-circle-fill text-success' : 'bi-circle text-muted'
                                } me-1`}
                              ></i>
                              {d.name}
                            </li>
                          ))}
                          {dests.length > 3 && (
                            <li className="text-muted" style={{ fontSize: '0.72rem' }}>
                              +{dests.length - 3} more destinations
                            </li>
                          )}
                        </ul>
                      </div>
                    )}

                    <div className="mt-auto pt-3 border-top d-flex align-items-center justify-content-between gap-2 flex-wrap">
                      <div className="d-flex gap-1 flex-wrap">
                        {/* Plan & Optimize Button */}
                        <button
                          type="button"
                          className="btn btn-sm btn-rt-accent"
                          onClick={() => handleOpenOptimizer(trip)}
                          title="Smart Route Optimization & Reordering"
                        >
                          <i className="bi bi-diagram-3 me-1"></i> Optimize Route
                        </button>

                        {trip.status === 'planned' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success"
                            onClick={() => handleStatusChange(trip, 'active')}
                          >
                            <i className="bi bi-play-fill"></i> Start
                          </button>
                        )}
                        {trip.status === 'active' && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleStatusChange(trip, 'completed')}
                          >
                            <i className="bi bi-check-all"></i> Complete
                          </button>
                        )}
                        <Link
                          to={`/trips/${trip.id}/summary`}
                          className="btn btn-sm btn-rt-secondary"
                        >
                          <i className="bi bi-bar-chart"></i> Summary
                        </Link>
                        <Link
                          to={`/travel-history-map?tripId=${trip.id}`}
                          className="btn btn-sm btn-outline-primary"
                          title="Open Travel History Map"
                        >
                          <i className="bi bi-signpost-2"></i> Map
                        </Link>
                      </div>

                      <button
                        type="button"
                        className="btn btn-rt-ghost btn-sm text-danger p-1"
                        onClick={() => setTripToDelete(trip)}
                        title="Delete Trip"
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Route Optimizer & Itinerary Studio Modal */}
      <Modal
        isOpen={isOptimizerOpen}
        onClose={() => {
          setIsOptimizerOpen(false);
          setActiveOptimizingTrip(null);
        }}
        title={`Smart Route Optimizer: ${activeOptimizingTrip?.tripName || activeOptimizingTrip?.title || 'Trip'}`}
        size="lg"
        footer={
          <div className="d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm btn-rt-accent"
              disabled={optimizingRoute || optimizerDestinations.length < 2}
              onClick={handleRunOptimization}
            >
              {optimizingRoute ? (
                <>
                  <span className="spinner-border spinner-border-sm me-1"></span>
                  Calculating Road TSP...
                </>
              ) : (
                <>
                  <i className="bi bi-magic me-1"></i> Run Smart Road Optimization
                </>
              )}
            </button>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-light border"
                onClick={() => {
                  setIsOptimizerOpen(false);
                  setActiveOptimizingTrip(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-rt-primary"
                onClick={handleSaveItinerary}
              >
                <i className="bi bi-check-lg me-1"></i> Accept & Save Itinerary
              </button>
            </div>
          </div>
        }
      >
        <div>
          {/* Optimization Summary Alert (if computed) */}
          {optimizationResult && (
            <div className="alert alert-success border-0 shadow-xs mb-3 py-2 px-3 small">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <strong className="text-success">
                    <i className="bi bi-check2-circle me-1"></i> Road Route Optimized:
                  </strong>{' '}
                  {optimizationResult.distanceKm} total road distance •{' '}
                  {optimizationResult.durationMinutes} estimated duration.
                </div>
                <span className="badge bg-success">
                  Savings: {optimizationResult.savingsKm} ({optimizationResult.savingsMinutes})
                </span>
              </div>
            </div>
          )}

          {/* Add Destination Bar with Duplicate Check */}
          <div className="p-3 bg-light rounded border mb-3">
            <label className="form-label small fw-bold text-dark mb-1">
              Add Saved Place to Itinerary:
            </label>
            <div className="d-flex gap-2">
              <select
                className="form-select form-select-sm"
                value={selectedPlaceToAdd}
                onChange={(e) => {
                  setSelectedPlaceToAdd(e.target.value);
                  setRevisitWarningPlace(null);
                }}
              >
                <option value="">-- Select a saved place to add --</option>
                {places.map((p) => {
                  const alreadyInTrip = optimizerDestinations.some((d) => d.id === p.id);
                  return (
                    <option key={p.id} value={p.id} disabled={alreadyInTrip}>
                      {p.name} ({p.category || 'Rental'} • {p.priority || 'Normal'} Priority
                      {p.visited ? ' • Visited' : ''})
                      {alreadyInTrip ? ' [Already in Trip]' : ''}
                    </option>
                  );
                })}
              </select>
              <button
                type="button"
                className="btn btn-sm btn-rt-primary text-nowrap"
                disabled={!selectedPlaceToAdd}
                onClick={handleAddDestinationToItinerary}
              >
                <i className="bi bi-plus-lg me-1"></i> Add Stop
              </button>
            </div>

            {/* Revisit / Duplicate Warning */}
            {revisitWarningPlace && (
              <div className="alert alert-warning border-0 p-2 mt-2 mb-0 small d-flex align-items-center justify-content-between">
                <div>
                  <i className="bi bi-exclamation-triangle-fill text-warning me-1"></i>
                  <strong>Duplicate Visit Notice:</strong> "{revisitWarningPlace.name}" was already visited. Add as an intentional revisit?
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-warning text-dark py-0 px-2 fw-semibold"
                  onClick={() => {
                    // Force add as intentional revisit
                    const newEntry = {
                      id: revisitWarningPlace.id,
                      name: revisitWarningPlace.name,
                      category: revisitWarningPlace.category,
                      address: revisitWarningPlace.address,
                      latitude: revisitWarningPlace.latitude,
                      longitude: revisitWarningPlace.longitude,
                      priority: revisitWarningPlace.priority || 'medium',
                      visited: true,
                      isIntentionalRevisit: true,
                    };
                    setOptimizerDestinations((prev) => [...prev, newEntry]);
                    setSelectedPlaceToAdd('');
                    setRevisitWarningPlace(null);
                    setOptimizationResult(null);
                    showSuccess(`Added "${revisitWarningPlace.name}" as intentional revisit.`);
                  }}
                >
                  Confirm Revisit
                </button>
              </div>
            )}
          </div>

          {/* Sequential Itinerary Stops List */}
          <div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold text-dark mb-0 small">
                Trip Stop Sequence ({optimizerDestinations.length} Stops)
              </h6>
              <span className="text-muted small" style={{ fontSize: '11px' }}>
                Use Move Up / Down to manually reorder, or click Smart Road Optimization
              </span>
            </div>

            {optimizerDestinations.length === 0 ? (
              <div className="p-4 text-center text-muted small border rounded">
                No stops currently in this itinerary. Add a destination above to start.
              </div>
            ) : (
              <div className="d-flex flex-column gap-2" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {optimizerDestinations.map((dest, idx) => (
                  <div key={dest.id || idx} className="itinerary-stop-card">
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="d-flex align-items-center gap-2">
                        <span className={`stop-number-pin ${dest.visited ? 'visited' : 'pending'}`}>
                          {idx + 1}
                        </span>
                        <div>
                          <div className="d-flex align-items-center gap-2">
                            <strong className="text-dark">{dest.name}</strong>
                            <span className="badge category-flat text-uppercase" style={{ fontSize: '0.65rem' }}>
                              {dest.category}
                            </span>
                            <span
                              className={`badge ${
                                dest.priority === 'high' ? 'priority-badge-high' : 'badge-rt-primary'
                              }`}
                              style={{ fontSize: '0.65rem' }}
                            >
                              {dest.priority?.toUpperCase()}
                            </span>
                            {dest.visited && (
                              <span className="badge bg-success-subtle text-success small" style={{ fontSize: '0.65rem' }}>
                                <i className="bi bi-check-circle-fill me-1"></i>
                                {dest.isIntentionalRevisit ? 'Intentional Revisit' : 'Visited'}
                              </span>
                            )}
                          </div>
                          <div className="text-muted small" style={{ fontSize: '11px' }}>
                            {dest.address || 'Address on record'}
                          </div>
                        </div>
                      </div>

                      {/* Control Actions */}
                      <div className="d-flex align-items-center gap-1">
                        {/* Open Navigation */}
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary py-0 px-2"
                          style={{ fontSize: '11px' }}
                          onClick={() => handleOpenNavigation(dest)}
                          title="Open turn-by-turn navigation in Google Maps"
                        >
                          <i className="bi bi-navigation me-1"></i> Navigate
                        </button>

                        {/* Move Up */}
                        <button
                          type="button"
                          className="btn btn-sm btn-light border py-0 px-2"
                          disabled={idx === 0}
                          onClick={() => handleMoveStopUp(idx)}
                          title="Move Stop Earlier"
                        >
                          <i className="bi bi-chevron-up"></i>
                        </button>

                        {/* Move Down */}
                        <button
                          type="button"
                          className="btn btn-sm btn-light border py-0 px-2"
                          disabled={idx === optimizerDestinations.length - 1}
                          onClick={() => handleMoveStopDown(idx)}
                          title="Move Stop Later"
                        >
                          <i className="bi bi-chevron-down"></i>
                        </button>

                        {/* Exclude */}
                        <button
                          type="button"
                          className="btn btn-sm btn-light border text-danger py-0 px-2"
                          onClick={() => handleExcludeDestination(dest.id)}
                          title="Exclude Stop from Itinerary"
                        >
                          <i className="bi bi-x-lg"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Create New Trip Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Plan New Travel Trip"
        size="lg"
        footer={
          <div className="d-flex justify-content-end gap-2 w-100">
            <button
              type="button"
              className="btn btn-sm btn-light border"
              onClick={() => setIsCreateOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm btn-rt-primary"
              onClick={handleCreateTrip}
            >
              <i className="bi bi-check-lg me-1"></i> Save Trip Itinerary
            </button>
          </div>
        }
      >
        <form onSubmit={handleCreateTrip}>
          <div className="row g-3">
            <div className="col-md-8">
              <label className="form-label">Trip Title *</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Indiranagar Weekend Flat Tour"
                value={newTripData.title}
                onChange={(e) => setNewTripData({ ...newTripData, title: e.target.value })}
                required
              />
            </div>

            <div className="col-md-4">
              <label className="form-label">Primary Transport Mode</label>
              <select
                className="form-select"
                value={newTripData.travelMode}
                onChange={(e) => setNewTripData({ ...newTripData, travelMode: e.target.value })}
              >
                <option value="car">Car / Driving</option>
                <option value="bicycle">Bicycle / 2-Wheeler</option>
                <option value="walking">Walking / Pedestrian</option>
                <option value="transit">Public Transit</option>
              </select>
            </div>

            <div className="col-md-6">
              <label className="form-label">Start Location</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Home Base (Indiranagar)"
                value={newTripData.startLocation}
                onChange={(e) => setNewTripData({ ...newTripData, startLocation: e.target.value })}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">End Location</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Indiranagar Metro Station"
                value={newTripData.endLocation}
                onChange={(e) => setNewTripData({ ...newTripData, endLocation: e.target.value })}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">Scheduled Date / Start Time</label>
              <input
                type="date"
                className="form-control"
                value={newTripData.scheduledDate}
                onChange={(e) => setNewTripData({ ...newTripData, scheduledDate: e.target.value })}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">Trip Notes / Objective</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Weekend tour around Bellandur"
                value={newTripData.description}
                onChange={(e) => setNewTripData({ ...newTripData, description: e.target.value })}
              />
            </div>

            {/* Destination Selection Checklist with Priority & Visited Badges */}
            <div className="col-12 mt-3">
              <label className="form-label fw-bold">Select Destinations to Include in This Trip</label>
              {places.length === 0 ? (
                <div className="p-3 rounded bg-light border text-center text-muted small">
                  No saved destinations found. Please save some places first.
                </div>
              ) : (
                <div className="row g-2" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                  {places.map((place) => {
                    const isChecked = newTripData.selectedDestinationIds.includes(place.id);
                    return (
                      <div key={place.id} className="col-md-6">
                        <div
                          className={`p-2 rounded border small d-flex align-items-center justify-content-between ${
                            isChecked
                              ? 'border-primary bg-primary-subtle text-primary fw-semibold'
                              : 'bg-white text-secondary'
                          }`}
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleDestinationToggle(place.id)}
                        >
                          <div className="d-flex align-items-center gap-2 text-truncate">
                            <i
                              className={`bi ${
                                isChecked ? 'bi-check-square-fill text-primary' : 'bi-square text-muted'
                              }`}
                            ></i>
                            <span className="text-dark text-truncate">{place.name}</span>
                          </div>
                          <div className="d-flex gap-1 flex-shrink-0">
                            <span className="badge category-flat text-uppercase" style={{ fontSize: '0.62rem' }}>
                              {place.category}
                            </span>
                            {place.visited && (
                              <span className="badge bg-success small" style={{ fontSize: '0.62rem' }}>
                                Visited
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(tripToDelete)}
        title="Delete Trip"
        message={`Are you sure you want to delete the trip "${tripToDelete?.title}"?`}
        confirmLabel="Delete Trip"
        confirmVariant="danger"
        onConfirm={confirmDeleteTrip}
        onCancel={() => setTripToDelete(null)}
      />
    </div>
  );
};

export default MyTripsPage;
