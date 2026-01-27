import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { Sun, Moon } from 'lucide-react';

interface ThemeToggleProps {
  variant?: 'icon' | 'dropdown';
  className?: string;
}

export default function ThemeToggle({ variant = 'icon', className = '' }: ThemeToggleProps) {
  const { theme, setTheme, toggleTheme, resolvedTheme } = useTheme();

  if (variant === 'icon') {
    return (
      <button
        onClick={toggleTheme}
        className={`p-2.5 rounded-full transition-all duration-300
          bg-white/20 hover:bg-white/30 backdrop-blur-sm
          border border-white/30 hover:border-white/50
          shadow-sm hover:shadow-md
          ${className}`}
        aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
        title={`Current: ${resolvedTheme} mode. Click to toggle.`}
      >
        {resolvedTheme === 'dark' ? (
          <Sun size={18} className="text-yellow drop-shadow-sm" />
        ) : (
          <Moon size={18} className="text-white drop-shadow-sm" />
        )}
      </button>
    );
  }

  // Dropdown variant with all three options
  return (
    <div className={`relative inline-block ${className}`}>
      <div className="flex items-center gap-1 p-1 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
        <button
          onClick={() => setTheme('light')}
          className={`p-2 rounded-full transition-all duration-200 ${
            theme === 'light' 
              ? 'bg-white text-purple shadow-md' 
              : 'text-white/70 hover:text-white hover:bg-white/20'
          }`}
          aria-label="Light mode"
          title="Light mode"
        >
          <Sun size={16} />
        </button>
        <button
          onClick={() => setTheme('dark')}
          className={`p-2 rounded-full transition-all duration-200 ${
            theme === 'dark' 
              ? 'bg-white text-purple shadow-md' 
              : 'text-white/70 hover:text-white hover:bg-white/20'
          }`}
          aria-label="Dark mode"
          title="Dark mode"
        >
          <Moon size={16} />
        </button>
      </div>
    </div>
  );
}
