const fs = require('fs');
const path = require('path');

// 1. Obtener la pregunta de los argumentos de línea de comandos
const prompt = process.argv.slice(2).join(' ');

if (!prompt) {
  console.error('Error: Debes ingresar una pregunta.');
  process.exit(1);
}

// 2. Cargar variables de entorno del archivo .env en el directorio padre
let apiKey = process.env.GOOGLE_API_KEY;
const envPath = path.join(__dirname, '..', '.env');
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
      if (key === 'GOOGLE_API_KEY') {
        apiKey = value;
      }
    }
  });
}

// 3. Fallback a claude-flow.config.json si no está en el .env
if (!apiKey) {
  const configPath = path.join(__dirname, '..', 'claude-flow.config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      apiKey = config.agents.providers.find(p => p.name === 'google')?.apiKey;
    } catch (e) {
      // Ignorar error de parsing
    }
  }
}

if (!apiKey) {
  console.error('Error: No se encontró la API Key de Google/Gemini.');
  process.exit(1);
}

// 4. Configurar el System Prompt con el contexto de la VPS y los proyectos del usuario
const systemInstruction = `Eres "Ruflo-Coecaribe", el agente de inteligencia artificial que controla y asiste en este servidor de COE Caribe IPS.

El servidor está corriendo en una VPS Ubuntu con las siguientes especificaciones: 2 vCPUs, 8 GB RAM, 100 GB SSD.

Los proyectos activos en la carpeta "/projects" son:
1. "mis-agentes-ia": Este mismo framework de agentes autónomos Ruflo / Claude-Flow que conecta con Telegram Bot API y Evolution API (WhatsApp).
2. "coe": Landing page y embudo de conversión clínica (Quiz Precalificador metabólico) en Next.js 15+ corriendo en el puerto 3010.
3. "coe-precision-health": Plataforma de salud metabólica y medicina de precisión personalizada.
4. "integrum" e "integrum_v2": Módulos de administración y gestión clínica de pacientes.
5. "rrssagente": Agentes de automatización de redes sociales y generación de prospectos.
6. "BioForge": Ecosistema para workflows científicos y biotecnología.

Lo que podemos hacer juntos en este bot de Telegram:
- Monitorear el servidor y PM2 / Docker usando el comando /status.
- Consultar la base de datos de conocimiento/memoria de los agentes usando /memory [pregunta].
- Ejecutar flujos de trabajo complejos de agentes usando /run [tarea].
- Responder dudas generales sobre los proyectos o la salud metabólica.

Responde al usuario en español, de forma muy concisa, profesional, y con formato Markdown amigable para Telegram (puedes usar negritas, cursivas, listas).`;

// 5. Llamar a la API de Gemini
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`;

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt }
        ]
      }
    ],
    systemInstruction: {
      parts: [
        { text: systemInstruction }
      ]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024
    }
  })
})
.then(res => res.json())
.then(data => {
  if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
    console.log(data.candidates[0].content.parts[0].text);
  } else if (data.error) {
    console.error('Error de API Gemini:', data.error.message);
  } else {
    console.error('Respuesta inesperada de la API:', JSON.stringify(data));
  }
})
.catch(err => {
  console.error('Error al realizar la consulta:', err.message);
});
