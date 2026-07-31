import MobilePdfViewer from '@/app/components/MobilePdfViewer'

function safeInternalHref(value, fallback = '/') {
  const href = typeof value === 'string' ? value.trim() : ''
  if (!href.startsWith('/')) return fallback
  if (href.startsWith('//')) return fallback
  return href
}

export default async function MobilePdfPage({ searchParams }) {
  const srcPath = typeof searchParams?.src === 'string' ? searchParams.src : ''
  const title = typeof searchParams?.title === 'string' ? searchParams.title : 'PDF Viewer'
  const backHref = safeInternalHref(
    typeof searchParams?.back === 'string' ? searchParams.back : '/',
    '/'
  )
  const backLabel = typeof searchParams?.backLabel === 'string' ? searchParams.backLabel : 'Back'

  return (
    <MobilePdfViewer
      title={title}
      srcPath={srcPath}
      backHref={backHref}
      backLabel={backLabel}
    />
  )
}
