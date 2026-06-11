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
  
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  const fileId = file.getId();
  const viewUrl = 'https://drive.google.com/file/d/' + fileId + '/view';
  const downloadUrl = file.getDownloadUrl().replace('&export=download', '');
  const previewUrl = 'https://drive.google.com/file/d/' + fileId + '/preview';
  
  return ok({
    fileId: fileId,
    viewUrl: viewUrl,
    downloadUrl: downloadUrl,
    previewUrl: previewUrl
  });
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
