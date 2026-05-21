// server.js — Servidor HTTP + WebSocket para o Dashboard Matrix
const http = require('http');
const WebSocket = require('ws');

let wss;
let latestData = {};

function startServer() {
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/dashboard') {
      require('fs').readFile(__dirname + '/public/dashboard.html', (err, data) => {
        if (err) {
          res.writeHead(500);
          res.end('Erro ao carregar dashboard');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    // Sem logs para não poluir o terminal
    if (Object.keys(latestData).length > 0) {
      ws.send(JSON.stringify(latestData));
    }
  });

  const PORT = process.env.DASHBOARD_PORT || 3000;
  server.listen(PORT, () => {
    console.log(`📊 Dashboard Matrix em http://localhost:${PORT}`);
  });
}

function broadcast(data) {
  latestData = data;
  if (!wss) return;
  const msg = JSON.stringify(data);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  });
}

module.exports = { startServer, broadcast };