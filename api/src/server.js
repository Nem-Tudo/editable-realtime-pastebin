const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT || 4000);
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/codepaste';

app.set('trust proxy', true);
app.use(cors());
app.use(express.json({ limit: '4mb' }));

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me';

function requireBasicAuth(req, res, next) {
  const header = req.get('authorization') || '';
  if (!header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="Code Paste Admin"');
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    const user = separator >= 0 ? decoded.slice(0, separator) : '';
    const password = separator >= 0 ? decoded.slice(separator + 1) : '';

    if (!authHeaderIsValid(req)) throw new Error('invalid credentials');
    next();
  } catch {
    res.set('WWW-Authenticate', 'Basic realm="Code Paste Admin"');
    return res.status(401).json({ error: 'Invalid credentials' });
  }
}

const textSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true, maxlength: 120 },
  content: { type: String, required: true, default: '' },
  language: { type: String, default: 'plaintext' },
  pageViews: { type: Number, default: 0 },
  rawViews: { type: Number, default: 0 }
}, { _id: false });

const ruleSchema = new mongoose.Schema({
  id: { type: String, required: true },
  userAgentRegex: { type: String, default: '', maxlength: 500 },
  ipRegex: { type: String, default: '', maxlength: 500 },
  country: { type: String, default: '', maxlength: 100 },
  region: { type: String, default: '', maxlength: 100 },
  city: { type: String, default: '', maxlength: 100 },
  device: { type: String, default: '', enum: ['', 'mobile', 'tablet', 'tv', 'pc', 'bot'] },
  textId: { type: String, required: true }
}, { _id: false });

const pasteSchema = new mongoose.Schema({
  _id: { type: String },
  texts: { type: [textSchema], default: [] },
  rules: { type: [ruleSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { versionKey: false });

const Paste = mongoose.model('Paste', pasteSchema);

function newId() {
  return crypto.randomBytes(8).toString('base64url');
}

function stringValue(value, max = 10000) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function sanitizeLanguage(value) {
  return stringValue(value, 40) || 'plaintext';
}

function sanitizeTexts(value) {
  const source = Array.isArray(value) ? value.slice(0, 200) : [];
  const incomingDefault = source.find(text => text?.id === 'default');

  const numberValue = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

  const defaultText = {
    id: 'default',
    name: 'Default',
    content: stringValue(incomingDefault?.content, 1000000),
    language: sanitizeLanguage(incomingDefault?.language),
    pageViews: numberValue(incomingDefault?.pageViews ?? incomingDefault?.views),
    rawViews: numberValue(incomingDefault?.rawViews)
  };

  const namedTexts = source
    .filter(text => text?.id !== 'default')
    .map(text => ({
      id: stringValue(text?.id, 100) || newId(),
      name: stringValue(text?.name, 120) || 'Sem nome',
      content: stringValue(text?.content, 1000000),
      language: sanitizeLanguage(text?.language),
      pageViews: numberValue(text?.pageViews ?? text?.views),
      rawViews: numberValue(text?.rawViews)
    }));

  return [defaultText, ...namedTexts];
}

function sanitizeRules(value, texts) {
  if (!Array.isArray(value)) return [];
  const validTextIds = new Set(texts.map(t => t.id));

  return value.slice(0, 200)
    .map(rule => ({
      id: stringValue(rule?.id, 100) || newId(),
      userAgentRegex: stringValue(rule?.userAgentRegex, 500),
      ipRegex: stringValue(rule?.ipRegex, 500),
      country: stringValue(rule?.country, 100),
      region: stringValue(rule?.region, 100),
      city: stringValue(rule?.city, 100),
      device: ['mobile', 'tablet', 'tv', 'pc', 'bot'].includes(rule?.device) ? rule.device : '',
      textId: stringValue(rule?.textId, 100)
    }))
    .filter(rule => validTextIds.has(rule.textId));
}

function serializePaste(paste) {
  return {
    id: paste._id,
    texts: (paste.texts || []).map(text => ({
      id: text.id,
      name: text.name,
      content: text.content,
      language: text.language,
      pageViews: Number(text.pageViews ?? text.views ?? 0),
      rawViews: Number(text.rawViews ?? 0)
    })),
    rules: paste.rules || [],
    createdAt: paste.createdAt,
    updatedAt: paste.updatedAt
  };
}

function detectDevice(userAgent) {
  const ua = String(userAgent || '').toLowerCase();

  if (/smart-tv|hbbtv|appletv|googletv|crkey|roku|web0s|tizen|netcast/.test(ua)) return 'tv';
  if (/ipad|tablet|android(?!.*mobile)|kindle|silk|playbook/.test(ua)) return 'tablet';
  if (/iphone|ipod|android.*mobile|windows phone|mobile/.test(ua)) return 'mobile';
  if (/bot|crawler|spider|headless/.test(ua)) return 'bot';
  return 'pc';
}

function authHeaderIsValid(req) {
  const header = req.get('authorization') || '';
  if (!header.startsWith('Basic ')) return false;

  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    const user = separator >= 0 ? decoded.slice(0, separator) : '';
    const password = separator >= 0 ? decoded.slice(separator + 1) : '';

    const userBuf = Buffer.from(user);
    const expectedUserBuf = Buffer.from(ADMIN_USER);
    const passBuf = Buffer.from(password);
    const expectedPassBuf = Buffer.from(ADMIN_PASSWORD);

    return userBuf.length === expectedUserBuf.length &&
      passBuf.length === expectedPassBuf.length &&
      crypto.timingSafeEqual(userBuf, expectedUserBuf) &&
      crypto.timingSafeEqual(passBuf, expectedPassBuf);
  } catch {
    return false;
  }
}

app.get('/api/auth/check', requireBasicAuth, (req, res) => {
  res.json({ authenticated: true, user: ADMIN_USER });
});

function getClientIp(req) {
  let ip = req.ip || req.socket.remoteAddress || '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}

async function geolocateIp(ip) {
  const cleanIp = String(ip || '').replace(/^::ffff:/, '');
  if (!cleanIp || cleanIp === '127.0.0.1' || cleanIp === '::1' ||
      cleanIp.startsWith('10.') || cleanIp.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(cleanIp)) {
    return { country: '', region: '', city: '' };
  }

  try {
    const response = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(cleanIp)}?fields=status,country,regionName,city`
    );
    if (!response.ok) return { country: '', region: '', city: '' };
    const data = await response.json();
    if (data.status !== 'success') return { country: '', region: '', city: '' };
    return {
      country: data.country || '',
      region: data.regionName || '',
      city: data.city || ''
    };
  } catch {
    return { country: '', region: '', city: '' };
  }
}

function regexMatches(pattern, value) {
  if (!pattern) return true;
  try {
    return new RegExp(pattern, 'i').test(value || '');
  } catch {
    return false;
  }
}

function ruleMatches(rule, context) {
  return regexMatches(rule.userAgentRegex, context.userAgent) &&
    regexMatches(rule.ipRegex, context.ip) &&
    (!rule.country || rule.country.toLowerCase() === context.country.toLowerCase()) &&
    (!rule.region || rule.region.toLowerCase() === context.region.toLowerCase()) &&
    (!rule.city || rule.city.toLowerCase() === context.city.toLowerCase()) &&
    (!rule.device || rule.device === context.device);
}

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/pastes', requireBasicAuth, async (req, res) => {
  try {
    const texts = sanitizeTexts(req.body.texts);
    const rules = sanitizeRules(req.body.rules, texts);

    const paste = await Paste.create({
      _id: newId(),
      texts,
      rules
    });

    res.status(201).json(serializePaste(paste));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create paste' });
  }
});

app.get('/api/pastes', requireBasicAuth, async (req, res) => {
  try {
    const pastes = await Paste.find({}, {
      _id: 1,
      texts: 1,
      rules: 1,
      createdAt: 1,
      updatedAt: 1
    }).sort({ updatedAt: -1 }).lean();

    res.json(pastes.map(serializePaste));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list pastes' });
  }
});

app.get('/api/pastes/:id', async (req, res) => {
  try {
    const paste = await Paste.findById(req.params.id).lean();
    if (!paste) return res.status(404).json({ error: 'Paste not found' });
    res.json(serializePaste(paste));
  } catch {
    res.status(404).json({ error: 'Paste not found' });
  }
});

app.put('/api/pastes/:id', requireBasicAuth, async (req, res) => {
  try {
    const existing = await Paste.findById(req.params.id).lean();
    const texts = sanitizeTexts(req.body.texts);

    // Nunca diminui contadores por causa de um editor que ficou aberto
    // enquanto novas visualizações eram registradas.
    const existingViews = new Map((existing?.texts || []).map(text => [
      text.id,
      {
        pageViews: Number(text.pageViews ?? text.views ?? 0),
        rawViews: Number(text.rawViews ?? 0)
      }
    ]));
    for (const text of texts) {
      const old = existingViews.get(text.id);
      if (old) {
        text.pageViews = Math.max(Number(text.pageViews || 0), old.pageViews);
        text.rawViews = Math.max(Number(text.rawViews || 0), old.rawViews);
      }
    }

    const rules = sanitizeRules(req.body.rules, texts);
    const now = new Date();

    const paste = await Paste.findOneAndUpdate(
      { _id: req.params.id },
      {
        $set: {
          texts,
          rules,
          updatedAt: now
        },
        $unset: {
          content: '',
          language: ''
        },
        $setOnInsert: { createdAt: now }
      },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    res.json(serializePaste(paste));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save paste' });
  }
});

app.delete('/api/pastes/:id', requireBasicAuth, async (req, res) => {
  try {
    const result = await Paste.deleteOne({ _id: req.params.id });
    if (!result.deletedCount) return res.status(404).json({ error: 'Paste not found' });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete paste' });
  }
});

async function resolveContent(req, paste) {
  const userAgent = req.get('user-agent') || '';
  const ip = getClientIp(req);
  const location = await geolocateIp(ip);
  const device = detectDevice(userAgent);

  const context = {
    userAgent,
    ip,
    country: location.country,
    region: location.region,
    city: location.city,
    device
  };

  for (const rule of paste.rules || []) {
    if (ruleMatches(rule, context)) {
      const text = (paste.texts || []).find(item => item.id === rule.textId);
      if (text) {
        return { content: text.content, textId: text.id, context };
      }
    }
  }

  const defaultText = (paste.texts || []).find(item => item.id === 'default');
  if (defaultText) {
    return { content: defaultText.content, textId: defaultText.id, context };
  }

  return { content: '', textId: null, context };
}

async function incrementTextView(pasteId, textId, field) {
  if (!textId || !['pageViews', 'rawViews'].includes(field)) return;
  await Paste.updateOne(
    { _id: pasteId, 'texts.id': textId },
    { $inc: { [`texts.$.${field}`]: 1 } }
  );
}

app.get('/raw/:id', async (req, res) => {
  try {
    const paste = await Paste.findById(req.params.id).lean();
    if (!paste) return res.status(404).type('text/plain').send('Not found');

    const result = await resolveContent(req, paste);

    await incrementTextView(paste._id, result.textId, 'rawViews');

    console.log(
      `[RAW] ${result.context.ip} ${result.context.country}/${result.context.region}/${result.context.city} ` +
      `${result.context.device} ${JSON.stringify(result.context.userAgent)} -> ${paste._id}`
    );

    res
      .status(200)
      .type('text/plain')
      .set('Cache-Control', 'no-store')
      .send(result.content);
  } catch (err) {
    console.error(err);
    res.status(404).type('text/plain').send('Not found');
  }
});

app.get('/api/pastes/:id/render', async (req, res) => {
  try {
    const paste = await Paste.findById(req.params.id).lean();
    if (!paste) return res.status(404).json({ error: 'Paste not found' });

    const result = await resolveContent(req, paste);
    if (req.query.count !== '0') {
      await incrementTextView(paste._id, result.textId, 'pageViews');
    }
    const selectedText = (paste.texts || []).find(text => text.id === result.textId);
    res.json({
      id: paste._id,
      content: result.content,
      language: selectedText?.language || 'plaintext',
      textId: result.textId,
      device: result.context.device
    });
  } catch {
    res.status(404).json({ error: 'Paste not found' });
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
