import { create } from 'zustand';
import { Round, Bet, ChatMessage, AnimalType, GamePhase } from '@/types/game.types';

interface GameState {
  currentRound: Round | null;
  bets: Bet[];
  chatMessages: ChatMessage[];
  
  // Local state đặt cược tạm thời của người chơi (chưa xác nhận cược qua RPC)
  localBets: Record<AnimalType, number>;
  
  // Trạng thái Animation & countdown
  countdown: number;
  isShaking: boolean;
  isRevealing: boolean;
  diceResults: AnimalType[];
  winningAnimals: AnimalType[];

  // Action Methods
  setRoundState: (round: Round) => void;
  setBets: (bets: Bet[]) => void;
  addBet: (bet: Bet) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  
  // Local betting interaction methods
  selectChipToBet: (animal: AnimalType, amount: number) => void;
  clearLocalBets: () => void;
  confirmLocalBets: (placeBetFn: (animal: AnimalType, amount: number) => Promise<any>) => Promise<void>;
  
  // Game Loop Animation controls
  triggerShakeAnimation: () => void;
  triggerRevealAnimation: (dices: AnimalType[]) => void;
  resetAnimationState: () => void;
  setCountdown: (seconds: number) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  currentRound: null,
  bets: [],
  chatMessages: [],
  localBets: {
    bau: 0,
    cua: 0,
    tom: 0,
    ca: 0,
    ga: 0,
    nai: 0
  },
  countdown: 0,
  isShaking: false,
  isRevealing: false,
  diceResults: [],
  winningAnimals: [],

  setRoundState: (round) => {
    const prevRound = get().currentRound;
    
    // Nếu có vòng chơi cũ và ID vòng chơi mới khác hoàn toàn, chứng tỏ đã qua ván mới
    const isNewRound = prevRound && prevRound.id !== round.id;
    if (isNewRound) {
      set({ bets: [] });
    }
    
    // Nếu phase thay đổi, ta kích hoạt animation tương ứng ở client
    if (prevRound && prevRound.phase !== round.phase) {
      if (round.phase === 'shake') {
        get().triggerShakeAnimation();
      } else if (round.phase === 'reveal' && round.dice_1) {
        get().triggerRevealAnimation([
          round.dice_1 as AnimalType,
          round.dice_2 as AnimalType,
          round.dice_3 as AnimalType
        ]);
      } else if (round.phase === 'betting') {
        get().resetAnimationState();
      }
    }
    
    // Tính toán thời gian countdown còn lại dựa trên phase_ends_at của server
    const endsAt = new Date(round.phase_ends_at).getTime();
    const now = Date.now();
    const remainingSeconds = Math.max(0, Math.floor((endsAt - now) / 1000));

    set({ 
      currentRound: round,
      countdown: remainingSeconds
    });
  },

  setBets: (bets) => set({ bets }),
  
  addBet: (bet) => set((state) => ({ 
    bets: [...state.bets, bet] 
  })),

  setChatMessages: (chatMessages) => set({ chatMessages }),
  
  addChatMessage: (msg) => set((state) => ({ 
    chatMessages: [...state.chatMessages, msg].slice(-100) // Giữ tối đa 100 tin nhắn chat
  })),

  selectChipToBet: (animal, amount) => {
    const { localBets } = get();
    set({
      localBets: {
        ...localBets,
        [animal]: localBets[animal] + amount
      }
    });
  },

  clearLocalBets: () => set({
    localBets: {
      bau: 0,
      cua: 0,
      tom: 0,
      ca: 0,
      ga: 0,
      nai: 0
    }
  }),

  confirmLocalBets: async (placeBetFn) => {
    const { localBets } = get();
    
    // Gửi song song tất cả các cược đã chọn tạm qua hàm RPC place_bet của Supabase
    const promises = Object.entries(localBets)
      .filter(([_, amount]) => amount > 0)
      .map(([animal, amount]) => placeBetFn(animal as AnimalType, amount));
      
    await Promise.all(promises);
    get().clearLocalBets();
  },

  triggerShakeAnimation: () => {
    set({ 
      isShaking: true, 
      isRevealing: false, 
      diceResults: [], 
      winningAnimals: [] 
    });
    // Hết 3 giây tự động tắt rung lắc
    setTimeout(() => {
      set({ isShaking: false });
    }, 3000);
  },

  triggerRevealAnimation: (dices) => {
    set({ 
      isRevealing: true, 
      isShaking: false, 
      diceResults: dices,
      winningAnimals: dices 
    });
  },

  resetAnimationState: () => set({
    isShaking: false,
    isRevealing: false,
    diceResults: [],
    winningAnimals: [],
    localBets: {
      bau: 0,
      cua: 0,
      tom: 0,
      ca: 0,
      ga: 0,
      nai: 0
    }
  }),

  setCountdown: (seconds) => set({ countdown: seconds })
}));
