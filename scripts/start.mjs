import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
if (existsSync('.env')) process.loadEnvFile('.env')
if (process.env.DATABASE_URL?.startsWith('file:') && !process.env.DATABASE_URL.startsWith('file:/')) process.env.DATABASE_URL = 'file:' + resolve('prisma', process.env.DATABASE_URL.slice(5))
process.env.HOSTNAME = process.env.HOSTNAME_OVERRIDE || '127.0.0.1'
process.env.NODE_ENV = 'production'
await import(pathToFileURL(resolve('.next/standalone/server.js')).href)
