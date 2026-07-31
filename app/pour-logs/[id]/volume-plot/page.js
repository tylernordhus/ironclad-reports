import { createClient } from '@supabase/supabase-js'
import VolumePlotViewer from '@/app/components/VolumePlotViewer'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export default async function PourLogVolumePlotPage({ params }) {
  const { data: log } = await supabase
    .from('pour_logs')
    .select('id, project_id')
    .eq('id', params.id)
    .single()

  const backHref = log?.id
    ? `/pour-logs/${log.id}`
    : '/pour-logs'

  return (
    <VolumePlotViewer
      logId={params.id}
      backHref={backHref}
    />
  )
}
