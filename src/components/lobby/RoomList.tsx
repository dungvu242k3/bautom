import React from 'react';
import { Room } from '@/types/game.types';
import { formatCoin } from '@/utils/formatCoin';
import { Button } from '../ui/Button';
import { Users, Shield, ArrowRight } from 'lucide-react';

interface RoomListProps {
  rooms: Room[];
  onJoinRoom: (roomId: string) => void;
}

export const RoomList: React.FC<RoomListProps> = ({ rooms, onJoinRoom }) => {
  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 bg-slate-900/10 border border-dashed border-slate-800 rounded-2xl">
        <Users size={40} className="text-slate-600 mb-3" />
        <p className="text-sm text-slate-400 font-medium font-heading">
          Không tìm thấy phòng chơi công khai nào.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Hãy bấm "Tạo phòng mới" ở phía trên để bắt đầu ván đấu!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {rooms.map((room) => (
        <div
          key={room.id}
          className="glass-card rounded-2xl p-5 flex flex-col justify-between text-left group hover:scale-[1.01] hover:border-amber-500/30 transition-all duration-200"
        >
          <div>
            {/* Header phòng cược */}
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-bold text-slate-200 tracking-wide text-base font-heading line-clamp-1">
                {room.name}
              </h4>
              {room.is_private && (
                <span className="flex items-center gap-1 text-[10px] font-black text-rose-400 bg-rose-950/40 border border-rose-500/20 px-2 py-0.5 rounded-full">
                  <Shield size={10} />
                  MẬT
                </span>
              )}
            </div>

            {/* Thông số phòng cược */}
            <div className="flex flex-col gap-2 mb-5 text-sm text-slate-400">
              <div className="flex justify-between items-center">
                <span>Cược tối thiểu:</span>
                <span className="font-bold text-emerald-400">{formatCoin(room.min_bet)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Cược tối đa:</span>
                <span className="font-bold text-amber-500">{formatCoin(room.max_bet)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Thời gian cược:</span>
                <span className="font-semibold text-slate-300">{room.bet_duration} giây</span>
              </div>
            </div>
          </div>

          {/* Button Join */}
          <Button
            variant="primary"
            onClick={() => onJoinRoom(room.id)}
            className="w-full flex items-center justify-center gap-2 group/btn"
          >
            Vào phòng cược
            <ArrowRight size={16} className="transition-transform group-hover/btn:translate-x-1" />
          </Button>

        </div>
      ))}
    </div>
  );
};
