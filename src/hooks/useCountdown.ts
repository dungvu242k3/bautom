import { useState, useEffect } from 'react';

export const useCountdown = (endsAtIso: string | undefined, onTimeUp?: () => void) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!endsAtIso) {
      setTimeLeft(0);
      return;
    }

    const calculateTimeLeft = () => {
      const difference = new Date(endsAtIso).getTime() - Date.now();
      const secondsLeft = Math.max(0, Math.floor(difference / 1000));
      setTimeLeft(secondsLeft);
      
      if (secondsLeft <= 0) {
        clearInterval(timer);
        if (onTimeUp) onTimeUp();
      }
    };

    // Tính toán ngay lập tức khi endsAt thay đổi
    calculateTimeLeft();

    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [endsAtIso]);

  return timeLeft;
};
