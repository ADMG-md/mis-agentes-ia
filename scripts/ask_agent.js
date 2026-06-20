const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 1. Obtener la pregunta de los argumentos
const prompt = process.argv.slice(2).join(' ');

if (!prompt) {
  console.error('Error: Debes ingresar una pregunta.');
  process.exit(1);
}

// 2. Cargar variables de entorno del archivo .env
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

// Fallback a claude-flow.config.json
if (!apiKey) {
  const configPath = path.join(__dirname, '..', 'claude-flow.config.json');
  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      apiKey = config.agents.providers.find(p => p.name === 'google')?.apiKey;
    } catch (e) {
      // Ignorar
    }
  }
}

if (!apiKey) {
  console.error('Error: No se encontró la API Key de Google/Gemini.');
  process.exit(1);
}

// 3. Definir la ruta del Servidor MCP Local de forma relativa para compatibilidad macOS/VPS
const mcpServerPath = path.join(__dirname, '..', '..', 'healthcare-mcp-public', 'server', 'index.js');

// 4. Instrucción de Sistema y Declaración de Herramientas para Gemini
const systemInstruction = `Eres "Ruflo-Coecaribe", el asistente de inteligencia artificial clínico y técnico para COE Caribe IPS.

Tienes acceso a herramientas médicas reales mediante nuestro servidor MCP. Si el usuario te hace preguntas que requieren buscar estudios científicos, información oficial de fármacos, códigos de diagnóstico o realizar cálculos metabólicos (como IMC o tasa de filtración glomerular), DEBES invocar la herramienta correspondiente en lugar de adivinar o alucinar la información.

Una vez que obtengas la respuesta de la herramienta, redacta una respuesta muy completa, empática, y con referencias precisas en español. Si es un artículo científico de PubMed o medRxiv, detalla el título del estudio, los hallazgos principales y su relevancia para los tratamientos de medicina de precisión de COE Caribe IPS.`;

// Esquemas de herramientas compatibles con Gemini API
const toolsList = [{
  functionDeclarations: [
    {
      name: "pubmed_search",
      description: "Search for medical literature in PubMed database. Use this tool whenever the user asks for scientific papers, articles, studies, clinical trials, or medical literature about a disease, condition, drug, or treatment.",
      parameters: {
        type: "OBJECT",
        properties: {
          query: {
            type: "STRING",
            description: "The medical search query, e.g. 'Tirzepatide insulin resistance'"
          },
          max_results: {
            type: "INTEGER",
            description: "Max number of articles to return (1-10)"
          }
        },
        required: ["query"]
      }
    },
    {
      name: "fda_drug_lookup",
      description: "Look up drug details, brand/generic names, warnings, adverse events, dosage, indications, or drug interactions in the official FDA database.",
      parameters: {
        type: "OBJECT",
        properties: {
          drug_name: {
            type: "STRING",
            description: "Name of the drug (e.g. 'Metformin', 'Tirzepatide')"
          },
          search_type: {
            type: "STRING",
            description: "Type of info: 'general' (basic data), 'label' (warnings, dosage, interactions), 'adverse_events' (side effects)",
            enum: ["general", "label", "adverse_events"]
          }
        },
        required: ["drug_name"]
      }
    },
    {
      name: "clinical_trials_search",
      description: "Search for clinical trials in progress or completed, filtering by condition, disease, status, etc.",
      parameters: {
        type: "OBJECT",
        properties: {
          condition: {
            type: "STRING",
            description: "The medical condition to search for (e.g. 'type 2 diabetes')"
          },
          status: {
            type: "STRING",
            description: "Trial status (recruiting, completed, active, not_recruiting, all)",
            enum: ["recruiting", "completed", "active", "not_recruiting", "all"]
          }
        },
        required: ["condition"]
      }
    },
    {
      name: "calculate_bmi",
      description: "Calculate Body Mass Index (BMI) given height in meters and weight in kg.",
      parameters: {
        type: "OBJECT",
        properties: {
          height_meters: {
            type: "NUMBER",
            description: "Height in meters (e.g. 1.75)"
          },
          weight_kg: {
            type: "NUMBER",
            description: "Weight in kilograms (e.g. 70)"
          }
        },
        required: ["height_meters", "weight_kg"]
      }
    },
    {
      name: "lookup_icd_code",
      description: "Look up ICD-10 medical codes by diagnostic code or by textual description of the disease/condition.",
      parameters: {
        type: "OBJECT",
        properties: {
          code: {
            type: "STRING",
            description: "ICD-10 code (e.g. 'E11.9')"
          },
          description: {
            type: "STRING",
            description: "Description of the condition to find its code (e.g. 'type 2 diabetes')"
          }
        }
      }
    }
  ]
}];

// 5. Ejecutar una herramienta en el servidor MCP local via stdio (JSON-RPC)
function runMcpTool(toolName, toolArgs) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(mcpServerPath)) {
      return reject(new Error(`Servidor MCP no encontrado en: ${mcpServerPath}. Asegúrate de clonar el repositorio en la VPS.`));
    }

    const mcp = spawn('node', [mcpServerPath]);
    let buffer = '';
    let resolved = false;

    // Timeout de seguridad de 10 segundos
    const timeout = setTimeout(() => {
      if (!resolved) {
        mcp.kill();
        reject(new Error(`Timeout esperando respuesta de la herramienta MCP: ${toolName}`));
      }
    }, 10000);

    mcp.stdout.on('data', (data) => {
      buffer += data.toString();
      if (buffer.includes('\n')) {
        const lines = buffer.split('\n');
        buffer = lines.pop(); // Mantener remanente incompleto
        
        for (const line of lines) {
          if (line.trim() === '') continue;
          try {
            const response = JSON.parse(line);
            // Validar que la respuesta corresponda a nuestro request ID 1
            if (response.id === 1) {
              clearTimeout(timeout);
              resolved = true;
              mcp.kill();
              resolve(response.result?.content?.[0]?.text || '');
              return;
            }
          } catch (e) {
            // Ignorar líneas de inicialización u otros outputs JSON incompletos
          }
        }
      }
    });

    mcp.stderr.on('data', (data) => {
      // Omitir logs de stderr del servidor MCP para mantener salida limpia
    });

    mcp.on('close', (code) => {
      if (!resolved) {
        clearTimeout(timeout);
        reject(new Error(`El servidor MCP cerró inesperadamente con código ${code}`));
      }
    });

    // Enviar el request JSON-RPC
    const request = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: toolArgs
      },
      id: 1
    };
    
    // Esperar un segundo a que el servidor inicialice antes de escribir
    setTimeout(() => {
      mcp.stdin.write(JSON.stringify(request) + '\n');
    }, 1200);
  });
}

// 6. Realizar la llamada a la API de Gemini
async function callGemini(contents, modelName) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: contents,
      systemInstruction: { parts: [{ text: systemInstruction }] },
      tools: toolsList,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1500
      }
    })
  });

  return await response.json();
}

// Modelos disponibles para fallback en caso de 503/429
const FALLBACK_MODELS = [
  'gemini-3.1-flash-lite',
  'gemini-2.0-flash-lite',
  'gemini-flash-latest',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-pro-latest'
];

// 7. Loop Principal de Agente (Pensar -> Actuar -> Responder)
async function runAgent() {
  try {
    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }]
      }
    ];

    let data;
    let successModel = '';
    
    // Intentar con los modelos de la lista hasta encontrar uno activo
    for (const model of FALLBACK_MODELS) {
      try {
        console.error(`Intentando con modelo: ${model}...`);
        data = await callGemini(contents, model);
        
        if (data && !data.error) {
          successModel = model;
          break;
        } else if (data && data.error) {
          console.error(`⚠️ Modelo ${model} no disponible: ${data.error.message} (Código ${data.error.code})`);
        }
      } catch (err) {
        console.error(`⚠️ Error con modelo ${model}:`, err.message);
      }
    }

    if (!successModel) {
      console.log('🤖 Lo siento, todos los modelos de IA están ocupados en este momento. Por favor reintenta en unos minutos.');
      return;
    }

    const candidate = data.candidates?.[0];
    const part = candidate?.content?.parts?.[0];

    // Verificar si la IA decidió llamar a una herramienta (Function Calling)
    if (part && part.functionCall) {
      const toolName = part.functionCall.name;
      const toolArgs = part.functionCall.args;

      console.error(`🤖 [${successModel}] El agente decidió usar la herramienta: "${toolName}" con argumentos:`, JSON.stringify(toolArgs));

      try {
        // Ejecutar herramienta localmente en el servidor MCP
        const toolResultText = await runMcpTool(toolName, toolArgs);
        
        // Agregar la llamada de la función y la respuesta de la herramienta al historial
        contents.push({
          role: 'model',
          parts: [{ functionCall: { name: toolName, args: toolArgs } }]
        });
        
        contents.push({
          role: 'user',
          parts: [{
            functionResponse: {
              name: toolName,
              response: { content: toolResultText }
            }
          }]
        });

        // Ronda 2: Enviar el resultado de la herramienta a la IA para la síntesis final
        let finalData;
        let finalSuccess = false;
        
        // Intentar la segunda ronda también con fallback
        for (const model of [successModel, ...FALLBACK_MODELS]) {
          try {
            finalData = await callGemini(contents, model);
            if (finalData && !finalData.error) {
              finalSuccess = true;
              break;
            }
          } catch (e) {}
        }

        const finalCandidate = finalData?.candidates?.[0];
        const finalText = finalCandidate?.content?.parts?.[0]?.text;

        if (finalText) {
          console.log(finalText);
        } else {
          console.log('🤖 Lo siento, no pude estructurar la respuesta final.');
        }

      } catch (toolError) {
        console.error('❌ Error al ejecutar herramienta:', toolError.message);
        // Si la herramienta falla, pedirle a Gemini que responda amigablemente
        console.log(`⚠️ No pude acceder a la base de datos médica en tiempo real (${toolError.message}).\n\nAquí tienes lo que sé sobre tu consulta:\n\n` + (part.text || 'Inténtalo de nuevo más tarde.'));
      }
    } else if (part && part.text) {
      // Si la IA no requirió ninguna herramienta, retornar la respuesta textual directa
      console.log(part.text);
    } else {
      console.error('Respuesta inesperada de Gemini:', JSON.stringify(data));
      console.log('🤖 Lo siento, no pude procesar tu solicitud.');
    }

  } catch (err) {
    console.error('Error crítico en ask_agent:', err.message);
    console.log('❌ Ocurrió un error en el servidor de agentes de IA.');
  }
}

runAgent();
