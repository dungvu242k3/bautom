import React from 'react';

interface LoadingProps {
  fullPage?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Loading: React.FC<LoadingProps> = ({ fullPage = false, size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-12 h-12 border-4',
    lg: 'w-20 h-20 border-8'
  };

  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      {/* Aesthetic Gold Ring Spinner */}
      <div className={`relative ${sizeClasses[size]} rounded-full border-amber-500/20 border-t-amber-400 animate-spin`}>
        {/* Inner glow circle */}
        <div className="absolute inset-0.5 rounded-full border border-yellow-300/10" />
      </div>
      <p className="text-amber-400/80 font-semibold tracking-wider animate-pulse text-sm font-heading">
        ĐANG KẾT NỐI...
      </p>
    </div>
  );

  if (fullPage) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md">
        {content}
      </div>
    );
  }

  return content;
};
