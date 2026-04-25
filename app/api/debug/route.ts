import { NextResponse } from 'next/server';

export async function GET() {
  // Check if API key exists
  const apiKey = process.env.GEMINI_API_KEY;
  
  return NextResponse.json({
    hasApiKey: !!apiKey,
    keyLength: apiKey?.length || 0,
    keyPrefix: apiKey ? apiKey.substring(0, 10) : 'none',
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('GEMINI') || k.includes('API'))
  });
}