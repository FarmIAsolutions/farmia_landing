import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import es from '../content/i18n/es.mjs'
import { expectedFiles, homePage, renderTemplate } from '../scripts/generate-modules.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const generatorPath = join(root, 'scripts', 'generate-modules.mjs')
const template = readFileSync(join(root, 'templates', 'home.html'), 'utf8')

function generateInto(scratch) {
  const result = spawnSync(process.execPath, [generatorPath, '--root', scratch], { cwd: root, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr || result.stdout)
}

function leafKeys(value, prefix) {
  if (typeof value === 'string') return [prefix]
  return Object.entries(value).flatMap(([key, child]) => leafKeys(child, `${prefix}.${key}`))
}

test('the home page is generated and matches the committed index.html byte for byte', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'farmia-home-'))
  try {
    generateInto(scratch)
    assert.equal(readFileSync(join(scratch, 'index.html'), 'utf8'), readFileSync(join(root, 'index.html'), 'utf8'))
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

test('check mode detects a hand-edited index.html', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'farmia-home-'))
  try {
    generateInto(scratch)
    const clean = spawnSync(process.execPath, [generatorPath, '--check', '--root', scratch], { cwd: root, encoding: 'utf8' })
    assert.equal(clean.status, 0, clean.stderr || clean.stdout)

    const homePath = join(scratch, 'index.html')
    writeFileSync(homePath, readFileSync(homePath, 'utf8').replace('Empezar es simple.', 'Empezar es muy simple.'), 'utf8')
    const edited = spawnSync(process.execPath, [generatorPath, '--check', '--root', scratch], { cwd: root, encoding: 'utf8' })
    assert.notEqual(edited.status, 0)
    assert.match(`${edited.stdout}\n${edited.stderr}`, /desactualizado index\.html/)
  } finally {
    rmSync(scratch, { recursive: true, force: true })
  }
})

test('every generated page resolves all its placeholders', () => {
  const files = expectedFiles()
  assert.ok(files.has('index.html'), 'the home page should be part of the generated files')
  for (const [path, content] of files) {
    assert.doesNotMatch(content, /\{\{|\}\}/, `${path} should not keep template placeholders`)
  }
})

test('every Spanish home string is used by the home template', () => {
  for (const key of leafKeys(es.home, 'home')) {
    assert.ok(template.includes(`{{${key}}}`), `${key} is defined in content/i18n/es.mjs but unused in templates/home.html`)
  }
})

test('the template renderer escapes values and fails clearly on unknown keys', () => {
  assert.equal(renderTemplate('<p title="{{a.b}}">{{a.b}}</p>{{{raw}}}', { a: { b: 'x & "y"' }, raw: '<b>' }), '<p title="x &amp; &quot;y&quot;">x &amp; &quot;y&quot;</p><b>')
  assert.throws(() => renderTemplate('<p>{{home.nope}}</p>', { home: {} }, 'templates/home.html'), /templates\/home\.html: clave desconocida \{\{home\.nope\}\}/)
  assert.throws(() => renderTemplate('<p>{{home}}</p>', { home: { title: 'x' } }), /clave desconocida \{\{home\}\}/, 'an object is not a printable value')
  assert.throws(() => renderTemplate('<p>{{ not a key }}</p>', {}), /marcador sin resolver/)
})

test('the home page fails to generate when the locale lacks a key', () => {
  const incomplete = structuredClone(es)
  delete incomplete.home.faq.items[5].answer
  assert.throws(() => homePage(incomplete), /clave desconocida \{\{home\.faq\.items\.5\.answer\}\}/)
})
