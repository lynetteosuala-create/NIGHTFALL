import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'nightfall-db.json');
const SESSION_SECRET = process.env.SESSION_SECRET || 'nightfall-dev-session-signing-key-2026';

interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  salt: string;
  emailVerified: boolean;
  verificationCodeHash: string | null;
  verificationExpiresAt: number | null;
  lastCodeIssuedAt: number | null;
  createdAt: string;
  updatedAt: string;
  progress: Record<string, unknown> | null;
}

interface DatabaseSchema {
  users: StoredUser[];
  revokedTokens: string[];
}

function ensureDb(): DatabaseSchema {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_FILE)) {
    const empty: DatabaseSchema = { users: [], revokedTokens: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(empty, null, 2), 'utf8');
    return empty;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
      revokedTokens: Array.isArray(parsed.revokedTokens) ? parsed.revokedTokens : [],
    };
  } catch {
    return { users: [], revokedTokens: [] };
  }
}

function saveDb(db: DatabaseSchema): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmpFile, DB_FILE);
}

function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash: derived, salt: actualSalt };
}

function verifyPassword(password: string, storedHash: string, salt: string): boolean {
  const { hash } = hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function hashVerificationCode(code: string): string {
  return crypto.createHmac('sha256', SESSION_SECRET).update(code).digest('hex');
}

function signToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      jti: crypto.randomUUID(),
      exp: Date.now() + 1000 * 60 * 60 * 24 * 14,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyToken(token: string, revokedTokens: string[]): { sub: string } | null {
  if (!token || revokedTokens.includes(token)) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      sub: string;
      exp: number;
    };
    if (!parsed.sub || Date.now() > parsed.exp) return null;
    return { sub: parsed.sub };
  } catch {
    return null;
  }
}

function extractBearerToken(req: express.Request): string {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return '';
}

function isPrivateIp(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '::1' ||
    lower === '0.0.0.0' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }
  if (net.isIPv4(lower)) {
    const parts = lower.split('.').map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
  }
  return false;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .trim();
}

function extractMetaContent(html: string, key: string): string {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, 'i'),
  ];
  for (const re of patterns) {
    const match = html.match(re);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }
  return '';
}

const CHAPTER_PREVIEW_META: Record<
  string,
  { title: string; description: string; image: string; badge: string }
> = {
  city: {
    title: 'NIGHTFALL: Chapter 1 — The Forgotten City',
    description:
      'Restore 3 district signal beacons, rescue trapped survivors, and survive Night Stalkers across rain-soaked Blackwood Avenue.',
    image: '/src/assets/images/nightfall_cover_keyart_1794592069118.jpg',
    badge: 'Chapter 1 · Moderate Threat',
  },
  hospital: {
    title: 'NIGHTFALL: Chapter 2 — The Abandoned Hospital',
    description:
      'Solve the backup generator circuit, recover patient research logs, and defeat the Mutated Beast inside St. Jude Sanatorium.',
    image: '/src/assets/images/chapter_hospital_banner_1794592069712.jpg',
    badge: 'Chapter 2 · High Threat',
  },
  forest: {
    title: 'NIGHTFALL: Chapter 3 — The Dark Forest',
    description:
      'Align the Moon Monolith runes under pale midnight fog and fend off agile Shadow Creatures in Hollowpine Woods.',
    image: '/src/assets/images/chapter_forest_banner_1794592069795.jpg',
    badge: 'Chapter 3 · Severe Threat',
  },
  underground: {
    title: 'NIGHTFALL: Chapter 4 — Underground Secrets',
    description:
      'Override subterranean bio-containment locks and confront venomous Underground Horrors alongside The Dread Warden.',
    image: '/src/assets/images/chapter_hospital_banner_1794592069712.jpg',
    badge: 'Chapter 4 · Extreme Threat',
  },
  citadel: {
    title: 'NIGHTFALL: Chapter 5 — The Final Night',
    description:
      'Shatter the Eclipse Anchors beneath a blood-moon storm and battle The Eclipse Sovereign in the ultimate showdown.',
    image: '/src/assets/images/nightfall_cover_keyart_1794592069118.jpg',
    badge: 'Chapter 5 · Nightmare Boss',
  },
};

const MODE_LABELS: Record<string, string> = {
  story: 'Story Campaign',
  survival: 'Endless Survival Mode',
  hunt: 'Monster Hunt Contract',
  boss: 'Apex Boss Battle',
  exploration: 'Exploration Mode',
};

function buildInternalPreview(parsedUrl: URL) {
  const chapter = parsedUrl.searchParams.get('chapter') || 'city';
  const mode = parsedUrl.searchParams.get('mode') || 'story';
  const hunt = parsedUrl.searchParams.get('hunt');
  const chapterInfo = CHAPTER_PREVIEW_META[chapter] || CHAPTER_PREVIEW_META.city;
  const modeTitle = MODE_LABELS[mode] || 'Playable 3D Mission';

  let title = chapterInfo.title;
  let description = chapterInfo.description;
  if (mode !== 'story') {
    title = `NIGHTFALL: ${modeTitle} — ${chapterInfo.title.replace('NIGHTFALL: ', '')}`;
  }
  if (hunt) {
    description = `Active Monster Hunt Contract targeting ${hunt.replace(/_/g, ' ')}. Track clues, engage in 3D combat, and earn bonus Silver Shards.`;
  }

  return {
    url: parsedUrl.toString(),
    title,
    description,
    image: chapterInfo.image,
    domain: parsedUrl.host || 'nightfall.game',
    type: 'mission' as const,
    metaLine: `${modeTitle} · ${chapterInfo.badge}`,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'nightfall-monster-hunters' });
  });

  // Register account (email + password, no phone number)
  app.post('/api/auth/register', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const initialProgress = req.body?.progress && typeof req.body.progress === 'object' ? req.body.progress : null;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters long.' });
      return;
    }

    const db = ensureDb();
    if (db.users.some((u) => u.email === email)) {
      res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
      return;
    }

    const { hash, salt } = hashPassword(password);
    const verificationCode = String(crypto.randomInt(100000, 999999));
    const now = new Date().toISOString();

    const newUser: StoredUser = {
      id: crypto.randomUUID(),
      email,
      passwordHash: hash,
      salt,
      emailVerified: false,
      verificationCodeHash: hashVerificationCode(verificationCode),
      verificationExpiresAt: Date.now() + 15 * 60 * 1000,
      lastCodeIssuedAt: Date.now(),
      createdAt: now,
      updatedAt: now,
      progress: initialProgress,
    };

    db.users.push(newUser);
    saveDb(db);

    const token = signToken(newUser.id);

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        emailVerified: newUser.emailVerified,
        createdAt: newUser.createdAt,
      },
      progress: newUser.progress,
      verificationDispatch: {
        channel: 'email',
        expiresInMinutes: 15,
        // Provided for local/sandbox verification when SMTP relay is not configured
        verificationCodePreview: process.env.SMTP_HOST ? undefined : verificationCode,
      },
    });
  });

  // Verify 6-digit email verification code
  app.post('/api/auth/verify-email', (req, res) => {
    const token = extractBearerToken(req);
    const db = ensureDb();
    const session = verifyToken(token, db.revokedTokens);
    if (!session) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const code = String(req.body?.code || '').trim();
    if (!/^\d{6}$/.test(code)) {
      res.status(400).json({ error: 'Enter the 6-digit verification code sent to your email.' });
      return;
    }

    const user = db.users.find((u) => u.id === session.sub);
    if (!user) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    if (user.emailVerified) {
      res.json({
        user: {
          id: user.id,
          email: user.email,
          emailVerified: true,
          createdAt: user.createdAt,
        },
      });
      return;
    }

    if (!user.verificationCodeHash || !user.verificationExpiresAt || Date.now() > user.verificationExpiresAt) {
      res.status(400).json({ error: 'Verification code has expired. Request a new code.' });
      return;
    }

    const providedHash = hashVerificationCode(code);
    const a = Buffer.from(providedHash, 'hex');
    const b = Buffer.from(user.verificationCodeHash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      res.status(400).json({ error: 'Invalid verification code. Check your 6-digit code and try again.' });
      return;
    }

    user.emailVerified = true;
    user.verificationCodeHash = null;
    user.verificationExpiresAt = null;
    user.updatedAt = new Date().toISOString();
    saveDb(db);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: true,
        createdAt: user.createdAt,
      },
    });
  });

  // Resend verification code
  app.post('/api/auth/resend-code', (req, res) => {
    const token = extractBearerToken(req);
    const db = ensureDb();
    const session = verifyToken(token, db.revokedTokens);
    if (!session) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const user = db.users.find((u) => u.id === session.sub);
    if (!user) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const verificationCode = String(crypto.randomInt(100000, 999999));
    user.verificationCodeHash = hashVerificationCode(verificationCode);
    user.verificationExpiresAt = Date.now() + 15 * 60 * 1000;
    user.lastCodeIssuedAt = Date.now();
    user.updatedAt = new Date().toISOString();
    saveDb(db);

    res.json({
      verificationDispatch: {
        channel: 'email',
        expiresInMinutes: 15,
        verificationCodePreview: process.env.SMTP_HOST ? undefined : verificationCode,
      },
    });
  });

  // Login
  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    const db = ensureDb();
    const user = db.users.find((u) => u.email === email);
    if (!user || !verifyPassword(password, user.passwordHash, user.salt)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
      progress: user.progress,
    });
  });

  // Logout
  app.post('/api/auth/logout', (req, res) => {
    const token = extractBearerToken(req);
    if (token) {
      const db = ensureDb();
      if (!db.revokedTokens.includes(token)) {
        db.revokedTokens.push(token);
        if (db.revokedTokens.length > 500) {
          db.revokedTokens = db.revokedTokens.slice(-250);
        }
        saveDb(db);
      }
    }
    res.json({ ok: true });
  });

  // Current user + saved progress
  app.get('/api/auth/me', (req, res) => {
    const token = extractBearerToken(req);
    const db = ensureDb();
    const session = verifyToken(token, db.revokedTokens);
    if (!session) {
      res.status(401).json({ error: 'Session expired or invalid.' });
      return;
    }
    const user = db.users.find((u) => u.id === session.sub);
    if (!user) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    res.json({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
      },
      progress: user.progress,
    });
  });

  // Security password protection: update password
  app.post('/api/auth/change-password', (req, res) => {
    const token = extractBearerToken(req);
    const db = ensureDb();
    const session = verifyToken(token, db.revokedTokens);
    if (!session) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters long.' });
      return;
    }

    const user = db.users.find((u) => u.id === session.sub);
    if (!user) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    if (!verifyPassword(currentPassword, user.passwordHash, user.salt)) {
      res.status(401).json({ error: 'Current password is incorrect.' });
      return;
    }

    const { hash, salt } = hashPassword(newPassword);
    user.passwordHash = hash;
    user.salt = salt;
    user.updatedAt = new Date().toISOString();
    saveDb(db);

    res.json({ ok: true });
  });

  // Save & load player progress
  app.get('/api/progress', (req, res) => {
    const token = extractBearerToken(req);
    const db = ensureDb();
    const session = verifyToken(token, db.revokedTokens);
    if (!session) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const user = db.users.find((u) => u.id === session.sub);
    if (!user) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    res.json({ progress: user.progress });
  });

  app.put('/api/progress', (req, res) => {
    const token = extractBearerToken(req);
    const db = ensureDb();
    const session = verifyToken(token, db.revokedTokens);
    if (!session) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const progress = req.body?.progress;
    if (!progress || typeof progress !== 'object') {
      res.status(400).json({ error: 'Invalid progress payload.' });
      return;
    }
    const user = db.users.find((u) => u.id === session.sub);
    if (!user) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    user.progress = progress as Record<string, unknown>;
    user.updatedAt = new Date().toISOString();
    saveDb(db);
    res.json({ ok: true, updatedAt: user.updatedAt });
  });

  // Link Preview endpoint (supports internal mission/game links + external OpenGraph scraping)
  app.post('/api/link-preview', async (req, res) => {
    const rawUrl = String(req.body?.url || '').trim();
    if (!rawUrl) {
      res.status(400).json({ error: 'Please provide a URL to preview.' });
      return;
    }

    const requestOrigin = `${req.protocol}://${req.get('host')}`;
    let parsed: URL;
    try {
      parsed = rawUrl.startsWith('/') ? new URL(rawUrl, requestOrigin) : new URL(rawUrl);
    } catch {
      res.status(400).json({ error: 'Invalid URL format. Include https:// or a valid mission path.' });
      return;
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      res.status(400).json({ error: 'Only HTTP and HTTPS links are supported.' });
      return;
    }

    // Check if internal game/mission share URL
    const appOrigin = process.env.APP_URL ? new URL(process.env.APP_URL).host : '';
    const isSameOrigin =
      parsed.host === req.get('host') ||
      (appOrigin && parsed.host === appOrigin) ||
      parsed.pathname === '/share' ||
      parsed.searchParams.has('chapter') ||
      parsed.searchParams.has('mode');

    if (isSameOrigin) {
      res.json({ preview: buildInternalPreview(parsed) });
      return;
    }

    if (isPrivateIp(parsed.hostname)) {
      res.status(400).json({ error: 'Private or loopback network URLs cannot be previewed.' });
      return;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const response = await fetch(parsed.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent': 'NightfallLinkPreviewBot/1.0 (+https://nightfall.game)',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      clearTimeout(timeout);

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        res.json({
          preview: {
            url: parsed.toString(),
            title: parsed.hostname,
            description: `External resource (${contentType || 'linked document'})`,
            image: '/src/assets/images/nightfall_cover_keyart_1794592069118.jpg',
            domain: parsed.hostname,
            type: 'external',
            metaLine: `External Link · ${parsed.hostname}`,
          },
        });
        return;
      }

      const html = (await response.text()).slice(0, 200_000);
      const ogTitle = extractMetaContent(html, 'og:title') || extractMetaContent(html, 'twitter:title');
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = ogTitle || (titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]) : parsed.hostname);

      const description =
        extractMetaContent(html, 'og:description') ||
        extractMetaContent(html, 'twitter:description') ||
        extractMetaContent(html, 'description') ||
        `Linked webpage on ${parsed.hostname}`;

      let image = extractMetaContent(html, 'og:image') || extractMetaContent(html, 'twitter:image');
      if (image && !image.startsWith('http')) {
        try {
          image = new URL(image, parsed.origin).toString();
        } catch {
          image = '';
        }
      }

      res.json({
        preview: {
          url: parsed.toString(),
          title,
          description,
          image: image || '/src/assets/images/nightfall_cover_keyart_1794592069118.jpg',
          domain: parsed.hostname,
          type: 'external',
          metaLine: `External Web Link · ${parsed.hostname}`,
        },
      });
    } catch {
      res.json({
        preview: {
          url: parsed.toString(),
          title: parsed.hostname,
          description: 'External link verified. Metadata preview unavailable because the remote host declined automated inspection.',
          image: '/src/assets/images/nightfall_cover_keyart_1794592069118.jpg',
          domain: parsed.hostname,
          type: 'external',
          metaLine: `External Link · ${parsed.hostname}`,
        },
      });
    }
  });

  // Dynamic OpenGraph share page for external link crawlers & direct visits
  app.get('/share', (req, res, next) => {
    const ua = String(req.headers['user-agent'] || '').toLowerCase();
    const isBot = /bot|crawler|spider|slack|discord|twitter|facebook|whatsapp|telegram|preview/i.test(ua);
    if (!isBot) {
      next();
      return;
    }
    const url = new URL(`${req.protocol}://${req.get('host')}${req.originalUrl}`);
    const preview = buildInternalPreview(url);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${preview.title}</title>
  <meta name="description" content="${preview.description}" />
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${preview.title}" />
  <meta property="og:description" content="${preview.description}" />
  <meta property="og:image" content="${preview.image}" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${preview.title}" />
  <meta name="twitter:description" content="${preview.description}" />
</head>
<body>
  <h1>${preview.title}</h1>
  <p>${preview.description}</p>
</body>
</html>`);
  });

  if (!IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NIGHTFALL: MONSTER HUNTERS server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
