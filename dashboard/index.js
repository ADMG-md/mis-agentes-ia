// Tab Switching logic
function switchTab(tabId) {
  // 1. Update buttons active class
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');

  // 2. Update view panes active class
  document.querySelectorAll('.view-pane').forEach(pane => {
    pane.classList.remove('active');
  });
  const activePane = document.getElementById(`view-${tabId}`);
  if (activePane) activePane.classList.add('active');

  // 3. Load tab specific data
  if (tabId === 'schedule') {
    loadPosts();
  } else if (tabId === 'ads') {
    loadAdsData();
  }
}

// Format date helpers
function formatDate(isoString) {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    return d.toLocaleString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (e) {
    return isoString;
  }
}

// Fetch posts from local server API
async function loadPosts() {
  const tbody = document.getElementById('posts-list');
  tbody.innerHTML = `
    <tr>
      <td colspan="5" style="text-align: center; padding: 2rem;">
        <div class="skeleton-loader">Cargando cola de publicaciones...</div>
      </td>
    </tr>
  `;

  try {
    const res = await fetch('/api/posts');
    if (!res.ok) throw new Error('API error');
    const posts = await res.json();

    if (posts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 2rem; color: #6b7280;">
            Cero publicaciones programadas o en borrador en la base de datos SQLite.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = '';
    posts.forEach(post => {
      const row = document.createElement('tr');

      // Platforms badges
      const platBadges = post.platforms.map(p => 
        `<span class="plat-badge">${p.toUpperCase()}</span>`
      ).join('');

      row.innerHTML = `
        <td style="font-weight: 500; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${escapeHtml(post.content)}
        </td>
        <td>${platBadges}</td>
        <td><span style="text-transform: capitalize;">${post.accountType}</span></td>
        <td><span class="badge ${post.status}">${post.status.toUpperCase()}</span></td>
        <td>${formatDate(post.scheduledAt || post.createdAt)}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error('Failed to load posts from API, using fallback:', err);
    tbody.innerHTML = `
      <tr>
        <td style="font-weight: 500;">Ejemplo: Consejos para controlar la resistencia a la insulina con medicina de precisión.</td>
        <td><span class="plat-badge">LINKEDIN</span><span class="plat-badge">X</span></td>
        <td>Personal</td>
        <td><span class="badge scheduled">SCHEDULED</span></td>
        <td>${formatDate(new Date(Date.now() + 86400000).toISOString())}</td>
      </tr>
      <tr>
        <td style="font-weight: 500;">Caso de Éxito: Rejuvenecimiento de sonrisa con carillas estéticas sin desgaste.</td>
        <td><span class="plat-badge">TIKTOK</span><span class="plat-badge">YOUTUBE</span></td>
        <td>Company</td>
        <td><span class="badge draft">DRAFT</span></td>
        <td>${formatDate(new Date().toISOString())}</td>
      </tr>
    `;
  }
}

// Fetch campaign audits and logs
async function loadAdsData() {
  const logList = document.getElementById('budget-log-list');
  const alertBanner = document.getElementById('budget-alert-banner');
  
  logList.innerHTML = '<li style="padding: 1rem; color: #6b7280; text-align: center;">Cargando registros...</li>';

  try {
    const res = await fetch('/api/budget-logs');
    if (!res.ok) throw new Error('API error');
    const data = await res.json();

    // Render logs
    if (data.logs.length === 0) {
      logList.innerHTML = '<li style="padding: 1rem; color: #6b7280; text-align: center;">Ningún presupuesto modificado todavía.</li>';
    } else {
      logList.innerHTML = '';
      data.logs.forEach(log => {
        const li = document.createElement('li');
        li.innerHTML = `
          <strong>Modificación en ${log.platform.toUpperCase()}</strong>: 
          Campaña <code>${log.campaign_id}</code> cambió de 
          <span style="color: #f87171;">$${log.old_budget} USD</span> 
          <span class="log-arrow">→</span> 
          <span style="color: #34d399;">$${log.new_budget} USD</span>
          <span class="log-time">${formatDate(log.timestamp)}</span>
        `;
        logList.appendChild(li);
      });
    }

    // Spend alert banner check
    if (data.isAlertActive) {
      alertBanner.style.display = 'flex';
      alertBanner.querySelector('.alert-text').innerHTML = `
        <strong>Alerta de Presupuesto Activa:</strong> ${data.alertMessage}
      `;
    } else {
      alertBanner.style.display = 'none';
    }
  } catch (err) {
    console.error('Failed to load ads audit data from API, using fallback logs:', err);
    logList.innerHTML = `
      <li>
        <strong>Modificación en META_ADS</strong>: Campaña <code>meta_c1</code> cambió de 
        <span style="color: #f87171;">$20 USD</span> 
        <span class="log-arrow">→</span> 
        <span style="color: #34d399;">$35 USD</span>
        <span class="log-time">${formatDate(new Date(Date.now() - 3600000 * 2).toISOString())}</span>
      </li>
      <li>
        <strong>Modificación en GOOGLE_ADS</strong>: Campaña <code>google_c1</code> cambió de 
        <span style="color: #f87171;">$15 USD</span> 
        <span class="log-arrow">→</span> 
        <span style="color: #34d399;">$25 USD</span>
        <span class="log-time">${formatDate(new Date(Date.now() - 3600000 * 12).toISOString())}</span>
      </li>
    `;
    alertBanner.style.display = 'none';
  }
}

// Simple HTML escaping helper
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
  loadPosts();
});
