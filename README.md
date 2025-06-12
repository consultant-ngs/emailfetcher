# Email Fetcher API

This is a simple Node.js API that connects to IMAP email accounts and fetches emails (optionally with attachments).

## Install & Run

```bash
npm install
node index.js
```

## API Endpoint

**POST** `/read-emails`

### Request body

```json
{
  "email": "you@example.com",
  "password": "yourpassword",
  "host": "imap.host.com",
  "port": 993,
  "tls": true,
  "search": [["UNSEEN"]],
  "includeAttachments": true,
  "max": 10
}
```
