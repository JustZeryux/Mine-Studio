document.addEventListener('DOMContentLoaded', async () => {

    // ==========================================
    // 1. VARIABLES GLOBALES Y PLANTILLAS
    // ==========================================
    window.modConfigs = {}; 
    const urlParams = new URLSearchParams(window.location.search);
    const sharedPack = urlParams.get('pack');
    const initialMod = urlParams.get('mod'); // <-- Detecta URL directa
    window.modpackCart = [];
    window.modHistoryStack = []; // <-- Pila para el botón volver
    let currentFilter = 'mod';
    let currentCategory = '';
    let currentOffset = 0; 
    let isFetchingMods = false;

    // DEFINICIÓN DE PLANTILLAS OFICIALES
    window.modpackTemplates = [
        {
            name: "RPG Adventurer PRO",
            mcVersion: "1.20.1",
            modLoader: "forge",
            description: "Enfoque en mazmorras, exploración, misiones y combate avanzado.",
            modsData: ["waystones", "irons-spells-n-spellbooks", "epic-fight", "cataclysm", "dungeons-libraries", "twilight-forest", "blue-skies", "xaeros-minimap", "better-combat", "jei", "appleskin"]
        },
        {
            name: "Tech Master PRO",
            mcVersion: "1.20.1",
            modLoader: "forge",
            description: "Domina la automatización con Create, Mekanism y Refined Storage.",
            modsData: ["create", "mekanism", "cc-tweaked", "immersive-engineering", "refined-storage", "building-gadgets", "mouse-tweaks", "extremereactors", "powah", "jei"]
        },
        {
            name: "Optimization (Auto-Boost)",
            mcVersion: "1.20.1",
            modLoader: "fabric",
            description: "Solo para maximizar FPS y estabilidad. ¡Ideal para computadoras lentas!",
            modsData: ["sodium", "lithium", "iris", "ferrite-core", "entityculling", "clumps", "immediatelyfast", "indium"]
        },
        {
            name: "Vanilla+ Journeyman",
            mcVersion: "1.20.4",
            modLoader: "fabric",
            description: "Mejoras sutiles de calidad de vida sin cambiar la esencia del juego.",
            modsData: ["jei", "mouse-tweaks", "xaeros-minimap", "appleskin", "inventory-profiles-next", "litematica"]
        }
    ];

    // Elementos UI principales
    const searchInput = document.getElementById('mod-search-input');
    const sortSelect = document.getElementById('mod-sort-select');
    const versionSelect = document.getElementById('mod-version-select');
    const loaderSelect = document.getElementById('mod-loader-select');
    const modsGrid = document.getElementById('mods-grid');
    const btnLoadMore = document.getElementById('btn-load-more');
    const btnOpenSaveModal = document.getElementById('btn-open-save-modal');
    const authModal = document.getElementById('auth-modal');
    const btnTemplateRpg = document.getElementById('btn-template-rpg');
    const btnTemplateTech = document.getElementById('btn-template-tech');
    const btnFpsBoost = document.getElementById('btn-fps-boost');
    const btnRandomizer = document.getElementById('btn-randomizer'); 

    // ==========================================
    // BUSCADOR AUTOMÁTICO DE YOUTUBE SHOWCASES
    // ==========================================
    const YOUTUBE_API_KEY = 'AIzaSyCu35RupyXPEyADr7PLnZra_hT64UShEYw'; 

    async function loadModShowcase(modTitle) {
        const container = document.getElementById('detail-video-container');
        const iframe = document.getElementById('detail-video-iframe');
        const credit = document.getElementById('detail-video-credit');
        
        container.style.display = 'none';
        if(iframe) iframe.src = '';
        
        if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'TU_API_KEY_AQUI') return;

        try {
            const query = encodeURIComponent(`Minecraft mod ${modTitle} showcase tutorial`);
            const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${query}&type=video&key=${YOUTUBE_API_KEY}`);
            const data = await res.json();
            
            if (data.items && data.items.length > 0) {
                const video = data.items[0];
                if(iframe) iframe.src = `https://www.youtube.com/embed/${video.id.videoId}`;
                if(credit) credit.innerHTML = `Créditos del video: <strong style="color: white;"><i class="ph-fill ph-user"></i> ${video.snippet.channelTitle}</strong>`;
                container.style.display = 'block';
            }
        } catch (e) {
            console.error("Error cargando el video de YouTube:", e);
        }
    }

    // ==========================================
    // 3. NAVEGACIÓN Y VISTAS (Fix del bug de UI)
    // ==========================================
    const navButtons = document.querySelectorAll('.nav-btn');
    const views = { 
        'mods': document.getElementById('view-mods'), 
        'worlds': document.getElementById('view-worlds'), 
        'profiles': document.getElementById('view-profiles'),
        'community': document.getElementById('view-community'),
        'tools': document.getElementById('view-tools')
    };
    
    navButtons.forEach(btn => btn.addEventListener('click', () => {
        if(btn.id === 'btn-ai-builder' || btn.id === 'btn-ai-builder-mobile') return; 
        navButtons.forEach(b => b.classList.remove('active')); 
        btn.classList.add('active');
        
        Object.values(views).forEach(v => { if(v) v.classList.add('hidden') }); 
        if(views[btn.getAttribute('data-target')]) views[btn.getAttribute('data-target')].classList.remove('hidden');
        
        // Al navegar, escondemos la página del mod y borramos la URL y el historial
        const detailsPage = document.getElementById('view-mod-details-page');
        if (detailsPage) detailsPage.classList.add('hidden');
        window.modHistoryStack = [];
        const newUrl = new URL(window.location);
        newUrl.searchParams.delete('mod');
        window.history.pushState({}, '', newUrl);

        if (btn.getAttribute('data-target') === 'profiles') window.loadMyProfiles();
    }));

    // ==========================================
    // PLANTILLAS RAPIDAS
    // ==========================================
    const addToCartFromTemplate = async (templateName) => {
        const template = window.modpackTemplates.find(t => t.name.includes(templateName));
        if(!template) return;
        
        document.getElementById('mod-version-select').value = template.mcVersion;
        document.getElementById('mod-loader-select').value = template.modLoader;
        
        window.modpackCart = [];
        window.updateCartUI();
        
        for(let modId of template.modsData) {
            try {
                const res = await fetch(`https://api.modrinth.com/v2/project/${modId}`);
                if(res.ok) {
                    const mod = await res.json();
                    window.modpackCart.push({ id: mod.id, title: mod.title, type: 'mod', icon: mod.icon_url, categories: mod.display_categories });
                }
            } catch(e){}
        }
        window.updateCartUI();
        alert(`Plantilla ${templateName} cargada con éxito.`);
    };

    if(btnTemplateRpg) btnTemplateRpg.addEventListener('click', () => addToCartFromTemplate('RPG'));
    if(btnTemplateTech) btnTemplateTech.addEventListener('click', () => addToCartFromTemplate('Tech'));
    if(btnFpsBoost) btnFpsBoost.addEventListener('click', () => addToCartFromTemplate('Optimization'));

    // ==========================================
    // DETALLES DEL MOD (COMPLETO CON HISTORIAL)
    // ==========================================
    window.openModDetailsById = async function(modId, isPopState = false) {
        if (!modId || modId === 'undefined' || modId === 'null') return;

        if (!isPopState) {
            if (window.modHistoryStack[window.modHistoryStack.length - 1] !== modId) {
                window.modHistoryStack.push(modId);
            }
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('mod', modId);
            window.history.pushState({ mod: modId }, '', newUrl);
        }

        document.getElementById('view-mods').classList.add('hidden');
        
        let detailsPage = document.getElementById('view-mod-details-page');
        if (!detailsPage) {
            detailsPage = document.createElement('div');
            detailsPage.id = 'view-mod-details-page';
            detailsPage.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%; background: var(--bg-main); z-index: 50; display: flex; flex-direction: column; overflow-y: auto; border: none; margin: 0; padding: 0;';
            document.getElementById('dynamic-center-area').appendChild(detailsPage);
        }
        detailsPage.classList.remove('hidden');
        detailsPage.scrollTop = 0; 

        detailsPage.innerHTML = `
            <div class="mod-header-compact glass-panel fade-in-up" style="position: sticky; top: 0; z-index: 100; padding: 15px 40px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
                <div style="display: flex; align-items: center; gap: 24px; flex: 1;">
                    <button id="btn-back-to-mods" class="btn btn-secondary hover-scale" style="width: 45px; height: 45px; padding: 0; display: flex; justify-content: center; align-items: center; border-radius: 12px; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.1); cursor: pointer; transition: 0.2s;">
                        <i class="ph-bold ph-arrow-left" style="font-size: 1.2rem; color: #fff;"></i>
                    </button>
                    <img id="cf-icon" src="https://placehold.co/64x64/18181b/ffffff?text=M" style="width: 64px; height: 64px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); object-fit: cover; box-shadow: 0 4px 10px rgba(0,0,0,0.3); flex-shrink: 0;">
                    <div style="display: flex; flex-direction: column; justify-content: center;">
                        <h1 id="cf-title-main" style="margin: 0 0 4px 0; font-size: 1.5rem; font-weight: 800; color: #fff; line-height: 1;">Cargando...</h1>
                        <span style="color: var(--muted); font-size: 0.95rem;">Por <span id="cf-author" style="color: #10b981; font-weight: 600;">...</span></span>
                    </div>
                </div>
                <div id="cf-actions-header" style="display: flex; gap: 12px; align-items: center; flex-shrink: 0;">
                    <div style="color: var(--muted); font-size: 0.95rem;"><i class="ph ph-spinner ph-spin"></i> Cargando...</div>
                </div>
            </div>

            <div class="fade-in-up" style="display: flex; gap: 40px; max-width: 1600px; margin: 0 auto; width: 100%; padding: 30px 40px; position: relative; animation-delay: 0.1s;">
                <div style="flex: 1; display: flex; flex-direction: column; gap: 30px; padding-bottom: 40px;">
                    <div>
                        <h3 style="margin-top: 0; font-size: 1.3rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px;"><i class="ph-bold ph-file-text"></i> Descripción Oficial</h3>
                        <div id="cf-description" class="markdown-body" style="font-size: 1.05rem; line-height: 1.8; color: #e4e4e7;">
                            <div style="text-align:center; padding: 40px;"><i class="ph ph-spinner ph-spin" style="font-size: 30px; color: var(--accent);"></i></div>
                        </div>
                    </div>

                    <div id="jei-main-container" style="display: none; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 25px;">
                        <div id="jei-section-mobs" style="display: none; margin-bottom: 30px;">
                            <h3 style="color: #f59e0b; margin-top: 0; margin-bottom: 15px; display: flex; align-items: center; gap: 8px;"><i class="ph-bold ph-skull"></i> Entidades 3D</h3>
                            <div id="jei-mobs-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(65px, 1fr)); gap: 12px;"></div>
                        </div>

                        <div id="jei-section-items" style="display: none;">
                            <h3 style="color: #10b981; margin-top: 0; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 20px;"><i class="ph-bold ph-hammer"></i> Ítems y Crafteos</h3>
                            <div id="jei-items-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(55px, 1fr)); gap: 8px;"></div>
                            
                            <div id="jei-recipe-viewer" style="display: none; margin-top: 20px; background: rgba(0,0,0,0.4); padding: 15px; border-radius: 12px; border: 1px solid rgba(16,185,129,0.3);">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                    <h4 style="margin: 0; color: #10b981;"><i class="ph-bold ph-code"></i> Crafteo</h4>
                                    <button id="btn-close-recipe-dyn" style="background: none; border: none; color: #f87171; cursor: pointer; font-size: 1.3rem;"><i class="ph-bold ph-x"></i></button>
                                </div>
                                <div id="jei-recipe-content" class="custom-scrollbar" style="padding: 10px 0;"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="right-sidebar-sticky custom-scrollbar" style="width: 380px; flex-shrink: 0; display: flex; flex-direction: column; gap: 20px; padding-right: 10px;">
                    <div class="sidebar-panel panel glass-panel">
                        <h4 class="sidebar-title" style="color: #f87171;"><i class="ph-bold ph-youtube-logo"></i> Showcase</h4>
                        <div id="detail-video-container" style="display: none; flex-direction: column; gap: 15px;">
                            <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.1);">
                                <iframe id="detail-video-iframe" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border:0;" allowfullscreen></iframe>
                            </div>
                            <div id="detail-video-credit" style="font-size: 0.85rem; color: var(--muted); text-align: right;"></div>
                        </div>
                        <div id="no-video-msg" style="text-align:center; color: var(--muted); font-size: 0.95rem; padding: 10px 0;"><i class="ph ph-spinner ph-spin"></i> Buscando...</div>
                    </div>

                    <div class="sidebar-panel panel glass-panel">
                        <h4 class="sidebar-title" style="color: #a1a1aa;"><i class="ph-bold ph-books"></i> Librerías Necesarias</h4>
                        <div id="cf-dependencies" style="display: flex; flex-direction: column; gap: 10px;">
                            <div style="text-align:center; color: var(--muted);"><i class="ph ph-spinner ph-spin"></i> Escaneando...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-back-to-mods').addEventListener('click', () => {
            window.modHistoryStack.pop();
            const prevMod = window.modHistoryStack[window.modHistoryStack.length - 1];
            
            if (prevMod) {
                window.openModDetailsById(prevMod, true);
                const newUrl = new URL(window.location);
                newUrl.searchParams.set('mod', prevMod);
                window.history.pushState({ mod: prevMod }, '', newUrl);
            } else {
                const newUrl = new URL(window.location);
                newUrl.searchParams.delete('mod');
                window.history.pushState({}, '', newUrl);
                detailsPage.classList.add('hidden');
                document.getElementById('view-mods').classList.remove('hidden');
            }
        });

        let mod;
        try {
            const res = await fetch(`https://api.modrinth.com/v2/project/${modId}`);
            if(!res.ok) throw new Error("404");
            mod = await res.json();
        } catch (e) {
            document.getElementById('cf-description').innerHTML = "<p style='color:red;'>Error al cargar la información del mod.</p>";
            document.getElementById('cf-actions-header').innerHTML = "";
            return;
        }

        const iconUrl = mod.icon_url || 'https://placehold.co/150x150/18181b/ffffff?text=M';
        document.getElementById('cf-title-main').textContent = mod.title;
        document.getElementById('cf-author').textContent = mod.team || 'Independiente';
        document.getElementById('cf-icon').src = iconUrl;
        document.getElementById('cf-description').innerHTML = mod.body ? marked.parse(mod.body) : `<p>${mod.description}</p>`;

        const mcVers = document.getElementById('mod-version-select')?.value || "1.20.1";
        const loader = document.getElementById('mod-loader-select')?.value || "forge";
        let primaryFile = null, reqDeps = [];

        try {
            const versRes = await fetch(`https://api.modrinth.com/v2/project/${mod.id}/version?game_versions=["${mcVers}"]&loaders=["${loader}"]`);
            if (versRes.ok) {
                const versData = await versRes.json();
                if (versData.length > 0) {
                    primaryFile = versData[0].files.find(f => f.primary) || versData[0].files[0];
                    if(versData[0].dependencies) reqDeps = versData[0].dependencies.filter(d => d.dependency_type === 'required' && d.project_id);
                }
            }
        } catch(e) {}

        const isAdded = window.modpackCart.some(item => item.id === mod.id);
        const actionsDiv = document.getElementById('cf-actions-header');
        
        let downloadBtnHtml = primaryFile 
            ? `<a href="${primaryFile.url}" target="_blank" download class="btn hover-scale" style="padding: 10px 20px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; text-decoration: none; display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.95rem;"><i class="ph-bold ph-download-simple" style="font-size: 1.1rem;"></i> Descargar</a>`
            : `<button class="btn" disabled style="padding: 10px 20px; border-radius: 10px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #71717a; display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.95rem;"><i class="ph-bold ph-warning" style="font-size: 1.1rem;"></i> N/A</button>`;

        actionsDiv.innerHTML = `
            ${downloadBtnHtml}
            <button class="btn btn-add-cf hover-scale" ${isAdded ? 'disabled' : ''} style="padding: 10px 24px; border-radius: 10px; border: none; display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.95rem; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.2); ${isAdded ? 'background: #059669; color: white;' : 'background: linear-gradient(135deg, #10b981, #059669); color: white;'}">
                <i class="ph-bold ${isAdded ? 'ph-check' : 'ph-plus'}" style="font-size: 1.2rem;"></i> ${isAdded ? 'Agregado' : 'Agregar'}
            </button>
        `;
        
        actionsDiv.querySelector('.btn-add-cf')?.addEventListener('click', function() {
            if (!window.modpackCart.some(item => item.id === mod.id)) {
                window.modpackCart.push({ id: mod.id, title: mod.title, type: 'mod', icon: iconUrl, categories: mod.display_categories });
                window.updateCartUI();
                this.innerHTML = '<i class="ph-bold ph-check" style="font-size: 1.2rem;"></i> Agregado';
                this.style.background = '#059669';
                this.disabled = true;
            }
        });

        // LIBRERÍAS
        setTimeout(async () => {
            const depsContainer = document.getElementById('cf-dependencies');
            try {
                if (reqDeps.length > 0) {
                    const projectIds = reqDeps.map(d => d.project_id);
                    const depProjsRes = await fetch(`https://api.modrinth.com/v2/projects?ids=["${projectIds.join('","')}"]`);
                    const depProjs = await depProjsRes.json();
                    depsContainer.innerHTML = '';
                    depProjs.forEach(dep => {
                        const isDepAdded = window.modpackCart.some(item => item.id === dep.id);
                        depsContainer.innerHTML += `
                            <div class="hover-scale" style="display:flex; align-items:center; gap: 10px; background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; cursor:pointer;" onclick="window.openModDetailsById('${dep.id}')">
                                <img src="${dep.icon_url || 'https://placehold.co/36'}" style="width: 30px; height: 30px; border-radius: 6px;">
                                <div style="flex:1;">
                                    <div style="font-size: 0.9rem; font-weight: bold; color: #fff;">${dep.title}</div>
                                    <div style="font-size: 0.75rem; color: ${isDepAdded ? 'var(--success)' : 'var(--danger)'};">${isDepAdded ? 'Instalado' : 'Requerido'}</div>
                                </div>
                                <i class="ph-bold ph-arrow-right" style="color: var(--text-muted); font-size: 1.2rem;"></i>
                            </div>`;
                    });
                } else {
                    depsContainer.innerHTML = '<div style="color: #10b981; font-size: 0.9rem; text-align:center; background: rgba(16,185,129,0.1); padding: 10px; border-radius: 8px; border: 1px solid rgba(16,185,129,0.2);"><i class="ph-fill ph-check-circle"></i> Independiente.</div>';
                }
            } catch (e) { depsContainer.innerHTML = '<div style="color: #f87171; font-size: 0.9rem; text-align:center;">Error al cargar.</div>'; }
        }, 0);

        // YOUTUBE
        setTimeout(() => {
            const noVidMsg = document.getElementById('no-video-msg');
            loadModShowcase(mod.title).then(() => {
                if(document.getElementById('detail-video-container').style.display !== 'none') {
                    if(noVidMsg) noVidMsg.style.display = 'none';
                } else {
                    if(noVidMsg) noVidMsg.innerHTML = "No se encontró showcase oficial en YouTube.";
                }
            });
        }, 0);

        // JEI
        setTimeout(() => {
            if (typeof window.runAutoScanJEI === 'function') {
                try { window.runAutoScanJEI(mod.id, mcVers, loader); } 
                catch (e) { console.warn("Fallo JEI", e); }
            }
        }, 50);
    };

    // INICIO DIRECTO DESDE URL
    if (initialMod) {
        setTimeout(() => window.openModDetailsById(initialMod), 500);
    }

    // ==========================================
    // CARGAR MODS PRINCIPALES (GRID INICIAL)
    // ==========================================
    async function fetchRealMods(append = false) {
        isFetchingMods = true;
        const query = searchInput.value.trim();
        const sort = sortSelect.value;
        const version = versionSelect.value;
        const loader = loaderSelect.value;

        if (!append) {
            modsGrid.innerHTML = '<div class="muted-text text-center w-100" style="grid-column: 1/-1; padding: 40px;"><i class="ph ph-spinner ph-spin" style="font-size:32px;"></i><br>Buscando en Modrinth...</div>';
            currentOffset = 0;
        } else {
            btnLoadMore.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Cargando...';
        }

        let apiUrl = `https://api.modrinth.com/v2/search?limit=50&offset=${currentOffset}&index=${sort}`;
        let facets = [];

        if (currentFilter) facets.push(`["project_type:${currentFilter}"]`);
        if (currentCategory) facets.push(`["categories:${currentCategory}"]`);
        
        if (currentFilter !== 'shader' && currentFilter !== 'resourcepack') {
            facets.push(`["versions:${version}"]`);
            facets.push(`["categories:${loader}"]`);
        } else if (currentFilter === 'resourcepack') {
            facets.push(`["versions:${version}"]`);
        }

        if (facets.length > 0) apiUrl += `&facets=[${facets.join(',')}]`;
        if (query) apiUrl += `&query=${encodeURIComponent(query)}`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error("Error en la API de Modrinth");
            const data = await response.json();

            if (!append) modsGrid.innerHTML = '';

            if (data.hits && data.hits.length > 0) {
                data.hits.forEach(mod => {
                    const iconUrl = mod.icon_url || 'https://placehold.co/100x100/18181b/ffffff?text=M';
                    const author = mod.author || 'Desconocido';
                    const isAdded = window.modpackCart.some(item => item.id === mod.project_id);
                    
                    let typeBadge = '';
                    if (mod.project_type === 'mod') typeBadge = '<span class="badge badge-mod">MOD</span>';
                    else if (mod.project_type === 'resourcepack') typeBadge = '<span class="badge badge-resourcepack">TEXTURA</span>';
                    else if (mod.project_type === 'shader') typeBadge = '<span class="badge badge-shader">SHADER</span>';
                    else typeBadge = `<span class="badge" style="background: rgba(255,255,255,0.1);">${mod.project_type}</span>`;

                    const addBtnHtml = isAdded 
                        ? `<button class="btn btn-primary" style="padding: 6px 12px; background: var(--success);" disabled><i class="ph-bold ph-check"></i></button>`
                        : `<button class="btn btn-secondary btn-add-mod hover-scale" data-id="${mod.project_id}" data-title="${mod.title}" data-icon="${iconUrl}" data-type="${mod.project_type}" data-cats='${JSON.stringify(mod.categories || [])}' style="padding: 6px 12px; color: var(--accent); border-color: var(--accent);"><i class="ph-bold ph-plus"></i></button>`;

                    const card = document.createElement('div');
                    card.className = 'mod-card fade-in-up';
                    card.innerHTML = `
                        <div class="mod-card-header" onclick="window.openModDetailsById('${mod.project_id}')">
                            <img src="${iconUrl}" alt="${mod.title}" class="mod-icon">
                            <div class="mod-info-header">
                                <div class="mod-title" title="${mod.title}">${mod.title}</div>
                                <div class="mod-author">Por ${author}</div>
                            </div>
                        </div>
                        <div class="mod-desc" onclick="window.openModDetailsById('${mod.project_id}')">${mod.description}</div>
                        <div class="mod-meta">
                            <div class="mod-downloads">
                                <i class="ph-bold ph-download-simple"></i>
                                <span>${(mod.downloads / 1000000).toFixed(1)}M</span>
                            </div>
                            <div style="display: flex; gap: 10px; align-items: center;">
                                ${typeBadge}
                                ${addBtnHtml}
                            </div>
                        </div>
                    `;
                    modsGrid.appendChild(card);
                });

                document.querySelectorAll('.btn-add-mod').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation(); 
                        const id = btn.getAttribute('data-id');
                        const title = btn.getAttribute('data-title');
                        const icon = btn.getAttribute('data-icon');
                        const type = btn.getAttribute('data-type');
                        const cats = JSON.parse(btn.getAttribute('data-cats') || '[]');
                        
                        if (!window.modpackCart.some(item => item.id === id)) {
                            window.modpackCart.push({ id, title, icon, type, categories: cats });
                            window.updateCartUI();
                            
                            btn.innerHTML = '<i class="ph-bold ph-check"></i>';
                            btn.className = 'btn btn-primary btn-add-mod';
                            btn.style.background = 'var(--success)';
                            btn.disabled = true;
                        }
                    });
                });

                if (data.total_hits > currentOffset + 50) {
                    btnLoadMore.classList.remove('hidden');
                    btnLoadMore.innerHTML = '<i class="ph-bold ph-caret-down"></i> Cargar Más Resultados';
                } else {
                    btnLoadMore.classList.add('hidden');
                }
            } else {
                if (!append) modsGrid.innerHTML = '<div class="muted-text text-center w-100" style="grid-column: 1/-1; padding: 40px;">No se encontraron resultados.</div>';
                btnLoadMore.classList.add('hidden');
            }
        } catch (error) {
            console.error("Error fetching mods:", error);
            if (!append) modsGrid.innerHTML = '<div class="muted-text text-center w-100" style="grid-column: 1/-1; padding: 40px; color: var(--danger);">Error de conexión con Modrinth.</div>';
            btnLoadMore.classList.add('hidden');
        } finally {
            isFetchingMods = false;
        }
    }

    // EVENTOS DE BUSQUEDA
    let debounceTimer;
    searchInput.addEventListener('input', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => fetchRealMods(false), 500); });
    sortSelect.addEventListener('change', () => fetchRealMods(false));
    versionSelect.addEventListener('change', () => { window.updateCartUI(); fetchRealMods(false); });
    loaderSelect.addEventListener('change', () => { window.updateCartUI(); fetchRealMods(false); });
    btnLoadMore.addEventListener('click', () => { if(!isFetchingMods){ currentOffset += 50; fetchRealMods(true); } });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.getAttribute('data-filter');
            fetchRealMods(false);
        });
    });

    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentCategory = chip.getAttribute('data-cat');
            fetchRealMods(false);
        });
    });

    // ==========================================
    // ACTUALIZAR CARRITO
    // ==========================================
    window.updateCartUI = function() {
        const listMods = document.getElementById('cart-list-mods');
        const listRP = document.getElementById('cart-list-resourcepacks');
        const listShaders = document.getElementById('cart-list-shaders');
        const listLibs = document.getElementById('cart-list-libraries');
        const emptyMsg = document.getElementById('empty-cart-msg');
        const versionLabel = document.getElementById('cart-version-label');
        
        listMods.innerHTML = ''; listRP.innerHTML = ''; listShaders.innerHTML = ''; listLibs.innerHTML = '';
        versionLabel.textContent = `${versionSelect.value} ${loaderSelect.value.toUpperCase()}`;

        if (window.modpackCart.length === 0) {
            emptyMsg.style.display = 'block';
            btnOpenSaveModal.disabled = true;
            document.querySelectorAll('.cart-category-container').forEach(el => el.style.display = 'none');
            return;
        }

        emptyMsg.style.display = 'none';
        btnOpenSaveModal.disabled = false;
        document.querySelectorAll('.cart-category-container').forEach(el => el.style.display = 'block');

        let hasMods = false, hasRP = false, hasShaders = false, hasLibs = false;

        window.modpackCart.forEach((item, index) => {
            const li = document.createElement('li');
            li.className = 'cart-item fade-in-up';
            li.innerHTML = `
                <img src="${item.icon}" alt="icon" class="cart-item-icon">
                <div class="cart-item-info">
                    <div class="cart-item-title" title="${item.title}">${item.title}</div>
                </div>
                <button class="btn-icon-danger btn-remove-cart hover-scale" data-index="${index}"><i class="ph-bold ph-trash"></i></button>
            `;

            let type = item.type || 'mod';
            if (item.categories && item.categories.includes('library')) type = 'library';

            if (type === 'mod' || type === 'datapack') { listMods.appendChild(li); hasMods = true; }
            else if (type === 'resourcepack') { listRP.appendChild(li); hasRP = true; }
            else if (type === 'shader') { listShaders.appendChild(li); hasShaders = true; }
            else if (type === 'library') { listLibs.appendChild(li); hasLibs = true; }
            else { listMods.appendChild(li); hasMods = true; }
        });

        document.getElementById('cart-cat-mods').style.display = hasMods ? 'block' : 'none';
        document.getElementById('cart-cat-resourcepacks').style.display = hasRP ? 'block' : 'none';
        document.getElementById('cart-cat-shaders').style.display = hasShaders ? 'block' : 'none';
        document.getElementById('cart-cat-libraries').style.display = hasLibs ? 'block' : 'none';

        document.querySelectorAll('.btn-remove-cart').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(btn.getAttribute('data-index'));
                window.modpackCart.splice(idx, 1);
                window.updateCartUI();
                fetchRealMods(false); 
            });
        });
    };

    // INICIO
    fetchRealMods(false);
});
