import React, { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (
    name: string,
    isPrivate: boolean,
    maxPlayers: number,
    minBet: number,
    maxBet: number,
    betDuration: number
  ) => Promise<void>;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  isOpen,
  onClose,
  onCreate
}) => {
  const [name, setName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(10);
  const [minBet, setMinBet] = useState(50);
  const [maxBet, setMaxBet] = useState(1000);
  const [betDuration, setBetDuration] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (minBet < 10) {
      setError('Cược tối thiểu không được dưới 10 xu!');
      return;
    }
    if (maxBet < minBet) {
      setError('Cược tối đa không thể nhỏ hơn cược tối thiểu!');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onCreate(name.trim(), isPrivate, maxPlayers, minBet, maxBet, betDuration);
      onClose();
      // Reset form
      setName('');
      setIsPrivate(false);
      setMaxPlayers(10);
      setMinBet(50);
      setMaxBet(1000);
      setBetDuration(15);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo phòng chơi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="TẠO PHÒNG CƯỢC MỚI">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && (
          <div className="bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <Input
          label="Tên phòng cược *"
          placeholder="Nhập tên phòng của bạn..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={30}
        />

        {/* Tùy chọn Phòng Riêng Tư */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-900/40 border border-slate-800/60 mt-1">
          <div className="flex flex-col text-left">
            <span className="text-sm font-semibold text-slate-200">Phòng riêng tư (Private)</span>
            <span className="text-xs text-slate-500">Chỉ người có mã Code mới vào được</span>
          </div>
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="w-5 h-5 accent-amber-500 cursor-pointer rounded"
          />
        </div>

        {/* Cấu hình Giới hạn cược */}
        <div className="grid grid-cols-2 gap-3 mt-1">
          <Input
            label="Cược tối thiểu (Min bet) *"
            type="number"
            value={minBet}
            onChange={(e) => setMinBet(Number(e.target.value))}
            required
            min={10}
          />
          <Input
            label="Cược tối đa (Max bet) *"
            type="number"
            value={maxBet}
            onChange={(e) => setMaxBet(Number(e.target.value))}
            required
            min={10}
          />
        </div>

        {/* Số người tối đa & thời gian */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Số người tối đa *"
            type="number"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            required
            min={2}
            max={20}
          />
          <Input
            label="Thời gian đặt cược (giây) *"
            type="number"
            value={betDuration}
            onChange={(e) => setBetDuration(Number(e.target.value))}
            required
            min={10}
            max={60}
          />
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 mt-4 border-t border-slate-800/60 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button type="submit" variant="gold" loading={loading}>
            Khởi tạo ngay
          </Button>
        </div>
      </form>
    </Modal>
  );
};
