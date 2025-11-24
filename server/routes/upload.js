const express = require('express')
const multer = require('multer')
const csv = require('csv-parser')
const { Readable } = require('stream')

const router = express.Router()
const upload = multer({ storage: multer.memoryStorage() })

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' })
  }

  const readable = new Readable()
  readable.push(req.file.buffer)
  readable.push(null)

  const rows = []

  readable
    .pipe(csv())
    .on('data', (row) => {
      rows.push(row)
    })
    .on('end', () => {
      const normalizeKey = (key) =>
        String(key || '')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')

      const getFirst = (obj, keys) => {
        const normalized = {}
        for (const originalKey of Object.keys(obj)) {
          normalized[normalizeKey(originalKey)] = obj[originalKey]
        }
        for (const key of keys) {
          const candidate = normalized[normalizeKey(key)]
          if (candidate !== undefined && candidate !== null && candidate !== '') {
            return candidate
          }
        }
        return ''
      }

      const toNumber = (value) => {
        if (value === undefined || value === null || value === '') return 0
        if (typeof value === 'number') return value
        const cleaned = String(value).replace(/[^0-9,.\-]/g, '').replace(',', '.')
        const num = parseFloat(cleaned)
        return Number.isNaN(num) ? 0 : num
      }

      const toInt = (value) => {
        const n = toNumber(value)
        return Number.isFinite(n) ? Math.round(n) : 0
      }

      const metrics = rows.map((row) => {
        const reach = toInt(getFirst(row, ['Reach']))
        const impressions = toInt(getFirst(row, ['Impressions']))
        const frequency = toNumber(getFirst(row, ['Frequency']))
        const cpm = toNumber(getFirst(row, ['CPM (cost per 1,000 impressions) (NOK)', 'CPM']))
        const costPerResult = toNumber(getFirst(row, ['Cost per results']))
        const purchases = toInt(getFirst(row, ['Purchases', 'Results']))
        const roas = toNumber(getFirst(row, ['Purchase ROAS (return on ad spend)', 'ROAS']))
        const amountSpent = toNumber(getFirst(row, ['Amount spent (NOK)', 'Amount spent']))
        const cpa = purchases > 0 ? amountSpent / purchases : null

        return {
          adName: getFirst(row, ['Ad name']),
          adSetName: getFirst(row, ['Ad set name', 'Ad set']),
          reach,
          impressions,
          frequency,
          cpm,
          costPerResult,
          purchases,
          qualityRanking: row['Quality ranking'] || '',
          engagementRateRanking: row['Engagement rate ranking'] || '',
          conversionRateRanking: row['Conversion rate ranking'] || '',
          roas,
          amountSpent,
          cpa,
        }
      })

      res.json({ rowCount: rows.length, rows, metrics })
    })
    .on('error', (error) => {
      console.error('CSV parsing error:', error)
      res.status(500).json({ error: 'Failed to parse CSV' })
    })
})

module.exports = router
