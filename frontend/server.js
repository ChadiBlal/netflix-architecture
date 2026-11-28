// Serves the static frontend on port 3000 so Zuul can use port 8080.
// Run: npm init -y && npm i express && node server.js
const express = require('express');
const path = require('path');

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.static(path.join(__dirname, 'public')));
app.use('/media', express.static(process.env.MEDIA_DIR || path.join(__dirname, 'media')));

app.listen(PORT, () => console.log(`Netflix frontend on http://localhost:${PORT}`));