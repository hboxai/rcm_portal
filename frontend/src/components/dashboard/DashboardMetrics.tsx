import React from 'react';
import { motion } from 'framer-motion';
import { FileCheck, FileText, Clock, DollarSign } from 'lucide-react';
import KPICard from '../ui/KPICard';
import { KPIData } from '../../types/claim';

interface DashboardMetricsProps {
  data: KPIData;
}

const DashboardMetrics: React.FC<DashboardMetricsProps> = ({ data }) => {
  const metrics = [
    {
      title: 'Total Check Numbers',
      value: data.totalCheckNumbers,
      icon: <DollarSign size={24} className="text-accent" />, // Use accent color from new palette
      trend: { value: 12, isPositive: true },
      delay: 0.1,
    },
    {
      title: 'Total Visit IDs',
      value: data.totalVisitIds,
      icon: <FileText size={24} className="text-primary" />, // Use primary color from new palette
      trend: { value: 8, isPositive: true },
      delay: 0.2,
    },
    {
      title: 'Posted Visit IDs',
      value: data.postedVisitIds,
      icon: <FileCheck size={24} className="text-success-500" />, // Existing success color, can be mapped if needed
      trend: { value: 15, isPositive: true },
      delay: 0.3,
    },
    {
      title: 'Pending Posting',
      value: data.pendingPosting,
      icon: <Clock size={24} className="text-warning-500" />, // Existing warning color, can be mapped if needed
      trend: { value: 5, isPositive: false },
      delay: 0.4,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <KPICard
            key={index}
            title={metric.title}
            value={metric.value}
            icon={metric.icon}
            trend={metric.trend}
            delay={metric.delay}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default DashboardMetrics;
