import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, X } from 'lucide-react';
import Button from './Button';

interface ConfirmPinkModalProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  confirmIcon?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

const ConfirmPinkModal: React.FC<ConfirmPinkModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmIcon,
  onConfirm,
  onCancel,
  disabled,
}) => {
  if (!isOpen) return null;
  return createPortal(
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[9999]"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(8px)',
          padding: '1rem',
        }}
        onClick={() => (disabled ? null : onCancel())}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: -20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25, duration: 0.3 }}
          className="bg-white rounded-xl shadow-2xl w-full max-w-xl p-7 border border-purple/20"
          style={{ position: 'relative', zIndex: 10000 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <AlertCircle size={48} className="text-pink" />
            </div>
            <h2 className="text-2xl font-bold text-pink mb-3">{title}</h2>
            <div className="text-textDark/70 leading-relaxed mb-7">{message}</div>
            <div className="flex justify-center gap-3">
              <Button variant="secondary" onClick={onCancel} icon={<X size={18} />} disabled={disabled}>
                Cancel
              </Button>
              <Button
                variant="primary"
                className="bg-pink hover:bg-pink/90 text-white"
                onClick={onConfirm}
                disabled={disabled}
                icon={confirmIcon}
              >
                {confirmLabel}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
};

export default ConfirmPinkModal;
