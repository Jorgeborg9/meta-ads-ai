require('dotenv').config()
const OpenAI = require('openai')
const { openAiModel } = require('./blogAgentConfig')

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Helper to pull JSON out of a string, tolerant of ``` fences
function extractJson(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('No content to parse as JSON')
  }
  const trimmed = content.trim()
  const fenceMatch = trimmed.match(/```(?:json)?([\s\S]*?)```/i)
  const inner = fenceMatch ? fenceMatch[1].trim() : trimmed
  const start = inner.indexOf('{')
  const end = inner.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not find JSON object in model content')
  }
  return JSON.parse(inner.slice(start, end + 1))
}

// Generate a blog article JSON for a given keyword/category
async function generateBlogArticle(keyword, categoryHint) {
  // 1) System: define InsightAdsAI, target audience, style
  const systemPrompt = `
You are an expert performance marketer writing for InsightAdsAI — a product that connects to Meta Ads, analyzes campaigns/ad sets/ads, and delivers daily, concrete recommendations to increase sales and ROAS with minimal spend. InsightAdsAI suggests budget changes, what to pause/scale, and provides clear reports for marketing managers who are not “performance nerds.”
Audience: marketing leads / e-com founders running Meta Ads who want smart budget use, higher ROAS, and clear guidance without deep data work.
Style: practical, concrete, data-driven. Avoid buzzwords. Use small examples (e.g., “imagine you’re running a prospecting campaign with 3 ad sets...”) and “do this, avoid this” tips. Mention InsightAdsAI naturally when relevant, but do not make the article a pure ad.
Focus only on Meta Ads, ROAS/profit, creative testing, budget allocation across campaigns/ad sets/ads, attribution, and data-driven decisions. Avoid generic AI/marketing filler.
Return only CLEAN JSON, no code fences, no prose.`

  // 2) User: pass keyword and request strict JSON schema
  const userPrompt = `
Generate a blog article in JSON format about "${keyword}".
Category hint: "${categoryHint || 'meta ads'}".
Keep focus on Meta Ads (not Google), ROAS, profit, creative testing, budget allocation, attribution, data-driven moves.
Tone: clear, actionable, minimal fluff, with short examples and “do this / avoid this” guidance. Mention InsightAdsAI naturally where it helps.

Return JSON exactly in this shape (keys must match):
{
  "title": "string",
  "intro": "short intro paragraph",
  "outline": [
    "Section heading 1",
    "Section heading 2"
  ],
  "sections": [
    {
      "heading": "H2 heading",
      "body": "multi-paragraph body text in markdown"
    }
  ],
  "seoTitle": "string",
  "seoDescription": "string",
  "heroImagePrompt": "prompt for a clean, modern Meta Ads dashboard/analytics hero image (no cheesy stock)",
  "socialImagePrompt": "prompt for an eye-catching Meta Ads/digital performance social share image, simple composition, clean modern style"
}
Ensure all fields are filled and the JSON is valid, with no extra text.`

  const response = await client.responses.create({
    model: openAiModel,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_output_tokens: 1200,
  })

  const rawContent = response.output[0].content[0].text
  let parsed
  try {
    parsed = extractJson(rawContent)
  } catch (err) {
    console.error('Failed to parse OpenAI JSON:', err.message)
    console.error('Raw content:', rawContent)
    throw err
  }

  // 3) Ensure sections exist (fallback if model used a single content field)
  if (!Array.isArray(parsed.sections) && parsed.content) {
    parsed.sections = [{ heading: 'Main Content', body: parsed.content }]
  }
  if (!Array.isArray(parsed.sections)) {
    parsed.sections = []
  }

  return {
    title: parsed.title || '',
    intro: parsed.intro || '',
    outline: parsed.outline || [],
    sections: parsed.sections,
    seoTitle: parsed.seoTitle || '',
    seoDescription: parsed.seoDescription || '',
    heroImagePrompt: parsed.heroImagePrompt || '',
    socialImagePrompt: parsed.socialImagePrompt || '',
  }
}

// Preserve existing client export and add generator helper
client.generateBlogArticle = generateBlogArticle
module.exports = client
