import { createClient } from '@supabase/supabase-js'
import QaFormEditor from '@/app/components/QaFormEditor'
import { getUserId } from '@/lib/get-user-id'
import { getAccessibleQaFormById } from '@/lib/qa-form-access'
import { isMissingRelationError } from '@/lib/supabase-errors'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
)

export default async function QaFormEditPage({ params }) {
  const userId = await getUserId()

  const { qaForm: data, error } = await getAccessibleQaFormById(supabase, { formId: params.id, userId })

  if (isMissingRelationError(error)) {
    return <p style={{ padding: '2rem', color: '#7a1212' }}>QA forms are not available yet. Run the SQL migration first.</p>
  }

  if (error || !data) {
    return <p style={{ padding: '2rem', color: '#7a1212' }}>QA form not found.</p>
  }

  return <QaFormEditor mode="edit" initialRecord={data} />
}
