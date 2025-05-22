import React, { useState, useEffect, memo, useCallback } from 'react';
import { motion, useScroll, useMotionValueEvent, AnimatePresence } from 'framer-motion';
import { Menu, X, History, LogOut } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const menuItemVariants = {
  hidden: { opacity: 0, y: -10 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.2 }
  },
  hover: {
    scale: 1.03,
    transition: { duration: 0.2 }
  }
};

const Header: React.FC = () => {
  const { user, logout } = useAuth();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  const location = useLocation();
  const navigate = useNavigate();
  
  useMotionValueEvent(scrollY, "change", (latest) => {
    setIsScrolled(latest > 10);
  });

  // Close mobile menu when clicking outside or changing routes
  useEffect(() => {
    const handleClick = () => {
      if (isMobileMenuOpen) setIsMobileMenuOpen(false);
    };
    
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [isMobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleMobileMenuToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMobileMenuOpen(!isMobileMenuOpen);
  }, [isMobileMenuOpen]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  if (!user) return null;
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <motion.header 
      className={`fixed top-0 left-0 right-0 z-50 py-4 transition-all duration-300 ease-in-out ${
        isScrolled 
          ? 'bg-olive-green/85 backdrop-blur-md shadow-lg shadow-dark-olive-green/20' 
          : 'bg-olive-green/80 backdrop-blur-sm'
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ 
        type: "spring",
        stiffness: 300,
        damping: 20
      }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          {/* Site Name - Left */}
          <motion.div 
            className="flex items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Link to="/search" className="text-textLight text-xl font-bold tracking-tight">
              <motion.span
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                Revenue Cycle Management
              </motion.span>
            </Link>
          </motion.div>
          
          {/* Navigation Links - Center */}
          <nav className="hidden md:flex items-center absolute left-1/2 transform -translate-x-1/2">
            <motion.div
              variants={menuItemVariants}
              initial="hidden"
              animate="visible"
              whileHover="hover"
              custom={0}
              transition={{ delay: 0.1 }}
            >
              <Link 
                to="/search" 
                className={`px-4 py-2 mx-1 rounded-md transition-all duration-200 ${
                  isActive('/search') 
                    ? 'text-textLight bg-white/10 shadow-sm shadow-white/5' 
                    : 'text-textLight/70 hover:text-textLight hover:bg-white/5'
                }`}
              >
                Search
              </Link>
            </motion.div>
            
            <motion.div
              variants={menuItemVariants}
              initial="hidden"
              animate="visible"
              whileHover="hover"
              custom={1}
              transition={{ delay: 0.2 }}
            >
              <Link 
                to="/history" 
                className={`px-4 py-2 mx-1 rounded-md transition-all duration-200 flex items-center gap-1 ${
                  isActive('/history') 
                    ? 'text-textLight bg-white/10 shadow-sm shadow-white/5' 
                    : 'text-textLight/70 hover:text-textLight hover:bg-white/5'
                }`}
              >
                <History size={16} />
                History
              </Link>
            </motion.div>
            
            {user.role === 'Admin' && (
              <motion.div
                variants={menuItemVariants}
                initial="hidden"
                animate="visible"
                whileHover="hover"
                custom={2}
                transition={{ delay: 0.3 }}
              >
                <Link 
                  to="/user-management" 
                  className={`px-4 py-2 mx-1 rounded-md transition-all duration-200 ${
                    isActive('/user-management') 
                      ? 'text-textLight bg-white/10 shadow-sm shadow-white/5' 
                      : 'text-textLight/70 hover:text-textLight hover:bg-white/5'
                  }`}
                >
                  User Management
                </Link>
              </motion.div>
            )}
          </nav>
          
          {/* Logout Button - Right */}
          <div className="flex items-center">
            <motion.button 
              onClick={handleLogout}
              className="hidden md:flex items-center gap-2 text-textLight/80 hover:text-textLight px-4 py-2 rounded-md border border-textLight/10 hover:border-textLight/20 bg-white/5 hover:bg-white/10 transition-all duration-200 shadow-sm hover:shadow"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
            >
              <LogOut size={16} />
              Logout
            </motion.button>
            
            <motion.button 
              onClick={handleMobileMenuToggle} 
              className="md:hidden text-textLight/80 hover:text-textLight p-1 rounded-md hover:bg-white/10"
              whileTap={{ scale: 0.9 }}
              animate={{ rotate: isMobileMenuOpen ? 180 : 0 }}
              transition={{ duration: 0.3 }}
            >
              {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </motion.button>
          </div>
        </div>
      </div>
      
      {/* Mobile Menu with AnimatePresence for smooth entry/exit */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            className="md:hidden absolute top-full left-0 right-0 bg-dark-olive-green/95 backdrop-blur-md border-t border-textLight/10 shadow-lg"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ 
              duration: 0.3,
              type: "spring",
              stiffness: 500,
              damping: 30
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <nav className="flex flex-col px-6 py-4 space-y-2">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Link 
                  to="/search" 
                  className={`py-3 px-4 rounded-md ${
                    isActive('/search') 
                      ? 'text-textLight bg-white/10' 
                      : 'text-textLight/70 hover:text-textLight hover:bg-white/5'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Search
                </Link>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
              >
                <Link 
                  to="/history" 
                  className={`py-3 px-4 rounded-md flex items-center gap-2 ${
                    isActive('/history') 
                      ? 'text-textLight bg-white/10' 
                      : 'text-textLight/70 hover:text-textLight hover:bg-white/5'
                  }`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <History size={18} />
                  History
                </Link>
              </motion.div>
              
              {user.role === 'Admin' && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Link 
                    to="/user-management" 
                    className={`py-3 px-4 rounded-md ${
                      isActive('/user-management') 
                        ? 'text-textLight bg-white/10' 
                        : 'text-textLight/70 hover:text-textLight hover:bg-white/5'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    User Management
                  </Link>
                </motion.div>
              )}
              <hr className="border-textLight/10 my-2" />
              <motion.div 
                className="flex justify-center pt-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
              >
                <button 
                  onClick={handleLogout}
                  className="w-full py-3 text-center flex items-center justify-center gap-2 text-textLight/80 hover:text-textLight rounded-md border border-textLight/10 hover:bg-white/10 transition-all"
                >
                  <LogOut size={18} />
                  Logout
                </button>
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

// Use memo to prevent unnecessary re-renders
export default memo(Header);
