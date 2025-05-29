import React from 'react';
import { motion } from 'framer-motion';
import GlassCard from './GlassCard';

interface KPICardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  delay?: number;
}

const KPICard: React.FC<KPICardProps> = ({ 
  title, 
  value, 
  icon, 
  trend,
  delay = 0 
}) => {
  return (
    <GlassCard delay={delay} className="h-full"> {/* GlassCard already uses new palette via index.css */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-medium text-textDark/70">{title}</h3>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: delay + 0.2, duration: 0.3 }}
          >
            <p className="text-2xl font-semibold mt-1 text-textDark">{value}</p>
          </motion.div>
          
          {trend && (
            <p className={`text-xs flex items-center mt-2 ${
              trend.isPositive ? 'text-success-500' : 'text-error-500' // Kept existing status colors
            }`}>
              {trend.isPositive ? '↑' : '↓'} {trend.value}%
              <span className="text-textDark/50 ml-1">vs last period</span>
            </p>
          )}
        </div>
          <div className="p-3 rounded-full bg-gradient-to-br from-purple to-pink shadow-lg"> {/* Brand gradient: purple to pink */}
          {icon} {/* Icon color is set in DashboardMetrics.tsx to white for contrast */}
        </div>
      </div>
    </GlassCard>
  );
};

export default KPICard;
