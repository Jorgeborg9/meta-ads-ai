const pickNextKeyword = (keywords) => {
  if (!Array.isArray(keywords) || !keywords.length) return null
  // pick the first keyword that is not marked as used
  const next = keywords.find((k) => !k.used)
  return next || null
}

const estimateReadingTimeMinutes = (text) => {
  if (!text) return 3
  const words = text.trim().split(/\s+/).length
  return Math.max(3, Math.round(words / 200))
}

const slugify = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

module.exports = {
  pickNextKeyword,
  estimateReadingTimeMinutes,
  slugify,
}
