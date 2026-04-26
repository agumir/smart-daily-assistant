// lib/agent/SmartAssistant.ts - COMPLETE FIXED VERSION

import { Task, ActionPlan, AgentResponse, UserContext, ConversationMessage } from './types';

export class SmartAssistant {
  private userContexts: Map<string, UserContext> = new Map();

  constructor(apiKey: string) {
    // API key kept for compatibility but not actively used
    console.log('SmartAssistant initialized (clean manual mode)');
  }

  private getUserContext(userId: string): UserContext {
    if (!this.userContexts.has(userId)) {
      this.userContexts.set(userId, {
        userId,
        conversationHistory: [],
        savedTasks: [],
      });
    }
    return this.userContexts.get(userId)!;
  }

  private isGreeting(message: string): boolean {
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
    const lowerMessage = message.toLowerCase().trim();
    const words = lowerMessage.split(/\s+/);
    if (words.length <= 2) {
      return greetings.some(greeting => lowerMessage.includes(greeting));
    }
    return false;
  }

  private getGreetingResponse(): string {
    return "Hello! I'm your Smart Daily Assistant.\n\nTell me what you need to accomplish today, and I'll help you extract tasks, prioritize them, and create an action plan.\n\nTry saying: 'I need to finish a report, buy groceries, and call the doctor'";
  }

  // Manual task splitting - NO AI, NO old format
  private splitTasksManually(message: string): string[] {
    // Don't split short responses
    if (message.toLowerCase() === 'yes' || message.toLowerCase() === 'no' || message.toLowerCase() === 'ok' || message.length < 5) {
      return [];
    }
    
    let tasks: string[] = [];
    
    // Split by commas, "and", "&"
    const parts = message.split(/[,，]|\s+and\s+|\s*&\s*/i);
    
    for (let part of parts) {
      let cleaned = part.trim();
      // Remove common prefixes
      cleaned = cleaned.replace(/^(i need to|i have to|please|remember to|to)\s+/i, '');
      cleaned = cleaned.replace(/^my tasks?:?\s*/i, '');
      cleaned = cleaned.replace(/^[•\-*]\s*/, '');
      cleaned = cleaned.replace(/^plan my day:\s*/i, '');
      
      if (cleaned.length > 0 && cleaned.length < 100 && cleaned.length < message.length * 0.8) {
        tasks.push(cleaned.charAt(0).toUpperCase() + cleaned.slice(1));
      }
    }
    
    // Remove duplicates
    tasks = [...new Set(tasks)];
    
    // If we got multiple tasks, return them
    if (tasks.length >= 2) {
      return tasks;
    }
    
    // If only one task but it's reasonably sized
    if (tasks.length === 1 && tasks[0].length > 3) {
      return tasks;
    }
    
    return [];
  }

  async processMessage(
    message: string, 
    userId: string = 'default',
    conversationHistory?: ConversationMessage[]
  ): Promise<AgentResponse> {
    // Handle greetings
    if (this.isGreeting(message)) {
      return {
        message: this.getGreetingResponse(),
        needsClarification: false,
        tasks: [],
      };
    }
    
    // Handle short responses like "yes"
    if (message.toLowerCase() === 'yes' || message.toLowerCase() === 'no' || message.toLowerCase() === 'ok' || message.length < 3) {
      return {
        message: "Just send me your tasks and I'll help organize them. For example: 'I need to finish a report, buy groceries, and call the doctor'",
        needsClarification: false,
        tasks: [],
      };
    }
    
    // Try to split tasks manually
    const manualTasks = this.splitTasksManually(message);
    
    let tasks: Task[] = [];
    
    if (manualTasks.length >= 1) {
      // Use manually split tasks
      tasks = manualTasks.map((title, i) => ({
        id: `task-${Date.now()}-${i}`,
        title: title,
        priority: i === 0 ? 'high' : i === 1 ? 'medium' : 'low',
        completed: false,
      }));
    } else {
      // Use original message as single task
      let cleaned = message.trim();
      cleaned = cleaned.replace(/^(i need to|i have to|please|remember to|to)\s+/i, '');
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      
      tasks = [{
        id: `task-${Date.now()}`,
        title: cleaned,
        priority: 'medium',
        completed: false,
      }];
    }
    
    // Prioritize tasks
    const prioritizedTasks = [...tasks].sort((a, b) => {
      const order = { high: 3, medium: 2, low: 1 };
      return order[b.priority] - order[a.priority];
    });
    
    // Build clean response message - NO "Medium" prefix, NO "I understand"
    let responseMessage = '';
    responseMessage += `Goal: Complete your ${tasks.length} pending tasks\n\n`;
    responseMessage += `Tasks to complete:\n`;
    tasks.forEach((task, i) => {
      const priorityLabel = task.priority === 'high' ? 'High Priority' : task.priority === 'medium' ? 'Medium Priority' : 'Low Priority';
      responseMessage += `${i + 1}. ${task.title} [${priorityLabel}]\n`;
    });
    responseMessage += `\nPriority:\n`;
    responseMessage += `- High: ${tasks[0].title} - Urgent, do this first\n`;
    if (tasks[1]) responseMessage += `- Medium: ${tasks[1].title} - Important, schedule soon\n`;
    if (tasks[2]) responseMessage += `- Low: ${tasks[2].title} - Flexible, no rush\n`;
    responseMessage += `\nAction Plan:\n`;
    responseMessage += `- Today: ${tasks[0].title}\n`;
    if (tasks[1]) responseMessage += `- Tomorrow: ${tasks[1].title}\n`;
    if (tasks[2]) responseMessage += `- Later: ${tasks[2].title}\n`;
    responseMessage += `\nPro Tip: Start with "${tasks[0].title}" first thing.\n\n`;
    responseMessage += `You've got this!`;
    
    // Save to context
    const context = this.getUserContext(userId);
    if (conversationHistory) {
      context.conversationHistory = conversationHistory;
    }
    context.savedTasks.push(...prioritizedTasks);
    context.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });
    context.conversationHistory.push({
      role: 'assistant',
      content: responseMessage,
      timestamp: new Date(),
    });
    
    return {
      message: responseMessage,
      tasks: prioritizedTasks,
      actionPlan: {
        goal: `Complete ${tasks.length} tasks`,
        steps: tasks.map(t => t.title),
        prioritizedTasks: prioritizedTasks,
      },
      needsClarification: false,
    };
  }

  async clearConversation(userId: string): Promise<void> {
    this.userContexts.delete(userId);
  }

  getUserTasks(userId: string): Task[] {
    const context = this.getUserContext(userId);
    return context.savedTasks.filter(t => !t.completed);
  }

  async markTaskComplete(userId: string, taskId: string): Promise<{ success: boolean; message: string }> {
    const context = this.getUserContext(userId);
    const task = context.savedTasks.find(t => t.id === taskId);
    
    if (task && !task.completed) {
      task.completed = true;
      const remainingCount = context.savedTasks.filter(t => !t.completed).length;
      
      let celebrationMsg = `Good job completing "${task.title}"! `;
      
      if (remainingCount === 0) {
        celebrationMsg += `You've completed all your tasks. Take a moment to celebrate before moving on.`;
      } else {
        celebrationMsg += `${remainingCount} task${remainingCount > 1 ? 's' : ''} remaining. Keep going!`;
      }
      
      return { success: true, message: celebrationMsg };
    }
    
    return { success: false, message: "Task not found or already completed" };
  }
}

let assistantInstance: SmartAssistant | null = null;

export function getAssistant(apiKey?: string): SmartAssistant {
  if (!assistantInstance) {
    assistantInstance = new SmartAssistant(apiKey || '');
  }
  return assistantInstance;
}
