const express = require('express');
const imaps = require('imap-simple');
const { simpleParser } = require('mailparser');

const app = express();
app.use(express.json());

app.post('/read-emails', async (req, res) => {
  const {
    email,
    password,
    host,
    port = 993,
    tls = true,
    search,
    includeAttachments = false,
    max = 10
  } = req.body;

  // ✅ Basic input validation
  if (!email || !password || !host) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: email, password, or host',
    });
  }

  const date = new Date();
  date.setDate(date.getDate() - 1);
  const defaultSearch = [['SINCE', date.toISOString().slice(0, 10)]];

  const config = {
    imap: {
      user: email,
      password,
      host,
      port,
      tls,
      authTimeout: 10000,
    },
  };

  try {
    const connection = await imaps.connect(config);
    await connection.openBox('INBOX');

    const fetchOptions = {
      bodies: [''],
      markSeen: false,
      struct: true,
    };

    const messages = await connection.search(search || defaultSearch, fetchOptions);
    const results = [];

    for (const message of messages.slice(0, max)) {
      const allParts = imaps.getParts(message.attributes.struct);
      const partsToFetch = allParts.filter(p => {
        const isText = !p.disposition;
        const isAttachment = p.disposition?.type?.toUpperCase() === 'ATTACHMENT';
        return isText || (includeAttachments && isAttachment);
      });

      const parsedMessage = {
        from: '',
        subject: '',
        date: '',
        text: '',
        attachments: [],
      };

      for (const part of partsToFetch) {
        const partData = await connection.getPartData(message, part);
        const parsed = await simpleParser(partData);

        parsedMessage.from = parsed.from?.text || parsedMessage.from;
        parsedMessage.subject = parsed.subject || parsedMessage.subject;
        parsedMessage.date = parsed.date || parsedMessage.date;
        parsedMessage.text = parsed.text || parsedMessage.text;

        if (includeAttachments && parsed.attachments?.length) {
          parsedMessage.attachments.push(...parsed.attachments.map(a => ({
            filename: a.filename,
            contentType: a.contentType,
            size: a.size,
            base64: a.content.toString('base64'),
          })));
        }
      }

      results.push(parsedMessage);
    }

    await connection.end();
    res.json({ success: true, count: results.length, emails: results });
  } catch (err) {
    console.error('[IMAP ERROR]', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(3000, () => {
  console.log('📬 IMAP Email Fetcher API running on port 3000');
});
