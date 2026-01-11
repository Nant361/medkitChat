require('dotenv').config();

const { seedIfNeeded } = require('./db');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3001;
const app = createApp();

async function startServer() {
  try {
    await seedIfNeeded();
  } catch (error) {
    console.error('Startup failed:', error.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
