import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User, Check, RefreshCw, FileDiff } from 'lucide-react';
import { AppData } from '../types';
import { Button, TextArea } from './ui';
import * as diff from 'diff';

interface Props {
    data: AppData;
    onUpdateData: (newData: AppData) => void;
    isOpen: boolean;
    onClose: () => void;
}

interface Message {
    role: 'user' | 'ai';
    content: string;
    type?: 'text' | 'diff' | 'tool_call';
    diffData?: {
        original: string;
        modified: string;
        proposedData: AppData;
    };
}

export const AIChat: React.FC<Props> = ({ data, onUpdateData, isOpen, onClose }) => {
    const [messages, setMessages] = useState<Message[]>([
        { role: 'ai', content: "Hello! I'm your Sekai Board assistant. I can help you analyze your project, read the metadata, or suggest changes. Try asking me to 'optimize my workflow' or 'add a task'." }
    ]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg: Message = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);

        // Simulated AI Logic
        setTimeout(() => {
            let aiResponse: Message = { role: 'ai', content: "I'm not sure how to handle that yet." };
            const lowerInput = userMsg.content.toLowerCase();

            if (lowerInput.includes('read') || lowerInput.includes('summary') || lowerInput.includes('intro')) {
                aiResponse = {
                    role: 'ai',
                    content: `Here is the summary of the active project "**${data.projects.find(p => p.id === data.activeProjectId)?.name}**":\n\n${data.projects.find(p => p.id === data.activeProjectId)?.description || 'No description set.'}\n\nTasks count: ${Object.values(data.projects.find(p => p.id === data.activeProjectId)?.columns || {}).flat().length}`
                };
            } else if (lowerInput.includes('add') || lowerInput.includes('create') || lowerInput.includes('modify')) {
                // Simulate a tool call to modify data
                const activeProject = data.projects.find(p => p.id === data.activeProjectId);
                if (activeProject) {
                    const newData = JSON.parse(JSON.stringify(data)) as AppData;
                    const targetProj = newData.projects.find(p => p.id === activeProject.id);
                    if (targetProj) {
                        // Example modification: Add a task to backlog
                        targetProj.columns.backlog.push({
                            id: `ai-${Date.now()}`,
                            content: 'AI Generated Task: Review Analytics',
                            createdAt: Date.now(),
                            children: []
                        });
                    }

                    aiResponse = {
                        role: 'ai',
                        content: "I've drafted a change to add a new task. Please review the diff below.",
                        type: 'diff',
                        diffData: {
                            original: JSON.stringify(data, null, 2),
                            modified: JSON.stringify(newData, null, 2),
                            proposedData: newData
                        }
                    };
                }
            } else if (lowerInput.includes('optimize') || lowerInput.includes('suggestion')) {
                aiResponse = {
                    role: 'ai',
                    content: "I noticed your 'In Progress' column has a limit of " + (data.projects.find(p => p.id === data.activeProjectId)?.wipLimit || 3) + ". Consider reducing it to focus on finishing tasks before starting new ones."
                };
            }

            setIsTyping(false);
            setMessages(prev => [...prev, aiResponse]);
        }, 1500);
    };

    const handleApplyDiff = (modifiedData: AppData) => {
        onUpdateData(modifiedData);
        setMessages(prev => [...prev, { role: 'ai', content: "Changes applied successfully! ✅" }]);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white dark:bg-zinc-900 rounded-xl shadow-2xl border border-gray-200 dark:border-zinc-800 flex flex-col z-50 animate-in slide-in-from-bottom-4 duration-300">
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-100 dark:border-zinc-800 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-t-xl text-white">
                <div className="flex items-center gap-2">
                    <Sparkles size={18} />
                    <h3 className="font-semibold">AI Assistant</h3>
                </div>
                <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-md transition-colors">
                    <X size={18} />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-zinc-950/50">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'ai' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'bg-gray-200 dark:bg-zinc-700'}`}>
                            {msg.role === 'ai' ? <Bot size={16} /> : <User size={16} />}
                        </div>
                        <div className={`max-w-[80%] space-y-2`}>
                            <div className={`p-3 rounded-lg text-sm leading-relaxed ${msg.role === 'ai'
                                ? 'bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm'
                                : 'bg-indigo-600 text-white shadow-sm'
                                }`}>
                                {msg.content}
                            </div>

                            {/* Diff Viewer */}
                            {msg.type === 'diff' && msg.diffData && (
                                <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden text-xs font-mono shadow-sm">
                                    <div className="p-2 bg-gray-50 dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 flex items-center gap-2">
                                        <FileDiff size={14} /> <span>Proposed Changes</span>
                                    </div>
                                    <div className="max-h-40 overflow-auto p-2">
                                        {/* Simple text diff representation for now */}
                                        <div className="text-green-600 dark:text-green-400">+ Modified Data Object Prepared</div>
                                        <div className="text-gray-400 mt-1 italic">Full diff visualization requires complex parsing.</div>
                                    </div>
                                    <div className="p-2 bg-gray-50 dark:bg-zinc-800 border-t border-gray-200 dark:border-zinc-700 flex justify-end gap-2">
                                        <Button variant="ghost" className="h-7 text-xs px-2" onClick={() => { }}>Dismiss</Button>
                                        <Button className="h-7 text-xs px-2 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => handleApplyDiff(msg.diffData!.proposedData)}>
                                            Apply Changes
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isTyping && (
                    <div className="flex gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                            <Bot size={16} className="text-indigo-600" />
                        </div>
                        <div className="flex items-center gap-1 h-8">
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800">
                <div className="flex gap-2 relative">
                    <TextArea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                            }
                        }}
                        placeholder="Ask AI to modify your board..."
                        className="pr-10 max-h-32 resize-none"
                        rows={1}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="absolute right-2 bottom-2 p-1.5 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-md hover:opacity-90 disabled:opacity-50 transition-all"
                    >
                        <Send size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};
