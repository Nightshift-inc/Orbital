import dotenv from 'dotenv'
import fs from 'fs'
import http from 'http'
import { randomUUID } from 'node:crypto'
import { Octokit, App } from 'octokit'
import { createNodeMiddleware } from '@octokit/webhooks'
import { runInvestigation, investigationBus } from './lib/investigations.js'

// Load environment variables from .env file
dotenv.config()

// Default to dry-run (no GitHub Issue writes) unless explicitly disabled.
const DRY_RUN = process.env.BLACKBOX_DRY_RUN !== 'false'

// Set configured values
const appId = process.env.APP_ID
const privateKeyPath = process.env.PRIVATE_KEY_PATH
const privateKey = fs.readFileSync(privateKeyPath, 'utf8')
const secret = process.env.WEBHOOK_SECRET
const enterpriseHostname = process.env.ENTERPRISE_HOSTNAME
const messageForNewPRs = fs.readFileSync('./message.md', 'utf8')

// Create an authenticated Octokit client authenticated as a GitHub App
const app = new App({
  appId,
  privateKey,
  webhooks: {
    secret
  },
  ...(enterpriseHostname && {
    Octokit: Octokit.defaults({
      baseUrl: `https://${enterpriseHostname}/api/v3`
    })
  })
})

// Optional: Get & log the authenticated app's name
const { data } = await app.octokit.request('/app')

// Read more about custom logging: https://github.com/octokit/core.js#logging
app.octokit.log.debug(`Authenticated as '${data.name}'`)

// Subscribe to the "pull_request.opened" webhook event
app.webhooks.on('pull_request.opened', async ({ octokit, payload }) => {
  console.log(`Received a pull request event for #${payload.pull_request.number}`)
  try {
    await octokit.rest.issues.createComment({
      owner: payload.repository.owner.login,
      repo: payload.repository.name,
      issue_number: payload.pull_request.number,
      body: messageForNewPRs
    })
  } catch (error) {
    if (error.response) {
      console.error(`Error! Status: ${error.response.status}. Message: ${error.response.data.message}`)
    } else {
      console.error(error)
    }
  }
})

// Fire an investigation when a PR is merged.
app.webhooks.on('pull_request.closed', async ({ octokit, payload }) => {
  if (!payload.pull_request.merged) return
  if (payload.pull_request.draft) return

  const investigationId = randomUUID()
  const repoOwner = payload.repository.owner.login
  const repoName = payload.repository.name
  const triggerPrNumber = payload.pull_request.number
  const triggerSha = payload.pull_request.merge_commit_sha

  console.log(`[blackbox] investigation ${investigationId} starting for ${repoOwner}/${repoName}#${triggerPrNumber} (dryRun=${DRY_RUN})`)

  runInvestigation({
    investigationId,
    octokit,
    repoOwner,
    repoName,
    triggerPrNumber,
    triggerSha,
    dryRun: DRY_RUN
  }).catch((err) => {
    console.error(`[blackbox] investigation ${investigationId} failed:`, err)
  })
})

// Optional: Handle errors
app.webhooks.onError((error) => {
  if (error.name === 'AggregateError') {
    // Log Secret verification errors
    console.log(`Error processing request: ${error.event}`)
  } else {
    console.log(error)
  }
})

// Launch a web server to listen for GitHub webhooks
const port = process.env.PORT || 3000
const path = '/api/webhook'
const localWebhookUrl = `http://localhost:${port}${path}`

// See https://github.com/octokit/webhooks.js/#createnodemiddleware for all options
const middleware = createNodeMiddleware(app.webhooks, { path })

const STREAM_RE = /^\/api\/investigations\/([^/]+)\/stream\/?$/

function handleStream (req, res, investigationId) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  })
  res.write(`: subscribed ${investigationId}\n\n`)

  const listener = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`)
  }
  investigationBus.on(investigationId, listener)

  const keepalive = setInterval(() => {
    res.write(': keepalive\n\n')
  }, 15000)

  req.on('close', () => {
    clearInterval(keepalive)
    investigationBus.off(investigationId, listener)
  })
}

http.createServer(async (req, res) => {
  if (req.method === 'GET') {
    const m = req.url && req.url.match(STREAM_RE)
    if (m) {
      handleStream(req, res, m[1])
      return
    }
  }
  await middleware(req, res)
}).listen(port, () => {
  console.log(`Server is listening for events at: ${localWebhookUrl}`)
  console.log(`Investigation stream: GET http://localhost:${port}/api/investigations/<id>/stream`)
  console.log(`Dry-run mode: ${DRY_RUN ? 'ON (no Issue writes)' : 'OFF (will post Issues)'}`)
  console.log('Press Ctrl + C to quit.')
})
