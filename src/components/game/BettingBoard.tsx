import React from 'react';
import { AnimalTile } from './AnimalTile';
import { AnimalType, Bet } from '@/types/game.types';

interface BettingBoardProps {
  roundId: string;
  phase: string;
  bets: Bet[];
  currentUserId: string;
  localBets: Record<AnimalType, number>;
  onBetClick: (animal: AnimalType) => void;
}

export const BettingBoard: React.FC<BettingBoardProps> = ({
  roundId,
  phase,
  bets,
  currentUserId,
  localBets,
  onBetClick
}) => {
  const disabled = phase !== 'betting';

  // Tính toán tổng cược của cả phòng và cược của riêng người chơi cho từng linh vật
  const getBetStats = (animal: AnimalType) => {
    const animalBets = bets.filter((b) => b.animal === animal);
    const totalRoomBets = animalBets.reduce((sum, b) => sum + Number(b.amount), 0);
    const userBets = animalBets
      .filter((b) => b.user_id === currentUserId)
      .reduce((sum, b) => sum + Number(b.amount), 0);

    return {
      totalRoomBets,
      userBets
    };
  };

  const animals: AnimalType[] = ['bau', 'cua', 'tom', 'ca', 'ga', 'nai'];

  return (
    <div className="w-full">
      {/* 2x3 Grid Layout on Mobile, 3x2 Grid Layout on Desktop */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 p-1">
        {animals.map((animal) => {
          const { totalRoomBets, userBets } = getBetStats(animal);
          return (
            <AnimalTile
              key={animal}
              id={animal}
              totalRoomBets={totalRoomBets}
              userBets={userBets}
              localBets={localBets[animal]}
              disabled={disabled}
              onBetClick={onBetClick}
            />
          );
        })}
      </div>
    </div>
  );
};
