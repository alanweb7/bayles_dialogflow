const fs = require('fs');
const { makeWASocket, Browsers,  UserFacingSocketConfig, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const P = require('pino');
const path = require('path');

const SESSION_PATH = './Sessions/user1';

const Update = (sock) => {
   sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
         qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
         const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut);
         console.log("Conexão encerrada:", DisconnectReason[lastDisconnect?.error?.output?.statusCode] || 'Motivo desconhecido');

         if (shouldReconnect) {
            console.log("Reconectando...");
            await Connection(); // ⚠️ Chamada recursiva segura
         } else {
            console.log("Desconectado permanentemente. Limpando sessão.");
            fs.rmSync(SESSION_PATH, { recursive: true, force: true });
         }
      }

      if (connection === 'open') {
         console.log('✅ Conectado com sucesso!');
      }
   });
};

let sockInstance = null;

const SendMessage = async (jid, msg) => {
   if (!sockInstance) {
      console.log("⚠️ Nenhuma instância ativa.");
      return;
   }

   try {
      await sockInstance.presenceSubscribe(jid);
      await delay(1500);
      await sockInstance.sendPresenceUpdate('composing', jid);
      await delay(1000);
      await sockInstance.sendPresenceUpdate('paused', jid);
      return await sockInstance.sendMessage(jid, msg);
   } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
   }
};

const Connection = async () => {
   const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
   const { version } = await fetchLatestBaileysVersion();

   // const sock = makeWASocket({
   //    version,
   //    logger: P({ level: 'silent' }),
   //    auth: state,
   //    mobile: true,
   //    getMessage: async (key) => ({ conversation: "Mensagem offline" }),
   // });


   const WASocketConfig = {
      version,
      auth: state,
      browser: Browsers.macOS('Desktop'),
      syncFullHistory: true
   };

   const sock = makeWASocket(WASocketConfig);



   sockInstance = sock;

   // Atualiza credenciais
   sock.ev.on('creds.update', saveCreds);

   // Lida com atualização de conexão
   Update(sock);

   // Escuta mensagens
   sock.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      const jid = msg.key.remoteJid;

      if (!msg.key.fromMe && jid !== 'status@broadcast') {
         const nome = msg.pushName || "Usuário";

         console.log(`📩 Mensagem de ${nome} (${jid})`);

         await SendMessage(jid, { text: 'Olá, tudo bem? 🤖' });
      }
   });
};

module.exports = { Connection, SendMessage };
