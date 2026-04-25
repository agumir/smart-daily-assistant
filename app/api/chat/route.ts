import { NextRequest, NextResponse } from 'next/server';
import { getAssistant } from '../../lib/agent/SmartAssistant';
export async function POST(req: NextRequest) {
  try {
    const { message, userId, conversationHistory } = await req.json();
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    // Validate API key is configured
    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'your_gemini_api_key_here') {
      return NextResponse.json(
        { error: 'Gemini API key is not configured. Please set GEMINI_API_KEY in environment variables.' },
        { status: 500 }
      );
    }
    
    const assistant = getAssistant(process.env.GEMINI_API_KEY);
    const response = await assistant.processMessage(
      message,
      userId || 'web-user',
      conversationHistory
    );
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process message',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}