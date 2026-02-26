# DigiSign MCP Server

MCP server for the [DigiSign.cz](https://www.digisign.cz) digital signature API. Built for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

Create, send, and manage digital signature envelopes directly from your AI coding assistant.

## Setup

### 1. Get DigiSign API keys

In your DigiSign dashboard: **Settings > Pro vyvojare > API klice**. Create an API key pair (access key + secret key).

### 2. Register with Claude Code

```bash
claude mcp add digisign \
  -e DIGISIGN_ACCESS_KEY=your_access_key \
  -e DIGISIGN_SECRET_KEY=your_secret_key \
  -- node /path/to/digisign-mcp/src/index.js
```

### 3. Install dependencies

```bash
cd /path/to/digisign-mcp
npm install
```

## Tools

### Read tools (safe to auto-approve)

| Tool | Description |
|------|-------------|
| `list_envelopes` | List envelopes with optional status/page filters |
| `get_envelope` | Get detailed envelope info (status, recipients, documents) |
| `list_documents` | List documents attached to an envelope |
| `list_recipients` | List recipients and their signing status |
| `list_tags` | List signature/form tags placed on documents |
| `get_download_url` | Get temporary download URL for signed documents |
| `get_account` | Get account info (credits, plan, usage) |

### Write tools (recommend manual approval)

| Tool | Description |
|------|-------------|
| `create_envelope` | Create a new draft envelope |
| `upload_and_attach_document` | Upload a PDF/DOCX and attach to an envelope |
| `add_recipient` | Add a signer, approver, or CC recipient |
| `add_signature_tag` | Place signature/form tag (placeholder or coordinate positioning) |
| `send_envelope` | Send envelope for signing (emails all recipients) |
| `cancel_envelope` | Cancel a sent envelope (notifies signers) |
| `delete_envelope` | Delete a draft envelope |

## Safety recommendations

Add dangerous write tools to your deny list in `~/.claude/settings.local.json`:

```json
{
  "permissions": {
    "deny": [
      "mcp__digisign__send_envelope",
      "mcp__digisign__cancel_envelope",
      "mcp__digisign__delete_envelope"
    ]
  }
}
```

This ensures Claude Code prompts for confirmation before sending envelopes, cancelling, or deleting — preventing accidental actions.

Safe preparation tools (`create_envelope`, `upload_and_attach_document`, `add_recipient`, `add_signature_tag`) can be added to the allow list since they only modify draft envelopes.

## Signature tag positioning

Two approaches for placing signature tags:

### Placeholder-based (recommended)

Finds text in the PDF and positions the signature tag relative to it:

```
add_signature_tag(
  envelopeId: "...",
  recipientId: "...",
  placeholder: "John Smith, CEO",
  positioning: "top_center"
)
```

### Coordinate-based

Places tag at exact page coordinates (in points):

```
add_signature_tag(
  envelopeId: "...",
  recipientId: "...",
  documentId: "...",
  page: 5,
  xPosition: 320,
  yPosition: 680
)
```

Placeholder-based is more robust — it survives document layout changes.

## Requirements

- Node.js 18+
- DigiSign.cz account with API access
- Claude Code (or any MCP-compatible client)

## License

MIT

---

Built by [David Simoes](https://github.com/davidsimoes) / [Sounds Good Agency](https://soundsgood.agency)
