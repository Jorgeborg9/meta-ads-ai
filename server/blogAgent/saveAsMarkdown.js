const fs = require('fs')
const path = require('path')

function saveArticleAsMarkdown(article) {
  if (!article || !article.title) {
    throw new Error('Missing article data to save.')
  }

  const outputDir = path.join(__dirname, 'output')
  fs.mkdirSync(outputDir, { recursive: true })

  const lines = []
  // Title
  lines.push(`# ${article.title}`)
  lines.push('')
  // Intro
  if (article.intro) {
    lines.push(article.intro.trim())
    lines.push('')
  }
  // Sections
  if (Array.isArray(article.sections)) {
    article.sections.forEach((sec) => {
      if (!sec || !sec.heading) return
      lines.push(`## ${sec.heading}`)
      lines.push('')
      if (sec.body) {
        lines.push(sec.body.trim())
        lines.push('')
      }
    })
  }
  // Meta block
  lines.push('---')
  lines.push(`SEO Title: ${article.seoTitle || ''}`)
  lines.push(`SEO Description: ${article.seoDescription || ''}`)
  lines.push(`Hero image prompt: ${article.heroImagePrompt || ''}`)
  lines.push(`Social image prompt: ${article.socialImagePrompt || ''}`)
  lines.push(`Time to read: ${article.timeToRead || ''} min`)
  lines.push(`Category: ${article.category || ''}`)
  lines.push('')

  const dateStr = article.date || ''
  const [dd, mm, yyyy] = dateStr.includes('.') ? dateStr.split('.') : ['', '', '']
  const isoDate = yyyy && mm && dd ? `${yyyy}-${mm}-${dd}` : new Date().toISOString().slice(0, 10)
  const slugPart = article.slug || 'article'
  const fileName = `${isoDate}-${slugPart}.md`
  const outPath = path.join(outputDir, fileName)

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8')
  console.log('Saved article locally to:', outPath)
  return outPath
}

module.exports = { saveArticleAsMarkdown }
