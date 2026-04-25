import { getAssistant } from '../agent/SmartAssistant';

const TELEGRAM_API_URL = `https://api.telegram.org/bot`;

export interface TelegramMessage {
  message_id: number;
  from: {
    id: number;
    first_name: string;
    username?: string;
  };
  chat: {
    id: number;
    type: string;
    first_name?: string;
    username?: string;
  };
  text?: string;
  date: number;
}

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

export async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string
): Promise<boolean> {
  try {
    const url = `${TELEGRAM_API_URL}${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    
    const data = await response.json();
    return data.ok === true;
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return false;
  }
}

export async function sendTypingAction(botToken: string, chatId: number): Promise<void> {
  try {
    const url = `${TELEGRAM_API_URL}${botToken}/sendChatAction`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        action: 'typing',
      }),
    });
  } catch (error) {
    // Silently fail - typing indicator is not critical
  }
}

export function formatTelegramResponse(response: {
  message: string;
  tasks?: Task[];
  actionPlan?: ActionPlan;
}): string {
  let formatted = response.message;
  
  if (response.tasks && response.tasks.length > 0) {
    formatted += '\n\n📌 *Tasks:*\n';
    response.tasks.forEach((task: Task, idx: number) => {  // ✅ Added types: task: Task, idx: number
      const emoji = task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢';
      formatted += `${emoji} ${task.title}\n`;
      if (task.dueDate) {
        formatted += `   ⏰ Due: ${task.dueDate}\n`;
      }
    });
  }
  
  if (response.actionPlan && response.actionPlan.steps?.length > 0) {
    formatted += '\n🎯 *Action Plan:*\n';
    response.actionPlan.steps.forEach((step: string, idx: number) => {  // ✅ Added types: step: string, idx: number
      formatted += `${idx + 1}. ${step}\n`;
    });
    if (response.actionPlan.estimatedTime) {
      formatted += `\n⏱️ Estimated: ${response.actionPlan.estimatedTime}`;
    }
  }
  
  return formatted;
}

export function getWelcomeMessage(): string {
  return `👋 *Welcome to Smart Daily Assistant!*

I'm your AI-powered task organizer. Here's what I can help you with:

✅ Extract tasks from your messages
✅ Prioritize what matters most
✅ Create simple action plans
✅ Ask clarifying questions

*Try these examples:*

📝 "I need to finish the project report, buy groceries, and call the doctor"

⏰ "Study for exam tomorrow, finish homework by Friday"

🎯 "Plan my day: workout, meeting at 2pm, dinner with friends at 7pm"

Just send me your tasks, and I'll help you get organized! 🚀`;
}