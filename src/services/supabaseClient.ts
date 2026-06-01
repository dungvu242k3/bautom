import { createClient } from '@supabase/supabase-js';

// Load variables từ env Vercel hoặc local .env
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-placeholder-supabase-url.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-placeholder-anon-key';

if (supabaseUrl.includes('placeholder')) {
  console.warn(
    'Supabase URL/Anon key chưa được cấu hình. Vui lòng thiết lập VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong file .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
