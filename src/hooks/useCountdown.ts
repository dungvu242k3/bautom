import { useState, useEffect } from 'react';

export const useCountdown = (
  endsAtIso: string | undefined,
  startedAtIso: string | undefined,
  onTimeUp?: () => void
) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!endsAtIso) {
      setTimeLeft(0);
      return;
    }

    let timer: any = null;

    // 1. Tính toán độ lệch đồng hồ (clock desync offset) giữa client và server
    // Giả định thời gian truyền tin qua mạng cực nhỏ, nên tại thời điểm nhận được payload:
    // Thời gian server = startedAtIso.
    // Thời gian client hiện tại = Date.now().
    const serverStart = startedAtIso ? new Date(startedAtIso).getTime() : Date.now();
    const clientArrival = Date.now();
    const clockDesyncOffset = clientArrival - serverStart;

    const calculateTimeLeft = () => {
      // 2. Sử dụng clockDesyncOffset để hiệu chỉnh thời gian client hiện tại khớp với server
      const adjustedClientNow = Date.now() - clockDesyncOffset;
      const difference = new Date(endsAtIso).getTime() - adjustedClientNow;
      const secondsLeft = Math.max(0, Math.round(difference / 1000)); // Dùng Math.round để tránh hiển thị lệch giây
      setTimeLeft(secondsLeft);
      
      if (secondsLeft <= 0) {
        if (timer) clearInterval(timer);
        if (onTimeUp) onTimeUp();
      }
    };

    // Tính toán ngay lập tức khi endsAt thay đổi
    calculateTimeLeft();

    timer = setInterval(calculateTimeLeft, 1000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [endsAtIso, startedAtIso]);

  return timeLeft;
};
