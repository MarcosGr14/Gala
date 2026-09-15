import { getLeaderboardsData } from '../services/statsService.js';

export async function renderRecords() {
  const container = document.createElement('div');
  container.style.padding = 'var(--spacing-xl)';
  container.style.maxWidth = '1200px';
  container.style.margin = '0 auto';

  const { idolStats, groupStats, daesangStats } = await getLeaderboardsData();

  // Función interna para dibujar un Leaderboard (Lista visual)
  const renderList = (title, data, label, isDaesang = false) => {
    const bgClass = isDaesang ? 'background: var(--color-daesang-bg); color: var(--color-daesang-text);' : 'background: var(--color-surface); color: var(--text-primary);';
    const accentClass = isDaesang ? 'color: var(--color-daesang-accent);' : 'color: var(--color-primary);';
    
    let html = `
      <div style="${bgClass} padding: var(--spacing-lg); border-radius: var(--radius-card); box-shadow: var(--shadow-card);">
        <h2 style="font-family: var(--font-display); ${accentClass} margin-top: 0; border-bottom: 1px solid rgba(128,128,128,0.2); padding-bottom: 10px;">${title}</h2>
        <div style="display: flex; flex-direction: column; gap: var(--spacing-sm); margin-top: var(--spacing-md);">
    `;

    if (data.length === 0) {
      html += `<p style="opacity: 0.6; font-style: italic;">No records found yet.</p>`;
    }

    data.forEach((item, index) => {
      const position = index + 1;
      const size = position === 1 ? '60px' : '45px'; // El Top 1 tiene foto más grande
      const name = item.entityType === 'idol' ? item.stageName : item.name;
      
      html += `
        <div style="display: flex; align-items: center; gap: var(--spacing-md); padding: 10px 0; border-bottom: 1px solid rgba(128,128,128,0.1);">
          <div style="font-family: var(--font-display); font-size: ${position === 1 ? '2em' : '1.5em'}; font-weight: bold; width: 30px; text-align: center; opacity: ${position === 1 ? '1' : '0.5'};">
            #${position}
          </div>
          <div style="width: ${size}; height: ${size}; border-radius: 50%; background-image: url('${item.photo}'); background-size: cover; background-position: center; flex-shrink: 0;"></div>
          <div style="flex-grow: 1;">
            <h3 style="margin: 0; font-size: ${position === 1 ? '1.2em' : '1em'};">${name}</h3>
            <span style="font-size: 0.8em; opacity: 0.7; text-transform: uppercase;">${item.entityType}</span>
          </div>
          <div style="text-align: right;">
            <h2 style="margin: 0; font-size: 1.8em; ${accentClass}">${item.count}</h2>
            <span style="font-size: 0.7em; font-weight: bold; letter-spacing: 1px; opacity: 0.7;">${label}</span>
          </div>
        </div>
      `;
    });

    html += `</div></div>`;
    return html;
  };

  container.innerHTML = `
    <h1 style="font-family: var(--font-display); color: var(--color-primary); text-align: center; font-size: 3em; margin-bottom: var(--spacing-xl);">All-Time Records</h1>
    
    <!-- DAESANGS ocupa todo el ancho superior -->
    <div style="margin-bottom: var(--spacing-lg);">
      ${renderList('🏆 MOST DAESANGS', daesangStats, 'DAESANGS', true)}
    </div>

    <!-- Idols y Groups se dividen en 2 columnas -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: var(--spacing-lg);">
      ${renderList('MOST LEGACY AWARDS (GROUPS)', groupStats, 'AWARDS')}
      ${renderList('MOST DIRECT WINS (IDOLS)', idolStats, 'AWARDS')}
    </div>
  `;

  return container;
}