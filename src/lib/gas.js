import { escapeHtml } from './utils'

const GAS_URL = import.meta.env.VITE_GAS_URL

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Apps Script web apps can intermittently reject overlapping Drive uploads.
// Keep one upload in flight across the whole portal and let Drive settle briefly
// before starting the next request.
const UPLOAD_COOLDOWN_MS = 1_500
let uploadQueue = Promise.resolve()
let lastUploadFinishedAt = 0

function enqueueDriveUpload(task) {
  const queuedTask = uploadQueue
    .catch(() => undefined) // A failed upload must not block the next queued file.
    .then(async () => {
      const elapsed = Date.now() - lastUploadFinishedAt
      if (lastUploadFinishedAt && elapsed < UPLOAD_COOLDOWN_MS) {
        await wait(UPLOAD_COOLDOWN_MS - elapsed)
      }
      try {
        return await task()
      } finally {
        lastUploadFinishedAt = Date.now()
      }
    })

  // Preserve a failure for this caller while keeping the shared queue usable.
  uploadQueue = queuedTask.catch(() => undefined)
  return queuedTask
}

async function callGAS(payload, { retries = 2 } = {}) {
  if (!GAS_URL) throw new Error('Google Apps Script URL is not configured.')
  const isUpload = payload.action === 'UPLOAD_DRIVE'
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 90_000)
      let res
      try {
        // Do not set Content-Type here: a simple request avoids a CORS preflight
        // that Apps Script web apps do not consistently handle.
        res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify(payload), signal: controller.signal, cache: 'no-store' })
      } finally {
        clearTimeout(timeout)
      }
      if (res.status === 404) {
        const error = new Error('Google Apps Script temporarily returned 404.')
        error.status = 404
        // A configured deployment cannot be permanently missing if uploads in the
        // same session have succeeded. Apps Script occasionally returns a transient
        // 404 while routing a busy upload request, so retry that case safely.
        error.retryable = isUpload
        throw error
      }
      if (!res.ok) {
        const error = new Error(`Google Apps Script responded with ${res.status}: ${res.statusText || 'Request failed'}`)
        error.retryable = res.status === 408 || res.status === 429 || res.status >= 500
        throw error
      }
      const body = await res.text()
      let json
      try {
        json = JSON.parse(body)
      } catch {
        const error = new Error('Google Apps Script returned an invalid response. Verify that the deployed web app is accessible to all authorized users.')
        error.retryable = true
        throw error
      }
      if (!json.success) throw new Error(json.error || 'Google Apps Script returned an error.')
      return json.data
    } catch (err) {
      const networkError = err instanceof TypeError || err?.name === 'AbortError'
      if (attempt < retries && (networkError || err.retryable)) {
        const retryDelay = Math.min(12_000, 1_000 * (2 ** attempt)) + Math.round(Math.random() * 400)
        await wait(retryDelay)
        continue
      }
      console.error('GAS Call Failed:', err)
      if (isUpload && err?.status === 404) {
        throw new Error('The upload service is temporarily unavailable. Please wait a moment and try the file again.')
      }
      if (!isUpload && err?.status === 404) {
        throw new Error('Google Apps Script deployment was not found (404). Create a Web App deployment and update VITE_GAS_URL with its /exec URL.')
      }
      throw err
    }
  }
}

export async function testGASConnection() {
  if (!GAS_URL) throw new Error('Google Apps Script URL is not configured.')
  const result = await callGAS({ action: 'TEST_CONNECTION' })
  return { ...result, configured: true }
}

export async function sendEmail({ to, cc, subject, htmlBody, senderName, senderEmail, attachments = [], inlineImages, fileId, fileName }) {
  return callGAS({ action: 'SEND_EMAIL', to, cc, subject, htmlBody, senderName, senderEmail, attachments, inlineImages, fileId, fileName })
}

export async function uploadToDrive(file, options = {}) {
  if (!(file instanceof Blob)) throw new Error('Choose a valid file to upload.')
  // Apps Script receives base64 in JSON, which adds about 33% to the file size.
  // Keeping the source below this limit prevents intermittent request-size failures.
  const maxFileSize = 18 * 1024 * 1024
  if (file.size > maxFileSize) {
    throw new Error(`"${file.name || 'File'}" is too large. Upload files up to 18 MB.`)
  }
  const base64 = await fileToBase64(file)
  const uploadId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return enqueueDriveUpload(() => callGAS({
    action: 'UPLOAD_DRIVE',
    uploadId,
    base64,
    fileName: file.name,
    mimeType: file.type,
    convertToPdf: Boolean(options.convertToPdf),
  }, { retries: 4 }))
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
    reader.onload = (e) => {
      const value = e.target?.result
      const base64 = typeof value === 'string' ? value.split(',')[1] : ''
      if (!base64) reject(new Error('The selected file could not be read. Please choose it again.'))
      else resolve(base64)
    }
    reader.onerror = () => reject(new Error('The selected file could not be read. Please choose it again.'))
    reader.onabort = () => reject(new Error('Reading the selected file was cancelled.'))
    reader.readAsDataURL(file)
  })
}

// ============================================================
// BUILD RESPONSIVE HTML EMAIL
// - Uses width=100% so email fills full Gmail reading pane on desktop
// - max-width:900px via wrapper table for Outlook/Apple Mail
// - @media for Gmail Android mobile tweaks
// ============================================================
export function buildEmailHTML({ subject, senderName, senderEmail, note, messageBody, attachments = [], requestDetails, emailDetails, today, emailTitle = 'Operations Finance' }) {
  const dateStr = today || new Date().toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })
  const safeSenderName = escapeHtml(senderName || 'Operations Finance')
  const safeSenderEmail = escapeHtml(senderEmail || '')
  const baseBody = messageBody || "Good day, Ma'am/Sir,\n\nKindly see the attached File/s"
  const bodyHTML = escapeHtml(baseBody)
    .split('\n')
    .map(line => line.trim() ? line : '&nbsp;')
    .join('<br>')
  const formatDateTime = value => {
    if (!value) return ''
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    return date.toLocaleString('en-PH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    })
  }
  const requestRows = requestDetails ? [
    ['Request Type', requestDetails.type],
    ['Beneficiary', requestDetails.beneficiary],
    ['Date Received', requestDetails.dateReceived],
    ['Encoded in the Portal', requestDetails.dateEncoded],
    ['Title', requestDetails.title],
    ['Description', requestDetails.description],
    ['Amount', requestDetails.amount],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '') : []
  const details = emailDetails || requestDetails
  const detailsRows = emailDetails?.rows || requestRows
  const detailsTitle = requestDetails ? 'Request Letter Details' : 'Expenses Details'
  const timeline = (emailDetails?.timeline || requestDetails?.timeline || []).slice(0, 3)
  const requestDetailsHTML = details ? `
    <h2 style="margin:28px 0 12px 0;color:#17365d;font-size:18px;letter-spacing:-.2px;font-family:'Segoe UI',Arial,sans-serif;">
      ${escapeHtml(detailsTitle)}
    </h2>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;border:1px solid #dbe4ef;border-radius:10px;overflow:hidden;margin-bottom:26px;">
      ${detailsRows.map(([label, value], index) => `
        <tr style="background-color:${index % 2 ? '#ffffff' : '#f8fafc'};">
          <td width="32%" style="padding:14px 15px;color:#64748b;font-size:15px;line-height:1.45;border-right:2px solid #ff9238;border-bottom:1px solid #edf0f3;font-family:'Segoe UI',Arial,sans-serif;">
            ${escapeHtml(label)}
          </td>
          <td width="36" style="padding:10px 10px;border-bottom:1px solid #edf0f3;text-align:center;">
            <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:#ff9238;color:#ffffff;text-align:center;line-height:22px;font-size:14px;font-weight:700;">&#10003;</span>
          </td>
          <td style="padding:14px 15px;color:#1e293b;font-size:16px;line-height:1.45;font-weight:600;border-bottom:1px solid #edf0f3;font-family:'Segoe UI',Arial,sans-serif;">
            ${escapeHtml(value)}
          </td>
        </tr>`).join('')}
    </table>
    ${timeline.length ? `<h2 style="margin:28px 0 14px;color:#17365d;font-size:21px;letter-spacing:-.2px;font-family:'Segoe UI',Arial,sans-serif;">Processing timeline</h2>
    ${emailDetails?.lastUpdated ? `<div style="margin:0 0 18px;color:#64748b;font-size:12px;">Last update on ${escapeHtml(emailDetails.lastUpdated)}</div>` : ''}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:26px;border:1px solid #dfe7f0;border-radius:12px;background:#fbfcfe;">
      ${timeline.map((event, index) => `
        <tr>
          <td width="54" valign="top" align="center" style="padding:16px 0 4px 16px;">
            <span style="display:inline-block;width:30px;height:30px;border-radius:50%;background:${index === timeline.length - 1 ? '#17365d' : '#eaf2fb'};color:${index === timeline.length - 1 ? '#ffffff' : '#24527e'};text-align:center;line-height:30px;font-size:14px;font-weight:700;font-family:'Segoe UI',Arial,sans-serif;">${index + 1}</span>
          </td>
          <td valign="top" style="padding:16px 18px 14px 12px;${index < timeline.length - 1 ? 'border-bottom:1px solid #e8edf3;' : ''}font-family:'Segoe UI',Arial,sans-serif;">
            <strong style="display:block;font-size:16px;line-height:1.4;color:#1e293b;">${escapeHtml(event.label)}</strong>
            <span style="display:block;margin-top:3px;color:#52657b;font-size:14px;line-height:1.5;">${escapeHtml(event.description || '')}</span>
            ${event.by ? `<span style="display:block;margin-top:4px;color:#64748b;font-size:13px;">${escapeHtml(event.by)}</span>` : ''}
            <span style="display:block;margin-top:7px;color:#d33155;font-size:14px;font-weight:700;">${escapeHtml(formatDateTime(event.at) ? `${formatDateTime(event.at)} PHT` : 'Date not recorded')}</span>
          </td>
        </tr>`).join('')}
    </table>` : ''}` : ''
  const requestHeader = escapeHtml(subject || dateStr)

  // Attachment list — all inline styles
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(emailTitle)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style type="text/css">
    /*
     * KEY: inner table uses width=100% so it fills Gmail desktop reading pane.
     * On mobile (Android Gmail supports @media), reduce padding only.
     */
    @media screen and (max-width:600px) {
      .w-mobile   { width:100% !important; display:block !important; }
      .hdr-cell   { padding:20px 18px !important; }
      .body-cell  { padding:24px 16px !important; }
      .foot-cell  { padding:14px 16px !important; }
      .hdr-logo   { width:140px !important; }
      .title-text { font-size:27px !important; line-height:1.2 !important; }
      .status-text { font-size:14px !important; line-height:1.55 !important; }
      .logo-image { width:300px !important; max-width:100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#eef0f3;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">

<!--
  OUTER TABLE — fills 100% of the email client container (Gmail reading pane on desktop
  is already constrained by Gmail's own layout, so width=100% here fills it completely).
-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="width:100%;min-width:100%;background-color:#eef0f3;">
  <tr>
    <td align="center" valign="top" style="padding:28px 0;">

      <!-- CONTENT TABLE — responsive width with a wider desktop maximum. -->
      <!--[if mso]>
      <table width="900" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td>
      <![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="width:100%;max-width:900px;margin:0 auto;background-color:#ffffff;
                    border-radius:12px;overflow:hidden;
                    box-shadow:0 2px 16px rgba(0,0,0,0.10);">

        <!-- ====== HEADER ====== -->
        <tr>
          <td class="hdr-cell" valign="top"
              bgcolor="#182438" style="background-color:#182438;padding:24px 36px;border-radius:12px 12px 0 0;border-bottom:4px solid #69ac14;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle" align="left" style="padding:0 0 18px 0;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:10px;">
                    <tr>
                      <td valign="middle" style="padding:5px 7px 5px 9px;">
                        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="34" height="34" style="width:34px;height:34px;border:2px solid #69ac14;border-radius:50%;">
                          <tr>
                            <td valign="bottom" align="center" style="padding:0 2px 5px;">
                              <span style="display:inline-block;width:5px;height:10px;background:#ff8a00;vertical-align:bottom;"></span>
                              <span style="display:inline-block;width:5px;height:15px;background:#69ac14;vertical-align:bottom;"></span>
                              <span style="display:inline-block;width:5px;height:21px;background:#69ac14;vertical-align:bottom;"></span>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td valign="middle" style="padding:4px 12px 4px 0;font-family:'Segoe UI',Arial,sans-serif;white-space:nowrap;">
                        <div style="font-size:19px;line-height:1;font-weight:800;letter-spacing:-.6px;color:#ff8a00;">OPS<span style="color:#69ac14;">-FIN</span></div>
                        <div style="margin-top:3px;color:#f5770b;font-size:8px;line-height:1.1;white-space:nowrap;">Operations Finance</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td colspan="2" valign="middle">
                  <div class="title-text"
                       style="color:#ffffff;font-size:28px;font-weight:700;letter-spacing:-0.4px;
                              line-height:1.25;margin:0 0 5px 0;">
                    ${escapeHtml(emailTitle)}
                  </div>
                  <div class="status-text" style="color:#dbeafe;font-size:15px;line-height:1.6;margin:0;">
                    ${requestHeader}
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ====== BODY ====== -->
        <tr>
          <td class="body-cell" style="background-color:#ffffff;padding:32px 36px;">

            <!-- Message -->
            <p style="margin:0 0 22px 0;color:#1e293b;font-size:15px;line-height:1.75;
                      font-family:'Segoe UI',Arial,sans-serif;">
              ${bodyHTML}
            </p>

            ${requestDetailsHTML}

            <!-- Attachments -->
            <!-- Regards -->
            <p style="margin:0 0 22px 0;color:#1e293b;font-size:14px;line-height:1.7;
                      font-family:'Segoe UI',Arial,sans-serif;">
              Thank you,<br><br>Regards,
            </p>

            <!-- Signature -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                   style="width:100%;border-top:1px solid #e2e8f0;padding-top:16px;">
              <tr>
                <td style="padding-top:16px;">
                  <div style="font-weight:700;font-size:15px;color:#1e3a5f;margin-bottom:2px;
                              font-family:'Segoe UI',Arial,sans-serif;">${safeSenderName}</div>
                  <div style="font-size:12px;color:#64748b;margin-bottom:2px;line-height:1.7;
                              font-family:'Segoe UI',Arial,sans-serif;">
                    ${safeSenderEmail}<br>
                    <a href="mailto:operations.finance@asaphil.org" style="color:#2563eb;text-decoration:underline;">operations.finance@asaphil.org</a>
                  </div>
                  <div style="font-size:11px;color:#94a3b8;
                              font-family:'Segoe UI',Arial,sans-serif;">
                    Operations Finance &bull; ASA Philippines Foundation, Inc.
                  </div>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ====== FOOTER ====== -->
        <tr>
          <td class="foot-cell"
              style="background-color:#f8fafc;padding:16px 36px;text-align:center;
                     border-top:1px solid #e8ecf0;border-radius:0 0 12px 12px;">
            <p style="margin:0 0 3px 0;font-size:10px;color:#64748b;
                      font-family:'Segoe UI',Arial,sans-serif;">
              &#169; ${new Date().getFullYear()} Operations Finance &bull; ASA Philippines Foundation, Inc.
            </p>
            <p style="margin:0 0 4px 0;font-size:10px;font-style:italic;color:#94a3b8;
                      font-family:'Segoe UI',Arial,sans-serif;">
              ***This is a system-generated email from OPs Finance System***
            </p>
            <p style="margin:0;font-size:10px;color:#94a3b8;
                      font-family:'Segoe UI',Arial,sans-serif;">
              <strong>CONFIDENTIALITY NOTICE:</strong>
              This email is for the exclusive use of the intended recipient(s).
            </p>
          </td>
        </tr>

      </table>
      <!--[if mso]></td></tr></table><![endif]-->

    </td>
  </tr>
</table>

</body>
</html>`
}
