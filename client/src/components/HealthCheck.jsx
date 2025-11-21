import { useEffect, useState } from 'react'

const HealthCheck = () => {
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let isMounted = true

    const fetchHealth = async () => {
      try {
        const response = await fetch('http://localhost:4000/api/health')
        if (!response.ok) {
          throw new Error(`Uventet status: ${response.status}`)
        }
        const data = await response.json()
        if (isMounted) {
          setStatus(data.status ?? 'ukjent')
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Kunne ikke hente backend-status')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchHealth()

    return () => {
      isMounted = false
    }
  }, [])

  if (loading) {
    return <p className="status-text">Laster status...</p>
  }

  if (error) {
    return (
      <p role="alert" style={{ color: '#f87171', fontWeight: 500 }}>
        {error}
      </p>
    )
  }

  return <p className="status-text">Backend status: {status}</p>
}

export default HealthCheck
