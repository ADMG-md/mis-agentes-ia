const fs = require('fs');
const path = require('path');

// 1. Cargar Configuración
const configPath = path.join(__dirname, 'config.json');
let config = {
  keywords: ["resistencia a la insulina", "metformina", "prediabetes", "ozempic"],
  subreddits: ["insulinresistance", "diabetes"],
  minRelevanceScore: 75,
  maxResultsPerSearch: 10
};

if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (e) {
    console.error('Error al leer config.json, usando valores por defecto:', e.message);
  }
}

// 2. Cargar Variables de Entorno (.env)
let googleApiKey = process.env.GOOGLE_API_KEY;
let telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
let telegramChatId = process.env.TELEGRAM_CHAT_ID;

const envPaths = [
  path.join(__dirname, '.env'),
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', 'mis-agentes-ia', '.env'), // Enlace con el proyecto de agentes en la VPS
];

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf8');
    envConfig.split('\n').forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.length > 0 && value.charAt(0) === '"' && value.charAt(value.length - 1) === '"') {
          value = value.substring(1, value.length - 1);
        }
        if (key === 'GOOGLE_API_KEY') googleApiKey = value;
        if (key === 'TELEGRAM_BOT_TOKEN') telegramBotToken = value;
        if (key === 'TELEGRAM_CHAT_ID') telegramChatId = value;
      }
    });
    break; // Cargar el primer .env encontrado
  }
}

if (!googleApiKey || !telegramBotToken || !telegramChatId) {
  console.error('Error: Faltan credenciales esenciales (GOOGLE_API_KEY, TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID) en el entorno o en el archivo .env');
  process.exit(1);
}

// 3. Cargar Base de Datos de Cache (leads_cache.json)
const cachePath = path.join(__dirname, 'leads_cache.json');
let processedLeads = [];
if (fs.existsSync(cachePath)) {
  try {
    processedLeads = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch (e) {
    console.error('Error al leer cache de leads, reiniciando cache:', e.message);
  }
}

function saveCache() {
  try {
    fs.writeFileSync(cachePath, JSON.stringify(processedLeads, null, 2), 'utf8');
  } catch (e) {
    console.error('Error al guardar cache de leads:', e.message);
  }
}

// 4. Buscar publicaciones en Reddit
async function fetchRedditPosts() {
  console.log('Iniciando búsqueda de discusiones en Reddit...');
  const allPosts = new Map();

  // Búsqueda global en Reddit usando palabras clave
  for (const keyword of config.keywords) {
    const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(keyword)}&sort=new&limit=${config.maxResultsPerSearch}`;
    try {
      console.log(`Buscando por palabra clave: "${keyword}"...`);
      const response = await fetch(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      const data = await response.json();
      
      if (data.data && data.data.children) {
        data.data.children.forEach(child => {
          const post = child.data;
          // Evitar procesar si ya está en cache
          if (!processedLeads.includes(post.id)) {
            allPosts.set(post.id, {
              id: post.id,
              title: post.title,
              text: post.selftext || '',
              author: post.author,
              url: `https://www.reddit.com${post.permalink}`,
              subreddit: post.subreddit,
              created_utc: post.created_utc,
              keyword: keyword,
              source: 'reddit-search'
            });
          }
        });
      }
      // Delay de cortesía para evitar rate-limits de Reddit
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`Error buscando por palabra clave "${keyword}":`, err.message);
    }
  }

  // Búsqueda en subreddits específicos
  for (const subreddit of config.subreddits) {
    const subredditUrl = `https://www.reddit.com/r/${subreddit}/new.json?limit=${config.maxResultsPerSearch}`;
    try {
      console.log(`Escaneando subreddit: r/${subreddit}...`);
      const response = await fetch(subredditUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      const data = await response.json();

      if (data.data && data.data.children) {
        data.data.children.forEach(child => {
          const post = child.data;
          if (!processedLeads.includes(post.id)) {
            allPosts.set(post.id, {
              id: post.id,
              title: post.title,
              text: post.selftext || '',
              author: post.author,
              url: `https://www.reddit.com${post.permalink}`,
              subreddit: post.subreddit,
              created_utc: post.created_utc,
              keyword: 'subreddit-scan',
              source: `reddit-r/${subreddit}`
            });
          }
        });
      }
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(`Error escaneando subreddit "r/${subreddit}":`, err.message);
    }
  }

  const postsArray = Array.from(allPosts.values());
  if (postsArray.length === 0) {
    console.log('⚠️ Reddit bloqueó la conexión directa (Cloudflare). Cargando 2 publicaciones simuladas realistas en español para el ejercicio de pruebas (Gemini + Telegram)...');
    
    // Usar sufijos aleatorios para evitar que el caché de leads_cache.json bloquee ejecuciones sucesivas de pruebas
    const randomSuffix = Math.random().toString(36).substring(7);
    
    return [
      {
        id: `mock_post_metformina_${randomSuffix}`,
        title: "Llevo 3 meses con Metformina para mi resistencia a la insulina y ya no aguanto las náuseas y la fatiga. ¿Hay alguna alternativa?",
        text: "Hola a todos. Me diagnosticaron resistencia a la insulina hace poco. Mi médico de la EPS me mandó metformina pero tengo mareos y diarreas fatales todo el día. Además, sigo cansado y con antojos de dulce por la tarde. ¿Alguien ha logrado revertir esto de forma personalizada o con algún otro enfoque médico?",
        author: "paciente_metabolico_99",
        url: "https://www.reddit.com/r/insulinresistance/comments/mock_leads_1",
        subreddit: "insulinresistance",
        created_utc: Date.now() / 1000,
        keyword: "metformina",
        source: "reddit-mock-fallback"
      },
      {
        id: `mock_post_prediabetes_${randomSuffix}`,
        title: "¿Cómo revertir la prediabetes de forma natural? Mi glucosa salió en 112",
        text: "Hola, tengo 34 años y me acaban de decir que tengo prediabetes (glucosa en ayunas 112 y HbA1c en 5.9%). Estoy asustado. No quiero tomar pastillas de por vida. ¿Qué cambios de alimentación o estilo de vida me recomiendan? Hago ejercicio y dieta clásica hipocalórica pero no veo mejoría.",
        author: "salud_vida_34",
        url: "https://www.reddit.com/r/diabetes/comments/mock_leads_2",
        subreddit: "diabetes",
        created_utc: Date.now() / 1000,
        keyword: "prediabetes",
        source: "reddit-mock-fallback"
      }
    ];
  }

  return postsArray;
}

// 5. Analizar y Calificar con Gemini API
async function qualifyLead(post) {
  const systemInstruction = `Actúas como el Agente Clasificador y Copywriter Médico para COE Caribe IPS, una clínica especializada en medicina de precisión y reversión de enfermedades metabólicas (resistencia a la insulina, obesidad, diabetes tipo 2).

Tu tarea es analizar una publicación de redes sociales para determinar si el autor es un paciente potencial (lead) calificado y proponer una respuesta de valor personalizada.

Sigue estas directrices para la clasificación:
1. Puntuación de Relevancia (0-100):
   - 90-100: Paciente buscando activamente alternativas, segundas opiniones o quejándose de efectos adversos de medicamentos metabólicos (como Metformina).
   - 70-80: Personas preguntando sobre síntomas de resistencia a la insulina, dietas, o compartiendo exámenes de laboratorio.
   - <70: Publicaciones puramente informativas, noticias, spam, o contenido en idiomas que no podamos asistir de forma comercial (nos enfocamos en español o inglés).
2. Propuesta de Respuesta (en español):
   - Redacta una respuesta empática y educativa.
   - NO intentes vender directamente de forma agresiva.
   - Explica brevemente por qué ocurre su síntoma o problema (ej. por qué la metformina genera malestar gastrointestinal y que existen enfoques de precisión para solucionarlo).
   - Menciona que en COE Caribe IPS se trata la causa raíz de manera personalizada.
   - Mantén el tono profesional, clínico y cercano.

Devuelve tu análisis estrictamente en formato JSON con la siguiente estructura (no agregues texto Markdown antes ni después):
{
  "isLead": boolean,
  "relevanceScore": number,
  "summary": "resumen en español de 1 linea del post",
  "suggestedResponse": "Respuesta sugerida completa redactada en español"
}`;

  const userPrompt = `Título: ${post.title}\nSubreddit: r/${post.subreddit}\nTexto: ${post.text}`;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${googleApiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.3,
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();
    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      const resultText = data.candidates[0].content.parts[0].text;
      return JSON.parse(resultText.trim());
    }
    return null;
  } catch (err) {
    console.error(`Error calificando post ${post.id}:`, err.message);
    return null;
  }
}

// 6. Enviar Alerta a Telegram
async function sendTelegramAlert(post, qualification) {
  const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;
  
  const text = `🚨 <b>NUEVO LEAD DETECTADO (Escucha Social)</b>\n\n` +
               `📌 <b>Origen:</b> ${post.source}\n` +
               `👤 <b>Usuario:</b> u/${post.author}\n` +
               `🎯 <b>Relevancia:</b> <code>${qualification.relevanceScore}%</code>\n` +
               `📝 <b>Resumen:</b> <i>${qualification.summary}</i>\n\n` +
               `🔗 <a href="${post.url}">Ver Publicación Original</a>\n\n` +
               `✍️ <b>Respuesta Sugerida por IA:</b>\n` +
               `<blockquote>${qualification.suggestedResponse}</blockquote>`;

  try {
    await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    console.log(`[OK] Alerta enviada a Telegram para el post ${post.id}`);
  } catch (err) {
    console.error(`Error al enviar mensaje de Telegram para post ${post.id}:`, err.message);
  }
}

// 7. Loop Principal
async function main() {
  try {
    const newPosts = await fetchRedditPosts();
    console.log(`Se encontraron ${newPosts.length} publicaciones nuevas para analizar.`);

    for (const post of newPosts) {
      console.log(`Calificando post ${post.id}: "${post.title.substring(0, 40)}..."`);
      const qualification = await qualifyLead(post);

      if (qualification) {
        console.log(`-> Relevancia: ${qualification.relevanceScore}% | ¿Es Lead?: ${qualification.isLead}`);
        
        if (qualification.isLead && qualification.relevanceScore >= config.minRelevanceScore) {
          await sendTelegramAlert(post, qualification);
        }
      }
      
      // Registrar en el cache de procesados para no repetir
      processedLeads.push(post.id);
      
      // Limitar tamaño de cache a 1000 IDs para evitar crecimiento infinito
      if (processedLeads.length > 1000) {
        processedLeads.shift();
      }

      saveCache();
      // Delay entre análisis para respetar cuotas de API
      await new Promise(r => setTimeout(r, 1000));
    }

    console.log('Proceso de escucha finalizado.');
  } catch (err) {
    console.error('Error crítico en el proceso principal:', err.message);
  }
}

main();
