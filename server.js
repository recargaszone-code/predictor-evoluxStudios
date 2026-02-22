// server.js
import express from 'express';
import cors from 'cors';
import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ====================== ARMAZENAMENTO ======================
const history = {
  placard: [],
  bet888:  [],
  betway:  []
};

const lastUpdate = {
  placard: null,
  bet888:  null,
  betway:  null
};

// ====================== WEBSOCKET PURO ======================
const WS_URL = "wss://predictor-uqfp.onrender.com/socket.io/?EIO=3&transport=websocket";

let ws = null;

function connectWebSocket() {
  console.log(`[WS] Tentando conectar → ${WS_URL}`);

  ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('[WS] ✅ Conexão aberta!');
    ws.send('2probe');                    // Engine.IO probe
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send('5'); // upgrade
    }, 100);
  });

  ws.on('message', (data) => {
    const msg = data.toString();

    // Handshake básico
    if (msg.startsWith('0{')) { console.log('[WS] Handshake recebido'); return; }
    if (msg === '40') { console.log('[WS] Namespace aberto'); return; }
    if (msg === '3probe') { ws.send('5'); return; }

    // Mensagens do tipo 42["casa", [números...]]
    if (msg.startsWith('42')) {
      try {
        const parsed = JSON.parse(msg.slice(2));
        if (Array.isArray(parsed) && parsed.length === 2) {
          const [house, numbers] = parsed;
          if (['placard', 'bet888', 'betway'].includes(house)) {
            const currentLast = numbers[numbers.length - 1];

            if (lastUpdate[house] !== currentLast) {
              history[house] = numbers.slice(0, 120);
              lastUpdate[house] = currentLast;

              console.log(`[${house.toUpperCase()}] ✅ Atualizado | Último: ${currentLast.toFixed(2)}x`);
            }
          }
        }
      } catch (e) {
        // ignora mensagens que não são JSON
      }
    }
  });

  ws.on('close', () => {
    console.log('[WS] Conexão fechada. Reconectando em 3s...');
    setTimeout(connectWebSocket, 3000);
  });

  ws.on('error', (err) => {
    console.error('[WS] Erro:', err.message);
  });
}

// ====================== API ======================
app.get('/api/history/:house', (req, res) => {
  const house = req.params.house.toLowerCase();
  if (!['placard', 'bet888', 'betway'].includes(house)) {
    return res.status(400).json({ error: 'Use: placard, bet888 ou betway' });
  }

  const data = history[house] || [];
  const unique = data.slice(0, 60);

  res.json({
    house,
    total: unique.length,
    last: unique.length ? unique[unique.length - 1] : null,
    history: unique
  });
});

app.get('/api/history', (req, res) => {
  const result = {};
  for (const h of ['placard', 'bet888', 'betway']) {
    const data = history[h] || [];
    const unique = data.slice(0, 60);
    result[h] = { total: unique.length, last: unique.length ? unique[unique.length-1] : null, history: unique };
  }
  res.json(result);
});

app.get('/api/status', (req, res) => {
  res.json({
    ws_connected: ws && ws.readyState === WebSocket.OPEN,
    last_updates: lastUpdate,
    timestamp: new Date().toISOString()
  });
});

// ====================== START ======================
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  connectWebSocket();   // inicia conexão com o predictor
});
