const fs = require('fs');
const { makeWASocket, Browsers, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay } = require('@whiskeysockets/baileys');
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
let socksaveCreds = null;

const Connection = async () => {
   const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
   const { version } = await fetchLatestBaileysVersion();

   const WASocketConfig = {
      version,
      auth: state
   };

   const sock = makeWASocket(WASocketConfig);

   sockInstance = sock;
   socksaveCreds = saveCreds;

   // Atualiza credenciais
   sock.ev.on('creds.update', saveCreds);

   // Lida com atualização de conexão
   Update(sock);

   // Escuta mensagens
   sock.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      const jid = msg.key.remoteJid;

      if (!msg.key.fromMe && jid !== 'status@broadcast') {
         const messageTypes = Object.keys(msg.message);
         const messageType = messageTypes.find((t) => ['conversation', 'stickerMessage', 'videoMessage', 'imageMessage', 'documentMessage', 'locationMessage', 'extendedTextMessage', 'audioMessage'].includes(t));

         const nome = msg.pushName || "Usuário";

         console.log(`📩 Mensagem de ${nome} (${jid})`);



         let textResponse = "";

         if (messageType === "extendedTextMessage") {
            textResponse = msg.message.extendedTextMessage.text;

         } else if (messageType === "conversation") {
            textResponse = msg.message.conversation;
         }


         let msgTxt = await sortearFrases(textResponse);

         console.log(`Comando: ${textResponse}`);
         console.log(`Texto: ${msgTxt}`);

         await SendMessage(jid, { text: `${msgTxt}` });
      }
   });
};


const SendMessage = async (jid, msg) => {
   if (!sockInstance) {
      console.log("⚠️ Nenhuma instância ativa.");
      return;
   }

   try {
      await sockInstance.presenceSubscribe(jid);
      let delayFrase = await calcularDelayPorFrase(msg.text);
      console.log("Delay frase: ", delayFrase);
      let SetWait = await getNumber(3000, 5000);
      await delay(SetWait);
      let repDelay = await getNumber(1, 3);
      for (let index = 0; index < repDelay; index++) {
         await sockInstance.sendPresenceUpdate('composing', jid);
         await delay(Math.floor(delayFrase / repDelay));
         await sockInstance.sendPresenceUpdate('paused', jid);
         if (repDelay > 1) {
            SetWait = await getNumber(2000, 3000);
            await delay(SetWait);
         }
      }

      return await sockInstance.sendMessage(jid, msg);
   } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
   }
};


function sortearFrases(comando) {
   const frases = {
      '/menu': [
         '📋 Aqui está o nosso menu completo!',
         '🛒 Escolha uma das opções abaixo:',
         '📦 Produtos disponíveis no momento:',
         '🔍 Confira nossos serviços:',
         '👉 Clique em uma das opções do menu:',
         '📱 Você pode navegar pelo menu abaixo:',
         '🎯 Precisa de ajuda? Use o menu!',
         '📌 Menu principal disponível!',
         '🧭 Este é o caminho: menu abaixo!',
         '📨 Menu enviado com sucesso!'
      ],
      '\/saudação': [
         '🌞 Bom dia! Como posso te ajudar?',
         '🌅 Boa tarde! Tudo bem por aí?',
         '🌙 Boa noite! Em que posso ser útil?',
         '👋 Olá! Seja muito bem-vindo!',
         '💬 Oi! Estou por aqui se precisar!',
         '🤖 Olá! Posso ajudar com algo?',
         '🙌 Que bom ter você aqui!',
         '✅ Como posso te ajudar hoje?',
         '✋ E aí! Tudo tranquilo?',
         '💡 Pronto para começar?'
      ],
      '\/oi': [
         'Oi oi! 😄',
         'E aí! 👋',
         'Olá, tudo certo? 😎',
         'Oi! Precisa de alguma informação?',
         'Fala comigo! 🤖',
         'Olá! Como posso ajudar?',
         'Oi! Estou à disposição.',
         'Alô! 📞',
         'Chegou quem faltava! 👏',
         'Olá, seja bem-vindo! 💬'
      ]
   };

   if (!frases[comando]) {
      return [`❌ Comando não reconhecido: ${comando}`];
   }


   const frasesDoComando = frases[comando];

   // Sorteia 1 frases aleatórias (sem repetir)
   const sorteadas = frasesDoComando
      .sort(() => 0.5 - Math.random())
      .slice(0, 1);

   return sorteadas;

}

function getNumber(min, max) {
   min = Math.ceil(min);
   max = Math.floor(max);
   return Math.floor(Math.random() * (max - min + 1)) + min;
}

function calcularDelayPorFrase(frase) {
   const tempoPorCaractere = 460; // em milissegundos (0.46s arredondado)
   return frase.length * tempoPorCaractere;
}

module.exports = { Connection, SendMessage };
