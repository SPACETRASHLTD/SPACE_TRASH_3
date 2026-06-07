/*
 * THE ROOT MAP — data model
 * Faithful encoding of the Self Scale archetype cheat sheet.
 *
 * Pillars: sp = Spiritual, ph = Physical, mn = Mental
 * freq:    'daily'      -> seven day cells (Mon..Sun), points per checked day
 *          'weekly'     -> one mark per week
 *          'completion' -> one-off completion this week
 */

const PILLARS = [
  { key: 'sp', name: 'Spiritual', abbr: 'SP' },
  { key: 'ph', name: 'Physical', abbr: 'PH' },
  { key: 'mn', name: 'Mental', abbr: 'MN' },
];

const PILLAR_NAME = { sp: 'Spiritual', ph: 'Physical', mn: 'Mental' };

/* Tier One — base stats. Active for every archetype, every day. */
const TIER_ONE = [
  {
    id: 't1_env',
    label: 'Dark, cool, quiet sleep environment',
    detail: '+5 all pillars / night',
    freq: 'daily',
    pts: { sp: 5, ph: 5, mn: 5 },
  },
  {
    id: 't1_wind',
    label: 'Consistent wind-down routine, same time nightly',
    detail: '+3 all pillars / night',
    freq: 'daily',
    pts: { sp: 3, ph: 3, mn: 3 },
  },
  {
    id: 't1_midnight',
    label: 'In bed before midnight',
    detail: '+5 all pillars / night',
    freq: 'daily',
    pts: { sp: 5, ph: 5, mn: 5 },
  },
  {
    id: 't1_move',
    label: '20 minutes easy, intentional movement',
    detail: '+4 Physical / session',
    freq: 'daily',
    pts: { ph: 4 },
  },
  {
    id: 't1_breath',
    label: 'Resonant breathing — 5–6 bpm, extended exhale, 5–10 min',
    detail: '+4 Spiritual, +3 Mental / session',
    freq: 'daily',
    pts: { sp: 4, mn: 3 },
  },
];

/*
 * Archetype-specific XP sources only.
 * Generic breathwork / 20-min movement / sleep are NOT repeated here — they
 * live in Tier One above so nothing is double counted.
 */
const ARCHETYPES = {
  warrior: {
    name: 'The Warrior',
    tagline: 'Physical dominant',
    bleed: 'Force Over Presence',
    note: 'The Warrior believes more force applied to any situation eventually produces the result he wants. The internal world does not respond to force. Presence, stillness, and the willingness to feel without acting are exactly what his Spiritual and Mental pillars are starving for.',
    need: { sp: 20, mn: 15 },
    sources: [
      { id: 'w_still', label: 'Stillness practice — 5 mins, producing nothing', freq: 'daily', pts: { sp: 3 } },
      { id: 'w_emo', label: 'Emotional vocabulary — name what you feel, once daily', freq: 'daily', pts: { sp: 2 } },
      { id: 'w_pause', label: 'The pause — 60s before acting on the "push harder" impulse', freq: 'daily', pts: { mn: 3 } },
      { id: 'w_reflect', label: 'Weekly reflection', freq: 'weekly', pts: { mn: 5 } },
    ],
    missions: [
      { id: 'wm1', label: 'Set up sleep environment tonight', xp: { sp: 10, ph: 10, mn: 10 }, note: '+10 all pillars' },
      { id: 'wm2', label: 'Breathwork 7 consecutive days', xp: { sp: 28 }, note: '+28 Spiritual' },
      { id: 'wm3', label: 'Use "the pause" once daily', xp: { mn: 3 }, note: '+3 Mental per use' },
    ],
    unlocks: [
      { label: 'The Craftsman', cond: { sp: 65, mn: 60 } },
      { label: 'The Sovereign', cond: { all: 70 } },
    ],
  },

  seeker: {
    name: 'The Seeker',
    tagline: 'Spiritual dominant',
    bleed: 'Seeking Effects, Missing The Cause',
    note: 'A man of genuine curiosity who self-sabotages every time real depth becomes available — the next interesting thing appears before the current one has changed him. Completion as identity is the medicine.',
    need: { ph: 20, mn: 15 },
    sources: [
      { id: 's_one', label: 'The one-practice rule — one practice held for 90 days', freq: 'weekly', pts: { mn: 5 } },
      { id: 's_cause', label: 'Cause journal — "what is my role in creating this?"', freq: 'daily', pts: { mn: 4 } },
      { id: 's_comp', label: 'Completion over consumption — finish before starting new', freq: 'daily', pts: { mn: 3 } },
    ],
    missions: [
      { id: 'skm1', label: 'Name & commit to your 90-day practice tonight', xp: { mn: 5 }, note: '+5 Mental' },
      { id: 'skm2', label: 'Breathwork 7 consecutive days', xp: { sp: 28 }, note: '+28 Spiritual' },
      { id: 'skm3', label: 'Write one cause-journal entry', xp: { mn: 4 }, note: '+4 Mental' },
    ],
    unlocks: [
      { label: 'The Craftsman', cond: { ph: 60, mn: 65 } },
      { label: 'The Sovereign', cond: { all: 70 } },
    ],
  },

  sovereign: {
    name: 'The Sovereign',
    tagline: 'Spiritually developed',
    bleed: 'New Knowledge, Same Identity',
    note: 'The most developed and the most subtly stuck — adding knowledge to an identity that never changes. Real transformation is not additive; it requires the current identity to dissolve enough for a new one to form.',
    need: { ph: 15, mn: 15 },
    sources: [
      { id: 'sv_embody', label: 'Embodiment practice — one principle lived 30 days, no new inputs', freq: 'weekly', pts: { sp: 5 } },
      { id: 'sv_release', label: 'Identity release — 20 min honest writing, no editing', freq: 'weekly', pts: { sp: 4 } },
      { id: 'sv_char', label: 'The character question — end of day', freq: 'daily', pts: { mn: 3 } },
    ],
    missions: [
      { id: 'svm1', label: 'Write identity-release response tonight — 20 min, no editing', xp: { sp: 4 }, note: '+4 Spiritual' },
      { id: 'svm2', label: 'Choose one principle to embody for 30 days', xp: { sp: 5 }, note: '+5 Spiritual' },
      { id: 'svm3', label: 'Breathwork with 2 minutes silence after', xp: { sp: 6 }, note: '+6 Spiritual' },
    ],
    unlocks: [
      { label: 'The Fully Realised Sovereign', cond: { ph: 65, mn: 65 } },
      { label: 'Master level', cond: { all: 75 } },
    ],
  },

  craftsman: {
    name: 'The Craftsman',
    tagline: 'Physical dominant',
    bleed: 'All Tools, No Personal Blueprint',
    note: 'Skill and discipline in abundance, but it all goes to executing other people\'s blueprints. The project with no external demand sits unbuilt. Listen for what he actually wants to build, then begin before the plan is complete.',
    need: { sp: 20, mn: 10 },
    sources: [
      { id: 'c_intuition', label: 'Intuition log — 5 min, no phone: "what do I want to build?"', freq: 'daily', pts: { sp: 3 } },
      { id: 'c_project', label: 'One personal project — 30 min per week', freq: 'weekly', pts: { sp: 5 } },
      { id: 'c_begin', label: 'Begin before the blueprint — one action within 24h of an idea', freq: 'daily', pts: { mn: 4 } },
    ],
    missions: [
      { id: 'cm1', label: 'Start intuition log tomorrow morning', xp: { sp: 3 }, note: '+3 Spiritual' },
      { id: 'cm2', label: 'Identify a personal project & take one action this week', xp: { sp: 9 }, note: '+9 Spiritual' },
      { id: 'cm3', label: 'Set up sleep environment tonight', xp: { sp: 10, ph: 10, mn: 10 }, note: '+10 all pillars' },
    ],
    unlocks: [
      { label: 'The Complete Craftsman', cond: { sp: 65 } },
      { label: 'The Sovereign', cond: { sp: 70, mn: 65 } },
    ],
  },

  scholar: {
    name: 'The Scholar',
    tagline: 'Mental dominant',
    bleed: 'Mental Indigestion',
    note: 'He keeps consuming without digesting. The knowing replaced the becoming. Stay with something simple long enough to be changed by it — implement one principle instead of finding the next framework.',
    need: { ph: 20, sp: 15 },
    sources: [
      { id: 'sc_book', label: 'The one-book rule — no new book until current one applied 30 days', freq: 'weekly', pts: { mn: 5 } },
      { id: 'sc_sweat', label: 'Sweat equity — implement one principle daily for 60 days', freq: 'daily', pts: { mn: 4 } },
      { id: 'sc_impl', label: 'Implementation question — before any new input', freq: 'daily', pts: { mn: 3 } },
    ],
    missions: [
      { id: 'scm1', label: 'Identify least-applied principle — implement it from tomorrow', xp: { mn: 4 }, note: '+4 Mental' },
      { id: 'scm2', label: 'Begin breathwork tonight — no research, just do it', xp: { sp: 4 }, note: '+4 Spiritual' },
      { id: 'scm3', label: 'Write the implementation-question answer', xp: { mn: 3 }, note: '+3 Mental' },
    ],
    unlocks: [
      { label: 'The Visionary', cond: { ph: 60, sp: 60 } },
      { label: 'The Sovereign', cond: { all: 70 } },
    ],
  },

  visionary: {
    name: 'The Visionary',
    tagline: 'Mental dominant',
    bleed: 'Dreaming Instead Of Building',
    note: 'First to arrive at the race, last to begin it — the dream stays perfect while unbuilt. He generates without completing. One minimum-viable action makes a project more real than any amount of planning.',
    need: { ph: 20, sp: 15 },
    sources: [
      { id: 'v_mvs', label: 'Minimum viable start — one action within 24h of any 7-day-old idea', freq: 'daily', pts: { mn: 5 } },
      { id: 'v_record', label: 'Completion record — review weekly', freq: 'weekly', pts: { mn: 3 } },
      { id: 'v_deadline', label: 'Dream to deadline — first deliverable for an old idea', freq: 'daily', pts: { mn: 4 } },
    ],
    missions: [
      { id: 'vm1', label: 'Idea in your head 30+ days — take minimum viable first action today', xp: { mn: 5 }, note: '+5 Mental' },
      { id: 'vm2', label: 'Breathwork daily', xp: { sp: 4 }, note: '+4 Spiritual' },
      { id: 'vm3', label: 'Write the completion record', xp: { mn: 3 }, note: '+3 Mental' },
    ],
    unlocks: [
      { label: 'The Fully Realised Visionary', cond: { ph: 65, sp: 60 } },
      { label: 'The Sovereign', cond: { all: 70 } },
    ],
  },

  builder: {
    name: 'The Builder',
    tagline: 'Balanced',
    bleed: 'Building For Everyone, Not The Builder',
    note: 'A dull blade — the right tool, dull from continuous use without maintenance. The sharpening is the most important part of the work. One protected hour a week that belongs only to him.',
    need: { sp: 20, ph: 15, mn: 10 },
    sources: [
      { id: 'b_hour', label: 'The protected hour — one hour weekly, yours only', freq: 'weekly', pts: { sp: 8 } },
      { id: 'b_sharpen', label: 'The sharpening question — "what did I do for my own development?"', freq: 'weekly', pts: { mn: 3 } },
    ],
    missions: [
      { id: 'bm1', label: 'Set up sleep environment tonight', xp: { sp: 10, ph: 10, mn: 10 }, note: '+10 all pillars' },
      { id: 'bm2', label: 'Schedule the protected hour this week', xp: { sp: 8 }, note: '+8 Spiritual' },
      { id: 'bm3', label: 'Begin breathwork at lunch or before bed', xp: { sp: 7, mn: 3 }, note: '+7 Spiritual + Mental' },
    ],
    unlocks: [
      { label: 'The Master Builder', cond: { sp: 65 } },
      { label: 'The Sovereign', cond: { all: 70 } },
    ],
  },

  connector: {
    name: 'The Connector',
    tagline: 'Balanced',
    bleed: 'Pouring From An Empty Cup',
    note: 'He pours warmth outward believing the cup is filled in return. It rarely is. He needs a source — practices that belong entirely to him, where no relationship is being served.',
    need: { sp: 25, mn: 10 },
    sources: [
      { id: 'cn_solitude', label: 'Solitude practice — 30 mins weekly, no input', freq: 'weekly', pts: { sp: 5 } },
      { id: 'cn_receive', label: 'Receiving practice — let one thing in without deflecting', freq: 'daily', pts: { sp: 3 } },
      { id: 'cn_cup', label: 'The cup check — "am I giving from fullness or emptiness?"', freq: 'daily', pts: { mn: 3 } },
    ],
    missions: [
      { id: 'cnm1', label: 'Breathwork tomorrow morning, before anyone needs anything', xp: { sp: 4 }, note: '+4 Spiritual' },
      { id: 'cnm2', label: 'Schedule 30 minutes solitude this week', xp: { sp: 5 }, note: '+5 Spiritual' },
      { id: 'cnm3', label: 'Answer the cup check in writing right now', xp: { mn: 3 }, note: '+3 Mental' },
    ],
    unlocks: [
      { label: 'The Connector Who Is Full', cond: { sp: 70 } },
      { label: 'The Sovereign', cond: { all: 70 } },
    ],
  },

  protector: {
    name: 'The Protector',
    tagline: 'Balanced',
    bleed: 'Guarding Everyone, Known By No One',
    note: 'He absorbs impact so others stay safe — but no one fully knows him. The work is building an identity that exists independent of what he protects and provides. Practice being seen.',
    need: { sp: 25, mn: 10 },
    sources: [
      { id: 'p_known', label: 'Practice of being known — one honest conversation weekly', freq: 'weekly', pts: { sp: 6 } },
      { id: 'p_receive', label: 'Receiving practice — let one thing in without deflecting', freq: 'daily', pts: { sp: 3 } },
      { id: 'p_audit', label: 'Identity audit — "who am I when I am not protecting anyone?"', freq: 'weekly', pts: { mn: 4 } },
    ],
    missions: [
      { id: 'pm1', label: 'One honest conversation this week — one true thing', xp: { sp: 6 }, note: '+6 Spiritual' },
      { id: 'pm2', label: 'Breathwork tomorrow morning, before the day begins', xp: { sp: 4 }, note: '+4 Spiritual' },
      { id: 'pm3', label: 'Identity audit in writing — 20 min, no editing', xp: { mn: 4 }, note: '+4 Mental' },
    ],
    unlocks: [
      { label: 'The Guardian', cond: { sp: 70 } },
      { label: 'The Sovereign', cond: { all: 70 } },
    ],
  },

  merchant: {
    name: 'The Merchant',
    tagline: 'Balanced',
    bleed: 'Net Worth Over Inner Worth',
    note: 'He is trying to prove material wealth compensates for inner wealth. His scales of value were never recalibrated. "What do I have that cannot be taken from me?" and "today was enough" rewire the register.',
    need: { sp: 25, mn: 10 },
    sources: [
      { id: 'm_inventory', label: 'Inner wealth inventory — "what can\'t be taken from me?" weekly', freq: 'weekly', pts: { sp: 5 } },
      { id: 'm_enough', label: 'The enough practice — one sentence before sleep, nightly', freq: 'daily', pts: { sp: 3 } },
      { id: 'm_reference', label: 'Seek a different reference point — read one biography', freq: 'completion', pts: { sp: 8 } },
    ],
    missions: [
      { id: 'mm1', label: 'Breathwork tonight lying down — last thing before sleep', xp: { sp: 4 }, note: '+4 Spiritual' },
      { id: 'mm2', label: 'Write the inner-wealth inventory — 20 min', xp: { sp: 5 }, note: '+5 Spiritual' },
      { id: 'mm3', label: 'Write the "enough" sentence tonight', xp: { sp: 3 }, note: '+3 Spiritual' },
    ],
    unlocks: [
      { label: 'The Sovereign Merchant', cond: { sp: 70 } },
      { label: 'The Sovereign', cond: { all: 70 } },
    ],
  },
};

const ARCHETYPE_ORDER = [
  'warrior', 'seeker', 'sovereign', 'craftsman', 'scholar',
  'visionary', 'builder', 'connector', 'protector', 'merchant',
];
