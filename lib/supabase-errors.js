export function isMissingRelationError(error) {
  return error?.code === '42P01'
}

export function isMissingColumnError(error) {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

export function isPermissionDeniedError(error) {
  return error?.code === '42501'
}

export function isIgnorableQaFormsError(error) {
  return isMissingRelationError(error) || isPermissionDeniedError(error)
}

export function getQaFormsAvailability(error) {
  if (!error) {
    return { available: true, reason: null }
  }

  if (isMissingRelationError(error)) {
    return { available: false, reason: 'missing_relation' }
  }

  if (isPermissionDeniedError(error)) {
    return { available: false, reason: 'permission_denied' }
  }

  return { available: false, reason: 'query_failed' }
}

export function getQaFormsUnavailableMessage(reason) {
  if (reason === 'missing_relation') {
    return 'QA Forms are temporarily unavailable because the database schema is not fully applied yet.'
  }

  if (reason === 'permission_denied') {
    return 'QA Forms are temporarily unavailable because the database permissions for this feature are incomplete.'
  }

  if (reason === 'query_failed') {
    return 'QA Forms are temporarily unavailable because they could not be loaded.'
  }

  return null
}
