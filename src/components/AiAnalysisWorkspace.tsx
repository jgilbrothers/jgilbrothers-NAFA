import React, { useState } from 'react';
import { 
  Bot, 
  Send, 
  ArrowRight, 
  Trash2, 
  Plus, 
  FileCheck, 
  CornerDownRight, 
  Activity,
  Award,
  Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { ChatMessage, Transaction } from '../types';
import { getMockAiResponse } from '../utils/dataEngine';

interface AiAnalysisWorkspaceProps {
  chatLog: ChatMessage[];
  transactions: Transaction[];
  onSendMessage: (msg: ChatMessage) => void;
  onClearChat: () => void;
  onNavigate: (tab: string) => void;
  onLoadDemoData: () => void;
}

const COLORS = ['#1e293b', '#64748b', '#0f766e', '#0d9488', '#3b82f6', '#4f46e5'];

export default function AiAnalysisWorkspace({
  chatLog,
  transactions,
  onSendMessage,
  onClearChat,
  onNavigate,
  onLoadDemoData
}: AiAnalysisWorkspaceProps) {
  const [inputText, setInputText] = useState('');
  const [savedReports, setSavedReports] = useState<{[key: string]: boolean}>({});

  const quickPrompts = [
    'Find unusual cash or transfer activity',
    'What is the child-related childcare expenses total?',
    'Show me category spending charts'
  ];

  const handleSend = (text: string) => {
    if (!text.trim() || transactions.length === 0) return;

    // Send user message
    const userMsg: ChatMessage = {
      id: `USER-MSG-${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      sender: 'user',
      text: text,
      timestamp: new Date().toISOString()
    };
    onSendMessage(userMsg);

    // Simulate AI thinking and reply
    setTimeout(() => {
      const aiMsg = getMockAiResponse(text, transactions);
      onSendMessage(aiMsg);
    }, 850);

    setInputText('');
  };

  const renderVisualData = (visual: ChatMessage['visual_data']) => {
    if (!visual) return null;

    if (visual.type === 'category_totals' && visual.chartData) {
      return (
        <div className="bg-white border rounded-lg p-3.5 mt-2 space-y-2 h-44 font-mono text-[10px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={visual.chartData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                paddingAngle={2}
                dataKey="amount"
              >
                {visual.chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`$${value}`, undefined]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-4 text-[9px] text-slate-500 font-sans">
            {visual.chartData.map((d, index) => (
              <div key={index} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span>{d.name}: <strong>${d.amount}</strong></span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (visual.type === 'spend_chart' && visual.chartData) {
      return (
        <div className="bg-white border rounded-lg p-3.5 mt-2 h-44 font-mono text-[9px] text-slate-600">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visual.chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="category" tickLine={false} />
              <YAxis tickLine={false} axisLine={false} />
              <Tooltip formatter={(value) => [`$${value}`, undefined]} />
              <Bar dataKey="amount" fill="#1e293b" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (visual.type === 'recurring_summary' && visual.tableData) {
      return (
        <div className="bg-white border rounded-lg p-2.5 mt-2 overflow-x-auto text-xs font-mono">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-slate-50 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-1 px-2.5">Extracted Segment</th>
                <th className="p-1 px-2.5">Amount</th>
                <th className="p-1 px-2.5">Review Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visual.tableData.map((row: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="p-1 px-2.5 font-bold text-slate-800">{row.item}</td>
                  <td className="p-1 px-2.5 text-slate-900">${row.amount.toFixed(2)}</td>
                  <td className="p-1 px-2.5 text-[10px] text-indigo-700 italic font-sans">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6" id="ai-workspace-container">
      
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-indigo-600 animate-pulse" />
            AI Analytical Chat assistant
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">Explore cash routing, category totals, and notable transfer activity with conversational AI queries.</p>
        </div>

        <button
          onClick={onClearChat}
          className="text-slate-500 hover:text-red-600 transition-colors text-xs font-semibold flex items-center gap-1 border border-slate-200 hover:border-red-100 py-1.5 px-3 rounded-lg bg-white cursor-pointer select-none"
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear Workspace
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-4">
          <Bot className="h-10 w-10 mx-auto text-slate-400" />
          <div>
            <h3 className="text-sm font-bold text-slate-900">No transaction data available yet.</h3>
            <p className="text-xs text-slate-500 mt-1">Import statements before running financial analysis.</p>
          </div>
          <div className="flex justify-center gap-2">
            <button onClick={() => onNavigate('documents')} className="bg-slate-900 text-white rounded-lg px-4 py-2 text-xs font-bold">Import Statement</button>
            <button onClick={() => { if (confirm('Load sample demo data into this workspace?')) onLoadDemoData(); }} className="bg-white border border-slate-200 text-slate-700 rounded-lg px-4 py-2 text-xs font-bold">Load Demo Data</button>
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left: Chat history & workspace logs */}
        <div className="lg:col-span-3 flex flex-col h-[500px] border border-slate-200 rounded-xl bg-white shadow-xs overflow-hidden">
          
          {/* Chat scrolling log */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/50">
            {chatLog.map((msg) => {
              const isAi = msg.sender === 'assistant';

              return (
                <div 
                  key={msg.id} 
                  className={`flex gap-3 max-w-xl ${isAi ? 'mr-auto text-slate-800' : 'ml-auto flex-row-reverse text-slate-900'}`}
                >
                  <div className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center border font-semibold ${
                    isAi 
                      ? 'bg-slate-900 text-white border-slate-950' 
                      : 'bg-indigo-600 text-white border-indigo-700'
                  }`}>
                    {isAi ? <Bot className="h-4.5 w-4.5 text-slate-200" /> : 'U'}
                  </div>

                  <div className={`space-y-2 rounded-xl p-4 shadow-sm text-xs leading-relaxed ${
                    isAi 
                      ? 'bg-white border text-slate-800' 
                      : 'bg-indigo-50 border border-indigo-100 text-indigo-950'
                  }`}>
                    {/* Render message formatting Markdown styled */}
                    <div className="whitespace-pre-wrap font-sans font-medium text-[11.5px]">
                      {msg.text}
                    </div>

                    {renderVisualData(msg.visual_data)}

                    {isAi && (msg.calculated_total !== undefined || msg.matched_transactions || msg.sources) && (
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-3 text-[10px] text-slate-705 font-sans border-dashed">
                        {msg.calculated_total !== undefined && (
                          <div className="flex items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono">
                            <span className="text-[8.5px] uppercase font-bold text-slate-400 tracking-wider">Workspace aggregate total</span>
                            <span className="font-bold text-slate-900 text-[11px]">
                              ${msg.calculated_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              {msg.matched_transactions ? ` (${msg.matched_transactions.length} items parsed)` : ''}
                            </span>
                          </div>
                        )}

                        {/* Matching transactions micro table */}
                        {msg.matched_transactions && msg.matched_transactions.length > 0 && (
                          <div className="bg-white border text-slate-900 border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-slate-50 px-2 py-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest border-b">
                              Strict transaction rows parsed ({msg.matched_transactions.length})
                            </div>
                            <div className="max-h-28 overflow-y-auto divide-y divide-slate-100 font-mono text-[9px] text-slate-600 leading-none">
                              {msg.matched_transactions.slice(0, 10).map((tx, tIdx) => (
                                <div key={tIdx} className="p-1 px-2.5 flex justify-between hover:bg-slate-50 items-center">
                                  <div className="truncate max-w-[140px] text-slate-800 flex items-center gap-1">
                                    <span className="bg-slate-100 text-[8px] px-1 rounded text-slate-500 uppercase">{tx.transaction_type}</span>
                                    <strong className="truncate">{tx.clean_vendor_name}</strong>
                                  </div>
                                  <span className="text-slate-400 text-[8px]">{tx.transaction_date}</span>
                                  <span className="font-bold text-slate-900">${tx.amount.toFixed(2)}</span>
                                </div>
                              ))}
                              {msg.matched_transactions.length > 10 && (
                                <div className="text-center p-1.5 font-sans text-slate-400 text-[8px] italic">
                                  + {msg.matched_transactions.length - 10} more transactions verified locally
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Mapped source documents link lists */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[8.5px] font-mono text-slate-400 uppercase">
                            <span>Source records:</span>
                            {msg.sources.map((srcId, sIdx) => (
                              <span key={sIdx} className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold">
                                DOC-{srcId.substring(0, 6).toUpperCase()}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Save Report trigger button with local state */}
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setSavedReports(prev => ({ ...prev, [msg.id]: true }));
                            }}
                            disabled={savedReports[msg.id]}
                            className={`font-bold tracking-wider uppercase text-[8px] py-1.5 px-3 rounded-md cursor-pointer select-none transition-all ${
                              savedReports[msg.id] 
                                ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold flex items-center gap-1'
                                : 'bg-slate-900 hover:bg-slate-800 text-white'
                            }`}
                          >
                            {savedReports[msg.id] ? (
                              <>✓ Dynamic Report Compiled & Drafted</>
                            ) : (
                              <>Save Report draft to Compilation Packet</>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    <span className="block text-[9px] text-slate-400 font-mono text-right pt-1 select-none">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Form to message input */}
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputText);
            }}
            className="border-t border-slate-200 bg-white p-3 flex gap-2"
          >
            <input 
              type="text"
              placeholder="Ask a question about the general spending or transfer logs..."
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs text-slate-950 outline-hidden focus:border-indigo-400 font-sans font-medium"
            />
            <button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white p-2.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0"
              title="Submit query to LLM service"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

        </div>

        {/* Right: Quick prompts templates list */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selected Quick Prompts</h5>
            <p className="text-[11px] text-slate-500">Tap standard query sequences to trigger the AI analysis system quickly.</p>

            <div className="space-y-2">
              {quickPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p)}
                  className="w-full text-left p-3 border border-slate-200 hover:bg-slate-50 text-slate-700 hover:border-slate-350 transition-all rounded-lg text-xs leading-tight font-semibold cursor-pointer block"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-slate-950 text-slate-300 rounded-xl p-5 border border-slate-800 space-y-2 text-xs">
            <h6 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Model Specs Mode</h6>
            <p className="text-[10px] text-slate-400 font-medium">Standard NLP queries map key concepts dynamically:</p>
            <ul className="space-y-1 text-[10px] font-mono text-slate-300">
              <li className="flex gap-1"><CornerDownRight className="h-3.5 w-3.5 text-slate-500" /> "unilateral" &rarr; routing check</li>
              <li className="flex gap-1"><CornerDownRight className="h-3.5 w-3.5 text-slate-500" /> "childcare" &rarr; support checks</li>
              <li className="flex gap-1"><CornerDownRight className="h-3.5 w-3.5 text-slate-500" /> "spending" &rarr; spending chart</li>
            </ul>
          </div>
        </div>

      </div>
      )}

    </div>
  );
}
