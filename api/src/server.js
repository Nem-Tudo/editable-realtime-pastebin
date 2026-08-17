const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/codepaste';

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
}));
app.use(express.json({ limit: '2mb' }));

const pasteSchema = new mongoose.Schema({
  _id: { type: String },
  content: { type: String, required: true, default: '' },
  language: { type: String, default: 'plaintext' },
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

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/pastes', async (req, res) => {
  try {
    const paste = await Paste.create({
      _id: newId(),
      content: typeof req.body.content === 'string' ? req.body.content : '',
      language: sanitizeLanguage(req.body.language)
    });

    res.status(201).json({
      id: paste._id,
      content: paste.content,
      language: paste.language,
      createdAt: paste.createdAt,
      updatedAt: paste.updatedAt
    });
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

    res.json({
      id: paste._id,
      content: paste.content,
      language: paste.language,
      createdAt: paste.createdAt,
      updatedAt: paste.updatedAt
    });
  } catch {
    res.status(404).json({ error: 'Paste not found' });
  }
});

app.put('/api/pastes/:id', async (req, res) => {
  try {
    if (typeof req.body.content !== 'string') {
      return res.status(400).json({ error: 'content must be a string' });
    }

    const paste = await Paste.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          content: req.body.content,
          language: sanitizeLanguage(req.body.language),
          updatedAt: new Date()
        }
      },
      { new: true, runValidators: true }
    ).lean();

    if (!paste) {
      return res.status(404).json({ error: 'Paste not found' });
    }

    res.json({
      id: paste._id,
      content: paste.content,
      language: paste.language,
      createdAt: paste.createdAt,
      updatedAt: paste.updatedAt
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update paste' });
  }
});

app.get('/raw/:id', async (req, res) => {
  try {
    const paste = await Paste.findById(req.params.id).lean();

    if (!paste) {
      return res.status(404).type('text/plain').send('Not found');
    }

    res
      .status(200)
      .type('text/plain')
      .set('Cache-Control', 'no-store')
      .send(paste.content);
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
