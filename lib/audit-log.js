import { isMissingColumnError, isMissingRelationError } from '@/lib/supabase-errors'

function asJsonObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return value
}

export async function recordAuditEvent(supabase, event) {
  try {
    const payload = {
      organization_id: event.organizationId || null,
      actor_user_id: event.actorUserId || null,
      subject_user_id: event.subjectUserId || null,
      entity_type: event.entityType,
      entity_id: event.entityId || null,
      action: event.action,
      metadata: asJsonObject(event.metadata),
      before_state: asJsonObject(event.beforeState),
      after_state: asJsonObject(event.afterState),
    }

    let { error } = await supabase
      .from('audit_log')
      .insert(payload)

    if (error && isMissingColumnError(error)) {
      const legacyPayload = {
        organization_id: payload.organization_id,
        actor_user_id: payload.actor_user_id,
        entity_type: payload.entity_type,
        entity_id: payload.entity_id,
        action: payload.action,
        metadata: payload.metadata,
      }

      ;({ error } = await supabase
        .from('audit_log')
        .insert(legacyPayload))
    }

    if (error) {
      if (isMissingRelationError(error)) return
      console.error('Audit log insert failed:', error)
    }
  } catch (error) {
    console.error('Audit log insert threw:', error)
  }
}
