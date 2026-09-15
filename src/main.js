import './css/variables.css'; 
import { db } from './data/db.js';
import { renderAdmin } from './views/admin.js';
import { renderProfile } from './views/profile.js';
import { renderRecords } from './views/records.js';
import { renderGala } from './views/gala.js';
import { getAllIdols, getAllGroups } from './services/artistService.js';

async function initApp() {
  const appElement = document.querySelector('#app');
  
  // 1. Estructura principal de la app con el nuevo Navbar (Home, Gala, Records, Admin)
  appElement.innerHTML = `
    <nav style="height: var(--nav-height); background: var(--color-surface); box-shadow: var(--shadow-sm); display: flex; align-items: center; padding: 0 var(--spacing-xl); gap: var(--spacing-md); position: sticky; top: 0; z-index: 100;">
      <h2 style="font-family: var(--font-display); color: var(--color-primary); margin: 0; cursor: pointer;" id="nav-home">KPop Gala</h2>
      <div style="flex-grow: 1;"></div>
      <button id="nav-gala" style="background: none; border: none; font-family: var(--font-body); font-weight: bold; color: var(--color-primary); cursor: pointer; padding: 8px 16px;">GALA</button>
      <button id="nav-records" style="background: none; border: none; font-family: var(--font-body); font-weight: bold; color: var(--text-secondary); cursor: pointer; padding: 8px 16px;">RECORDS</button>
      <button id="nav-admin" style="background: none; border: none; font-family: var(--font-body); font-weight: bold; color: var(--text-secondary); cursor: pointer; padding: 8px 16px;">ADMIN</button>
    </nav>
    <main id="view-container" style="min-height: calc(100vh - var(--nav-height)); background: var(--color-bg);"></main>
  `;

  const viewContainer = document.querySelector('#view-container');

  // 2. Enrutador interno (SPA)
  const navigateTo = async (view, params = {}) => {
    // Estado de carga temporal
    viewContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary);">Loading...</div>';
    
    if (view === 'home') {
      const idols = await getAllIdols();
      const groups = await getAllGroups();
      
      let html = `<div style="padding: var(--spacing-xl); max-width: 1200px; margin: 0 auto;">
        <h1 style="font-family: var(--font-display); color: var(--color-primary); text-align: center; margin-bottom: var(--spacing-xl);">Hall of Fame Directory</h1>
      `;

      const renderCard = (entity, type) => `
        <div class="artist-card" data-id="${entity.id}" data-type="${type}" style="background: var(--color-surface); padding: var(--spacing-md); border-radius: var(--radius-card); box-shadow: var(--shadow-sm); cursor: pointer; text-align: center; transition: transform 0.2s;">
          <div style="width: 100px; height: 100px; border-radius: 50%; background-color: #eee; margin: 0 auto 10px auto; background-image: url('${entity.photo}'); background-size: cover; background-position: center;"></div>
          <h3 style="margin: 0; color: var(--text-primary);">${type === 'idol' ? entity.stageName : entity.name}</h3>
          <span style="color: var(--text-secondary); font-size: 0.8em; text-transform: uppercase;">${type}</span>
        </div>
      `;

      html += `<h2 style="border-bottom: 2px solid #eee; padding-bottom: 10px; font-family: var(--font-display);">Groups</h2>
               <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--spacing-md); margin-bottom: var(--spacing-xl);">
                 ${groups.map(g => renderCard(g, 'group')).join('')}
               </div>`;

      html += `<h2 style="border-bottom: 2px solid #eee; padding-bottom: 10px; font-family: var(--font-display);">Idols</h2>
               <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: var(--spacing-md);">
                 ${idols.map(i => renderCard(i, 'idol')).join('')}
               </div>`;

      html += `</div>`;
      viewContainer.innerHTML = html;

      // Event Listeners para ir a los perfiles
      viewContainer.querySelectorAll('.artist-card').forEach(card => {
        card.addEventListener('click', () => {
          navigateTo('profile', { type: card.dataset.type, id: card.dataset.id });
        });
      });

    } else if (view === 'admin') {
      viewContainer.innerHTML = '';
      viewContainer.appendChild(renderAdmin());
      
    } else if (view === 'records') {
      viewContainer.innerHTML = '';
      viewContainer.appendChild(await renderRecords());
      
    } else if (view === 'gala') {
      viewContainer.innerHTML = '';
      viewContainer.appendChild(await renderGala());
      
    } else if (view === 'profile') {
      viewContainer.innerHTML = '';
      viewContainer.appendChild(await renderProfile(params.type, params.id));
    }
  };

  // 3. Listeners de los botones del Navbar
  document.querySelector('#nav-home').addEventListener('click', () => navigateTo('home'));
  document.querySelector('#nav-admin').addEventListener('click', () => navigateTo('admin'));
  document.querySelector('#nav-records').addEventListener('click', () => navigateTo('records'));
  document.querySelector('#nav-gala').addEventListener('click', () => navigateTo('gala'));

  // 4. Inicializar base de datos y cargar la Home
  try {
    await db.open();
    navigateTo('home');
  } catch (error) {
    console.error("Failed to open database:", error);
    viewContainer.innerHTML = `<p style="color: red; padding: 20px; font-weight: bold;">Error crítico: No se pudo conectar a la base de datos histórica. (${error})</p>`;
  }
}

initApp();