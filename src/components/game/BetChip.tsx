import React from 'react';

interface BetChipProps {
  amount: number;
  isSelected: boolean;
  onClick: () => void;
}

export const BetChip: React.FC<BetChipProps> = ({ amount, isSelected, onClick }) => {
  const getChipColors = (val: number) => {
    switch (val) {
      case 50:
        return 'from-emerald-600 to-emerald-400 text-emerald-950 shadow-emerald-500/10 border-emerald-400/30';
      case 100:
        return 'from-sky-600 to-sky-400 text-sky-950 shadow-sky-500/10 border-sky-400/30';
      case 200:
        return 'from-amber-600 to-amber-400 text-amber-950 shadow-amber-500/10 border-amber-400/30';
      case 500:
        return 'from-rose-600 to-rose-400 text-rose-950 shadow-rose-500/10 border-rose-400/30';
      case 1000:
        default:
        return 'from-yellow-500 to-yellow-300 text-yellow-950 shadow-yellow-500/20 border-yellow-400/40';
    }
  };

  const colorStyle = getChipColors(amount);

  return (
    <button
      onClick={onClick}
      className={`relative w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center font-extrabold text-xs md:text-sm tracking-wider cursor-pointer border-2 transition-all duration-150 select-none shadow-lg active:scale-90 ${colorStyle} ${
        isSelected
          ? 'scale-110 -translate-y-2 ring-4 ring-amber-400/60 border-yellow-300 shadow-[0_4px_16px_rgba(245,158,11,0.4)] animate-pulse-subtle'
          : 'hover:scale-105 hover:-translate-y-1'
      }`}
    >
      {/* Outer dotted decorative circle */}
      <div className="absolute inset-1 rounded-full border border-dashed border-slate-950/20" />
      
      {/* Chip Value */}
      <span className="relative z-10 font-black text-shadow-sm leading-none drop-shadow">
        {amount}
      </span>
    </button>
  );
};
