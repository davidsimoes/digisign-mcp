#!/usr/bin/env node

/**
 * DigiSign MCP Server
 *
 * MCP server for DigiSign.cz digital signature API.
 * Exposes tools for envelope management, document upload,
 * recipient management, and signature tag placement.
 *
 * Auth: DIGISIGN_ACCESS_KEY + DIGISIGN_SECRET_KEY env vars
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as api from './api.js';

const accessKey = process.env.DIGISIGN_ACCESS_KEY;
const secretKey = process.env.DIGISIGN_SECRET_KEY;

if (!accessKey || !secretKey) {
  console.error('Missing DIGISIGN_ACCESS_KEY or DIGISIGN_SECRET_KEY environment variables');
  process.exit(1);
}

const creds = { accessKey, secretKey };

const server = new McpServer({
  name: 'digisign',
  version: '1.0.0',
});

// Helper to format results
function result(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function errorResult(err) {
  return { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true };
}

// === Read tools (safe, auto-approvable) ===

server.tool(
  'list_envelopes',
  'List envelopes with optional status filter. Returns envelope IDs, names, and statuses.',
  {
    status: z.enum(['draft', 'sent', 'completed', 'expired', 'declined', 'cancelled']).optional().describe('Filter by status'),
    page: z.number().optional().describe('Page number (default 1)'),
    itemsPerPage: z.number().optional().describe('Items per page (default 10)'),
  },
  async (params) => {
    try {
      const data = await api.listEnvelopes(creds, params);
      return result(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  'get_envelope',
  'Get detailed information about a specific envelope including status, recipients, documents.',
  {
    envelopeId: z.string().describe('Envelope UUID'),
  },
  async ({ envelopeId }) => {
    try {
      const data = await api.getEnvelope(creds, envelopeId);
      return result(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  'list_documents',
  'List documents attached to an envelope.',
  {
    envelopeId: z.string().describe('Envelope UUID'),
  },
  async ({ envelopeId }) => {
    try {
      const data = await api.listDocuments(creds, envelopeId);
      return result(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  'list_recipients',
  'List recipients of an envelope with their signing status.',
  {
    envelopeId: z.string().describe('Envelope UUID'),
  },
  async ({ envelopeId }) => {
    try {
      const data = await api.listRecipients(creds, envelopeId);
      return result(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  'list_tags',
  'List signature/form tags on an envelope.',
  {
    envelopeId: z.string().describe('Envelope UUID'),
  },
  async ({ envelopeId }) => {
    try {
      const data = await api.listTags(creds, envelopeId);
      return result(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  'get_download_url',
  'Get a temporary download URL (valid 5 min) for signed documents from a completed envelope.',
  {
    envelopeId: z.string().describe('Envelope UUID'),
    output: z.enum(['combined', 'separate', 'only_log']).optional().describe('Output format (default: combined)'),
  },
  async ({ envelopeId, output }) => {
    try {
      const data = await api.getDownloadUrl(creds, envelopeId, { output });
      return result(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  'get_account',
  'Get DigiSign account info — credits, plan, usage.',
  {},
  async () => {
    try {
      const data = await api.getAccount(creds);
      return result(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

// === Write tools (require human confirmation) ===

server.tool(
  'create_envelope',
  'Create a new draft envelope for digital signature. Returns envelope ID for subsequent operations.',
  {
    name: z.string().describe('Envelope name (e.g. "SLA Smlouva - ClientName")'),
    emailBody: z.string().optional().describe('Email body sent to signers (HTML allowed)'),
    emailBodyCompleted: z.string().optional().describe('Email body sent when all parties signed'),
    senderName: z.string().optional().describe('Override sender name'),
    senderEmail: z.string().optional().describe('Override sender email'),
  },
  async (params) => {
    try {
      const data = await api.createEnvelope(creds, params);
      return result(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  'upload_and_attach_document',
  'Upload a local file (PDF/DOCX) and attach it to an envelope.',
  {
    envelopeId: z.string().describe('Envelope UUID'),
    filePath: z.string().describe('Absolute path to the file to upload'),
    documentName: z.string().optional().describe('Display name for the document'),
  },
  async ({ envelopeId, filePath, documentName }) => {
    try {
      const path = await import('node:path');
      const file = await api.uploadFile(creds, filePath);
      const doc = await api.addDocument(creds, envelopeId, {
        fileId: file.id,
        name: documentName || path.basename(filePath),
      });
      return result({ file, document: doc });
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  'add_recipient',
  'Add a signer, approver, or CC recipient to an envelope.',
  {
    envelopeId: z.string().describe('Envelope UUID'),
    role: z.enum(['signer', 'in_person', 'cc', 'approver']).describe('Recipient role'),
    name: z.string().describe('Recipient full name'),
    email: z.string().describe('Recipient email'),
    mobile: z.string().optional().describe('Mobile phone (e.g. +420111222333)'),
  },
  async ({ envelopeId, ...recipient }) => {
    try {
      const data = await api.addRecipient(creds, envelopeId, recipient);
      return result(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  'add_signature_tag',
  'Place a signature or form tag on a document. Use placeholder for text-based positioning or coordinates for exact placement.',
  {
    envelopeId: z.string().describe('Envelope UUID'),
    recipientId: z.string().describe('Recipient UUID'),
    documentId: z.string().optional().describe('Document UUID (required for coordinate positioning)'),
    type: z.enum(['signature', 'approval', 'text', 'date_of_signature', 'checkbox']).optional().describe('Tag type (default: signature)'),
    placeholder: z.string().optional().describe('Placeholder text to find in document (e.g. "{podpis_klient}")'),
    positioning: z.enum(['top_left', 'top_center', 'top_right', 'middle_left', 'center', 'middle_right', 'bottom_left', 'bottom_center', 'bottom_right']).optional().describe('How tag aligns to placeholder'),
    page: z.number().optional().describe('Page number (for coordinate positioning)'),
    xPosition: z.number().optional().describe('X position in points (for coordinate positioning)'),
    yPosition: z.number().optional().describe('Y position in points (for coordinate positioning)'),
  },
  async ({ envelopeId, ...tagParams }) => {
    try {
      const data = await api.addTag(creds, envelopeId, tagParams);
      return result(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  'send_envelope',
  'Send a draft envelope for signature. Requires at least one document, one signer, and signature tags placed.',
  {
    envelopeId: z.string().describe('Envelope UUID'),
  },
  async ({ envelopeId }) => {
    try {
      const data = await api.sendEnvelope(creds, envelopeId);
      return result(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  'cancel_envelope',
  'Cancel a sent envelope. Signers will be notified.',
  {
    envelopeId: z.string().describe('Envelope UUID'),
  },
  async ({ envelopeId }) => {
    try {
      const data = await api.cancelEnvelope(creds, envelopeId);
      return result(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

server.tool(
  'delete_envelope',
  'Delete a draft envelope. Cannot delete sent/completed envelopes.',
  {
    envelopeId: z.string().describe('Envelope UUID'),
  },
  async ({ envelopeId }) => {
    try {
      const data = await api.deleteEnvelope(creds, envelopeId);
      return result(data);
    } catch (err) {
      return errorResult(err);
    }
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
