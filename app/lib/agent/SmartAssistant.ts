// lib/agent/SmartAssistant.ts

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

  private detectQuickWins(tasks: Task[]): Task | null {
    const quickKeywords = ['call', 'email', 'text', 'reply', 'pay', 'order', 'buy', 'water', 'remind'];
    
    return tasks.find(t => 
      quickKeywords.some(keyword => 
        t.title.toLowerCase().includes(keyword)
      ) || (t.estimatedMinutes && t.estimatedMinutes <= 10)
    ) || null;
  }

  private hasOverdueTasks(tasks: Task[]): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return tasks.some(t => 
      t.dueDate && new Date(t.dueDate) < today
    );
  }

  private getEncouragementMessage(): string {
    const encouragements = [
      "You've got this! 💪",
      "Making progress every day! ✨",
      "Small steps lead to big results! 🌟",
      "Proud of you for staying organized! 🎉",
      "One task at a time — you're crushing it! 🔥",
      "Today is your day to win! 🌈",
      "Keep the momentum going! ⚡",
      "You're doing amazing! 🌟"
    ];
    return encouragements[Math.floor(Math.random() * encouragements.length)];
  }

  private async generateResponse(
    message: string, 
    actionPlan: ActionPlan | null, 
    tasks: Task[],
    missingInfo?: string[]
  ): Promise<string> {
    const quickWin = this.detectQuickWins(tasks);
    const hasOverdue = this.hasOverdueTasks(tasks);
    
    const prompt = `
      User message: "${message}"
      Tasks: ${JSON.stringify(tasks)}
      Missing info: ${JSON.stringify(missingInfo || [])}
      Has overdue tasks: ${hasOverdue}
      Quick win task: ${quickWin ? quickWin.title : 'none'}
      
      Follow this EXACT format with warmth and encouragement:
      
      🎯 **Goal:**
      [Clear statement]
      
      🧩 **Let's break this down:**
      [Step-by-step with estimated times]
      
      ⚡ **Priority lineup:**
      - 🔴 High: [tasks] — *urgent reason*
      - 🟡 Medium: [tasks] — *when to schedule*
      - 🟢 Low: [tasks] — *flexible*
      
      📅 **Your action plan:**
      - ☀️ Today: [max 3-5 tasks]
      - 🌙 Next: [tomorrow/this week]
      - 🗓️ Later: [future tasks]
      - ✨ Quick win: [fastest task, if exists]
      
      💪 **Pro tip:**
      [One specific, actionable suggestion]
      
      ${missingInfo && missingInfo.length > 0 ? '❓ **One quick question:**\n[Single specific question]' : ''}
      
      ${!missingInfo || missingInfo.length === 0 ? `Keep crushing it! ${this.getEncouragementMessage()}` : ''}
      
      Use 3-4 emojis max. Be warm but focused. Never skip sections.
    `;
    
    try {
      const response = await this.callGemini(prompt, SYSTEM_PROMPT);
      return response;
    } catch (error) {
      console.error('Response generation failed:', error);
      return this.getSweetFallbackResponse(tasks, quickWin);
    }
  }

  private getSweetFallbackResponse(tasks: Task[], quickWin: Task | null): string {
    if (tasks.length === 0) {
      return `✨ Hi there! I'd love to help you organize your day.

🎯 **Goal:** Create your personalized task plan

💪 **Pro tip:** Try telling me something like:
• "I need to finish a report, buy groceries, and call my mom"
• "Study for exam tomorrow, it's urgent"

❓ **One quick question:** What's the most important thing on your mind today?`;
    }
    
    const taskList = tasks.map(t => {
      const emoji = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟡' : '🟢';
      return `${emoji} ${t.title}`;
    }).join('\n');
    
    const quickWinSection = quickWin ? `\n\n✨ **Quick win:** ${quickWin.title} (takes ~10 min!)` : '';
    
    return `🎯 **Goal:** Complete your pending tasks

🧩 **Let's break this down:**
${taskList}

📅 **Your action plan:**
- ☀️ Today: Start with the highest priority task
${quickWinSection}

💪 **Pro tip:** Break large tasks into 25-minute focused chunks (Pomodoro style!)

Would you like me to create a detailed action plan? 💪`;
  }

  async processMessage(
    message: string, 
    userId: string = 'default',
    conversationHistory?: ConversationMessage[]
  ): Promise<AgentResponse> {
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
      const responseMessage = await this.generateResponse(
        message, 
        null, 
        [], 
        goalAnalysis.missingInfo
      );
      
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
    
    // Phase 3: Extract tasks
    let tasks = await this.extractTasks(message);
    
    // Phase 4: If no tasks extracted, infer from goal
    if (tasks.length === 0) {
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
      
      let celebrationMsg = `🎉 Great job completing "${task.title}"! `;
      
      if (remainingCount === 0) {
        celebrationMsg += `You've crushed ALL your tasks today! 🏆 Take a moment to celebrate! ✨`;
      } else {
        celebrationMsg += `${remainingCount} task${remainingCount > 1 ? 's' : ''} remaining. ${this.getEncouragementMessage()}`;
      }
      
      return { success: true, message: celebrationMsg };
    }
    
    return { success: false, message: "Task not found or already completed" };
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