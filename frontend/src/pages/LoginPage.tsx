import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import LoginForm from '../components/auth/LoginForm';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import iconImage from '../assets/icons/image.png';

const LoginPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/search');
    }
  }, [isAuthenticated, navigate]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left side - animated background */}      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
        className="hidden md:flex md:w-1/2 bg-gradient-to-br from-purple to-blue p-12 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-[url('https://images.pexels.com/photos/669615/pexels-photo-669615.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2')] bg-cover bg-center opacity-20"></div>
        
        <div className="relative z-10 flex flex-col h-full justify-center">          <motion.div 
            className="bg-white/20 backdrop-blur-md p-8 rounded-2xl border border-white/20 shadow-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut", delay: 0.2 }}
          >
            <motion.div 
              className="flex items-center mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: "easeInOut", delay: 0.3 }}
            >              <motion.img 
                src={iconImage} 
                alt="RCM Icon" 
                className="w-12 h-12 rounded-full mr-4 bg-white/20" 
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              />
              <motion.h1 
                className="text-3xl font-bold text-white"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut", delay: 0.4 }}
              >
                Revenue Cycle Management
              </motion.h1>
            </motion.div>
              <motion.h2 
              className="text-2xl font-semibold text-white mb-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: "easeInOut", delay: 0.5 }}
            >
              Internal Claims & Revenue Management Tool
            </motion.h2>
            
            <motion.p 
              className="text-white/80 mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: "easeInOut", delay: 0.6 }}
            >
              Simplify your end-to-end billing operations with a centralized platform built for HBox. Post charges, submit claims, track visits, and manage patient billing records with precision.
            </motion.p>
            
            <motion.p 
              className="text-white/70 mb-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, ease: "easeInOut", delay: 0.6 }}
            >
              Join us in revolutionizing the healthcare revenue cycle. Our tool offers unparalleled insights and control over your revenue operations.
            </motion.p>
            
            <div className="space-y-4">
              {['Streamlined Claims Processing', 'Efficient Patient Management', 'Revenue Cycle Optimization'].map((feature, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.2, duration: 0.3, ease: "easeInOut" }}
                  className="flex items-center"
                >                  <motion.div 
                    className="w-6 h-6 rounded-full bg-pink/30 flex items-center justify-center mr-3"
                    whileHover={{ scale: 1.2, backgroundColor: "rgba(244, 72, 147, 0.4)" }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                  <span className="text-white/90">{feature}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
        
        <motion.div 
          className="absolute bottom-6 left-6 right-6 text-cornsilk/50 text-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut", delay: 1.4 }}
        >
          © 2025 Revenue Cycle Management. All rights reserved.
        </motion.div>
      </motion.div>
      
      {/* Right side - login form */}
      <div className="flex-1 flex items-center justify-center p-6 md:p-12 bg-background">
        <LoginForm />
      </div>
    </div>
  );
};

export default LoginPage;
