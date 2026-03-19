'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function DeleteButton({ action, label = 'Delete', style = {}, redirectTo = null }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (!confirm('Are you sure you want to delete this? This cannot be undone.')) return
    setLoading(true)
    try {
      await fetch(action, { method: 'POST' })
      if (redirectTo) {
        router.push(redirectTo)
      } else {
        router.refresh()
      }
    } catch {
      alert('Delete failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={loading} style={{ ...style, opacity: loading ? 0.5 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
      {loading ? 'Deleting...' : label}
    </button>
  )
}
