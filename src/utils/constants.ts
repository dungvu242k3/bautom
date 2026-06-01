import React from 'react';
import { AnimalType } from '@/types/game.types';

export interface AnimalItem {
  id: AnimalType;
  name: string;
  colorClass: string; // Tailwind class
  accentColor: string; // Hex color
  bgClass: string;
}

export const ANIMAL_LIST: AnimalItem[] = [
  {
    id: 'bau',
    name: 'Bầu',
    colorClass: 'text-amber-500 border-amber-500/20',
    accentColor: '#F59E0B',
    bgClass: 'bg-amber-950/20'
  },
  {
    id: 'cua',
    name: 'Cua',
    colorClass: 'text-rose-500 border-rose-500/20',
    accentColor: '#F43F5E',
    bgClass: 'bg-rose-950/20'
  },
  {
    id: 'tom',
    name: 'Tôm',
    colorClass: 'text-orange-500 border-orange-500/20',
    accentColor: '#F97316',
    bgClass: 'bg-orange-950/20'
  },
  {
    id: 'ca',
    name: 'Cá',
    colorClass: 'text-sky-500 border-sky-500/20',
    accentColor: '#0EA5E9',
    bgClass: 'bg-sky-950/20'
  },
  {
    id: 'ga',
    name: 'Gà',
    colorClass: 'text-yellow-400 border-yellow-400/20',
    accentColor: '#FACC15',
    bgClass: 'bg-yellow-950/20'
  },
  {
    id: 'nai',
    name: 'Nai',
    colorClass: 'text-emerald-500 border-emerald-500/20',
    accentColor: '#10B981',
    bgClass: 'bg-emerald-950/20'
  }
];

export const BET_CHIPS = [50, 100, 200, 500, 1000];
