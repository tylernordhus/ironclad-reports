const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const REPO_ROOT = path.resolve(__dirname, '..')
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'sql', 'migrations')

function readMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    throw new Error(`Missing migrations directory: ${MIGRATIONS_DIR}`)
  }

  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(name => name.endsWith('.sql'))
    .sort()
    .map(filename => {
      const base = filename.replace(/\.sql$/, '')
      const match = base.match(/^(\d+)[-_](.+)$/)
      if (!match) {
        throw new Error(`Migration filename must start with an ordered version prefix: ${filename}`)
      }

      return {
        version: match[1],
        name: match[2].replace(/_/g, '-'),
        filename,
        path: path.join(MIGRATIONS_DIR, filename),
      }
    })
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SECRET_KEY

  if (!supabaseUrl || !supabaseKey) {
    return null
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function fetchAppliedMigrations(supabase) {
  const { data, error } = await supabase
    .from('schema_migrations')
    .select('version, name, applied_at')
    .order('version', { ascending: true })

  if (error) {
    throw new Error(`Failed to read schema_migrations: ${error.message}`)
  }

  return data || []
}

function printList(migrations) {
  migrations.forEach(migration => {
    process.stdout.write(`${migration.version} ${migration.name} ${migration.filename}\n`)
  })
}

function printStatus(localMigrations, appliedMigrations) {
  const appliedByVersion = new Map(
    appliedMigrations.map(row => [String(row.version), row])
  )

  let pendingCount = 0
  for (const migration of localMigrations) {
    const applied = appliedByVersion.get(String(migration.version))
    const status = applied ? 'APPLIED' : 'PENDING'
    if (!applied) pendingCount += 1
    const suffix = applied?.applied_at ? ` (${applied.applied_at})` : ''
    process.stdout.write(`${status.padEnd(8)} ${migration.version} ${migration.name}${suffix}\n`)
  }

  const unappliedDbRows = appliedMigrations.filter(
    row => !localMigrations.some(migration => migration.version === String(row.version))
  )

  if (unappliedDbRows.length) {
    process.stdout.write('\nDB rows missing local files:\n')
    unappliedDbRows.forEach(row => {
      process.stdout.write(`ORPHAN   ${row.version} ${row.name}\n`)
    })
  }

  process.stdout.write(`\nPending migrations: ${pendingCount}\n`)
}

async function bootstrapMigrations(supabase, migrations) {
  const payload = migrations.map(migration => ({
    version: migration.version,
    name: migration.name,
  }))

  const { error } = await supabase
    .from('schema_migrations')
    .upsert(payload, { onConflict: 'version', ignoreDuplicates: false })

  if (error) {
    throw new Error(`Failed to bootstrap schema_migrations: ${error.message}`)
  }

  process.stdout.write(`Bootstrapped ${payload.length} migration records.\n`)
}

async function main() {
  const command = process.argv[2] || 'status'
  const migrations = readMigrationFiles()

  if (command === 'list') {
    printList(migrations)
    return
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in environment.')
  }

  if (command === 'bootstrap') {
    await bootstrapMigrations(supabase, migrations)
    return
  }

  if (command === 'status') {
    const applied = await fetchAppliedMigrations(supabase)
    printStatus(migrations, applied)
    return
  }

  throw new Error(`Unknown command: ${command}`)
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
