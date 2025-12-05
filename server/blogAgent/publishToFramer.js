// NOTE: Endpoint and field keys are placeholders. Update to match your Framer CMS setup.
// Required env vars:
// - FRAMER_CMS_API_BASE_URL
// - FRAMER_BLOG_COLLECTION_ID
// - FRAMER_CMS_API_TOKEN
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args))
const framerConfig = require('./framerCmsConfig')

async function publishArticleToFramer(article) {
  const { fields } = framerConfig
  const body = {
    collectionId: framerConfig.blogCollectionId,
    fields: {
      [fields.title]: article.title,
      [fields.date]: article.date,
      [fields.image]: article.heroImageUrl || null,
      [fields.timeToRead]: article.timeToRead,
      [fields.category]: article.category,
      [fields.content]: article.content,
      [fields.slug]: article.slug,
      [fields.metaTitle]: article.seoTitle,
      [fields.metaDescription]: article.seoDescription,
      [fields.socialImage]: article.socialImageUrl || article.heroImageUrl || null,
      [fields.featured]: article.featured || false,
    },
  }

  // TODO: Replace /cms/items with the real Framer CMS endpoint for creating items.
  const res = await fetch(`${framerConfig.apiBaseUrl}/cms/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${framerConfig.apiToken}`,
    },
    body: JSON.stringify(body),
  })

  if (res.ok) {
    const data = await res.json()
    return data
  }

  const errorText = await res.text()
  console.error('Framer CMS publish failed:', res.status, errorText)
  throw new Error(`Failed to publish to Framer CMS (status ${res.status})`)
}

module.exports = { publishArticleToFramer }
