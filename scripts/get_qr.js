const fs = require('fs');
const { exec } = require('child_process');

// Apuntamos a la instancia 'coecaribe' que ya existe registrada en tu VPS
const url = 'http://167.88.45.94:8080/instance/connect/coecaribe';
const apiKey = 'ClinicaCoecaribe2026';

console.log('Obteniendo información de la instancia coecaribe...');

fetch(url, {
  headers: {
    'apikey': apiKey
  }
})
.then(res => {
  if (!res.ok) {
    throw new Error(`Error de servidor: ${res.status}`);
  }
  return res.json();
})
.then(data => {
  // En Evolution API v2, 'base64' viene directamente en la raíz de la respuesta JSON
  const base64 = data.base64;
  if (!base64) {
    console.log('Respuesta de la VPS:\n', JSON.stringify(data, null, 2));
    throw new Error('No se encontró el campo "base64" en la respuesta.');
  }

  const htmlContent = `
    <html>
      <head>
        <title>Vincular WhatsApp - COE Caribe</title>
      </head>
      <body style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100vh; background:#f0f2f5; font-family:sans-serif;">
        <div style="background:white; padding:30px; border-radius:12px; box-shadow:0 4px 12px rgba(0,0,0,0.1); text-align:center;">
          <h2 style="color:#0F172A; margin-bottom:10px;">Escanea este Código QR</h2>
          <p style="color:#64748B; font-size:14px; margin-bottom:20px;">Abre WhatsApp en tu celular > Dispositivos Vinculados > Vincular un dispositivo</p>
          <img src="${base64}" style="width:300px; height:300px; border: 1px solid #E2E8F0; border-radius:8px;" />
        </div>
      </body>
    </html>
  `;

  const path = '/tmp/qr_coecaribe.html';
  fs.writeFileSync(path, htmlContent);
  console.log('Código QR listo. Abriendo en el navegador...');
  exec(`open ${path}`);
})
.catch(err => {
  console.error('Error al obtener la información:', err.message);
});
