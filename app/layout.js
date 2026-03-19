import BottomNav from '@/app/components/BottomNav'

export const metadata = {
  title: 'Field Reports',
  description: 'Construction field reporting tool',
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
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
        <BottomNav />
      </body>
    </html>
  )
}
