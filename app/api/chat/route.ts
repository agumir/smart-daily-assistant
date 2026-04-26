import { NextRequest, NextResponse } from 'next/server';
import { getAssistant } from '../../lib/agent/SmartAssistant';

// Manual task splitting function - FALLBACK when AI fails
function splitTasksManually(message: string): string[] {
  let tasks: string[] = [];
  
  // Method 1: Split by numbered list (1., 2., etc.)
  const numberedMatch = message.match(/\d+\.\s*([^1-9][^.]+?)(?=\d+\.|$)/g);
  if (numberedMatch && numberedMatch.length > 1) {
    tasks = numberedMatch.map(t => t.replace(/^\d+\.\s*/, '').trim());
  }
  
  // Method 2: Split by commas and "and"
  if (tasks.length <= 1) {
    const hasAnd = /\sand\s/i.test(message);
    const hasComma = /[,，]/.test(message);
    
    if (hasAnd || hasComma) {
      let parts = message.split(/[,，]|\sand\s|\s&\s/i);
      tasks = parts.map(p => p.trim()).filter(p => p.length > 0 && p.length < 100);
    }
  }
  
  // Clean up each task
  tasks = tasks.map(t => {
    t = t.replace(/^(i need to|i have to|please|remember to|to)\s+/i, '');
    t = t.replace(/^my tasks?:?\s*/i, '');
    t = t.replace(/^[•\-*]\s*/, '');
    t = t.charAt(0).toUpperCase() + t.slice(1);
    return t;
  }).filter(t => t.length > 0 && t.length < 150);
  
  // Remove duplicates
  tasks = [...new Set(tasks)];
  
  if (tasks.length >= 2) {
    return tasks;
  }
  
  if (tasks.length === 1 && tasks[0].toLowerCase().includes(' and ')) {
    const parts = tasks[0].split(/\s+and\s+/i);
    if (parts.length >= 2) {
      return parts;
    }
  }
  
  if (tasks.length === 0) {
    return [message];
  }
  
  return tasks;
}

function formatHumanResponse(tasks: string[]): { message: string; tasks: any[] } {
  const taskObjects = tasks.map((title, i) => ({
    id: `task-${Date.now()}-${i}`,
    title: title,
    priority: i === 0 ? 'high' : i === 1 ? 'medium' : 'low',
    completed: false,
  }));
  
  // Build response with HTML line breaks for better display
  let message = '';
  
  message += `Goal: Complete your ${tasks.length} pending tasks\n\n`;
  message += `Tasks to complete:\n`;
  tasks.forEach((task, i) => {
    const priorityLabel = i === 0 ? '[High Priority]' : i === 1 ? '[Medium Priority]' : '[Low Priority]';
    message += `${i + 1}. ${task} ${priorityLabel}\n`;
  });
  message += `\n`;
  message += `Priority:\n`;
  if (tasks[0]) message += `- High: ${tasks[0]} - Urgent, do this first\n`;
  if (tasks[1]) message += `- Medium: ${tasks[1]} - Important, schedule soon\n`;
  if (tasks[2]) message += `- Low: ${tasks[2]} - Flexible, no rush\n`;
  message += `\n`;
  message += `Action Plan:\n`;
  message += `- Today: ${tasks[0]}\n`;
  if (tasks[1]) message += `- Tomorrow: ${tasks[1]}\n`;
  if (tasks[2]) message += `- Later: ${tasks[2]}\n`;
  message += `\n`;
  message += `Pro Tip: Start with "${tasks[0]}" first thing tomorrow morning.\n\n`;
  message += `You've got this!`;
  
  return { message, tasks: taskObjects };
}

export async function POST(req: NextRequest) {
  try {
    const { message, userId, conversationHistory } = await req.json();
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    // Silent manual splitting (no console logs)
    const manualTasks = splitTasksManually(message);
    const hasMultipleTasks = manualTasks.length >= 2;
    
    // Validate API key
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      // Use manual override without AI
      const { message: cleanMessage, tasks: cleanTasks } = formatHumanResponse(manualTasks);
      return NextResponse.json({
        message: cleanMessage,
        tasks: cleanTasks,
        actionPlan: {
          goal: `Complete ${manualTasks.length} tasks`,
          steps: manualTasks,
        },
        needsClarification: false,
      });
    }
    
    const assistant = getAssistant(process.env.GEMINI_API_KEY);
    let modifiedMessage = message;
    
    if (hasMultipleTasks) {
      modifiedMessage = "I need to complete these tasks:\n" + 
        manualTasks.map((t, i) => `${i + 1}. ${t}`).join('\n');
    }
    
    const response = await assistant.processMessage(
      modifiedMessage,
      userId || 'web-user',
      conversationHistory
    );
    
    // Override if AI didn't split tasks properly
    if (hasMultipleTasks && (!response.tasks || response.tasks.length <= 1)) {
      const { message: cleanMessage, tasks: cleanTasks } = formatHumanResponse(manualTasks);
      return NextResponse.json({
        message: cleanMessage,
        tasks: cleanTasks,
        actionPlan: {
          goal: `Complete ${manualTasks.length} tasks`,
          steps: manualTasks,
        },
        needsClarification: false,
      });
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process message. Please try again.',
      },
      { status: 500 }
    );
  }
}