const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/codepaste';

app.use(cors());
app.use(express.json({ limit: '4mb' }));

const rawRuleSchema = new mongoose.Schema({
  userAgentRegex: { type: String, required: true, maxlength: 500 },
  content: { type: String, required: true, default: '' }
}, { _id: false });

const pasteSchema = new mongoose.Schema({
  _id: { type: String },
  content: { type: String, required: true, default: '' },
  language: { type: String, default: 'plaintext' },
  rawRules: { type: [rawRuleSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

const Paste = mongoose.model('Paste', pasteSchema);

function newId() {
  return crypto.randomBytes(6).toString('base64url');
}

function sanitizeLanguage(value) {
  if (typeof value !== 'string') return 'plaintext';
  return value.slice(0, 40);
}

function sanitizeRawRules(value) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, 50)
    .filter(rule =>
      rule &&
      typeof rule.userAgentRegex === 'string' &&
      typeof rule.content === 'string' &&
      rule.userAgentRegex.length > 0 &&
      rule.userAgentRegex.length <= 500
    )
    .map(rule => ({
      userAgentRegex: rule.userAgentRegex,
      content: rule.content
    }));
}

function serializePaste(paste) {
  return {
    id: paste._id,
    content: paste.content,
    language: paste.language,
    rawRules: paste.rawRules || [],
    createdAt: paste.createdAt,
    updatedAt: paste.updatedAt
  };
}

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/pastes', async (req, res) => {
  try {
    const paste = await Paste.create({
      _id: newId(),
      content: typeof req.body.content === 'string' ? req.body.content : '',
      language: sanitizeLanguage(req.body.language),
      rawRules: sanitizeRawRules(req.body.rawRules)
    });

    res.status(201).json(serializePaste(paste));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create paste' });
  }
});

app.get('/api/pastes/:id', async (req, res) => {
  try {
    const paste = await Paste.findById(req.params.id).lean();

    if (!paste) {
      return res.status(404).json({ error: 'Paste not found' });
    }

    res.json(serializePaste(paste));
  } catch {
    res.status(404).json({ error: 'Paste not found' });
  }
});

app.put('/api/pastes/:id', async (req, res) => {
  try {
    if (typeof req.body.content !== 'string') {
      return res.status(400).json({ error: 'content must be a string' });
    }

    const now = new Date();

    const paste = await Paste.findOneAndUpdate(
      { _id: req.params.id },
      {
        $set: {
          content: req.body.content,
          language: sanitizeLanguage(req.body.language),
          rawRules: sanitizeRawRules(req.body.rawRules),
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now
        }
      },
      {
        new: true,
        upsert: true,
        runValidators: true
      }
    ).lean();

    res.json(serializePaste(paste));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save paste' });
  }
});

app.get('/raw/:id', async (req, res) => {
  try {
    const paste = await Paste.findById(req.params.id).lean();

    if (!paste) {
      return res.status(404).type('text/plain').send('Not found');
    }

    let content = paste.content;
    const userAgent = req.get('user-agent') || '';

    console.log("New acess: " + userAgent)

    for (const rule of paste.rawRules || []) {
      try {
        if (new RegExp(rule.userAgentRegex, 'i').test(userAgent)) {
          content = rule.content;
          break;
        }
      } catch {
        // Regex inválida: ignora a regra e continua.
      }
    }

    res
      .status(200)
      .type('text/plain')
      .set('Cache-Control', 'no-store')
      .send(content);
  } catch {
    res.status(404).type('text/plain').send('Not found');
  }
});

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`API listening on http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  });
