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

  private async analyzeGoal(message: string): Promise<GoalAnalysis> {
    const prompt = GOAL_ANALYSIS_PROMPT.replace('{{message}}', message);
    
    try {
      const response = await this.callGemini(prompt);
      // Clean response - remove markdown code blocks if present
      const cleanResponse = response.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      return JSON.parse(cleanResponse);
    } catch (error) {
      console.error('Goal analysis failed:', error);
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
      console.error('Task extraction failed:', error);
      return [];
    }
  }

  private prioritizeTasks(tasks: Task[]): Task[] {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return [...tasks].sort((a, b) => {
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      
      // If same priority, tasks with due dates come first
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
      console.error('Action plan creation failed:', error);
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
      console.error('Response generation failed:', error);
      return this.getFallbackResponse(tasks);
    }
  }

  private getFallbackResponse(tasks: Task[]): string {
    if (tasks.length === 0) {
      return "I'm here to help you organize your day! Could you tell me what tasks you need to accomplish?";
    }
    
    const taskList = tasks.map(t => {
      const emoji = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
      return `${emoji} ${t.title}`;
    }).join('\n');
    
    return `📋 Here's what I understand you need to do:\n\n${taskList}\n\nWould you like me to help prioritize these or create an action plan?`;
  }

  async processMessage(
    message: string, 
    userId: string = 'default',
    conversationHistory?: ConversationMessage[]
  ): Promise<AgentResponse> {
    // Update context
    const context = this.getUserContext(userId);
    if (conversationHistory) {
      context.conversationHistory = conversationHistory;
    }
    context.conversationHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    // Phase 1: Analyze goal
    const goalAnalysis = await this.analyzeGoal(message);
    
    // Phase 2: Check if clarification needed
    if (goalAnalysis.missingInfo.length > 0 && goalAnalysis.confidence < 0.7) {
      const response: AgentResponse = {
        message: this.getClarificationMessage(goalAnalysis.missingInfo, goalAnalysis.followUpQuestion),
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
    
    // Phase 3: Extract tasks
    let tasks = await this.extractTasks(message);
    
    // Phase 4: If no tasks extracted, try a different approach
    if (tasks.length === 0) {
      // Try to infer task from goal
      tasks = [{
        id: `task-${Date.now()}`,
        title: goalAnalysis.goal,
        priority: 'medium',
        completed: false,
      }];
    }
    
    // Phase 5: Prioritize tasks
    const prioritizedTasks = this.prioritizeTasks(tasks);
    
    // Phase 6: Create action plan
    const actionPlan = await this.createActionPlan(goalAnalysis.goal, prioritizedTasks);
    
    // Phase 7: Generate response
    const responseMessage = await this.generateResponse(message, actionPlan, prioritizedTasks);
    
    // Save tasks to context
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

  private getClarificationMessage(missingInfo: string[], followUpQuestion: string | null): string {
    if (followUpQuestion) {
      return `🤔 ${followUpQuestion}`;
    }
    
    if (missingInfo.includes('deadline') || missingInfo.includes('due date')) {
      return "📅 When do you need to complete these tasks? Knowing the deadline helps me prioritize better.";
    }
    
    if (missingInfo.includes('priority')) {
      return "⚡ Which of these tasks is most urgent? Let me know so I can help you prioritize.";
    }
    
    if (missingInfo.includes('specifics')) {
      return "Could you provide a bit more detail about what you'd like to accomplish? The more specific you are, the better I can help!";
    }
    
    return "I want to help you effectively! Could you tell me more about what you're trying to achieve today?";
  }

  async clearConversation(userId: string): Promise<void> {
    this.userContexts.delete(userId);
  }

  getUserTasks(userId: string): Task[] {
    const context = this.getUserContext(userId);
    return context.savedTasks.filter(t => !t.completed);
  }

  async markTaskComplete(userId: string, taskId: string): Promise<boolean> {
    const context = this.getUserContext(userId);
    const task = context.savedTasks.find(t => t.id === taskId);
    if (task) {
      task.completed = true;
      return true;
    }
    return false;
  }
}

// Singleton instance for reuse across API routes
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