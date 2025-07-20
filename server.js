// const makeWaSocket = require('baileys').default
// const { makeBusinessSocket } = require('@whiskeysockets/baileys').default;
// const { delay, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } = require('baileys')

const Boom = require('@hapi/boom');

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

/////INICIO DIALOGFLOW
const sessionClient = new dialogflow.SessionsClient({ keyFilename: "baileys_bot.json" });
async function detectIntent(projectId, sessionId, query, contexts, languageCode) {
   const sessionPath = sessionClient.projectAgentSessionPath(projectId, sessionId);

   // The text query request.
   const request = {
      session: sessionPath,
      queryInput: {
         text: {
            text: query,
            languageCode: languageCode,
         },
      },
   };

   if (contexts && contexts.length > 0) {
      request.queryParams = {
         contexts: contexts,
      };
   }

   const responses = await sessionClient.detectIntent(request);
   return responses[0];
}

async function executeQueries(projectId, sessionId, queries, languageCode) {
   let context;
   let intentResponse;
   for (const query of queries) {
      try {
         console.log(`Pergunta: ${query}`);
         intentResponse = await detectIntent(
            projectId,
            sessionId,
            query,
            context,
            languageCode
         );
         console.log('Enviando Resposta');
         console.log(intentResponse.queryResult.fulfillmentText);
         return `${intentResponse.queryResult.fulfillmentText}`
      } catch (error) {
         console.log(error);
      }
   }
} ////FIM DIALOGFLOW

const Update = (sock) => {
   sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
         console.log('CHATBOT - Qrcode:');
         qrcode.generate(qr, { small: true });
      }

      if (connection === 'close') {
         const statusCode = lastDisconnect?.error?.output?.statusCode;
         const Reconnect = statusCode !== DisconnectReason.loggedOut;

         console.log(`CHATBOT - CONEXÃO FECHADA! RAZÃO: ${statusCode}`);

         if (Reconnect) {
            console.log('Tentando reconectar...');
            Connection();
         } else {
            console.log('Deslogado permanentemente. Limpando sessão...');
            fs.rmSync(SESSION_PATH, { recursive: true, force: true });
         }
      }

      if (connection === 'open') {
         console.log('CHATBOT - CONECTADO');
      }
   });
};

const Connection = async () => {
   const { version } = await fetchLatestBaileysVersion();

   if (!existsSync(Path)) {
      mkdirSync(Path, { recursive: true });
   }

   const { state, saveCreds } = await useMultiFileAuthState(Path);

   const config = {
      auth: state,
      logger: P({ level: 'error' }),
      printQRInTerminal: true,
      version,
      connectTimeoutMs: 60_000,
      async getMessage(key) {
         return { conversation: 'Chatbot' };
      },
   };

   const sock = makeWaSocket(config, { auth: state });

   Update(sock.ev);

   sock.ev.on('creds.update', saveCreds);

   const SendMessage = async (jid, msg) => {
      await sock.presenceSubscribe(jid)
      await delay(1500)
      await sock.sendPresenceUpdate('composing', jid)
      await delay(1000)
      await sock.sendPresenceUpdate('paused', jid)
      return await sock.sendMessage(jid, msg)
   };



   ////SAUDAÇÃO
   let date = new Date();
   let data = date.toLocaleString('pt-BR', { timeZone: "America/Sao_Paulo", hour: 'numeric', hour12: false });

   function welcome() {
      const hora = new Date().getHours();

      if (hora >= 5 && hora < 12) {
         return 'Bom dia!';
      } else if (hora >= 12 && hora < 18) {
         return 'Boa tarde!';
      } else {
         return 'Boa noite!';
      }
   }



   /////////////////////INICIO DAS FUNÇÕES/////////////////////

   sock.ev.on('messages.upsert', async ({ messages, type }) => {
      const msg = messages[0]
      const jid = msg.key.remoteJid
      const nomeUsuario = msg.pushName
      const saudacao = welcome();
      if ((jid) && !msg.key.fromMe && jid !== 'status@broadcast') {
         const messageTypes = Object.keys(msg.message);
         const messageType = messageTypes.find((t) => ['conversation', 'stickerMessage', 'videoMessage', 'imageMessage', 'documentMessage', 'locationMessage', 'extendedTextMessage', 'audioMessage'].includes(t));

         let textResponse = "oie tudo bom?";

         // if (messageType === "extendedTextMessage") {
         //    textResponse = await executeQueries("baileysagente-kjxn", jid, [JSON.stringify(msg.message.extendedTextMessage.text)], 'pt-BR');

         // } else if (messageType === "conversation") {
         //    textResponse = await executeQueries("baileysagente-kjxn", jid, [JSON.stringify(msg.message.conversation)], 'pt-BR');

         // }


         if (textResponse) {

            console.log("Mensagem recebida de : ", `${jid} :: ${msg}`);

            
            // await SendMessage(jid, { text: textResponse });


            // await SendMessage(jid, {
            //    text: `Olá *${nomeUsuario}* ${saudacao} \n Essa é uma mensagem de texto comum\n\n ` +
            //       "1 - CONTINUAR \n" +
            //       "2 - SAIR"
            // })
            // return;
         }


      }

   });

};

// Connection()



// const fs = require('fs');
// const qrcode = require('qrcode-terminal');
const makeWaSocket = require('@whiskeysockets/baileys').default
const { DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');

// Caminho onde as credenciais serão armazenadas
const SESSION_PATH = './Sessions/user1'; // pode ser dinâmico para múltiplas sessões

// Função para iniciar conexão
async function Connection() {
   const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);

   const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: P({ level: 'silent' })
   });

   // Atualiza credenciais após qualquer mudança
   sock.ev.on('creds.update', saveCreds);

   // Atualiza conexão (sua função atualizada aqui)
   Update(sock);
}


module.exports = { Connection };

Connection();

server.listen(port, function () {
   console.log('CHATBOT - Servidor rodando na porta: ' + port);

});