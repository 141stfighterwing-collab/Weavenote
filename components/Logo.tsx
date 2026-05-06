import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = "w-14 h-14" }) => {
  return (
    <svg 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" />
                <stop offset="50%" stopColor="#0284c7" />
                <stop offset="100%" stopColor="#0f172a" />
            </linearGradient>
        </defs>
        
        <g stroke="url(#logo-gradient)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {/* Hexagon Frame */}
            <polygon points="50,4 90,27 90,73 50,96 10,73 10,27" />
            
            {/* Spider Web Radial Lines */}
            <line x1="50" y1="42" x2="50" y2="4" />
            <line x1="60" y1="42" x2="90" y2="27" />
            <line x1="40" y1="42" x2="10" y2="27" />
            <line x1="65" y1="52" x2="90" y2="50" />
            <line x1="35" y1="52" x2="10" y2="50" />
            <line x1="58" y1="68" x2="90" y2="73" />
            <line x1="42" y1="68" x2="10" y2="73" />

            {/* Spider Web Concentric Curves - Inner */}
            <path d="M 50 20 Q 60 24 72 32" />
            <path d="M 72 32 Q 74 42 78 51" />
            <path d="M 78 51 Q 76 60 76 70" />
            <path d="M 50 20 Q 40 24 28 32" />
            <path d="M 28 32 Q 26 42 22 51" />
            <path d="M 22 51 Q 24 60 24 70" />

            {/* Spider Web Concentric Curves - Outer */}
            <path d="M 50 10 Q 65 18 82 29" />
            <path d="M 82 29 Q 82 40 85 50" />
            <path d="M 85 50 Q 83 62 84 72" />
            <path d="M 50 10 Q 35 18 18 29" />
            <path d="M 18 29 Q 18 40 15 50" />
            <path d="M 15 50 Q 17 62 16 72" />

            {/* Pen Nib Outline */}
            <path d="M 40 42 L 60 42 L 65 55 C 65 72 55 82 50 92 C 45 82 35 72 35 55 Z" fill="currentColor" fillOpacity="0.05" />
            
            {/* Pen Nib Horizontal Band */}
            <line x1="36" y1="52" x2="64" y2="52" />
            
            {/* Pen Nib Slit */}
            <line x1="50" y1="68" x2="50" y2="92" />
        </g>
        
        {/* Pen Nib Hole */}
        <circle cx="50" cy="64" r="3.5" fill="url(#logo-gradient)" />
    </svg>
  );
};