import { ownerText, ownerError } from '../lib/displayText';
import React, { useState, useRef, useEffect } from 'react';
import { authenticatedFetch } from '../lib/api';
import { 
  Bot, 
  Send, 
  Sparkles, 
  User, 
  ChefHat, 
  TrendingUp, 
  ShieldAlert, 
  RefreshCw, 
  Lightbulb 
} from 'lucide-react';
import { MenuItem, Ingredient, MarginAlert, SalesRecord } from '../types';

interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
}

interface AiAssistantViewProps {
  salesRecords: SalesRecord[];
  menuItems: MenuItem[];
  ingredients: Ingredient[];
  marginAlerts: MarginAlert[];
  currencySymbol: string;
}

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  salesRecords,
  menuItems,
  ingredients,
  marginAlerts,
  currencySymbol,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'msg_01',
      sender: 'bot',
      text: `Hello Chef & Owner! I'm Rinet Resto Bot, your personal AI Restaurant Management Assistant.\n\nI'm actively monitoring your sales records, recipe ingredient costs, supplier price creep alerts, and inventory stock levels. How can I help maximize your profits today?`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (queryText?: string) => {
    const messageToSend = queryText || inputQuery;
    if (!messageToSend.trim()) return;

    const userMsg: Message = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: messageToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryText) setInputQuery('');
    setIsLoading(true);

    try {
      const res = await authenticatedFetch('/api/ai/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageToSend,
          contextData: {
            salesCount: salesRecords.length,
            totalRevenue: salesRecords.reduce((sum, s) => sum + s.total_amount, 0),
            menuCount: menuItems.length,
            lowStockItems: ingredients.filter(i => i.current_stock <= i.min_threshold).map(i => i.name),
            activePriceCreepAlerts: marginAlerts.filter(a => !a.is_resolved).map(a => ({
              ingredient: a.ingredient_name,
              increasePct: a.increase_percent,
              monthlyLoss: a.estimated_monthly_loss
            })),
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(ownerError(data.error, res.status));
      if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('The AI assistant returned an empty answer. Please retry.');
      const botReplyText = ownerText(data.reply, 'The assistant could not provide a readable answer. Please try again.');

      const botMsg: Message = {
        id: `bot_${Date.now()}`,
        sender: 'bot',
        text: botReplyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.error('Error in Resto Bot chat:', err);
      setMessages(prev => [
        ...prev,
        {
          id: `bot_err_${Date.now()}`,
          sender: 'bot',
          text: ownerError(err),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const samplePrompts = [
    "How can I fix the profit margin on my Vadapav and Cheese Pizza?",
    "Which supplier price hikes are hurting my profits the most?",
    "What ingredients should I order for the upcoming weekend?",
    "Give me 3 ways to reduce kitchen waste based on my inventory.",
  ];

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>RestoBot AI Advisor</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white">Interactive Resto AI Assistant</h1>
          <p className="text-sm text-slate-400 mt-1">
            Ask questions about menu pricing, supplier negotiations, waste reduction, or weekend order forecasting.
          </p>
        </div>
      </div>

      {/* QUICK CHIP PROMPTS */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
        {samplePrompts.map((p, idx) => (
          <button
            key={idx}
            onClick={() => handleSendMessage(p)}
            className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs px-3.5 py-2 rounded-xl shrink-0 transition flex items-center space-x-1.5"
          >
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>{p}</span>
          </button>
        ))}
      </div>

      {/* CHAT WINDOW */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col h-[520px]">
        
        {/* Messages Feed */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-start space-x-3 ${msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                msg.sender === 'bot' 
                  ? 'bg-gradient-to-tr from-amber-500 to-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-200 border border-slate-700'
              }`}>
                {msg.sender === 'bot' ? <Bot className="w-5 h-5" /> : <User className="w-4 h-4" />}
              </div>

              <div className={`max-w-[80%] rounded-2xl p-4 text-xs leading-relaxed ${
                msg.sender === 'bot'
                  ? 'bg-slate-950/80 border border-slate-800 text-slate-200 shadow'
                  : 'bg-emerald-600 text-white font-medium shadow-lg'
              }`}>
                <div className="whitespace-pre-wrap">{msg.text}</div>
                <div className="text-[10px] text-slate-500 mt-2 text-right">{msg.timestamp}</div>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex items-center space-x-3 text-xs text-slate-400 py-2">
              <Bot className="w-5 h-5 text-amber-400 animate-spin" />
              <span>Rinet Resto Bot is calculating store insights...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Input Controls */}
        <div className="pt-4 border-t border-slate-800 flex items-center space-x-2">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask Rinet Resto Bot about recipe costs, supplier price hikes, or waste..."
            className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-amber-500"
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputQuery.trim()}
            className="bg-gradient-to-r from-amber-500 to-emerald-500 hover:brightness-110 text-slate-950 font-bold px-5 py-3 rounded-xl shadow transition disabled:opacity-50 flex items-center space-x-2 shrink-0 text-xs"
          >
            <span>Ask Bot</span>
            <Send className="w-4 h-4" />
          </button>
        </div>

      </div>

    </div>
  );
};
