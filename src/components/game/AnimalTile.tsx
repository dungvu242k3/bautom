import React from 'react';
import { AnimalType } from '@/types/game.types';
import { AnimalIcon } from '../ui/AnimalIcons';
import { ANIMAL_LIST } from '@/utils/constants';
import { formatCoin } from '@/utils/formatCoin';

interface AnimalTileProps {
  id: AnimalType;
  totalRoomBets: number;
  userBets: number;
  localBets: number;
  disabled: boolean;
  onBetClick: (animal: AnimalType) => void;
}

export const AnimalTile: React.FC<AnimalTileProps> = ({
  id,
  totalRoomBets,
  userBets,
  localBets,
  disabled,
  onBetClick
}) => {
  const item = ANIMAL_LIST.find((a) => a.id === id)!;
  const hasLocalOrUserBet = userBets > 0 || localBets > 0;

  return (
    <button
      disabled={disabled}
      onClick={() => onBetClick(id)}
      className={`relative w-full h-32 md:h-40 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col items-center justify-center p-3 select-none active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed ${
        hasLocalOrUserBet
          ? 'border-amber-400 bg-amber-950/20 shadow-[0_0_12px_rgba(245,158,11,0.2)] animate-gold-glow'
          : 'border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 hover:border-slate-700'
      }`}
    >
      {/* Icon linh vật vẽ vector tinh xảo */}
      <div className={`transition-transform duration-300 ${hasLocalOrUserBet ? 'scale-110' : 'scale-100 hover:scale-105'}`}>
        <AnimalIcon type={id} size={56} className={item.colorClass} />
      </div>

      {/* Tên linh vật */}
      <span className="text-sm font-semibold tracking-wider font-heading mt-2 text-slate-300">
        {item.name}
      </span>

      {/* Hiển thị tiền cược */}
      <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
        {/* Tổng cược toàn bàn */}
        {totalRoomBets > 0 && (
          <span className="text-[10px] font-bold text-slate-400 bg-slate-800/60 px-1.5 py-0.5 rounded-full border border-slate-700/40">
            Bàn: {formatCoin(totalRoomBets).replace(' xu', '')}
          </span>
        )}

        {/* Tiền cược của người chơi (gồm cược tạm + cược đã xác nhận) */}
        {hasLocalOrUserBet && (
          <div className="flex flex-col gap-0.5 items-end">
            {userBets > 0 && (
              <span className="text-xs font-black text-amber-400 bg-amber-950/70 border border-amber-500/30 px-2 py-0.5 rounded-md">
                Bạn: {formatCoin(userBets).replace(' xu', '')}
              </span>
            )}
            {localBets > 0 && (
              <span className="text-[10px] font-bold text-slate-300 bg-slate-800 border border-dashed border-slate-600 px-1.5 py-0.5 rounded-md animate-pulse">
                +{localBets} (chưa xác nhận)
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  );
};
