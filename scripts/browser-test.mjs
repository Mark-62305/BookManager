import { spawn } from 'node:child_process'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const profile = await mkdtemp(join(tmpdir(), 'book-manager-edge-'))
const port = 9223
const appPort = Number(process.env.BROWSER_TEST_PORT || 4200)
const browser = spawn(edge, [
  '--headless=new', '--disable-gpu', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, 'about:blank',
])

try {
  let targets
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      targets = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json())
      break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }

  const page = targets?.find((target) => target.type === 'page')
  if (!page?.webSocketDebuggerUrl) throw new Error('Could not connect to Edge')
  const socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let nextId = 1
  const pending = new Map()
  const runtimeErrors = []
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.method === 'Runtime.exceptionThrown') runtimeErrors.push(message.params.exceptionDetails.text)
    if (!message.id || !pending.has(message.id)) return
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    message.error ? reject(new Error(message.error.message)) : resolve(message.result)
  })
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })

  await send('Runtime.enable')
  await send('Page.navigate', { url: `http://127.0.0.1:${appPort}/` })
  for (let attempt = 0; attempt < 150; attempt += 1) {
    const ready = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: "Boolean(document.querySelector('.library-shell'))",
    })
    if (ready.result.value) break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  const evaluation = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const text = document.body.innerText;
      const checks = [
        ['Library rendered', Boolean(document.querySelector('.library-shell'))],
        ['Title rendered', text.includes('Stories worth keeping.')],
        ['Search rendered', Boolean(document.querySelector('ion-searchbar'))],
        ['Filters rendered', text.includes('Available') && text.includes('Unavailable')],
        ['Add action rendered', text.includes('Add book')],
        ['Book data state rendered', text.includes('Loading books') || text.includes('No books found') || text.includes("couldn't open your library") || Boolean(document.querySelector('.book-card'))],
      ];
      return checks.map(([name, passed]) => ({ name, passed }));
    })()`,
  })
  if (evaluation.exceptionDetails) throw new Error(evaluation.exceptionDetails.text)

  const results = evaluation.result.value
  for (const test of results) console.log(`${test.passed ? 'PASS' : 'FAIL'} ${test.name}`)
  if (results.some((test) => !test.passed)) {
    const diagnostics = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: "({ url: location.href, title: document.title, body: document.body.innerText.slice(0, 800), html: document.body.innerHTML.slice(0, 800) })",
    })
    console.error('Page diagnostics:', diagnostics.result.value)
    if (runtimeErrors.length) console.error('Runtime errors:', runtimeErrors)
    process.exitCode = 1
  }

  await send('Runtime.evaluate', {
    expression: "[...document.querySelectorAll('.filter-row button')].find((button) => button.textContent.includes('Unavailable'))?.click()",
  })
  const filterResult = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: "document.querySelector('.filter-row button.active')?.textContent.trim() === 'Unavailable'",
  })
  console.log(`${filterResult.result.value ? 'PASS' : 'FAIL'} Availability filter interaction`)
  if (!filterResult.result.value) process.exitCode = 1

  await send('Page.navigate', { url: `http://127.0.0.1:${appPort}/books/add` })
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await send('Runtime.evaluate', { returnByValue: true, expression: "Boolean(document.querySelector('form'))" })
    if (ready.result.value) break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  const addPage = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const text = document.body.innerText;
      const submit = document.querySelector('ion-button[type="submit"]');
      return [
        ['Add route rendered', text.includes('Add a new book')],
        ['All form fields rendered', document.querySelectorAll('ion-input').length === 3 && Boolean(document.querySelector('ion-select'))],
        ['PDF picker rendered', Boolean(document.querySelector('input[type="file"][accept*="pdf"]'))],
        ['Invalid form cannot save', submit?.disabled === true],
      ];
    })()`,
  })
  for (const [name, passed] of addPage.result.value) {
    console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`)
    if (!passed) process.exitCode = 1
  }

  await send('Page.navigate', { url: `http://127.0.0.1:${appPort}/books/edit/example-id` })
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const ready = await send('Runtime.evaluate', { returnByValue: true, expression: "Boolean(document.querySelector('.form-shell'))" })
    if (ready.result.value) break
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  const editResult = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: "document.body.innerText.includes('Edit this book') && (document.body.innerText.includes('Loading book') || Boolean(document.querySelector('.load-state.error-state')) || Boolean(document.querySelector('form')))",
  })
  console.log(`${editResult.result.value ? 'PASS' : 'FAIL'} Edit route rendered`)
  if (!editResult.result.value) process.exitCode = 1
  socket.close()
} finally {
  browser.kill()
}
