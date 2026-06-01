import type { Animal, Bet, RoomForm } from './types';

export const ANIMALS: Array<{ id: Animal; label: string; tone: string }> = [
  { id: 'bau', label: 'Bầu', tone: '#16a34a' },
  { id: 'cua', label: 'Cua', tone: '#dc2626' },
  { id: 'tom', label: 'Tôm', tone: '#ea580c' },
  { id: 'ca', label: 'Cá', tone: '#0284c7' },
  { id: 'ga', label: 'Gà', tone: '#ca8a04' },
  { id: 'nai', label: 'Nai', tone: '#a16207' },
];

export const CHIP_VALUES = [50, 100, 250, 500, 1000, 2500];

export function formatCoin(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value);
}

export function authEmailFromUsername(username: string): string {
  return `${normalizeUsername(username)}@baucua.local`;
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
}

export function validateUsername(value: string): string | null {
  const username = normalizeUsername(value);
  if (username.length < 3) return 'Tên đăng nhập cần từ 3 ký tự';
  if (!/^[a-z0-9_]{3,24}$/.test(username)) return 'Chỉ dùng chữ thường, số và dấu gạch dưới';
  return null;
}

export function validateRoomForm(form: RoomForm): string | null {
  if (form.name.trim().length < 3) return 'Tên phòng cần ít nhất 3 ký tự';
  if (form.maxPlayers < 2 || form.maxPlayers > 16) return 'Số người chơi từ 2 đến 16';
  if (form.minBet < 10) return 'Cược tối thiểu từ 10 xu';
  if (form.maxBet < form.minBet) return 'Cược tối đa phải lớn hơn cược tối thiểu';
  if (form.betDuration < 8 || form.betDuration > 60) return 'Thời gian cược từ 8 đến 60 giây';
  return null;
}

export function validateBetAmount(amount: number, minBet: number, maxBet: number, balance: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'Mức cược không hợp lệ';
  if (amount < minBet) return `Tối thiểu ${formatCoin(minBet)} xu`;
  if (amount > maxBet) return `Tối đa ${formatCoin(maxBet)} xu`;
  if (amount > balance) return 'Số dư không đủ';
  return null;
}

export function countMatches(dice: Animal[], animal: Animal): number {
  return dice.filter((item) => item === animal).length;
}

export function calculatePayout(amount: number, dice: Animal[], animal: Animal): number {
  const matches = countMatches(dice, animal);
  return matches === 0 ? 0 : amount + amount * matches;
}

export function summarizeBets(bets: Bet[]): Record<Animal, number> {
  return ANIMALS.reduce(
    (acc, animal) => {
      acc[animal.id] = bets
        .filter((bet) => bet.animal === animal.id)
        .reduce((sum, bet) => sum + bet.amount, 0);
      return acc;
    },
    {} as Record<Animal, number>,
  );
}

export function secondsLeft(endsAt: string, now = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(endsAt).getTime() - now) / 1000));
}
