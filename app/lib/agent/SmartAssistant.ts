import { GoogleGenerativeAI } from '@google/generative-ai';
import { 
  Task, 
  ActionPlan, 
  GoalAnalysis, 
  AgentResponse,
  ConversationMessage,
  UserContext 
} from './types';
import {
  SYSTEM_PROMPT,
  GOAL_ANALYSIS_PROMPT,
  TASK_EXTRACTION_PROMPT,
  ACTION_PLAN_PROMPT,
  RESPONSE_GENERATION_PROMPT
} from './prompts';

export class SmartAssistant {
  private gemini: GoogleGenerativeAI;
  private model: any;
  private userContexts: Map<string, UserContext> = new Map();

  constructor(apiKey: string) {
    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      throw new Error('Valid GEMINI_API_KEY is required');
    }
    this.gemini = new GoogleGenerativeAI(apiKey);
    this.model = this.gemini.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        topP: 0.9,
      }
    });
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

  private async callGemini(prompt: string, systemPrompt?: string): Promise<string> {
    const fullPrompt = systemPrompt 
      ? `${systemPrompt}\n\n${prompt}`
      : prompt;
    
    const result = await this.model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  }

  private isGreeting(message: string): boolean {
    const greetings = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
    const lowerMessage = message.toLowerCase().trim();
    const words = lowerMessage.split(/\s+/);
    if (words.length <= 3) {
      return greetings.some(greeting => lowerMessage.includes(greeting));
    }
    return false;
  }

  private getGreetingResponse(): string {
    return "Hello! I'm your Smart Daily Assistant.\n\nReady to get organized? Tell me what you need to accomplish today, and I'll help you extract tasks, prioritize them, and create an action plan.\n\nTry saying: 'I need to finish a report, buy groceries, and call the doctor'";
  }

  private async analyzeGoal(message: string): Promise<GoalAnalysis> {
    const prompt = GOAL_ANALYSIS_PROMPT.replace('{{message}}', message);
    
    try {
      const response = await this.callGemini(prompt);
      const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      return JSON.parse(cleanResponse);
    } catch (error) {
      return {
        goal: message,
        missingInfo: [],
        followUpQuestion: null,
        confidence: 0.5,
      };
    }
  }

  private async extractTasks(message: string): Promise<Task[]> {
    const prompt = TASK_EXTRACTION_PROMPT.replace('{{message}}', message);
    
    try {
      const response = await this.callGemini(prompt);
      const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const tasks = JSON.parse(cleanResponse);
      
      return tasks.map((t: any, i: number) => ({
        id: `task-${Date.now()}-${i}`,
        title: t.title,
        priority: t.priority || 'medium',
        dueDate: t.dueDate,
        completed: false,
        estimatedMinutes: t.estimatedMinutes,
      }));
    } catch (error) {
      return [];
    }
  }

  private prioritizeTasks(tasks: Task[]): Task[] {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return [...tasks].sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return 0;
    });
  }

  private async createActionPlan(goal: string, tasks: Task[]): Promise<ActionPlan> {
    const tasksSummary = tasks.map(t => `${t.title} (${t.priority} priority)`).join(', ');
    const prompt = ACTION_PLAN_PROMPT
      .replace('{{goal}}', goal)
      .replace('{{tasks}}', tasksSummary);
    
    try {
      const response = await this.callGemini(prompt);
      const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      const plan = JSON.parse(cleanResponse);
      
      return {
        ...plan,
        prioritizedTasks: tasks,
      };
    } catch (error) {
      return {
        goal: goal,
        steps: ['Review your tasks', 'Prioritize what matters most', 'Take action'],
        prioritizedTasks: tasks,
      };
    }
  }

  private async generateResponse(message: string, actionPlan: ActionPlan | null, tasks: Task[]): Promise<string> {
    const planStr = actionPlan ? JSON.stringify({
      goal: actionPlan.goal,
      steps: actionPlan.steps,
      estimatedTime: actionPlan.estimatedTime,
    }) : 'null';
    
    const prompt = RESPONSE_GENERATION_PROMPT
      .replace('{{message}}', message)
      .replace('{{actionPlan}}', planStr);
    
    try {
      const response = await this.callGemini(prompt, SYSTEM_PROMPT);
      return response;
    } catch (error) {
      if (tasks.length === 0) {
        return "I'm here to help you organize your day. Could you tell me what tasks you need to accomplish?";
      }
      
      const taskList = tasks.map(t => {
        const priorityText = t.priority === 'high' ? '[High]' : t.priority === 'medium' ? '[Medium]' : '[Low]';
        return `${priorityText} ${t.title}`;
      }).join('\n');
      
      return `I understand you need to complete these tasks:\n\n${taskList}\n\nWould you like me to help prioritize them or create an action plan?`;
    }
  }

  async processMessage(
    message: string, 
    userId: string = 'default',
    conversationHistory?: ConversationMessage[]
  ): Promise<AgentResponse> {
    if (this.isGreeting(message)) {
      return {
        message: this.getGreetingResponse(),
        needsClarification: false,
        tasks: [],
      };
    }
    
    const context = this.getUserContext(userId);
    if (conversationHistory) {
      context.conversationHistory = conversationHistory;
    }
    context.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    const goalAnalysis = await this.analyzeGoal(message);
    
    if (goalAnalysis.missingInfo.length > 0 && goalAnalysis.confidence < 0.7) {
      const responseMessage = await this.generateResponse(message, null, []);
      
      const response: AgentResponse = {
        message: responseMessage,
        needsClarification: true,
        followUpQuestion: goalAnalysis.followUpQuestion || undefined,
        missingInfo: goalAnalysis.missingInfo,
      };
      
      context.conversationHistory.push({
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
      });
      
      return response;
    }
    
    let tasks = await this.extractTasks(message);
    
    if (tasks.length === 0) {
      tasks = [{
        id: `task-${Date.now()}`,
        title: goalAnalysis.goal,
        priority: 'medium',
        completed: false,
      }];
    }
    
    const prioritizedTasks = this.prioritizeTasks(tasks);
    const actionPlan = await this.createActionPlan(goalAnalysis.goal, prioritizedTasks);
    const responseMessage = await this.generateResponse(message, actionPlan, prioritizedTasks);
    
    context.savedTasks.push(...prioritizedTasks);
    context.conversationHistory.push({
      role: 'assistant',
      content: responseMessage,
      timestamp: new Date(),
    });
    
    return {
      message: responseMessage,
      actionPlan,
      tasks: prioritizedTasks,
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
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    assistantInstance = new SmartAssistant(key);
  }
  return assistantInstance;
}