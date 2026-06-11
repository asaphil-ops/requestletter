import fs from 'node:fs'
import path from 'node:path'
import Papa from 'papaparse'
import { createClient } from '@supabase/supabase-js'

const apply = process.argv.includes('--apply')
const writeSql = process.argv.includes('--sql')
const csvPath = path.resolve(process.cwd(), '..', 'branches.csv')
const sqlPath = path.resolve(process.cwd(), 'update_branches_from_csv.sql')
const envPath = path.resolve(process.cwd(), '.env')
const batchSize = 500

function readEnv(filePath) {
  const env = {}
  const content = fs.readFileSync(filePath, 'utf8')
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const index = trimmed.indexOf('=')
    if (index === -1) continue
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1)
  }
  return env
}

function normalize(value) {
  return String(value || '').trim()
}

function sqlString(value) {
  return `'${String(value || '').replace(/'/g, "''")}'`
}

function formatError(error) {
  if (!error) return error
  return {
    name: error.name,
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
    stack: error.stack,
  }
}

async function main() {
  const env = readEnv(envPath)
  const supabaseUrl = env.VITE_SUPABASE_URL
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing VITE_SUPABASE_URL and Supabase API key in .env')
  }

  const csvBuffer = fs.readFileSync(csvPath)
  const utf8Csv = csvBuffer.toString('utf8')
  const csv = utf8Csv.includes('�') ? csvBuffer.toString('latin1') : utf8Csv
  const parsed = Papa.parse(csv, {
    header: true,
    skipEmptyLines: true,
  })

  if (parsed.errors.length) {
    console.error(parsed.errors)
    throw new Error('CSV parse failed.')
  }

  const rows = parsed.data.map((row) => ({
    branch_code: normalize(row.branch_code).toUpperCase(),
    branch_name: normalize(row.branch_name),
    area: normalize(row.area),
    region: normalize(row.region),
    division: normalize(row.division),
    operation: normalize(row.operation),
    email: normalize(row.email).toLowerCase(),
  }))

  const invalidRows = rows.filter(row => !row.branch_code || !row.branch_name || !row.email)
  const duplicateCodes = [...new Set(
    rows
      .map(row => row.branch_code)
      .filter((code, index, allCodes) => allCodes.indexOf(code) !== index)
  )]

  if (invalidRows.length || duplicateCodes.length) {
    console.log(JSON.stringify({
      totalRows: rows.length,
      invalidRows: invalidRows.length,
      duplicateCodes,
    }, null, 2))
    throw new Error('CSV validation failed.')
  }

  if (writeSql) {
    const values = rows.map(row => `  (${[
      sqlString(row.branch_code),
      sqlString(row.branch_name),
      sqlString(row.area),
      sqlString(row.region),
      sqlString(row.division),
      sqlString(row.operation),
      sqlString(row.email),
    ].join(', ')})`)

    const sql = [
      '-- Generated from ../branches.csv',
      '-- Upserts branches and replaces branch email values from the CSV.',
      'insert into public.branches (branch_code, branch_name, area, region, division, operation, email)',
      'values',
      values.join(',\n'),
      'on conflict (branch_code) do update set',
      '  branch_name = excluded.branch_name,',
      '  area = excluded.area,',
      '  region = excluded.region,',
      '  division = excluded.division,',
      '  operation = excluded.operation,',
      '  email = excluded.email;',
      '',
    ].join('\n')

    fs.writeFileSync(sqlPath, sql, 'utf8')
    console.log(JSON.stringify({
      mode: 'sql',
      csvRows: rows.length,
      output: sqlPath,
    }, null, 2))
    return
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { count, error: countError } = await supabase
    .from('branches')
    .select('branch_code', { count: 'exact', head: true })

  if (countError) {
    console.error('Count query failed:', JSON.stringify(formatError(countError), null, 2))
    throw new Error('Unable to read branches table.')
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    csvRows: rows.length,
    currentDatabaseRows: count,
    firstRow: rows[0],
  }, null, 2))

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to update Supabase.')
    return
  }

  let updated = 0
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize)
    const { error } = await supabase
      .from('branches')
      .upsert(batch, { onConflict: 'branch_code' })

    if (error) {
      console.error('Upsert failed:', JSON.stringify(formatError(error), null, 2))
      throw new Error(`Unable to upsert batch starting at row ${index + 1}.`)
    }
    updated += batch.length
    console.log(`Upserted ${updated}/${rows.length}`)
  }

  const { count: finalCount, error: finalCountError } = await supabase
    .from('branches')
    .select('branch_code', { count: 'exact', head: true })

  if (finalCountError) {
    console.error('Final count failed:', JSON.stringify(formatError(finalCountError), null, 2))
    throw new Error('Unable to verify final branch count.')
  }

  console.log(JSON.stringify({
    mode: 'apply',
    upsertedRows: updated,
    finalDatabaseRows: finalCount,
  }, null, 2))
}

main().catch((error) => {
  console.error('Update script failed:', JSON.stringify(formatError(error), null, 2))
  process.exitCode = 1
})
