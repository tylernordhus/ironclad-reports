'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [company, setCompany] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSignup = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { company_name: company }
      }
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setDone(true)
    }
  }

  if (done) {
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
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
          <h2 style={{ color: '#1a1a1a', marginBottom: '.75rem' }}>Check your email</h2>
          <p style={{ color: '#666', lineHeight: '1.6' }}>
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then come back to sign in.
          </p>
          <a href="/login" style={{
            display: 'inline-block',
            marginTop: '1.5rem',
            color: '#cc3300',
            fontWeight: '600',
            textDecoration: 'none'
          }}>
            Back to Sign In
          </a>
        </div>
      </main>
    )
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
            Create your account
          </p>
        </div>

        <form onSubmit={handleSignup}>
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={labelStyle}>Company Name</label>
            <input
              type="text"
              required
              value={company}
              onChange={e => setCompany(e.target.value)}
              style={inputStyle}
              placeholder="e.g. Ironclad Construction"
            />
          </div>
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
              minLength={6}
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="At least 6 characters"
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
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '.9rem', color: '#666' }}>
          Already have an account?{' '}
          <a href="/login" style={{ color: '#cc3300', fontWeight: '600', textDecoration: 'none' }}>
            Sign in
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
