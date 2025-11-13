import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  onClose: () => void;
  duration?: number;
}

const Toast: React.FC<ToastProps> = ({ message, type = 'info', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle size={20} className="text-green" />,
    error: <XCircle size={20} className="text-red" />,
    info: <AlertCircle size={20} className="text-blue" />
  };

  const bgColors = {
    success: 'bg-green/10 border-green/30',
    error: 'bg-red/10 border-red/30',
    info: 'bg-blue/10 border-blue/30'
  };

  return (
    <div className={`fixed top-24 right-4 z-50 min-w-[300px] max-w-md p-4 rounded-lg border-2 ${bgColors[type]} bg-white/95 backdrop-blur-sm shadow-lg animate-slide-in-right`}>
      <div className="flex items-start gap-3">
        {icons[type]}
        <p className="flex-1 text-sm text-textDark font-medium">{message}</p>
        <button 
          onClick={onClose}
          className="text-textDark/60 hover:text-textDark transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
