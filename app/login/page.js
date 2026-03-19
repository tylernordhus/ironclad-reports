'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.href = '/'
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      background: '#f5f5f5'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '8px',
        padding: '2.5rem',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ color: '#cc3300', fontSize: '1.8rem', margin: '0 0 .4rem' }}>
            Inspector Gadget
          </h1>
          <p style={{ color: '#666', fontSize: '.95rem', margin: 0 }}>
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="you@example.com"
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p style={{ color: '#cc3300', fontSize: '.9rem', marginBottom: '1rem', textAlign: 'center' }}>
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%',
            padding: '1rem',
            background: loading ? '#999' : '#cc3300',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '.9rem', color: '#666' }}>
          Don&apos;t have an account?{' '}
          <a href="/signup" style={{ color: '#cc3300', fontWeight: '600', textDecoration: 'none' }}>
            Sign up
          </a>
        </p>
      </div>
    </main>
  )
}

const labelStyle = {
  display: 'block',
  fontWeight: '600',
  marginBottom: '.4rem',
  color: '#333',
  fontSize: '.9rem'
}

const inputStyle = {
  width: '100%',
  padding: '.75rem',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '1rem',
  boxSizing: 'border-box'
}
