import React, { useEffect } from 'react';

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md', // 'sm', 'md', 'lg', 'xl'
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  let maxWidth = '540px';
  if (size === 'sm') maxWidth = '400px';
  if (size === 'lg') maxWidth = '800px';
  if (size === 'xl') maxWidth = '1000px';

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      role="dialog"
      aria-modal="true"
      style={{
        backgroundColor: 'rgba(11, 25, 44, 0.55)',
        backdropFilter: 'blur(3px)',
        zIndex: 1060,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth }}>
        <div className="modal-content rt-card border-0 shadow-lg">
          <div className="modal-header border-bottom py-3 px-4">
            <h5 className="modal-title fw-bold text-dark mb-0">{title}</h5>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onClose}
            ></button>
          </div>
          <div className="modal-body p-4" style={{ maxHeight: 'calc(85vh - 120px)', overflowY: 'auto' }}>
            {children}
          </div>
          {footer && <div className="modal-footer border-top py-2 px-4 bg-light">{footer}</div>}
        </div>
      </div>
    </div>
  );
};

export default Modal;
