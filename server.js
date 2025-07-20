// CONTRIBUA COM O CONHECIMENTO...
// CONSIDERE FAZER UMA COLABORAÇÃO VIA PIX.
// CHAVE PIX - 85985282207
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');


const dialogflow = require('@google-cloud/dialogflow');
const P = require('pino')
const { unlink, existsSync, mkdirSync } = require('fs')
const express = require('express');
const { body, validationResult } = require('express-validator');
const http = require('http');
const port = process.env.PORT || 9002;
const app = express();
const server = http.createServer(app);
const Path = 'Sessions';
const request = require('request')

const qrcode = require('qrcode-terminal');

const fs = require('fs');
app.use(express.json());
app.use(express.urlencoded({
   extended: true
}));



const Boom = require('@hapi/boom');

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('Sessions/user1');

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update, qr) => {

         if (qr) {
         console.log('CHATBOT - Qrcode: ');
         qrcode.generate(qr, { small: true });
      };

    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
      const shouldReconnect = Boom.isBoom(lastDisconnect?.error)
        ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
        : true;

      console.log('connection closed due to', lastDisconnect.error, ', reconnecting', shouldReconnect);

      if (shouldReconnect) {
        startSock();
      }
    }

    if (connection === 'open') {
      console.log('connection opened');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    const msg = messages[0];
    if (!msg.message) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

    console.log(`Mensagem recebida de ${from}: ${text}`);

    await sock.sendMessage(from, { text: 'Recebido com sucesso!' });
  });

  return sock;
}

startSock();
