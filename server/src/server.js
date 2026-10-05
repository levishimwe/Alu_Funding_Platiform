const app = require('./app');
const env = require('./config/env');
const { startWorkers } = require('./workers/jobs');

app.listen(env.port, async () => {
  console.log(`ALU Ventures API listening on http://localhost:${env.port}`);
  try {
    await startWorkers();
  } catch (err) {
    console.error('[worker] failed to start:', err.message);
  }
});
