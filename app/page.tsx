'use client';

import { useState, useRef, useEffect } from 'react';

interface Task {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string | null;
}

interface ActionPlan {
  goal: string;
  steps: string[];
  estimatedTime?: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tasks?: Task[];
  actionPlan?: ActionPlan;
  timestamp: Date;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: '👋 Hi! I\'m your Smart Daily Assistant. Tell me what you need to accomplish today, and I\'ll help you organize and prioritize your tasks!\n\nTry saying:\n• "I need to finish the project report, buy groceries, and call the doctor"\n• "Study for exam tomorrow, it\'s urgent"\n• "Plan my day: workout at 9am, meeting at 2pm, dinner at 7pm"',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId] = useState(() => `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input,
          userId: userId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process message');
      }

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.message,
        tasks: data.tasks,
        actionPlan: data.actionPlan,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please make sure the API key is configured correctly.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const getPriorityEmoji = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const examplePrompts = [
    "I need to finish the project report, buy groceries, and call the doctor",
    "Study for exam tomorrow, it's urgent",
    "Plan my day: workout at 9am, meeting at 2pm, dinner at 7pm",
  ];

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-md py-4 px-6 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              📋 Smart Daily Assistant
            </h1>
            <p className="text-gray-500 text-sm">AI-powered task organizer & action planner</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-gray-500">Online</span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white'
                    : 'bg-white text-gray-800'
                }`}
              >
                <div className="whitespace-pre-wrap text-sm md:text-base">
                  {msg.content}
                </div>
                
                {/* Display tasks */}
                    {msg.tasks && msg.tasks.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                          📌 Prioritized Tasks
                        </p>
                        <ul className="space-y-1.5">
                          {msg.tasks.map((task) => (
                            <li key={task.id} className="text-sm flex items-center gap-2">
                              <span className="text-lg">{getPriorityEmoji(task.priority)}</span>
                              <span className={msg.role === 'user' ? 'text-white' : 'text-gray-700'}>
                                {task.title}
                              </span>
                              {task.dueDate && (
                                <span className="text-xs opacity-75 ml-auto">
                                  ⏰ {task.dueDate}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                
                {/* Display action plan */}
                {msg.actionPlan && msg.actionPlan.steps.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm font-semibold mb-2 flex items-center gap-1">
                      🎯 Action Plan
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-sm">
                      {msg.actionPlan.steps.map((step, idx) => (
                        <li key={idx} className={msg.role === 'user' ? 'text-white' : 'text-gray-700'}>
                          {step}
                        </li>
                      ))}
                    </ol>
                    {msg.actionPlan.estimatedTime && (
                      <p className="text-xs mt-2 opacity-75">
                        ⏱️ Estimated: {msg.actionPlan.estimatedTime}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Quick Examples (only show when few messages) */}
      {messages.length <= 2 && (
        <div className="max-w-4xl mx-auto px-6 pb-2">
          <p className="text-xs text-gray-500 mb-2 text-center">✨ Try these examples:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {examplePrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => setInput(prompt)}
                className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 hover:bg-gray-50 transition text-gray-600"
              >
                {prompt.length > 40 ? prompt.substring(0, 40) + '...' : prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t shadow-lg p-4">
        <div className="max-w-4xl mx-auto flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="What do you need to do today? 🤔
            💡 Try: I need to finish my project report, buy groceries, and call the doctor
            💡 Or paste a whole paragraph from your email or notes!"
              className="flex-1 px-5 py-3 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[60px] max-h-[200px]"
              rows={2}
            />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full hover:from-blue-600 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
          >
            {isLoading ? '...' : 'Send →'}
          </button>
        </div>
      </div>
    </div>
  );
}