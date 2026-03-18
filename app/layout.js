export const metadata = {
  title: 'Ironclad Daily Report',
  description: 'Subcontractor daily reporting tool',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{
        margin: 0,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        background: '#f5f5f5'
      }}>
        {children}
      </body>
    </html>
  )
}
