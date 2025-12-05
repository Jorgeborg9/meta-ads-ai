// Blog agent draft generator
// Next steps:
// - Wire OpenAI result into CMS payload
// - Add publish call to Framer CMS with auth
// Required env vars:
// OPENAI_API_KEY
// FRAMER_CMS_API_BASE_URL
// FRAMER_BLOG_COLLECTION_ID
// FRAMER_CMS_API_TOKEN
// BLOG_AGENT_DRY_RUN=true (for testing)

const fs = require('fs')
const path = require('path')
const { pickNextKeyword, estimateReadingTimeMinutes, slugify } = require('./utils')
const { keywordsFile, categoryMap, openAiModel } = require('./blogAgentConfig')
const openai = require('./openaiClient') // text client
const { publishArticleToFramer } = require('./publishToFramer')
const { saveArticleAsMarkdown } = require('./saveAsMarkdown')
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))

// Helper: strip code fences and extract JSON object
function extractJsonFromContent(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('No content to parse as JSON')
  }

  const trimmed = content.trim()
  // If model wraps JSON in ```json ... ``` (or ``` ... ```), strip fences
  const fenceMatch = trimmed.match(/```(?:json)?([\s\S]*?)```/i)
  const inner = fenceMatch ? fenceMatch[1].trim() : trimmed

  // Extra safety: slice from first { to last }
  const start = inner.indexOf('{')
  const end = inner.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('Could not find JSON object in model content')
  }

  const jsonString = inner.slice(start, end + 1)
  return JSON.parse(jsonString)
}

const formatDate = (date) => {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = date.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

// Ensure article directory exists
function ensureArticleDir(slug) {
  const dir = path.join(__dirname, 'output', slug)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

// Fetch an image from Pixabay and save to disk; return file path or null on failure
async function fetchAndSavePixabayImage(query, filePath) {
  const apiKey = process.env.PIXABAY_API_KEY
  if (!apiKey) {
    console.warn('PIXABAY_API_KEY not set; skipping image fetch.')
    return null
  }
  if (!query) {
    console.warn('No query provided for Pixabay image; skipping.')
    return null
  }
  try {
    const url = `https://pixabay.com/api/?key=${encodeURIComponent(
      apiKey
    )}&q=${encodeURIComponent(query)}&image_type=photo&orientation=horizontal&safesearch=true`
    console.log('Requesting image from Pixabay with query:', query)
    const res = await fetch(url)
    if (!res.ok) {
      console.error('Pixabay API request failed with status', res.status)
      return null
    }
    const data = await res.json()
    if (!data.hits || !data.hits.length) {
      console.warn('No Pixabay hits found for query:', query)
      return null
    }
    const imageUrl = data.hits[0].largeImageURL || data.hits[0].webformatURL
    if (!imageUrl) {
      console.warn('No usable image URL returned for query:', query)
      return null
    }
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) {
      console.error('Failed to download image from Pixabay URL:', imageUrl)
      return null
    }
    const buffer = await imgRes.arrayBuffer()
    fs.writeFileSync(filePath, Buffer.from(buffer))
    console.log('Saved image:', filePath)
    return filePath
  } catch (err) {
    console.error('Pixabay image fetch failed for query:', query, err.message)
    return null
  }
}

const generateArticleForKeyword = async ({ keyword, categoryHint }) => {
  // 1) System message: define InsightAdsAI, target audience, and writing style
  const systemPrompt = `
You are an expert performance marketer writing for InsightAdsAI — a product that connects to Meta Ads, analyzes campaigns/ad sets/ads, and gives daily, concrete recommendations to increase sales and ROAS with minimal spend. InsightAdsAI suggests budget changes, what to pause/scale, and provides clear reports for marketing managers who are not “performance nerds.”
Audience: marketing leads and e-com founders running Meta Ads who want smart budget use, higher ROAS, and clear guidance without deep data work.
Style: practical, concrete, data-driven. Avoid buzzwords and AI-filler. Use small examples (e.g., “imagine you’re running a prospecting campaign with 3 ad sets...”) and “do this, avoid this” tips. Mention InsightAdsAI naturally when relevant, but do not make the article a pure ad.
Focus only on Meta Ads, ROAS/profit, creative testing, budget allocation across campaigns/ad sets/ads, attribution, and data-driven decisions.
Return ONLY clean JSON (no code fences, no prose) matching the required schema (keys must match), with no code fences or extra text.`

  // 2) User message: pass keyword and request structured JSON output (schema unchanged)
  const userPrompt = `
Generate a blog article in JSON format about "${keyword}".
Category hint: "${categoryHint || 'meta ads'}".
Keep the focus on Meta Ads (not Google), ROAS, profit, creative testing, budget allocation, attribution, and data-driven moves.
Tone: clear, actionable, minimal fluff, with short examples and “do this / avoid this” guidance. Mention InsightAdsAI naturally where it helps.
Return JSON exactly in this shape (keys must match), with no code fences or extra text:
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
  "heroImagePrompt": "Realistic photo (not a UI mockup) of marketers/e-com founders collaborating in a modern workspace about ${keyword}. Natural light, authentic teamwork, professional look, diverse people, scene shows the keyword theme (e.g., creative testing, ROAS gains, attribution, budget strategy).",
  "socialImagePrompt": "Realistic, authentic photo tied to ${keyword}, showing marketers with laptops/creative materials discussing performance and growth. Close-up or symbolic but still real people, clean composition, natural light, no dashboard mockups."
}
Ensure all fields are filled and the JSON is valid.`

  const response = await openai.responses.create({
    model: openAiModel,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    max_output_tokens: 1200,
  })

  const content = response.output[0].content[0].text
  let parsed
  try {
    parsed = extractJsonFromContent(content)
  } catch (err) {
    console.error('Failed to parse OpenAI JSON:', err.message)
    console.error('Raw content:', content)
    process.exit(1)
  }
  if (!Array.isArray(parsed.sections) || !parsed.sections.length) {
    parsed.sections = [{ heading: 'Main Content', body: parsed.content || '' }]
  }
  return parsed
}

const run = async () => {
  try {
    const raw = fs.readFileSync(keywordsFile, 'utf-8')
    const keywords = JSON.parse(raw)
    const next = pickNextKeyword(keywords)
    if (!next) {
      console.error('No unused keywords available.')
      process.exit(1)
    }

    console.log('Selected keyword:', next)
    console.log('Generating article...')
    const aiData = await generateArticleForKeyword(next)
    console.log('Article text generated.')

    const today = new Date()
    const formattedDate = formatDate(today)

    const sectionsArray = aiData.sections || []
    const sectionsText = sectionsArray
      .map((section) => `## ${section.heading}\n\n${section.body}`)
      .join('\n\n')
    const content = `${aiData.intro}\n\n${sectionsText}`.trim()

    const timeToRead = estimateReadingTimeMinutes(content)
    const category =
      (next.categoryHint && categoryMap[next.categoryHint.toLowerCase()]) || 'Meta Ads'

    const slug = slugify(aiData.title || next.keyword || 'insightadsai-article')

    const article = {
      keyword: next.keyword,
      title: aiData.title,
      intro: aiData.intro,
      outline: aiData.outline,
      sections: sectionsArray,
      content,
      seoTitle: aiData.seoTitle,
      seoDescription: aiData.seoDescription,
      heroImagePrompt: aiData.heroImagePrompt,
      socialImagePrompt: aiData.socialImagePrompt,
      heroImageUrl: null,
      socialImageUrl: null,
      slug,
      date: formattedDate,
      timeToRead,
      category,
      featured: false,
    }

    const dryRun = process.env.BLOG_AGENT_DRY_RUN === 'true'
    const saveLocally = process.env.BLOG_SAVE_LOCALLY === 'true'

    // Generate images unless dry run (now via Pixabay)
    if (!dryRun) {
      console.log('Image generation enabled.')
      const articleDir = ensureArticleDir(slug)
      const baseQuery =
        article.keyword ||
        article.slug ||
        article.seoTitle ||
        article.title ||
        'digital marketing'
      const heroQuery = `${baseQuery} marketing team people`
      const socialQuery = `${baseQuery} digital advertising people`

      try {
        if (article.heroImagePrompt) {
          console.log('Fetching hero image from Pixabay...')
          const heroPath = path.join(articleDir, 'hero.jpg')
          const res = await fetchAndSavePixabayImage(heroQuery, heroPath)
          if (res) {
            article.heroImageUrl = path.relative(path.join(__dirname, 'output'), res)
            console.log('Hero image saved to:', article.heroImageUrl)
          } else {
            console.log('Hero image was not generated.')
          }
        } else {
          console.log('No heroImagePrompt provided; skipping hero image.')
        }

        if (article.socialImagePrompt) {
          console.log('Fetching social image from Pixabay...')
          const socialPath = path.join(articleDir, 'social.jpg')
          const res = await fetchAndSavePixabayImage(socialQuery, socialPath)
          if (res) {
            article.socialImageUrl = path.relative(path.join(__dirname, 'output'), res)
            console.log('Social image saved to:', article.socialImageUrl)
          } else {
            console.log('Social image was not generated.')
          }
        } else {
          console.log('No socialImagePrompt provided; skipping social image.')
        }
      } catch (err) {
        console.error('Image generation block failed:', err)
      }
    } else {
      console.log('Dry run enabled; skipping image generation.')
    }

    const preview = { ...article, content: '[omitted here]' }
    console.dir(preview, { depth: null })

    if (dryRun) {
      console.log('Dry run enabled (BLOG_AGENT_DRY_RUN=true). Skipping publish.')
      console.log('Done.')
      return
    }

    if (saveLocally) {
      try {
        const savedPath = saveArticleAsMarkdown(article)
        console.log('Saved article locally to:', savedPath)
        // Mark keyword as used only after successful save
        try {
          const updated = keywords.map((k) =>
            k.keyword === next.keyword && k.categoryHint === next.categoryHint ? { ...k, used: true } : k
          )
          fs.writeFileSync(keywordsFile, JSON.stringify(updated, null, 2), 'utf-8')
          console.log('Marked keyword as used in keywords file.')
        } catch (err) {
          console.error('Failed to update keywords file:', err)
        }
        console.log('Done.')
        return
      } catch (err) {
        console.error('Failed to save article locally:', err)
        process.exit(1)
      }
    }

    try {
      const res = await publishArticleToFramer(article)
      console.log('Published to Framer CMS:', res)
      // Mark keyword as used after successful publish
      try {
        const updated = keywords.map((k) =>
          k.keyword === next.keyword && k.categoryHint === next.categoryHint ? { ...k, used: true } : k
        )
        fs.writeFileSync(keywordsFile, JSON.stringify(updated, null, 2), 'utf-8')
        console.log('Marked keyword as used in keywords file.')
      } catch (err) {
        console.error('Failed to update keywords file:', err)
      }
    } catch (err) {
      console.error('Publish failed:', err)
      process.exit(1)
    }

    console.log('Done.')
  } catch (err) {
    console.error('Generation failed:', err)
    process.exit(1)
  }
}

run().catch((err) => {
  console.error('Generation failed:', err)
  process.exit(1)
})
