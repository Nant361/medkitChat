require('dotenv').config();

const { seedIfNeeded } = require('../server/db');
const { createApp } = require('../server/app');

let cachedApp;
let seeded = false;

function getApp() {
  if (!cachedApp) {
    cachedApp = createApp();
  }
  return cachedApp;
}

function normalizeRequestUrl(req) {
  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const rewrittenPath = parsedUrl.searchParams.get('path');

  if (rewrittenPath) {
    parsedUrl.searchParams.delete('path');
    const cleanPath = rewrittenPath.replace(/^\/+/, '');
    const search = parsedUrl.searchParams.toString();
    req.url = `/api/${cleanPath}${search ? `?${search}` : ''}`;
    return;
  }

  if (!req.url.startsWith('/api')) {
    req.url = `/api${req.url === '/' ? '' : req.url}`;
  }
}

module.exports = async (req, res) => {
  if (!seeded) {
    try {
      await seedIfNeeded();
    } catch (error) {
      console.error('Seed failed:', error.message);
    }
    seeded = true;
  }

  normalizeRequestUrl(req);

  return getApp()(req, res);
};
