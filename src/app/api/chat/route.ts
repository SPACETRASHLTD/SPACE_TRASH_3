import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { systemPrompt } from '@/lib/prompt';
import { submitLeadTool, type Lead } from '@/lib/lead';
import { getSupabaseAdmin } from '@/lib/supabase';
import { notifyFounders } from '@/lib/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const MAX_TURNS = 14; // generous cap; the bot is designed to be brief

type ClientMessage = { role: 'user' | 'assistant'; content: string };

// Server-side kickoff so the bot greets first and the first turn is always `user`.
const KICKOFF: Anthropic.MessageParam = {
  role: 'user',
  content:
    '[The visitor just opened the chat. Greet them warmly in one or two short lines, ' +
    'naturally mention that we specialize in house parties, and ask one easy opening ' +
    'question. Do not list options unless helpful.]',
};

// Pull "[[quick: A | B | C]]" off the end of a reply and return chips + clean text.
function extractQuickReplies(text: string): { reply: string; quickReplies: string[] } {
  const match = text.match(/\[\[quick:\s*([^\]]+)\]\]\s*$/i);
  if (!match) return { reply: text.trim(), quickReplies: [] };
  const quickReplies = match[1]
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);
  return { reply: text.slice(0, match.index).trim(), quickReplies };
}

function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

function transcriptFrom(messages: ClientMessage[], close: string): string {
  const lines = messages.map(
    (m) => `${m.role === 'user' ? 'Visitor' : 'Assistant'}: ${m.content}`
  );
  if (close) lines.push(`Assistant: ${close}`);
  return lines.join('\n\n');
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: 'The booking assistant is not configured yet.' },
      { status: 503 }
    );
  }

  let body: { messages?: ClientMessage[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  }

  const clientMessages = (body.messages ?? []).filter(
    (m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
  );

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Build the working transcript: kickoff + the visible conversation so far.
  const messages: Anthropic.MessageParam[] = [
    KICKOFF,
    ...clientMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  let done = false;

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt(),
        tools: [submitLeadTool],
        messages,
      });

      messages.push({ role: 'assistant', content: response.content });

      const toolUse = response.content.find(
        (b): b is Anthropic.ToolUseBlock =>
          b.type === 'tool_use' && b.name === 'submit_lead'
      );

      if (response.stop_reason === 'tool_use' && toolUse) {
        // Persist the lead, then fire notifications. A notification failure must
        // never lose a saved lead, so we save first and never throw on notify.
        const lead = toolUse.input as Lead;
        const result = await saveLead(lead, clientMessages);
        done = true;

        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: toolUse.id,
              content: result.ok
                ? 'Saved. Send the visitor one short, warm closing message now, addressing them by first name.'
                : 'Saved for follow-up. Send one short, warm closing message now, addressing them by first name.',
            },
          ],
        });
        continue; // loop once more to get the closing text
      }

      // Plain text turn — this is the message we show the visitor.
      const { reply, quickReplies } = extractQuickReplies(textOf(response.content));
      return NextResponse.json({ reply, quickReplies, done });
    }

    // Safety net if we somehow exhaust the loop.
    return NextResponse.json({
      reply:
        'Thanks so much — we have what we need and a real person will be in touch within 24 hours.',
      quickReplies: [],
      done: true,
    });
  } catch (err) {
    console.error('[chat] error', err);
    return NextResponse.json(
      { error: 'Something went wrong on our end. Please try again in a moment.' },
      { status: 500 }
    );
  }
}

// Insert into Supabase and notify the founders. Returns ok=false (without throwing
// past the caller) if persistence fails, so the bot can still close gracefully.
async function saveLead(
  lead: Lead,
  clientMessages: ClientMessage[]
): Promise<{ ok: boolean }> {
  const transcript = transcriptFrom(clientMessages, '');
  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('leads').insert({
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
      event_type: lead.event_type ?? null,
      event_date: lead.event_date ?? null,
      neighborhood: lead.neighborhood ?? null,
      guest_count: lead.guest_count ?? null,
      vibe: lead.vibe ?? null,
      budget_range: lead.budget_range ?? null,
      full_transcript: transcript,
      status: 'new',
    });
    if (error) {
      console.error('[chat] supabase insert error', error);
      // Still try to notify so the lead isn't lost entirely.
      await notifyFounders(lead, transcript);
      return { ok: false };
    }
  } catch (err) {
    console.error('[chat] supabase unavailable', err);
    await notifyFounders(lead, transcript).catch(() => {});
    return { ok: false };
  }

  // Persisted — now notify. Notifications never throw past here.
  const status = await notifyFounders(lead, transcript);
  console.log('[chat] notify', status);
  return { ok: true };
}
