import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getCachedInstance, getCachedInstanceSettings } from '@/lib/telegram/utils';
import { ProviderFactory } from '@/lib/telegram/providers/ProviderFactory';
import { generateAudio } from '@/lib/elevenlabs/client';
import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

export async function POST(req: NextRequest, { params }: { params: Promise<{ instanceId: string }> }) {
  try {
    const requestStartTime = Date.now();
    const timingBreakdown: any = {};
    const { instanceId } = await params;
    const body = await req.json();
    const { chatId, text, replyToMsgId } = body;

    if (!chatId || !text) {
      return NextResponse.json({ error: 'chatId and text are required' }, { status: 400 });
    }

    timingBreakdown.authMs = Date.now() - requestStartTime;

    const tPrismaStart = Date.now();
    const instance = await getCachedInstance(instanceId);
    if (!instance) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });

    const tSettingsStart = Date.now();
    const settings = await getCachedInstanceSettings(instanceId);
    if (!settings || !settings.elevenLabsApiKey || !settings.elevenLabsVoiceId) {
      return NextResponse.json({ error: 'ElevenLabs is not fully configured for this instance (API Key or Voice ID is missing)' }, { status: 400 });
    }

    const tProviderStart = Date.now();
    const provider = await ProviderFactory.getProvider(instance);
    timingBreakdown.providerMs = Date.now() - tProviderStart;
    timingBreakdown.prismaMs = Date.now() - tPrismaStart - timingBreakdown.providerMs;

    // Generate Audio via ElevenLabs
    const tEl = Date.now();
    const audioBuffer = await generateAudio(
      settings.elevenLabsApiKey, 
      settings.elevenLabsVoiceId, 
      settings.elevenLabsModelId || 'eleven_multilingual_v2', 
      text
    );
    const elevenLabsMs = Date.now() - tEl;

    // Save to temp file since Providers usually expect a file path or URL for sendFile 
    // depending on the provider implementation. Buffer is also supported by sendFile!
    // But since it's an MP3 and we want to force voiceNote, let's use a temp file to give it an extension.
    const tempFileName = `voice_ai_${crypto.randomUUID()}.mp3`;
    const tempPath = path.join(os.tmpdir(), tempFileName);
    fs.writeFileSync(tempPath, audioBuffer);

    try {
      // Simulate recording voice action
      const tSim = Date.now();
      await provider.simulateFileAction(chatId, 'audio', 3000); // Wait 3s simulating recording
      const simulationMs = Date.now() - tSim;
      
      // Send as voice note
      const tSend = Date.now();
      const message = await provider.sendFile(chatId, tempPath, {
        replyToMsgId,
        voiceNote: true // Forces it to be sent as a voice note
      });
      const telegramSendMs = Date.now() - tSend;

      const totalTimingMs = Date.now() - requestStartTime;
      const total = elevenLabsMs + simulationMs + telegramSendMs;
      const messages = [{ success: true, id: message.id, timing: { elevenLabsMs, simulationMs, telegramSendMs, totalActionMs: total, totalTimingMs: total, totalMs: total } }];
      return NextResponse.json({ success: true, totalTimingMs, timingBreakdown, messages });
    } finally {
      // Cleanup temp file
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch(e) {}
      }
    }
  } catch (error: any) {
    console.error('[Voice-AI] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
