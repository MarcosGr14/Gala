import { getAllSeasons, getPopulatedAwardsBySeason } from '../services/awardService.js';

export async function renderGala() {
  const container = document.createElement('div');
  container.style.padding = 'var(--spacing-xl)';
  container.style.maxWidth = '800px';
  container.style.margin = '0 auto';
  container.style.textAlign = 'center';

  // 1. PANTALLA DE SELECCIÓN DE TEMPORADA
  const seasons = await getAllSeasons();
  
  let selectionHtml = `
    <h1 style="font-family: var(--font-display); color: var(--color-primary); font-size: 3em;">Gala Mode</h1>
    <p style="color: var(--text-secondary); margin-bottom: var(--spacing-xl);">Select a season to start the presentation</p>
    <div style="display: flex; flex-direction: column; gap: var(--spacing-md);">
  `;

  seasons.forEach(season => {
    selectionHtml += `
      <button class="start-gala-btn" data-id="${season.id}" style="background: var(--color-surface); border: 2px solid var(--color-secondary); padding: 20px; font-size: 1.5em; font-family: var(--font-display); border-radius: var(--radius-card); cursor: pointer; transition: transform 0.2s;">
        ▶ PRESENT ${season.title.toUpperCase()}
      </button>
    `;
  });
  selectionHtml += `</div>`;
  container.innerHTML = selectionHtml;

  // 2. LÓGICA DE LA PRESENTACIÓN (FULLSCREEN)
  container.querySelectorAll('.start-gala-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const seasonId = e.target.dataset.id;
      const awards = await getPopulatedAwardsBySeason(seasonId);

      if (awards.length === 0) {
        alert("No awards registered for this season yet!");
        return;
      }

      startPresentation(awards);
    });
  });

  function startPresentation(awards) {
    let currentAwardIndex = 0;
    let step = 0; // 0: Categoria, 1: And the winner is, 2: Ganador

    // Crear el contenedor de pantalla completa
    const stage = document.createElement('div');
    stage.style.position = 'fixed';
    stage.style.top = '0'; stage.style.left = '0';
    stage.style.width = '100vw'; stage.style.height = '100vh';
    stage.style.backgroundColor = '#0b0b0b';
    stage.style.color = '#fff';
    stage.style.zIndex = '9999';
    stage.style.display = 'flex';
    stage.style.flexDirection = 'column';
    stage.style.justifyContent = 'center';
    stage.style.alignItems = 'center';
    stage.style.transition = 'all 0.5s ease';
    document.body.appendChild(stage);

    // Intentar abrir en Fullscreen real
    if (stage.requestFullscreen) stage.requestFullscreen();

    // Controles ocultos en la pantalla
    const renderSlide = () => {
      const award = awards[currentAwardIndex];
      const isDaesang = award.category.tier === 'daesang';
      const accent = isDaesang ? 'var(--color-daesang-accent)' : 'var(--color-primary)';
      
      let slideHtml = '';

      if (step === 0) {
        // CATEGORÍA
        slideHtml = `
          <h3 style="color: #888; letter-spacing: 5px; font-size: 1.5em; margin-bottom: 20px; text-transform: uppercase;">Category</h3>
          <h1 style="font-family: var(--font-display); font-size: 5em; color: ${accent}; text-align: center; margin: 0; text-shadow: 0 0 40px ${isDaesang ? 'rgba(212,175,55,0.3)' : 'rgba(209,77,114,0.3)'};">
            ${award.category.displayName}
          </h1>
        `;
      } else if (step === 1) {
        // SUSPENSO
        slideHtml = `
          <h1 style="font-family: var(--font-display); font-size: 4em; font-style: italic; opacity: 0; animation: fadeIn 2s forwards;">
            And the winner is...
          </h1>
        `;
      } else if (step === 2) {
        // REVELACIÓN
        const winnersNames = award.winners.map(w => w.stageName || w.name).join(' & ');
        const winnerPhotos = award.winners.map(w => `
          <div style="width: 300px; height: 300px; border-radius: ${award.winnerType === 'idol' ? '50%' : 'var(--radius-lg)'}; background-image: url('${w.photo}'); background-size: cover; background-position: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); border: 4px solid ${accent};"></div>
        `).join('');

        slideHtml = `
          <div style="display: flex; gap: 40px; margin-bottom: 40px; opacity: 0; animation: zoomIn 1s forwards;">
            ${winnerPhotos}
          </div>
          <h2 style="font-family: var(--font-display); font-size: 6em; margin: 0; color: #fff; text-shadow: 0 0 30px ${accent}; opacity: 0; animation: slideUp 1s 0.5s forwards;">
            ${winnersNames}
          </h2>
          ${isDaesang ? `<h3 style="color: ${accent}; font-family: var(--font-display); letter-spacing: 10px; margin-top: 20px; animation: slideUp 1s 1s forwards; opacity: 0;">DAESANG WINNER</h3>` : ''}
        `;
      }

      // Estilos de animación inyectados
      slideHtml += `
        <style>
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes zoomIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          @keyframes slideUp { from { transform: translateY(30px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        </style>
        
        <!-- Controles invisibles flotantes -->
        <div style="position: absolute; bottom: 20px; right: 20px; display: flex; gap: 10px;">
          <button id="btn-prev" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 10px 20px; cursor: pointer; border-radius: 5px;">PREV</button>
          <button id="btn-next" style="background: ${accent}; border: none; color: ${isDaesang ? '#000' : '#fff'}; font-weight: bold; padding: 10px 30px; cursor: pointer; border-radius: 5px;">NEXT ▶</button>
        </div>
        <button id="btn-exit" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: #888; cursor: pointer; font-size: 1.2em;">✖ EXIT</button>
      `;

      stage.innerHTML = slideHtml;

      // Eventos de botones
      stage.querySelector('#btn-next').addEventListener('click', () => {
        if (step < 2) {
          step++; // Avanzar paso de la presentación
        } else {
          // Si ya revelamos, pasar al siguiente premio
          if (currentAwardIndex < awards.length - 1) {
            currentAwardIndex++;
            step = 0;
          } else {
            alert("End of the Gala!");
            exitGala();
          }
        }
        renderSlide();
      });

      stage.querySelector('#btn-prev').addEventListener('click', () => {
        if (step > 0) {
          step--;
        } else if (currentAwardIndex > 0) {
          currentAwardIndex--;
          step = 2;
        }
        renderSlide();
      });

      stage.querySelector('#btn-exit').addEventListener('click', exitGala);
    };

    const exitGala = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      stage.remove();
    };

    // Soporte para teclado (Flechas)
    document.addEventListener('keydown', function keyHandler(e) {
      if (!document.body.contains(stage)) {
        document.removeEventListener('keydown', keyHandler);
        return;
      }
      if (e.key === 'ArrowRight') stage.querySelector('#btn-next').click();
      if (e.key === 'ArrowLeft') stage.querySelector('#btn-prev').click();
      if (e.key === 'Escape') exitGala();
    });

    // Iniciar
    renderSlide();
  }

  return container;
}