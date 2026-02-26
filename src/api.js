/**
 * DigiSign API client
 * Handles auth token exchange and all API calls.
 * Docs: https://api.digisign.org/api/docs
 */

const BASE_URL = 'https://api.digisign.org';

let cachedToken = null;
let tokenExpiry = 0;

export async function getToken(accessKey, secretKey) {
  // Reuse token if still valid (with 60s buffer)
  if (cachedToken && Date.now() / 1000 < tokenExpiry - 60) {
    return cachedToken;
  }

  const res = await fetch(`${BASE_URL}/api/auth-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accessKey, secretKey }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Auth failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  cachedToken = data.token;
  tokenExpiry = data.exp;
  return cachedToken;
}

async function apiCall(method, path, { accessKey, secretKey, body, isFormData } = {}) {
  const token = await getToken(accessKey, secretKey);
  const headers = { Authorization: `Bearer ${token}` };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  // Handle downloads (binary responses)
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/pdf') || contentType.includes('application/zip')) {
    const buffer = await res.arrayBuffer();
    return { _binary: true, contentType, buffer: Buffer.from(buffer) };
  }

  // Handle no-content responses
  if (res.status === 204) {
    return { success: true };
  }

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`API error (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

// === Envelope operations ===

export function listEnvelopes(creds, params = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set('status', params.status);
  if (params.page) query.set('page', params.page);
  if (params.itemsPerPage) query.set('itemsPerPage', params.itemsPerPage);
  const qs = query.toString();
  return apiCall('GET', `/api/envelopes${qs ? '?' + qs : ''}`, creds);
}

export function getEnvelope(creds, envelopeId) {
  return apiCall('GET', `/api/envelopes/${envelopeId}`, creds);
}

export function createEnvelope(creds, { name, emailBody, emailBodyCompleted, senderName, senderEmail }) {
  const body = { name };
  if (emailBody) body.emailBody = emailBody;
  if (emailBodyCompleted) body.emailBodyCompleted = emailBodyCompleted;
  if (senderName) body.senderName = senderName;
  if (senderEmail) body.senderEmail = senderEmail;
  return apiCall('POST', '/api/envelopes', { ...creds, body });
}

export function updateEnvelope(creds, envelopeId, updates) {
  return apiCall('PATCH', `/api/envelopes/${envelopeId}`, { ...creds, body: updates });
}

export function deleteEnvelope(creds, envelopeId) {
  return apiCall('DELETE', `/api/envelopes/${envelopeId}`, creds);
}

export function sendEnvelope(creds, envelopeId) {
  return apiCall('POST', `/api/envelopes/${envelopeId}/send`, creds);
}

export function cancelEnvelope(creds, envelopeId) {
  return apiCall('POST', `/api/envelopes/${envelopeId}/cancel`, creds);
}

// === Document operations ===

export async function uploadFile(creds, filePath) {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const fileBuffer = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer]), fileName);

  return apiCall('POST', '/api/files', { ...creds, body: formData, isFormData: true });
}

export function addDocument(creds, envelopeId, { fileId, name }) {
  return apiCall('POST', `/api/envelopes/${envelopeId}/documents`, {
    ...creds,
    body: { file: `/api/files/${fileId}`, name },
  });
}

export function listDocuments(creds, envelopeId) {
  return apiCall('GET', `/api/envelopes/${envelopeId}/documents`, creds);
}

export function downloadEnvelope(creds, envelopeId, { output = 'combined', includeLog = true } = {}) {
  return apiCall('GET', `/api/envelopes/${envelopeId}/download?output=${output}&include_log=${includeLog}`, creds);
}

export function getDownloadUrl(creds, envelopeId, { output = 'combined' } = {}) {
  return apiCall('GET', `/api/envelopes/${envelopeId}/download-url?output=${output}`, creds);
}

// === Recipient operations ===

export function addRecipient(creds, envelopeId, { role, name, email, mobile }) {
  const body = { role, name, email };
  if (mobile) body.mobile = mobile;
  return apiCall('POST', `/api/envelopes/${envelopeId}/recipients`, { ...creds, body });
}

export function listRecipients(creds, envelopeId) {
  return apiCall('GET', `/api/envelopes/${envelopeId}/recipients`, creds);
}

export function getRecipient(creds, envelopeId, recipientId) {
  return apiCall('GET', `/api/envelopes/${envelopeId}/recipients/${recipientId}`, creds);
}

// === Tag operations ===

export function addTag(creds, envelopeId, { documentId, recipientId, type, placeholder, page, xPosition, yPosition, positioning }) {
  const body = {
    recipient: `/api/envelopes/${envelopeId}/recipients/${recipientId}`,
    type: type || 'signature',
  };

  if (placeholder) {
    // Placeholder-based positioning
    body.placeholder = placeholder;
    if (positioning) body.positioning = positioning;
    if (documentId) body.document = `/api/envelopes/${envelopeId}/documents/${documentId}`;
  } else {
    // Coordinate-based positioning
    body.document = `/api/envelopes/${envelopeId}/documents/${documentId}`;
    body.page = page;
    body.xPosition = xPosition;
    body.yPosition = yPosition;
  }

  return apiCall('POST', `/api/envelopes/${envelopeId}/tags`, { ...creds, body });
}

export function addTagByPlaceholder(creds, envelopeId, { recipientId, type, placeholder, positioning, documentIds }) {
  const body = {
    recipient: `/api/envelopes/${envelopeId}/recipients/${recipientId}`,
    type: type || 'signature',
    placeholder,
  };
  if (positioning) body.positioning = positioning;
  if (documentIds) body.applyToDocuments = documentIds;

  return apiCall('POST', `/api/envelopes/${envelopeId}/tags/by-placeholder`, { ...creds, body });
}

export function listTags(creds, envelopeId) {
  return apiCall('GET', `/api/envelopes/${envelopeId}/tags`, creds);
}

// === Account operations ===

export function getAccount(creds) {
  return apiCall('GET', '/api/account', creds);
}
