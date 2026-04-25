export interface Task {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  dueDate?: string | null;
  completed: boolean;
  estimatedMinutes?: number;
}

export interface ActionPlan {
  goal: string;
  steps: string[];
  prioritizedTasks: Task[];
  estimatedTime?: string;
}

export interface GoalAnalysis {
  goal: string;
  missingInfo: string[];
  followUpQuestion: string | null;
  confidence: number;
}

export interface AgentResponse {
  message: string;
  actionPlan?: ActionPlan;
  tasks?: Task[];
  needsClarification: boolean;
  followUpQuestion?: string;
  missingInfo?: string[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface UserContext {
  userId: string;
  conversationHistory: ConversationMessage[];
  savedTasks: Task[];
  preferences?: {
    defaultPriority?: 'high' | 'medium' | 'low';
    timezone?: string;
  };
}