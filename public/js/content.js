document.addEventListener('DOMContentLoaded', async () => {

    // ==========================================
    // VARIABLES GLOBALES (AGREGADAS: modConfigs Y SHARE)
    // ==========================================
    window.modConfigs = {}; // Almacena configuraciones del usuario
    const urlParams = new URLSearchParams(window.location.search);
    const sharedPack = urlParams.get('pack');
    window.modpackCart = [];

    if (sharedPack) {
        try {
            window.modpackCart = JSON.parse(atob(decodeURIComponent(sharedPack)));
            alert("✨ ¡Modpack compartido cargado con éxito en tu ensamblador!");
            window.history.replaceState({}, document.title, window.location.pathname);
        } catch(e) {}
    }

    // ==========================================
    // 0. SISTEMA DE SESIÓN 100% FRONTEND (MÓDULOS)
    // ==========================================
    const isLoggedIn = localStorage.getItem('usuario_token'); 
    const profileSection = document.querySelector('.profile-section');
    const authModal = document.getElementById('auth-modal');

    if (profileSection) {
        if (!isLoggedIn) {
            profileSection.innerHTML = `
                <button class="btn btn-primary" id="btn-trigger-login" style="padding: 6px 16px; border-radius: 20px; font-size: 0.9rem;">
                    <i class="ph-bold ph-sign-in"></i> Iniciar Sesión
                </button>
            `;
            document.getElementById('btn-trigger-login').addEventListener('click', () => {
                if(authModal) authModal.classList.remove('hidden');
            });
        } else {
            const user = JSON.parse(isLoggedIn);
            profileSection.innerHTML = `
                <span id="header-username">${user.username}</span>
                <img src="${user.avatar}" class="avatar">
                <button class="btn btn-text" id="btn-logout" style="padding: 4px; margin-left: 5px; color: var(--danger);" title="Cerrar Sesión"><i class="ph-bold ph-sign-out"></i></button>
            `;
            document.getElementById('btn-logout').addEventListener('click', () => {
                localStorage.removeItem('usuario_token');
                window.location.reload();
            });
        }
    }

    // Funciones del Modal de Login
    if(authModal) {
        document.getElementById('btn-fake-discord').addEventListener('click', () => {
            localStorage.setItem('usuario_token', JSON.stringify({username: 'Zeryux_Dev', avatar: 'https://crafatar.com/avatars/Zeryux?size=40'}));
            window.location.reload();
        });
        document.getElementById('btn-fake-google').addEventListener('click', () => {
            localStorage.setItem('usuario_token', JSON.stringify({username: 'Invitado', avatar: 'https://crafatar.com/avatars/Steve?size=40'}));
            window.location.reload();
        });
    }

    // ==========================================
    // 1. NAVEGACIÓN Y VISTAS
    // ==========================================
    const navButtons = document.querySelectorAll('.nav-btn');
    const views = { 
        'mods': document.getElementById('view-mods'), 
        'worlds': document.getElementById('view-worlds'), 
        'profiles': document.getElementById('view-profiles') 
    };
    
    navButtons.forEach(btn => btn.addEventListener('click', () => {
        navButtons.forEach(b => b.classList.remove('active')); 
        btn.classList.add('active');
        
        Object.values(views).forEach(v => v.classList.add('hidden')); 
        views[btn.getAttribute('data-target')].classList.remove('hidden');
        
        if (btn.getAttribute('data-target') === 'profiles') loadMyProfiles();
    }));

    // ==========================================
    // 2. LÓGICA DE MODS Y MODRINTH API
    // ==========================================
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

    let currentFilter = 'mod';
    let currentCategory = '';
    let currentOffset = 0; 

    const updateSearch = () => {
        const cartLabel = document.getElementById('cart-version-label');
        if(cartLabel) cartLabel.textContent = `${versionSelect.value} ${loaderSelect.options[loaderSelect.selectedIndex].text}`;
        fetchRealMods(false);
    };

    chips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            chips.forEach(c => c.classList.remove('active')); e.currentTarget.classList.add('active');
            currentCategory = e.currentTarget.dataset.cat; updateSearch();
        });
    });

    const lightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    if(lightbox) lightbox.addEventListener('click', () => lightbox.classList.add('hidden'));

    const tagIcons = {
        'technology': '<i class="ph-fill ph-cpu"></i>', 'magic': '<i class="ph-fill ph-sparkle"></i>',
        'adventure': '<i class="ph-fill ph-sword"></i>', 'mobs': '<i class="ph-fill ph-skull"></i>',
        'worldgen': '<i class="ph-fill ph-tree"></i>', 'equipment': '<i class="ph-fill ph-shield"></i>',
        'optimization': '<i class="ph-fill ph-rocket"></i>', 'library': '<i class="ph-fill ph-books"></i>'
    };

    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterButtons.forEach(b => b.classList.remove('active')); 
            e.currentTarget.classList.add('active');
            currentFilter = e.currentTarget.dataset.filter; 
            const chipsContainer = document.getElementById('category-chips-container');
            if(currentFilter === 'mod') {
                if(chipsContainer) chipsContainer.style.display = 'flex';
            } else {
                if(chipsContainer) chipsContainer.style.display = 'none';
                currentCategory = ""; chips.forEach(c => c.classList.remove('active'));
                if(chips.length) chips[0].classList.add('active');
            }
            fetchRealMods(false);
        });
    });

    async function fetchRealMods(isAppend = false) {
        if (!isAppend) {
            currentOffset = 0;
            modsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 60px;"><i class="ph ph-spinner ph-spin" style="font-size: 40px;"></i><p>Buscando...</p></div>`;
            if(btnLoadMore) btnLoadMore.classList.add('hidden');
        } else { if(btnLoadMore) btnLoadMore.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Cargando...'; }

        try {
            let queryType = currentFilter === 'library' ? 'mod' : currentFilter;
            let facets = [[`versions:${versionSelect.value}`], [`project_type:${queryType}`]];
            if (queryType === 'mod') facets.push([`categories:${loaderSelect.value}`]);
            if (currentFilter === 'mod') {
                facets.push(["categories!=library"]); 
                if (currentCategory !== "") facets.push([`categories:${currentCategory}`]);
            } else if (currentFilter === 'library') { facets.push(["categories:library"]); }

            const res = await fetch(`https://api.modrinth.com/v2/search?query=${searchInput.value}&facets=${encodeURIComponent(JSON.stringify(facets))}&index=${sortSelect.value}&limit=16&offset=${currentOffset}`);
            const data = await res.json();
            
            if (!isAppend) modsGrid.innerHTML = '';
            
            if (data.hits.length === 0 && !isAppend) {
                modsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px;">No se encontraron resultados para estos filtros.</div>';
            } else {
                renderRealMods(data.hits);
                if(data.hits.length === 16) {
                    if(btnLoadMore) { btnLoadMore.classList.remove('hidden'); btnLoadMore.innerHTML = '<i class="ph-bold ph-caret-down"></i> Cargar Más'; }
                } else { if(btnLoadMore) btnLoadMore.classList.add('hidden'); }
            }
        } catch (error) { if(!isAppend) modsGrid.innerHTML = '<div style="grid-column: 1/-1; color: var(--danger); text-align:center;">Error de API.</div>'; }
    }

    async function getRequiredDependencies(projectId, version, loader) {
        try {
            const versRes = await fetch(`https://api.modrinth.com/v2/project/${projectId}/version?game_versions=["${version}"]&loaders=["${loader}"]`);
            const versData = await versRes.json();
            if (versData.length > 0 && versData[0].dependencies.length > 0) {
                const requiredDeps = versData[0].dependencies.filter(d => d.dependency_type === 'required' && d.project_id);
                if (requiredDeps.length > 0) {
                    const projectIds = requiredDeps.map(d => d.project_id);
                    const depProjsRes = await fetch(`https://api.modrinth.com/v2/projects?ids=["${projectIds.join('","')}"]`);
                    return await depProjsRes.json(); 
                }
            }
        } catch(e) { console.error("Error obteniendo dependencias", e); }
        return [];
    }

    function renderRealMods(mods) {
        mods.forEach(mod => {
            const card = document.createElement('div'); card.className = 'mod-card';
            const iconUrl = mod.icon_url || 'https://via.placeholder.com/80/18181b/ffffff?text=?';
            const bannerUrl = (mod.gallery && mod.gallery[0]) ? mod.gallery[0] : 'https://via.placeholder.com/400x150/18181b/27272a';
            const isAdded = window.modpackCart.some(item => item.id === mod.project_id);
            
            let tagsHtml = '';
            if(mod.display_categories) {
                mod.display_categories.slice(0, 3).forEach(tag => {
                    tagsHtml += `<span class="mini-tag">${tagIcons[tag] || '<i class="ph-bold ph-tag"></i>'} ${tag}</span>`;
                });
            }

            card.innerHTML = `
                <div class="mod-banner" style="background-image: url('${bannerUrl}'); pointer-events: none;"></div>
                <div class="mod-info" style="pointer-events: none; padding-bottom: 10px;">
                    <img src="${iconUrl}" class="mod-avatar">
                    <h3 class="mod-title">${mod.title}</h3>
                    <div class="mod-tags-container">${tagsHtml}</div>
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
                const originalHtml = this.innerHTML; this.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Escaneando...'; this.disabled = true;

                if (this.dataset.type === 'mod') {
                    // AÑADIDO: CHECADOR DE COMPATIBILIDAD (EVITA CRASHEOS)
                    try {
                        const versRes = await fetch(`https://api.modrinth.com/v2/project/${this.dataset.id}/version?game_versions=["${versionSelect.value}"]&loaders=["${loaderSelect.value}"]`);
                        const versData = await versRes.json();
                        if (versData.length > 0) {
                            const incompDeps = versData[0].dependencies.filter(d => d.dependency_type === 'incompatible' && d.project_id);
                            const conflict = incompDeps.find(dep => window.modpackCart.some(item => item.id === dep.project_id));
                            if(conflict) {
                                const conflictingItem = window.modpackCart.find(item => item.id === conflict.project_id);
                                alert(`🚨 ALERTA DE CRASHEO:\nEste mod es incompatible con "${conflictingItem.title}" que ya está en tu carrito.\nPara proteger tu modpack, no puedes añadir ambos.`);
                                this.innerHTML = originalHtml; this.disabled = false; return;
                            }
                        }
                    } catch(err) {}

                    const deps = await getRequiredDependencies(this.dataset.id, versionSelect.value, loaderSelect.value);
                    if (deps && deps.length > 0) {
                        const missingDeps = deps.filter(dep => !window.modpackCart.some(item => item.id === dep.id));
                        if (missingDeps.length > 0) {
                            showEpicDepsModal({ id: this.dataset.id, title: this.dataset.title, type: this.dataset.type }, missingDeps, this);
                            this.innerHTML = originalHtml; this.disabled = false; return; 
                        }
                    }
                }

                window.modpackCart.push({ id: this.dataset.id, title: this.dataset.title, type: this.dataset.type });
                window.updateCartUI();
                this.innerHTML = '<i class="ph-bold ph-check"></i> Añadido'; this.style.background = 'var(--success)'; this.style.color = 'white';
            });

            // ==========================================
            // TU LÓGICA INTACTA DEL MODAL DE DETALLES
            // ==========================================
            card.addEventListener('click', (e) => {
                if(e.target.closest('.btn-add-mod')) return; 
                const modal = document.getElementById('mod-details-modal'); modal.classList.remove('hidden');
                
                document.getElementById('detail-title').textContent = mod.title;
                document.getElementById('detail-author').innerHTML = `por ${mod.author}`;
                document.getElementById('detail-icon').src = iconUrl;
                
                // RESTAURADO: El contador de descargas Sticky
                document.getElementById('detail-downloads-badge').innerHTML = `<i class="ph-bold ph-download-simple"></i> ${new Intl.NumberFormat('es-MX').format(mod.downloads || 0)}`;
                
                document.getElementById('detail-description').innerHTML = `<div style="text-align:center; padding: 40px;"><i class="ph ph-spinner ph-spin" style="font-size: 30px;"></i><p>Cargando información...</p></div>`;
                document.getElementById('detail-gallery').innerHTML = '';
                
                const depsContainer = document.getElementById('detail-dependencies');
                depsContainer.innerHTML = '';

                // RESTAURADO: Las librerías y el botón de Añadir Todo
                if (mod.project_type === 'mod') {
                    getRequiredDependencies(mod.project_id, versionSelect.value, loaderSelect.value).then(depProjs => {
                        if (depProjs.length > 0) {
                            let depsHtml = '<h3 class="subtitle mb-10 w-100"><i class="ph-bold ph-books"></i> Librerías Necesarias</h3><div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px;">';
                            depProjs.forEach(p => {
                                depsHtml += `<div style="background: var(--bg-hover); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); display:flex; align-items:center; gap:10px;"><img src="${p.icon_url || 'https://via.placeholder.com/40'}" style="width:24px; height:24px; border-radius:4px;"><span style="font-size:0.85rem; font-weight:600;">${p.title}</span></div>`;
                            });
                            depsHtml += `</div><button class="btn btn-secondary w-100" id="btn-detail-add-all" style="margin-bottom: 20px;"><i class="ph-bold ph-stack"></i> Añadir Mod y Librerías al Carrito</button>`;
                            depsContainer.innerHTML = depsHtml;
                            
                            document.getElementById('btn-detail-add-all').onclick = () => {
                                if (!window.modpackCart.some(item => item.id === mod.project_id)) window.modpackCart.push({ id: mod.project_id, title: mod.title, type: mod.project_type });
                                depProjs.forEach(dep => { if (!window.modpackCart.some(item => item.id === dep.id)) window.modpackCart.push({ id: dep.id, title: dep.title, type: 'mod' }); });
                                window.updateCartUI();
                                addBtn.innerHTML = '<i class="ph-bold ph-check"></i> Añadido'; addBtn.style.background = 'var(--success)'; addBtn.disabled = true;
                                modal.classList.add('hidden');
                            };
                        }
                    });
                }

                fetch(`https://api.modrinth.com/v2/project/${mod.project_id}`).then(res => res.json()).then(projectData => {
                    document.getElementById('detail-description').innerHTML = projectData.body ? marked.parse(projectData.body) : `<p>${projectData.description}</p>`;
                    const gallery = document.getElementById('detail-gallery');
                    if(projectData.gallery && projectData.gallery.length > 0) {
                        projectData.gallery.forEach(img => {
                            const imgEl = document.createElement('img'); imgEl.src = img.url; imgEl.style.cursor = 'zoom-in';
                            imgEl.onclick = () => { lightboxImg.src = img.url; lightbox.classList.remove('hidden'); };
                            gallery.appendChild(imgEl);
                        });
                    }
                });
            });

            modsGrid.appendChild(card);
        });
    }

    function showEpicDepsModal(mainMod, missingDeps, triggerButton) {
        const modal = document.getElementById('epic-deps-modal');
        document.getElementById('epic-mod-name').textContent = mainMod.title;
        const list = document.getElementById('epic-deps-list'); list.innerHTML = '';
        
        missingDeps.forEach((p, index) => {
            let animClass = index % 2 === 0 ? 'anim-right' : 'anim-left';
            list.innerHTML += `
            <div class="tilt-wrapper" style="margin-bottom: 10px;">
                <div class="tilt-card ${animClass}" style="background: var(--bg-main);">
                    <img src="${p.icon_url || 'https://via.placeholder.com/40'}" alt="icon">
                    <div class="dep-info" style="text-align: left;"><h4>${p.title}</h4><span>Componente central</span></div>
                </div>
            </div>`;
        });

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
    // FUNCIONES AÑADIDAS: PLANTILLAS Y SKIN VIEWER
    // ==========================================
    async function installTemplate(slugs, buttonId, text) {
        const btn = document.getElementById(buttonId); btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Cargando...'; btn.disabled = true; let añadidos = 0;
        for (const slug of slugs) {
            try { const res = await fetch(`https://api.modrinth.com/v2/project/${slug}`); if (res.ok) { const modData = await res.json(); if (!window.modpackCart.some(item => item.id === modData.id)) { window.modpackCart.push({ id: modData.id, title: modData.title, type: 'mod' }); añadidos++; } } } catch(e) {}
        }
        window.updateCartUI(); btn.innerHTML = text; btn.disabled = false; if(añadidos > 0) alert(`Se añadieron ${añadidos} mods.`);
    }

    document.getElementById('btn-template-rpg')?.addEventListener('click', () => installTemplate(['better-combat', 'waystones', 'farmers-delight', 'appleskin'], 'btn-template-rpg', '<i class="ph-bold ph-sword"></i> Plantilla RPG'));
    document.getElementById('btn-template-tech')?.addEventListener('click', () => installTemplate(['create', 'jei', 'mouse-tweaks', 'jade'], 'btn-template-tech', '<i class="ph-bold ph-gear"></i> Plantilla Técnica'));
    document.getElementById('btn-fps-boost')?.addEventListener('click', () => installTemplate(['sodium', 'lithium', 'ferrite-core', 'entityculling'], 'btn-fps-boost', '<i class="ph-bold ph-rocket"></i> Auto-Instalar Pack de Optimización'));
    document.getElementById('btn-randomizer')?.addEventListener('click', async () => {
        if(!confirm("Esto vaciará tu carrito actual para crear un reto aleatorio. ¿Continuar?")) return;
        window.modpackCart = []; window.updateCartUI();
        const randomSlugs = ['rlcraft', 'ice-and-fire', 'alexs-mobs', 'terralith', 'biomesoplenty', 'bloodmagic', 'twilightforest', 'botania', 'vampirism', 'mutant-monsters'];
        const numMods = Math.floor(Math.random() * 4) + 2; const selected = randomSlugs.sort(() => 0.5 - Math.random()).slice(0, numMods);
        await installTemplate(selected, 'btn-randomizer', '<i class="ph-bold ph-dice-three"></i> Ruleta Aleatoria');
    });

// ==========================================
    // 7. INFO AVANZADA DE CUENTAS MC & VISOR DE SKINS
    // ==========================================
    const btnLoadSkin = document.getElementById('btn-load-skin');
    const inputSkin = document.getElementById('mc-skin-input');
    const imgSkinPreview = document.getElementById('mc-skin-preview');
    const advInfoBox = document.getElementById('mc-advanced-info');
    const uuidBadge = document.getElementById('mc-uuid-badge');
    const capeBadge = document.getElementById('mc-cape-badge');

    if (btnLoadSkin && inputSkin && imgSkinPreview) {
        
        const fetchMojangData = async (username) => {
            if (username === '') return;
            imgSkinPreview.style.opacity = '0.5';
            
            try {
                // Usamos la API de Ashcon para extraer datos profundos de Mojang
                const res = await fetch(`https://api.ashcon.app/mojang/v2/user/${username}`);
                if (!res.ok) throw new Error("No encontrado");
                
                const data = await res.json();
                
                // Actualizar imagen con el UUID real
                imgSkinPreview.src = `https://crafatar.com/renders/body/${data.uuid}?overlay=true`;
                imgSkinPreview.style.opacity = '1';
                
                // Actualizar Info Avanzada
                if (advInfoBox) {
                    advInfoBox.style.display = 'block';
                    // Recortar UUID para que quepa bien
                    uuidBadge.textContent = `UUID: ${data.uuid.substring(0, 13)}...`;
                    uuidBadge.title = data.uuid; // Muestra el completo al pasar el mouse
                    
                    // Verificar si tiene Capa
                    if (data.textures && data.textures.cape) {
                        capeBadge.innerHTML = `<i class="ph-fill ph-check-circle"></i> Tiene Capa`;
                        capeBadge.style.color = '#fcd34d'; // Dorado
                        capeBadge.style.borderColor = '#d97706';
                    } else {
                        capeBadge.innerHTML = `<i class="ph-bold ph-x"></i> Sin Capa`;
                        capeBadge.style.color = '#93c5fd';
                        capeBadge.style.borderColor = '#2563eb';
                    }
                }
                
                localStorage.setItem('minepack_username', username);
            } catch (error) {
                alert('No se encontró ninguna cuenta premium con ese nombre en Mojang.');
                imgSkinPreview.style.opacity = '1';
                if (advInfoBox) advInfoBox.style.display = 'none';
            }
        };

        btnLoadSkin.addEventListener('click', () => fetchMojangData(inputSkin.value.trim()));

        // Cargar el último usado al recargar la página
        const savedName = localStorage.getItem('minepack_username');
        if (savedName) { 
            inputSkin.value = savedName; 
            fetchMojangData(savedName); 
        }
    }

    // ==========================================
    // UI DEL CARRITO CON EDITOR DE CONFIGURACIÓN
    // ==========================================
    const recommendedMods = [ { id: '1eAoo2KR', title: 'Just Enough Items (JEI)', type: 'mod' }, { id: 'mOgUt4GM', title: 'Mod Menu', type: 'mod' }, { id: 'yM94ont6', title: 'Jade 🔍', type: 'mod' } ];

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
                if(item.type === 'resourcepack') { iconClass = 'ph-paint-brush'; typeColor = '#10b981'; typeText = 'Textura'; }
                else if(item.type === 'shader') { iconClass = 'ph-aperture'; typeColor = '#f59e0b'; typeText = 'Shader'; }
                
                li.innerHTML = `
                    <div class="cart-item-info" style="display:flex; align-items:center; gap:12px; overflow:hidden;">
                        <div class="cart-item-icon" style="width:32px; height:32px; border-radius:6px; display:flex; justify-content:center; align-items:center; color: ${typeColor}; background: ${typeColor}20;">
                            <i class="ph-fill ${iconClass}" style="font-size: 1.2rem;"></i>
                        </div>
                        <div class="cart-item-text" style="display:flex; flex-direction:column;">
                            <span class="cart-item-title" style="font-weight:600; font-size:0.85rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:140px;">${item.title}</span>
                            <span class="cart-item-type" style="font-size:0.65rem; color:${typeColor}; text-transform:uppercase; font-weight:700;">${typeText}</span>
                        </div>
                    </div>
                    <div style="display:flex; gap: 5px;">
                        <button class="btn-config" data-id="${item.id}" data-title="${item.title}" style="background:transparent; border:none; color:var(--text-main); cursor:pointer; padding:5px;" title="Editar Configuración"><i class="ph-bold ph-gear"></i></button>
                        <button class="btn-remove" data-index="${index}" style="background:transparent; border:none; color:var(--danger); cursor:pointer; padding:5px;"><i class="ph-bold ph-trash"></i></button>
                    </div>
                `;
                cartList.appendChild(li);
            });

            document.querySelectorAll('.btn-remove').forEach(btn => { btn.addEventListener('click', function() { window.modpackCart.splice(this.dataset.index, 1); window.updateCartUI(); fetchRealMods(false); }); });
            
            // ABRIR EDITOR DE CONFIGURACIONES
            document.querySelectorAll('.btn-config').forEach(btn => { 
                btn.addEventListener('click', function() { 
                    const modId = this.dataset.id;
                    document.getElementById('config-mod-title').innerHTML = `<i class="ph-bold ph-gear"></i> Config: ${this.dataset.title}`;
                    document.getElementById('config-mod-id').value = modId;
                    
                    if(window.modConfigs[modId]) {
                        document.getElementById('config-filename').value = window.modConfigs[modId].filename;
                        document.getElementById('config-content').value = window.modConfigs[modId].content;
                    } else {
                        const safeName = this.dataset.title.toLowerCase().replace(/[^a-z0-9]/g, '-');
                        document.getElementById('config-filename').value = `${safeName}-common.toml`;
                        document.getElementById('config-content').value = ``;
                    }
                    document.getElementById('config-editor-modal').classList.remove('hidden');
                }); 
            });

            // Recomendaciones
            if (recBox && recItem) {
                const availableRecs = recommendedMods.filter(rm => !window.modpackCart.some(cm => cm.id === rm.id));
                if (availableRecs.length > 0) {
                    const rec = availableRecs[Math.floor(Math.random() * availableRecs.length)];
                    recItem.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="font-size: 0.85rem; font-weight: bold;">${rec.title}</span><button class="btn btn-primary btn-add-rec" data-id="${rec.id}" data-title="${rec.title}" data-type="${rec.type}" style="padding: 4px 8px; font-size: 0.75rem;"><i class="ph-bold ph-plus"></i></button></div>`;
                    recBox.style.display = 'block'; recItem.querySelector('.btn-add-rec').addEventListener('click', function() { window.modpackCart.push({ id: this.dataset.id, title: this.dataset.title, type: this.dataset.type }); window.updateCartUI(); });
                } else { recBox.style.display = 'none'; }
            }
        }
        const mobileBtn = document.getElementById('mobile-cart-toggle-btn'); if(mobileBtn) mobileBtn.innerHTML = `<i class="ph-bold ph-package"></i> <span class="badge">${window.modpackCart.length}</span>`;
    }

    // GUARDAR CONFIGURACIÓN EDITADA
    document.getElementById('btn-save-config')?.addEventListener('click', () => {
        const modId = document.getElementById('config-mod-id').value;
        const filename = document.getElementById('config-filename').value;
        const content = document.getElementById('config-content').value;
        if(content.trim() !== '') { window.modConfigs[modId] = { filename, content }; alert("Configuración guardada en memoria. Se incluirá al exportar el ZIP."); }
        document.getElementById('config-editor-modal').classList.add('hidden');
    });

    // MIGRAR VERSIÓN MÁGICO
    document.getElementById('btn-migrate-pack')?.addEventListener('click', async () => {
        if(window.modpackCart.length === 0) return alert("Tu carrito está vacío.");
        const newVers = prompt(`¿A qué versión de Minecraft quieres migrar tus ${window.modpackCart.length} mods?\nEjemplo: 1.20.4 o 1.19.2`); if(!newVers) return;
        const btn = document.getElementById('btn-migrate-pack'); btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>'; btn.disabled = true;
        let exist = 0; let fail = 0; let failedNames = [];
        for (let i = 0; i < window.modpackCart.length; i++) {
            try { const res = await fetch(`https://api.modrinth.com/v2/project/${window.modpackCart[i].id}/version?game_versions=["${newVers}"]&loaders=["${loaderSelect.value}"]`); const data = await res.json(); if(data.length > 0) exist++; else { fail++; failedNames.push(window.modpackCart[i].title); } } catch(e) { fail++; }
        }
        btn.innerHTML = '<i class="ph-bold ph-magic-wand"></i> Migrar'; btn.disabled = false;
        let msg = `✨ MIGRACIÓN COMPLETADA\n\nCompatibles con ${newVers}: ${exist}\nNo disponibles: ${fail}\n`; if(fail > 0) msg += `\nMods que perderás: ${failedNames.slice(0,3).join(', ')}${fail > 3 ? '...' : ''}`;
        if(confirm(msg + `\n\n¿Deseas aplicar el cambio a la versión ${newVers}?`)) { versionSelect.value = newVers; updateSearch(); }
    });

    // ==========================================
    // CARGAR MIS PERFILES DESDE LOCALSTORAGE
    // ==========================================
    window.loadMyProfiles = function() {
        const grid = document.getElementById('profiles-grid');
        if(!grid) return;

        if(!isLoggedIn) {
            grid.innerHTML = `<div style="text-align: center; padding: 40px;"><i class="ph-bold ph-lock-key" style="font-size: 40px; color: var(--muted);"></i><p style="margin-top: 10px;">Inicia sesión para guardar tus modpacks aquí.</p></div>`;
            return;
        }

        const profiles = JSON.parse(localStorage.getItem('mis_modpacks_guardados') || '[]');
        if (profiles.length === 0) {
            grid.innerHTML = '<div style="text-align:center; padding:40px;"><p>Aún no has guardado ningún Modpack.</p></div>';
            return;
        }

        grid.innerHTML = '';
        profiles.forEach((p, index) => {
            const modsCount = p.modsData ? p.modsData.length : 0;
            grid.innerHTML += `
                <div class="profile-card panel" style="padding: 15px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid var(--border-color); padding-bottom: 10px;">
                        <div style="font-size: 1.2rem; display: flex; align-items: center; gap: 10px;">
                            ${p.iconBase64 ? `<img src="${p.iconBase64}" style="width:24px; height:24px; border-radius:4px;">` : `<i class="ph-fill ph-package" style="color:var(--accent);"></i>`}
                            ${p.name}
                        </div>
                        <div>
                            <button class="btn btn-secondary btn-share-profile" data-index="${index}" style="padding:5px;" title="Copiar Enlace Público"><i class="ph-bold ph-link"></i></button>
                            <button class="btn btn-text btn-delete-profile" data-index="${index}" style="color:var(--danger); padding:5px;" title="Eliminar Perfil"><i class="ph-bold ph-trash"></i></button>
                        </div>
                    </div>
                    <div style="display: flex; gap: 15px; margin-top: 10px; margin-bottom: 10px;">
                        <span style="background: rgba(0,0,0,0.2); padding: 5px 10px; border-radius: 6px; font-size: 0.8rem; color: var(--success);"><i class="ph-bold ph-game-controller"></i> ${p.mcVersion}</span>
                        <span style="background: rgba(0,0,0,0.2); padding: 5px 10px; border-radius: 6px; font-size: 0.8rem; color: #f59e0b;"><i class="ph-bold ph-hammer"></i> ${p.modLoader.toUpperCase()}</span>
                        <span style="background: rgba(0,0,0,0.2); padding: 5px 10px; border-radius: 6px; font-size: 0.8rem;"><i class="ph-bold ph-puzzle-piece"></i> ${modsCount} Items</span>
                    </div>
                    <button class="btn btn-secondary btn-edit-profile w-100" data-index="${index}"><i class="ph-bold ph-pencil-simple"></i> Cargar al Ensamblador</button>
                </div>
            `;
        });

        document.querySelectorAll('.btn-share-profile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profile = profiles[e.currentTarget.dataset.index];
                const dataStr = encodeURIComponent(btoa(JSON.stringify(profile.modsData)));
                const shareUrl = `${window.location.origin}${window.location.pathname}?pack=${dataStr}`;
                navigator.clipboard.writeText(shareUrl);
                alert("🔗 ¡Enlace de tu Modpack copiado al portapapeles! Envíalo a tus amigos para que lo descarguen.");
            });
        });

        document.querySelectorAll('.btn-delete-profile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if(confirm("¿Seguro que quieres eliminar este perfil?")) {
                    profiles.splice(e.currentTarget.dataset.index, 1);
                    localStorage.setItem('mis_modpacks_guardados', JSON.stringify(profiles));
                    window.loadMyProfiles();
                }
            });
        });

        document.querySelectorAll('.btn-edit-profile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profile = profiles[e.currentTarget.dataset.index];
                window.modpackCart = profile.modsData;
                versionSelect.value = profile.mcVersion;
                loaderSelect.value = profile.modLoader;
                window.updateCartUI();
                document.querySelector('.nav-btn[data-target="mods"]').click();
                updateSearch();
            });
        });
    }

    // ==========================================
    // EXPORTACIÓN 100% EN NAVEGADOR
    // ==========================================
    const modalSave = document.getElementById('save-pack-modal');
    const btnJustDownload = document.getElementById('btn-just-download');
    const btnSaveAndDownload = document.getElementById('btn-confirm-save-download');
    const packNameInput = document.getElementById('pack-name-input');
    
    if(btnOpenSaveModal) btnOpenSaveModal.addEventListener('click', () => modalSave.classList.remove('hidden'));

    let uploadedIconBase64 = null;
    document.getElementById('pack-icon-input')?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) { const reader = new FileReader(); reader.onload = function(evt) { uploadedIconBase64 = evt.target.result; }; reader.readAsDataURL(file); }
    });

    async function requestBuild(isSaving = false) {
        if (isSaving && !isLoggedIn) {
            alert('¡Alto! Necesitas Iniciar Sesión para guardar perfiles.');
            if(authModal) authModal.classList.remove('hidden');
            modalSave.classList.add('hidden');
            return;
        }

        try {
            const packName = (packNameInput && packNameInput.value.trim() !== '') ? packNameInput.value.trim() : 'Mi_Modpack';
            const btn = isSaving ? btnSaveAndDownload : btnJustDownload;
            const mcVersion = versionSelect.value;
            const loader = loaderSelect.value;
            
            const isServerPack = document.getElementById('export-server-pack')?.checked;
            const isMrPack = document.getElementById('export-mrpack')?.checked;
            
            if(btn) { btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Procesando...'; btn.disabled = true; }

            if (isSaving) {
                const profiles = JSON.parse(localStorage.getItem('mis_modpacks_guardados') || '[]');
                profiles.push({ name: packName, mcVersion: mcVersion, modLoader: loader, modsData: window.modpackCart, iconBase64: uploadedIconBase64 });
                localStorage.setItem('mis_modpacks_guardados', JSON.stringify(profiles)); loadMyProfiles();
            }

            if (typeof JSZip === 'undefined') throw new Error("Falta la librería JSZip. Revisa el Paso 1.");
            const zip = new JSZip();

            if (uploadedIconBase64) {
                const base64Data = uploadedIconBase64.split(',')[1];
                zip.file("icon.png", base64Data, {base64: true});
            }

            // CREAR LA CARPETA /config SI EL USUARIO EDITÓ ARCHIVOS EN LA WEB
            if(Object.keys(window.modConfigs).length > 0) {
                const confFolder = zip.folder("config");
                for (const modId in window.modConfigs) {
                    confFolder.file(window.modConfigs[modId].filename, window.modConfigs[modId].content);
                }
            }

            if (isMrPack) {
                if(btn) btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Generando Índices MRPack...`;
                const mrpackIndex = { formatVersion: 1, game: "minecraft", versionId: packName, name: packName, dependencies: { minecraft: mcVersion, [loader]: "*" }, files: [] };
                for (let i = 0; i < window.modpackCart.length; i++) {
                    const item = window.modpackCart[i];
                    const versRes = await fetch(`https://api.modrinth.com/v2/project/${item.id}/version?game_versions=["${mcVersion}"]`);
                    const versData = await versRes.json();
                    if (versData && versData.length > 0 && versData[0].files.length > 0) {
                        const f = versData[0].files.find(fi => fi.primary) || versData[0].files[0];
                        let envData = { client: "required", server: "required" };
                        if (isServerPack) { try { const pRes = await fetch(`https://api.modrinth.com/v2/project/${item.id}`); const pData = await pRes.json(); if(pData.server_side === 'unsupported') continue; } catch(e){} }
                        let targetFolder = "mods"; if(item.type === 'shader') targetFolder = "shaderpacks"; else if(item.type === 'resourcepack') targetFolder = "resourcepacks";
                        mrpackIndex.files.push({ path: `${targetFolder}/${f.filename}`, hashes: { sha1: f.hashes.sha1, sha512: f.hashes.sha512 }, downloads: [f.url], fileSize: f.size, env: envData });
                    }
                }
                zip.file("modrinth.index.json", JSON.stringify(mrpackIndex, null, 4));
            } else {
                const modsFolder = zip.folder("mods"); const shadersFolder = zip.folder("shaderpacks"); const resourceFolder = zip.folder("resourcepacks");
                const wGamemode = document.getElementById('world-gamemode')?.value || 'survival';
                let propsContent = `# Generado por MinePack Studio\ngamemode=${wGamemode}\n`;
                const wSeed = document.getElementById('world-seed-input')?.value; if (wSeed && wSeed.trim() !== '') propsContent += `level-seed=${wSeed}\n`;
                zip.file("server.properties", propsContent);

                if (isServerPack) {
                    zip.file("eula.txt", "eula=true\n");
                    zip.file("start.bat", "@echo off\necho INICIANDO SERVIDOR MINEPACK...\njava -Xmx4G -Xms4G -jar server.jar nogui\npause");
                }

                for (let i = 0; i < window.modpackCart.length; i++) {
                    const item = window.modpackCart[i];
                    if(btn) btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Descargando (${i+1}/${window.modpackCart.length})...`;
                    if (isServerPack) { if (item.type === 'shader' || item.type === 'resourcepack') continue; try { const projRes = await fetch(`https://api.modrinth.com/v2/project/${item.id}`); const projData = await projRes.json(); if (projData.server_side === 'unsupported') continue; } catch(e) {} }
                    const versRes = await fetch(`https://api.modrinth.com/v2/project/${item.id}/version?game_versions=["${mcVersion}"]`);
                    const versData = await versRes.json();
                    if (versData && versData.length > 0 && versData[0].files.length > 0) {
                        const fileObj = versData[0].files.find(f => f.primary) || versData[0].files[0];
                        const fileRes = await fetch(fileObj.url);
                        const fileBlob = await fileRes.blob();
                        if (!isServerPack && item.type === 'shader') shadersFolder.file(fileObj.filename, fileBlob); else if (!isServerPack && item.type === 'resourcepack') resourceFolder.file(fileObj.filename, fileBlob); else modsFolder.file(fileObj.filename, fileBlob);
                    }
                }
            }

            if(btn) btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Empaquetando ZIP...';
            const zipContent = await zip.generateAsync({ type: "blob" });
            const url = window.URL.createObjectURL(zipContent);
            const a = document.createElement('a'); a.style.display = 'none'; a.href = url;
            a.download = `${packName.replace(/\s+/g, '_')}${isServerPack ? '_SERVER' : ''}_${mcVersion}.${isMrPack ? 'mrpack' : 'zip'}`;
            document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url);
            modalSave.classList.add('hidden');
        } catch (error) { alert("Error al descargar: " + error.message); } finally {
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

    const mobileBtn = document.createElement('button');
    mobileBtn.id = 'mobile-cart-toggle-btn';
    mobileBtn.className = 'mobile-cart-toggle hidden-desktop';
    mobileBtn.innerHTML = `<i class="ph-bold ph-package"></i> <span class="badge">0</span>`;
    document.body.appendChild(mobileBtn);

    mobileBtn.addEventListener('click', () => {
        const cart = document.querySelector('.cart-panel');
        cart.classList.toggle('active-mobile');
        mobileBtn.innerHTML = cart.classList.contains('active-mobile') ? `<i class="ph-bold ph-x"></i>` : `<i class="ph-bold ph-package"></i> <span class="badge">${window.modpackCart.length}</span>`;
    });

    // ==========================================
    // FUNCIÓN: COMPARADOR VISUAL DE SHADERS
    // ==========================================
    const shaderSliderInput = document.getElementById('shader-slider-input');
    const shaderImgTop = document.getElementById('shader-img-top');
    const shaderSliderLine = document.getElementById('shader-slider-line');
    const btnOpenShaderCompare = document.getElementById('btn-shader-compare');

    if (shaderSliderInput && shaderImgTop && shaderSliderLine) {
        // Mover la línea y el recorte al mover el slider
        shaderSliderInput.addEventListener('input', (e) => {
            const sliderValue = e.target.value;
            // Modificamos el polígono CSS para revelar la imagen de abajo
            shaderImgTop.style.clipPath = `polygon(0 0, ${sliderValue}% 0, ${sliderValue}% 100%, 0 100%)`;
            shaderSliderLine.style.left = `${sliderValue}%`;
        });
    }

    if (btnOpenShaderCompare) {
        btnOpenShaderCompare.addEventListener('click', () => {
            document.getElementById('shader-compare-modal').classList.remove('hidden');
        });
    }
});
