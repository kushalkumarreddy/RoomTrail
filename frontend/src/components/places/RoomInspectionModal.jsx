import React, { useState, useEffect, useMemo } from 'react';
import Modal from '../common/Modal';
import LoadingSpinner from '../common/LoadingSpinner';
import GoogleMapsLocationLink from '../common/GoogleMapsLocationLink';
import { inspectionService } from '../../services';
import { useNotification } from '../../hooks/useNotification';

const RoomInspectionModal = ({ isOpen, onClose, property, onInspectionSaved }) => {
  const { showSuccess, showError } = useNotification();

  const [activeTab, setActiveTab] = useState('form'); // 'form' | 'history'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [historyList, setHistoryList] = useState([]);

  // Form State
  const [currentInspectionId, setCurrentInspectionId] = useState(null);
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [overallRating, setOverallRating] = useState(0);
  const [overallRemarks, setOverallRemarks] = useState('');
  const [suitableForRent, setSuitableForRent] = useState(null);
  const [additionalConcerns, setAdditionalConcerns] = useState('');
  const [items, setItems] = useState([]);

  // UI state
  const [collapsedCategories, setCollapsedCategories] = useState({});
  const [openComments, setOpenComments] = useState({});
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);

  // Load template items and history when modal opens for a property
  useEffect(() => {
    if (!isOpen || !property?.id) return;

    let isMounted = true;
    const loadData = async () => {
      setLoading(true);
      try {
        const [template, history] = await Promise.all([
          inspectionService.getTemplate(),
          inspectionService.getByProperty(property.id).catch(() => []),
        ]);

        if (!isMounted) return;
        setHistoryList(history || []);

        // If there's an existing inspection and user opens it, start with template or latest
        initEmptyForm(template);
        setActiveTab('form');
      } catch (err) {
        console.error('Failed to load inspection template or history', err);
        showError('Failed to load inspection checklist template.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, [isOpen, property?.id]);

  const initEmptyForm = (templateList) => {
    setCurrentInspectionId(null);
    setInspectionDate(new Date().toISOString().split('T')[0]);
    setOverallRating(0);
    setOverallRemarks('');
    setSuitableForRent(null);
    setAdditionalConcerns('');
    setOpenComments({});
    setConfirmResetOpen(false);

    if (templateList && templateList.length > 0) {
      setItems(
        templateList.map((tpl) => ({
          category: tpl.category,
          itemKey: tpl.itemKey,
          itemLabel: tpl.itemLabel,
          status: 'UNMARKED',
          comment: '',
        }))
      );
    }
  };

  // Group items by category
  const categories = useMemo(() => {
    const map = {};
    items.forEach((item, index) => {
      const cat = item.category || 'General';
      if (!map[cat]) map[cat] = [];
      map[cat].push({ ...item, originalIndex: index });
    });
    return map;
  }, [items]);

  // Inspection statistics
  const stats = useMemo(() => {
    const total = items.length;
    let inspected = 0;
    let good = 0;
    let needsAttn = 0;
    let notAvail = 0;

    items.forEach((it) => {
      if (it.status === 'GOOD') {
        good++;
        inspected++;
      } else if (it.status === 'NEEDS_ATTENTION') {
        needsAttn++;
        inspected++;
      } else if (it.status === 'NOT_AVAILABLE') {
        notAvail++;
        inspected++;
      }
    });

    const percentage = total > 0 ? Math.round((inspected / total) * 100) : 0;
    return { total, inspected, good, needsAttn, notAvail, percentage };
  }, [items]);

  const toggleCategory = (catName) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catName]: !prev[catName],
    }));
  };

  const handleStatusChange = (index, newStatus) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], status: newStatus };
      return copy;
    });
  };

  const handleCommentChange = (index, newComment) => {
    if (newComment.length > 500) return;
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], comment: newComment };
      return copy;
    });
  };

  const toggleCommentInput = (itemKey) => {
    setOpenComments((prev) => ({
      ...prev,
      [itemKey]: !prev[itemKey],
    }));
  };

  // Load a historical inspection to review / edit
  const handleLoadInspection = async (inspSummary) => {
    setLoading(true);
    try {
      const full = await inspectionService.getById(inspSummary.id);
      setCurrentInspectionId(full.id);
      setInspectionDate(full.inspectionDate || new Date().toISOString().split('T')[0]);
      setOverallRating(full.overallRating || 0);
      setOverallRemarks(full.overallRemarks || '');
      setSuitableForRent(full.suitableForRent);
      setAdditionalConcerns(full.additionalConcerns || '');

      // Merge items with full template to ensure all 34 standard items exist
      const template = await inspectionService.getTemplate();
      const existingMap = {};
      (full.items || []).forEach((it) => {
        existingMap[it.itemKey] = it;
      });

      const merged = template.map((tpl) => {
        const found = existingMap[tpl.itemKey];
        return {
          category: tpl.category,
          itemKey: tpl.itemKey,
          itemLabel: tpl.itemLabel,
          status: found ? found.status : 'UNMARKED',
          comment: found ? found.comment || '' : '',
        };
      });

      setItems(merged);

      // Auto-open comments for items that already have a comment
      const commentMap = {};
      merged.forEach((it) => {
        if (it.comment && it.comment.trim()) {
          commentMap[it.itemKey] = true;
        }
      });
      setOpenComments(commentMap);

      setActiveTab('form');
      showSuccess(`Loaded inspection from ${full.inspectionDate} for editing.`);
    } catch (err) {
      console.error('Failed to load inspection details', err);
      showError('Failed to load inspection details.');
    } finally {
      setLoading(false);
    }
  };

  // Delete an inspection
  const handleDeleteInspection = async (inspectionId) => {
    if (!window.confirm('Are you sure you want to delete this room inspection record?')) {
      return;
    }
    try {
      await inspectionService.delete(inspectionId);
      setHistoryList((prev) => prev.filter((h) => h.id !== inspectionId));
      if (currentInspectionId === inspectionId) {
        const template = await inspectionService.getTemplate();
        initEmptyForm(template);
      }
      showSuccess('Inspection record deleted.');
      if (onInspectionSaved) onInspectionSaved();
    } catch (err) {
      console.error('Failed to delete inspection', err);
      showError('Failed to delete inspection.');
    }
  };

  // Reset form back to template unmarked state
  const handleConfirmReset = async () => {
    try {
      const template = await inspectionService.getTemplate();
      initEmptyForm(template);
      showSuccess('Inspection checklist reset to unmarked state.');
    } catch (err) {
      console.error('Reset failed', err);
    }
  };

  // Save inspection (Create or Update)
  const handleSaveInspection = async () => {
    if (!inspectionDate || !inspectionDate.trim()) {
      showError('Please provide an inspection date.');
      return;
    }

    if (overallRemarks && overallRemarks.length > 2000) {
      showError('Overall remarks must not exceed 2000 characters.');
      return;
    }

    if (additionalConcerns && additionalConcerns.length > 1000) {
      showError('Additional concerns must not exceed 1000 characters.');
      return;
    }

    const payload = {
      inspectionDate: inspectionDate.trim(),
      overallRating: overallRating > 0 ? overallRating : null,
      overallRemarks: overallRemarks.trim(),
      suitableForRent: suitableForRent,
      additionalConcerns: additionalConcerns.trim(),
      items: items.map((it) => ({
        category: it.category,
        itemKey: it.itemKey,
        itemLabel: it.itemLabel,
        status: it.status || 'UNMARKED',
        comment: (it.comment || '').trim(),
      })),
    };

    setSaving(true);
    try {
      let saved;
      if (currentInspectionId) {
        // Edit existing inspection
        saved = await inspectionService.update(currentInspectionId, payload);
        showSuccess('Inspection updated successfully!');
      } else {
        // Create new inspection
        saved = await inspectionService.create(property.id, payload);
        showSuccess('Room inspection saved successfully!');
        setCurrentInspectionId(saved.id);
      }

      // Refresh history list
      const updatedHistory = await inspectionService.getByProperty(property.id).catch(() => []);
      setHistoryList(updatedHistory);

      if (onInspectionSaved) {
        onInspectionSaved(saved);
      }
    } catch (err) {
      console.error('Failed to save inspection', err);
      showError(err.response?.data?.error || 'Failed to save room inspection.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <i className="bi bi-clipboard2-check-fill text-primary fs-5"></i>
          <span>Room Inspection Checklist</span>
          {property && (
            <span className="badge bg-light text-dark border small fw-normal">
              {property.name}
            </span>
          )}
        </div>
      }
      size="xl"
      footer={
        <div className="d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
          {/* Left Actions */}
          <div>
            {activeTab === 'form' && (
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => setConfirmResetOpen(true)}
                id="inspection-reset-btn"
                title="Reset all entered answers"
              >
                <i className="bi bi-arrow-counterclockwise me-1"></i> Reset
              </button>
            )}
          </div>

          {/* Right Actions */}
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary px-3"
              onClick={onClose}
              id="inspection-cancel-btn"
            >
              Close
            </button>
            {activeTab === 'form' && (
              <button
                type="button"
                className="btn btn-sm btn-rt-primary px-4 fw-semibold"
                onClick={handleSaveInspection}
                disabled={saving || loading}
                id="inspection-save-btn"
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-1" />
                    Saving...
                  </>
                ) : (
                  <>
                    <i className="bi bi-check2-circle me-1" />
                    {currentInspectionId ? 'Update Inspection' : 'Save Inspection'}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      }
    >
      <div id="room-inspection-modal-content">
        {/* Room Header Info */}
        {property && (
          <div className="p-3 bg-light rounded border mb-3">
            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
              <div>
                <h5 className="h6 fw-bold text-dark mb-1" id="inspection-property-name">
                  {property.name}
                </h5>
                <div className="text-muted small" id="inspection-property-address">
                  <GoogleMapsLocationLink
                    place={property}
                    onMissingLocation={() => showError('Location coordinates and address are not available for this room.')}
                  />
                </div>
              </div>
              <div className="d-flex align-items-center gap-2">
                {property.rent && (
                  <span className="badge bg-white text-dark border">
                    Rent: <strong>{property.rent}</strong>
                  </span>
                )}
                {currentInspectionId && (
                  <span className="badge bg-primary text-white">
                    <i className="bi bi-pencil-square me-1"></i> Editing Inspection #{currentInspectionId}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation & Progress Banner */}
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3 border-bottom pb-2">
          {/* Tabs */}
          <ul className="nav nav-pills nav-fill gap-2" role="tablist" id="inspection-tabs">
            <li className="nav-item" role="presentation">
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'form' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('form')}
                id="inspection-tab-checklist"
              >
                <i className="bi bi-card-checklist me-1"></i>
                {currentInspectionId ? 'Edit Inspection' : 'Inspection Checklist'}
              </button>
            </li>
            <li className="nav-item" role="presentation">
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('history')}
                id="inspection-tab-history"
              >
                <i className="bi bi-clock-history me-1"></i>
                Inspection History
                <span className="badge bg-secondary text-white ms-1" id="inspection-history-count-badge">
                  {historyList.length}
                </span>
              </button>
            </li>
          </ul>

          {/* Progress Indicator */}
          {activeTab === 'form' && (
            <div className="d-flex align-items-center gap-2" style={{ minWidth: '220px' }}>
              <div className="small text-muted text-nowrap">
                Progress: <strong className="text-dark" id="inspection-progress-text">{stats.inspected} / {stats.total} inspected</strong>
              </div>
              <div className="progress flex-grow-1" style={{ height: '8px' }}>
                <div
                  className="progress-bar bg-success"
                  role="progressbar"
                  style={{ width: `${stats.percentage}%` }}
                  aria-valuenow={stats.percentage}
                  aria-valuemin="0"
                  aria-valuemax="100"
                  id="inspection-progress-bar"
                />
              </div>
              <span className="badge bg-light text-dark border small fw-bold" id="inspection-progress-percent">
                {stats.percentage}%
              </span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="py-5 text-center">
            <LoadingSpinner text="Loading inspection checklist..." />
          </div>
        ) : activeTab === 'history' ? (
          /* ========================================================
             TAB 2: INSPECTION HISTORY
             ======================================================== */
          <div id="inspection-history-tab-pane">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="fw-bold text-dark mb-0">
                <i className="bi bi-clock-history me-1 text-primary"></i> Previous Inspections for this Room
              </h6>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={async () => {
                  const tpl = await inspectionService.getTemplate();
                  initEmptyForm(tpl);
                  setActiveTab('form');
                }}
                id="inspection-start-new-btn"
              >
                <i className="bi bi-plus-circle me-1"></i> Start New Inspection
              </button>
            </div>

            {historyList.length === 0 ? (
              <div className="text-center py-5 bg-light rounded border my-2" id="inspection-history-empty">
                <i className="bi bi-clipboard-x text-muted fs-1 d-block mb-2"></i>
                <h6 className="fw-semibold text-dark">No Previous Inspections</h6>
                <p className="text-muted small mb-3">
                  You have not recorded an inspection for this saved room yet.
                </p>
                <button
                  type="button"
                  className="btn btn-sm btn-rt-primary"
                  onClick={() => setActiveTab('form')}
                  id="start-first-inspection-btn"
                >
                  <i className="bi bi-clipboard2-check me-1"></i> Start Inspection Now
                </button>
              </div>
            ) : (
              <div className="table-responsive bg-white rounded border shadow-xs" id="inspection-history-table-container">
                <table className="table table-hover align-middle mb-0" id="inspection-history-table">
                  <thead className="table-light small">
                    <tr>
                      <th>Inspection Date</th>
                      <th>Rating</th>
                      <th>Completion</th>
                      <th>Suitability</th>
                      <th>Breakdown</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyList.map((insp) => (
                      <tr key={insp.id} id={`inspection-history-row-${insp.id}`}>
                        <td>
                          <div className="fw-bold text-dark">
                            <i className="bi bi-calendar3 me-1 text-primary"></i>
                            {insp.inspectionDate}
                          </div>
                          <div className="text-muted small" style={{ fontSize: '11px' }}>
                            Inspection #{insp.id}
                          </div>
                        </td>
                        <td>
                          {insp.overallRating ? (
                            <span className="badge bg-warning text-dark border border-warning" id={`history-rating-${insp.id}`}>
                              {'★'.repeat(insp.overallRating)} ({insp.overallRating}/5)
                            </span>
                          ) : (
                            <span className="text-muted small fst-italic">Not rated</span>
                          )}
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-1">
                            <span className="badge bg-light text-dark border small fw-semibold" id={`history-completion-${insp.id}`}>
                              {insp.completionPercentage}%
                            </span>
                            <small className="text-muted">({insp.inspectedItems}/{insp.totalItems})</small>
                          </div>
                        </td>
                        <td>
                          {insp.suitableForRent === true && (
                            <span className="badge bg-success-subtle text-success border border-success-subtle" id={`history-suitability-${insp.id}`}>
                              <i className="bi bi-check-circle-fill me-1"></i> Suitable
                            </span>
                          )}
                          {insp.suitableForRent === false && (
                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle" id={`history-suitability-${insp.id}`}>
                              <i className="bi bi-x-circle-fill me-1"></i> Not Suitable
                            </span>
                          )}
                          {insp.suitableForRent == null && (
                            <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle" id={`history-suitability-${insp.id}`}>
                              Unspecified
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="d-flex gap-1 small">
                            <span className="badge bg-success" title="Good items">{insp.goodCount} Good</span>
                            <span className="badge bg-warning text-dark" title="Needs attention items">{insp.needsAttentionCount} Attention</span>
                            <span className="badge bg-secondary" title="Not available items">{insp.notAvailableCount} N/A</span>
                          </div>
                        </td>
                        <td className="text-end">
                          <div className="d-flex justify-content-end gap-1">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary px-2"
                              onClick={() => handleLoadInspection(insp)}
                              id={`edit-inspection-btn-${insp.id}`}
                              title="Review or Edit this inspection"
                            >
                              <i className="bi bi-pencil me-1"></i> Review / Edit
                            </button>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger px-2"
                              onClick={() => handleDeleteInspection(insp.id)}
                              id={`delete-inspection-btn-${insp.id}`}
                              title="Delete inspection record"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* ========================================================
             TAB 1: CHECKLIST FORM
             ======================================================== */
          <div id="inspection-form-tab-pane">
            {/* Quick Status Legend Bar */}
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 p-2 bg-light rounded border mb-3 small">
              <span className="text-muted fw-semibold">Status Options:</span>
              <div className="d-flex gap-2 flex-wrap">
                <span className="badge bg-success-subtle text-success border border-success-subtle">
                  <i className="bi bi-check-circle-fill me-1"></i> Good
                </span>
                <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                  <i className="bi bi-exclamation-triangle-fill me-1"></i> Needs Attention
                </span>
                <span className="badge bg-secondary-subtle text-secondary border border-secondary-subtle">
                  <i className="bi bi-slash-circle-fill me-1"></i> Not Available
                </span>
                <span className="badge bg-light text-muted border">
                  <i className="bi bi-dash-circle me-1"></i> Unmarked
                </span>
              </div>
            </div>

            {/* Collapsible Categories */}
            <div className="accordion mb-4" id="inspectionCategoriesAccordion">
              {Object.keys(categories).map((catName, catIdx) => {
                const catItems = categories[catName];
                const isCollapsed = Boolean(collapsedCategories[catName]);
                const catInspected = catItems.filter((i) => i.status && i.status !== 'UNMARKED').length;
                const catTotal = catItems.length;

                return (
                  <div className="card shadow-xs border mb-3 rounded overflow-hidden" key={catName}>
                    {/* Category Header */}
                    <div
                      className="card-header bg-light d-flex justify-content-between align-items-center py-2 px-3 cursor-pointer user-select-none"
                      onClick={() => toggleCategory(catName)}
                      id={`category-header-${catIdx}`}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="d-flex align-items-center gap-2">
                        <i className={`bi ${isCollapsed ? 'bi-chevron-right' : 'bi-chevron-down'} text-primary fs-6`}></i>
                        <span className="fw-bold text-dark fs-6">{catName}</span>
                      </div>
                      <div className="d-flex align-items-center gap-2">
                        <span
                          className={`badge ${
                            catInspected === catTotal ? 'bg-success' : catInspected > 0 ? 'bg-primary' : 'bg-secondary'
                          } small`}
                          id={`cat-progress-${catIdx}`}
                        >
                          {catInspected} / {catTotal} Inspected
                        </span>
                      </div>
                    </div>

                    {/* Category Body with Items */}
                    {!isCollapsed && (
                      <div className="card-body p-0">
                        <ul className="list-group list-group-flush">
                          {catItems.map((item) => {
                            const origIdx = item.originalIndex;
                            const isCommentOpen = Boolean(openComments[item.itemKey] || (item.comment && item.comment.trim()));

                            return (
                              <li
                                key={item.itemKey}
                                className="list-group-item p-3"
                                id={`checklist-item-row-${item.itemKey}`}
                              >
                                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                                  {/* Item Label & Comment Trigger */}
                                  <div style={{ maxWidth: '420px' }}>
                                    <div className="fw-semibold text-dark fs-6" id={`item-label-${item.itemKey}`}>
                                      {item.itemLabel}
                                    </div>
                                    <div className="d-flex align-items-center gap-2 mt-1">
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-link p-0 text-decoration-none text-secondary"
                                        onClick={() => toggleCommentInput(item.itemKey)}
                                        id={`toggle-comment-${item.itemKey}`}
                                        style={{ fontSize: '12px' }}
                                      >
                                        <i className="bi bi-chat-left-text me-1"></i>
                                        {item.comment ? 'Edit Note' : '+ Add Note'}
                                      </button>
                                      {item.comment && (
                                        <span className="badge bg-light text-muted border text-truncate" style={{ maxWidth: '240px', fontSize: '11px' }}>
                                          {item.comment}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Status Selector Button Group */}
                                  <div className="btn-group btn-group-sm" role="group" aria-label={`Status for ${item.itemLabel}`}>
                                    <button
                                      type="button"
                                      className={`btn ${item.status === 'GOOD' ? 'btn-success text-white' : 'btn-outline-success'}`}
                                      onClick={() => handleStatusChange(origIdx, 'GOOD')}
                                      id={`status-good-${item.itemKey}`}
                                      title="Mark Good"
                                    >
                                      <i className="bi bi-check-circle-fill me-1"></i> Good
                                    </button>
                                    <button
                                      type="button"
                                      className={`btn ${
                                        item.status === 'NEEDS_ATTENTION'
                                          ? 'btn-warning text-dark fw-bold'
                                          : 'btn-outline-warning text-dark'
                                      }`}
                                      onClick={() => handleStatusChange(origIdx, 'NEEDS_ATTENTION')}
                                      id={`status-attn-${item.itemKey}`}
                                      title="Mark Needs Attention"
                                    >
                                      <i className="bi bi-exclamation-triangle-fill me-1"></i> Needs Attention
                                    </button>
                                    <button
                                      type="button"
                                      className={`btn ${
                                        item.status === 'NOT_AVAILABLE'
                                          ? 'btn-secondary text-white'
                                          : 'btn-outline-secondary'
                                      }`}
                                      onClick={() => handleStatusChange(origIdx, 'NOT_AVAILABLE')}
                                      id={`status-na-${item.itemKey}`}
                                      title="Mark Not Available"
                                    >
                                      <i className="bi bi-slash-circle-fill me-1"></i> Not Available
                                    </button>
                                    {item.status !== 'UNMARKED' && (
                                      <button
                                        type="button"
                                        className="btn btn-outline-dark"
                                        onClick={() => handleStatusChange(origIdx, 'UNMARKED')}
                                        id={`status-unmark-${item.itemKey}`}
                                        title="Clear status back to unmarked"
                                      >
                                        <i className="bi bi-x"></i>
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Collapsible Comment Box */}
                                {isCommentOpen && (
                                  <div className="mt-2 pt-2 border-top">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                      <label className="text-muted small" style={{ fontSize: '11px' }}>
                                        Item Comment / Observation (optional, max 500 characters):
                                      </label>
                                      <span className="text-muted small" style={{ fontSize: '11px' }}>
                                        {(item.comment || '').length} / 500
                                      </span>
                                    </div>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm"
                                      placeholder={`Observation for ${item.itemLabel.toLowerCase()}...`}
                                      value={item.comment || ''}
                                      maxLength={500}
                                      onChange={(e) => handleCommentChange(origIdx, e.target.value)}
                                      id={`item-comment-input-${item.itemKey}`}
                                    />
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Overall Inspection Details Section */}
            <div className="card shadow-xs border bg-light rounded p-3 mb-3" id="inspection-overall-details-card">
              <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                <i className="bi bi-star-fill text-warning"></i> Overall Inspection Summary & Decision
              </h6>

              <div className="row g-3">
                {/* Inspection Date */}
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-bold text-dark" htmlFor="inspection-date-input">
                    Inspection Date <span className="text-danger">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control form-control-sm bg-white"
                    id="inspection-date-input"
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                    required
                  />
                </div>

                {/* Overall Rating (1-5) */}
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-bold text-dark">
                    Overall Room Rating (1–5 Stars)
                  </label>
                  <div className="d-flex align-items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        className={`btn btn-sm ${
                          star <= overallRating ? 'btn-warning text-dark' : 'btn-outline-secondary'
                        } px-2 py-1`}
                        onClick={() => setOverallRating(star)}
                        id={`rating-star-${star}`}
                        title={`${star} Star${star > 1 ? 's' : ''}`}
                      >
                        ★ {star}
                      </button>
                    ))}
                    {overallRating > 0 && (
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-secondary p-0 ms-1"
                        onClick={() => setOverallRating(0)}
                        title="Clear Rating"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Suitable for Rent Decision */}
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-bold text-dark">
                    Suitable for Renting?
                  </label>
                  <div className="btn-group btn-group-sm w-100" role="group">
                    <button
                      type="button"
                      className={`btn ${suitableForRent === true ? 'btn-success' : 'btn-outline-success'}`}
                      onClick={() => setSuitableForRent(true)}
                      id="suitability-yes-btn"
                    >
                      <i className="bi bi-check-circle-fill me-1"></i> Yes
                    </button>
                    <button
                      type="button"
                      className={`btn ${suitableForRent === false ? 'btn-danger' : 'btn-outline-danger'}`}
                      onClick={() => setSuitableForRent(false)}
                      id="suitability-no-btn"
                    >
                      <i className="bi bi-x-circle-fill me-1"></i> No
                    </button>
                    <button
                      type="button"
                      className={`btn ${suitableForRent === null ? 'btn-secondary' : 'btn-outline-secondary'}`}
                      onClick={() => setSuitableForRent(null)}
                      id="suitability-undecided-btn"
                    >
                      Undecided
                    </button>
                  </div>
                </div>

                {/* Overall Remarks */}
                <div className="col-12 col-md-6">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="form-label small fw-bold text-dark mb-0" htmlFor="overall-remarks-input">
                      Overall Remarks & Summary
                    </label>
                    <span className="text-muted small" style={{ fontSize: '11px' }}>
                      {overallRemarks.length} / 2000
                    </span>
                  </div>
                  <textarea
                    className="form-control form-control-sm bg-white"
                    rows="3"
                    id="overall-remarks-input"
                    placeholder="General impressions, room layout, natural light, ventilation, owner demeanor..."
                    value={overallRemarks}
                    maxLength={2000}
                    onChange={(e) => setOverallRemarks(e.target.value)}
                  />
                </div>

                {/* Additional Concerns */}
                <div className="col-12 col-md-6">
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <label className="form-label small fw-bold text-dark mb-0" htmlFor="additional-concerns-input">
                      Additional Concerns & Deal-Breakers
                    </label>
                    <span className="text-muted small" style={{ fontSize: '11px' }}>
                      {additionalConcerns.length} / 1000
                    </span>
                  </div>
                  <textarea
                    className="form-control form-control-sm bg-white"
                    rows="3"
                    id="additional-concerns-input"
                    placeholder="Potential red flags: damp smell, broken locks, no water timing clarity, high deposit..."
                    value={additionalConcerns}
                    maxLength={1000}
                    onChange={(e) => setAdditionalConcerns(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reset Confirmation Dialog */}
        {confirmResetOpen && (
          <div
            className="alert alert-warning border border-warning shadow-sm d-flex align-items-center justify-content-between gap-3 mt-3 animate__animated animate__fadeIn"
            id="inspection-reset-confirm-box"
          >
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-exclamation-triangle-fill fs-4 text-warning"></i>
              <div>
                <strong>Confirm Reset:</strong> Are you sure you want to reset all checklist responses to unmarked? Entered answers will be cleared.
              </div>
            </div>
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setConfirmResetOpen(false)}
                id="cancel-reset-btn"
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-sm btn-danger px-3"
                onClick={() => {
                  setConfirmResetOpen(false);
                  handleConfirmReset();
                }}
                id="confirm-reset-btn"
              >
                Yes, Reset All
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default RoomInspectionModal;
