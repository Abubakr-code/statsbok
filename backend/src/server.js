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
