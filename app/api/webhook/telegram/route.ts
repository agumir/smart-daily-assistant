import { NextRequest, NextResponse } from 'next/server';
import { 
  TelegramMessage, 
  sendTelegramMessage, 
  sendTypingAction,
  formatTelegramResponse,
  getWelcomeMessage,
  Task 
} from '../../../lib/telegram/bot';
import { getAssistant } from '../../../lib/agent/SmartAssistant';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Handle different update types
    if (body.message) {
      const message = body.message as TelegramMessage;
      const chatId = message.chat.id;
      const userText = message.text;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      
      if (!botToken || botToken === 'your_telegram_bot_token_here') {
        console.error('Telegram bot token not configured');
        return NextResponse.json({ ok: false, error: 'Bot token not configured' });
      }
      
      // Handle /start command
      if (userText === '/start') {
        await sendTelegramMessage(botToken, chatId, getWelcomeMessage());
        return NextResponse.json({ ok: true });
      }
      
      // Handle /help command
      if (userText === '/help') {
        await sendTelegramMessage(botToken, chatId, 
          "Smart Daily Assistant Help\n\n" +
          "Just send me your tasks and I'll help organize them!\n\n" +
          "Commands:\n" +
          "/start - Welcome message\n" +
          "/help - This help text\n" +
          "/tasks - View your current tasks\n" +
          "/clear - Clear conversation history\n\n" +
          "Examples:\n" +
          "- I need to finish report, buy milk, and call mom\n" +
          "- Plan my day: gym at 9am, meeting at 2pm\n" +
          "- Study for exam tomorrow, it's urgent"
        );
        return NextResponse.json({ ok: true });
      }
      
      // Handle /tasks command
      if (userText === '/tasks') {
        const assistant = getAssistant(process.env.GEMINI_API_KEY);
        const tasks: Task[] = assistant.getUserTasks(chatId.toString());
        
        if (tasks.length === 0) {
          await sendTelegramMessage(botToken, chatId, 
            "You don't have any pending tasks. Send me what you need to do!"
          );
        } else {
          let taskList = "Your Tasks:\n\n";
          tasks.forEach((task: Task, idx: number) => {
            const priorityLabel = task.priority === 'high' ? 'High' : task.priority === 'medium' ? 'Medium' : 'Low';
            taskList += `${idx + 1}. [${priorityLabel}] ${task.title}\n`;
            if (task.dueDate) {
              taskList += `   Due: ${task.dueDate}\n`;
            }
          });
          await sendTelegramMessage(botToken, chatId, taskList);
        }
        return NextResponse.json({ ok: true });
      }
      
      // Handle /clear command
      if (userText === '/clear') {
        const assistant = getAssistant(process.env.GEMINI_API_KEY);
        await assistant.clearConversation(chatId.toString());
        await sendTelegramMessage(botToken, chatId, 
          "Conversation history cleared! Start fresh by telling me what you need to do."
        );
        return NextResponse.json({ ok: true });
      }
      
      // Process regular message
      if (userText) {
        // Send typing indicator
        await sendTypingAction(botToken, chatId);
        
        const assistant = getAssistant(process.env.GEMINI_API_KEY);
        const response = await assistant.processMessage(userText, chatId.toString());
        
        const formattedResponse = formatTelegramResponse(response);
        await sendTelegramMessage(botToken, chatId, formattedResponse);
      }
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Telegram webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    service: 'smart-daily-assistant',
    timestamp: new Date().toISOString()
  });
}
