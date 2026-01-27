import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserPlus, Edit2, Trash2, Check, X, AlertCircle, ShieldAlert
} from 'lucide-react';
import Button from '../ui/Button';
import GlassInput from '../ui/GlassInput';
import GlassCard from '../ui/GlassCard';
import PasswordInput from './PasswordInput';
import { User } from '../../types/user';
import { getUsers, deleteUser } from '../../services/userService';
import { useAuth } from '../../contexts/AuthContext';
import { createUser, updateUser } from '../../services/userService';

// Custom search icon that matches the website style like in the login form
const SearchIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="18" 
    height="18" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className="text-purple"
  >
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.3-4.3"></path>
  </svg>
);

// Clearer version of the icon
const ClearSearchIcon = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="18" 
    height="18" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2"
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className="text-purple"
  >
    <circle cx="11" cy="11" r="8"></circle>
    <path d="m21 21-4.3-4.3"></path>
  </svg>
);

interface UserFormData {
  id?: string;
  username: string;
  email: string;
  password?: string;
  role: string;
}

// Move UserFormModal outside of the main component to prevent recreation
const UserFormModal = memo(({ isOpen, user, onClose, onSave, errors, onChange }: {
  isOpen: boolean;
  user: UserFormData | null;
  onClose: () => void;
  onSave: () => void;
  errors: Record<string, string>;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
}) => {
  if (!user) return null;
  
  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/95 rounded-xl shadow-xl w-full max-w-md p-6 border border-purple/20">
            <h2 className="text-2xl font-bold text-pink mb-4">
              {user.id ? 'Edit User' : 'Create New User'}
            </h2>
            <div className="space-y-4">
              <div>
                <GlassInput
                  label="Username"
                  name="username"
                  placeholder="Enter full username"
                  value={user.username || ''}
                  onChange={onChange}
                  error={errors.username}
                  labelClassName="text-textDark/80"
                  inputClassName="text-textDark placeholder:text-textDark/60"
                  className="border-purple/30 focus:border-purple"
                />
              </div>
              <div>
                <GlassInput
                  label="Email"
                  name="email"
                  type="email"
                  placeholder="Enter email address"
                  value={user.email || ''}
                  onChange={onChange}
                  error={errors.email}
                  labelClassName="text-textDark/80"
                  inputClassName="text-textDark placeholder:text-textDark/60"
                  className="border-purple/30 focus:border-purple"
                />
              </div>
              <div>
                <PasswordInput
                  name="password"
                  value={user.password || ''}
                  onChange={onChange}
                  error={errors.password}
                  showRequirements={true}
                  isOptional={!!user.id}
                />
              </div>
              <div>
                <label className="block text-textDark/80 mb-2 font-medium">Role</label>
                <select
                  name="role"
                  value={user.role || 'User'}
                  onChange={onChange}
                  className="glass-input w-full bg-white/50 text-textDark rounded-lg px-4 py-2.5 border border-purple/30 outline-none focus:ring-2 focus:ring-purple/50 focus:border-purple"
                >
                  <option value="User" className="bg-white text-textDark">User</option>
                  <option value="Admin" className="bg-white text-textDark">Admin</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="secondary"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  variant="accent"
                  onClick={onSave}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

const UserManagement: React.FC = () => {
  const { user: currentLoggedInUser, token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUser, setCurrentUser] = useState<UserFormData | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showPermissionError, setShowPermissionError] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      if (!token) {
        setError('Authentication token not found. Please log in.');
        setIsLoading(false);
        return;
      }
      try {
        setIsLoading(true);
        const fetchedUsers = await getUsers(token);
        setUsers(fetchedUsers);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch users:', err);
        setError('Failed to load users. Please try again later.');
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, [token]);

  // Memoize filtered users to prevent unnecessary re-rendering
  const filteredUsers = useMemo(() => 
    users.filter(user => 
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.role.toLowerCase().includes(searchQuery.toLowerCase())
    ), 
    [users, searchQuery]
  );
  
  // Check if there's more than one admin in the system
  const hasMultipleAdmins = useMemo(() => 
    users.filter(user => user.role === 'Admin').length > 1,
    [users]
  );

  const handleOpenCreateModal = useCallback(() => {
    setCurrentUser({
      username: '',
      email: '',
      password: '',
      role: 'User'
    });
    setFormErrors({});
    setIsModalOpen(true);
  }, []);

  const handleOpenEditModal = useCallback((user: User) => {
    setCurrentUser({
      id: String(user.id),
      username: user.username,
      email: user.email,
      password: '',
      role: user.role
    });
    setFormErrors({});
    setIsModalOpen(true);
  }, []);
  const handleOpenDeleteModal = useCallback((user: User) => {
    // Check if trying to delete yourself as admin
    if (String(currentLoggedInUser?.id) === String(user.id) && user.role === 'Admin') {
      if (!hasMultipleAdmins) {
        setShowPermissionError(true);
        setTimeout(() => setShowPermissionError(false), 3000);
        return;
      }
    }
    
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  }, [currentLoggedInUser, hasMultipleAdmins]);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    // Use a timeout to allow the exit animation to complete
    setTimeout(() => {
      setCurrentUser(null);
    }, 300);
  }, []);

  const handleCloseDeleteModal = useCallback(() => {
    setIsDeleteModalOpen(false);
    // Use a timeout to allow the exit animation to complete
    setTimeout(() => {
      setUserToDelete(null);
    }, 300);
  }, []);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!currentUser?.username) {
      errors.username = 'Username is required';
    }

    if (!currentUser?.email) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(currentUser.email)) {
      errors.email = 'Email format is invalid';
    }

    // Only validate password for new users
    if (!currentUser?.id && !currentUser?.password) {
      errors.password = 'Password is required for new users';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveUser = useCallback(async () => {
    if (!validateForm() || !currentUser || !token) return;

    try {
      if (currentUser.id) {
        // Update existing user in the database
        const updatedUser = await updateUser(
          currentUser.id, 
          {
            username: currentUser.username,
            email: currentUser.email,
            role: currentUser.role,
            ...(currentUser.password ? { password: currentUser.password } : {})
          },
          token
        );
        
        // Update local state with the updated user
        setUsers(prevUsers =>
          prevUsers.map(user =>
            String(user.id) === currentUser.id ? updatedUser : user
          )
        );
      } else {
        // Create new user in the database
        const newUser = await createUser(
          {
            username: currentUser.username,
            email: currentUser.email,
            password: currentUser.password || '',
            role: currentUser.role
          },
          token
        );
        
        // Add the new user to local state
        setUsers(prevUsers => [...prevUsers, newUser]);
      }
      
      // Close the modal and reset form
      setIsModalOpen(false);
      setTimeout(() => {
        setCurrentUser(null);
      }, 300);
    } catch (error: any) {
      // Handle errors, especially duplicate username/email errors
      if (error.message.includes('already exists')) {
        setFormErrors(prev => ({
          ...prev,
          username: error.message
        }));
      } else {
        setError(error.message || 'Failed to save user');
        setTimeout(() => setError(null), 5000);
      }
    }
  }, [currentUser, token, validateForm]);

  const handleDeleteUser = useCallback(async () => {
    if (!userToDelete || !token) return;    // Check if trying to delete yourself as admin
    if (String(currentLoggedInUser?.id) === String(userToDelete.id) && userToDelete.role === 'Admin') {
      if (!hasMultipleAdmins) {
        setShowPermissionError(true);
        setTimeout(() => setShowPermissionError(false), 3000);
        setIsDeleteModalOpen(false);
        setUserToDelete(null);
        return;
      }
    }
    
    try {
      // Delete the user from the database
      const success = await deleteUser(userToDelete.id, token);
      
      if (success) {
        // Remove the user from local state
        setUsers(prevUsers => prevUsers.filter(user => user.id !== userToDelete.id));
        setIsDeleteModalOpen(false);
      } else {
        setError('Failed to delete user. Please try again.');
        setTimeout(() => setError(null), 5000);
      }
    } catch (error: any) {
      setError(error.message || 'An error occurred while deleting the user');
      setTimeout(() => setError(null), 5000);
    } finally {
      setTimeout(() => {
        setUserToDelete(null);
      }, 300);
    }
  }, [currentLoggedInUser, hasMultipleAdmins, userToDelete, token]);
  const handleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setCurrentUser(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [name]: value
      };
    });

    // Clear error when user types
    setFormErrors(prev => {
      if (prev[name]) {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      }
      return prev;
    });
  }, []); // Remove dependencies that cause re-renders
    // Generate background color based on username for avatar
  const getAvatarColor = useCallback((username: string) => {
    const colors = [
      'bg-pink', 'bg-purple', 'bg-blue', 
      'bg-green', 'bg-yellow', 'bg-red'
    ];
    
    // Simple hash function to get consistent color for a name
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  }, []);

  // Delete Modal component
  const DeleteUserModal = memo(({ isOpen, user, onClose, onDelete }: {
    isOpen: boolean;
    user: User | null;
    onClose: () => void;
    onDelete: () => void;
  }) => {
    if (!user) return null;
    
    return (
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ 
                type: "spring", 
                stiffness: 500, 
                damping: 30,
                mass: 0.8
              }}
              className="bg-white/95 rounded-xl shadow-xl w-full max-w-md p-6 border border-purple/20"
              style={{ 
                willChange: 'transform, opacity',
                transform: 'translateZ(0)'
              }}
            >
              <div className="text-center">                <div className="flex justify-center mb-4">
                  <AlertCircle size={48} className="text-red" />
                </div><h2 className="text-2xl font-bold text-pink mb-2">Delete User</h2>
                <p className="text-textDark/70 mb-6">
                  Are you sure you want to delete the user <span className="font-semibold text-textDark">{user.username}</span>?
                  This action cannot be undone.
                </p>
                <div className="flex justify-center gap-3">
                  <Button
                    variant="secondary"
                    onClick={onClose}
                    icon={<X size={18} />}
                  >
                    Cancel
                  </Button>                  <Button
                    variant="primary"
                    className="bg-red hover:bg-red/90 text-white"
                    onClick={onDelete}
                    icon={<Check size={18} />}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    );
  });

  return (
    <>
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between">
        <div className="mb-4 md:mb-0 w-full md:w-64">          <GlassInput
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<SearchIcon />}
            clearIcon={<ClearSearchIcon />}
            inputClassName="text-textDark bg-transparent"
            className="w-full focus:ring-2 focus:ring-purple/50 border-purple/30"
          />
        </div>        <Button
          variant="secondary"
          icon={<UserPlus size={18} />}
          onClick={handleOpenCreateModal}
          className="w-full md:w-auto shadow-sm hover:shadow flex items-center gap-2 text-white bg-purple hover:bg-purple/90 px-4 py-2 rounded-md border border-purple/40"
        >
          Create New User
        </Button>
      </div>
        {/* Permission Error Alert */}
      {showPermissionError && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="mb-4 bg-red/10 text-red border border-red/20 px-4 py-3 rounded-lg flex items-center gap-2"
        >
          <ShieldAlert size={18} />
          <span>You cannot delete/deactivate your own admin account when you are the only admin in the system.</span>
        </motion.div>
      )}{isLoading && (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-2 border-purple border-t-transparent rounded-full animate-spin"></div>
          <p className="ml-4 text-xl text-textDark/70">Loading users...</p>
        </div>
      )}      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 bg-red/10 text-red border border-red/20 px-4 py-3 rounded-lg flex items-center gap-2"
        >
          <AlertCircle size={18} />
          <span>{error}</span>
        </motion.div>
      )}

      {!isLoading && !error && (        <GlassCard className="bg-white/95 text-textDark rounded-xl overflow-hidden border border-purple/20">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-light-100 text-textDark/80">
                <tr>
                  <th className="px-6 py-4 text-left font-medium">Username</th>
                  <th className="px-6 py-4 text-left font-medium">Email</th>
                  <th className="px-6 py-4 text-left font-medium">Role</th>
                  <th className="px-6 py-4 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-purple/10">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (                    <tr key={user.id} className="hover:bg-light-100/50 transition-colors">
                      <td className="px-6 py-4 text-textDark flex items-center gap-3">
                        <div 
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${getAvatarColor(user.username)}`}
                        >
                          {user.username.charAt(0).toUpperCase()}
                        </div>
                        {user.username}
                      </td>
                      <td className="px-6 py-4 text-textDark/80">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          user.role === 'Admin' 
                            ? 'bg-pink/20 text-pink' 
                            : 'bg-purple/20 text-purple'
                        }`}>
                          {user.role}
                        </span>
                      </td>                      <td className="px-6 py-4 text-right space-x-2">
                        <button 
                          onClick={() => handleOpenEditModal(user)}
                          className="text-textDark/60 hover:text-purple p-1 rounded-md hover:bg-purple/10"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button 
                          onClick={() => handleOpenDeleteModal(user)}
                          className="text-red hover:text-red/80 p-1 rounded-md hover:bg-red/10"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))                ) : (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-textDark/60">
                      {users.length === 0 ? 'No users found.' : 'No users found matching your search criteria'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* User and Delete Modals with optimized rendering */}
      <UserFormModal 
        isOpen={isModalOpen} 
        user={currentUser} 
        onClose={handleCloseModal} 
        onSave={handleSaveUser} 
        errors={formErrors} 
        onChange={handleFormChange}
      />
      <DeleteUserModal 
        isOpen={isDeleteModalOpen} 
        user={userToDelete} 
        onClose={handleCloseDeleteModal} 
        onDelete={handleDeleteUser} 
      />
    </>
  );
};

export default UserManagement;