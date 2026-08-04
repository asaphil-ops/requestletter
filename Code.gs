// ============================================================
// OPS FINANCE - GOOGLE APPS SCRIPT (Email + Drive only)
// Deploy as Web App: Execute as Me, Anyone can access
// ============================================================

const DRIVE_FOLDER_ID = "1Auzl4oiIP2iugjprOYk8rx2nSc85V7OJ"; // your folder
const REQUEST_TRACKER_SPREADSHEET_ID = "12DNNTUggWl6Ff_-3a0qYuDbs1_nt9RBsTNwiNuGxHZ8";
const REQUEST_TRACKER_SHEET_NAME = "Request Letter Tracker";

function doPost(e) {
  try {
    const data = e.parameter && e.parameter.payload
      ? JSON.parse(e.parameter.payload)
      : JSON.parse(e.postData.contents);
    
    switch(data.action) {
      case 'SEND_EMAIL':       return handleSendEmail(data);
      case 'UPLOAD_DRIVE':     return handleUploadDrive(data);
      case 'DELETE_FILE':      return handleDeleteFile(data);
      case 'GET_FILE_URL':     return handleGetFileUrl(data);
      case 'GET_FILE_CONTENT': return handleGetFileContent(data);
      case 'SYNC_REQUEST_TRACKER': return handleSyncRequestTracker(data);
      default:                 return err('Unknown action: ' + data.action);
    }
  } catch(ex) {
    return err(ex.toString());
  }
}

// ============================================================
// SYNC REQUEST LETTER TRACKER TO GOOGLE SHEETS
// ============================================================
function handleSyncRequestTracker(data) {
  if (!Array.isArray(data.rows) || data.rows.length === 0) {
    throw new Error('No request tracker rows were supplied.');
  }

  const spreadsheet = SpreadsheetApp.openById(REQUEST_TRACKER_SPREADSHEET_ID);
  // Write to the first/default worksheet so the synced data is immediately
  // visible when the destination spreadsheet is opened.
  const sheet = spreadsheet.getSheets()[0];

  const width = data.rows[0].length;
  const rows = data.rows.map(function(row) {
    const values = Array.isArray(row) ? row.slice(0, width) : [];
    while (values.length < width) values.push('');
    return values;
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    if (data.replace) sheet.clearContents();
    const startRow = Number(data.startRow) || (data.replace ? 1 : Math.max(sheet.getLastRow() + 1, 1));
    sheet.getRange(startRow, 1, rows.length, width).setValues(rows);

    if (data.replace) {
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, width)
        .setFontWeight('bold')
        .setBackground('#1e3a5f')
        .setFontColor('#ffffff');
      sheet.autoResizeColumns(1, width);
    }
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  return ok({
    rowCount: Math.max(rows.length - 1, 0),
    sheetName: sheet.getName(),
    spreadsheetUrl: spreadsheet.getUrl() + '#gid=' + sheet.getSheetId()
  });
}

function doGet(e) {
  // Health check
  return ok({ status: 'GAS service running', time: new Date().toISOString() });
}

// Run this manually from the Apps Script editor to verify that this project
// can open and write to the configured Request Letter Tracker spreadsheet.
function testRequestTrackerSheet() {
  const spreadsheet = SpreadsheetApp.openById(REQUEST_TRACKER_SPREADSHEET_ID);
  const sheet = spreadsheet.getSheets()[0];
  sheet.getRange(1, 1, 2, 3).setValues([
    ['Connection Test', 'Status', 'Timestamp'],
    ['Request Letter Tracker', 'Connected', new Date()]
  ]);
  sheet.setFrozenRows(1);
  SpreadsheetApp.flush();
  Logger.log('Test data written to: ' + spreadsheet.getUrl() + '#gid=' + sheet.getSheetId());
}

// ============================================================
// SEND EMAIL
// ============================================================
function handleSendEmail(data) {
  const opts = {
    to: data.to,
    subject: data.subject || 'OPs Finance Notification',
    htmlBody: data.htmlBody || '',
    name: data.senderName || 'OPs Finance Portal',
    replyTo: data.senderEmail || ''
  };

  if (data.cc && data.cc.trim()) opts.cc = data.cc.trim();

  // Handle multiple file attachments (base64 array)
  if (data.attachments && data.attachments.length > 0) {
    opts.attachments = data.attachments.map(att => {
      const decoded = Utilities.base64Decode(att.base64);
      return Utilities.newBlob(decoded, att.mimeType || 'application/octet-stream', att.fileName);
    });
  }

  // Handle single Drive file attachment
  if (data.fileId && data.fileId.trim()) {
    try {
      const file = DriveApp.getFileById(data.fileId.trim());
      const blob = file.getBlob();
      if (data.fileName) blob.setName(data.fileName);
      opts.attachments = opts.attachments ? [...opts.attachments, blob] : [blob];
    } catch(fileErr) {
      // File not found, continue without attachment
      Logger.log('File not found: ' + data.fileId);
    }
  }

  MailApp.sendEmail(opts);
  return ok({ message: 'Email sent successfully' });
}

// ============================================================
// UPLOAD FILE TO DRIVE
// ============================================================
function handleUploadDrive(data) {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const decoded = Utilities.base64Decode(data.base64);
  const blob = Utilities.newBlob(decoded, data.mimeType || 'application/octet-stream', data.fileName);

  const file = data.convertToPdf ? createPdfFile(folder, blob, data.fileName, data.mimeType) : folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  const fileId = file.getId();
  const viewUrl = 'https://drive.google.com/file/d/' + fileId + '/view';
  const downloadUrl = file.getDownloadUrl().replace('&export=download', '');
  const previewUrl = 'https://drive.google.com/file/d/' + fileId + '/preview';
  
  return ok({
    fileId: fileId,
    fileName: file.getName(),
    mimeType: file.getMimeType(),
    viewUrl: viewUrl,
    downloadUrl: downloadUrl,
    previewUrl: previewUrl
  });
}

function createPdfFile(folder, blob, fileName, mimeType) {
  const sourceName = fileName || 'attachment';
  const pdfName = withPdfExtension(sourceName);

  if (mimeType === MimeType.PDF || /\.pdf$/i.test(sourceName)) {
    blob.setName(pdfName);
    return folder.createFile(blob);
  }

  const pdfBlob = convertBlobToPdf(blob, sourceName, mimeType);
  pdfBlob.setName(pdfName);
  return folder.createFile(pdfBlob);
}

function convertBlobToPdf(blob, fileName, mimeType) {
  try {
    return blob.getAs(MimeType.PDF);
  } catch (blobErr) {
    const driveAvailable = typeof Drive !== 'undefined' && Drive.Files;
    if (!driveAvailable) {
      throw new Error('Could not convert "' + fileName + '" to PDF. Enable the Advanced Google Drive service in Apps Script, then deploy again.');
    }

    let tempFile;
    try {
      const resource = {
        title: fileName,
        mimeType: mimeType || blob.getContentType()
      };
      tempFile = Drive.Files.insert(resource, blob, { convert: true });
      return Drive.Files.export(tempFile.id, MimeType.PDF);
    } catch (driveErr) {
      throw new Error('Could not convert "' + fileName + '" to PDF: ' + driveErr.message);
    } finally {
      if (tempFile && tempFile.id) {
        try {
          Drive.Files.trash(tempFile.id);
        } catch (trashErr) {
          Logger.log('Could not trash temp conversion file: ' + trashErr);
        }
      }
    }
  }
}

function withPdfExtension(fileName) {
  return String(fileName || 'attachment').replace(/\.[^.]+$/, '') + '.pdf';
}

// ============================================================
// DELETE FILE FROM DRIVE
// ============================================================
function handleDeleteFile(data) {
  const file = DriveApp.getFileById(data.fileId);
  file.setTrashed(true);
  return ok({ message: 'File deleted' });
}

// ============================================================
// GET FILE URL
// ============================================================
function handleGetFileUrl(data) {
  const file = DriveApp.getFileById(data.fileId);
  return ok({
    viewUrl: 'https://drive.google.com/file/d/' + data.fileId + '/view',
    previewUrl: 'https://drive.google.com/file/d/' + data.fileId + '/preview',
    name: file.getName()
  });
}

// ============================================================
// GET FILE CONTENT FOR IN-APP PREVIEW
// ============================================================
function handleGetFileContent(data) {
  const file = DriveApp.getFileById(data.fileId);
  const originalName = file.getName();
  let blob = file.getBlob();
  let name = originalName;
  let mimeType = blob.getContentType();

  if (!isBrowserPreviewMime(mimeType)) {
    try {
      blob = blob.getAs(MimeType.PDF);
      name = withPdfExtension(originalName);
      mimeType = MimeType.PDF;
    } catch (convertErr) {
      Logger.log('Preview conversion skipped for ' + originalName + ': ' + convertErr);
    }
  }

  return ok({
    fileId: data.fileId,
    name: name,
    mimeType: mimeType,
    base64: Utilities.base64Encode(blob.getBytes()),
    viewUrl: 'https://drive.google.com/file/d/' + data.fileId + '/view',
    downloadUrl: file.getDownloadUrl()
  });
}

function isBrowserPreviewMime(mimeType) {
  return mimeType === MimeType.PDF || String(mimeType || '').indexOf('image/') === 0;
}

// ============================================================
// HELPERS
// ============================================================
function ok(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function err(message) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}
