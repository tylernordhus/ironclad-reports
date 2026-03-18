import { Suspense } from 'react'

export default function FlatworkLayout({ children }) {
  return (
    <Suspense fallback={
      <main style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p style={{ color: '#666' }}>Loading...</p>
      </main>
    }>
      {children}
    </Suspense>
  )
}
