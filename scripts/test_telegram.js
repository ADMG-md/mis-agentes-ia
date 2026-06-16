const token = '8793342822:AAEns2Tv3KJLHfun-y3Pi_K4q9U_xAW2dhg';
const url = `https://api.telegram.org/bot${token}/getUpdates`;

console.log('Esperando a que inicies el bot en Telegram...');
console.log('Abre tu bot en Telegram, presiona "Iniciar" y envíale un mensaje.');

fetch(url)
.then(res => res.json())
.then(data => {
  const results = data.result;
  if (!results || results.length === 0) {
    console.log('\n[!] No se encontraron mensajes. Asegúrate de haber presionado "Iniciar" y haberle escrito algo al bot.');
    return;
  }

  // Obtener el último mensaje recibido
  const lastMessage = results[results.length - 1].message;
  const chatId = lastMessage.chat.id;
  const username = lastMessage.from.first_name || lastMessage.from.username;

  console.log(`\n¡Mensaje detectado con éxito!`);
  console.log(`Usuario: ${username}`);
  console.log(`Chat ID: ${chatId}`);
  console.log('Enviando mensaje de prueba...');

  // Enviar mensaje de respuesta
  const sendUrl = `https://api.telegram.org/bot${token}/sendMessage`;
  const text = `🚨 <b>ALERTA DE PRUEBA DESDE LA VPS</b>\n\nHola ${username}, ¡tu bot de Telegram está oficialmente conectado y funcionando con éxito! 🚀`;

  return fetch(sendUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    })
  });
})
.then(res => {
  if (res) return res.json();
})
.then(sendData => {
  if (sendData && sendData.ok) {
    console.log('¡Mensaje enviado exitosamente a tu Telegram!');
  }
})
.catch(err => {
  console.error('Error durante la verificación:', err.message);
});
