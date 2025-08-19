import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UserManagement from '../components/user/UserManagement';
import { Users } from 'lucide-react';

const UserManagementPage: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    
    // Redirect non-admin users
    if (user?.role !== 'Admin') {
      navigate('/search');
    }
  }, [isAuthenticated, user, navigate]);

  if (!isAuthenticated || user?.role !== 'Admin') return null;
    return (
    <div className="min-h-screen bg-gradient-to-br from-white to-light-100 text-textDark pt-24">
      <div className="container mx-auto pb-12 px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8 p-6 rounded-xl bg-white/95 backdrop-blur-sm border border-purple/20"
        >
          <h1 className="text-3xl font-bold text-textDark flex items-center gap-3">
            <Users className="text-pink" size={28} />
            User Management
          </h1>
          <p className="text-textDark/70 mt-2">
            Create, edit, and manage user accounts for the RCM system
          </p>
        </motion.div>
        
        <UserManagement />
      </div>
    </div>
  );
};

export default UserManagementPage;