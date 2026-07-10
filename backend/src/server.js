require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();
  const server = app.listen(PORT, () => {
    console.log(`StatBooks backend running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  });
  // Increase server timeout for AI search (default 2 min, set to 2.5 min)
  server.timeout = 150000;

  // Keep-alive: ping self every 14 minutes so Render free tier never sleeps.
  // Render spins down after 15 min of no incoming requests.
  if (process.env.NODE_ENV === 'production') {
    const selfUrl = (process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
    setInterval(async () => {
      try {
        await fetch(`${selfUrl}/api/health`);
        console.log('[keep-alive] ping ok');
      } catch (e) {
        console.warn('[keep-alive] ping failed:', e.message);
      }
    }, 14 * 60 * 1000); // every 14 minutes
  }
}

// On a small VPS, log fatal errors instead of crashing silently.
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

start();
