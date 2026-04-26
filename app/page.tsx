'use client';

import { useState, useRef, useEffect } from 'react';

interface Task {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string | null;
  completed?: boolean;
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
      content: 'Hello! I\'m your Smart Daily Assistant.\n\nTell me what you need to accomplish today, and I\'ll help you organize and prioritize your tasks.\n\nTry saying:\n- I need to finish the project report, buy groceries, and call the doctor\n- Study for exam tomorrow, it\'s urgent\n- Plan my day: workout at 9am, meeting at 2pm, dinner at 7pm',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [userId] = useState(() => `web-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
    }
  }, [input]);

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

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

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
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
      textareaRef.current?.focus();
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case 'high': 
        return { label: 'High Priority', bgColor: 'bg-red-500', textColor: 'text-white', borderColor: 'border-red-500' };
      case 'medium': 
        return { label: 'Medium Priority', bgColor: 'bg-yellow-500', textColor: 'text-white', borderColor: 'border-yellow-500' };
      case 'low': 
        return { label: 'Low Priority', bgColor: 'bg-green-500', textColor: 'text-white', borderColor: 'border-green-500' };
      default: 
        return { label: 'Priority', bgColor: 'bg-gray-500', textColor: 'text-white', borderColor: 'border-gray-500' };
    }
  };

  const toggleTaskComplete = (messageId: string, taskId: string) => {
    setMessages(prev => prev.map(msg => {
      if (msg.id === messageId && msg.tasks) {
        return {
          ...msg,
          tasks: msg.tasks.map(task => 
            task.id === taskId ? { ...task, completed: !task.completed } : task
          )
        };
      }
      return msg;
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: 'Hello! I\'m your Smart Daily Assistant.\n\nTell me what you need to accomplish today, and I\'ll help you organize and prioritize your tasks.\n\nTry saying:\n- I need to finish the project report, buy groceries, and call the doctor\n- Study for exam tomorrow, it\'s urgent\n- Plan my day: workout at 9am, meeting at 2pm, dinner at 7pm',
        timestamp: new Date(),
      },
    ]);
  };

  const examplePrompts = [
    "I need to finish the project report, buy groceries, and call the doctor",
    "Study for exam tomorrow, it's urgent",
    "Plan my day: workout at 9am, meeting at 2pm, dinner at 7pm",
  ];

  // Function to format message with bold headers
  const formatMessageContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      // Make headers bold
      if (line.startsWith('Goal:')) {
        return <div key={idx} className="font-bold text-lg mt-2 mb-1">{line}</div>;
      }
      if (line.startsWith('Tasks to complete:')) {
        return <div key={idx} className="font-bold text-md mt-3 mb-2">{line}</div>;
      }
      if (line.startsWith('Priority:')) {
        return <div key={idx} className="font-bold text-md mt-3 mb-2">{line}</div>;
      }
      if (line.startsWith('Action Plan:')) {
        return <div key={idx} className="font-bold text-md mt-3 mb-2">{line}</div>;
      }
      if (line.startsWith('Pro Tip:')) {
        return <div key={idx} className="italic text-gray-600 mt-2 pt-2 border-t border-gray-200">{line}</div>;
      }
      if (line.match(/^\d+\./)) {
        return <div key={idx} className="ml-4 mb-1">{line}</div>;
      }
      if (line.match(/^[-•]/)) {
        return <div key={idx} className="ml-4 mb-1">{line}</div>;
      }
      if (line.trim() === '') {
        return <div key={idx} className="h-2"></div>;
      }
      return <div key={idx} className="mb-1">{line}</div>;
    });
  };

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header - Clean without time */}
      <header className="bg-white border-b shadow-sm py-4 px-6 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              Smart Daily Assistant
            </h1>
            <p className="text-gray-500 text-sm">AI-powered task organizer</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={clearChat}
              className="text-gray-400 hover:text-gray-600 transition text-sm"
            >
              Clear chat
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-500">Online</span>
            </div>
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
                className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-white text-gray-800 border border-gray-200'
                }`}
              >
                {/* Message content with formatted bold headers */}
                <div className="whitespace-pre-wrap text-sm md:text-base leading-relaxed">
                  {formatMessageContent(msg.content)}
                </div>
                
                {/* Tasks with priority pills - Color coded */}
                {msg.role === 'assistant' && msg.tasks && msg.tasks.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="font-bold text-md mb-3 text-gray-700">Tasks</div>
                    <div className="space-y-2">
                      {msg.tasks.map((task) => {
                        const priorityStyle = getPriorityStyle(task.priority);
                        return (
                          <div
                            key={task.id}
                            className={`flex items-center gap-3 p-2 rounded-lg border ${
                              task.completed ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                            }`}
                          >
                            <button
                              onClick={() => toggleTaskComplete(msg.id, task.id)}
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                task.completed 
                                  ? 'bg-green-500 border-green-500' 
                                  : 'border-gray-300 hover:border-green-400'
                              }`}
                            >
                              {task.completed && (
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            <div className="flex-1">
                              <p className={`text-sm font-medium ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                {task.title}
                              </p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${priorityStyle.bgColor} ${priorityStyle.textColor}`}>
                              {priorityStyle.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Action Plan - Big bold Goal */}
                {msg.role === 'assistant' && msg.actionPlan && msg.actionPlan.steps && msg.actionPlan.steps.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <div className="font-bold text-md mb-2 text-gray-700">Action Plan</div>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <div className="font-bold text-md mb-2 text-blue-800">
                        Goal: {msg.actionPlan.goal}
                      </div>
                      <ol className="list-decimal list-inside space-y-1 text-sm ml-2">
                        {msg.actionPlan.steps.map((step, idx) => (
                          <li key={idx} className="text-gray-700 mb-1">
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
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

      {/* Quick Examples */}
      {messages.length <= 2 && (
        <div className="max-w-4xl mx-auto px-6 pb-2">
          <p className="text-xs text-gray-500 mb-2 text-center">Try these examples:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {examplePrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => setInput(prompt)}
                className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 hover:bg-gray-50 transition-all duration-200 text-gray-600"
              >
                {prompt.length > 45 ? prompt.substring(0, 45) + '...' : prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-white border-t shadow-lg p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="What do you need to do today?"
                className="w-full px-5 py-3 pr-20 border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-hidden min-h-[60px] max-h-[200px] text-gray-700"
                rows={1}
                disabled={isLoading}
              />
            </div>
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="px-6 py-3 bg-blue-500 text-white rounded-2xl hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium h-fit"
            >
              {isLoading ? '...' : 'Send'}
            </button>
          </div>
          <div className="flex justify-between items-center mt-2 px-2">
            <p className="text-xs text-gray-400">
              Shift + Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}