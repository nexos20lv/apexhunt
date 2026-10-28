import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { RoomManager } from './game/RoomManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

await fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
});

await fastify.register(websocket);

// Enregistrement des fichiers statiques du frontend Vite (pour déploiement Pterodactyl tout-en-un)
const staticDirs = [
  path.join(process.cwd(), 'public'),
  path.join(process.cwd(), 'client', 'dist'),
  path.join(__dirname, '..', '..', 'client', 'dist'),
  path.join(__dirname, 'public'),
];

const clientDistPath = staticDirs.find((dir) => fs.existsSync(dir));

if (clientDistPath) {
  await fastify.register(fastifyStatic, {
    root: clientDistPath,
    prefix: '/',
  });
  console.log(`📦 Fichiers frontend statiques servis depuis : ${clientDistPath}`);

  fastify.setNotFoundHandler((req, reply) => {
    if (req.raw.url && req.raw.url.startsWith('/api')) {
      reply.status(404).send({ error: 'Endpoint introuvable', code: 'NOT_FOUND' });
    } else {
      reply.sendFile('index.html');
    }
  });
}

const roomManager = new RoomManager();

// Health Check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: Date.now() };
});

// Créer une nouvelle room
fastify.post('/api/rooms', async (req, reply) => {
  const room = roomManager.createRoom();
  return reply.status(201).send({
    code: room.code,
    settings: room.settings,
  });
});

// Vérifier l'existence d'une room
fastify.get<{ Params: { code: string } }>('/api/rooms/:code', async (req, reply) => {
  const room = roomManager.getRoom(req.params.code);
  if (!room) {
    return reply.status(404).send({ error: 'Partie non trouvée', code: 'ROOM_NOT_FOUND' });
  }
  return {
    code: room.code,
    state: room.state,
    playersCount: room.getPlayers().length,
  };
});

// Passerelle WebSocket temps réel
fastify.register(async function (fastify) {
  fastify.get('/ws', { websocket: true }, (socket, req) => {
    // Génère un ID de joueur éphémère ou utilise celui passé en paramètre d'URL
    const url = new URL(req.url, 'http://localhost');
    const playerId = url.searchParams.get('playerId') || `p_${Math.random().toString(36).substring(2, 9)}`;

    roomManager.registerClient(socket, playerId);

    socket.on('message', (message) => {
      roomManager.handleMessage(socket, message);
    });

    socket.on('close', () => {
      roomManager.unregisterClient(socket);
    });

    socket.on('error', (err) => {
      fastify.log.error(err, 'Erreur WebSocket');
    });
  });
});

const PORT = Number(process.env.PORT) || Number(process.env.SERVER_PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

try {
  await fastify.listen({ port: PORT, host: HOST });
  console.log(`📡 ApexHunt Game Server écoute sur http://${HOST}:${PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
