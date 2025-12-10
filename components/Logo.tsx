import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => {
  return (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor" 
        strokeWidth="2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        className={className}
    >
        <circle cx="12" cy="12" r="3"></circle>
        <path d="M12 9V3"></path>
        <path d="M12 21v-6"></path>
        <path d="M9 12H3"></path>
        <path d="M21 12h-6"></path>
        <path d="M19.8 19.8l-4.2-4.2"></path>
        <path d="M8.4 8.4L4.2 4.2"></path>
        <path d="M15.6 8.4l4.2-4.2"></path>
        <path d="M8.4 15.6l-4.2 4.2"></path>
    </svg>
  );
};