// ============================================================
// OPS FINANCE - GOOGLE APPS SCRIPT (Email + Drive only)
// Deploy as Web App: Execute as Me, Anyone can access
// ============================================================

const DRIVE_FOLDER_ID = "1Auzl4oiIP2iugjprOYk8rx2nSc85V7OJ"; // your folder

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    switch(data.action) {
      case 'SEND_EMAIL':       return handleSendEmail(data);
      case 'UPLOAD_DRIVE':     return handleUploadDrive(data);
      case 'DELETE_FILE':      return handleDeleteFile(data);
      case 'GET_FILE_URL':     return handleGetFileUrl(data);
      case 'GET_FILE_CONTENT': return handleGetFileContent(data);
      default:                 return err('Unknown action: ' + data.action);
    }
  } catch(ex) {
    return err(ex.toString());
  }
}

function doGet(e) {
  // Health check
  return ok({ status: 'GAS service running', time: new Date().toISOString() });
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
