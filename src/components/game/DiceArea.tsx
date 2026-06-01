import React from 'react';
import { GamePhase, AnimalType } from '@/types/game.types';
import { AnimalIcon } from '../ui/AnimalIcons';
import { ANIMAL_LIST } from '@/utils/constants';

interface DiceAreaProps {
  phase: GamePhase;
  diceResults: AnimalType[];
  isShaking: boolean;
  isRevealing: boolean;
}

export const DiceArea: React.FC<DiceAreaProps> = ({
  phase,
  diceResults,
  isShaking,
  isRevealing
}) => {
  const getPhaseMessage = () => {
    switch (phase) {
      case 'waiting':
        return 'Chờ Host khởi động ván mới...';
      case 'betting':
        return 'Đang nhận đặt cược...';
      case 'lock':
        return 'Đã khóa đặt cược!';
      case 'shake':
        return 'Đang lắc xúc xắc...';
      case 'reveal':
      case 'settlement':
        return 'Mở bát! Chúc mừng các nhà cược!';
      default:
        return '';
    }
  };

  return (
    <div className="w-full flex flex-col items-center justify-center p-4 md:p-6 bg-linear-to-b from-slate-900/60 to-slate-950/60 border border-slate-800/80 rounded-3xl relative overflow-hidden backdrop-blur-md">
      
      {/* Background ambient lighting */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-3xl opacity-10 pointer-events-none transition-colors duration-1000 ${
        isShaking ? 'bg-amber-500' : isRevealing ? 'bg-emerald-500' : 'bg-crimson-500'
      }`} />

      {/* Main plate and bowl container */}
      <div className="relative w-48 h-48 md:w-56 md:h-56 flex items-center justify-center">
        
        {/* Chiếu cỏ hoặc dĩa đựng xúc xắc */}
        <div className="absolute w-44 h-44 md:w-52 md:h-52 rounded-full bg-emerald-950/60 border-4 border-amber-600/30 flex items-center justify-center shadow-inner">
          <div className="absolute inset-2 rounded-full border border-emerald-500/20" />
        </div>

        {/* Cụm 3 viên xúc xắc khi mở bát */}
        {(phase === 'reveal' || phase === 'settlement' || isRevealing) && diceResults.length === 3 && (
          <div className="absolute z-10 flex gap-2 items-center justify-center scale-90 md:scale-100">
            {diceResults.map((dice, idx) => {
              const item = ANIMAL_LIST.find((a) => a.id === dice)!;
              const delayClass = idx === 0 ? '' : idx === 1 ? 'delay-200' : 'delay-400';
              return (
                <div
                  key={idx}
                  className={`w-12 h-12 md:w-14 md:h-14 rounded-xl bg-slate-900 border border-slate-700/60 flex items-center justify-center shadow-xl animate-dice-roll ${delayClass}`}
                >
                  <AnimalIcon type={dice} size={32} className={item.colorClass} />
                </div>
              );
            })}
          </div>
        )}

        {/* Cái Bát (Bowl) - Đậy xúc xắc */}
        <div
          className={`absolute w-36 h-36 md:w-44 md:h-44 rounded-full bg-linear-to-tr from-crimson-900 via-crimson-850 to-amber-700 border-4 border-yellow-500/40 shadow-2xl flex items-center justify-center cursor-pointer transition-all duration-500 ${
            isShaking ? 'animate-shake-bowl z-20' : ''
          } ${
            isRevealing || phase === 'reveal' || phase === 'settlement'
              ? 'opacity-0 scale-75 -translate-y-24 pointer-events-none'
              : 'opacity-100 scale-100 translate-y-0 z-20'
          }`}
        >
          {/* Decorative imperial dragon/circle icon in gold */}
          <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-yellow-400/20 border-dashed flex items-center justify-center">
            <span className="text-yellow-400/60 font-black text-xs md:text-sm tracking-widest font-heading">
              BẦU CUA
            </span>
          </div>
        </div>

      </div>

      {/* Thông tin Phase & đếm ngược thời gian */}
      <div className="mt-4 text-center z-10 flex flex-col items-center">
        <h4 className="text-sm font-semibold tracking-wider text-slate-400 font-heading">
          {getPhaseMessage()}
        </h4>
      </div>

    </div>
  );
};
