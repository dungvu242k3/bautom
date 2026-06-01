import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  id,
  ...props
}) => {
  const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-slate-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full px-4 py-3 bg-slate-900 border ${
          error ? 'border-rose-500 focus:ring-rose-500/20' : 'border-slate-800 focus:border-amber-500 focus:ring-amber-500/20'
        } rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-4 transition-all duration-150 min-h-[44px] ${className}`}
        {...props}
      />
      {error && (
        <span className="text-xs text-rose-400 font-medium mt-0.5">
          {error}
        </span>
      )}
    </div>
  );
};
