import React, { useState } from 'react';
import { Bot, Send, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { StudioImage } from '../components/StudioImage';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
}

const STARTER_PROMPTS = [
  'How is my business performing this month?',
  'How can I increase my net profits right now?',
  'Which products are selling best and which need attention?',
  'How much stock should I reorder based on current inventory?',
  'How should I price my top-selling product?',
  'How can I attract and retain more repeat customers?',
];

export const AdvisorPage: React.FC = () => {
  const { business } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const askQuestion = async (questionText: string) => {
    const q = questionText.trim();
    if (!q || loading) return;

    const nextHistory = [...messages, { role: 'user' as const, text: q }];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const res = await apiRequest<{ answer: string }>('/api/ai/advisor', {
        method: 'POST',
        body: JSON.stringify({
          question: q,
          history: messages,
        }),
      });
      setMessages((prev) => [...prev, { role: 'assistant', text: res.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach AI Business Advisor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Prompt Library */}
      <div className="lg:col-span-4 surface-panel overflow-hidden h-fit">
        <div className="relative h-36 w-full overflow-hidden border-b border-slate-200/80 dark:border-white/[0.08]">
          <StudioImage
            src="/src/assets/images/studio_advisor_vault_1795511632573.jpg"
            alt="Executive Financial Strategy Suite"
            className="w-full h-full object-cover object-center"
            fallbackClassName="w-full h-full bg-[#0A172B]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#071426] via-[#071426]/65 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#22D3EE]/20 border border-[#22D3EE]/35 text-[#22D3EE] flex items-center justify-center shrink-0 backdrop-blur-sm">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display font-bold text-base text-white truncate">AI Business Advisor</h2>
              <p className="text-[11px] text-[#A7B4C7] truncate">
                Grounded in {business?.name || 'your'} live records
              </p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-slate-600 dark:text-[#A7B4C7] leading-relaxed">
            Every answer analyzes your actual sales, COGS, expenses, inventory stock levels, and customer data in {business?.currency}. If data is missing, the advisor tells you exactly what to record first.
          </p>

          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-slate-700 dark:text-white">Recommended Questions</p>
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={loading}
                onClick={() => void askQuestion(prompt)}
                className="surface-well w-full text-left px-3.5 py-2.5 text-xs text-slate-700 dark:text-[#A7B4C7] hover:border-[#287BFF]/60 hover:text-slate-900 dark:hover:text-white transition-all"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Chat Stream */}
      <div className="lg:col-span-8 surface-panel flex flex-col min-h-[540px] max-h-[75vh] overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
              <div className="w-14 h-14 rounded-2xl surface-well flex items-center justify-center mb-3 text-[#22D3EE]">
                <Bot className="w-7 h-7" />
              </div>
              <p className="font-display font-semibold text-base text-slate-900 dark:text-white">
                Ask anything about your profitability, pricing, or inventory
              </p>
              <p className="mt-1.5 text-xs text-slate-500 dark:text-[#A7B4C7] max-w-md">
                Choose a prompt on the left or type a custom business question below.
              </p>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-gradient-to-r from-[#287BFF] to-[#1D68E6] text-white shadow-[0_8px_20px_-8px_rgba(40,123,255,0.5)]'
                      : 'surface-well text-slate-800 dark:text-slate-100'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))
          )}

          {loading && (
            <div className="flex justify-start">
              <div className="surface-well px-4 py-3 text-xs text-slate-500 dark:text-[#A7B4C7]">
                Analyzing your business data...
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 p-3.5 flex items-start gap-2.5 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void askQuestion(input);
          }}
          className="p-4 border-t border-slate-100 dark:border-white/[0.07] bg-slate-50/70 dark:bg-[#0B192E]/70 flex items-center gap-2.5"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask your AI Business Advisor..."
            className="input-field flex-1 min-h-[44px] px-4"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send question"
            className="min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] hover:brightness-110 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Ask</span>
          </button>
        </form>
      </div>
    </div>
  );
};
