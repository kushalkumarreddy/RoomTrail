import React, { createContext, useContext, useState, useCallback } from 'react';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newToast = { id, message, type };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
    return id;
  }, [removeToast]);

  const showSuccess = useCallback((msg, duration) => showToast(msg, 'success', duration), [showToast]);
  const showError = useCallback((msg, duration) => showToast(msg, 'error', duration), [showToast]);
  const showWarning = useCallback((msg, duration) => showToast(msg, 'warning', duration), [showToast]);
  const showInfo = useCallback((msg, duration) => showToast(msg, 'info', duration), [showToast]);

  return (
    <NotificationContext.Provider
      value={{
        toasts,
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        removeToast,
      }}
    >
      {children}
      {/* Toast Notification Container */}
      <div className="rt-toast-container" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => {
          let iconClass = 'bi-info-circle-fill text-primary';
          let borderClass = 'rt-toast-info';
          if (toast.type === 'success') {
            iconClass = 'bi-check-circle-fill text-success';
            borderClass = 'rt-toast-success';
          } else if (toast.type === 'error') {
            iconClass = 'bi-exclamation-octagon-fill text-danger';
            borderClass = 'rt-toast-error';
          } else if (toast.type === 'warning') {
            iconClass = 'bi-exclamation-triangle-fill text-warning';
            borderClass = 'rt-toast-warning';
          }

          return (
            <div key={toast.id} className={`rt-toast ${borderClass}`} role="alert">
              <i className={`bi ${iconClass} fs-5 mt-1`}></i>
              <div className="flex-grow-1" style={{ fontSize: '0.92rem', lineHeight: '1.4' }}>
                {toast.message}
              </div>
              <button
                type="button"
                className="btn-close ms-2"
                style={{ fontSize: '0.75rem' }}
                aria-label="Close"
                onClick={() => removeToast(toast.id)}
              />
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
