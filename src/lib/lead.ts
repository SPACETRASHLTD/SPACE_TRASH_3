// Shared lead types + the tool schema Claude uses to submit a completed lead.

export type Lead = {
  name: string;
  email: string;
  phone: string;
  event_type?: string | null;
  event_date?: string | null;
  neighborhood?: string | null;
  guest_count?: string | null;
  vibe?: string | null;
  budget_range?: string | null;
};

// Anthropic tool definition. Claude calls this exactly once when discovery is
// complete OR when the safety valve fires. Only contact details are required —
// the safety-valve path may legitimately have nothing else.
export const submitLeadTool = {
  name: 'submit_lead',
  description:
    'Save the visitor as a booking lead. Call this once you have, at minimum, their name, email, and phone — either after a natural discovery chat, or immediately if the safety valve fires (they want to leave their number fast). Fill in every other field you have learned; leave unknown fields empty. After this call, send one short warm closing message.',
  input_schema: {
    type: 'object' as const,
    properties: {
      name: { type: 'string', description: 'The visitor’s name.' },
      email: { type: 'string', description: 'The visitor’s email address.' },
      phone: { type: 'string', description: 'The visitor’s phone number.' },
      event_type: {
        type: 'string',
        description: 'Kind of event — e.g. 60th birthday, anniversary, summer party.',
      },
      event_date: {
        type: 'string',
        description: 'Event date. Month-level is fine if the exact day is unknown.',
      },
      neighborhood: {
        type: 'string',
        description: 'Vancouver neighborhood / location — e.g. West Vancouver, Point Grey.',
      },
      guest_count: {
        type: 'string',
        description: 'Approximate number of guests.',
      },
      vibe: {
        type: 'string',
        description: 'The feel they want — e.g. relaxed background, lively dance floor.',
      },
      budget_range: {
        type: 'string',
        description: 'Approximate budget range, if shared.',
      },
    },
    required: ['name', 'email', 'phone'],
  },
};

// A trimmed, human-readable one-liner for SMS.
export function leadSummary(lead: Lead): string {
  const parts = [
    lead.name,
    lead.event_type,
    lead.event_date,
    lead.neighborhood,
    lead.budget_range && `budget ${lead.budget_range}`,
    lead.phone,
  ].filter(Boolean);
  return parts.join(' · ');
}
