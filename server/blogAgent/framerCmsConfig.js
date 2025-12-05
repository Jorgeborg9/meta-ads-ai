require('dotenv').config()

// TODO: Fill in the real values for your Framer CMS setup:
// - apiBaseUrl: if Framer provides a different base
// - blogCollectionId: the collection ID from Framer CMS
// - apiToken: your Framer CMS API token
// - fields: adjust keys if your Framer collection uses different field names
module.exports = {
  apiBaseUrl: process.env.FRAMER_CMS_API_BASE_URL || 'https://api.framer.com',
  blogCollectionId: process.env.FRAMER_BLOG_COLLECTION_ID || 'REPLACE_ME',
  apiToken: process.env.FRAMER_CMS_API_TOKEN || 'REPLACE_ME',
  fields: {
    title: 'title',
    date: 'date',
    image: 'image',
    timeToRead: 'timeToRead',
    category: 'category',
    content: 'content',
    slug: 'slug',
    metaTitle: 'titleTag',
    metaDescription: 'metaDescription',
    socialImage: 'socialImage',
    featured: 'featured',
  },
}
