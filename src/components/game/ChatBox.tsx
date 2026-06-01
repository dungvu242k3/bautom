import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/types/game.types';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Send } from 'lucide-react';

interface ChatBoxProps {
  messages: ChatMessage[];
  onSendMessage: (msg: string) => Promise<void>;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendMessage }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [lastSentTime, setLastSentTime] = useState<number>(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Tự động cuộn xuống cuối khi có tin nhắn mới
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || loading) return;

    // Rate limiting: Chống spam chat (giới hạn 1 giây gửi 1 tin)
    const now = Date.now();
    if (now - lastSentTime < 1000) {
      alert('Vui lòng không gửi tin nhắn quá nhanh!');
      return;
    }

    try {
      setLoading(true);
      await onSendMessage(text.trim());
      setText('');
      setLastSentTime(now);
    } catch (err) {
      console.error('Không thể gửi tin nhắn:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 h-[300px] md:h-[400px] bg-slate-950/20 border border-slate-800/40 rounded-2xl p-4 overflow-hidden relative">
      
      {/* Messages list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 scrollbar-none">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-xs italic">
            Chưa có tin nhắn nào. Hãy gửi lời chào đến mọi người!
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="text-left text-sm flex flex-col gap-0.5">
              <div className="flex items-baseline gap-2">
                <span className="font-extrabold text-amber-400 text-xs tracking-wide">
                  {msg.username || 'Vô danh'}
                </span>
                <span className="text-[9px] text-slate-500">
                  {new Date(msg.created_at).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <p className="text-slate-200 bg-slate-900/40 px-3 py-1.5 rounded-lg border border-slate-900 mt-1 leading-relaxed wrap-break-word">
                {msg.message}
              </p>
            </div>
          ))
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2 items-center border-t border-slate-800/60 pt-3 mt-1">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nhập tin nhắn..."
          maxLength={150}
          className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-lg text-sm text-slate-200 focus:outline-none placeholder-slate-500 min-h-[38px]"
        />
        <button
          type="submit"
          disabled={!text.trim() || loading}
          className="p-2 bg-crimson-700 hover:bg-crimson-600 rounded-lg text-white disabled:opacity-40 transition-colors flex items-center justify-center cursor-pointer min-h-[38px] min-w-[38px]"
        >
          <Send size={16} />
        </button>
      </form>

    </div>
  );
};
