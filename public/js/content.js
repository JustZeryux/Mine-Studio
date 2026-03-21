document.addEventListener('DOMContentLoaded', async () => {

    // ==========================================
    // CARGADOR DE ENLACES COMPARTIDOS (SERVERLESS SHARE)
    // ==========================================
    const urlParams = new URLSearchParams(window.location.search);
    const sharedPack = urlParams.get('pack');
    window.modpackCart = [];

    if (sharedPack) {
        try {
            const parsedCart = JSON.parse(atob(decodeURIComponent(sharedPack)));
            window.modpackCart = parsedCart;
            alert("✨ ¡Modpack compartido cargado con éxito en tu ensamblador!");
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch(e) { alert("El enlace del modpack compartido está dañado."); }
    }

    // AUTH
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const PRODUCCION_BACKEND_URL = ''; 
    const API_BASE_URL = isLocal ? 'http://localhost:3000' : PRODUCCION_BACKEND_URL;

    let currentUser = null;
    const profileSection = document.querySelector('.profile-section');
    const authModal = document.getElementById('auth-modal');

    const localUser = localStorage.getItem('usuario_token');
    if (localUser) currentUser = JSON.parse(localUser);

    if (profileSection) {
        if (!currentUser) {
            profileSection.innerHTML = `<button class="btn btn-primary" id="btn-trigger-login" style="padding: 6px 16px; border-radius: 20px; font-size: 0.9rem;"><i class="ph-bold ph-sign-in"></i> Iniciar Sesión</button>`;
            document.getElementById('btn-trigger-login').addEventListener('click', (e) => { e.preventDefault(); if(authModal) authModal.classList.remove('hidden'); });
        } else {
            profileSection.innerHTML = `<span id="header-username">${currentUser.username}</span><img src="${currentUser.avatar || `https://crafatar.com/avatars/${currentUser.username}?size=40`}" class="avatar"><button class="btn btn-text" id="btn-logout" style="padding: 4px; margin-left: 5px; color: var(--danger);"><i class="ph-bold ph-sign-out"></i></button>`;
            document.getElementById('btn-logout').addEventListener('click', () => { localStorage.removeItem('usuario_token'); window.location.reload(); });
        }
    }

    if(authModal) {
        document.getElementById('btn-fake-discord').addEventListener('click', () => { localStorage.setItem('usuario_token', JSON.stringify({username: 'Zeryux_Dev', avatar: 'https://crafatar.com/avatars/Zeryux?size=40'})); window.location.reload(); });
    }

    // NAVEGACIÓN
    const navButtons = document.querySelectorAll('.nav-btn');
    const views = { 'mods': document.getElementById('view-mods'), 'worlds': document.getElementById('view-worlds'), 'profiles': document.getElementById('view-profiles') };
    navButtons.forEach(btn => btn.addEventListener('click', () => {
        navButtons.forEach(b => b.classList.remove('active')); btn.classList.add('active');
        Object.values(views).forEach(v => v.classList.add('hidden')); views[btn.getAttribute('data-target')].classList.remove('hidden');
        if (btn.getAttribute('data-target') === 'profiles') loadMyProfiles();
    }));

    // VARIABLES API
    const searchInput = document.getElementById('mod-search-input');
    const sortSelect = document.getElementById('mod-sort-select');
    const versionSelect = document.getElementById('mod-version-select');
    const loaderSelect = document.getElementById('mod-loader-select');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const chips = document.querySelectorAll('.chip');
    const modsGrid = document.getElementById('mods-grid');
    const btnLoadMore = document.getElementById('btn-load-more');
    const cartList = document.getElementById('cart-list');
    const btnOpenSaveModal = document.getElementById('btn-open-save-modal');

    let currentFilter = 'mod', currentCategory = '', currentOffset = 0; 

    const updateSearch = () => {
        const cartLabel = document.getElementById('cart-version-label');
        if(cartLabel) cartLabel.textContent = `${versionSelect.value} ${loaderSelect.options[loaderSelect.selectedIndex].text}`;
        fetchRealMods(false);
    };

    chips.forEach(chip => { chip.addEventListener('click', (e) => { chips.forEach(c => c.classList.remove('active')); e.currentTarget.classList.add('active'); currentCategory = e.currentTarget.dataset.cat; updateSearch(); }); });
    const lightbox = document.getElementById('image-lightbox'); const lightboxImg = document.getElementById('lightbox-img');
    if(lightbox) lightbox.addEventListener('click', () => lightbox.classList.add('hidden'));

    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterButtons.forEach(b => b.classList.remove('active')); e.currentTarget.classList.add('active'); currentFilter = e.currentTarget.dataset.filter; 
            const chipsContainer = document.getElementById('category-chips-container');
            if(currentFilter === 'mod') { chipsContainer.style.display = 'flex'; } else { chipsContainer.style.display = 'none'; currentCategory = ""; chips.forEach(c => c.classList.remove('active')); }
            fetchRealMods(false);
        });
    });

    async function fetchRealMods(isAppend = false) {
        if (!isAppend) { currentOffset = 0; modsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 60px;"><i class="ph ph-spinner ph-spin" style="font-size: 40px;"></i><p>Buscando...</p></div>`; if(btnLoadMore) btnLoadMore.classList.add('hidden'); } 
        else { if(btnLoadMore) btnLoadMore.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Cargando...'; }
        try {
            let queryType = currentFilter === 'library' ? 'mod' : currentFilter;
            let facets = [[`versions:${versionSelect.value}`], [`project_type:${queryType}`]];
            if (queryType === 'mod') facets.push([`categories:${loaderSelect.value}`]);
            if (currentFilter === 'mod') { facets.push(["categories!=library"]); if (currentCategory !== "") facets.push([`categories:${currentCategory}`]); } 
            else if (currentFilter === 'library') { facets.push(["categories:library"]); }

            const res = await fetch(`https://api.modrinth.com/v2/search?query=${searchInput.value}&facets=${encodeURIComponent(JSON.stringify(facets))}&index=${sortSelect.value}&limit=16&offset=${currentOffset}`);
            const data = await res.json();
            if (!isAppend) modsGrid.innerHTML = '';
            if (data.hits.length === 0 && !isAppend) { modsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px;">No se encontraron resultados.</div>'; } 
            else {
                renderRealMods(data.hits);
                if(data.hits.length === 16) { if(btnLoadMore) { btnLoadMore.classList.remove('hidden'); btnLoadMore.innerHTML = '<i class="ph-bold ph-caret-down"></i> Cargar Más'; } } 
                else { if(btnLoadMore) btnLoadMore.classList.add('hidden'); }
            }
        } catch (error) { if(!isAppend) modsGrid.innerHTML = '<div style="grid-column: 1/-1; color: var(--danger); text-align:center;">Error de API.</div>'; }
    }

    function renderRealMods(mods) {
        mods.forEach(mod => {
            const card = document.createElement('div'); card.className = 'mod-card';
            const isAdded = window.modpackCart.some(item => item.id === mod.project_id);
            card.innerHTML = `
                <div class="mod-banner" style="background-image: url('${(mod.gallery && mod.gallery[0]) ? mod.gallery[0] : 'https://via.placeholder.com/400'}'); pointer-events: none;"></div>
                <div class="mod-info" style="pointer-events: none; padding-bottom: 10px;">
                    <img src="${mod.icon_url || 'https://via.placeholder.com/80'}" class="mod-avatar">
                    <h3 class="mod-title">${mod.title}</h3>
                    <p class="mod-desc">${mod.description.substring(0, 60)}...</p>
                </div>
                <div style="padding: 0 10px 10px 10px; z-index: 10; margin-top: auto;">
                    <button class="btn btn-primary w-100 btn-add-mod" data-id="${mod.project_id}" data-title="${mod.title}" data-type="${mod.project_type}" ${isAdded ? 'disabled' : ''} style="${isAdded ? 'background: var(--success); color: white;' : ''}">
                        <i class="ph-bold ${isAdded ? 'ph-check' : 'ph-plus'}"></i> ${isAdded ? 'Añadido' : 'Añadir'}
                    </button>
                </div>
            `;

            const addBtn = card.querySelector('.btn-add-mod');
            addBtn.addEventListener('click', async function(e) {
                e.stopPropagation(); 
                const originalHtml = this.innerHTML; this.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Analizando...'; this.disabled = true;

                if (this.dataset.type === 'mod') {
                    try {
                        const versRes = await fetch(`https://api.modrinth.com/v2/project/${this.dataset.id}/version?game_versions=["${versionSelect.value}"]&loaders=["${loaderSelect.value}"]`);
                        const versData = await versRes.json();
                        
                        if (versData.length > 0) {
                            // 🚀 NUEVO: ANALIZADOR DE COMPATIBILIDAD (Evita crasheos)
                            const incompDeps = versData[0].dependencies.filter(d => d.dependency_type === 'incompatible' && d.project_id);
                            const conflict = incompDeps.find(dep => window.modpackCart.some(item => item.id === dep.project_id));
                            
                            if(conflict) {
                                const conflictingItem = window.modpackCart.find(item => item.id === conflict.project_id);
                                alert(`🚨 ALERTA DE CRASHEO:\nEste mod es incompatible con "${conflictingItem.title}" que ya está en tu carrito.\n\nPara proteger tu modpack, no puedes añadir ambos.`);
                                this.innerHTML = originalHtml; this.disabled = false; return;
                            }

                            // Chequeo de Dependencias Requeridas
                            const requiredDeps = versData[0].dependencies.filter(d => d.dependency_type === 'required' && d.project_id);
                            if (requiredDeps.length > 0) {
                                const depProjsRes = await fetch(`https://api.modrinth.com/v2/projects?ids=["${requiredDeps.map(d => d.project_id).join('","')}"]`);
                                const deps = await depProjsRes.json();
                                const missingDeps = deps.filter(dep => !window.modpackCart.some(item => item.id === dep.id));
                                if (missingDeps.length > 0) {
                                    showEpicDepsModal({ id: this.dataset.id, title: this.dataset.title, type: this.dataset.type }, missingDeps, this);
                                    this.innerHTML = originalHtml; this.disabled = false; return; 
                                }
                            }
                        }
                    } catch(e) {}
                }

                window.modpackCart.push({ id: this.dataset.id, title: this.dataset.title, type: this.dataset.type });
                window.updateCartUI();
                this.innerHTML = '<i class="ph-bold ph-check"></i> Añadido'; this.style.background = 'var(--success)'; this.style.color = 'white';
            });
            modsGrid.appendChild(card);
        });
    }

    function showEpicDepsModal(mainMod, missingDeps, triggerButton) {
        const modal = document.getElementById('epic-deps-modal'); document.getElementById('epic-mod-name').textContent = mainMod.title;
        const list = document.getElementById('epic-deps-list'); list.innerHTML = '';
        missingDeps.forEach((p) => { list.innerHTML += `<div class="tilt-wrapper" style="margin-bottom: 10px;"><div class="tilt-card" style="background: var(--bg-main);"><img src="${p.icon_url || 'https://via.placeholder.com/40'}" alt="icon"><div class="dep-info" style="text-align: left;"><h4>${p.title}</h4></div></div></div>`; });

        document.getElementById('btn-epic-add-all').onclick = () => {
            if (!window.modpackCart.some(item => item.id === mainMod.id)) window.modpackCart.push({ id: mainMod.id, title: mainMod.title, type: mainMod.type || 'mod' });
            missingDeps.forEach(dep => { if (!window.modpackCart.some(item => item.id === dep.id)) window.modpackCart.push({ id: dep.id, title: dep.title, type: 'mod' }); });
            window.updateCartUI();
            if(triggerButton) { triggerButton.innerHTML = '<i class="ph-bold ph-check"></i> Añadido'; triggerButton.style.background = 'var(--success)'; triggerButton.disabled = true; }
            modal.classList.add('hidden');
        };
        modal.classList.remove('hidden');
    }

    // ==========================================
    // PLANTILLAS BASE & AUTO-INSTALLERS
    // ==========================================
    async function installTemplate(slugs, buttonId, text) {
        const btn = document.getElementById(buttonId);
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Cargando...'; btn.disabled = true;
        let añadidos = 0;
        for (const slug of slugs) {
            try {
                const res = await fetch(`https://api.modrinth.com/v2/project/${slug}`);
                if (res.ok) {
                    const modData = await res.json();
                    if (!window.modpackCart.some(item => item.id === modData.id)) { window.modpackCart.push({ id: modData.id, title: modData.title, type: 'mod' }); añadidos++; }
                }
            } catch(e) {}
        }
        window.updateCartUI();
        btn.innerHTML = text; btn.disabled = false;
        if(añadidos > 0) alert(`Se añadieron ${añadidos} mods de la plantilla.`);
    }

    document.getElementById('btn-template-rpg')?.addEventListener('click', () => installTemplate(['better-combat', 'waystones', 'farmers-delight', 'appleskin'], 'btn-template-rpg', '<i class="ph-bold ph-sword"></i> Plantilla RPG'));
    document.getElementById('btn-template-tech')?.addEventListener('click', () => installTemplate(['create', 'jei', 'mouse-tweaks', 'jade'], 'btn-template-tech', '<i class="ph-bold ph-gear"></i> Plantilla Técnica'));
    document.getElementById('btn-fps-boost')?.addEventListener('click', () => { const btn = document.getElementById('btn-fps-boost'); installTemplate(['sodium', 'lithium', 'ferrite-core', 'entityculling'], 'btn-fps-boost', '<i class="ph-bold ph-rocket"></i> Instalar Pack de Optimización (Boost FPS)'); });

    // VISOR DE SKINS 3D
    const btnLoadSkin = document.getElementById('btn-load-skin'); const inputSkin = document.getElementById('mc-skin-input'); const imgSkinPreview = document.getElementById('mc-skin-preview');
    if (btnLoadSkin && inputSkin && imgSkinPreview) {
        btnLoadSkin.addEventListener('click', () => {
            const username = inputSkin.value.trim(); if (!username) return;
            imgSkinPreview.style.opacity = '0.5';
            const skinUrl = `https://crafatar.com/renders/body/${username}?overlay=true`;
            const tempImg = new Image();
            tempImg.onload = () => { imgSkinPreview.src = skinUrl; imgSkinPreview.style.opacity = '1'; localStorage.setItem('minepack_username', username); };
            tempImg.onerror = () => { alert('Cuenta premium no encontrada.'); imgSkinPreview.style.opacity = '1'; };
            tempImg.src = skinUrl;
        });
        const savedName = localStorage.getItem('minepack_username');
        if (savedName) { inputSkin.value = savedName; imgSkinPreview.src = `https://crafatar.com/renders/body/${savedName}?overlay=true`; }
    }

    // UI CARRITO Y RECOMENDACIONES
    const recommendedMods = [ { id: '1eAoo2KR', title: 'JEI', type: 'mod' }, { id: 'mOgUt4GM', title: 'Mod Menu', type: 'mod' }, { id: 'yM94ont6', title: 'Jade 🔍', type: 'mod' } ];

    window.updateCartUI = function() {
        cartList.innerHTML = '';
        const recBox = document.getElementById('recommendations-box'); const recItem = document.getElementById('rec-item');
        if (window.modpackCart.length === 0) {
            document.getElementById('empty-cart-msg').style.display = 'block';
            if(btnOpenSaveModal) btnOpenSaveModal.disabled = true; 
            if(recBox) recBox.style.display = 'none';
        } else {
            document.getElementById('empty-cart-msg').style.display = 'none';
            if(btnOpenSaveModal) btnOpenSaveModal.disabled = false;

            window.modpackCart.forEach((item, index) => {
                const li = document.createElement('li'); li.className = `cart-item`; 
                let iconClass = 'ph-puzzle-piece', typeColor = 'var(--accent)', typeText = 'Mod';
                if(item.type === 'resourcepack') { iconClass = 'ph-paint-brush'; typeColor = '#10b981'; typeText = 'Textura'; } else if(item.type === 'shader') { iconClass = 'ph-aperture'; typeColor = '#f59e0b'; typeText = 'Shader'; }
                
                li.innerHTML = `
                    <div class="cart-item-info" style="display:flex; align-items:center; gap:12px; overflow:hidden;">
                        <div class="cart-item-icon" style="width:32px; height:32px; border-radius:6px; display:flex; justify-content:center; align-items:center; color: ${typeColor}; background: ${typeColor}20;">
                            <i class="ph-fill ${iconClass}" style="font-size: 1.2rem;"></i>
                        </div>
                        <div class="cart-item-text" style="display:flex; flex-direction:column;">
                            <span class="cart-item-title" style="font-weight:600; font-size:0.85rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px;" title="${item.title}">${item.title}</span>
                            <span class="cart-item-type" style="font-size:0.65rem; color:${typeColor}; text-transform:uppercase; font-weight:700;">${typeText}</span>
                        </div>
                    </div>
                    <button class="btn-remove" data-index="${index}" style="background:transparent; border:none; color:var(--danger); cursor:pointer;"><i class="ph-bold ph-trash"></i></button>
                `;
                cartList.appendChild(li);
            });

            document.querySelectorAll('.btn-remove').forEach(btn => btn.addEventListener('click', function() { window.modpackCart.splice(this.dataset.index, 1); window.updateCartUI(); fetchRealMods(false); }));

            if (recBox && recItem) {
                const availableRecs = recommendedMods.filter(rm => !window.modpackCart.some(cm => cm.id === rm.id));
                if (availableRecs.length > 0) {
                    const rec = availableRecs[Math.floor(Math.random() * availableRecs.length)];
                    recItem.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 0.85rem; font-weight: bold;">${rec.title}</span><button class="btn btn-primary btn-add-rec" data-id="${rec.id}" data-title="${rec.title}" data-type="${rec.type}" style="padding: 4px 8px; font-size: 0.75rem;"><i class="ph-bold ph-plus"></i></button></div>`;
                    recBox.style.display = 'block';
                    recItem.querySelector('.btn-add-rec').addEventListener('click', function() { window.modpackCart.push({ id: this.dataset.id, title: this.dataset.title, type: this.dataset.type }); window.updateCartUI(); });
                } else { recBox.style.display = 'none'; }
            }
        }
        const mobileBtn = document.getElementById('mobile-cart-toggle-btn'); if(mobileBtn) mobileBtn.innerHTML = `<i class="ph-bold ph-package"></i> <span class="badge">${window.modpackCart.length}</span>`;
    };

    window.loadMyProfiles = async function() {
        const grid = document.getElementById('profiles-grid'); if(!grid) return;
        const profiles = JSON.parse(localStorage.getItem('mis_modpacks_guardados') || '[]');
        if (profiles.length === 0) { grid.innerHTML = '<div style="text-align:center; padding:40px; color:var(--muted);"><i class="ph-duotone ph-ghost" style="font-size:50px;"></i><p>Aún no has guardado ningún Modpack.</p></div>'; return; }

        grid.innerHTML = '';
        profiles.forEach((p, index) => {
            const modsCount = p.modsData ? p.modsData.length : 0;
            grid.innerHTML += `
                <div class="profile-card panel" style="padding: 15px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                        <div style="font-size: 1.2rem; display: flex; align-items: center; gap: 10px;"><i class="ph-fill ph-package" style="color:var(--accent);"></i> ${p.name}</div>
                        <div>
                            <button class="btn btn-secondary btn-share-profile" data-index="${index}" style="padding:5px;" title="Copiar Enlace"><i class="ph-bold ph-link"></i></button>
                            <button class="btn btn-text btn-delete-profile" data-index="${index}" style="color:var(--danger); padding:5px;" title="Eliminar"><i class="ph-bold ph-trash"></i></button>
                        </div>
                    </div>
                    <div style="display: flex; gap: 15px; margin-top: 10px; margin-bottom: 10px;">
                        <span style="background: rgba(0,0,0,0.2); padding: 5px 10px; border-radius: 6px; font-size: 0.8rem; color: var(--success);"><i class="ph-bold ph-game-controller"></i> ${p.mcVersion}</span>
                        <span style="background: rgba(0,0,0,0.2); padding: 5px 10px; border-radius: 6px; font-size: 0.8rem;"><i class="ph-bold ph-puzzle-piece"></i> ${modsCount} Items</span>
                    </div>
                    <button class="btn btn-secondary btn-edit-profile w-100" data-index="${index}"><i class="ph-bold ph-pencil-simple"></i> Cargar al Ensamblador</button>
                </div>
            `;
        });

        document.querySelectorAll('.btn-share-profile').forEach(btn => btn.addEventListener('click', (e) => {
            const dataStr = encodeURIComponent(btoa(JSON.stringify(profiles[e.currentTarget.dataset.index].modsData)));
            navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?pack=${dataStr}`);
            alert("🔗 ¡Enlace copiado! Envíalo a tus amigos para que clonen este pack.");
        }));
        document.querySelectorAll('.btn-delete-profile').forEach(btn => btn.addEventListener('click', (e) => {
            if(confirm("¿Seguro que quieres eliminar este perfil?")) { profiles.splice(e.currentTarget.dataset.index, 1); localStorage.setItem('mis_modpacks_guardados', JSON.stringify(profiles)); window.loadMyProfiles(); }
        }));
        document.querySelectorAll('.btn-edit-profile').forEach(btn => btn.addEventListener('click', (e) => {
            const profile = profiles[e.currentTarget.dataset.index]; window.modpackCart = profile.modsData; versionSelect.value = profile.mcVersion; loaderSelect.value = profile.modLoader; window.updateCartUI(); document.querySelector('.nav-btn[data-target="mods"]').click(); updateSearch();
        }));
    };

    // ==========================================
    // EXPORTACIÓN CON CREADOR DE "SERVER PACK"
    // ==========================================
    const modalSave = document.getElementById('save-pack-modal');
    const btnJustDownload = document.getElementById('btn-just-download');
    const btnSaveAndDownload = document.getElementById('btn-confirm-save-download');
    const packNameInput = document.getElementById('pack-name-input');
    
    if(btnOpenSaveModal) btnOpenSaveModal.addEventListener('click', () => { document.querySelector('.cart-panel').classList.remove('active-mobile'); modalSave.classList.remove('hidden'); });

    async function requestBuild(isSaving = false) {
        if (isSaving && !currentUser) { alert('Necesitas Iniciar Sesión para guardar perfiles.'); if(authModal) authModal.classList.remove('hidden'); modalSave.classList.add('hidden'); return; }

        try {
            const packName = (packNameInput && packNameInput.value.trim() !== '') ? packNameInput.value.trim() : 'Mi_Modpack';
            const btn = isSaving ? btnSaveAndDownload : btnJustDownload;
            const mcVersion = versionSelect.value;
            const loader = loaderSelect.value;
            
            // 🚀 NUEVO: VERIFICA SI QUIERE SERVER PACK
            const isServerPack = document.getElementById('export-server-pack')?.checked;
            
            if(btn) { btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Procesando...'; btn.disabled = true; }

            if (isSaving) {
                const profiles = JSON.parse(localStorage.getItem('mis_modpacks_guardados') || '[]');
                profiles.push({ name: packName, mcVersion: mcVersion, modLoader: loader, modsData: window.modpackCart });
                localStorage.setItem('mis_modpacks_guardados', JSON.stringify(profiles)); window.loadMyProfiles();
            }

            if (typeof JSZip === 'undefined') throw new Error("Falta JSZip.");
            const zip = new JSZip();
            const modsFolder = zip.folder("mods");
            const shadersFolder = zip.folder("shaderpacks");
            const resourceFolder = zip.folder("resourcepacks");

            const wGamemode = document.getElementById('world-gamemode')?.value || 'survival';
            const wDifficulty = document.getElementById('world-difficulty')?.value || 'normal';
            const wStructures = document.getElementById('world-structures')?.checked ? 'true' : 'false';
            const wSeed = document.getElementById('world-seed-input')?.value;

            let propsContent = `# Archivo generado por MinePack Studio\ngamemode=${wGamemode}\ndifficulty=${wDifficulty}\ngenerate-structures=${wStructures}\n`;
            if (wSeed && wSeed.trim() !== '') propsContent += `level-seed=${wSeed}\n`;
            zip.file("server.properties", propsContent);

            // 🚀 NUEVO: INYECTAR ARCHIVOS DE SERVER SI ESTÁ ACTIVADO
            if (isServerPack) {
                zip.file("eula.txt", "eula=true\n");
                zip.file("start.bat", "@echo off\necho INICIANDO SERVIDOR MINEPACK...\njava -Xmx4G -Xms4G -jar server.jar nogui\npause");
                zip.file("start.sh", "#!/bin/bash\necho INICIANDO SERVIDOR MINEPACK...\njava -Xmx4G -Xms4G -jar server.jar nogui");
            }

            for (let i = 0; i < window.modpackCart.length; i++) {
                const item = window.modpackCart[i];
                if(btn) btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Descargando (${i+1}/${window.modpackCart.length})...`;

                // 🚀 NUEVO: SI ES SERVER PACK, IGNORAR MODS VISUALES
                if (isServerPack) {
                    if (item.type === 'shader' || item.type === 'resourcepack') continue;
                    
                    try {
                        const projRes = await fetch(`https://api.modrinth.com/v2/project/${item.id}`);
                        const projData = await projRes.json();
                        if (projData.server_side === 'unsupported') {
                            console.log(`Excluido del Server Pack (Solo Cliente): ${item.title}`);
                            continue; // Saltar mods que crashean servidores (ej. Minimapas, Iris)
                        }
                    } catch(e) {}
                }

                const versRes = await fetch(`https://api.modrinth.com/v2/project/${item.id}/version?game_versions=["${mcVersion}"]`);
                const versData = await versRes.json();

                if (versData && versData.length > 0 && versData[0].files.length > 0) {
                    const fileObj = versData[0].files.find(f => f.primary) || versData[0].files[0];
                    const fileRes = await fetch(fileObj.url);
                    const fileBlob = await fileRes.blob();
                    
                    if (!isServerPack && item.type === 'shader') shadersFolder.file(fileObj.filename, fileBlob);
                    else if (!isServerPack && item.type === 'resourcepack') resourceFolder.file(fileObj.filename, fileBlob);
                    else modsFolder.file(fileObj.filename, fileBlob);
                }
            }

            if(btn) btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Empaquetando ZIP...';
            const zipContent = await zip.generateAsync({ type: "blob" });

            const url = window.URL.createObjectURL(zipContent);
            const a = document.createElement('a'); a.style.display = 'none'; a.href = url;
            a.download = `${packName.replace(/\s+/g, '_')}${isServerPack ? '_SERVER' : ''}_${mcVersion}.zip`;
            document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url);
            
            modalSave.classList.add('hidden');
            
        } catch (error) {
            alert("Error al descargar: " + error.message);
        } finally {
            if(btnJustDownload) { btnJustDownload.innerHTML = 'Solo Descargar'; btnJustDownload.disabled = false; }
            if(btnSaveAndDownload) { btnSaveAndDownload.innerHTML = 'Guardar y Exportar'; btnSaveAndDownload.disabled = false; }
        }
    }

    if(btnJustDownload) btnJustDownload.addEventListener('click', () => requestBuild(false));
    if(btnSaveAndDownload) btnSaveAndDownload.addEventListener('click', () => requestBuild(true));

    sortSelect.addEventListener('change', updateSearch); versionSelect.addEventListener('change', updateSearch); loaderSelect.addEventListener('change', updateSearch);
    let timeout = null; searchInput.addEventListener('input', () => { clearTimeout(timeout); timeout = setTimeout(updateSearch, 600); });
    if(btnLoadMore) btnLoadMore.addEventListener('click', () => { currentOffset += 16; fetchRealMods(true); });

    updateSearch();
    if(window.modpackCart.length > 0) window.updateCartUI();

    const mobileBtn = document.createElement('button'); mobileBtn.id = 'mobile-cart-toggle-btn'; mobileBtn.className = 'mobile-cart-toggle hidden-desktop'; mobileBtn.innerHTML = `<i class="ph-bold ph-package"></i> <span class="badge">0</span>`; document.body.appendChild(mobileBtn);
    mobileBtn.addEventListener('click', () => { const cart = document.querySelector('.cart-panel'); cart.classList.toggle('active-mobile'); mobileBtn.innerHTML = cart.classList.contains('active-mobile') ? `<i class="ph-bold ph-x"></i>` : `<i class="ph-bold ph-package"></i> <span class="badge">${window.modpackCart.length}</span>`; });
});
