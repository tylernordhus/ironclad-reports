'use client'

export default function DeleteButton({ action, label = 'Delete', style = {} }) {
  const handleSubmit = (e) => {
    if (!confirm('Are you sure you want to delete this? This cannot be undone.')) {
      e.preventDefault()
    }
  }

  return (
    <form action={action} method="POST" onSubmit={handleSubmit} style={{ display: 'inline' }}>
      <button type="submit" style={style}>
        {label}
      </button>
    </form>
  )
}
