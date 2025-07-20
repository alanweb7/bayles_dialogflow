import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeInMemoryStore
} from '@whiskeysockets/baileys';

import P from 'pino';
import { Boom } from '@hapi/boom';

const fs = require('fs');

async function startSock(sessionId = 'default') {
  const sessionPath = `./Sessions/${sessionId}`;

  // Cria a pasta da sessão, se não existir
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: P({ level: 'silent' }),
  });

  // ✅ Garante que toda atualização de credenciais será salva
  sock.ev.on('creds.update', saveCreds);

  // ✅ Reage a desconexão
  import { ConnectionState } from '@whiskeysockets/baileys';
  sock.ev.on('connection.update', (update: Partial<ConnectionState>) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;

      if (reason === DisconnectReason.loggedOut) {
        console.log('🔴 Sessão desconectada. QR necessário novamente.');
        startSock(sessionId); // Recomeça
      } else {
        console.log('⚠️ Desconectado. Reconectando...');
        startSock(sessionId); // Reconnect
      }
    } else if (connection === 'open') {
      console.log('✅ Conectado com sucesso à sessão:', sessionId);
    }
  });

  // Exemplo de envio
  async function sendMessage(jid: string, message: string) {
    try {
      const result = await sock.sendMessage(jid, { text: message });

      // ✅ Salva após enviar a mensagem
      await saveCreds();

      console.log('Mensagem enviada com sucesso:', result);
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  }

  return { sock, sendMessage };
}

startSock('user1');
