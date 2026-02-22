// server.js
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io-client';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Armazenamento em memória (atualiza em tempo real)
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

// Conexão com o WebSocket do predictor
const wsUrl = "wss://predictor-uqfp.onrender.com/socket.io/?EIO=3&transport=websocket";

console.log(`[START] Conectando ao WebSocket: ${wsUrl}`);

const socket = new Server(wsUrl, {
  transports: ['websocket'],
  reconnection: true,
  reconnectionAttempts: 999,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 5000,
  randomizationFactor: 0.5
});

socket.on('connect', () => {
  console.log('[WS] Conectado ao predictor!');
});

socket.on('connect_error', (err) => {
  console.error('[WS] Erro de conexão:', err.message);
});

socket.on('disconnect', (reason) => {
  console.log('[WS] Desconectado:', reason);
});

// Recebe mensagens do socket.io
socket.onAny((event, ...args) => {
  // O predictor envia eventos como "placard", "bet888", "betway"
  if (['placard', 'bet888', 'betway'].includes(event) && Array.isArray(args[0])) {
    const house = event;
    const numbers = args[0];

    // Só atualiza se tiver mudança real (compara último valor)
    const currentLast = numbers[numbers.length - 1];
    if (lastUpdate[house] !== currentLast) {
      history[house] = numbers.slice(0, 120); // mantém até 120 (duplicado)
      lastUpdate[house] = currentLast;

      console.log(`[${house.toUpperCase()}] Atualizado - último: ${currentLast.toFixed(2)}x - total: ${numbers.length}`);
    }
  }
});

// Rotas da API
app.get('/api/history/:house', (req, res) => {
  const house = req.params.house.toLowerCase();
  
  if (!['placard', 'bet888', 'betway'].includes(house)) {
    return res.status(400).json({ error: 'Casa inválida. Use: placard, bet888 ou betway' });
  }

  const data = history[house] || [];
  const unique = data.slice(0, 60); // remove duplicata se existir

  res.json({
    house,
    total: unique.length,
    last: unique.length > 0 ? unique[unique.length - 1] : null,
    history: unique
  });
});

app.get('/api/history', (req, res) => {
  const result = {};
  for (const house of ['placard', 'bet888', 'betway']) {
    const data = history[house] || [];
    const unique = data.slice(0, 60);
    result[house] = {
      total: unique.length,
      last: unique.length > 0 ? unique[unique.length - 1] : null,
      history: unique
    };
  }
  res.json(result);
});

app.get('/api/status', (req, res) => {
  res.json({
    connected: socket.connected,
    last_updates: lastUpdate,
    timestamp: new Date().toISOString()
  });
});

// Inicia servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});