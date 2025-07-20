// CONTRIBUA COM O CONHECIMENTO...
// CONSIDERE FAZER UMA COLABORAÇÃO VIA PIX.
// CHAVE PIX - 85985282207
const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  isJidBroadcast,
  makeCacheableSignalKeyStore,
  isJidStatusBroadcast,
  isJidNewsletter,
} = require("baileys");

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




async function connect() {
  const baileysFolder = path.resolve(
    __dirname,
    "..",
    "assets",
    "auth",
    "baileys"
  );

  const { state, saveCreds } = await useMultiFileAuthState(baileysFolder);

  const { version } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    version,
    logger,
    defaultQueryTimeoutMs: undefined,
    retryRequestDelayMs: 5000,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    shouldIgnoreJid: (jid) =>
      isJidBroadcast(jid) || isJidStatusBroadcast(jid) || isJidNewsletter(jid),
    keepAliveIntervalMs: 30_000,
    maxMsgRetryCount: 5,
    markOnlineOnConnect: true,
    syncFullHistory: false,
    msgRetryCounterCache,
    shouldSyncHistoryMessage: () => false,
  });

  if (!socket.authState.creds.registered) {
    warningLog("Credenciais ainda não configuradas!");

    infoLog('Informe o número de telefone do bot (exemplo: "5511920202020"):');

    const phoneNumber = await question("Informe o número de telefone do bot: ");

    if (!phoneNumber) {
      errorLog(
        'Número de telefone inválido! Tente novamente com o comando "npm start".'
      );

      process.exit(1);
    }

    const code = await socket.requestPairingCode(onlyNumbers(phoneNumber));

    sayLog(`Código de pareamento: ${code}`);
  }

  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "close") {
      const error = lastDisconnect?.error;
      const statusCode = error?.output?.statusCode;

      if (
        error?.message?.includes("Bad MAC") ||
        error?.toString()?.includes("Bad MAC")
      ) {
        errorLog("Bad MAC error na desconexão detectado");

        if (badMacHandler.handleError(error, "connection.update")) {
          if (badMacHandler.hasReachedLimit()) {
            warningLog(
              "Limite de erros Bad MAC atingido. Limpando arquivos de sessão problemáticos..."
            );
            badMacHandler.clearProblematicSessionFiles();
            badMacHandler.resetErrorCount();

            const newSocket = await connect();
            load(newSocket);
            return;
          }
        }
      }

      if (statusCode === DisconnectReason.loggedOut) {
        errorLog("Bot desconectado!");
        badMacErrorCount = 0;
      } else {
        switch (statusCode) {
          case DisconnectReason.badSession:
            warningLog("Sessão inválida!");

            const sessionError = new Error("Bad session detected");
            if (badMacHandler.handleError(sessionError, "badSession")) {
              if (badMacHandler.hasReachedLimit()) {
                warningLog(
                  "Limite de erros de sessão atingido. Limpando arquivos de sessão..."
                );
                badMacHandler.clearProblematicSessionFiles();
                badMacHandler.resetErrorCount();
              }
            }
            break;
          case DisconnectReason.connectionClosed:
            warningLog("Conexão fechada!");
            break;
          case DisconnectReason.connectionLost:
            warningLog("Conexão perdida!");
            break;
          case DisconnectReason.connectionReplaced:
            warningLog("Conexão substituída!");
            break;
          case DisconnectReason.multideviceMismatch:
            warningLog("Dispositivo incompatível!");
            break;
          case DisconnectReason.forbidden:
            warningLog("Conexão proibida!");
            break;
          case DisconnectReason.restartRequired:
            infoLog('Me reinicie por favor! Digite "npm start".');
            break;
          case DisconnectReason.unavailableService:
            warningLog("Serviço indisponível!");
            break;
        }

        const newSocket = await connect();
        load(newSocket);
      }
    } else if (connection === "open") {
      successLog("Fui conectado com sucesso!");
      badMacErrorCount = 0;
      badMacHandler.resetErrorCount();
    } else {
      infoLog("Atualizando conexão...");
    }
  });

  socket.ev.on("creds.update", saveCreds);

  return socket;
}




const Update = (sock) => {
   sock.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
         console.log('CHATBOT - Qrcode: ');
         qrcode.generate(qr, { small: true });
      };
      if (connection === 'close') {
         const Reconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut
         if (Reconnect) Connection()
         console.log(`CHATBOT - CONEXÃO FECHADA! RAZÃO: ` + DisconnectReason.loggedOut.toString());
         if (Reconnect === false) {
            fs.rmSync(Path, { recursive: true, force: true });
            // const removeAuth = Path
            // unlink(removeAuth, err => {
            //    if (err) throw err
            // })
         }
      }
      if (connection === 'open') {
         console.log('CHATBOT - CONECTADO')
      }
   })
}

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

         await SendMessage(jid, { text: textResponse });


         await SendMessage(jid, {
            text: `Olá *${nomeUsuario}* ${saudacao} \n Essa é uma mensagem de texto comum\n\n ` +
               "1 - CONTINUAR \n" +
               "2 - SAIR"
         })


         //--------------------

         // MENSAGEM DE BOAS VINDAS (TEXO COM IMAGEM)
         if (textResponse === 'Iniciando seu atendimento...') {
            await SendMessage(jid, {
               image: {
                  url: './image/robert.jpg'
               },
               caption: `Olá ${nomeUsuario}, ${saudacao} \nSeja muito bem-vindo ao assistente virtual do *Canal eConhecimento*.\n\n` +
                  "Digite o *número* referente a opção desejada:\n\n" +
                  "*1* - Suporte\n" +
                  "*2* - Financeiro\n" +
                  "*3* - Cursos Online\n" +
                  "*4* - Perguntas frequentes\n" +
                  "*5* - Redes sociais\n" +
                  "*6* - Parceria",
               mimeType: 'image.jpg'

            })

               .then(result => console.log('RESULT: ', result))
               .catch(err => console.log('ERROR: ', err))

         }


         //--------------------

         // MENSAGEM DE TEXO COMUM
         if (textResponse === 'Enviando texto comum...') {
            await SendMessage(jid, {
               text: `Olá *${nomeUsuario}* ${saudacao} \n Essa é uma mensagem de texto comum\n\n ` +
                  "1 - CONTINUAR \n" +
                  "2 - SAIR"
            })

               .then(result => console.log('RESULT: ', result))
               .catch(err => console.log('ERROR: ', err))

         }

         //--------------------

         // MENSAGEM COM ÁUDIO
         if (textResponse === 'Envio de áudio...') {
            await SendMessage(jid, {
               audio: {
                  url: './image/teste.ogg'
               },
               caption: 'Descrição do áudio',
               mimetype: 'audio/ogg'

            });
            await SendMessage(jid, {
               text: `Olá *${nomeUsuario}* \n Essa é uma mensagem de áudio\n\n ` +
                  "1 - CONTINUAR \n" +
                  "2 - SAIR"

            })

               .then(result => console.log('RESULT: ', result))
               .catch(err => console.log('ERROR: ', err))

         }

         //--------------------

         // MENSAGEM COM VÍDEO
         if (textResponse === 'Envio de vídeo...') {
            await SendMessage(jid, {
               video: {
                  url: './image/video.mp4'
               },
               caption: 'Esse é um exemplo de vídeo',
               gifPlayback: true

            });
            await SendMessage(jid, {
               text: `Olá *${nomeUsuario}* \n Essa é uma mensagem de vídeo\n\n ` +
                  "1 - CONTINUAR \n" +
                  "2 - SAIR"

            })

               .then(result => console.log('RESULT: ', result))
               .catch(err => console.log('ERROR: ', err))

         }

         //--------------------

         // MENSAGEM COM DOCUMENTO PDF
         if (textResponse === 'Aqui está um PDF 👇🏼😉') {
            await SendMessage(jid, {
               document: {
                  url: './image/Divulg-pro.pdf'
               },
               fileName: '/Divulg-pro.pdf',
               caption:
                  "Tabela de valores",
               mimetype: 'application/PDF'

            })

            await SendMessage(jid, {
               text: //`Olá *${nomeUsuario}* \nEssa é uma mensagem de vídeo\n\n`+
                  //"1 - CONTINUAR\n" +
                  "*0* - Voltar ao menu"

            })

               .then(result => console.log('RESULT: ', result))
               .catch(err => console.log('ERROR: ', err))

         }

         //--------------------

         // MENSAGEM DE LOCALIZAÇÃO
         if (textResponse === 'Enviando Localização, Aguarde!...') {
            await SendMessage(jid, { location: { degreesLatitude: -2.917264183502438, degreesLongitude: -41.75231474744193 } }
            )

               .then(result => console.log('RESULT: ', result))
               .catch(err => console.log('ERROR: ', err))

         }

         //--------------------

         // MENSAGEM DE CONTATO
         if (textResponse === 'Aqui está o contato do Marcos Monteiro 👇🏼😉') {
            const vcard = 'BEGIN:VCARD\n' // metadata of the contact card
               + 'VERSION:3.0\n'
               + 'FN:Marcos Monteiro\n' // full name
               + 'ORG:Marcos Monteiro;\n' // the organization of the contact
               + 'TEL;type=CELL;type=VOICE;waid=5585985282207:+55 85 98528 2207\n' // WhatsApp ID + phone number
               + 'END:VCARD';

            await SendMessage(jid, {
               contacts: {
                  displayName: 'Marcos Monteiro',
                  contacts: [{ vcard }]

               }

            });

            await SendMessage(jid, {
               text: '*0* - Voltar ao menu'

            })

               .then(result => console.log('RESULT: ', result))
               .catch(err => console.log('ERROR: ', err));

         }


      }

   });

};

Connection()

server.listen(port, function () {
   console.log('CHATBOT - Servidor rodando na porta: ' + port);

});