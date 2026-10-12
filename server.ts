import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

let j2meDir = path.join(__dirname, 'j2me');
if (!fs.existsSync(j2meDir)) {
  j2meDir = path.join(process.cwd(), 'j2me');
}

let resourcesDir = path.join(__dirname, 'resources');
if (!fs.existsSync(resourcesDir)) {
  resourcesDir = path.join(process.cwd(), 'resources');
}

const staticMiddleware = express.static(j2meDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    } else if (filePath.endsWith('.jar')) {
      res.setHeader('Content-Type', 'application/java-archive');
    } else if (filePath.endsWith('.mid') || filePath.endsWith('.midi')) {
      res.setHeader('Content-Type', 'audio/midi');
    }
  }
});

const resourcesMiddleware = express.static(resourcesDir, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.glsl') || filePath.endsWith('.vsh') || filePath.endsWith('.fsh')) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    }
  }
});

// Serve static resources from resources folder (both /resources and top-level shaders)
if (fs.existsSync(resourcesDir)) {
  app.use('/resources', resourcesMiddleware);
  app.use(resourcesMiddleware);
}

// Serve static files globally and under /j2me
app.use('/j2me', staticMiddleware);
app.use(staticMiddleware);

// Serve games.json catalog
app.get(['/games.json', '/j2me/games.json'], (_req, res) => {
  const gamesPath = fs.existsSync(path.join(j2meDir, 'games.json'))
    ? path.join(j2meDir, 'games.json')
    : path.join(process.cwd(), 'games.json');
  if (fs.existsSync(gamesPath)) {
    res.setHeader('Content-Type', 'application/json');
    res.sendFile(gamesPath);
  } else {
    res.json([]);
  }
});

// Proxy route for fetching external JARs bypassing browser CORS
app.get('/api/proxy-jar', async (req, res) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).send('Invalid url parameter');
  }

  const tryFetch = async (url: string) => {
    return await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*'
      }
    });
  };

  try {
    let upstreamRes = await tryFetch(targetUrl);

    // If 404, try case-insensitive correction on filename (e.g. Diamondrush -> DiamondRush)
    if (upstreamRes.status === 404 && targetUrl.includes('/')) {
      const lastSlash = targetUrl.lastIndexOf('/');
      const base = targetUrl.substring(0, lastSlash + 1);
      const filename = targetUrl.substring(lastSlash + 1);

      const candidates: string[] = [];
      // Replace specific known variants
      if (/diamondrush/i.test(filename)) {
        candidates.push(base + filename.replace(/diamondrush/i, 'DiamondRush'));
      }
      // Capitalize first letter of hyphen-separated words
      const titleCase = filename.replace(/\b([a-z])/g, (_, c) => c.toUpperCase());
      if (titleCase !== filename) candidates.push(base + titleCase);
      // All lowercase
      if (filename.toLowerCase() !== filename) candidates.push(base + filename.toLowerCase());

      for (const cand of candidates) {
        try {
          const fallbackRes = await tryFetch(cand);
          if (fallbackRes.ok) {
            upstreamRes = fallbackRes;
            break;
          }
        } catch (_) {}
      }
    }

    if (!upstreamRes.ok) {
      return res.status(upstreamRes.status).send(`Failed to fetch upstream: ${upstreamRes.status} ${upstreamRes.statusText}`);
    }
    const contentType = upstreamRes.headers.get('content-type') || 'application/java-archive';
    res.setHeader('Content-Type', contentType);
    const arrayBuffer = await upstreamRes.arrayBuffer();
    return res.send(Buffer.from(arrayBuffer));
  } catch (err: any) {
    console.error('Error proxying JAR:', err);
    return res.status(502).send('Error proxying JAR: ' + err.message);
  }
});

// Direct download route for the full project ZIP
app.get(['/j2me-web-loader-project.zip', '/project.zip', '/download-project', '/j2me/j2me-web-loader-project.zip'], (_req, res) => {
  const zipPath = path.join(process.cwd(), 'j2me-web-loader-project.zip');
  if (fs.existsSync(zipPath)) {
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="j2me-web-loader-project.zip"');
    res.sendFile(zipPath);
  } else {
    res.status(404).send('Project zip file not found');
  }
});

// Explicit routes for run.html
app.get(['/j2me/run', '/run', '/j2me/run.html', '/run.html'], (_req, res) => {
  res.sendFile(path.join(j2meDir, 'run.html'));
});

// Explicit routes for index.html
app.get(['/', '/index.html', '/j2me', '/j2me/', '/j2me/index.html'], (_req, res) => {
  res.sendFile(path.join(j2meDir, 'index.html'));
});

// Fallback: For missing static assets with extensions, return 404 instead of index.html
app.get('*', (req, res) => {
  const hasExtension = /\.[a-zA-Z0-9]+$/.test(req.path);
  if (hasExtension) {
    res.status(404).send('Not found');
  } else {
    res.sendFile(path.join(j2meDir, 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`J2ME Web emulator running on http://localhost:${PORT}/`);
});