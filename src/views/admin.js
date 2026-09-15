import { addIdol, addGroup, addMembership, getAllIdols, getAllGroups } from '../services/artistService.js';
import { getAllCategories, getAllSeasons, registerAwardResult } from '../services/awardService.js';
import { exportDatabaseToJson, importDatabaseFromJson } from '../services/backupService.js';

export function renderAdmin() {
  const container = document.createElement('div');
  container.style.padding = 'var(--spacing-lg)';
  container.style.maxWidth = '1200px';
  container.style.margin = '0 auto';

  container.innerHTML = `
    <h2 style="font-family: var(--font-display); color: var(--color-primary); margin-bottom: var(--spacing-lg);">Admin Dashboard</h2>
    
    <!-- CONTENEDOR PRINCIPAL DEL PREMIO (Destacado) -->
    <div style="background: var(--color-daesang-bg); color: var(--color-daesang-text); padding: var(--spacing-lg); border-radius: var(--radius-card); box-shadow: var(--shadow-daesang); margin-bottom: var(--spacing-lg);">
      <h3 style="margin-top: 0; font-family: var(--font-display); color: var(--color-daesang-accent);">Register Award Winner</h3>
      
      <form id="form-award" style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
        
        <div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
          <label>Season</label>
          <select name="seasonId" id="select-season" required style="padding: 10px; border-radius: var(--radius-sm);"></select>
          
          <label>Category</label>
          <select name="categoryId" id="select-category" required style="padding: 10px; border-radius: var(--radius-sm);">
            <option value="">Select Category...</option>
          </select>
        </div>

        <div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
          <label>Winners</label>
          <!-- ESTE DIV CAMBIA DINÁMICAMENTE -->
          <div id="dynamic-winner-inputs" style="display: flex; flex-direction: column; gap: var(--spacing-sm); min-height: 100px; background: rgba(255,255,255,0.1); padding: 10px; border-radius: var(--radius-sm);">
            <p style="margin: 0; font-size: 0.9em; opacity: 0.7;">Select a category to load winner inputs.</p>
          </div>
          
          <button type="submit" style="background: var(--color-daesang-accent); color: #000; font-weight: bold; border: none; padding: 12px; border-radius: var(--radius-sm); cursor: pointer; margin-top: auto;">Save Historical Result</button>
        </div>
      </form>
    </div>

    <!-- ... AQUI ABAJO VAN LOS 3 FORMULARIOS QUE YA TENÍAMOS (Idol, Group, Membership) ... -->
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--spacing-lg);">
      
      <div style="background: var(--color-surface); padding: var(--spacing-md); border-radius: var(--radius-card); box-shadow: var(--shadow-sm);">
        <h3 style="margin-top: 0;">Add Idol</h3>
        <form id="form-idol" style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
          <input type="text" name="stageName" placeholder="Stage Name" required style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid #ccc;">
          <input type="text" name="realName" placeholder="Real Name (Optional)" style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid #ccc;">
          <button type="submit" style="background: var(--color-primary); color: white; border: none; padding: 10px; border-radius: var(--radius-sm); cursor: pointer;">Save Idol</button>
        </form>
      </div>

      <div style="background: var(--color-surface); padding: var(--spacing-md); border-radius: var(--radius-card); box-shadow: var(--shadow-sm);">
        <h3 style="margin-top: 0;">Add Group</h3>
        <form id="form-group" style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
          <input type="text" name="groupName" placeholder="Group Name" required style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid #ccc;">
          <select name="groupType" required style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid #ccc;">
            <option value="bg">Boy Group</option><option value="gg">Girl Group</option>
          </select>
          <button type="submit" style="background: var(--color-secondary); color: white; border: none; padding: 10px; border-radius: var(--radius-sm); cursor: pointer;">Save Group</button>
        </form>
      </div>

      <div style="background: var(--color-surface); padding: var(--spacing-md); border-radius: var(--radius-card); box-shadow: var(--shadow-sm);">
        <h3 style="margin-top: 0;">Link Idol to Group</h3>
        <form id="form-membership" style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
          <select name="idolId" id="select-idol" required style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid #ccc;"></select>
          <select name="groupId" id="select-group" required style="padding: 8px; border-radius: var(--radius-sm); border: 1px solid #ccc;"></select>
          <button type="submit" style="background: var(--text-primary); color: white; border: none; padding: 10px; border-radius: var(--radius-sm); cursor: pointer;">Create Membership</button>
        </form>
      </div>

      <!-- NUEVA TARJETA: BACKUP & RESTORE -->
      <div style="background: var(--color-surface); padding: var(--spacing-md); border-radius: var(--radius-card); box-shadow: var(--shadow-sm); grid-column: 1 / -1; border-top: 4px solid var(--color-primary);">
        <h3 style="margin-top: 0; font-family: var(--font-display);">Historical Data Safety (Backup)</h3>
        <p style="color: var(--text-secondary); font-size: 0.9em;">Export your entire history as a JSON file or restore from a previous backup.</p>
        
        <div style="display: flex; gap: var(--spacing-md); align-items: center; margin-top: var(--spacing-md);">
          <button id="btn-export" style="background: var(--color-secondary); color: white; border: none; padding: 10px 20px; border-radius: var(--radius-sm); cursor: pointer; font-weight: bold;">📥 Export JSON Backup</button>
          
          <label style="background: var(--color-primary); color: white; padding: 10px 20px; border-radius: var(--radius-sm); cursor: pointer; font-weight: bold; font-size: 0.9em;">
            📤 Restore JSON <input type="file" id="file-restore" accept=".json" style="display: none;">
          </label>
        </div>
      </div>
    </div>
  `;

  // Variables para guardar datos en memoria
  let idolsData = [];
  let groupsData = [];
  let categoriesData = [];

  async function populateData() {
    idolsData = await getAllIdols();
    groupsData = await getAllGroups();
    categoriesData = await getAllCategories();
    const seasons = await getAllSeasons();

    // Llenar Seasons
    const seasonSelect = container.querySelector('#select-season');
    seasons.forEach(s => {
      seasonSelect.insertAdjacentHTML('beforeend', `<option value="${s.id}">${s.year} - ${s.title}</option>`);
    });

    // Llenar Categorías
    const categorySelect = container.querySelector('#select-category');
    categoriesData.forEach(c => {
      categorySelect.insertAdjacentHTML('beforeend', `<option value="${c.id}">${c.displayName}</option>`);
    });

    // Llenar Membresías (Los formularios pequeños)
    const idolSelect = container.querySelector('#select-idol');
    const groupSelect = container.querySelector('#select-group');
    idolSelect.innerHTML = '<option value="">Select Idol...</option>';
    groupSelect.innerHTML = '<option value="">Select Group...</option>';
    
    idolsData.forEach(idol => idolSelect.insertAdjacentHTML('beforeend', `<option value="${idol.id}">${idol.stageName}</option>`));
    groupsData.forEach(group => groupSelect.insertAdjacentHTML('beforeend', `<option value="${group.id}">${group.name}</option>`));
  }

  // --- LA MAGIA DEL FORMULARIO DINÁMICO ---
  container.querySelector('#select-category').addEventListener('change', (e) => {
    const selectedCatId = e.target.value;
    const category = categoriesData.find(c => c.id === selectedCatId);
    const dynamicContainer = container.querySelector('#dynamic-winner-inputs');
    
    dynamicContainer.innerHTML = ''; // Limpiamos el contenedor
    if (!category) return;

    // Crear options pre-renderizados para inyectar rápido
    const idolOptions = idolsData.map(i => `<option value="${i.id}">${i.stageName}</option>`).join('');
    const groupOptions = groupsData.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    // Lógica condicional según el TIPO y ESTRUCTURA de la categoría
    if (category.winnerType === 'idol') {
      if (category.winnerStructure === 'single') {
        // Ejemplo: Best Male Vocal -> 1 solo input
        dynamicContainer.innerHTML = `<select name="winner_1" required style="padding: 10px;"><option value="">Select Idol Winner...</option>${idolOptions}</select>`;
      } else if (category.winnerStructure === 'pair') {
        // Ejemplo: Best Duo -> 2 inputs
        dynamicContainer.innerHTML = `
          <select name="winner_1" required style="padding: 10px;"><option value="">Select First Idol...</option>${idolOptions}</select>
          <span style="text-align: center; font-weight: bold; font-size: 1.2em;">+</span>
          <select name="winner_2" required style="padding: 10px;"><option value="">Select Second Idol...</option>${idolOptions}</select>
        `;
      }
    } else if (category.winnerType === 'group') {
      // Ejemplo: Group of the Year
      dynamicContainer.innerHTML = `<select name="winner_1" required style="padding: 10px;"><option value="">Select Group Winner...</option>${groupOptions}</select>`;
    } else {
      // Fallback para Song, Album, etc (Hasta que creemos sus CRUDS)
      dynamicContainer.innerHTML = `<p style="color: yellow;">(Input type "${category.winnerType}" not fully implemented yet)</p>`;
    }
  });

  // Guardar el Premio
  container.querySelector('#form-award').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const categoryId = formData.get('categoryId');
    const category = categoriesData.find(c => c.id === categoryId);
    
    // Recolectar todos los inputs dinámicos que empiecen con "winner_"
    const winnerIds = [];
    for (let [key, value] of formData.entries()) {
      if (key.startsWith('winner_') && value) {
        winnerIds.push(value);
      }
    }

    if (winnerIds.length === 0) return alert('Select at least one winner!');

    try {
      await registerAwardResult(formData.get('seasonId'), categoryId, winnerIds, category.winnerType);
      alert('🏆 Award Result saved historically!');
      e.target.reset();
      container.querySelector('#dynamic-winner-inputs').innerHTML = ''; // Limpiar
    } catch (error) {
      alert("Error saving award: " + error);
    }
  });

  // Eventos de los botones de Idol, Group, Membership...
  container.querySelector('#form-idol').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addIdol(new FormData(e.target).get('stageName'), null, null);
    e.target.reset(); populateData();
  });
  container.querySelector('#form-group').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addGroup(new FormData(e.target).get('groupName'), new FormData(e.target).get('groupType'), null);
    e.target.reset(); populateData();
  });
  container.querySelector('#form-membership').addEventListener('submit', async (e) => {
    e.preventDefault();
    await addMembership(new FormData(e.target).get('idolId'), new FormData(e.target).get('groupId'));
    e.target.reset();
  });

  // Botón Exportar
  container.querySelector('#btn-export').addEventListener('click', async () => {
    try {
      await exportDatabaseToJson();
      alert('Backup downloaded successfully!');
    } catch (err) {
      alert('Error exporting database: ' + err);
    }
  });

  // Input Restaurar
  container.querySelector('#file-restore').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm('WARNING: Restoring a backup will overwrite all current data in this browser. Do you wish to continue?')) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        await importDatabaseFromJson(event.target.result);
        alert('Database restored successfully! The page will reload.');
        window.location.reload();
      } catch (err) {
        alert('Failed to restore database. The file might be corrupted. Error: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  populateData();
  return container;
}