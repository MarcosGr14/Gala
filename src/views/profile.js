import { getIdolById, getGroupById } from '../services/artistService.js';
import { getPopulatedAwardsByWinner, getGroupLegacyStatsData } from '../services/awardService.js';

export async function renderProfile(entityType, entityId) {
  const container = document.createElement('div');
  container.style.padding = 'var(--spacing-xl)';
  container.style.maxWidth = '1000px';
  container.style.margin = '0 auto';

  let entity = null;
  if (entityType === 'idol') entity = await getIdolById(entityId);
  if (entityType === 'group') entity = await getGroupById(entityId);

  if (!entity) {
    container.innerHTML = `<h2 style="color: red;">Entity not found.</h2>`;
    return container;
  }

  const name = entityType === 'idol' ? entity.stageName : entity.name;
  const subtitle = entityType === 'idol' ? (entity.realName || 'Soloist / Idol') : (entity.type === 'bg' ? 'Boy Group' : 'Girl Group');
  
  const awards = await getPopulatedAwardsByWinner(entity.id);
  const daesangsCount = awards.filter(a => a.tier === 'daesang').length;

  let html = `
    <div style="display: flex; gap: var(--spacing-lg); align-items: flex-end; margin-bottom: var(--spacing-xl); border-bottom: 2px solid rgba(0,0,0,0.05); padding-bottom: var(--spacing-md);">
      <div style="width: 150px; height: 150px; border-radius: var(--radius-lg); background-color: #ddd; background-image: url('${entity.photo}'); background-size: cover; background-position: center; box-shadow: var(--shadow-card);"></div>
      <div>
        <h3 style="margin: 0; color: var(--text-secondary); text-transform: uppercase; font-size: 0.9em; letter-spacing: 1px;">${subtitle}</h3>
        <h1 style="margin: 0; font-family: var(--font-display); font-size: 3.5em; color: var(--color-primary); line-height: 1;">${name}</h1>
      </div>
    </div>
  `;

  // --- RENDERIZADO CONDICIONAL DE ESTADÍSTICAS ---
  if (entityType === 'group') {
    // Es un GRUPO: Calculamos su Legacy
    const legacyStats = await getGroupLegacyStatsData(entity.id);
    
    html += `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--spacing-md); margin-bottom: var(--spacing-xl);">
        
        <!-- LEGACY GIGANTE (Ocupa 2 columnas) -->
        <div style="grid-column: span 2; background: var(--color-primary); color: white; padding: var(--spacing-lg); border-radius: var(--radius-card); box-shadow: var(--shadow-card); display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <h2 style="margin: 0; font-size: 3em; font-family: var(--font-display);">${legacyStats.totalLegacyAwards}</h2>
          <p style="margin: 0; font-weight: bold; letter-spacing: 1px;">TOTAL LEGACY AWARDS</p>
        </div>

        <!-- DAESANGS -->
        <div style="grid-column: span 2; background: var(--color-daesang-bg); color: var(--color-daesang-text); padding: var(--spacing-lg); border-radius: var(--radius-card); box-shadow: var(--shadow-daesang); display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <h2 style="margin: 0; font-size: 3em; color: var(--color-daesang-accent); font-family: var(--font-display);">${daesangsCount}</h2>
          <p style="margin: 0; font-weight: bold; letter-spacing: 1px;">DAESANGS (DIRECT)</p>
        </div>

        <!-- DESGLOSE -->
        <div style="grid-column: span 2; background: var(--color-surface); padding: var(--spacing-md); border-radius: var(--radius-card); box-shadow: var(--shadow-sm); text-align: center; border-top: 3px solid var(--color-secondary);">
          <h2 style="margin: 0; font-size: 2em; color: var(--text-primary);">${legacyStats.directWins}</h2>
          <p style="margin: 0; color: var(--text-secondary); font-size: 0.85em; font-weight: bold;">DIRECT GROUP WINS</p>
        </div>
        
        <div style="grid-column: span 2; background: var(--color-surface); padding: var(--spacing-md); border-radius: var(--radius-card); box-shadow: var(--shadow-sm); text-align: center; border-top: 3px solid var(--color-secondary);">
          <h2 style="margin: 0; font-size: 2em; color: var(--text-primary);">${legacyStats.associatedMemberWins}</h2>
          <p style="margin: 0; color: var(--text-secondary); font-size: 0.85em; font-weight: bold;">MEMBER WINS</p>
        </div>

      </div>
    `;
  } else {
    // Es un IDOL: Estadísticas estándar
    html += `
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--spacing-md); margin-bottom: var(--spacing-xl);">
        <div style="background: var(--color-surface); padding: var(--spacing-lg); border-radius: var(--radius-card); box-shadow: var(--shadow-sm); text-align: center;">
          <h2 style="margin: 0; font-size: 2.5em; color: var(--text-primary);">${awards.length}</h2>
          <p style="margin: 0; color: var(--text-secondary); font-weight: bold;">DIRECT WINS</p>
        </div>
        <div style="background: var(--color-daesang-bg); color: var(--color-daesang-text); padding: var(--spacing-lg); border-radius: var(--radius-card); box-shadow: var(--shadow-daesang); text-align: center;">
          <h2 style="margin: 0; font-size: 2.5em; color: var(--color-daesang-accent); font-family: var(--font-display);">${daesangsCount}</h2>
          <p style="margin: 0; font-weight: bold;">DAESANGS</p>
        </div>
      </div>
    `;
  }

  // --- HISTORIAL DE PREMIOS (Igual para ambos) ---
  html += `<h2 style="font-family: var(--font-display); border-bottom: 1px solid #eee; padding-bottom: 10px;">Direct Award History</h2>`;

  if (awards.length === 0) {
    html += `<p style="color: var(--text-secondary); font-style: italic;">No awards registered yet.</p>`;
  } else {
    html += `<div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">`;
    awards.forEach(award => {
      const isDaesang = award.tier === 'daesang';
      html += `
        <div style="background: ${isDaesang ? 'var(--color-daesang-bg)' : 'var(--color-surface)'}; 
                    color: ${isDaesang ? 'var(--color-daesang-text)' : 'var(--text-primary)'};
                    padding: var(--spacing-md); border-radius: var(--radius-md); box-shadow: var(--shadow-sm); 
                    display: flex; justify-content: space-between; align-items: center;
                    border-left: 4px solid ${isDaesang ? 'var(--color-daesang-accent)' : 'var(--color-primary)'};">
          <div>
            <h3 style="margin: 0; font-family: ${isDaesang ? 'var(--font-display)' : 'var(--font-body)'}; ${isDaesang ? 'color: var(--color-daesang-accent); font-size: 1.4em;' : ''}">
              ${award.categoryName}
            </h3>
            <span style="opacity: 0.7; font-size: 0.9em;">Season ${award.year}</span>
          </div>
          ${isDaesang ? '<span style="font-weight: bold; letter-spacing: 2px;">👑 DAESANG</span>' : ''}
        </div>
      `;
    });
    html += `</div>`;
  }

  container.innerHTML = html;
  return container;
}