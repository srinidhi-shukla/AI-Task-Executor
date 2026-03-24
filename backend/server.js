require('dotenv').config();

if (!process.env.OPENROUTER_API_KEY) {
  console.error('ERROR: OPENROUTER_API_KEY is not set. Add it to backend/.env.');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const GUARDRAILS = require('./guardrails');

const app = express();
const PORT = process.env.PORT || 3000;
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://192.168.4.122:5173',
  'https://srinidhi-shukla.github.io',
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  })
);

app.use(express.json());

async function openRouterChat(messages) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'meta-llama/llama-3-8b-instruct',
      messages,
      max_tokens: 900,
      temperature: 0.2,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errText =
      data?.error?.message ||
      data?.choices?.[0]?.message?.content ||
      JSON.stringify(data);
    throw new Error(`OpenRouter error ${response.status}: ${errText}`);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from OpenRouter');

  return stripMarkdown(content.trim());
}

async function callAI({ systemPrompt, userPrompt }) {
  console.log('AI call initiated with guardrails applied');
  const messages = [
    { role: 'system', content: GUARDRAILS },
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  const aiText = await openRouterChat(messages);
  console.log('AI response received, guardrails enforced');
  return aiText;
}

function cleanText(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/###\s+/g, '')
    .replace(/##\s+/g, '')
    .replace(/#\s+/g, '')
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1')
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function safeParseJSON(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

function extractJsonBlock(text) {
  if (!text || typeof text !== 'string') return null;
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return null;
}

function stripMarkdown(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/###\s+/g, '')
    .replace(/##\s+/g, '')
    .replace(/#\s+/g, '')
    .replace(/`{1,3}(.*?)`{1,3}/g, '$1')
    .replace(/!\[[^\]]*\]\([^\)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function parsePossiblyMessyJSON(text) {
  const direct = safeParseJSON(text);
  if (direct) return direct;

  const jsonBlock = extractJsonBlock(text);
  if (jsonBlock) return safeParseJSON(jsonBlock);

  return null;
}

function getDateContext() {
  return {
    todayISO: new Date().toISOString(),
    timezone: 'America/Chicago',
  };
}

function normalizeStep(step, index) {
  return {
    id: step.id || `step-${index + 1}`,
    title: typeof step.title === 'string' ? step.title : `Step ${index + 1}`,
    purpose:
      typeof step.purpose === 'string'
        ? step.purpose
        : typeof step.description === 'string'
        ? step.description
        : '',
    capability: normalizeCapability(step.capability),
    resultType: normalizeResultType(step.resultType),
    connectors: normalizeConnectors(step.connectors || step.dataSources || step.sources),
    type: typeof step.type === 'string' ? step.type : 'other',
    status: typeof step.status === 'string' ? step.status : 'pending',
    result: null,
  };
}

function normalizePlanSteps(rawSteps) {
  if (!Array.isArray(rawSteps)) return [];
  return rawSteps.map((step, idx) => normalizeStep(step, idx));
}

function fallbackPlan(userRequest) {
  return {
    taskType: 'general',
    steps: [
      normalizeStep(
        {
          title: 'Find candidate options',
          purpose: 'Search for the strongest candidates that fit the request and stated constraints.',
          capability: 'search',
          resultType: 'cards',
          connectors: ['web', 'connector:auto'],
        },
        0
      ),
      normalizeStep(
        {
          title: 'Compare the top choices',
          purpose: 'Compare the best options on the most decision-relevant criteria and surface tradeoffs.',
          capability: 'compare',
          resultType: 'comparison',
          connectors: ['web', 'connector:auto'],
        },
        1
      ),
      normalizeStep(
        {
          title: 'Extract the key facts',
          purpose: 'Pull out the critical facts, constraints, or requirements the user needs to act on.',
          capability: 'extract',
          resultType: 'checklist',
          connectors: ['document', 'web'],
        },
        2
      ),
      normalizeStep(
        {
          title: 'Summarize the decision',
          purpose: 'Summarize the best recommendation, the reasoning, and the most important caveats.',
          capability: 'summarize',
          resultType: 'summary',
          connectors: ['internal'],
        },
        3
      ),
      normalizeStep(
        {
          title: 'Recommend the next action',
          purpose: 'Turn the findings into a concrete recommendation with one clear next step.',
          capability: 'recommend',
          resultType: 'summary',
          connectors: ['internal'],
        },
        4
      ),
    ],
    summary: 'Plan created with reusable search, compare, extract, summarize, and recommend steps.',
    summarySections: [],
  };
}

async function planSteps(userRequest) {
  const dateContext = getDateContext();
  const systemPrompt = `
You are an AI planning assistant.
Today is ${dateContext.todayISO} in ${dateContext.timezone}. Resolve relative date phrases like 'this weekend', 'tomorrow', and 'next Friday' before answering. Do not leave placeholders like [insert date].

Convert the user request into 3-7 concise, actionable, user-value steps.

Return ONLY valid JSON in this format:
{
  "taskType": "general",
  "steps": [
    {
      "id": "step-1",
      "title": "...",
      "purpose": "...",
      "capability": "search",
      "resultType": "cards",
      "connectors": ["web"],
      "status": "pending"
    }
  ],
  "summary": "",
  "summarySections": []
}

Rules:
- No markdown
- No explanation outside JSON
- Steps must be outcome-based and user-facing
- Each step must answer a distinct user question
- Capabilities must be chosen from: search, compare, extract, summarize, schedule, recommend
- resultType must be one of: cards, checklist, timeline, summary, table, links, comparison
- Choose connectors or data sources only when they are useful, using generic names like:
  - web
  - document
  - calendar
  - maps
  - email
  - internal
  - connector:auto
- Do not hardcode task categories into the step structure
- Prefer reusable capabilities over domain labels
- The final step should usually use the recommend capability
`;

  const aiText = await callAI({ systemPrompt, userPrompt: userRequest });
  const parsed = parsePossiblyMessyJSON(aiText);

  if (parsed && Array.isArray(parsed.steps)) {
    console.log('Plan route: parsed JSON successfully');
    return {
      taskType: typeof parsed.taskType === 'string' ? parsed.taskType : 'general',
      steps: normalizePlanSteps(parsed.steps),
      summary: typeof parsed.summary === 'string' ? parsed.summary : '',
      summarySections: Array.isArray(parsed.summarySections)
        ? parsed.summarySections
        : Array.isArray(parsed.sections)
        ? parsed.sections
        : [],
    };
  }

  console.log('Plan route: fallback used');
  return fallbackPlan(userRequest);
}

function normalizeResultType(resultType) {
  const allowed = new Set(['cards', 'checklist', 'timeline', 'summary', 'table', 'links', 'comparison']);
  return allowed.has(resultType) ? resultType : 'summary';
}

function normalizeCapability(capability) {
  const allowed = new Set(['search', 'compare', 'extract', 'summarize', 'schedule', 'recommend']);
  return allowed.has(capability) ? capability : 'summarize';
}

function normalizeConnectors(connectors) {
  if (!Array.isArray(connectors)) return [];
  return connectors
    .filter((connector) => typeof connector === 'string' && connector.trim())
    .map((connector) => connector.trim())
    .slice(0, 4);
}

function isLikelyImageUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return false;
  const lower = url.toLowerCase();
  // Check for real image file extensions
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp'];
  const hasImageExt = imageExtensions.some(ext => lower.includes(ext));
  // Reject placeholder URLs
  const isPlaceholder = lower.includes('example.com') || lower.includes('placeholder') || lower.includes('...');
  return hasImageExt && !isPlaceholder;
}

function cleanThumbnailUrl(thumbnail) {
  if (!thumbnail || !isLikelyImageUrl(thumbnail)) {
    return '';
  }
  return thumbnail.trim();
}

function parseStructuredResponse(aiText) {
  // Try to extract structured fields from plain text responses
  const structure = {
    summary: [],
    highlights: [],
    assumptions: [],
    bestOption: null,
    alternatives: [],
    actions: [],
  };

  // Look for Best Option pattern
  const bestOptionMatch = aiText.match(/Best\s*(?:Option|Choice|Recommendation):\s*([^\n]+)/i);
  if (bestOptionMatch) {
    structure.bestOption = {
      label: bestOptionMatch[1].trim(),
      subtitle: '',
      price: '',
      rating: '',
      thumbnail: '',
      link: '',
      metadata: [],
    };
  }

  // Look for bullet points / highlights
  const bulletMatches = aiText.match(/^[-•*]\s+(.+)$/gm);
  if (bulletMatches) {
    structure.highlights = bulletMatches
      .slice(0, 3)
      .map(m => m.replace(/^[-•*]\s+/, '').trim())
      .filter(Boolean);
  }

  const assumptionMatches = aiText.match(/assum(?:e|ption)[^.\n]*/gi);
  if (assumptionMatches) {
    structure.assumptions = assumptionMatches.slice(0, 2).map((value) => value.trim());
  }

  // Look for pricing info
  const priceMatch = aiText.match(/(?:Price|Cost|Total):\s*\$?([\d,]+)/i);
  if (priceMatch && structure.bestOption) {
    structure.bestOption.price = `$${priceMatch[1]}`;
  }

  // Look for Next Step / Action patterns
  const nextStepMatch = aiText.match(/Next\s*(?:Step|Action):\s*([^\n]+)/i);
  if (nextStepMatch) {
    structure.actions.push({
      label: nextStepMatch[1].trim(),
      url: '#',
    });
  }

  // Look for URL/link patterns
  const urlMatches = aiText.match(/https?:\/\/[^\s<>"{}|\\^`\[\]]*[^\s<>"{}|\\^`\[\].,]/g);
  if (urlMatches) {
    urlMatches.slice(0, 3).forEach(url => {
      structure.actions.push({
        label: 'Open link',
        url,
      });
    });
  }

  return structure;
}

function normalizeStructuredFields(parsed) {
  const normalized = {};

  // Normalize summary to array of max 3
  if (Array.isArray(parsed.summary)) {
    normalized.summary = parsed.summary.slice(0, 3);
  } else if (typeof parsed.summary === 'string' && parsed.summary.trim()) {
    normalized.summary = [parsed.summary.trim()];
  }

  // Normalize highlights
  if (Array.isArray(parsed.highlights)) {
    normalized.highlights = parsed.highlights.slice(0, 3);
  }

  if (Array.isArray(parsed.assumptions)) {
    normalized.assumptions = parsed.assumptions.slice(0, 3);
  }

  // Normalize bestOption with cleaned thumbnail
  if (parsed.bestOption && typeof parsed.bestOption === 'object') {
    normalized.bestOption = {
      ...parsed.bestOption,
      thumbnail: cleanThumbnailUrl(parsed.bestOption.thumbnail),
    };
  }

  // Normalize alternatives with cleaned thumbnails
  if (Array.isArray(parsed.alternatives)) {
    normalized.alternatives = parsed.alternatives.slice(0, 2).map(alt => ({
      ...alt,
      thumbnail: cleanThumbnailUrl(alt.thumbnail),
    }));
  }

  // Normalize actions
  if (Array.isArray(parsed.actions)) {
    normalized.actions = parsed.actions
      .slice(0, 3)
      .map((action) => {
        if (typeof action === 'string') {
          return { label: action.trim(), url: '' };
        }
        if (action && typeof action === 'object') {
          return {
            label: typeof action.label === 'string' ? action.label.trim() : '',
            url: typeof action.url === 'string' ? action.url.trim() : '',
          };
        }
        return null;
      })
      .filter(Boolean);
  }

  // Normalize timeline
  if (Array.isArray(parsed.timeline)) {
    normalized.timeline = parsed.timeline;
  }

  // Normalize budget
  if (Array.isArray(parsed.budget)) {
    normalized.budget = parsed.budget;
  }

  return normalized;
}

function normalizeExecutionResult(stepTitle, resultType, aiText) {
  const parsed = parsePossiblyMessyJSON(aiText);

  const result = {
    title: stepTitle,
    resultType: normalizeResultType(resultType),
    items: [],
    links: [],
    notes: '',
  };

  if (parsed && typeof parsed === 'object') {
    result.title = parsed.title || result.title;
    result.resultType = normalizeResultType(parsed.resultType || result.resultType);

    // Normalize all structured fields
    const normalized = normalizeStructuredFields(parsed);
    Object.assign(result, normalized);

    // Handle new structured format
    if (parsed.bestOption || normalized.bestOption) {
      result.bestOption = normalized.bestOption;
      result.alternatives = normalized.alternatives || [];
      result.highlights = normalized.highlights || [];
      result.actions = normalized.actions || [];
      result.summary = normalized.summary || [];
      result.timeline = normalized.timeline;
      result.budget = normalized.budget;
      result.notes = typeof parsed.notes === 'string' && parsed.notes.length < 100 ? parsed.notes : '';

      // Convert to legacy items format for backward compatibility
      result.items = result.bestOption ? [result.bestOption, ...result.alternatives] : [];
      result.links = result.actions.map(action => action.url).filter(Boolean);
    } else {
      // Handle legacy format
      result.items = normalizeItemsByResultType(result.resultType, parsed.items);
      result.links = Array.isArray(parsed.links)
        ? parsed.links.filter((link) => typeof link === 'string' && link.trim())
        : [];
      result.notes =
        typeof parsed.notes === 'string'
          ? parsed.notes
          : typeof parsed.summary === 'string'
          ? parsed.summary
          : '';

      // Derive new format from legacy
    if (result.items.length > 0) {
        result.bestOption = result.items[0];
        result.alternatives = result.items.slice(1, 3);
        result.highlights = result.notes ? result.notes.split(/[.!?]+/).slice(0, 3).map(s => s.trim()).filter(Boolean) : [];
        result.actions = result.links.slice(0, 3).map(url => ({ label: 'Open link', url }));
        result.summary = result.highlights.slice(0, 3);
        result.assumptions = result.highlights.filter((item) => /assum/i.test(item)).slice(0, 2);
      }
    }

    return result;
  }

  // Plain text fallback - try to parse structure
  const plainTextStructure = parseStructuredResponse(aiText);
  if (plainTextStructure.bestOption || plainTextStructure.highlights.length > 0) {
    result.bestOption = plainTextStructure.bestOption;
    result.alternatives = plainTextStructure.alternatives;
    result.highlights = plainTextStructure.highlights;
    result.assumptions = plainTextStructure.assumptions;
    result.actions = plainTextStructure.actions;
    result.summary = plainTextStructure.summary;
    result.items = result.bestOption ? [result.bestOption, ...result.alternatives] : [];
    result.links = result.actions.map(a => a.url).filter(Boolean);
  } else {
    result.notes = aiText;
  }

  return result;
}


function buildExecutionResponse(result = {}) {
  const resultType = normalizeResultType(result.resultType);
  const items = normalizeItemsByResultType(resultType, result.items);

  const response = {
    result: {
      title:
        typeof result.title === 'string' && result.title.trim()
          ? result.title.trim()
          : 'Step result',
      resultType,
      items,
      links: Array.isArray(result.links)
        ? result.links.filter((link) => typeof link === 'string' && link.trim())
        : [],
      notes: typeof result.notes === 'string' && result.notes.length < 150 ? result.notes : '',
    },
  };

  // Only add structured fields if they have content (not undefined)
  if (Array.isArray(result.summary) && result.summary.length > 0) {
    response.result.summary = result.summary.slice(0, 3);
  }
  if (Array.isArray(result.highlights) && result.highlights.length > 0) {
    response.result.highlights = result.highlights.slice(0, 3);
  }
  if (Array.isArray(result.assumptions) && result.assumptions.length > 0) {
    response.result.assumptions = result.assumptions.slice(0, 3);
  }
  if (result.bestOption && typeof result.bestOption === 'object') {
    response.result.bestOption = result.bestOption;
  }
  if (Array.isArray(result.alternatives) && result.alternatives.length > 0) {
    response.result.alternatives = result.alternatives.slice(0, 2);
  }
  if (Array.isArray(result.actions) && result.actions.length > 0) {
    response.result.actions = result.actions.slice(0, 3);
  }
  if (Array.isArray(result.timeline) && result.timeline.length > 0) {
    response.result.timeline = result.timeline;
  }
  if (Array.isArray(result.budget) && result.budget.length > 0) {
    response.result.budget = result.budget;
  }

  return response;
}

function createGenericItem(item = {}) {
  if (typeof item === 'string') {
    return { label: item.trim() };
  }

  if (!item || typeof item !== 'object') return null;

  return {
    label: typeof item.label === 'string' ? item.label.trim() : '',
    subtitle: typeof item.subtitle === 'string' ? item.subtitle.trim() : undefined,
    price: typeof item.price === 'string' ? item.price.trim() : undefined,
    rating: typeof item.rating === 'string' ? item.rating.trim() : undefined,
    thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail.trim() : undefined,
    link: typeof item.link === 'string' ? item.link.trim() : undefined,
    metadata: Array.isArray(item.metadata)
      ? item.metadata.filter((value) => typeof value === 'string' && value.trim())
      : undefined,
    checked: typeof item.checked === 'boolean' ? item.checked : undefined,
    time: typeof item.time === 'string' ? item.time.trim() : undefined,
    value: typeof item.value === 'string' ? item.value.trim() : undefined,
    columns: Array.isArray(item.columns)
      ? item.columns.filter((value) => typeof value === 'string' && value.trim())
      : undefined,
  };
}

function createListingItem(item = {}) {
  return createGenericItem(item);
}

function normalizeListingItems(items) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => createListingItem(item))
    .filter((item) => item && item.label);
}

function normalizeItemsByResultType(resultType, items) {
  const normalizedType = normalizeResultType(resultType);
  if (!Array.isArray(items)) return [];

  if (normalizedType === 'cards' || normalizedType === 'comparison') {
    return normalizeListingItems(items);
  }

  return items
    .map((item) => createGenericItem(item))
    .filter((item) => item && item.label);
}

function getCardsFallback(step) {
  return {
    title: step.title,
    resultType: 'cards',
    summary: [
      `Best option: prioritize the strongest candidate for ${step.title.toLowerCase()}.`,
      'Estimated effort: start with the top option before comparing backups.',
      'Next step: open the primary source and validate fit.',
    ],
    highlights: [
      `Capability used: ${step.capability} to surface the best candidate quickly.`,
      'Alternative: compare one backup option if the first choice falls short.',
    ],
    assumptions: [
      'Assumption used: prioritize the most relevant option based on the stated request.',
    ],
    bestOption: {
      label: `${step.title} recommended option`,
      subtitle: step.purpose || 'Strong first-pass recommendation',
      metadata: ['Best estimate', 'Ready to refine'],
      link: 'https://example.com/recommendation',
    },
    alternatives: [
      {
        label: 'Lower-cost alternative',
        subtitle: 'Good backup if budget matters most.',
        metadata: ['Alternative'],
        link: 'https://example.com/alternative',
      },
    ],
    actions: [{ label: 'Open source', url: 'https://example.com/recommendation' }],
    items: normalizeItemsByResultType('cards', [
      {
        label: `${step.title} recommended option`,
        subtitle: step.purpose || 'Strong first-pass recommendation',
        metadata: ['Best estimate', 'Ready to refine'],
        link: 'https://example.com/recommendation',
      },
      {
        label: 'Lower-cost alternative',
        subtitle: 'Good backup if budget matters most.',
        metadata: ['Alternative'],
        link: 'https://example.com/alternative',
      },
    ]),
    notes: 'Recommendation-first fallback generated from available context.',
    links: ['https://example.com/recommendation', 'https://example.com/alternative'],
  };
}

function getChecklistFallback(step) {
  return {
    title: step.title,
    resultType: 'checklist',
    summary: [
      `Best option: follow this checklist to complete ${step.title.toLowerCase()}.`,
      'Estimated effort: short first-pass checklist based on available info.',
      'Next step: complete the first two items, then continue execution.',
    ],
    assumptions: ['Assumption used: standard constraints apply unless specified otherwise.'],
    items: [
      { label: step.purpose || 'Confirm the main requirement', checked: false },
      { label: 'Review the recommended path first', checked: false },
      { label: 'Refine this step for more precision', checked: false },
    ],
    highlights: ['Why this was chosen: it creates a clear starting point immediately.'],
    actions: [],
    notes: 'Recommendation-first checklist generated from available context.',
    links: [],
  };
}

function getTimelineFallback(step) {
  return {
    title: step.title,
    resultType: 'timeline',
    summary: [
      `Best option: follow this phased plan for ${step.title.toLowerCase()}.`,
      'Estimated scope: simple first-pass sequence.',
      'Next step: start with Phase 1 and confirm the schedule.',
    ],
    assumptions: ['Assumption used: earliest practical schedule unless stated otherwise.'],
    timeline: [
      {
        day: 'Phase 1',
        items: [{ time: 'Start', label: step.title, subtitle: step.purpose || 'Initial action' }],
      },
      {
        day: 'Phase 2',
        items: [{ time: 'Next', label: 'Review options', subtitle: 'Choose the best fit' }],
      },
    ],
    highlights: ['Why this was chosen: it gives an actionable sequence immediately.'],
    notes: 'Recommendation-first timeline generated from available context.',
    items: [],
    links: [],
  };
}

function getSummaryFallback(step) {
  return {
    title: step.title,
    resultType: 'summary',
    items: [],
    summary: [
      `Best option: proceed with the strongest recommendation for ${step.title.toLowerCase()}.`,
      `Capability used: ${step.capability} to turn the available evidence into a decision.`,
      'Next step: take the recommended action.',
    ],
    assumptions: ['Assumption used: standard constraints apply unless otherwise stated.'],
    highlights: ['Why this was chosen: it provides a usable first-pass recommendation immediately.'],
    notes: 'Recommendation generated from the currently available context.',
    links: [],
  };
}

function getLinksFallback(step) {
  return {
    title: step.title,
    resultType: 'links',
    summary: [
      `Best option: start with the top source for ${step.title.toLowerCase()}.`,
      'Estimated effort: quick review of the first two sources.',
      'Next step: open the primary source first, then compare the backup.',
    ],
    assumptions: ['Assumption used: official or primary sources should be preferred first.'],
    actions: [
      { label: 'Official site', url: 'https://example.com/official' },
      { label: 'Source', url: 'https://example.com/source' },
    ],
    items: [
      { label: 'Official site', link: 'https://example.com/official' },
      { label: 'Source', link: 'https://example.com/source' },
    ],
    notes: 'Recommendation-first links generated from available context.',
    links: ['https://example.com/official', 'https://example.com/source'],
  };
}

function getTableFallback(step) {
  return {
    title: step.title,
    resultType: 'comparison',
    summary: [
      `Best option: compare the key variables for ${step.title.toLowerCase()}.`,
      'Estimated scope: short comparison table based on first-pass assumptions.',
      'Next step: pick the strongest row and refine if needed.',
    ],
    assumptions: ['Assumption used: compare the most decision-relevant fields first.'],
    highlights: ['Why this was chosen: it makes tradeoffs visible immediately.'],
    items: [
      { label: 'Primary option', value: 'Recommended', columns: ['Priority', 'Value'] },
      { label: 'Backup option', value: 'Alternative', columns: ['Priority', 'Value'] },
    ],
    notes: 'Recommendation-first table generated from available context.',
    links: [],
  };
}

function getComparisonFallback(step) {
  return getTableFallback(step);
}

function getFallbackStepResult(step) {
  const normalizedType = normalizeResultType(step.resultType);

  switch (normalizedType) {
    case 'cards':
      return getCardsFallback(step);
    case 'checklist':
      return getChecklistFallback(step);
    case 'timeline':
      return getTimelineFallback(step);
    case 'links':
      return getLinksFallback(step);
    case 'table':
      return getTableFallback(step);
    case 'comparison':
      return getComparisonFallback(step);
    case 'summary':
    default:
      return getSummaryFallback(step);
  }
}

function ensureRecommendationFirstResult(step, rawResult = {}) {
  const fallback = getFallbackStepResult(step);
  const merged = {
    ...fallback,
    ...rawResult,
  };

  if (!Array.isArray(merged.summary) || merged.summary.length === 0) {
    merged.summary = fallback.summary;
  }
  if (!Array.isArray(merged.highlights) || merged.highlights.length === 0) {
    merged.highlights = fallback.highlights || [];
  }
  if (!Array.isArray(merged.assumptions) || merged.assumptions.length === 0) {
    merged.assumptions = fallback.assumptions || [];
  }
  if (!merged.bestOption && fallback.bestOption) {
    merged.bestOption = fallback.bestOption;
  }
  if (!Array.isArray(merged.alternatives) || merged.alternatives.length === 0) {
    merged.alternatives = fallback.alternatives || [];
  }
  if (!Array.isArray(merged.actions) || merged.actions.length === 0) {
    merged.actions = fallback.actions || [];
  }
  if (!Array.isArray(merged.items) || merged.items.length === 0) {
    merged.items = fallback.items || [];
  }
  if (!Array.isArray(merged.links) || merged.links.length === 0) {
    merged.links = fallback.links || [];
  }
  if (!merged.notes || /unavailable|need more detail|needs more constraints/i.test(merged.notes)) {
    merged.notes = fallback.notes || 'Recommendation-first result generated with reasonable assumptions.';
  }

  return merged;
}

function getSafeStep(step = {}) {
  return {
    id: step?.id || 'step-fallback',
    title:
      typeof step?.title === 'string' && step.title.trim()
        ? step.title.trim()
        : 'Fallback step',
    capability: normalizeCapability(step?.capability),
    connectors: normalizeConnectors(step?.connectors || step?.dataSources || step?.sources),
    type:
      typeof step?.type === 'string' && step.type.trim() ? step.type.trim() : 'general',
    purpose:
      typeof step?.purpose === 'string' && step.purpose.trim() ? step.purpose.trim() : '',
    resultType: normalizeResultType(step?.resultType),
  };
}

function fallbackFinalSummary(projectTitle, steps) {
  const completedSteps = (steps || []).filter((step) => step?.result);
  const firstBestOption = completedSteps.find((step) => step.result?.bestOption)?.result?.bestOption;
  const firstBudget = completedSteps.find((step) => step.result?.budget?.length)?.result?.budget?.[0]?.value;
  const firstAction = completedSteps.find((step) => step.result?.actions?.length)?.result?.actions?.[0]?.label;
  const firstAssumption = completedSteps.find((step) => step.result?.assumptions?.length)?.result?.assumptions?.[0];

  const summary = [
    firstBestOption
      ? `Best option: ${firstBestOption.label}`
      : `Best option: strongest recommendation for ${projectTitle}`,
    firstBudget
      ? `Estimated cost: ${firstBudget}`
      : 'Estimated cost: moderate first-pass estimate',
    firstAction
      ? `Next action: ${firstAction}`
      : firstAssumption
      ? `Assumption used: ${firstAssumption}`
      : 'Next action: review the recommendation and refine if needed',
  ].slice(0, 3);

  const sections = completedSteps
    .map((step) => ({
      title: step.title || 'Step',
      content: (Array.isArray(step.result?.items) ? step.result.items : [])
        .map((item) =>
          [item.label, item.price, item.rating].filter(Boolean).join(' • ')
        )
        .concat(step.result?.notes ? [step.result.notes] : []),
    }));

  return {
    summary,
    summarySections: sections,
  };
}

app.get('/', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/plan', async (req, res) => {
  console.log('POST /plan hit');
  console.log('Request body:', req.body);
  const { request, task } = req.body;
  const userRequest =
    typeof request === 'string'
      ? request.trim()
      : typeof task === 'string'
      ? task.trim()
      : '';

  console.log('Task text:', userRequest);

  if (!userRequest) {
    return res.status(400).json({
      error: 'Task is required',
      taskType: 'general',
      steps: [],
      summary: '',
      summarySections: [],
    });
  }

  try {
    const plan = await planSteps(userRequest);
    console.log('Raw AI response:', plan);
    return res.json(plan);
  } catch (error) {
    console.error('Plan route error:', error);
    return res.json({
      taskType: 'general',
      steps: [],
      summary: 'Could not process this task.',
      summarySections: [],
      error: error?.message || 'Unknown error',
    });
  }
});

app.post('/task', async (req, res) => {
  console.log('POST /task hit (alias for /plan)');

  const { task } = req.body;
  if (!task || typeof task !== 'string') {
    return res.status(400).json({
      error: 'task is required',
      taskType: 'general',
      steps: [],
      summary: '',
      summarySections: [],
    });
  }

  try {
    const plan = await planSteps(task);
    return res.json(plan);
  } catch (err) {
    console.error('/task error:', err.message);
    return res.json({
      ...fallbackPlan(task),
      error: err.message,
    });
  }
});

app.post('/execute-step', async (req, res) => {
  console.log('POST /execute-step hit');
  console.log('/execute-step incoming request body:', req.body);
  const { projectTitle, userRequest, step } = req.body || {};
  const safeStep = getSafeStep(step);
  const safeProjectTitle =
    typeof projectTitle === 'string' && projectTitle.trim()
      ? projectTitle.trim()
      : 'Untitled task';
  const safeUserRequest =
    typeof userRequest === 'string' && userRequest.trim()
      ? userRequest.trim()
      : safeProjectTitle;
  const hasValidInput =
    Boolean(projectTitle) && Boolean(userRequest) && Boolean(step?.title);
  console.log('/execute-step validation outcome:', {
    hasValidInput,
    safeProjectTitle,
    safeUserRequest,
    safeStep,
  });

  const dateContext = getDateContext();
  const systemPrompt = `
You are an execution agent. Complete ONE step for a larger task.
Today is ${dateContext.todayISO} in ${dateContext.timezone}. Resolve relative date phrases like 'this weekend', 'tomorrow', and 'next Friday' before answering. Do not leave placeholders like [insert date].

INPUT:
User request: ${safeUserRequest}
Step title: ${safeStep.title}
Step purpose: ${safeStep.purpose}
Capability: ${safeStep.capability}
Preferred result type: ${safeStep.resultType}
Available connectors: ${safeStep.connectors.join(', ') || 'internal'}

THINKING STEP (internal, do not output):

- Validate if the step request is feasible
- If not feasible, adjust using real-world alternatives
- Extract constraints from user request
- Construct a realistic solution path before answering

GOAL:
Produce a useful, actionable result for THIS step only.
Do NOT repeat other steps. Do NOT be generic.

RULES:
- Be concise and structured
- Make real recommendations, not placeholders
- Use reasonable assumptions if needed
- Add links where possible
- Avoid repeating the same info across steps
- Never say "not available"
- Never say "insufficient data"
- Never return empty results
- Always produce something useful
- Best recommendation first
- 1 to 2 alternatives max
- 3 bullets max
- 1 clear action
- A recommendation is valid ONLY if it includes:
  - a real identifiable entity such as a name, place, product, service, provider, venue, or organization
  - at least 2 concrete details such as price, rating, time, or location
  - 1 working link to an official, booking, primary, or product page
  - 1 reason it fits the user's constraints
- If these are missing, do not return the result. Improve or regenerate it first.
- Use the capability to decide what this step should do:
  - search: identify real, verifiable options
  - compare: identify real, verifiable options and show differences
  - extract: pull required facts, requirements, or fields
  - summarize: compress findings into a clear conclusion
  - schedule: build a sequenced timeline or schedule
  - recommend: choose the best overall path and next action
- Include concrete details such as price, rating, time, or location when relevant
- Include one actionable link when relevant
- Avoid generic or placeholder responses
- Never return generic phrases without data
- Never return placeholders such as example.com, "recommended option", or "#"
- Always make a best-effort real-world recommendation using reasonable assumptions
- Do not use filler phrases like:
  - practical default
  - moderate budget
  - refine further
  - recommendation-first summary generated from available context
- Stay strictly within this step's scope
- If connectors are provided, prefer them when shaping the result
- Keep recommendations distinct from other steps in the same task
- Validate that the recommendation is realistic, consistent, and actionable before returning. Improve it if needed.

OUTPUT FORMAT (JSON ONLY):
{
  "title": "...",
  "resultType": "...",
  "summary": ["max 3 bullet points"],
  "bestOption": {
    "label": "...",
    "price": "...",
    "rating": "...",
    "link": "..."
  },
  "alternatives": [],
  "highlights": ["key insights"],
  "actions": [{"label": "clear next step", "url": "working https:// link"}]
}

CAPABILITY BEHAVIOR:
- search:
  - must return 2 to 3 real candidates with working links
  - explain why the top candidate is strongest
- compare:
  - rank the best 2 to 3 options
  - must show differences such as price, rating, time, or location
- extract:
  - return required facts, fields, constraints, or checklist items only
- summarize:
  - return the clearest decision-ready conclusion with supporting bullets
- schedule:
  - return a timeline with ordered phases, times, or milestones
- recommend:
  - must include the best option, a working link, and a reason it fits the user's constraints
- Final self-check:
  - Is this usable, specific, and consistent?
  - Does this include a real option, real details, and a usable link?
  - If not, fix it before returning.
- FINAL CHECK:
  - Is this realistic?
  - Does this violate any real-world constraint?
  - Does it include a real option with details?
  - Would a user act on this immediately?
  - If not → fix before returning
`;

  const userPrompt = `Project: ${safeProjectTitle}
Request: ${safeUserRequest}
Execute step: ${safeStep.title}
Capability: ${safeStep.capability}
Preferred result type: ${safeStep.resultType}
Connectors: ${safeStep.connectors.join(', ') || 'internal'}
Step purpose: ${safeStep.purpose}`;
  const placeholderResult = getFallbackStepResult(safeStep);

  try {
    if (!hasValidInput) {
      console.log('/execute-step fallback usage:', 'missing required input');
      const fallbackResponse = buildExecutionResponse(
        ensureRecommendationFirstResult(safeStep, placeholderResult)
      );
      console.log('/execute-step final response payload:', fallbackResponse);
      return res.json(fallbackResponse);
    }

    const aiText = await callAI({ systemPrompt, userPrompt });
    console.log('/execute-step AI/provider result:', aiText);

    const llmResult = normalizeExecutionResult(
      safeStep.title,
      safeStep.resultType,
      aiText
    );
    const result = ensureRecommendationFirstResult(safeStep, {
      title: llmResult.title || placeholderResult.title,
      resultType: llmResult.resultType || placeholderResult.resultType,
      items: llmResult.items.length ? llmResult.items : placeholderResult.items,
      links:
        llmResult.links && llmResult.links.length
          ? llmResult.links
          : placeholderResult.links,
      notes: llmResult.notes || placeholderResult.notes,
      summary: llmResult.summary,
      highlights: llmResult.highlights,
      assumptions: llmResult.assumptions,
      bestOption: llmResult.bestOption,
      alternatives: llmResult.alternatives,
      actions: llmResult.actions,
      timeline: llmResult.timeline,
      budget: llmResult.budget,
    });
    const finalResponse = buildExecutionResponse(result);
    console.log('/execute-step final response payload:', finalResponse);
    return res.json(finalResponse);
  } catch (err) {
    console.error('/execute-step error', err.message);
    console.log('/execute-step fallback usage:', 'provider error');
    const fallbackResponse = buildExecutionResponse(
      ensureRecommendationFirstResult(safeStep, placeholderResult)
    );
    console.log('/execute-step final response payload:', fallbackResponse);
    return res.json({
      ...fallbackResponse,
      error: err.message,
    });
  }
});

app.post('/refine-step', async (req, res) => {
  console.log('POST /refine-step hit');
  const { projectTitle, userRequest, step, refinePrompt, refinement } = req.body;

  const finalRefinement =
    typeof refinePrompt === 'string'
      ? refinePrompt.trim()
      : typeof refinement === 'string'
      ? refinement.trim()
      : '';

  if (!projectTitle || !userRequest || !step || !step.title || !finalRefinement) {
    return res.status(400).json({
      error:
        'projectTitle, userRequest, step, and refinePrompt/refinement are required',
    });
  }

  const dateContext = getDateContext();
  const systemPrompt = `
You are an AI assistant refining a previous result.
Today is ${dateContext.todayISO} in ${dateContext.timezone}. Resolve relative date phrases like 'this weekend', 'tomorrow', and 'next Friday' before answering. Do not leave placeholders like [insert date].

Provide concise actionable refined output in listing-card format.

Return JSON when possible:
{
  "title": "...",
  "items": [
    {
      "label": "string",
      "subtitle": "string",
      "price": "string",
      "rating": "string",
      "thumbnail": "https://...",
      "link": "https://...",
      "metadata": ["string"]
    }
  ],
  "notes": "..."
}
`;

  const userPrompt = `Project: ${projectTitle}
Request: ${userRequest}
Step: ${step.title}
Current result: ${JSON.stringify(step.result || {})}
Refinement: ${finalRefinement}`;

  try {
    const aiText = await callAI({ systemPrompt, userPrompt });

    const safeStep = getSafeStep({
      ...step,
      resultType: step?.result?.resultType || step?.resultType,
    });
    const llmResult = normalizeExecutionResult(
      safeStep.title,
      safeStep.resultType,
      aiText
    );
    return res.json(buildExecutionResponse(llmResult));
  } catch (err) {
    console.error('/refine-step error', err.message);
    const safeStep = getSafeStep({
      ...step,
      resultType: step?.result?.resultType || step?.resultType,
    });
    return res.json({
      ...buildExecutionResponse(getFallbackStepResult(safeStep)),
      error: err.message,
    });
  }
});

app.post('/final-summary', async (req, res) => {
  console.log('POST /final-summary hit');
  const { projectTitle, userRequest, completedSteps, steps } = req.body;

  const finalSteps = Array.isArray(completedSteps)
    ? completedSteps
    : Array.isArray(steps)
    ? steps
    : [];

  if (!projectTitle || !userRequest || !Array.isArray(finalSteps)) {
    return res.status(400).json({
      error: 'projectTitle, userRequest, and completedSteps/steps are required',
    });
  }

  const stepSummaries = finalSteps
    .filter((step) => step?.result)
    .map((step, idx) => {
      const resultText =
        typeof step.result === 'string'
          ? step.result
          : JSON.stringify(step.result || {});
      return `${idx + 1}. ${step.title || `Step ${idx + 1}`}: ${resultText}`;
    })
    .join('\n');

  const dateContext = getDateContext();
  const systemPrompt = `
You are an AI summary generator.
Today is ${dateContext.todayISO} in ${dateContext.timezone}. Resolve relative date phrases like 'this weekend', 'tomorrow', and 'next Friday' before answering. Do not leave placeholders like [insert date].

Return concise structured JSON only:
{
  "summary": [
    "Best option: Fly into Orlando (MCO)",
    "Stay: budget hotel in Kissimmee with good reviews", 
    "Next step: open the top flight and hotel links below"
  ],
  "summarySections": [
    {
      "title": "string",
      "content": ["string"]
    }
  ]
}

Rules:
- summary must be an array of max 3 bullet points
- each bullet must be short and actionable
- summary should always include:
  - best recommendation
  - cost or budget fit
  - next action
- no long paragraphs
- no explanation outside JSON
`;

  const userPrompt = `Project: ${projectTitle}
Original request: ${userRequest}

Completed step results:
${stepSummaries}`;

  try {
    const aiText = await callAI({ systemPrompt, userPrompt });

    const parsed = parsePossiblyMessyJSON(aiText);

    if (parsed) {
      let summary = parsed.summary;
      let summarySections = Array.isArray(parsed.summarySections)
        ? parsed.summarySections
        : Array.isArray(parsed.sections)
        ? parsed.sections
        : [];

      // Handle array format
      if (Array.isArray(summary)) {
        summary = summary.slice(0, 3); // Max 3 bullets
      } else if (typeof summary === 'string') {
        // Convert string to array if possible
        const bullets = summary.split(/[.!?]+/).slice(0, 3).map(s => s.trim()).filter(Boolean);
        summary = bullets.length > 0 ? bullets : [summary];
      } else {
        summary = ['Summary completed successfully'];
      }

      console.log('Final-summary route: parsed JSON successfully');
      return res.json({
        summary,
        summarySections,
      });
    }

    return res.json(fallbackFinalSummary(projectTitle, finalSteps));
  } catch (err) {
    console.error('/final-summary error', err.message);
    return res.json({
      ...fallbackFinalSummary(projectTitle, finalSteps),
      error: err.message,
    });
  }
});

app.post('/chat', async (req, res) => {
  console.log('POST /chat hit');
  const { messages } = req.body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const dateContext = getDateContext();
  const systemPrompt = `
You are a helpful AI operator.
Today is ${dateContext.todayISO} in ${dateContext.timezone}. Resolve relative date phrases like 'this weekend', 'tomorrow', and 'next Friday' before answering. Do not leave placeholders like [insert date].

Respond clearly and concisely to the user's follow-up.
`;

  try {
    const fullMessages = [
      { role: 'system', content: GUARDRAILS },
      { role: 'system', content: systemPrompt },
      ...messages,
    ];
    const aiText = await openRouterChat(fullMessages);
    const cleanedText = cleanText(aiText);

    const parsed = parsePossiblyMessyJSON(cleanedText);

    if (parsed && typeof parsed === 'object') {
      console.log('Chat route: parsed JSON successfully');
      return res.json({
        result: parsed,
        summary: parsed.summary || parsed.recommendation || cleanedText,
        steps: Array.isArray(parsed.steps) ? parsed.steps : null,
      });
    }

    console.log('Chat route: fallback to text');
    return res.json({ result: cleanedText, summary: cleanedText });
  } catch (err) {
    console.error('/chat error', err.message);
    return res.json({
      result: 'I could not process that follow-up right now.',
      error: err.message,
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
