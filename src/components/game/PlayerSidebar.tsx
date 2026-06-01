import React from 'react';
import { RoomPlayer, Bet } from '@/types/game.types';
import { formatCoin } from '@/utils/formatCoin';
import { Crown, User, CheckCircle2 } from 'lucide-react';

interface PlayerSidebarProps {
  players: RoomPlayer[];
  bets: Bet[];
}

export const PlayerSidebar: React.FC<PlayerSidebarProps> = ({ players, bets }) => {
  // Kiểm tra xem một người chơi đã đặt cược trong ván này chưa
  const hasUserPlacedBet = (userId: string) => {
    return bets.some((b) => b.user_id === userId);
  };

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <h3 className="text-base font-bold text-amber-400 font-heading tracking-wide">
          NGƯỜI CHƠI ({players.length})
        </h3>
      </div>

      <div className="flex flex-col gap-2 max-h-[300px] md:max-h-[450px] overflow-y-auto pr-1">
        {players.map((player) => {
          const didBet = hasUserPlacedBet(player.user_id);
          return (
            <div
              key={player.user_id}
              className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                player.is_online
                  ? 'bg-slate-900/30 border-slate-800/40 hover:bg-slate-900/50'
                  : 'bg-slate-950/20 border-slate-950/10 opacity-50'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="relative w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
                  <User size={16} />
                  {/* Trạng thái Online */}
                  <span
                    className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-950 ${
                      player.is_online ? 'bg-emerald-500' : 'bg-slate-500'
                    }`}
                  />
                </div>

                {/* Tên & Xu */}
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-200 leading-none">
                      {player.display_name}
                    </span>
                    {player.is_host && <Crown size={12} className="text-yellow-400 fill-yellow-400" />}
                  </div>
                  <span className="text-[11px] font-bold text-slate-400 mt-1 leading-none">
                    {formatCoin(player.balance || 0)}
                  </span>
                </div>
              </div>

              {/* Trạng thái đã cược */}
              {didBet && (
                <div className="flex items-center gap-1 text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide">
                  <CheckCircle2 size={12} />
                  ĐÃ CƯỢC
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
