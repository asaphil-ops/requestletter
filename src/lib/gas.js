import { formatBytes, escapeHtml } from './utils'

const GAS_URL = import.meta.env.VITE_GAS_URL

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

async function callGAS(payload) {
  if (!GAS_URL) throw new Error('Google Apps Script URL is not configured.')
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload) })
      if (res.status === 404) throw new Error('Google Apps Script deployment was not found (404). Create a Web App deployment and update VITE_GAS_URL with its /exec URL.')
      if (!res.ok) {
        const error = new Error(`Google Apps Script responded with ${res.status}: ${res.statusText || 'Request failed'}`)
        error.retryable = res.status === 408 || res.status === 429 || res.status >= 500
        throw error
      }
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'Google Apps Script returned an error.')
      return json.data
    } catch (err) {
      const networkError = err instanceof TypeError
      if (attempt < 2 && (networkError || err.retryable)) {
        await wait(700 * (attempt + 1))
        continue
      }
      console.error('GAS Call Failed:', err)
      throw err
    }
  }
}

export async function testGASConnection() {
  if (!GAS_URL) throw new Error('Google Apps Script URL is not configured.')
  const result = await callGAS({ action: 'TEST_CONNECTION' })
  return { ...result, configured: true }
}

export async function sendEmail({ to, cc, subject, htmlBody, senderName, senderEmail, attachments = [], fileId, fileName }) {
  return callGAS({ action: 'SEND_EMAIL', to, cc, subject, htmlBody, senderName, senderEmail, attachments, fileId, fileName })
}

export async function uploadToDrive(file, options = {}) {
  const base64 = await fileToBase64(file)
  return callGAS({
    action: 'UPLOAD_DRIVE',
    base64,
    fileName: file.name,
    mimeType: file.type,
    convertToPdf: Boolean(options.convertToPdf),
  })
}

export async function deleteFromDrive(fileId) {
  return callGAS({ action: 'DELETE_FILE', fileId })
}

export async function getFileUrl(fileId) {
  return callGAS({ action: 'GET_FILE_URL', fileId })
}

export async function getFileContent(fileId) {
  return callGAS({ action: 'GET_FILE_CONTENT', fileId })
}

export async function syncRequestTrackerToGoogleSheet(rows, { onProgress } = {}) {
  if (!GAS_URL) throw new Error('Google Apps Script URL is not configured.')
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('There are no rows to send to Google Sheets.')

  const chunkSize = 150
  const totalBatches = Math.ceil(rows.length / chunkSize)
  const syncId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
  let result = null
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    const chunk = rows.slice(offset, offset + chunkSize)
    const batch = Math.floor(offset / chunkSize) + 1
    onProgress?.({ batch, totalBatches, sent: Math.min(offset + chunk.length, rows.length), total: rows.length })
    result = await callGAS({
      action: 'SYNC_REQUEST_TRACKER',
      rows: chunk,
      syncId,
      initialize: offset === 0,
      finalize: batch === totalBatches,
      startRow: offset + 1,
    })
  }

  return {
    rowCount: Math.max(rows.length - 1, 0),
    sheetName: result?.sheetName || 'Request Letter Tracker',
    spreadsheetUrl: result?.spreadsheetUrl || 'https://docs.google.com/spreadsheets/d/12DNNTUggWl6Ff_-3a0qYuDbs1_nt9RBsTNwiNuGxHZ8/edit',
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function buildEmailHTML({ subject, senderName, senderEmail, note, messageBody, attachments = [], today }) {
  const dateStr = today || new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const safeSubject = escapeHtml(subject)
  const safeNote = escapeHtml(note || 'NOTE: FOR VP/SVP APPROVAL')
  const safeSenderName = escapeHtml(senderName || '')
  const safeSenderEmail = escapeHtml(senderEmail || '')
  const baseBody = messageBody || "Good day, Ma'am/Sir,\n\nKindly see the attached File/s"
  const bodyHTML = escapeHtml(baseBody)
    .split('\n')
    .map(line => line.trim() ? line : '&nbsp;')
    .join('<br>')
  const attachListHTML = attachments.map(a => `
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;margin-bottom:10px;">
      <tr><td style="padding:12px 18px;">
        <div style="font-weight:600;font-size:13px;color:#1e3a5f;">📎 ${a.name || a.fileName}</div>
        <div style="font-size:11px;color:#64748b;">${a.size ? formatBytes(a.size) : 'Attachment'}</div>
      </td></tr>
    </table>`).join('')

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:'DM Sans',Arial,sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:30px 0;">
      <tr><td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="border-radius:12px;overflow:hidden;">
          <tr><td style="background:#1e3a5f;padding:24px 32px;">
            <div style="color:#fff;font-size:22px;font-weight:600;">Request Letter</div>
            <div style="color:rgba(255,255,255,0.7);font-size:12px;">${dateStr}</div>
          </td></tr>
          <tr><td style="background:#fff;padding:32px;">
            <p style="margin:0 0 20px;color:#1e293b;font-size:15px;line-height:1.65;">${bodyHTML}</p>
            ${attachListHTML}
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr><td style="background:#f1f5f9;border-left:4px solid #1e3a5f;padding:12px 20px;">
                <span style="font-size:14px;color:#1e293b;font-weight:700;">${safeNote}</span>
              </td></tr>
            </table>
            <p style="margin:0 0 20px;color:#1e293b;font-size:14px;">Thank you,<br><br>Regards,</p>
            <div style="border-top:1px solid #e2e8f0;padding-top:16px;">
              <div style="font-weight:600;font-size:15px;color:#1e3a5f;">${safeSenderName}</div>
              <div style="font-size:12px;color:#64748b;">${safeSenderEmail}</div>
            </div>
          </td></tr>
          <tr><td style="background:#f8fafc;padding:16px 32px;text-align:center;">
            <p style="margin:0 0 4px;font-size:10px;color:#64748b;">© ${new Date().getFullYear()} Operations Finance</p>
            <p style="margin:0 0 6px;font-size:10px;font-style:italic;color:#64748b;">***This is a system-generated email from OPs Finance System***</p>
            <p style="margin:0;font-size:10px;color:#94a3b8;"><b>CONFIDENTIALITY NOTICE:</b> This email is for the exclusive use of the intended recipient(s).</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`
}
