const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Cargar variables de entorno del archivo .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  envConfig.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      // Quitar comillas si existen
      if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

const token = process.env.TELEGRAM_BOT_TOKEN;
const authorizedChatId = process.env.TELEGRAM_CHAT_ID;

if (!token || !authorizedChatId) {
  console.error('Error: TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID no están configurados en el archivo .env');
  process.exit(1);
}

const telegramUrl = `https://api.telegram.org/bot${token}`;
let lastUpdateId = 0;

console.log('Iniciando el puente de agentes de Telegram...');
console.log(`Usuario autorizado Chat ID: ${authorizedChatId}`);

// Enviar un mensaje de inicio
sendTelegramMessage(authorizedChatId, '🤖 <b>Puente de Agentes COE Caribe iniciado en la VPS</b>\n\nEscribe /help para ver la lista de comandos disponibles.');

// Bucle de sondeo (polling) de mensajes cada 2 segundos
setInterval(pollMessages, 2000);

function pollMessages() {
  fetch(`${telegramUrl}/getUpdates?offset=${lastUpdateId + 1}&timeout=1`)
    .then(res => res.json())
    .then(data => {
      if (data.ok && data.result.length > 0) {
        data.result.forEach(update => {
          lastUpdateId = update.update_id;
          if (update.message) {
            handleMessage(update.message);
          }
        });
      }
    })
    .catch(err => console.error('Error en getUpdates:', err.message));
}

function handleMessage(message) {
  const chatId = message.chat.id.toString();
  const text = message.text;

  // 1. Validar que sea el usuario autorizado
  if (chatId !== authorizedChatId) {
    console.log(`Intento de acceso denegado del chat: ${chatId}`);
    sendTelegramMessage(chatId, '⛔ Acceso denegado. No tienes permisos para controlar este servidor.');
    return;
  }

  if (!text) return;

  console.log(`Mensaje recibido: "${text}"`);

  // Procesar comandos
  if (text.startsWith('/help') || text.startsWith('/start')) {
    const helpText = `
🧠 <b>Panel de Control de Agentes (COE Caribe)</b>

Usa los siguientes comandos para controlar la VPS:

🔸 <code>/status</code> - Estado del servidor (PM2, Docker).
🔸 <code>/ask [pregunta]</code> - Consultar a los agentes de IA (clínico y marketing).
🔸 <code>/memory [busqueda]</code> - Buscar en la memoria vectorial.
🔸 <code>/run [tarea]</code> - Ejecutar un pipeline de agentes.
🔸 <code>/leads</code> - Escanear leads y escucha social en tiempo real.
🔸 <code>/posts</code> - Ver cola de publicaciones (base de datos local).
🔸 <code>/ads</code> - Ver auditoría rápida de campañas de anuncios.
    `;
    sendTelegramMessage(chatId, helpText);
  } 
  else if (text.startsWith('/status')) {
    sendTelegramStatus(chatId);
  } 
  else if (text.startsWith('/ask ')) {
    const question = text.replace('/ask ', '');
    sendTelegramMessage(chatId, '🔍 <i>Consultando a los agentes... (Esto puede tomar unos segundos)</i>');
    executeAskQuery(chatId, question);
  } 
  else if (text.startsWith('/memory ')) {
    const query = text.replace('/memory ', '');
    searchAgentMemory(chatId, query);
  } 
  else if (text.startsWith('/run ')) {
    const task = text.replace('/run ', '');
    sendTelegramMessage(chatId, '⚙️ <i>Ejecutando pipeline del Swarm...</i>');
    executeAgentTask(chatId, task);
  }
  else if (text.startsWith('/leads')) {
    sendTelegramMessage(chatId, '🛰️ <i>Iniciando escucha de redes sociales y clasificación de leads en tiempo real...</i>');
    exec(`node ${path.join(__dirname, 'find_leads.js')}`, (error, stdout, stderr) => {
      if (error) {
        sendTelegramMessage(chatId, `❌ Error al ejecutar escucha social:\n<pre>${error.message}</pre>`);
        return;
      }
      sendTelegramMessage(chatId, '✅ <i>Proceso de escucha social finalizado. Si se encontraron leads calificados relevantes, se habrán enviado arriba.</i>');
    });
  }
  else if (text.startsWith('/posts')) {
    listPosts(chatId);
  }
  else if (text.startsWith('/ads')) {
    sendTelegramMessage(chatId, '📊 <i>Consultando estado de campañas y presupuestos de anuncios (puede tomar unos segundos)...</i>');
    executeAskQuery(chatId, 'Haz una auditoría rápida de mis campañas publicitarias activas en Meta/Google y el estado de mi presupuesto (Budget Guard), mostrando los datos en una tabla resumida o lista con KPIs básicos.');
  }
  else {
    // Respuesta por defecto si escriben algo sin comando
    sendTelegramMessage(chatId, '❓ Comando no reconocido. Escribe /help para ver las opciones.');
  }
}

function listPosts(chatId) {
  try {
    const Database = require('better-sqlite3');
    const dbPath = path.join(__dirname, '..', 'rrssagente.db');
    if (!fs.existsSync(dbPath)) {
      sendTelegramMessage(chatId, '⚠️ Base de datos <code>rrssagente.db</code> no encontrada en la raíz.');
      return;
    }
    const db = new Database(dbPath);
    const rows = db.prepare(`
      SELECT id, platforms, accountType, status, scheduledAt 
      FROM posts 
      ORDER BY 
        CASE status 
          WHEN 'scheduled' THEN 1 
          WHEN 'draft' THEN 2 
          ELSE 3 
        END,
        scheduledAt ASC 
      LIMIT 10
    `).all();
    
    if (rows.length === 0) {
      sendTelegramMessage(chatId, '📅 <b>Cola de Publicaciones:</b>\n\nNo hay publicaciones registradas en la base de datos.');
      db.close();
      return;
    }
    
    let responseText = '📅 <b>Cola de Publicaciones (Últimas 10):</b>\n\n';
    rows.forEach(row => {
      const scheduledText = row.scheduledAt ? `⏰ <code>${row.scheduledAt}</code>` : 'No programado';
      const statusEmoji = row.status === 'scheduled' ? '🟢' : row.status === 'published' ? '🔵' : '🟡';
      responseText += `${statusEmoji} <b>ID:</b> <code>${row.id}</code>\n` +
                      `  <b>Canales:</b> <code>${row.platforms}</code>\n` +
                      `  <b>Tipo:</b> <code>${row.accountType}</code>\n` +
                      `  <b>Estado:</b> <code>${row.status}</code>\n` +
                      `  <b>Fecha:</b> ${scheduledText}\n\n`;
    });
    db.close();
    sendTelegramMessage(chatId, responseText);
  } catch (err) {
    sendTelegramMessage(chatId, `❌ Error al consultar la base de datos:\n<pre>${err.message}</pre>`);
  }
}

function sendTelegramMessage(chatId, text) {
  fetch(`${telegramUrl}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    })
  }).catch(err => console.error('Error al enviar mensaje:', err.message));
}

function sendTelegramStatus(chatId) {
  // Ejecutar comando para ver estado de PM2 y Docker
  exec('pm2 list && sudo docker ps', (error, stdout, stderr) => {
    let responseText = '🖥️ <b>Estado de la VPS:</b>\n\n<pre>';
    if (stdout) {
      // Simplificar la salida para que se lea mejor en el celular
      const lines = stdout.split('\n');
      const filteredLines = lines.filter(line => 
        line.includes('online') || 
        line.includes('Up') || 
        line.includes('NAMES') || 
        line.includes('status')
      );
      responseText += filteredLines.join('\n');
    } else {
      responseText += 'No se pudo obtener el estado.';
    }
    responseText += '</pre>';
    sendTelegramMessage(chatId, responseText);
  });
}

function searchAgentMemory(chatId, query) {
  sendTelegramMessage(chatId, `🧠 <i>Buscando en la memoria vectorial: "${query}"...</i>`);
  
  exec(`npx -y @claude-flow/cli@latest memory search --query "${query}"`, (error, stdout, stderr) => {
    let responseText = `🔍 <b>Resultados de Memoria:</b>\n\n`;
    if (stdout && stdout.trim() !== '') {
      responseText += `<pre>${stdout.substring(0, 3000)}</pre>`;
    } else {
      responseText += 'No se encontraron patrones o memorias relacionadas.';
    }
    sendTelegramMessage(chatId, responseText);
  });
}

function executeAgentTask(chatId, task) {
  // Ejecutar el enrutador de agentes de Ruflo
  exec(`npx -y @claude-flow/cli@latest hooks route --task "${task}"`, (error, stdout, stderr) => {
    let responseText = `🤖 <b>Respuesta de los Agentes:</b>\n\n`;
    if (stdout) {
      responseText += stdout;
    } else if (stderr) {
      responseText += `⚠️ Ocurrió una advertencia:\n<pre>${stderr}</pre>`;
    } else {
      responseText += 'Los agentes completaron la tarea pero no devolvieron salida.';
    }
    
    // Limitar longitud para evitar errores de Telegram
    if (responseText.length > 4000) {
      responseText = responseText.substring(0, 4000) + '\n\n<i>[Salida truncada...]</i>';
    }
    
    sendTelegramMessage(chatId, responseText);
  });
}

function executeAskQuery(chatId, question) {
  // Escapar comillas dobles para evitar problemas en el comando exec
  const escapedQuestion = question.replace(/"/g, '\\"');
  
  exec(`node ${path.join(__dirname, 'ask_agent.js')} "${escapedQuestion}"`, (error, stdout, stderr) => {
    if (error) {
      console.error('Error al ejecutar ask_agent:', error);
      sendTelegramMessage(chatId, `❌ Ocurrió un error al procesar tu pregunta:\n<pre>${stderr || error.message}</pre>`);
      return;
    }
    
    if (stdout && stdout.trim() !== '') {
      sendTelegramMessage(chatId, stdout.trim());
    } else {
      sendTelegramMessage(chatId, '🤖 Los agentes no pudieron formular una respuesta.');
    }
  });
}
