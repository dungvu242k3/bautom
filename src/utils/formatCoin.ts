export const formatCoin = (coins: number): string => {
  return new Intl.NumberFormat('vi-VN').format(coins) + ' xu';
};
