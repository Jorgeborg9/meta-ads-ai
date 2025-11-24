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
      const metrics = rows.map((row) => {
        const reach = parseInt(row['Reach'], 10) || 0
        const impressions = parseInt(row['Impressions'], 10) || 0
        const frequency = parseFloat(row['Frequency']) || 0
        const cpm = parseFloat(row['CPM (cost per 1,000 impressions) (NOK)']) || 0
        const costPerResult = parseFloat(row['Cost per results']) || 0
        const purchases = parseInt(row['Purchases'], 10) || 0
        const roas = parseFloat(row['Purchase ROAS (return on ad spend)']) || 0
        const amountSpent = parseFloat(row['Amount spent (NOK)']) || 0
        const cpa = purchases > 0 ? amountSpent / purchases : null

        return {
          adName: row['Ad name'] || '',
          adSetName: row['Ad set name'] || '',
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
