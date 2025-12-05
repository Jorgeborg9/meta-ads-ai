import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useData } from '../context/DataContext'
import AppShell from '../components/layout/AppShell'
import PageHeader from '../components/layout/PageHeader'

const ratingColor = {
  Winner: 'badge-success',
  Average: 'badge-warning',
  Poor: 'badge-danger',
}

const getPerformanceBucket = (ad) => {
  const raw =
    ad.performanceBucket || ad.performanceLabel || ad.performance || ad.filePerformanceBucket || ''
  const value = String(raw).toLowerCase().trim()
  if (value.includes('winner')) return 'Winner'
  if (value.includes('average')) return 'Average'
  if (value.includes('poor')) return 'Poor'
  return null
}

const getPerformanceRank = (ad) => {
  const bucket = getPerformanceBucket(ad)
  if (bucket === 'Winner') return 3
  if (bucket === 'Average') return 2
  if (bucket === 'Poor') return 1
  return 0
}

const deriveRating = (ad) => getPerformanceBucket(ad) || 'Unknown'

const percentDiff = (value, baseline) => {
  if (!baseline || baseline === 0 || value == null) return null
  const diff = ((value - baseline) / baseline) * 100
  return Number.isFinite(diff) ? diff : null
}

const getAdId = (ad) => ad.id || ad.ad_id || `${ad.adName || 'ad'}-${ad.adSetName || ad.adSet || 'set'}`

const DetailedView = () => {
  const navigate = useNavigate()
  const { currentAds } = useData()
  const ads = currentAds || []

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'desc' })
  const [performanceFilter, setPerformanceFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState({
    winners: false,
    steady: false,
    needsCare: false,
  })

  const parseMetricNumber = (value) => {
    if (value == null) return 0
    if (typeof value === 'number') return value
    const cleaned = String(value)
      .replace(/\s/g, '')
      .replace(/kr/gi, '')
      .replace(/%/g, '')
      .replace(',', '.')
    const num = Number(cleaned)
    return Number.isFinite(num) ? num : 0
  }

const averageMetrics = useMemo(() => {
  if (!ads.length) {
    return {
        avgRoas: null,
        avgCpa: null,
        avgCtr: null,
        totalSpend: 0,
        totalPurchases: 0,
        strongestAd: null,
      }
    }

    let roasSum = 0
    let roasCount = 0
    let cpaSum = 0
    let cpaCount = 0
    let ctrSum = 0
    let ctrCount = 0
    let totalSpend = 0
    let totalPurchases = 0

    ads.forEach((ad) => {
      const roasVal = parseMetricNumber(ad.roas)
      if (Number.isFinite(roasVal) && roasVal > 0) {
        roasSum += roasVal
        roasCount += 1
      }
      const cpaVal = parseMetricNumber(ad.cpa ?? ad.cpr)
      if (Number.isFinite(cpaVal) && cpaVal > 0) {
        cpaSum += cpaVal
        cpaCount += 1
      }
      const ctrVal = parseMetricNumber(ad.ctr)
      if (Number.isFinite(ctrVal) && ctrVal >= 0) {
        ctrSum += ctrVal
        ctrCount += 1
      }
      totalSpend += parseMetricNumber(ad.amountSpent)
      totalPurchases += parseMetricNumber(ad.purchases ?? ad.results)
    })

    const avgRoas = roasCount ? roasSum / roasCount : null
    const avgCpa = cpaCount ? cpaSum / cpaCount : null
    const avgCtr = ctrCount ? ctrSum / ctrCount : null

    const validRoasAds = ads.filter((ad) => Number.isFinite(parseMetricNumber(ad.roas)))
    const strongestAd = validRoasAds.length
      ? validRoasAds.reduce((best, ad) =>
          parseMetricNumber(ad.roas) > parseMetricNumber(best.roas) ? ad : best,
        )
      : null

    return { avgRoas, avgCpa, avgCtr, totalSpend, totalPurchases, strongestAd }
  }, [ads])

  const groupedAds = useMemo(() => {
    if (!ads.length) return { winners: [], steady: [], needsCare: [], bucketMap: {} }

    const roasValues = ads.map((ad) => parseMetricNumber(ad.roas) || 0)
    const purchaseValues = ads.map((ad) => parseMetricNumber(ad.purchases) || 0)
    const roasMax = Math.max(...roasValues, 1)
    const roasMin = Math.min(...roasValues, 0)
    const purchMax = Math.max(...purchaseValues, 1)
    const purchMin = Math.min(...purchaseValues, 0)

    const norm = (val, min, max) => {
      if (max === min) return 0.5
      return (val - min) / (max - min)
    }

    const scored = ads.map((ad, idx) => {
      const roas = roasValues[idx]
      const purchases = purchaseValues[idx]
      const roasScore = norm(roas, roasMin, roasMax)
      const purchaseScore = norm(purchases, purchMin, purchMax)
      const score = roasScore * 0.7 + purchaseScore * 0.3
      return { ad, score }
    })

    const sorted = scored.sort((a, b) => b.score - a.score)
    const total = sorted.length
    const winnerCount = Math.max(1, Math.min(3, Math.ceil(total * 0.15)))
    const poorCount = Math.max(1, Math.ceil(total * 0.35))

    const winners = sorted.slice(0, winnerCount).map((s) => s.ad)
    const needsCare = sorted.slice(total - poorCount).map((s) => s.ad)

    const needsCareIds = new Set(needsCare.map((a) => getAdId(a)))
    const winnerIds = new Set(winners.map((a) => getAdId(a)))
    const steady = sorted
      .filter((s) => !needsCareIds.has(getAdId(s.ad)) && !winnerIds.has(getAdId(s.ad)))
      .map((s) => s.ad)

    const bucketMap = {}
    winners.forEach((ad) => (bucketMap[getAdId(ad)] = 'Winner'))
    steady.forEach((ad) => (bucketMap[getAdId(ad)] = 'Average'))
    needsCare.forEach((ad) => (bucketMap[getAdId(ad)] = 'Poor'))

    return { winners, steady, needsCare, bucketMap }
  }, [ads])

  const getRelativeBucket = (ad) =>
    (groupedAds.bucketMap && groupedAds.bucketMap[getAdId(ad)]) || getPerformanceBucket(ad)

  const getRelativeRank = (ad) => {
    const bucket = getRelativeBucket(ad)
    if (bucket === 'Winner') return 3
    if (bucket === 'Average') return 2
    if (bucket === 'Poor') return 1
    return 0
  }

  const visibleAds = useMemo(() => {
    if (!ads.length) return []
    const filtered = ads.filter((ad) => {
      if (performanceFilter === 'all') return true
      const bucket = getRelativeBucket(ad)
      if (performanceFilter === 'winner') return bucket === 'Winner'
      if (performanceFilter === 'average') return bucket === 'Average'
      if (performanceFilter === 'poor') return bucket === 'Poor'
      return true
    })

    const { key, direction } = sortConfig
    if (!key) return filtered

    const sorted = [...filtered].sort((a, b) => {
      const getValue = (ad) => {
        switch (key) {
          case 'results':
            return parseMetricNumber(ad.purchases ?? ad.results)
          case 'cpr':
            return parseMetricNumber(ad.cpr ?? ad.cpa)
          case 'roas':
            return parseMetricNumber(ad.roas)
          case 'ctr':
            return parseMetricNumber(ad.ctr)
          case 'performance':
            return getRelativeRank(ad)
          case 'name':
            return String(ad.name || ad.adName || '')
          default:
            return 0
        }
      }
      const aVal = getValue(a)
      const bVal = getValue(b)
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'desc' ? bVal - aVal : aVal - bVal
      }
      const cmp = String(aVal).localeCompare(String(bVal), 'nb', { sensitivity: 'base' })
      return direction === 'desc' ? -cmp : cmp
    })

    return sorted
  }, [ads, performanceFilter, sortConfig, groupedAds.bucketMap])

  useEffect(() => {
    if (visibleAds.length > 0 && !selectedId) {
      setSelectedId(getAdId(visibleAds[0]))
    }
    if (visibleAds.length === 0 && selectedId) {
      setSelectedId(null)
    }
  }, [visibleAds, selectedId])

  const selectedAd = useMemo(() => {
    if (!visibleAds.length) return null
    return visibleAds.find((ad) => getAdId(ad) === selectedId) || visibleAds[0]
  }, [visibleAds, selectedId])

  const adInsight = useMemo(() => {
    if (!selectedAd) return null
    return generateAdInsight(
      selectedAd,
      averageMetrics,
      groupedAds.bucketMap[getAdId(selectedAd)] || deriveRating(selectedAd),
    )
  }, [selectedAd, averageMetrics, groupedAds.bucketMap])

  const selectedStats = useMemo(() => {
    if (!selectedAd) return null
    const roas = parseMetricNumber(selectedAd.roas)
    const cpa = parseMetricNumber(selectedAd.cpa ?? selectedAd.cpr)
    const ctr = parseMetricNumber(selectedAd.ctr)

    const roasDiff = percentDiff(roas, averageMetrics.avgRoas)
    const cpaDiff = percentDiff(cpa, averageMetrics.avgCpa)
    const ctrDiff = percentDiff(ctr, averageMetrics.avgCtr)

    // bucket from relative scoring map if available
    const mapBucket =
      groupedAds.bucketMap && selectedAd ? groupedAds.bucketMap[getAdId(selectedAd)] : null
    const bucket = mapBucket || deriveRating(selectedAd)

    return { roas, cpa, ctr, roasDiff, cpaDiff, ctrDiff, bucket }
  }, [selectedAd, averageMetrics, groupedAds.bucketMap])

  const insightBullets = useMemo(() => {
    if (!selectedStats) return []
    const bullets = []
    if (selectedStats.bucket === 'Winner') {
      bullets.push('This ad is classified as a winner among the campaign ads.')
    }
    if (selectedStats.roasDiff != null) {
      if (selectedStats.roasDiff > 15) {
        bullets.push('ROAS is higher than the campaign average.')
      } else if (selectedStats.roasDiff < -15) {
        bullets.push('ROAS is below average; results trail the strongest ads.')
      }
    }
    if (selectedStats.ctrDiff != null) {
      if (selectedStats.ctrDiff > 10) {
        bullets.push('CTR is higher than average; the ad grabs attention well.')
      } else if (selectedStats.ctrDiff < -10) {
        bullets.push('CTR is lower than average; it gets less attention than other ads.')
      }
    }
    if (selectedStats.ctrDiff != null && selectedStats.roasDiff != null) {
      if (selectedStats.ctrDiff > 5 && selectedStats.roasDiff < -5) {
        bullets.push('CTR is above average but ROAS is lower; the challenge may be post-click.')
      }
    }
    if (!bullets.length) {
      bullets.push('Performance is close to the campaign average on key metrics.')
    }
    return bullets.slice(0, 4)
  }, [selectedStats])

  function generateAdInsight(ad, campaignStats, bucketLabel) {
    const roas = parseMetricNumber(ad.roas)
    const cpa = parseMetricNumber(ad.cpa ?? ad.cpr)
    const ctr = parseMetricNumber(ad.ctr)
    const purchases = parseMetricNumber(ad.purchases ?? ad.results)
    const spend = parseMetricNumber(ad.amountSpent)

    const avgRoas = campaignStats.avgRoas ?? 0
    const avgCpa = campaignStats.avgCpa ?? 0
    const avgCtr = campaignStats.avgCtr ?? 0

    const roasRatio = avgRoas ? roas / avgRoas : 1
    const cpaRatio = avgCpa ? cpa / avgCpa : 1

    const isLowData = purchases < 3 || spend < Math.max(50, avgCpa * 0.5)
    const isWinner = bucketLabel === 'Winner' || (avgRoas && roas >= avgRoas * 1.5 && purchases >= 10)
    const isAroundAvg = avgRoas && roas >= avgRoas * 0.9 && roas <= avgRoas * 1.2
    const isBelow = avgRoas && roas < avgRoas * 0.9 && spend >= Math.max(avgCpa, 50)

    let summary = 'Performance is close to the campaign average.'
    const actions = []
    let score = 3

    if (isLowData) {
      summary =
        'Too little data to judge performance yet. Let it run a bit longer before making big changes.'
      actions.push(
        { type: 'monitor', text: 'Let this ad collect more data for a day or two before adjusting budget.' },
        { type: 'info', text: 'Keep a close eye on early signals like CTR and CPC.' }
      )
      score = 3
    } else if (isWinner) {
      summary =
        'This ad stands out as a clear winner with strong ROAS and solid volume compared to the campaign average.'
      actions.push(
        { type: 'scale', text: 'Increase budget by 20–30% over the next few days and monitor ROAS.' },
        { type: 'test', text: 'Duplicate and test 1–2 new creatives with a different hook or angle.' },
        { type: 'monitor', text: 'Keep targeting steady and re-evaluate after a few days of stable performance.' }
      )
      if (roasRatio >= 1.8 && cpaRatio <= 0.8) score = 5
      else score = 4
    } else if (isAroundAvg) {
      summary = 'This ad performs around the campaign average; a steady contributor.'
      actions.push(
        { type: 'monitor', text: 'Keep budget stable and let it run 3–4 more days before major changes.' },
        { type: 'test', text: 'Test a small creative tweak – headline, first 3 seconds of video, or thumbnail.' },
        { type: 'info', text: 'If ROAS trends below average for several days, consider moving budget into top performers.' }
      )
      score = 3
    } else if (isBelow) {
      summary =
        'This ad is below the campaign average on ROAS/CPA and should be reviewed for pause or fixes.'
      actions.push(
        { type: 'pause', text: 'Pause this ad if performance does not improve within the next 1–2 days.' },
        { type: 'scale', text: 'Move part of this budget into your best performing ads.' },
        { type: 'test', text: 'Test a new creative that focuses clearly on the offer or product benefits.' }
      )
      if (roasRatio < 0.6) score = 1
      else score = 2
    }

    return { summary, actions: actions.slice(0, 3), score }
  }

  const actionBullets = useMemo(() => {
    if (!selectedStats) return []
    const bullets = []
    if (selectedStats.roasDiff != null && selectedStats.roasDiff < -10) {
      bullets.push('Review audience or offer if ROAS sits below average.')
    } else if (selectedStats.roasDiff != null && selectedStats.roasDiff > 10) {
      bullets.push('Analyze what separates this ad from others with lower ROAS to learn and replicate.')
    }
    if (selectedStats.ctrDiff != null && selectedStats.ctrDiff < -10) {
      bullets.push('With low CTR, test variations in hooks, messaging, or creative expression.')
    }
    if (
      selectedStats.ctrDiff != null &&
      selectedStats.ctrDiff > 5 &&
      selectedStats.roasDiff != null &&
      selectedStats.roasDiff < 0
    ) {
      bullets.push('If CTR is high but ROAS is weak, the issue may be on the landing page or purchase flow.')
    }
    if (selectedStats.bucket === 'Winner') {
      bullets.push('For winner ads, extract learnings to fuel new variants.')
    }
    if (!bullets.length) {
      bullets.push('Performance is near average. Monitor trends and consider small adjustments as needed.')
    }
    return bullets.slice(0, 4)
  }, [selectedStats])

  const handleSelectAdFromGroup = (ad) => {
    const id = getAdId(ad)
    setSelectedId(id)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggleGroup = (key) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        const nextDirection = prev.direction === 'desc' ? 'asc' : 'desc'
        return { key, direction: nextDirection }
      }
      return { key, direction: 'desc' }
    })
  }

  if (!ads.length) {
    return (
      <AppShell activeTab="detailed" showTabs={false}>
        <div className="empty-state-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <h3>No ads loaded yet.</h3>
          <p style={{ margin: '0.25rem 0 1rem' }}>
            Upload a CSV file or use the demo file on the homepage.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
            <button type="button" className="primary-button" onClick={() => navigate('/upload')}>
              Go to upload
            </button>
            <button
              type="button"
              className="secondary-button demo-button"
              onClick={() => navigate('/upload')}
            >
              Use demo file on the homepage
            </button>
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell activeTab="detailed" showTabs={false}>
      <PageHeader />

      <div className="top-grid">
        <div className="top-left">
          <div className="card selected-ad-card">
            <p className="eyebrow">Overview</p>
            <div className="kpi-row">
              <div className="kpi-chip">
                <div className="kpi-value">{averageMetrics.totalSpend.toLocaleString('nb-NO')} kr</div>
                <div className="kpi-label">Total spend</div>
              </div>
              <div className="kpi-chip">
                <div className="kpi-value">{averageMetrics.totalPurchases.toLocaleString('nb-NO')}</div>
                <div className="kpi-label">Total purchases</div>
              </div>
              <div className="kpi-chip">
                <div className="kpi-value">{averageMetrics.avgRoas == null ? '—' : averageMetrics.avgRoas.toFixed(2)}</div>
                <div className="kpi-label">Avg ROAS</div>
              </div>
              <div className="kpi-chip">
                <div className="kpi-value">{averageMetrics.avgCpa == null ? '—' : `${averageMetrics.avgCpa.toLocaleString('nb-NO')} kr`}</div>
                <div className="kpi-label">Avg CPA</div>
              </div>
              <div className="kpi-chip">
                <div className="kpi-value">{averageMetrics.avgCtr == null ? '—' : `${averageMetrics.avgCtr.toFixed(2)} %`}</div>
                <div className="kpi-label">Avg CTR</div>
              </div>
            </div>
            {ads.length > 0 && (
              <p className="kpi-footnote">Based on {ads.length} ads in the campaign.</p>
            )}
          </div>

          <div className="card grouped-card">
            <p className="eyebrow">Winners</p>
            <p className="muted group-sub">Ads that clearly outperform the average.</p>
            <div className="group-list">
              {groupedAds.winners.slice(0, expandedGroups.winners ? 5 : 2).map((ad, idx) => {
                const name = ad.adName || 'Unknown ad'
                const roas = ad.roas === null || ad.roas === undefined ? '—' : ad.roas.toFixed(2)
                return (
                  <div
                    key={`win-${getAdId(ad)}-${idx}`}
                    className="group-row"
                    onClick={() => handleSelectAdFromGroup(ad)}
                  >
                    <div className="group-row-main">
                      <span className="group-ad-name ad-truncate" title={name}>
                        {name}
                      </span>
                      <span className="group-metric">ROAS {roas}</span>
                    </div>
                    <button
                      type="button"
                      className="secondary-button thin small"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectAdFromGroup(ad)
                      }}
                    >
                      View ad
                    </button>
                  </div>
                )
              })}
              {groupedAds.winners.length > (expandedGroups.winners ? 5 : 2) && (
                <div className="group-row more-row">
                  … and {groupedAds.winners.length - (expandedGroups.winners ? 5 : 2)} more ads
                </div>
              )}
              {!groupedAds.winners.length && (
                <div className="group-row muted">No ads in this group yet.</div>
              )}
            </div>
            {groupedAds.winners.length > 2 && (
              <button
                type="button"
                className="secondary-button thin small toggle-btn"
                onClick={() => toggleGroup('winners')}
              >
                {expandedGroups.winners ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          <div className="card grouped-card">
            <p className="eyebrow">Steady ads</p>
            <p className="muted group-sub">Perform around the campaign average.</p>
            <div className="group-list">
              {groupedAds.steady.slice(0, expandedGroups.steady ? 5 : 2).map((ad, idx) => {
                const name = ad.adName || 'Unknown ad'
                const roas = ad.roas === null || ad.roas === undefined ? '—' : ad.roas.toFixed(2)
                return (
                  <div
                    key={`std-${getAdId(ad)}-${idx}`}
                    className="group-row"
                    onClick={() => handleSelectAdFromGroup(ad)}
                  >
                    <div className="group-row-main">
                      <span className="group-ad-name ad-truncate" title={name}>
                        {name}
                      </span>
                      <span className="group-metric">ROAS {roas}</span>
                    </div>
                    <button
                      type="button"
                      className="secondary-button thin small"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectAdFromGroup(ad)
                      }}
                    >
                      View ad
                    </button>
                  </div>
                )
              })}
              {groupedAds.steady.length > (expandedGroups.steady ? 5 : 2) && (
                <div className="group-row more-row">
                  … and {groupedAds.steady.length - (expandedGroups.steady ? 5 : 2)} more ads
                </div>
              )}
              {!groupedAds.steady.length && (
                <div className="group-row muted">No ads in this group yet.</div>
              )}
            </div>
            {groupedAds.steady.length > 2 && (
              <button
                type="button"
                className="secondary-button thin small toggle-btn"
                onClick={() => toggleGroup('steady')}
              >
                {expandedGroups.steady ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>

          <div className="card grouped-card">
            <p className="eyebrow">Ads to review</p>
            <p className="muted group-sub">Clearly below average on ROAS/CPA.</p>
            <div className="group-list">
              {groupedAds.needsCare.slice(0, expandedGroups.needsCare ? 5 : 2).map((ad, idx) => {
                const name = ad.adName || 'Unknown ad'
                const roas = ad.roas === null || ad.roas === undefined ? '—' : ad.roas.toFixed(2)
                return (
                  <div
                    key={`care-${getAdId(ad)}-${idx}`}
                    className="group-row"
                    onClick={() => handleSelectAdFromGroup(ad)}
                  >
                    <div className="group-row-main">
                      <span className="group-ad-name ad-truncate" title={name}>
                        {name}
                      </span>
                      <span className="group-metric">ROAS {roas}</span>
                    </div>
                    <button
                      type="button"
                      className="secondary-button thin small"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelectAdFromGroup(ad)
                      }}
                    >
                      View ad
                    </button>
                  </div>
                )
              })}
              {groupedAds.needsCare.length > (expandedGroups.needsCare ? 5 : 2) && (
                <div className="group-row more-row">
                  … and {groupedAds.needsCare.length - (expandedGroups.needsCare ? 5 : 2)} more ads
                </div>
              )}
              {!groupedAds.needsCare.length && (
                <div className="group-row muted">No ads in this group yet.</div>
              )}
            </div>
            {groupedAds.needsCare.length > 2 && (
              <button
                type="button"
                className="secondary-button thin small toggle-btn"
                onClick={() => toggleGroup('needsCare')}
              >
                {expandedGroups.needsCare ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        </div>

        <div className="top-right">
          {selectedAd && (
            <div className="card creative-card detail-card">
              <div className="creative-card-header">
                <p className="eyebrow">Creative Preview</p>
                <h3>{selectedAd.adName || 'Unknown ad'}</h3>
              </div>
              <div className="creative-preview">Creative Preview</div>
            </div>
          )}

          {selectedAd && (
            <div className="card selected-ad-card detail-card">
              <p className="eyebrow">Ad details</p>
              <div className="flex between" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ minWidth: 0 }}>
                  <h3 className="ad-truncate" title={selectedAd.adName || 'Unknown ad'}>
                    {selectedAd.adName || 'Unknown ad'}
                  </h3>
                  <p
                    className="muted ad-truncate"
                    title={selectedAd.adSetName || selectedAd.adSet || 'Unknown ad set'}
                  >
                    {selectedAd.adSetName || selectedAd.adSet || 'Unknown ad set'}
                  </p>
                </div>
                <span className={`badge ${ratingColor[getPerformanceBucket(selectedAd)] || ''}`}>
                  {getPerformanceBucket(selectedAd) || '—'}
                </span>
              </div>
              <div className="detail-grid detail-grid-large metrics-grid">
                <div>
                  <p className="label">Spend</p>
                  <p className="value">{(selectedAd.amountSpent || 0).toLocaleString('nb-NO')} kr</p>
                </div>
                <div>
                  <p className="label">ROAS</p>
                  <p className="value">{(selectedAd.roas || 0).toFixed(2)}</p>
                </div>
                <div>
                  <p className="label">CPA</p>
                  <p className="value">
                    {selectedAd.cpa === null || selectedAd.cpa === undefined
                      ? '—'
                      : `${selectedAd.cpa.toLocaleString('nb-NO')} kr`}
                  </p>
                </div>
                <div>
                  <p className="label">Purchases</p>
                  <p className="value">{selectedAd.purchases ?? '—'}</p>
                </div>
                <div>
                  <p className="label">CTR</p>
                  <p className="value">
                    {selectedAd.ctr === null || selectedAd.ctr === undefined
                      ? '—'
                      : `${(selectedAd.ctr || 0).toFixed(1)} %`}
                  </p>
                </div>
              </div>
              {adInsight && (
                <div className="ad-ai-score">
                  <div className="ad-ai-score-label">AI score</div>
                  <div className="ad-ai-score-value">
                    <span className="ad-ai-score-number">{adInsight.score}/5</span>
                    <div className="ad-ai-score-visual">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span
                          key={n}
                          className={`ai-score-dot ${n <= adInsight.score ? 'ai-score-dot--active' : ''}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {selectedStats && (
                <div className="ad-insight">
                  <div className="ad-insight-summary">
                    <div className="score-row">
                      <h4>AI summary</h4>
                      {adInsight && (
                        <span className="ad-score-badge" title="AI score 1–5">
                          {adInsight.score}/5
                        </span>
                      )}
                    </div>
                    <p>{adInsight?.summary}</p>
                  </div>
                  {adInsight?.actions?.length ? (
                    <div className="ad-insight-actions">
                      <h4>Suggested actions</h4>
                      <ul className="ad-insight-actions-list">
                        {adInsight.actions.map((action, idx) => (
                          <li key={idx} className="ad-insight-action-item">
                            <span
                              className={`ad-insight-action-pill ad-insight-action-pill--${action.type}`}
                            >
                              {action.type === 'scale' && 'Scale'}
                              {action.type === 'test' && 'Test'}
                              {action.type === 'monitor' && 'Monitor'}
                              {action.type === 'pause' && 'Pause'}
                              {action.type === 'info' && 'Info'}
                            </span>
                            <span className="ad-insight-action-text">{action.text}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="bottom-section">
        <div className="chip-group table-filter">
          {['all', 'winner', 'average', 'poor'].map((key) => (
            <button
              key={key}
              type="button"
              className={`chip ${performanceFilter === key ? 'active' : ''}`}
              onClick={() => setPerformanceFilter(key)}
            >
              {key === 'all'
                ? 'All'
                : key === 'winner'
                ? 'Winner'
                : key === 'average'
                ? 'Average'
                : 'Poor'}
            </button>
          ))}
        </div>

        <div className="table-card">
          <div className="table-header">
            <button type="button" onClick={() => handleSort('name')}>
              Annonse
            </button>
            <button type="button" onClick={() => handleSort('performance')}>
              Performance
            </button>
            <span>Tiltak</span>
            <button type="button" className="right" onClick={() => handleSort('results')}>
              Results
            </button>
            <button type="button" className="right" onClick={() => handleSort('cpr')}>
              CPR
            </button>
            <button type="button" className="right" onClick={() => handleSort('roas')}>
              ROAS
            </button>
            <button type="button" className="right" onClick={() => handleSort('ctr')}>
              CTR
            </button>
          </div>

          <div className="table-body">
            {visibleAds.map((ad, index) => {
              const baseId = getAdId(ad)
              const rowKey = `${baseId}-${index}`
              const bucket = getRelativeBucket(ad)
              const rating = bucket || '—'
              const purchases = ad.purchases ?? ad.results ?? '—'
              const cpa =
                ad.cpa === null || ad.cpa === undefined
                  ? '—'
                  : `${ad.cpa.toLocaleString('nb-NO')} kr`
              const roas = ad.roas === null || ad.roas === undefined ? '—' : ad.roas.toFixed(2)
              const ctr =
                ad.ctr === null || ad.ctr === undefined ? '—' : `${(ad.ctr || 0).toFixed(1)} %`

              return (
                <div
                  key={rowKey}
                  className={`table-row ${selectedId === baseId ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedId(baseId)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  <div className="table-cell name-cell">
                    <div className="ad-thumb small" />
                    <div className="name-meta" title={ad.adName || 'Unknown ad'}>
                      <span className="ad-name ad-truncate">{ad.adName || 'Unknown ad'}</span>
                    </div>
                  </div>
                  <div className="table-cell center">
                    <span className={`badge ${ratingColor[rating] || ''}`}>{rating}</span>
                  </div>
                  <div className="table-cell center">
                    <button type="button" className="secondary-button thin">
                      View actions
                    </button>
                  </div>
                  <div className="table-cell right">{purchases}</div>
                  <div className="table-cell right">{cpa}</div>
                  <div className="table-cell right">{roas}</div>
                  <div className="table-cell right">{ctr}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </AppShell>
  )
}

export default DetailedView
