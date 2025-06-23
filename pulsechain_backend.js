const express = require('express');
const app = express();
const PORT = 3000;

// Confirm the server is actually running this version
console.log("✅ THIS IS THE CORRECT VERSION OF THE BACKEND");

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.url}`);
  next();
});

// Add the test route
app.get('/ping', (req, res) => {
  console.log("✅ /ping was hit");
  res.send("pong");
});



app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at http://0.0.0.0:${PORT}`);
});
