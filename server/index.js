const express = require('express');
const cors = require('cors');
const uploadRouter = require('./routes/upload');

const app = express();
// Render (and many PaaS providers) inject a PORT environment variable that the
// server must bind to. Default to 4000 for local development.
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', uploadRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
app.get('/status', (req, res) => {
  res.json({ status: 'ok' });
});
app.get('/', (req, res) => {
  res.send('Insight Ads AI API is running');
});
