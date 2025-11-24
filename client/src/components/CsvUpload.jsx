import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const ANALYSIS_SETTINGS_KEY = 'metaAdsAnalysisSettings'

const loadAnalysisSettings = () => {
  if (typeof window === 'undefined') return null
  try {
    const stored = localStorage.getItem(ANALYSIS_SETTINGS_KEY)
    if (!stored) return null
    const parsed = JSON.parse(stored)
    if (parsed && typeof parsed === 'object') {
      return parsed
    }
  } catch (error) {
    console.warn('Failed to load analysis settings', error)
  }
  return null
}

const saveAnalysisSettings = (settings) => {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ANALYSIS_SETTINGS_KEY, JSON.stringify(settings))
  } catch (error) {
    console.warn('Failed to save analysis settings', error)
  }
}

const formatNumber = (value) => {
  if (value === null || typeof value === 'undefined' || Number.isNaN(value)) {
    return '-'
  }
  return Number(value).toFixed(2)
}

const formatCurrency = (value) => {
  if (value === null || typeof value === 'undefined') {
    return '-'
  }
  const numberValue = Number(value)
  if (Number.isNaN(numberValue)) {
    return '-'
  }
  return `${numberValue.toLocaleString('nb-NO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} kr`
}

const performanceBucketClassMap = {
  Winner: 'pill pill-winner',
  'Above average': 'pill pill-above',
  Average: 'pill pill-average',
  'Below average': 'pill pill-below',
  Poor: 'pill pill-below',
}

const getPerformanceBucketClass = (bucket) =>
  performanceBucketClassMap[bucket] || performanceBucketClassMap.Average

const isRealAdRow = (row) => {
  const adName = (row['Ad name'] || row.adName || '').trim()
  const adSet = (row['Ad set'] || row.adSet || '').trim()
  const purchases = Number(row['Purchases'] ?? row.purchases ?? 0)
  const roas = Number(row['ROAS'] ?? row.roas ?? 0)
  const amountSpent = Number(row['Amount spent'] ?? row.amountSpent ?? 0)

  if (!adName) return false

  const lowerName = adName.toLowerCase()
  if (lowerName.includes('total')) return false

  if (adSet === '-' || adSet === '—') return false

  if (purchases === 0 && roas === 0 && amountSpent > 100000) return false

  return true
}

// performanceScore: 0–100, based on ROAS, CPA and purchases.
// Goal: any ad with real results gets > 0, and better results push the score up.
const getPerformanceScore = (roas, cpa, purchases) => {
  let score = 0
  const roasVal = Number(roas) || 0
  const cpaVal = Number(cpa) || 0
  const p = Number(purchases) || 0

  if (p > 0) {
    score += 40
  }

  if (p >= 3) score += 10
  if (p >= 5) score += 10

  if (roasVal >= 1) score += 10
  if (roasVal >= 2) score += 10
  if (roasVal >= 3) score += 10

  if (p > 0 && cpaVal > 0) {
    if (cpaVal <= 300) {
      score += 20
    } else if (cpaVal <= 600) {
      score += 10
    }
  }

  if (score < 0) score = 0
  if (score > 100) score = 100

  return score
}

const getMetaRating = (roasValue) => {
  const roas = Number(roasValue) || 0
  if (roas >= 3) return 'Excellent vs Meta'
  if (roas >= 2) return 'Good vs Meta'
  if (roas >= 1) return 'OK vs Meta'
  if (roas > 0) return 'Weak vs Meta'
  return 'No purchases'
}

const getPerformanceBucketFromScore = (scoreValue) => {
  // Canonical mapping: same score always yields same bucket.
  const score = Number(scoreValue) || 0
  if (score >= 70) return 'Winner'
  if (score >= 55) return 'Above average'
  if (score >= 40) return 'Average'
  if (score >= 25) return 'Below average'
  if (score > 0) return 'Poor'
  return 'Poor'
}

const getMetricKey = (metric) => {
  const adName = (metric.adName || metric['Ad name'] || '').trim().toLowerCase()
  const adSet =
    (metric.adSetName || metric.adSet || metric['Ad set'] || metric['Ad set name'] || '').trim().toLowerCase()
  if (!adName && !adSet) {
    return null
  }
  return `${adName}|||${adSet}`
}

const transformUploadedMetrics = (rawMetrics = []) => {
  const cleanedRows = rawMetrics.filter(isRealAdRow)

  const enrichedMetrics = cleanedRows.map((row) => {
    const amountSpent = Number(row.amountSpent ?? row['Amount spent']) || 0
    const purchases = Number(row.purchases ?? row['Purchases']) || 0
    const roas =
      Number(
        row.roas ??
          row['ROAS'] ??
          row['Purchase ROAS (return on ad spend)'] ??
          row['Purchase ROAS'],
      ) || 0
    const cpa = purchases > 0 ? amountSpent / purchases : null
    const performanceScore = getPerformanceScore(roas, cpa, purchases)
    const campaignName =
      (row['Campaign name'] || row['Kampanjenavn'] || row['Campaign'] || row.campaignName || '').trim()

    return {
      ...row,
      amountSpent,
      purchases,
      roas,
      cpa,
      performanceScore,
      metaRating: getMetaRating(roas),
      campaignName,
    }
  })

  enrichedMetrics.forEach((metric) => {
    metric.filePerformanceBucket = getPerformanceBucketFromScore(metric.performanceScore)
  })

  const hasWinner = enrichedMetrics.some((metric) => metric.filePerformanceBucket === 'Winner')
  if (!hasWinner) {
    const nonZero = enrichedMetrics.filter((m) => m.performanceScore > 0)
    if (nonZero.length > 0) {
      const maxScore = Math.max(...nonZero.map((m) => m.performanceScore))
      nonZero.forEach((m) => {
        if (m.performanceScore === maxScore) {
          m.filePerformanceBucket = 'Winner'
        }
      })
    }
  }

  return enrichedMetrics
}

const buildComparisonMap = (currentMetrics, previousMetrics) => {
  if (!previousMetrics || previousMetrics.length === 0) {
    return {}
  }
  const previousMap = new Map()
  previousMetrics.forEach((metric) => {
    const key = getMetricKey(metric)
    if (!key) return
    previousMap.set(key, metric)
  })

  const comparison = {}
  currentMetrics.forEach((metric) => {
    const key = getMetricKey(metric)
    if (!key) return
    const previous = previousMap.get(key)
    if (!previous) return

    const currentRoas = typeof metric.roas === 'number' ? metric.roas : Number(metric.roas) || 0
    const previousRoas = typeof previous.roas === 'number' ? previous.roas : Number(previous.roas) || 0
    let roasChangePct = null
    if (previousRoas !== 0) {
      const change = ((currentRoas - previousRoas) / previousRoas) * 100
      if (Number.isFinite(change)) {
        roasChangePct = change
      }
    }

    const currentPurchases = Number(metric.purchases) || 0
    const previousPurchases = Number(previous.purchases) || 0
    const purchasesChange = currentPurchases - previousPurchases

    comparison[key] = {
      roasChangePct,
      purchasesChange,
    }
  })

  return comparison
}

const InfoTooltip = ({ text, children }) => {
  if (!text) {
    return children || null
  }
  const tooltipRoot = useMemo(() => {
    if (typeof document === 'undefined') return null
    return document.getElementById('tooltip-root') || document.body
  }, [])
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [placement, setPlacement] = useState('top')
  const triggerRef = useRef(null)
  const bubbleRef = useRef(null)

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !bubbleRef.current) return
    const triggerRect = triggerRef.current.getBoundingClientRect()
    const bubbleRect = bubbleRef.current.getBoundingClientRect()
    const padding = 8

    let top = triggerRect.top - bubbleRect.height - 10
    let nextPlacement = 'top'
    if (top < padding) {
      top = triggerRect.bottom + 10
      nextPlacement = 'bottom'
    }

    let left = triggerRect.left + triggerRect.width / 2 - bubbleRect.width / 2
    if (left < padding) left = padding
    const maxLeft = window.innerWidth - bubbleRect.width - padding
    if (left > maxLeft) {
      left = Math.max(maxLeft, padding)
    }

    setPosition({ top, left })
    setPlacement(nextPlacement)
  }, [])

  useEffect(() => {
    if (!visible) return undefined
    const raf = requestAnimationFrame(updatePosition)
    const handleReposition = () => updatePosition()
    window.addEventListener('scroll', handleReposition, true)
    window.addEventListener('resize', handleReposition)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', handleReposition, true)
      window.removeEventListener('resize', handleReposition)
    }
  }, [visible, updatePosition])

  const show = () => setVisible(true)
  const hide = () => setVisible(false)

  const TriggerElement = (
    <span
      className='info-tooltip'
      ref={triggerRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      role={children ? undefined : 'button'}
      tabIndex={children ? undefined : 0}
      aria-label={children ? undefined : text}
    >
      {children || <span className='info-icon'>?</span>}
    </span>
  )

  return (
    <>
      {TriggerElement}
      {visible && tooltipRoot
        ? createPortal(
            <div
              ref={bubbleRef}
              className={`info-bubble${placement === 'bottom' ? ' info-bubble-bottom' : ''}`}
              style={{ top: `${position.top}px`, left: `${position.left}px` }}
            >
              {text}
            </div>,
            tooltipRoot,
          )
        : null}
    </>
  )
}

const getRecommendedAction = (
  bucket,
  performanceScore,
  amountSpent,
  purchases,
  roas,
  cpa,
  scenarioRoasGoal,
  scenarioCpaGoal,
) => {
  const spend = amountSpent || 0
  const p = purchases || 0
  const roasVal = roas || 0
  const cpaVal = cpa || 0

  const roasOk = scenarioRoasGoal == null ? null : roasVal >= scenarioRoasGoal
  const hasValidCpa = p > 0 && cpaVal > 0
  const cpaOk =
    scenarioCpaGoal == null ? null : hasValidCpa ? cpaVal <= scenarioCpaGoal : null

  if (bucket === 'Poor' && spend > 2000 && p === 0) {
    return 'Pause'
  }

  if (bucket === 'Winner') {
    if ((roasOk === null || roasOk === true) && (cpaOk === null || cpaOk === true)) {
      return 'Skaler'
    }
    return 'Skaler lett'
  }

  if (bucket === 'Above average') {
    if (spend < 2000) {
      return 'Gi mer data'
    }
    return 'Optimaliser'
  }

  if (bucket === 'Average') {
    if (spend < 1500 && p > 0) {
      return 'Gi mer data'
    }
    return 'Optimaliser'
  }

  if (bucket === 'Below average') {
    if (spend > 2000) {
      return 'Skaler ned'
    }
    return 'Optimaliser'
  }

  if (bucket === 'Poor') {
    if (spend < 1000) {
      return 'Test nytt'
    }
    return 'Vurder pause'
  }

  return 'Vurder tiltak'
}

const actionTooltipText = {
  'Test nytt': 'Annonsen leverer svakt. Test en ny variant med nytt budskap, bilde eller format.',
  'Gi mer data':
    'Annonsen viser potensial, men har for lite data. La den gå lenger eller øk budsjettet forsiktig.',
  Optimaliser:
    'Annonsen presterer ok, men har tydelig forbedringspotensial. Juster målgrupper, budskap eller plasseringer.',
  Pause:
    'Annonsen bruker budsjett uten å levere resultater. Anbefalt å pause og flytte budsjett til sterkere annonser.',
  'Vurder pause':
    'Annonsen ligger under snittet. Følg med, og vurder å pause hvis resultatene ikke bedrer seg.',
}

const getPeriodSummary = (list) => {
  if (list.length === 0) {
    return {
      totalSpend: 0,
      totalPurchases: 0,
      avgRoas: null,
      avgRoasText: 'N/A',
      avgCpa: null,
    }
  }

  const totals = list.reduce(
    (acc, metric) => {
      const amountSpent = Number(metric.amountSpent) || 0
      const purchases = Number(metric.purchases) || 0
      const roas = Number(metric.roas) || 0
      const cpaValue = typeof metric.cpa === 'number' ? metric.cpa : null

      acc.totalSpend += amountSpent
      acc.totalPurchases += purchases

      if (roas > 0) {
        acc.totalRoas += roas
        acc.countRoas += 1
      }

      if (cpaValue !== null) {
        acc.totalCpa += cpaValue
        acc.countCpa += 1
      }

      return acc
    },
    { totalSpend: 0, totalPurchases: 0, totalRoas: 0, countRoas: 0, totalCpa: 0, countCpa: 0 },
  )

  const avgRoas = totals.countRoas > 0 ? totals.totalRoas / totals.countRoas : null

  return {
    totalSpend: totals.totalSpend,
    totalPurchases: totals.totalPurchases,
    avgRoas,
    avgRoasText: avgRoas === null ? 'N/A' : Number(avgRoas).toFixed(2),
    avgCpa: totals.countCpa > 0 ? totals.totalCpa / totals.countCpa : null,
  }
}

const getPercentChange = (currentValue, previousValue) => {
  if (
    previousValue === null ||
    typeof previousValue === 'undefined' ||
    previousValue === 0 ||
    currentValue === null ||
    typeof currentValue === 'undefined'
  ) {
    return null
  }
  return ((currentValue - previousValue) / previousValue) * 100
}

const getGroupStats = (items) => {
  if (!items || items.length === 0) {
    return { count: 0, totalSpend: 0, avgRoas: null, avgCpa: null }
  }

  const count = items.length
  const totalSpend = items.reduce((sum, m) => sum + (m.amountSpent || 0), 0)
  const totalRoas = items.reduce((sum, m) => sum + (m.roas || 0), 0)
  const totalCpa = items.reduce((sum, m) => sum + (m.cpa || 0), 0)

  return {
    count,
    totalSpend,
    avgRoas: totalRoas > 0 ? totalRoas / count : null,
    avgCpa: totalCpa > 0 ? totalCpa / count : null,
  }
}

const parseScenarioNumber = (value) => {
  if (!value) return null
  const num = Number(value.replace(',', '.'))
  return Number.isFinite(num) && num > 0 ? num : null
}

const sortAccessors = {
  roas: (metric) => Number(metric.roas) || 0,
  cpa: (metric) => (metric.cpa === null ? Number.MAX_SAFE_INTEGER : Number(metric.cpa)),
  purchases: (metric) => Number(metric.purchases) || 0,
  performanceScore: (metric) => Number(metric.performanceScore) || 0,
}

const CsvUpload = ({ onDataStatusChange }) => {
  const initialSettings = useMemo(() => loadAnalysisSettings(), [])
  const [file, setFile] = useState(null)
  const [previousFile, setPreviousFile] = useState(null)
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [metrics, setMetrics] = useState([])
  const [previousMetrics, setPreviousMetrics] = useState([])
  const [currentFileInfo, setCurrentFileInfo] = useState(null)
  const [previousFileInfo, setPreviousFileInfo] = useState(null)
  const [previousUploadMessage, setPreviousUploadMessage] = useState('')
  const [selectedMetric, setSelectedMetric] = useState(null)
  const [minRoas, setMinRoas] = useState(() => initialSettings?.minRoas ?? '')
  const [maxCpa, setMaxCpa] = useState('')
  const [minPurchases, setMinPurchases] = useState(() => initialSettings?.minPurchases ?? '')
  const [performanceFilter, setPerformanceFilter] = useState(
    () => initialSettings?.performanceFilter ?? '',
  )
  const [campaignFilter, setCampaignFilter] = useState('')
  const [sortField, setSortField] = useState(null)
  const [sortDirection, setSortDirection] = useState('desc')
  const [viewMode, setViewMode] = useState(() => initialSettings?.viewMode || 'ads')
  const [scenarioTargetRoas, setScenarioTargetRoas] = useState(
    () => initialSettings?.goalRoas ?? '',
  )
  const [scenarioMaxCpa, setScenarioMaxCpa] = useState(
    () => initialSettings?.maxCpaScenario ?? '',
  )
  const performanceScoreHelp =
    'Performance score er en samlet skår fra 0–100 basert på ROAS, CPA og antall kjøp. Høyere skår betyr bedre resultat i denne fila.'
  const performanceBucketHelp =
    'Performance sier om annonsen er Winner, Above average, Average, Below average eller Poor – basert på performance score-grenser.'
  const actionHelp =
    'Tiltak gir en enkel anbefaling for hva du bør gjøre videre med annonsen eller ad settet, basert på resultat og scenario-mål.'
  const scenarioHelp =
    'Scenario-feltene lar deg sette ønsket mål-ROAS og maks CPA. Verktøyet sammenligner dagens resultater mot disse målene uten å filtrere bort annonser.'

  useEffect(() => {
    saveAnalysisSettings({
      viewMode,
      goalRoas: scenarioTargetRoas,
      maxCpaScenario: scenarioMaxCpa,
      minRoas,
      minPurchases,
      performanceFilter,
    })
  }, [viewMode, scenarioTargetRoas, scenarioMaxCpa, minRoas, minPurchases, performanceFilter])

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0]
    setFile(selectedFile ?? null)
    setStatus('idle')
    setMessage('')
    setMetrics([])
    setCurrentFileInfo(null)
    setSelectedMetric(null)
  }

  const handlePreviousFileChange = (event) => {
    const selectedFile = event.target.files?.[0]
    setPreviousFile(selectedFile ?? null)
  }

  const uploadCsvFile = async (selectedFile) => {
    const formData = new FormData()
    formData.append('file', selectedFile)

    const response = await fetch('http://localhost:4000/api/upload', {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      throw new Error(`Feil fra server: ${response.status}`)
    }

    const data = await response.json()
    const incomingMetrics = Array.isArray(data.metrics) ? data.metrics : []
    const incomingRows = Array.isArray(data.rows) ? data.rows : []
    const rawMetrics = incomingMetrics.length > 0 ? incomingMetrics : incomingRows
    console.log('Upload response (current period):', data)
    console.log('Parsed metrics count:', Array.isArray(rawMetrics) ? rawMetrics.length : 0)
    const transformed = transformUploadedMetrics(rawMetrics)
    return transformed.length > 0 ? transformed : rawMetrics
  }

  const uploadCurrentPeriodFile = async (selectedFile) => {
    console.log('Uploading current period file:', selectedFile.name, selectedFile.size)
    setStatus('loading')
    setMessage('Laster opp...')
    setMetrics([])
    setSelectedMetric(null)
    try {
      const enrichedMetrics = await uploadCsvFile(selectedFile)
      setStatus('success')
      setMessage('Opplasting vellykket')
      setMetrics(enrichedMetrics)
      setCurrentFileInfo({ name: selectedFile.name, rows: enrichedMetrics.length })
    } catch (error) {
      setStatus('error')
      setMessage(error.message || 'Noe gikk galt')
    }
  }

  const handleUpload = async () => {
    if (!file) {
      setStatus('error')
      setMessage('Velg en CSV-fil først')
      return
    }
    await uploadCurrentPeriodFile(file)
  }

  const handleUseDemoFile = async () => {
    try {
      console.log('Laster demo fra:', DEMO_CSV_URL)
      const response = await fetch(DEMO_CSV_URL)
      if (!response.ok) {
        throw new Error('Fant ikke demo-fil')
      }
      const blob = await response.blob()
      const demoFile = new File([blob], 'meta-demo.csv', { type: 'text/csv' })
      setFile(demoFile)
      await uploadCurrentPeriodFile(demoFile)
    } catch (error) {
      setStatus('error')
      setMessage(error.message || 'Kunne ikke laste demo-fil')
    }
  }

  const handlePreviousUpload = async () => {
    if (!previousFile) {
      setPreviousUploadMessage('Velg en CSV-fil for forrige periode')
      return
    }

    try {
      setPreviousUploadMessage('Laster opp...')
      const enrichedMetrics = await uploadCsvFile(previousFile)
      setPreviousMetrics(enrichedMetrics)
      setPreviousFileInfo({ name: previousFile.name, rows: enrichedMetrics.length })
      setPreviousUploadMessage('Opplasting vellykket')
    } catch (error) {
      setPreviousUploadMessage(error.message || 'Noe gikk galt ved opplasting')
    }
  }

  const handleNumericFilterChange = (setter) => (event) => {
    setter(event.target.value)
    setSelectedMetric(null)
  }

  const filteredMetrics = useMemo(() => {
    return metrics.filter((metric) => {
      const roasValue = metric.roas || 0
      if (minRoas !== '' && roasValue < Number(minRoas)) {
        return false
      }

      const cpaValue = metric.cpa
      if (maxCpa !== '' && cpaValue !== null && cpaValue > Number(maxCpa)) {
        return false
      }

      const purchaseValue = metric.purchases || 0
      if (minPurchases !== '' && purchaseValue < Number(minPurchases)) {
        return false
      }

      if (performanceFilter && metric.filePerformanceBucket !== performanceFilter) {
        return false
      }

      if (campaignFilter && metric.campaignName !== campaignFilter) {
        return false
      }

      return true
    })
  }, [metrics, minRoas, maxCpa, minPurchases, performanceFilter, campaignFilter])

  const metricsSummary = useMemo(() => getPeriodSummary(filteredMetrics), [filteredMetrics])
  const hasCurrentData = metrics.length > 0
  const currentPeriodSummary = useMemo(() => getPeriodSummary(metrics), [metrics])
  const previousPeriodSummary = useMemo(() => getPeriodSummary(previousMetrics), [previousMetrics])
  const hasPreviousPeriod = previousMetrics.length > 0
  const spendChangePercent = getPercentChange(
    currentPeriodSummary.totalSpend,
    previousPeriodSummary.totalSpend,
  )
  const purchaseChangePercent = getPercentChange(
    currentPeriodSummary.totalPurchases,
    previousPeriodSummary.totalPurchases,
  )
  const roasChangePercent = getPercentChange(
    currentPeriodSummary.avgRoas,
    previousPeriodSummary.avgRoas,
  )
  const periodMetricsData = useMemo(
    () => [
      {
        key: 'spend',
        label: 'Spend',
        formatter: (value) => formatCurrency(value || 0),
        current: currentPeriodSummary.totalSpend,
        previous: hasPreviousPeriod ? previousPeriodSummary.totalSpend : null,
        change: hasPreviousPeriod ? spendChangePercent : null,
      },
      {
        key: 'purchases',
        label: 'Kjøp',
        formatter: (value) => Number(value || 0).toLocaleString('nb-NO'),
        current: currentPeriodSummary.totalPurchases,
        previous: hasPreviousPeriod ? previousPeriodSummary.totalPurchases : null,
        change: hasPreviousPeriod ? purchaseChangePercent : null,
      },
      {
        key: 'roas',
        label: 'ROAS',
        formatter: (value) => (value === null ? 'N/A' : Number(value).toFixed(2)),
        current: currentPeriodSummary.avgRoas,
        previous: hasPreviousPeriod ? previousPeriodSummary.avgRoas : null,
        change: hasPreviousPeriod ? roasChangePercent : null,
      },
    ],
    [
      currentPeriodSummary.avgRoas,
      currentPeriodSummary.totalPurchases,
      currentPeriodSummary.totalSpend,
      hasPreviousPeriod,
      previousPeriodSummary.avgRoas,
      previousPeriodSummary.totalPurchases,
      previousPeriodSummary.totalSpend,
      purchaseChangePercent,
      roasChangePercent,
      spendChangePercent,
    ],
  )
  const comparisonByKey = useMemo(() => {
    if (!hasPreviousPeriod) {
      return {}
    }
    return buildComparisonMap(metrics, previousMetrics)
  }, [hasPreviousPeriod, metrics, previousMetrics])
  const showAnalysis = hasCurrentData && status === 'success'
  useEffect(() => {
    if (typeof onDataStatusChange === 'function') {
      onDataStatusChange(hasCurrentData)
    }
  }, [hasCurrentData, onDataStatusChange])
  const scenarioRoasGoal = parseScenarioNumber(scenarioTargetRoas)
  const scenarioCpaGoal = parseScenarioNumber(scenarioMaxCpa)
  const scenario = useMemo(() => {
    if (
      status !== 'success' ||
      filteredMetrics.length === 0 ||
      (scenarioRoasGoal === null && scenarioCpaGoal === null)
    ) {
      return { enabled: false }
    }

    const meetsBoth = []
    const meetsRoasOnly = []
    const meetsCpaOnly = []
    const missesBoth = []
    let totalSpend = 0
    let totalSpendMeetsGoals = 0

    filteredMetrics.forEach((metric) => {
      const spend = metric.amountSpent || 0
      const roasValue = metric.roas || 0
      const cpaValue = metric.cpa || 0

      totalSpend += spend

      const roasOk = scenarioRoasGoal === null ? true : roasValue >= scenarioRoasGoal
      const hasValidCpa = (metric.purchases || 0) > 0 && cpaValue > 0
      const cpaOk =
        scenarioCpaGoal === null ? true : hasValidCpa ? cpaValue <= scenarioCpaGoal : false

      if (roasOk && cpaOk) {
        meetsBoth.push(metric)
        totalSpendMeetsGoals += spend
      } else if (roasOk && !cpaOk) {
        meetsRoasOnly.push(metric)
      } else if (!roasOk && cpaOk) {
        meetsCpaOnly.push(metric)
      } else {
        missesBoth.push(metric)
      }
    })

    return {
      enabled: true,
      meetsBoth,
      meetsRoasOnly,
      meetsCpaOnly,
      missesBoth,
      totalSpend,
      totalSpendMeetsGoals,
      totalSpendMissesGoals: totalSpend - totalSpendMeetsGoals,
    }
  }, [filteredMetrics, scenarioRoasGoal, scenarioCpaGoal, status])

  const adSetMetrics = useMemo(() => {
    if (filteredMetrics.length === 0) {
      return []
    }

    const map = new Map()

    filteredMetrics.forEach((metric) => {
      const adSetName =
        metric.adSetName ||
        metric.adSet ||
        metric['Ad set'] ||
        metric['Ad set name'] ||
        'Ukjent ad set'

      if (!map.has(adSetName)) {
        map.set(adSetName, {
          adSet: adSetName,
          adCount: 0,
          amountSpent: 0,
          purchases: 0,
          roasSum: 0,
          roasCount: 0,
          cpaSum: 0,
          cpaCount: 0,
        })
      }

      const agg = map.get(adSetName)
      agg.adCount += 1

      const spend = metric.amountSpent || 0
      const purchases = metric.purchases || 0
      const roasValue = metric.roas || 0
      const cpaValue = metric.cpa || 0

      agg.amountSpent += spend
      agg.purchases += purchases

      if (roasValue > 0) {
        agg.roasSum += roasValue
        agg.roasCount += 1
      }

      if (cpaValue > 0) {
        agg.cpaSum += cpaValue
        agg.cpaCount += 1
      }
    })

    return Array.from(map.values()).map((agg) => {
      const avgRoas = agg.roasCount > 0 ? agg.roasSum / agg.roasCount : 0
      let aggregateCpa = 0
      if (agg.purchases > 0) {
        aggregateCpa = agg.amountSpent / agg.purchases
      } else if (agg.cpaCount > 0) {
        aggregateCpa = agg.cpaSum / agg.cpaCount
      }

      const performanceScore = getPerformanceScore(avgRoas, aggregateCpa, agg.purchases)
      const filePerformanceBucket = getPerformanceBucketFromScore(performanceScore)
      const metaRating = getMetaRating(avgRoas)

      return {
        adSet: agg.adSet,
        adCount: agg.adCount,
        amountSpent: agg.amountSpent,
        purchases: agg.purchases,
        roas: avgRoas,
        cpa: aggregateCpa,
        performanceScore,
        filePerformanceBucket,
        metaRating,
      }
    })
  }, [filteredMetrics])

  const allCampaignNames = useMemo(() => {
    return Array.from(
      new Set(metrics.map((m) => m.campaignName).filter((name) => name && name.length > 0)),
    ).sort()
  }, [metrics])

  const insights = useMemo(() => {
    if (filteredMetrics.length === 0) {
      return {
        winnerInsight: null,
        strongInsight: null,
        wastedInsight: null,
        poorInsight: null,
        periodChangeInsights: [],
        hasInsight: false,
      }
    }

    const winners = filteredMetrics.filter((m) => m.filePerformanceBucket === 'Winner')
    const strong = filteredMetrics.filter((m) => m.filePerformanceBucket === 'Above average')
    const poor = filteredMetrics.filter((m) => m.filePerformanceBucket === 'Poor')
    const wastedSpendAds = filteredMetrics.filter(
      (m) => (m.amountSpent || 0) > 0 && (m.purchases || 0) === 0,
    )

    const winnerStats = getGroupStats(winners)
    const strongStats = getGroupStats(strong)
    const poorStats = getGroupStats(poor)
    const wastedStats = getGroupStats(wastedSpendAds)

    const winnerInsight =
      winnerStats.count > 0
        ? `Du har ${winnerStats.count} klar(e) vinner(e) med totalt forbruk på ${formatCurrency(
            winnerStats.totalSpend,
          )} og snitt-ROAS på ${
            winnerStats.avgRoas !== null ? winnerStats.avgRoas.toFixed(2) : 'N/A'
          }. Vurder å skalere budsjettet forsiktig på disse.`
        : null

    const strongInsight =
      strongStats.count > 0
        ? `${strongStats.count} annonse(r) er over gjennomsnittet. Test flere varianter basert på disse, eller flytt budsjett hit fra svake annonser.`
        : null

    const wastedInsight =
      wastedStats.totalSpend > 0
        ? `Det brukes cirka ${formatCurrency(
            wastedStats.totalSpend,
          )} på annonser uten kjøp i perioden. Vurder å pause eller endre disse.`
        : null

    const poorInsight =
      poorStats.count > 0
        ? `${poorStats.count} annonse(r) ligger i kategorien «Poor». Disse trekker ned totalresultatet og bør enten forbedres eller fases ut.`
        : null

    const periodChangeInsights = []
    if (hasPreviousPeriod) {
      if (spendChangePercent !== null) {
        periodChangeInsights.push(
          `Spend er ${spendChangePercent >= 0 ? 'opp' : 'ned'} ${Math.abs(spendChangePercent).toFixed(
            1,
          )} % mot forrige periode.`,
        )
      }
      if (purchaseChangePercent !== null) {
        periodChangeInsights.push(
          `Antall kjøp er ${
            purchaseChangePercent >= 0 ? 'opp' : 'ned'
          } ${Math.abs(purchaseChangePercent).toFixed(1)} % mot forrige periode.`,
        )
      }
      if (roasChangePercent !== null) {
        periodChangeInsights.push(
          `ROAS er ${roasChangePercent >= 0 ? 'opp' : 'ned'} ${Math.abs(roasChangePercent).toFixed(
            1,
          )} % mot forrige periode.`,
        )
      }
    }

    const hasInsight = Boolean(
      winnerInsight ||
        strongInsight ||
        wastedInsight ||
        poorInsight ||
        periodChangeInsights.length > 0,
    )

    return {
      winnerInsight,
      strongInsight,
      wastedInsight,
      poorInsight,
      periodChangeInsights,
      hasInsight,
    }
  }, [
    filteredMetrics,
    hasPreviousPeriod,
    purchaseChangePercent,
    roasChangePercent,
    spendChangePercent,
  ])

  const sortedMetrics = useMemo(() => {
    if (!sortField || !sortAccessors[sortField]) {
      return filteredMetrics
    }

    const accessor = sortAccessors[sortField]
    const directionMultiplier = sortDirection === 'asc' ? 1 : -1

    return [...filteredMetrics].sort((a, b) => {
      const diff = accessor(a) - accessor(b)
      if (diff === 0) return 0
      return diff > 0 ? directionMultiplier : -directionMultiplier
    })
  }, [filteredMetrics, sortField, sortDirection])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const renderSortIndicator = (field) => {
    if (sortField !== field) return ''
    return sortDirection === 'asc' ? ' ▲' : ' ▼'
  }

  return (
    <section style={{ marginTop: '2rem' }}>
      <div className='upload-panels'>
        <div className='upload-panel'>
          <p className='upload-title'>Nåværende periode</p>
          <input type='file' accept='.csv' onChange={handleFileChange} />
          <div className='upload-actions'>
            <button
              type='button'
              onClick={handleUpload}
              className='primary-button upload-button'
              disabled={status === 'loading'}
            >
              Last opp CSV
            </button>
            <button
              type='button'
              onClick={handleUseDemoFile}
              className='secondary-button upload-button'
              disabled={status === 'loading'}
            >
              Bruk demo-fil
            </button>
          </div>
          <p className='upload-helper-text'>Har du ikke en fil klar? Bruk demo-fil for å teste verktøyet.</p>
          {message && (
            <p className='upload-status' style={{ color: status === 'error' ? 'red' : 'green' }}>
              {message}
            </p>
          )}
          {currentFileInfo && (
            <p className='upload-info'>
              Nåværende periode: {currentFileInfo.rows} rader · {currentFileInfo.name}
            </p>
          )}
        </div>
        <div className='upload-panel'>
          <p className='upload-title'>Forrige periode (valgfritt)</p>
          <input type='file' accept='.csv' onChange={handlePreviousFileChange} />
          <button type='button' onClick={handlePreviousUpload} className='primary-button upload-button'>
            Last opp forrige periode
          </button>
          {previousUploadMessage && <p className='upload-status'>{previousUploadMessage}</p>}
          {previousFileInfo && (
            <p className='upload-info'>
              Forrige periode: {previousFileInfo.rows} rader · {previousFileInfo.name}
            </p>
          )}
        </div>
      </div>
      {!hasCurrentData && (
        <div className='card empty-state-card'>
          <h3>Ingen data lastet opp enda</h3>
          <p>Last opp en Meta Ads-CSV øverst for å starte analysen.</p>
        </div>
      )}
      {status === 'success' && (
        <div className='analysis-section'>
          <h2 className='section-title'>Analyserte annonser</h2>
            <div className='controls-card'>
              <div className='controls-card-header'>
                <span className='controls-title'>
                  Filtre og scenario <InfoTooltip text={scenarioHelp} />
                </span>
                {status === 'success' && filteredMetrics.length > 0 && (
                  <div className='view-toggle'>
                    <button
                      type='button'
                      className={viewMode === 'ads' ? 'toggle-button active' : 'toggle-button'}
                      onClick={() => setViewMode('ads')}
                    >
                      Per annonse
                    </button>
                    <button
                      type='button'
                      className={viewMode === 'adSets' ? 'toggle-button active' : 'toggle-button'}
                      onClick={() => setViewMode('adSets')}
                    >
                      Per ad set
                    </button>
                  </div>
                )}
              </div>
              <div className='controls-grid'>
                <div className='filter-group'>
                  <label className='filter-label' htmlFor='scenarioTargetRoas'>
                    Mål-ROAS (scenario) <InfoTooltip text={scenarioHelp} />
                  </label>
                  <input
                    id='scenarioTargetRoas'
                    type='text'
                    className='filter-input'
                    placeholder='f.eks. 1.5'
                    value={scenarioTargetRoas}
                    onChange={(event) => setScenarioTargetRoas(event.target.value)}
                  />
                </div>
                <div className='filter-group'>
                  <label className='filter-label' htmlFor='scenarioMaxCpa'>
                    Maks CPA (scenario) <InfoTooltip text={scenarioHelp} />
                  </label>
                  <input
                    id='scenarioMaxCpa'
                    type='text'
                    className='filter-input'
                    placeholder='f.eks. 800'
                    value={scenarioMaxCpa}
                    onChange={(event) => setScenarioMaxCpa(event.target.value)}
                  />
                </div>
                <div className='filter-group'>
                  <label className='filter-label' htmlFor='minRoasFilter'>Min ROAS</label>
                  <input
                    id='minRoasFilter'
                    type='number'
                    className='filter-input'
                    value={minRoas}
                    onChange={handleNumericFilterChange(setMinRoas)}
                    placeholder='f.eks. 2.0'
                  />
                </div>
                <div className='filter-group'>
                  <label className='filter-label' htmlFor='maxCpaFilter'>Maks CPA</label>
                  <input
                    id='maxCpaFilter'
                    type='number'
                    className='filter-input'
                    value={maxCpa}
                    onChange={handleNumericFilterChange(setMaxCpa)}
                    placeholder='f.eks. 200'
                  />
                </div>
                <div className='filter-group'>
                  <label className='filter-label' htmlFor='minPurchasesFilter'>Min purchases</label>
                  <input
                    id='minPurchasesFilter'
                    type='number'
                    className='filter-input'
                    value={minPurchases}
                    onChange={handleNumericFilterChange(setMinPurchases)}
                    placeholder='f.eks. 5'
                  />
                </div>
                <div className='filter-group'>
                  <label className='filter-label' htmlFor='performanceFilter'>Performance</label>
                  <select
                    id='performanceFilter'
                    className='filter-select'
                    value={performanceFilter}
                    onChange={(event) => {
                      setPerformanceFilter(event.target.value)
                      setSelectedMetric(null)
                    }}
                  >
                    <option value=''>Alle</option>
                    <option value='Winner'>Winner</option>
                    <option value='Above average'>Above average</option>
                    <option value='Average'>Average</option>
                    <option value='Below average'>Below average</option>
                    <option value='Poor'>Poor</option>
                  </select>
                </div>
              </div>
              <p className='scenario-hint'>
                Scenarioanalysen sammenligner dagens resultater mot målene over, uten å filtrere bort annonser.
              </p>
            </div>

            {showAnalysis && metricsSummary && (
              <div className='summary-card'>
                <p style={{ margin: 0 }}>Total spend: {formatCurrency(metricsSummary.totalSpend)}</p>
                <p style={{ margin: 0 }}>Total purchases: {metricsSummary.totalPurchases}</p>
                <p style={{ margin: 0 }}>Snitt-ROAS: {metricsSummary.avgRoasText}</p>
                <p style={{ margin: 0 }}>
                  Snitt-CPA: {metricsSummary.avgCpa === null ? 'N/A' : formatCurrency(metricsSummary.avgCpa)}
                </p>
              </div>
            )}

            {showAnalysis && (
              <div className='card period-summary-card'>
                <div className='period-summary-content'>
                  <div className='period-block'>
                    <p className='period-label'>Nåværende periode</p>
                    <p className='period-value'>{formatCurrency(currentPeriodSummary.totalSpend)}</p>
                    {currentFileInfo && (
                      <p className='period-meta'>
                        {currentFileInfo.rows} rader · {currentFileInfo.name}
                      </p>
                    )}
                  </div>
                  {hasPreviousPeriod && (
                    <div className='period-block'>
                      <p className='period-label'>Forrige periode</p>
                      <p className='period-value'>
                        {formatCurrency(previousPeriodSummary.totalSpend)}
                      </p>
                      {previousFileInfo && (
                        <p className='period-meta'>
                          {previousFileInfo.rows} rader · {previousFileInfo.name}
                        </p>
                      )}
                    </div>
                  )}
                </div>
                <div className='period-metrics'>
                  {periodMetricsData.map((metricInfo) => (
                    <div className='period-metric-row' key={metricInfo.key}>
                      <div className='period-metric-label'>{metricInfo.label}</div>
                      <div className='period-metric-value'>
                        <span className='period-metric-title'>Nå</span>
                        <span>{metricInfo.formatter(metricInfo.current)}</span>
                      </div>
                      {hasPreviousPeriod && (
                        <>
                          <div className='period-metric-value'>
                            <span className='period-metric-title'>Forrige</span>
                            <span>
                              {metricInfo.previous === null
                                ? 'N/A'
                                : metricInfo.formatter(metricInfo.previous)}
                            </span>
                          </div>
                          <div
                            className={`period-change-pill ${
                              metricInfo.change === null
                                ? ''
                                : metricInfo.change >= 0
                                ? 'period-change-positive'
                                : 'period-change-negative'
                            }`}
                          >
                            {metricInfo.change === null
                              ? '—'
                              : `${metricInfo.change >= 0 ? '+' : ''}${metricInfo.change.toFixed(1)}%`}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {showAnalysis && scenario.enabled && (
              <div className='card scenario-card'>
                <h3 className='card-title'>Scenarioanalyse</h3>
                <p className='scenario-subtitle'>
                  Sammenligner filtrerte annonser mot mål-ROAS
                  {scenarioRoasGoal !== null && ` på ${scenarioRoasGoal.toFixed(2)}`}
                  {scenarioRoasGoal !== null && scenarioCpaGoal !== null && ' og '}
                  {scenarioCpaGoal !== null && `maks CPA på ${formatCurrency(scenarioCpaGoal)}.`}
                </p>
                <ul className='scenario-list'>
                  <li>
                    {scenario.meetsBoth.length > 0
                      ? `${scenario.meetsBoth.length} annonse(r)/ad set oppfyller begge målene og står for ${formatCurrency(
                          scenario.totalSpendMeetsGoals,
                        )} i spend.`
                      : 'Ingen annonser oppfyller begge målene samtidig ennå.'}
                  </li>
                  {scenario.meetsRoasOnly.length > 0 && (
                    <li>
                      {`${scenario.meetsRoasOnly.length} annonse(r)/ad set har ROAS over målet, men høyere CPA enn ønsket.`}
                    </li>
                  )}
                  {scenario.meetsCpaOnly.length > 0 && (
                    <li>
                      {`${scenario.meetsCpaOnly.length} annonse(r)/ad set har CPA under målet, men ROAS under målet.`}
                    </li>
                  )}
                  {scenario.totalSpendMissesGoals > 0 && (
                    <li>
                      {`Cirka ${formatCurrency(
                        scenario.totalSpendMissesGoals,
                      )} i spend ligger under scenario-målene. Dette er kandidater for optimalisering eller nedskalering.`}
                    </li>
                  )}
                </ul>
              </div>
            )}

            {showAnalysis && filteredMetrics.length > 0 && (
              <div className='card insights-card'>
                <h3 className='insights-title'>AI-innsikt for denne visningen</h3>
                <ul className='insights-list'>
                  {insights.winnerInsight && <li>{insights.winnerInsight}</li>}
                  {insights.strongInsight && <li>{insights.strongInsight}</li>}
                  {insights.wastedInsight && <li>{insights.wastedInsight}</li>}
                  {insights.poorInsight && <li>{insights.poorInsight}</li>}
                  {insights.periodChangeInsights &&
                    insights.periodChangeInsights.map((text) => <li key={text}>{text}</li>)}
                  {!insights.hasInsight && (
                    <li>Ingen spesielle funn akkurat nå. Juster filtrene for å se andre mønstre.</li>
                  )}
                </ul>
              </div>
            )}
          {showAnalysis && filteredMetrics.length === 0 && (
            <p className='no-results-message'>
              Ingen rader matcher filtrene dine. Juster filterne og prøv igjen.
            </p>
          )}
          {showAnalysis && filteredMetrics.length > 0 && (
            <>
              {viewMode === 'ads' && (
                <div className='table-wrapper' style={{ overflowX: 'auto' }}>
                  <table
                    className='metrics-table'
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      marginTop: '0.5rem',
                    }}
                  >
                    <thead>
                      <tr>
                        {[
                          { label: 'Ad name' },
                          { label: 'Ad set' },
                          { label: 'Amount spent' },
                          { label: 'Purchases', sortable: 'purchases' },
                          { label: 'CPA', sortable: 'cpa' },
                          { label: 'ROAS', sortable: 'roas' },
                          { label: 'Performance', tooltip: performanceBucketHelp },
                          {
                            label: 'Performance score',
                            sortable: 'performanceScore',
                            tooltip: performanceScoreHelp,
                          },
                          { label: 'Tiltak', tooltip: actionHelp },
                        ].map(({ label, sortable, tooltip }) => (
                          <th
                            key={label}
                            onClick={sortable ? () => handleSort(sortable) : undefined}
                            style={{
                              textAlign: 'left',
                              borderBottom: '1px solid #ddd',
                              padding: '0.5rem',
                              cursor: sortable ? 'pointer' : 'default',
                              userSelect: 'none',
                            }}
                          >
                            <span className='header-with-tooltip'>
                              {label}
                              {tooltip && <InfoTooltip text={tooltip} />}
                            </span>
                            {sortable ? renderSortIndicator(sortable) : null}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMetrics.map((metric, index) => {
                        const isSelected = selectedMetric === metric
                        const bucketClass = getPerformanceBucketClass(metric.filePerformanceBucket)
                        const actionLabel = getRecommendedAction(
                          metric.filePerformanceBucket,
                          metric.performanceScore,
                          metric.amountSpent,
                          metric.purchases,
                          metric.roas,
                          metric.cpa,
                          scenarioRoasGoal,
                          scenarioCpaGoal,
                        )
                        const rowKey = getMetricKey(metric)
                        const comparison = rowKey ? comparisonByKey[rowKey] : null
                        const roasChange = comparison?.roasChangePct ?? null
                        const purchasesChange =
                          typeof comparison?.purchasesChange === 'number'
                            ? comparison.purchasesChange
                            : null
                        return (
                          <Fragment key={`${metric.adName}-${index}`}>
                            <tr
                              onClick={() =>
                                setSelectedMetric((prev) => (prev === metric ? null : metric))
                              }
                              className={isSelected ? 'row-selected' : undefined}
                            >
                              <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                                {metric.adName || '-'}
                              </td>
                              <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                                {metric.adSetName || '-'}
                              </td>
                              <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                                {formatCurrency(metric.amountSpent)}
                              </td>
                              <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                                <div className='cell-value'>
                                  {metric.purchases ?? '-'}
                                  {hasPreviousPeriod && purchasesChange !== null && purchasesChange !== 0 && (
                                    <span
                                      className={`comparison-pill ${
                                        purchasesChange > 0
                                          ? 'comparison-positive'
                                          : 'comparison-negative'
                                      }`}
                                    >
                                      {purchasesChange > 0 ? '+' : ''}
                                      {purchasesChange.toLocaleString('nb-NO')} kjøp
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                                {metric.cpa === null ? '-' : formatCurrency(metric.cpa)}
                              </td>
                              <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                                <div className='cell-value'>
                                  {formatNumber(metric.roas)}
                                  {hasPreviousPeriod && roasChange !== null && (
                                    <span
                                      className={`comparison-pill ${
                                        roasChange > 0
                                          ? 'comparison-positive'
                                          : roasChange < 0
                                          ? 'comparison-negative'
                                          : ''
                                      }`}
                                    >
                                      {roasChange === 0 ? '0%' : `${roasChange > 0 ? '+' : ''}${roasChange.toFixed(1)}%`}{' '}
                                      vs. forrige
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                                <span className={bucketClass}>{metric.filePerformanceBucket}</span>
                              </td>
                              <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                                {metric.performanceScore ?? '-'} / 100
                              </td>
                              <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                                <InfoTooltip text={actionTooltipText[actionLabel]}>
                                  <span className='pill action-pill'>{actionLabel}</span>
                                </InfoTooltip>
                              </td>
                            </tr>
                            {isSelected && (
                              <tr key={`${metric.adName}-${index}-details`} className='row-selected'>
                                <td colSpan={9} style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb' }}>
                                  <div className='detail-card'>
                                    <h3 style={{ marginTop: 0, marginBottom: '0.75rem' }}>
                                      Detaljer for valgt annonse
                                    </h3>
                                    <p style={{ margin: '0.25rem 0' }}>
                                      <strong>Performance (i denne fila):</strong>{' '}
                                      <span className={bucketClass}>{metric.filePerformanceBucket}</span> | Score:{' '}
                                      {metric.performanceScore} / 100
                                    </p>
                                    <p style={{ margin: '0.25rem 0', color: '#6b7280' }}>
                                      Basert på ROAS, CPA og antall kjøp.
                                    </p>
                                    <p style={{ margin: '0.25rem 0' }}>
                                      <strong>Meta rating:</strong> {metric.metaRating}
                                    </p>
                                    <p style={{ margin: '0.25rem 0' }}>
                                      <strong>Ad name:</strong> {metric.adName || '-'}
                                    </p>
                                    <p style={{ margin: '0.25rem 0' }}>
                                      <strong>Ad set:</strong> {metric.adSetName || '-'}
                                    </p>
                                    <p style={{ margin: '0.25rem 0' }}>
                                      <strong>Amount spent:</strong> {formatCurrency(metric.amountSpent)}
                                    </p>
                                    <p style={{ margin: '0.25rem 0' }}>
                                      <strong>Purchases:</strong> {metric.purchases ?? '-'}
                                    </p>
                                    <p style={{ margin: '0.25rem 0' }}>
                                      <strong>CPA:</strong> {metric.cpa === null ? '-' : formatCurrency(metric.cpa)}
                                    </p>
                                    <p style={{ margin: '0.25rem 0' }}>
                                      <strong>ROAS:</strong> {formatNumber(metric.roas)}
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {viewMode === 'adSets' && adSetMetrics.length > 0 && (
                <div className='table-wrapper' style={{ overflowX: 'auto' }}>
                  <table
                    className='metrics-table'
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      marginTop: '0.5rem',
                    }}
                  >
                    <thead>
                      <tr>
                        <th>Ad set</th>
                        <th>Antall annonser</th>
                        <th>Amount spent</th>
                        <th>Purchases</th>
                        <th>CPA</th>
                        <th>ROAS</th>
                        <th>
                          <span className='header-with-tooltip'>
                            Performance <InfoTooltip text={performanceBucketHelp} />
                          </span>
                        </th>
                        <th>
                          <span className='header-with-tooltip'>
                            Performance score <InfoTooltip text={performanceScoreHelp} />
                          </span>
                        </th>
                        <th>
                          <span className='header-with-tooltip'>
                            Tiltak <InfoTooltip text={actionHelp} />
                          </span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {adSetMetrics.map((adSet) => {
                        const bucketClass = getPerformanceBucketClass(adSet.filePerformanceBucket)
                        const actionLabel = getRecommendedAction(
                          adSet.filePerformanceBucket,
                          adSet.performanceScore,
                          adSet.amountSpent,
                          adSet.purchases,
                          adSet.roas,
                          adSet.cpa,
                          scenarioRoasGoal,
                          scenarioCpaGoal,
                        )
                        return (
                          <tr key={adSet.adSet}>
                            <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                              {adSet.adSet}
                            </td>
                            <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                              {adSet.adCount}
                            </td>
                            <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                              {formatCurrency(adSet.amountSpent)}
                            </td>
                            <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                              {adSet.purchases}
                            </td>
                            <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                              {adSet.purchases > 0 ? formatCurrency(adSet.cpa) : 'N/A'}
                            </td>
                            <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                              {adSet.roas ? adSet.roas.toFixed(2) : '0.00'}
                            </td>
                            <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                              <span className={bucketClass}>{adSet.filePerformanceBucket}</span>
                            </td>
                            <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                              {adSet.performanceScore} / 100
                            </td>
                            <td style={{ borderBottom: '1px solid #f0f0f0', padding: '0.5rem' }}>
                              <InfoTooltip text={actionTooltipText[actionLabel]}>
                                <span className='pill action-pill'>{actionLabel}</span>
                              </InfoTooltip>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  )
}

export default CsvUpload
const DEMO_CSV_URL = `${import.meta.env.BASE_URL || '/'}meta-demo.csv`
