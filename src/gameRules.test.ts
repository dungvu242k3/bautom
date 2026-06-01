import { describe, expect, it } from 'vitest';
import {
  authEmailFromUsername,
  calculatePayout,
  countMatches,
  normalizeUsername,
  summarizeBets,
  validateBetAmount,
  validateRoomForm,
} from './gameRules';
import type { Bet } from './types';

describe('game rules', () => {
  it('normalizes username for no-email auth aliases', () => {
    expect(normalizeUsername('  Dung-Vu!!_123  ')).toBe('dungvu_123');
    expect(authEmailFromUsername('Player_One')).toBe('player_one@baucua.local');
  });

  it('calculates bau cua payout with stake returned on wins', () => {
    expect(countMatches(['bau', 'cua', 'bau'], 'bau')).toBe(2);
    expect(calculatePayout(100, ['bau', 'cua', 'bau'], 'bau')).toBe(300);
    expect(calculatePayout(100, ['tom', 'cua', 'nai'], 'bau')).toBe(0);
  });

  it('validates room and bet boundaries', () => {
    expect(
      validateRoomForm({
        name: 'Phòng vui',
        isPrivate: false,
        maxPlayers: 8,
        minBet: 50,
        maxBet: 1000,
        betDuration: 15,
      }),
    ).toBeNull();
    expect(validateBetAmount(500, 50, 1000, 499)).toBe('Số dư không đủ');
    expect(validateBetAmount(5, 50, 1000, 1000)).toContain('Tối thiểu');
  });

  it('summarizes bets without exposing wallet data', () => {
    const bets = [
      { animal: 'bau', amount: 100 },
      { animal: 'bau', amount: 50 },
      { animal: 'cua', amount: 200 },
    ] as Bet[];

    expect(summarizeBets(bets).bau).toBe(150);
    expect(summarizeBets(bets).cua).toBe(200);
    expect(summarizeBets(bets).tom).toBe(0);
  });
});
