import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('Sessions/user1') // <- pasta com sessões

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  })

  sock.ev.on('creds.update', saveCreds) // <- SALVA sempre que as credenciais mudarem

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut
      console.log('connection closed due to', lastDisconnect.error, ', reconnecting', shouldReconnect)
      if (shouldReconnect) {
        startSock()
      }
    } else if (connection === 'open') {
      console.log('connection opened')
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    const msg = messages[0]
    if (!msg.message) return

    const from = msg.key.remoteJid
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text

    console.log(`Mensagem de ${from}: ${text}`)

    await sock.sendMessage(from, { text: 'Recebido com sucesso!' })
  })

  return sock
}

startSock()
