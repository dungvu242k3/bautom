import React from 'react';
import { AnimalType } from '@/types/game.types';

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

export const GourdIcon: React.FC<IconProps> = ({ size = 64, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* Bầu - Gourd */}
    <path d="M32 6C32 6 36 10 36 14C36 17.5 34.5 19 32 20C29.5 19 28 17.5 28 14C28 10 32 6 32 6Z" fill="currentColor" opacity="0.8" />
    <path d="M32 20C24 20 22 28 26 32C18 36 16 52 32 58C48 52 46 36 38 32C42 28 40 20 32 20Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd" />
    <circle cx="32" cy="27" r="3" fill="#020617" />
    <circle cx="32" cy="45" r="5" fill="#020617" />
  </svg>
);

export const CrabIcon: React.FC<IconProps> = ({ size = 64, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* Cua - Crab */}
    <rect x="20" y="24" width="24" height="18" rx="9" fill="currentColor" />
    {/* Càng cua */}
    <path d="M14 20C14 20 10 24 16 28C18 24 20 24 20 24" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M50 20C50 20 54 24 48 28C46 24 44 24 44 24" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    {/* Chân cua */}
    <path d="M16 34C10 36 12 44 12 44" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d="M18 38C12 42 16 48 16 48" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d="M48 34C54 36 52 44 52 44" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d="M46 38C52 42 48 48 48 48" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    {/* Mắt */}
    <circle cx="28" cy="20" r="2" fill="currentColor" />
    <circle cx="36" cy="20" r="2" fill="currentColor" />
  </svg>
);

export const ShrimpIcon: React.FC<IconProps> = ({ size = 64, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* Tôm - Shrimp */}
    <path d="M22 46C20 40 24 32 30 26C36 20 44 16 48 18C52 20 50 28 44 34C38 40 28 48 22 46Z" fill="currentColor" />
    {/* Đuôi tôm */}
    <path d="M22 46L14 54L10 50L18 42" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    {/* Râu tôm */}
    <path d="M48 18C52 14 58 10 58 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    <path d="M48 18C54 18 60 18 60 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    {/* Chân tôm */}
    <path d="M26 36C22 38 20 42 20 42" stroke="currentColor" strokeWidth="3" />
    <path d="M30 32C26 34 24 38 24 38" stroke="currentColor" strokeWidth="3" />
    <path d="M34 28C30 30 28 34 28 34" stroke="currentColor" strokeWidth="3" />
  </svg>
);

export const FishIcon: React.FC<IconProps> = ({ size = 64, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* Cá - Fish */}
    <path d="M12 32C20 22 36 16 48 22C54 25 56 32 48 38C36 44 20 38 12 32Z" fill="currentColor" />
    {/* Đuôi cá */}
    <path d="M14 32L6 40V24L14 32Z" fill="currentColor" />
    {/* Vây cá */}
    <path d="M32 20L38 14H30L32 20Z" fill="currentColor" />
    <path d="M32 40L38 46H30L32 40Z" fill="currentColor" />
    {/* Mắt cá */}
    <circle cx="44" cy="28" r="2.5" fill="#020617" />
  </svg>
);

export const RoosterIcon: React.FC<IconProps> = ({ size = 64, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* Gà - Rooster */}
    <path d="M20 44C20 44 14 36 18 28C22 20 28 16 36 20C44 24 46 36 40 44C34 50 20 44 20 44Z" fill="currentColor" />
    {/* Mào gà */}
    <path d="M36 20C36 14 42 12 42 12C42 12 46 16 42 20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" fill="currentColor" />
    {/* Mỏ gà */}
    <path d="M42 26L48 28L42 32" fill="currentColor" />
    {/* Tích gà */}
    <path d="M38 32C38 36 34 38 34 38" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    {/* Mắt */}
    <circle cx="34" cy="24" r="2" fill="#020617" />
  </svg>
);

export const DeerIcon: React.FC<IconProps> = ({ size = 64, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    {/* Nai - Deer */}
    <path d="M22 36C22 36 18 28 22 22C26 16 34 16 38 22C42 28 38 36 22 36Z" fill="currentColor" />
    {/* Sừng nai */}
    <path d="M32 18V8M32 12H38M32 10H26" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    {/* Tai nai */}
    <path d="M22 22L14 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    <path d="M38 22L46 18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    {/* Mắt */}
    <circle cx="28" cy="24" r="2" fill="#020617" />
    <circle cx="34" cy="24" r="2" fill="#020617" />
  </svg>
);

interface AnimalIconProps extends IconProps {
  type: AnimalType;
}

export const AnimalIcon: React.FC<AnimalIconProps> = ({ type, size = 64, ...props }) => {
  switch (type) {
    case 'bau':
      return <GourdIcon size={size} {...props} />;
    case 'cua':
      return <CrabIcon size={size} {...props} />;
    case 'tom':
      return <ShrimpIcon size={size} {...props} />;
    case 'ca':
      return <FishIcon size={size} {...props} />;
    case 'ga':
      return <RoosterIcon size={size} {...props} />;
    case 'nai':
      return <DeerIcon size={size} {...props} />;
    default:
      return null;
  }
};
