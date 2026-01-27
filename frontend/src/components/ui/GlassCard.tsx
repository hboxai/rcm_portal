import React, { ReactNode } from 'react';

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hoverable?: boolean;
  variant?: 'default' | 'dark';
  delay?: number;
  onClick?: () => void;
}

const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  hoverable = false,
  variant = 'default',
  delay: _delay = 0, // Keeping this prop for backward compatibility
  onClick
}) => {
  const baseClasses = variant === 'dark' ? 'glass-card-dark' : 'glass-card';
  const hoverClasses = hoverable || onClick ? 'cursor-pointer' : '';
  
  return (
    <div
      className={`${baseClasses} rounded-xl p-5 ${hoverClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default GlassCard;
