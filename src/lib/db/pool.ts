import { Connector, AuthTypes, IpAddressTypes } from '@google-cloud/cloud-sql-connector'
import { Pool } from 'pg'

let poolPromise: Promise<Pool> | null = null

export function getPool(): Promise<Pool> {
  if (!poolPromise) {
    poolPromise = createPool().catch((err) => {
      poolPromise = null
      throw err
    })
  }
  return poolPromise
}

async function createPool(): Promise<Pool> {
  const user = required('DB_USER')
  const database = required('DB_NAME')
  const password = process.env.DB_PASSWORD
  const host = process.env.DB_HOST

  // Direct Postgres (local docker: anvil-postgres on localhost:5432).
  if (host) {
    return new Pool({
      host,
      port: Number(process.env.DB_PORT || 5432),
      user,
      database,
      password,
      max: 5,
    })
  }

  const instanceConnectionName = required('INSTANCE_CONNECTION_NAME')

  // Use built-in password auth when DB_PASSWORD is provided (e.g. local dev),
  // otherwise fall back to IAM auth (e.g. production on Cloud Run).
  const usePassword = Boolean(password)

  const connector = new Connector()
  const clientOpts = await connector.getOptions({
    instanceConnectionName,
    authType: usePassword ? AuthTypes.PASSWORD : AuthTypes.IAM,
    ipType: IpAddressTypes.PUBLIC,
  })

  return new Pool({
    ...clientOpts,
    user,
    database,
    ...(usePassword ? { password } : {}),
    max: 5,
  })
}

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}
