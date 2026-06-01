import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.');
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 12,
    },
  },
});

export let clockOffset = 0;

export async function syncClock() {
  try {
    const start = Date.now();
    const { data } = await supabase.rpc('get_server_time');
    const end = Date.now();
    if (data) {
      const serverTime = new Date(data).getTime();
      const latency = (end - start) / 2;
      clockOffset = (serverTime + latency) - end;
    }
  } catch (e) {
    console.error('Failed to sync clock with server:', e);
  }
}

// Perform clock sync as early as possible
syncClock();
