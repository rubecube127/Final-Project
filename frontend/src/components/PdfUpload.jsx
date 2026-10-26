import { useRef, useState } from 'react'

// Pull the text out of a PDF so the tutor does not have to retype a session.
//
// Extraction happens in the browser, not on the server: the PDF file itself
// never leaves this machine, and only the text the tutor has seen and approved
// is sent to /api/coach.
export default function PdfUpload({ onExtracted, disabled }) {
  const [status, setStatus] = useState(null) // { kind, message }
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  async function handleFile(file) {
    if (!file) return

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setStatus({ kind: 'error', message: 'That is not a PDF. Pick a .pdf file.' })
      return
    }

    setStatus({ kind: 'busy', message: `Reading ${file.name}…` })

    try {
      const { text, pages } = await extractText(file)

      if (!text.trim()) {
        setStatus({
          kind: 'error',
          message:
            'No text found. This PDF is probably a scan or a photo — those need ' +
            'to be typed out, or run through OCR first.'
        })
        return
      }

      setStatus({
        kind: 'ok',
        message: `Read ${pages} page${pages === 1 ? '' : 's'} from ${file.name}. Check it below before sending.`
      })
      onExtracted(text)
    } catch (error) {
      setStatus({ kind: 'error', message: `Could not read that PDF: ${error.message}` })
    }
  }

  return (
    <div className="card">
      <label className="label" htmlFor="pdf-file">Upload a session PDF</label>

      <div
        className={`dropzone ${dragging ? 'over' : ''} ${disabled ? 'off' : ''}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          if (!disabled) handleFile(event.dataTransfer.files[0])
        }}
      >
        <p className="dropzone-main">Drop a PDF here</p>
        <p className="dropzone-sub">or</p>
        <button
          type="button"
          className="button ghost"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          Choose a file
        </button>
        <input
          id="pdf-file"
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="file-input"
          onChange={(event) => {
            handleFile(event.target.files[0])
            // Let the same file be picked again after a failed read.
            event.target.value = ''
          }}
        />
      </div>

      {status && <p className={`upload-status ${status.kind}`}>{status.message}</p>}

      <p className="hint">
        The PDF stays in your browser. Only the text below is sent, and names and
        contact details are removed from it first.
      </p>
    </div>
  )
}

/**
 * Read every page of the PDF and join the text back into lines.
 *
 * pdf.js gives text as positioned items rather than lines, so items are
 * grouped by their y position — otherwise a transcript comes back as one run-on
 * paragraph and the speaker labels are lost.
 */
async function extractText(file) {
  const pdfjs = await import('pdfjs-dist')

  // Vite bundles the worker from this URL at build time.
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString()

  const buffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: buffer }).promise
  const pageTexts = []

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    pageTexts.push(toLines(content.items))
  }

  return { text: pageTexts.join('\n').trim(), pages: pdf.numPages }
}

// Group text items into lines by their vertical position on the page.
function toLines(items) {
  const rows = new Map()

  for (const item of items) {
    if (!item.str) continue

    // transform[5] is the y coordinate. Round it so items on the same visual
    // line, which can differ by a fraction of a point, land in one row.
    const y = Math.round(item.transform[5])
    if (!rows.has(y)) rows.set(y, [])
    rows.get(y).push(item)
  }

  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0]) // top of the page down
    .map(([, row]) =>
      row
        .sort((a, b) => a.transform[4] - b.transform[4]) // left to right
        .map((item) => item.str)
        .join('')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean)
    .join('\n')
}
