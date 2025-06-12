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
    search = [['SINCE', new Date().toISOString().slice(0, 10)]],
    includeAttachments = false,
    max = 10
  } = req.body;

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
      struct: true
    };

    const messages = await connection.search(search, fetchOptions);
    const results = [];

    for (const message of messages.slice(0, max)) {
      const all = imaps.getParts(message.attributes.struct);
      const partsToFetch = all.filter(p => p.disposition == null || (includeAttachments && p.disposition?.type?.toUpperCase() === 'ATTACHMENT'));

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

        if (parsed.text && !parsedMessage.text) parsedMessage.text = parsed.text;
        if (parsed.subject && !parsedMessage.subject) parsedMessage.subject = parsed.subject;
        if (parsed.from && !parsedMessage.from) parsedMessage.from = parsed.from.text;
        if (parsed.date && !parsedMessage.date) parsedMessage.date = parsed.date;

        if (includeAttachments && parsed.attachments?.length) {
          parsedMessage.attachments = parsed.attachments.map(a => ({
            filename: a.filename,
            contentType: a.contentType,
            size: a.size,
            base64: a.content.toString('base64'),
          }));
        }
      }

      results.push(parsedMessage);
    }

    await connection.end();
    res.json({ success: true, count: results.length, emails: results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(3000, () => {
  console.log('📬 IMAP Email Fetcher API running on port 3000');
});
