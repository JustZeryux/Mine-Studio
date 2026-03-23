document.addEventListener('DOMContentLoaded', async () => {

    // ==========================================
    // VARIABLES GLOBALES (modConfigs Y SHARE)
    // ==========================================
    window.modConfigs = {}; 
    const urlParams = new URLSearchParams(window.location.search);
    const sharedPack = urlParams.get('pack');
    window.modpackCart = [];

if (sharedPack) {
        try {
            let parsedItems = [];
            // Compatibilidad con el formato viejo
            if (sharedPack.startsWith('%') || sharedPack.includes('=')) {
                parsedItems = JSON.parse(atob(decodeURIComponent(sharedPack)));
            } else {
                // Leer el formato ultracompacto nuevo
                const items = sharedPack.split('-');
                parsedItems = items.map(item => {
                    const parts = item.split('_');
                    return { id: parts[0], title: 'Cargando...', type: parts[1] || 'mod' };
                });
            }

            // Referencias al Modal
            const sharedModal = document.getElementById('shared-pack-modal');
            const sharedList = document.getElementById('shared-pack-list');
            const btnInstall = document.getElementById('btn-install-shared');
            const btnCancel = document.getElementById('btn-cancel-shared');

            if(sharedModal) {
                sharedModal.classList.remove('hidden'); // Mostrar el cuadro emergente
                window.history.replaceState({}, document.title, window.location.pathname); // Limpiar URL para que no vuelva a salir al recargar

                const ids = parsedItems.map(m => `"${m.id}"`).join(',');
                if(ids) {
                    // Pedir toda la info completa a Modrinth (Iconos, Descripciones, etc)
                    fetch(`https://api.modrinth.com/v2/projects?ids=[${ids}]`)
                        .then(r => r.json())
                        .then(data => {
                            sharedList.innerHTML = ''; // Limpiar el spinner
                            
                            // Crear un diccionario rápido
                            const projectMap = {};
                            data.forEach(p => projectMap[p.id] = p);

                            parsedItems.forEach(item => {
                                const proj = projectMap[item.id];
                                if(proj) {
                                    item.title = proj.title; // Actualizamos el título real
                                    const icon = proj.icon_url || 'https://via.placeholder.com/48/18181b/ffffff?text=?';
                                    const desc = proj.description ? proj.description.substring(0, 75) + '...' : 'Sin descripción disponible.';
                                    
                                    let typeColor = 'var(--accent)';
                                    let typeText = 'MOD';
                                    let iconType = 'ph-puzzle-piece';
                                    
                                    if(item.type === 'shader') { typeColor = '#f59e0b'; typeText = 'SHADER'; iconType = 'ph-aperture'; }
                                    else if(item.type === 'resourcepack') { typeColor = '#10b981'; typeText = 'TEXTURA'; iconType = 'ph-paint-brush'; }

                                    // Inyectar la tarjeta visual del mod
                                    sharedList.innerHTML += `
                                        <div style="display: flex; gap: 15px; align-items: center; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                                            <img src="${icon}" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover;">
                                            <div style="flex: 1; text-align: left;">
                                                <div style="display: flex; align-items: center; gap: 8px;">
                                                    <h4 style="margin: 0; font-size: 1rem; color: #fff;">${proj.title}</h4>
                                                    <span style="font-size: 0.65rem; background: ${typeColor}20; color: ${typeColor}; padding: 2px 6px; border-radius: 4px; font-weight: bold; border: 1px solid ${typeColor}40;">
                                                        <i class="ph-fill ${iconType}"></i> ${typeText}
                                                    </span>
                                                </div>
                                                <p style="margin: 0; font-size: 0.8rem; color: var(--muted); margin-top: 5px; line-height: 1.2;">${desc}</p>
                                            </div>
                                        </div>
                                    `;
                                }
                            });

                            // Acción: Botón Instalar
                            btnInstall.onclick = () => {
                                btnInstall.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Instalando...';
                                btnInstall.disabled = true;
                                
                                let añadidos = 0;
                                parsedItems.forEach(pi => {
                                    // Prevenir duplicados en el carrito
                                    if(!window.modpackCart.some(cartItem => cartItem.id === pi.id)) {
                                        window.modpackCart.push(pi);
                                        añadidos++;
                                    }
                                });
                                
                                window.updateCartUI();
                                sharedModal.classList.add('hidden');
                                alert(`✅ ¡Listo! Se añadieron ${añadidos} mods a tu ensamblador.`);
                                
                                // Resetear botón por si acaso
                                btnInstall.innerHTML = '<i class="ph-bold ph-download-simple"></i> Instalar Modpack';
                                btnInstall.disabled = false;
                            };

                            // Acción: Botón Cancelar
                            btnCancel.onclick = () => {
                                sharedModal.classList.add('hidden');
                            };
                        });
                }
            }
        } catch(e) {
            console.error("Error cargando pack compartido", e);
            alert("El enlace del modpack está corrupto o es inválido.");
        }
    }

    // ==========================================
    // 0. SISTEMA DE SESIÓN 100% FRONTEND (MÓDULOS)
    // ==========================================

    // ==========================================
    // IMPORTADOR MÁGICO DE .JAR (CurseForge/Local)
    // ==========================================
    const btnImportJars = document.getElementById('btn-import-jars');
    const inputImportJars = document.getElementById('import-jars-input');

    if(btnImportJars && inputImportJars) {
        btnImportJars.addEventListener('click', () => inputImportJars.click());

        inputImportJars.addEventListener('change', async (e) => {
            const files = e.target.files;
            if(files.length === 0) return;

            btnImportJars.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Analizando...';
            btnImportJars.disabled = true;

            const hashes = [];
            
            // 1. Calcular el SHA-1 de cada archivo .jar
            for(let i=0; i<files.length; i++) {
                const buffer = await files[i].arrayBuffer();
                const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
                hashes.push(hashHex);
            }

            try {
                // 2. Preguntarle a Modrinth de quién son estas huellas dactilares
                const res = await fetch('https://api.modrinth.com/v2/version_files', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ hashes: hashes, algorithm: "sha1" })
                });
                const data = await res.json();
                
                let added = 0;
                let notFound = 0;

                // 3. Añadir al carrito
                for (const hash of hashes) {
                    if (data[hash]) {
                        const projectId = data[hash].project_id;
                        if (!window.modpackCart.some(item => item.id === projectId)) {
                            window.modpackCart.push({ id: projectId, title: "Mod Importado", type: "mod" });
                            added++;
                        }
                    } else {
                        notFound++;
                    }
                }

                // 4. Actualizar los títulos feos ("Mod Importado") por los nombres reales
                if(added > 0) {
                    const ids = window.modpackCart.filter(m => m.title === "Mod Importado").map(m => `"${m.id}"`).join(',');
                    if(ids) {
                        const pRes = await fetch(`https://api.modrinth.com/v2/projects?ids=[${ids}]`);
                        const pData = await pRes.json();
                        pData.forEach(proj => {
                            const cartItem = window.modpackCart.find(i => i.id === proj.id && i.title === "Mod Importado");
                            if(cartItem) cartItem.title = proj.title;
                        });
                    }
                }

                window.updateCartUI();
                alert(`📦 Importación Local Completada.\n\n✅ Encontrados en la base de datos: ${added}\n❌ Exclusivos de CurseForge / No reconocidos: ${notFound}\n\n¡Ahora puedes guardar el perfil o generar tu link para compartir!`);
                
            } catch(err) {
                console.error(err);
                alert("Hubo un error al conectar con la base de datos para verificar los archivos.");
            }

            btnImportJars.innerHTML = '<i class="ph-bold ph-upload-simple"></i> Importar .JAR';
            btnImportJars.disabled = false;
            inputImportJars.value = ''; // Resetear el input
        });
    }
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
        } catch(e) {}
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
                <div style="padding: 0 10px 10px 10px; z-index: 10; margin-top: auto; display: flex; gap: 8px;">
                    <button class="btn btn-primary btn-add-mod" data-id="${mod.project_id}" data-title="${mod.title}" data-type="${mod.project_type}" ${isAdded ? 'disabled' : ''} style="flex: 2; ${isAdded ? 'background: var(--success); color: white;' : ''}">
                        <i class="ph-bold ${isAdded ? 'ph-check' : 'ph-plus'}"></i> ${isAdded ? 'Añadido' : 'Añadir'}
                    </button>
                    <button class="btn btn-secondary btn-download-jar" data-id="${mod.project_id}" data-title="${mod.title}" title="Descargar .jar directo" style="flex: 1; padding: 0; display: flex; justify-content: center; align-items: center; border-color: #8b5cf6; color: #8b5cf6;">
                        <i class="ph-bold ph-download-simple" style="font-size: 18px;"></i>
                    </button>
                </div>
            `;

            const addBtn = card.querySelector('.btn-add-mod');
            addBtn.addEventListener('click', async function(e) {
                e.stopPropagation(); 
                const originalHtml = this.innerHTML; this.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Escaneando...'; this.disabled = true;

                if (this.dataset.type === 'mod') {
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

            card.addEventListener('click', (e) => {
                if(e.target.closest('.btn-add-mod')) return; 
                const modal = document.getElementById('mod-details-modal'); modal.classList.remove('hidden');
                // INICIAR AUTO-ESCANEO JEI DE GOLPE
                runAutoScanJEI(mod.project_id, versionSelect.value, loaderSelect.value);
                window.currentModIdForScan = mod.project_id;
                const scanStats = document.getElementById('mod-scan-stats'); 
                const scanGallery = document.getElementById('mod-scan-gallery'); 
                const btnScan = document.getElementById('btn-scan-mod');
                
                if(scanStats) scanStats.style.display = 'none'; 
                if(scanGallery) scanGallery.style.display = 'none';
                if(btnScan) { btnScan.innerHTML = '<i class="ph-bold ph-scan"></i> Analizar .jar'; btnScan.disabled = false; }
                document.getElementById('detail-title').textContent = mod.title;
                document.getElementById('detail-author').innerHTML = `por ${mod.author}`;
                document.getElementById('detail-icon').src = iconUrl;
                document.getElementById('detail-downloads-badge').innerHTML = `<i class="ph-bold ph-download-simple"></i> ${new Intl.NumberFormat('es-MX').format(mod.downloads || 0)}`;
                document.getElementById('detail-description').innerHTML = `<div style="text-align:center; padding: 40px;"><i class="ph ph-spinner ph-spin" style="font-size: 30px;"></i><p>Cargando información...</p></div>`;
                document.getElementById('detail-gallery').innerHTML = '';
                // --- NUEVO: BOTONES FIJOS EN LA PARTE SUPERIOR (AL LADO DEL TÍTULO) ---
                const topActions = document.getElementById('detail-top-actions');
                const isAlreadyInCart = window.modpackCart.some(item => item.id === mod.project_id);
                
                if (topActions) {
                    topActions.innerHTML = `
                        <button class="btn btn-primary btn-add-top" data-id="${mod.project_id}" data-title="${mod.title}" data-type="${mod.project_type}" ${isAlreadyInCart ? 'disabled' : ''} style="padding: 10px 20px; font-size: 0.9rem; ${isAlreadyInCart ? 'background: var(--success); color: white;' : ''}">
                            <i class="ph-bold ${isAlreadyInCart ? 'ph-check' : 'ph-plus'}"></i> ${isAlreadyInCart ? 'Añadido' : 'Añadir'}
                        </button>
                        <button class="btn btn-secondary btn-download-jar" data-id="${mod.project_id}" data-title="${mod.title}" title="Descargar .jar directo" style="border-color: #8b5cf6; color: #8b5cf6; padding: 10px;">
                            <i class="ph-bold ph-download-simple" style="font-size: 20px;"></i>
                        </button>
                    `;

                    // Darle vida al botón de añadir de la parte superior
                    const btnAddTop = topActions.querySelector('.btn-add-top');
                    btnAddTop.addEventListener('click', () => {
                        if (!window.modpackCart.some(item => item.id === mod.project_id)) {
                            window.modpackCart.push({ id: mod.project_id, title: mod.title, type: mod.project_type || 'mod' });
                            window.updateCartUI();
                            btnAddTop.innerHTML = '<i class="ph-bold ph-check"></i> Añadido';
                            btnAddTop.style.background = 'var(--success)';
                            btnAddTop.style.color = 'white';
                            btnAddTop.disabled = true;
                            
                            // También deshabilitar el botón de la tarjeta por fuera para que coincidan
                            const outerBtn = card.querySelector('.btn-add-mod');
                            if(outerBtn) {
                                outerBtn.innerHTML = '<i class="ph-bold ph-check"></i> Añadido';
                                outerBtn.style.background = 'var(--success)';
                                outerBtn.style.color = 'white';
                                outerBtn.disabled = true;
                            }
                        }
                    });
                }
                // --- FIN DE BOTONES FIJOS ---
                
                const depsContainer = document.getElementById('detail-dependencies');
                depsContainer.innerHTML = '';

                if (mod.project_type === 'mod') {
                    getRequiredDependencies(mod.project_id, versionSelect.value, loaderSelect.value).then(depProjs => {
                        if (depProjs.length > 0) {
                            let depsHtml = '<h3 class="subtitle mb-10 w-100"><i class="ph-bold ph-books"></i> Librerías Necesarias</h3><div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px;">';
                            depProjs.forEach(p => {
                                depsHtml += `<div style="background: var(--bg-hover); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); display:flex; align-items:center; gap:10px;"><img src="${p.icon_url || 'https://via.placeholder.com/40'}" style="width:24px; height:24px; border-radius:4px;"><span style="font-size:0.85rem; font-weight:600;">${p.title}</span></div>`;
                            });
                            depsHtml += `</div><button class="btn btn-secondary w-100" id="btn-detail-add-all" style="margin-bottom: 20px;"><i class="ph-bold ph-stack"></i> Añadir Mod y Librerías al Carrito</button>`;
                            depsContainer.innerHTML = depsHtml;
                            depsContainer.innerHTML += `
                                <button class="btn btn-secondary w-100 btn-download-jar" data-id="${mod.project_id}" data-title="${mod.title}" style="margin-bottom: 20px; border-color: #8b5cf6; color: #8b5cf6;">
                                    <i class="ph-bold ph-download-simple"></i> Descargar .jar (Mod + Librerías)
                                </button>
                            `;
                            
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
    // HERRAMIENTAS (PLANTILLAS MASIVAS Y AUTO-MODPACKER)
    // ==========================================
    async function installTemplate(slugs, buttonId, text) {
        const btn = document.getElementById(buttonId); btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Cargando...'; btn.disabled = true; let añadidos = 0;
        for (const slug of slugs) {
            try { const res = await fetch(`https://api.modrinth.com/v2/project/${slug}`); if (res.ok) { const modData = await res.json(); if (!window.modpackCart.some(item => item.id === modData.id)) { window.modpackCart.push({ id: modData.id, title: modData.title, type: 'mod' }); añadidos++; } } } catch(e) {}
        }
        window.updateCartUI(); btn.innerHTML = text; btn.disabled = false; if(añadidos > 0) alert(`Se añadieron ${añadidos} mods a tu ensamblador.`);
    }

    // Plantillas de 15+ mods esenciales
    document.getElementById('btn-template-rpg')?.addEventListener('click', () => installTemplate(['better-combat', 'waystones', 'farmers-delight', 'appleskin', 'ice-and-fire-dragons', 'irons-spells-n-spellbooks', 'apotheosis', 'corail-tombstone', 'sophisticated-backpacks', 'blood-magic', 'twilight-forest', 'valhelsia-structures', 'artifacts', 'alexs-mobs'], 'btn-template-rpg', '<i class="ph-bold ph-sword"></i> Plantilla RPG'));
    
    document.getElementById('btn-template-tech')?.addEventListener('click', () => installTemplate(['create', 'jei', 'mouse-tweaks', 'jade', 'applied-energistics-2', 'mekanism', 'thermal-expansion', 'industrial-foregoing', 'iron-chests', 'powah', 'flux-networks', 'cc-tweaked', 'immersive-engineering', 'botania'], 'btn-template-tech', '<i class="ph-bold ph-gear"></i> Plantilla Técnica'));
    
    document.getElementById('btn-fps-boost')?.addEventListener('click', () => installTemplate(['sodium', 'lithium', 'ferrite-core', 'entityculling', 'indium', 'krypton', 'lazydfu', 'starlight', 'memoryleakfix', 'modernfix', 'cull-leaves'], 'btn-fps-boost', '<i class="ph-bold ph-rocket"></i> Auto-Instalar Pack de Optimización'));
    
    // Auto-Modpacker Masivo (50 a 150 mods compatibles de golpe)
    document.getElementById('btn-randomizer')?.addEventListener('click', async () => {
        if(!confirm("Esto vaciará tu carrito actual y generará un Modpack de 50 a 150 mods compatibles. ¿Continuar?")) return;
        const btn = document.getElementById('btn-randomizer');
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Ensamblando...'; btn.disabled = true;
        
        window.modpackCart = []; window.updateCartUI();
        
        const mcVers = document.getElementById('mod-version-select').value;
        const loader = document.getElementById('mod-loader-select').value;
        const limit = Math.floor(Math.random() * (150 - 50 + 1)) + 50; 
        
        try {
            // Buscamos mods TOP directamente de la API filtrando por tu versión y loader
            const res = await fetch(`https://api.modrinth.com/v2/search?limit=${limit}&index=downloads&facets=[["versions:${mcVers}"],["categories:${loader}"],["project_type:mod"]]`);
            const data = await res.json();
            
            data.hits.forEach(mod => {
                window.modpackCart.push({ id: mod.project_id, title: mod.title, type: mod.project_type });
            });
            window.updateCartUI();
            alert(`📦 ¡Auto-Modpacker completado! Se añadieron ${data.hits.length} mods 100% compatibles con ${mcVers} - ${loader}.`);
        } catch(e) {
            alert("Hubo un error conectando con la API de Modrinth.");
        }
        btn.innerHTML = '<i class="ph-bold ph-magic-wand"></i> Auto-Modpacker'; btn.disabled = false;
    });

    // ==========================================
    // INFO AVANZADA DE CUENTAS MC & VISOR DE SKINS
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
                const res = await fetch(`https://api.ashcon.app/mojang/v2/user/${username}`);
                if (!res.ok) throw new Error("No encontrado");
                const data = await res.json();
                
                imgSkinPreview.src = `https://crafatar.com/renders/body/${data.uuid}?overlay=true`;
                imgSkinPreview.style.opacity = '1';
                
                if (advInfoBox) {
                    advInfoBox.style.display = 'block';
                    uuidBadge.textContent = `UUID: ${data.uuid.substring(0, 13)}...`;
                    uuidBadge.title = data.uuid; 
                    
                    if (data.textures && data.textures.cape) {
                        capeBadge.innerHTML = `<i class="ph-fill ph-check-circle"></i> Tiene Capa`;
                        capeBadge.style.color = '#fcd34d'; capeBadge.style.borderColor = '#d97706';
                    } else {
                        capeBadge.innerHTML = `<i class="ph-bold ph-x"></i> Sin Capa`;
                        capeBadge.style.color = '#93c5fd'; capeBadge.style.borderColor = '#2563eb';
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
        const savedName = localStorage.getItem('minepack_username');
        if (savedName) { inputSkin.value = savedName; fetchMojangData(savedName); }
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

    document.getElementById('btn-save-config')?.addEventListener('click', () => {
        const modId = document.getElementById('config-mod-id').value;
        const filename = document.getElementById('config-filename').value;
        const content = document.getElementById('config-content').value;
        if(content.trim() !== '') { window.modConfigs[modId] = { filename, content }; alert("Configuración guardada en memoria. Se incluirá al exportar el ZIP."); }
        document.getElementById('config-editor-modal').classList.add('hidden');
    });

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
                // NUEVO FORMATO COMPACTO (ejemplo: abcd123-efgh456_shader-ijkl789)
                const compactData = profile.modsData.map(m => `${m.id}${m.type !== 'mod' ? '_'+m.type : ''}`).join('-');
                const shareUrl = `${window.location.origin}${window.location.pathname}?pack=${compactData}`;
                navigator.clipboard.writeText(shareUrl);
                alert("🔗 ¡Enlace ultraligero copiado! Ya no se romperá por el límite de caracteres.");
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
    
    if(btnOpenSaveModal) btnOpenSaveModal.addEventListener('click', () => {
        document.querySelector('.cart-panel').classList.remove('active-mobile');
        modalSave.classList.remove('hidden');
    });

    let uploadedIconBase64 = null;
    document.getElementById('pack-icon-input')?.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) { const reader = new FileReader(); reader.onload = function(evt) { uploadedIconBase64 = evt.target.result; }; reader.readAsDataURL(file); }
    });

// ==========================================
    // EXPORTACIÓN TURBO (Descargas en Paralelo + 3 Modos)
    // ==========================================
    const btnJustSave = document.getElementById('btn-just-save'); // El nuevo botón

    async function requestBuild(action = 'download_only') {
        const isSaving = (action === 'save_only' || action === 'save_download');
        const isDownloading = (action === 'download_only' || action === 'save_download');

        if (isSaving && !isLoggedIn) {
            alert('¡Alto! Necesitas Iniciar Sesión para guardar perfiles.');
            if(authModal) authModal.classList.remove('hidden');
            modalSave.classList.add('hidden');
            return;
        }

        try {
            const packName = (packNameInput && packNameInput.value.trim() !== '') ? packNameInput.value.trim() : 'Mi_Modpack';
            const mcVersion = versionSelect.value;
            const loader = loaderSelect.value;
            const isServerPack = document.getElementById('export-server-pack')?.checked;
            const isMrPack = document.getElementById('export-mrpack')?.checked;

            // Determinar qué botón apretó para ponerle el ícono de carga
            let activeBtn = btnJustDownload;
            if(action === 'save_only') activeBtn = btnJustSave;
            if(action === 'save_download') activeBtn = btnSaveAndDownload;

            if(activeBtn) { activeBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Procesando...'; activeBtn.disabled = true; }

            // 1. LÓGICA DE GUARDAR PERFIL
            if (isSaving) {
                const profiles = JSON.parse(localStorage.getItem('mis_modpacks_guardados') || '[]');
                profiles.push({ name: packName, mcVersion: mcVersion, modLoader: loader, modsData: window.modpackCart, iconBase64: uploadedIconBase64 });
                localStorage.setItem('mis_modpacks_guardados', JSON.stringify(profiles)); 
                loadMyProfiles();

                if(action === 'save_only') {
                    alert('✅ Perfil guardado correctamente en "Mis Modpacks".');
                    modalSave.classList.add('hidden');
                    if(activeBtn) { activeBtn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Solo Guardar Perfil'; activeBtn.disabled = false; }
                    return; // Terminamos aquí porque no quiere descargar
                }
            }

            // 2. LÓGICA DE DESCARGA RÁPIDA (PARALELA)
            if (isDownloading) {
                if (typeof JSZip === 'undefined') throw new Error("Falta la librería JSZip.");
                const zip = new JSZip();

                if (uploadedIconBase64) {
                    const base64Data = uploadedIconBase64.split(',')[1];
                    zip.file("icon.png", base64Data, {base64: true});
                }

                if(Object.keys(window.modConfigs).length > 0) {
                    const confFolder = zip.folder("config");
                    for (const modId in window.modConfigs) {
                        confFolder.file(window.modConfigs[modId].filename, window.modConfigs[modId].content);
                    }
                }

                let procesados = 0;
                const totalMods = window.modpackCart.length;

                if (isMrPack) {
                    // MRPACK: Índice JSON
                    if(activeBtn) activeBtn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Generando Índices MRPack...`;
                    const mrpackIndex = { formatVersion: 1, game: "minecraft", versionId: packName, name: packName, dependencies: { minecraft: mcVersion, [loader]: "*" }, files: [] };
                    
                    // Paralelizamos las consultas a la API (mucho más rápido)
                    await Promise.all(window.modpackCart.map(async (item) => {
                        try {
                            const versRes = await fetch(`https://api.modrinth.com/v2/project/${item.id}/version?game_versions=["${mcVersion}"]`);
                            const versData = await versRes.json();
                            if (versData && versData.length > 0 && versData[0].files.length > 0) {
                                const f = versData[0].files.find(fi => fi.primary) || versData[0].files[0];
                                let envData = { client: "required", server: "required" };
                                if (isServerPack) { const pRes = await fetch(`https://api.modrinth.com/v2/project/${item.id}`); const pData = await pRes.json(); if(pData.server_side === 'unsupported') return; }
                                let targetFolder = "mods"; if(item.type === 'shader') targetFolder = "shaderpacks"; else if(item.type === 'resourcepack') targetFolder = "resourcepacks";
                                mrpackIndex.files.push({ path: `${targetFolder}/${f.filename}`, hashes: { sha1: f.hashes.sha1, sha512: f.hashes.sha512 }, downloads: [f.url], fileSize: f.size, env: envData });
                            }
                        } catch(e) {}
                        finally {
                            procesados++;
                            if(activeBtn) activeBtn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Indexando (${procesados}/${totalMods})...`;
                        }
                    }));
                    zip.file("modrinth.index.json", JSON.stringify(mrpackIndex, null, 4));

                } else {
                    // ZIP CLÁSICO (Con lotes en paralelo)
                    const modsFolder = zip.folder("mods"); const shadersFolder = zip.folder("shaderpacks"); const resourceFolder = zip.folder("resourcepacks");
                    const wGamemode = document.getElementById('world-gamemode')?.value || 'survival';
                    let propsContent = `# Generado por MinePack Studio\ngamemode=${wGamemode}\n`;
                    const wSeed = document.getElementById('world-seed-input')?.value; if (wSeed && wSeed.trim() !== '') propsContent += `level-seed=${wSeed}\n`;
                    zip.file("server.properties", propsContent);

                    if (isServerPack) {
                        zip.file("eula.txt", "eula=true\n");
                        zip.file("start.bat", "@echo off\necho INICIANDO SERVIDOR...\njava -Xmx4G -Xms4G -jar server.jar nogui\npause");
                    }

                    // Acelerador: Procesamos de 10 en 10 para no colapsar la memoria, pero muchísimo más rápido que 1 por 1
                    const batchSize = 10;
                    for (let i = 0; i < totalMods; i += batchSize) {
                        const batch = window.modpackCart.slice(i, i + batchSize);
                        await Promise.all(batch.map(async (item) => {
                            try {
                                if (isServerPack && (item.type === 'shader' || item.type === 'resourcepack')) return; 
                                if (isServerPack) { const projRes = await fetch(`https://api.modrinth.com/v2/project/${item.id}`); const projData = await projRes.json(); if (projData.server_side === 'unsupported') return; }
                                
                                const versRes = await fetch(`https://api.modrinth.com/v2/project/${item.id}/version?game_versions=["${mcVersion}"]`);
                                const versData = await versRes.json();
                                if (versData && versData.length > 0 && versData[0].files.length > 0) {
                                    const fileObj = versData[0].files.find(f => f.primary) || versData[0].files[0];
                                    const fileRes = await fetch(fileObj.url);
                                    const fileBlob = await fileRes.blob();
                                    if (!isServerPack && item.type === 'shader') shadersFolder.file(fileObj.filename, fileBlob); else if (!isServerPack && item.type === 'resourcepack') resourceFolder.file(fileObj.filename, fileBlob); else modsFolder.file(fileObj.filename, fileBlob);
                                }
                            } catch(err) {} 
                            finally {
                                procesados++;
                                if(activeBtn) activeBtn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Descarga Turbo (${procesados}/${totalMods})...`;
                            }
                        }));
                    }
                }

                // Generación ZIP (con compression STORE es casi instantáneo)
                if(activeBtn) activeBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Finalizando ZIP...';
                const zipContent = await zip.generateAsync({ type: "blob", compression: "STORE" });
                const url = window.URL.createObjectURL(zipContent);
                const a = document.createElement('a'); a.style.display = 'none'; a.href = url;
                a.download = `${packName.replace(/\s+/g, '_')}${isServerPack ? '_SERVER' : ''}_${mcVersion}.${isMrPack ? 'mrpack' : 'zip'}`;
                document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url);
                modalSave.classList.add('hidden');
            }

        } catch (error) { 
            alert("Error al procesar: " + error.message); 
        } finally {
            // Restaurar botones a su estado original
            if(btnJustSave) { btnJustSave.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Solo Guardar Perfil'; btnJustSave.disabled = false; }
            if(btnJustDownload) { btnJustDownload.innerHTML = '<i class="ph-bold ph-file-zip"></i> Solo Descargar'; btnJustDownload.disabled = false; }
            if(btnSaveAndDownload) { btnSaveAndDownload.innerHTML = '<i class="ph-bold ph-download-simple"></i> Guardar y Descargar'; btnSaveAndDownload.disabled = false; }
        }
    }

if(btnJustSave) btnJustSave.addEventListener('click', () => requestBuild('save_only'));
    if(btnJustDownload) btnJustDownload.addEventListener('click', () => requestBuild('download_only'));
    if(btnSaveAndDownload) btnSaveAndDownload.addEventListener('click', () => requestBuild('save_download'));
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
    // COMPARADOR VISUAL DE SHADERS
    // ==========================================
    const shaderSliderInput = document.getElementById('shader-slider-input');
    const shaderImgTop = document.getElementById('shader-img-top');
    const shaderSliderLine = document.getElementById('shader-slider-line');
    const btnOpenShaderCompare = document.getElementById('btn-shader-compare');

    if (shaderSliderInput && shaderImgTop && shaderSliderLine) {
        shaderSliderInput.addEventListener('input', (e) => {
            const sliderValue = e.target.value;
            shaderImgTop.style.clipPath = `polygon(0 0, ${sliderValue}% 0, ${sliderValue}% 100%, 0 100%)`;
            shaderSliderLine.style.left = `${sliderValue}%`;
        });
    }

    if (btnOpenShaderCompare) {
        btnOpenShaderCompare.addEventListener('click', () => {
            document.getElementById('shader-compare-modal').classList.remove('hidden');
        });
    }

// ==========================================
    // AUTO-SCANNER JEI (SIN LÍMITES + MESA CRAFTEO + VANILLA ASSETS)
    // ==========================================
    const recipeViewer = document.getElementById('jei-recipe-viewer');
    const recipeContent = document.getElementById('jei-recipe-content');
    
    document.getElementById('btn-close-recipe')?.addEventListener('click', () => {
        if(recipeViewer) recipeViewer.style.display = 'none';
    });
async function runAutoScanJEI(modId, mcVers, loader) {
    const itemsGrid = document.getElementById('jei-items-grid');
    const mobsGrid = document.getElementById('jei-mobs-grid');
    
    const leftSidebar = document.querySelector('.jei-sidebar-left');
    const rightSidebar = document.querySelector('.jei-sidebar-right');
    const recipeViewer = document.getElementById('jei-recipe-viewer');
    
    // 1. Ocultar los paneles grises al instante de abrir un nuevo mod (para resetear estado anterior)
    if(leftSidebar) leftSidebar.style.display = 'none';
    if(rightSidebar) rightSidebar.style.display = 'none';

    // 2. Si faltan partes en el HTML, abortamos silenciosamente
    if(!itemsGrid || !mobsGrid) return;

    // 3. Mostramos las barras temporalmente para ver el spinner
    leftSidebar.style.display = 'block';
    rightSidebar.style.display = 'flex';
    
    if(recipeViewer) recipeViewer.style.display = 'none';

    // 4. Inyectamos los spinners (AHORA SÍ SERÁN VISIBLES PORQUE ARREGLAMOS EL HTML)
    itemsGrid.innerHTML = '<div class="muted-text text-sm" style="grid-column:1/-1; text-align:center; padding: 20px;"><i class="ph ph-spinner ph-spin"></i> Extrayendo el 100% de los archivos...</div>';
    mobsGrid.innerHTML = '<div class="muted-text text-sm" style="grid-column:1/-1; padding: 20px;"><i class="ph ph-spinner ph-spin"></i> Buscando entidades...</div>';

    try {
            const versRes = await fetch(`https://api.modrinth.com/v2/project/${modId}/version?game_versions=["${mcVers}"]&loaders=["${loader}"]`);
            const versData = await versRes.json();
            if (versData.length === 0 || versData[0].files.length === 0) throw new Error("Sin archivos Java.");

            const fileUrl = versData[0].files.find(f => f.primary)?.url || versData[0].files[0].url;
            const fileRes = await fetch(fileUrl);
            const fileBlob = await fileRes.blob();
            const zip = new JSZip();
            const unzipped = await zip.loadAsync(fileBlob);

            const allFiles = Object.keys(unzipped.files);
            
            // 1. Extraer Recetas (.json)
            const recipeFiles = allFiles.filter(p => p.includes('data/') && p.includes('recipes/') && p.endsWith('.json'));
            const parsedRecipes = [];
            for (let path of recipeFiles) {
                try {
                    const content = await unzipped.files[path].async('string');
                    parsedRecipes.push({ path: path, data: JSON.parse(content) });
                } catch(e) {}
            }

            // 2. Variables
            const uniqueItemNames = new Set();
            const uniqueMobNames = new Set();
            const modTexturesCache = {}; 
            
            let itemsHTML = '';
            let mobsHTML = '';
            let itemCount = 0; 
            let mobCount = 0;

            // 3. Procesar Archivos
            for (let path of allFiles) {
                if (path.endsWith('.png')) {
                    let rawName = path.split('/').pop().replace('.png', '');
                    
                    if ((path.includes('textures/item/') || path.includes('textures/block/')) && !uniqueItemNames.has(rawName)) {
                        uniqueItemNames.add(rawName);
                        itemCount++;
                        const base64 = await unzipped.files[path].async('base64');
                        modTexturesCache[rawName] = base64; 
                        const prettyName = rawName.replace(/_/g, ' ');
                        itemsHTML += `<div class="jei-item-slot" title="${prettyName}" onclick="openVisualRecipe('${rawName}', '${prettyName}')"><img src="data:image/png;base64,${base64}"></div>`;
                    }

                    if (path.includes('textures/entity/') && !uniqueMobNames.has(rawName)) {
                        uniqueMobNames.add(rawName);
                        mobCount++;
                        const base64 = await unzipped.files[path].async('base64');
                        const prettyName = rawName.replace(/_/g, ' ');
                        const imgSrc = `data:image/png;base64,${base64}`;
                        mobsHTML += `<div class="jei-item-slot" title="Ver Modelo 3D: ${prettyName}" style="border-color: #d97706 #fcd34d #fcd34d #d97706;" onclick="triggerMob3D('${prettyName}', '${imgSrc}')"><img src="${imgSrc}"></div>`;
                    }
                }
            }

            // 4. OCULTAR COLUMNAS GRISES COMPLETAS SI NO HAY NADA (Anti-Bordes)
            if (leftSidebar) leftSidebar.style.display = mobCount === 0 ? 'none' : 'block';
            if (rightSidebar) rightSidebar.style.display = itemCount === 0 ? 'none' : 'flex';

            if (itemsGrid) itemsGrid.innerHTML = itemCount === 0 ? '' : itemsHTML;
            if (mobsGrid) mobsGrid.innerHTML = mobCount === 0 ? '' : mobsHTML;

            // 5. Motor Visual Dinámico 
            // 5. Motor Visual Dinámico (Soporte Universal para Create, Mekanism, y Máquinas Raras)
            // 5. Motor Visual Dinámico Universal
            window.openVisualRecipe = (rawId, prettyName) => {
                if(!recipeViewer) return;
                const recipe = parsedRecipes.find(r => JSON.stringify(r.data).includes(rawId));
                recipeViewer.style.display = 'block';
                
                if (!recipe) {
                    recipeContent.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--muted);">No hay receta interna para <b>${prettyName}</b>.<br><br><i class="ph-bold ph-info" style="font-size:24px; margin-top:10px;"></i><br>Puede ser loot, generación de mundo o estar oculto.</div>`;
                    return;
                }

                const rData = recipe.data;
                const mcVersionFallback = document.getElementById('mod-version-select').value || '1.20.1';

                const renderSlot = (itemName, isResult = false, count = 1) => {
                    if (!itemName || itemName === '?') return `<div class="crafting-slot"></div>`;
                    let cleanName = itemName.split(':').pop().split('/').pop();
                    let imgSrc = modTexturesCache[cleanName];
                    let slotClass = isResult ? 'crafting-result-slot' : 'crafting-slot';
                    let imgSize = isResult ? 'width:40px; height:40px;' : 'width:28px; height:28px;';
                    let countBadge = count > 1 ? `<span class="crafting-count" style="position:absolute; bottom:2px; right:4px; font-weight:bold; font-size:14px; color:white; text-shadow:2px 2px 0 #000;">${count}</span>` : '';
                    
                    if (imgSrc) {
                        return `<div class="${slotClass}" title="${cleanName.replace(/_/g, ' ')}"><img src="data:image/png;base64,${imgSrc}" style="${imgSize}">${countBadge}</div>`;
                    } else {
                        let vanillaUrl = `https://assets.mcasset.cloud/${mcVersionFallback}/assets/minecraft/textures/item/${cleanName}.png`;
                        let vanillaBlockUrl = `https://assets.mcasset.cloud/${mcVersionFallback}/assets/minecraft/textures/block/${cleanName}.png`;
                        return `<div class="${slotClass}" title="${cleanName.replace(/_/g, ' ')}">
                            <img src="${vanillaUrl}" style="${imgSize}" onerror="this.onerror=null; this.src='${vanillaBlockUrl}'; this.onerror=function(){this.style.display='none'; this.nextElementSibling.style.display='flex';}">
                            <span class="crafting-slot-text" style="display:none; font-size: ${isResult? '10px' : '8px'};">${cleanName.substring(0,8)}</span>
                            ${countBadge}
                        </div>`;
                    }
                };

                // NUEVO: Extractor ultra agresivo de ítems para mods que anidan arrays
                const extractItem = (ing) => {
                    if (!ing) return '?';
                    if (Array.isArray(ing)) return extractItem(ing[0]); // Si es array, toma la primera variante
                    if (typeof ing === 'string') return ing;
                    return ing.item || ing.tag || '?';
                };

                let typeStr = rData.type || "Máquina Especial";
                let html = `<div class="recipe-visualizer" style="flex-direction: column; align-items: center; border:none; background:transparent; padding:0;">`;
                html += `<div style="color: var(--accent); font-weight: bold; margin-bottom: 10px; font-size: 0.85rem; text-transform: uppercase;"><i class="ph-bold ph-wrench"></i> ${typeStr.split(':').pop().replace(/_/g, ' ')}</div>`;
                html += `<div style="display: flex; align-items: center; justify-content: center; gap: 20px;">`;

                // Recopilamos inputs
                let inputs = [];
                if (rData.ingredients) inputs = Array.isArray(rData.ingredients) ? rData.ingredients : [rData.ingredients];
                else if (rData.ingredient) inputs = Array.isArray(rData.ingredient) ? rData.ingredient : [rData.ingredient];
                else if (rData.input) inputs = Array.isArray(rData.input) ? rData.input : [rData.input];
                else if (rData.inputs) inputs = Array.isArray(rData.inputs) ? rData.inputs : [rData.inputs];

                // Recopilamos outputs
                let outputs = [];
                if (rData.results) outputs = Array.isArray(rData.results) ? rData.results : [rData.results];
                else if (rData.result) outputs = Array.isArray(rData.result) ? rData.result : [rData.result];
                else if (rData.output) outputs = Array.isArray(rData.output) ? rData.output : [rData.output];
                else if (rData.outputs) outputs = Array.isArray(rData.outputs) ? rData.outputs : [rData.outputs];
                else outputs = [{ item: rawId }];

                // LÓGICA 1: HORNOS Y FOGATAS
                if (typeStr.includes("smelting") || typeStr.includes("blasting") || typeStr.includes("smoking") || typeStr.includes("campfire")) {
                    let inputItem = inputs.length > 0 ? extractItem(inputs[0]) : '?';
                    let time = rData.cookingtime ? `(${rData.cookingtime / 20}s)` : '';
                    html += renderSlot(inputItem);
                    html += `<div style="display:flex; flex-direction:column; align-items:center; color:var(--muted); margin:0 10px;"><i class="ph-fill ph-fire" style="color: #f59e0b; font-size: 24px;"></i><span style="font-size:10px;">${time}</span></div>`;
                    let outHTML = '';
                    outputs.forEach(out => { let rName = typeof out === 'string' ? out : (out.item || out.id || rawId); outHTML += renderSlot(rName, true, out.count || 1); });
                    html += `<div style="display:flex; gap: 5px;">${outHTML}</div>`;
                } 
                // LÓGICA 2: MESA CON PATRÓN (Soporta mesas vanilla y modded de cualquier tamaño)
                else if (rData.pattern && rData.key) {
                    const cols = rData.pattern[0].length;
                    html += `<div style="display:grid; grid-template-columns: repeat(${cols}, 40px); gap: 2px; background: #c6c6c6; padding: 6px; border: 2px solid #373737; border-top-color: #fff; border-left-color: #fff; border-radius: 4px;">`;
                    rData.pattern.forEach(line => {
                        for (let c = 0; c < cols; c++) {
                            let char = line[c];
                            if (char && char !== ' ' && rData.key && rData.key[char]) {
                                html += renderSlot(extractItem(rData.key[char]));
                            } else { 
                                html += renderSlot('?'); 
                            }
                        }
                    });
                    html += `</div><i class="ph-bold ph-arrow-right" style="font-size:28px; color:var(--muted); margin:0 10px;"></i>`;
                    let outHTML = '';
                    outputs.forEach(out => { let rName = typeof out === 'string' ? out : (out.item || out.id || rawId); outHTML += renderSlot(rName, true, out.count || 1); });
                    html += `<div style="display:flex; gap: 5px;">${outHTML}</div>`;
                } 
                // LÓGICA 3: MÁQUINAS SIN PATRÓN O CRAFTEOS SHAPELESS
                else if (inputs.length > 0) {
                    html += `<div style="display:flex; flex-wrap:wrap; gap:4px; max-width: 160px; justify-content: center; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">`;
                    inputs.forEach(ing => {
                        html += renderSlot(extractItem(ing));
                    });
                    html += `</div><div style="display:flex; flex-direction:column; align-items:center; margin:0 10px;"><i class="ph-bold ph-arrow-right" style="font-size:28px; color:var(--muted);"></i></div>`;
                    let outHTML = '';
                    outputs.forEach(out => { let rName = typeof out === 'string' ? out : (out.item || out.id || rawId); outHTML += renderSlot(rName, true, out.count || 1); });
                    html += `<div style="display:flex; gap: 5px;">${outHTML}</div>`;
                } 
                // LÓGICA 4: EXTREMADAMENTE RARO (Imposible de procesar, mostramos JSON como respaldo)
                else {
                    html += `<div style="color:var(--muted); font-size:0.8rem; text-align:center;">Máquina no estándar.<br>Código interno del mod:</div></div><pre style="font-size:10px; margin-top:10px; width:100%; text-align:left; background: var(--bg-main); padding: 10px; border-radius:6px; overflow-x:auto;">${JSON.stringify(rData, null, 2)}</pre>`;
                }

                html += `</div></div>`;
                recipeContent.innerHTML = html;
            };

            // 6. Lanzador Visual 3D
            window.triggerMob3D = (name, base64Src) => {
                const modal = document.getElementById('mob-3d-modal');
                if(!modal) return;
                document.getElementById('mob-3d-title').innerHTML = `<i class="ph-bold ph-user"></i> 3D: ${name.toUpperCase()}`;
                const bipedModel = document.getElementById('mc-biped-model');
                
                document.querySelectorAll('.mc-part').forEach(part => {
                    part.style.backgroundImage = `url(${base64Src})`;
                });
                
                if(bipedModel) bipedModel.classList.add('walking');
                modal.classList.remove('hidden');
            };

        } catch (error) {
            console.error("Error JEI:", error);
            if (leftSidebar) leftSidebar.style.display = 'none';
            if (rightSidebar) rightSidebar.style.display = 'none';
        }
    }

});

// ============================================================
    // MOTOR DE DESCARGA DIRECTA DE .JAR (+ Gestión de Librerías)
    // ============================================================

    // 1. Delegación de eventos para capturar los clics en los nuevos botones
    document.addEventListener('click', (e) => {
        // Buscamos si el clic fue en un botón de descarga o dentro de un icono de descarga
        const btn = e.target.closest('.btn-download-jar');
        if (btn) {
            const modId = btn.dataset.id;
            const modTitle = btn.dataset.title;
            if(modId) initiateSingleJarDownload(modId, modTitle);
        }
    });

    // 2. Función Principal de Descarga Directa
    async function initiateSingleJarDownload(modId, modTitle) {
        if(!confirm(`⚠️ ATENCIÓN: Esta acción descargará archivos .jar directos a tu carpeta de descargas.\n\n¿Estás seguro de querer descargar ${modTitle}?`)) return;

        const mcVers = document.getElementById('mod-version-select').value;
        const loader = document.getElementById('mod-loader-select').value;
        
        const loaderText = document.querySelector('.jei-sidebar-left') ? '<i class="ph ph-spinner ph-spin"></i> Conectando...' : 'Buscando...';
        // (Opcional) Podrías poner un spinner en el botón que pulsó
        
        try {
            // A. Verificamos compatibilidad y servidor
            const projRes = await fetch(`https://api.modrinth.com/v2/project/${modId}`);
            if(!projRes.ok) throw new Error("No se pudo conectar con Modrinth");
            const projData = await projRes.json();
            
            // Si la web está en modo "Server Pack", verificar si el mod es compatible con server
            const isServerMode = document.getElementById('export-server-pack')?.checked;
            if(isServerMode && projData.server_side === 'unsupported') {
                alert(`❌ Error: ${modTitle} NO es compatible con servidores.`);
                return;
            }

            // B. Buscamos la versión específica
            const versRes = await fetch(`https://api.modrinth.com/v2/project/${modId}/version?game_versions=["${mcVers}"]&loaders=["${loader}"]`);
            if(!versRes.ok) throw new Error("Error buscando versiones compatibles.");
            const versData = await versRes.json();
            
            if(versData.length === 0 || versData[0].files.length === 0) {
                alert(`❌ Error: No se encontró ninguna versión de .jar compatible con Minecraft ${mcVers} y ${loader} para ${modTitle}.`);
                return;
            }

            const primaryFile = versData[0].files.find(f => f.primary) || versData[0].files[0];
            const dependencies = versData[0].dependencies.filter(d => d.dependency_type === 'required' && d.project_id);

            let urlsToDownload = [primaryFile.url]; // Empezamos con el mod principal

            // C. Gestión Mágica de Librerías
            if(dependencies.length > 0) {
                if(confirm(`📦 ${modTitle} REQUIERE LIBRERÍAS:\n\nEste mod necesita ${dependencies.length} archivos adicionales (librerías) para funcionar correctamente.\n\n¿Deseas descargar TAMBIÉN las librerías necesarias automáticamente?`)) {
                    
                    // Buscamos los .jar de las librerías
                    for(let dep of dependencies) {
                        try {
                            const dVersRes = await fetch(`https://api.modrinth.com/v2/project/${dep.project_id}/version?game_versions=["${mcVers}"]&loaders=["${loader}"]`);
                            const dVersData = await dVersRes.json();
                            if(dVersData.length > 0 && dVersData[0].files.length > 0) {
                                const dFile = dVersData[0].files.find(f => f.primary) || dVersData[0].files[0];
                                urlsToDownload.push(dFile.url); // Añadimos la URL de la librería
                            }
                        } catch(depErr) {
                            console.error(`Error buscando librería ${dep.project_id}`);
                        }
                    }
                }
            }

            // D. EJECUCIÓN DE DESCARGAS MÚLTIPLES (¡Cuidado con los bloqueadores de pop-ups!)
            // La forma más segura de descargar .jar múltiples sin ZIP es usar iframes invisibles
            urlsToDownload.forEach((url, index) => {
                // Pequeño delay para no colapsar el navegador
                setTimeout(() => {
                    const iframe = document.createElement('iframe');
                    iframe.style.display = 'none';
                    iframe.src = url;
                    document.body.appendChild(iframe);
                    // Los eliminamos después de 2 minutos por seguridad
                    setTimeout(() => document.body.removeChild(iframe), 120000); 
                }, index * 500); // 0.5s entre cada descarga
            });

            if(urlsToDownload.length > 1) {
                alert(`🚀 Descarga Turbo Iniciada.\n\nSe están descargando ${urlsToDownload.length} archivos .jar limpios.\n\nSi el navegador te pregunta, dale permiso para 'Descargas Múltiples'.`);
            }

        } catch(err) {
            alert(`❌ Error en la descarga directa: ${err.message}`);
        }
    }

// ============================================================
    // IA MODPACK BUILDER PRO (Multilingüe + Descarga Directa)
    // ============================================================
    const btnAiBuilder = document.getElementById('btn-ai-builder');
    const aiModal = document.getElementById('ai-builder-modal');
    const aiPrompt = document.getElementById('ai-prompt-input');
    const aiTerminal = document.getElementById('ai-terminal');
    const btnGenerateAiDownload = document.getElementById('btn-generate-ai-download');
    const btnAiCancel = document.getElementById('btn-ai-cancel');

    if (btnAiBuilder && aiModal) {
        btnAiBuilder.addEventListener('click', () => {
            aiModal.classList.remove('hidden');
            aiTerminal.style.display = 'none';
            aiTerminal.innerHTML = '> IA Esperando órdenes en cualquier idioma...<br>';
            aiPrompt.value = '';
            btnGenerateAiDownload.disabled = false;
        });

        if(btnAiCancel) btnAiCancel.addEventListener('click', () => aiModal.classList.add('hidden'));

        const aiLog = (msg, type = 'info') => {
            aiTerminal.style.display = 'block';
            let color = '#4ade80';
            let icon = '>';
            if(type === 'warn') { color = '#f59e0b'; icon = '⚠️'; }
            if(type === 'error') { color = '#ef4444'; icon = '❌'; }
            if(type === 'success') { color = '#8b5cf6'; icon = '✨'; }
            
            aiTerminal.innerHTML += `<span style="color: ${color}">${icon} ${msg}</span><br>`;
            aiTerminal.scrollTop = aiTerminal.scrollHeight;
        };

        btnGenerateAiDownload.addEventListener('click', async () => {
            let promptRaw = aiPrompt.value;
            let prompt = promptRaw.toLowerCase().trim();
            if (prompt.length < 5) return alert("¡Sé un poco más descriptivo, por favor!");

            btnGenerateAiDownload.disabled = true;
            btnGenerateAiDownload.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Procesando tu cerebro...';
            aiLog("Leyendo pensamientos (Analizando prompt)...");
            
            const mcVers = document.getElementById('mod-version-select').value;
            const loader = document.getElementById('mod-loader-select').value;
            
            // 1. EXTRACTOR DE ESPECIFICACIONES NUMÉRICAS (Regex avanzado)
            // Busca patrones como "10 mods", "around 20", "un modpack de 5"
            let targetModCount = 15; // Por defecto
            const numMatch = prompt.match(/(\d+)\s*(mod|mods|archivo|files)/i);
            if(numMatch) {
                targetModCount = parseInt(numMatch[1]);
                if(targetModCount < 1) targetModCount = 1;
                if(targetModCount > 60) {
                    targetModCount = 60;
                    aiLog(`Límite de seguridad alcanzado. Reduciendo a 60 mods para no saturar Modrinth.`, 'warn');
                } else {
                    aiLog(`Entendido: Buscaremos aproximadamente ${targetModCount} mods coherentes.`, 'success');
                }
            }

            // 2. MOTOR DE TRADUCCIÓN/DETECCIÓN MULTILINGÜE
            // Usamos un diccionario de sinónimos clave que mapean a categorías de Modrinth
            const categoryDictionary = [
                { cat: 'adventure', keywords: ['aventura', 'adventure', 'explorar', 'explore', 'exploring', 'dungeon', 'mazmorra'] },
                { cat: 'magic', keywords: ['magia', 'magic', 'sorcery', 'hechizo', 'spell', 'wizard', 'witch', 'bruja'] },
                { cat: 'technology', keywords: ['tecnologia', 'technology', 'tech', 'industrial', 'maquina', 'machine', 'factory', 'create'] },
                { cat: 'combat', keywords: ['combate', 'combat', 'pve', 'pvp', 'dificil', 'hardcore', 'hard', 'harder', 'jefe', 'boss'] },
                { cat: 'decoration', keywords: ['decoracion', 'decoration', 'mueble', 'furniture', 'bonito', 'pretty'] },
                { cat: 'mobs', keywords: ['criatura', 'criaturas', 'creatures', 'animal', 'animales', 'mods', 'dragones', 'dragon'] },
                { cat: 'food', keywords: ['comida', 'food', 'cultivo', 'farming', 'agriculture', 'granjas'] },
                { cat: 'optimization', keywords: ['optimizado', 'optimized', 'fps', 'rendimiento', 'performance', 'performance', 'lag'] },
                { cat: 'mechanics', keywords: ['mecánicas', 'mechanics', 'animación', 'animations', 'mo bends', 'bends', 'dynamic', 'dinamico'] } // Aquí atrapamos "animaciones"
            ];

            let detectedCats = [];
            categoryDictionary.forEach(entry => {
                if(entry.keywords.some(kw => prompt.includes(kw))) {
                    detectedCats.push(entry.cat);
                }
            });

            // Si no detecta nada, usamos la primera palabra como keyword libre
            if (detectedCats.length === 0) {
                const fallback = prompt.split(' ')[0];
                detectedCats.push(`q=${fallback}`); // Busqueda libre
                aiLog(`Idioma no reconocido o tema muy específico. Buscando libremente: "${fallback}"`);
            } else {
                aiLog(`Interpretando intenciones: Temas detectados [ ${detectedCats.join(', ')} ]`);
            }

            let initialModsToFetch = [];
            
            // 3. BASE IMPRESCINDIBLE (JEI, etc)
            const qol = ['jei', 'mouse-tweaks', 'appleskin'];
            for(let slug of qol) initialModsToFetch.push(slug);

            // 4. PAQUETE DE RENDIMIENTO (Si se detecta)
            if(detectedCats.includes('optimization')) {
                aiLog("Configurando módulo de ultra-rendimiento...");
                const fps = ['sodium', 'lithium', 'ferrite-core']; // Modrinth mapea sodium -> rubidium/embeddium automáticamente en forge
                for(let slug of fps) initialModsToFetch.push(slug);
                detectedCats = detectedCats.filter(c => c !== 'optimization'); // Limpiamos para no volver a buscarlo
            }

            // 5. BÚSQUEDA DISTRIBUIDA EN MODRINTH
            // Repartimos el límite de mods entre las categorías detectadas
            const modsPerCat = targetModCount > 5 ? Math.ceil((targetModCount - initialModsToFetch.length) / detectedCats.length) : 1;
            
            for (let cat of detectedCats) {
                try {
                    let searchUrl = `https://api.modrinth.com/v2/search?limit=${modsPerCat}&index=relevance&facets=[["versions:${mcVers}"],["categories:${loader}"],["project_type:mod"]]`;
                    if(cat.startsWith('q=')) {
                        searchUrl += `&query=${cat.substring(2)}`;
                    } else {
                        searchUrl += `&facets=[["categories:${cat}"]]`;
                    }
                    
                    const res = await fetch(searchUrl);
                    const data = await res.json();
                    data.hits.forEach(m => initialModsToFetch.push(m.project_id));
                } catch(e) {
                    aiLog(`Error buscando la categoría ${cat}`, 'error');
                }
            }

            // 6. INSTALADOR NEURONAL RECURSIVO (Ignora el carrito, crea lista temporal)
            aiLog(`Compilando lista final y resolviendo dependencias recursivamente...`);
            let tempAiCart = []; // Esta es la lista que se irá llenando
            let procesados = 0;
            const totalIniciales = [...new Set(initialModsToFetch)];

            const resolveDepsAndAddTemp = async (modId) => {
                // Prevenir duplicados en la lista temporal
                if(tempAiCart.some(m => m.id === modId)) return;

                try {
                    const pRes = await fetch(`https://api.modrinth.com/v2/project/${modId}`);
                    if(!pRes.ok) return;
                    const pData = await pRes.json();
                    
                    // Verificar versión específica (Mismo MC y Loader)
                    const vRes = await fetch(`https://api.modrinth.com/v2/project/${modId}/version?game_versions=["${mcVers}"]&loaders=["${loader}"]`);
                    const vData = await vRes.json();
                    
                    if (vData.length > 0) {
                        tempAiCart.push({ id: pData.id, title: pData.title, type: 'mod' });
                        procesados++;
                        aiLog(`[${procesados}] Sincronizando ${pData.title}...`);

                        // Buscar dependencias recursivamente
                        const deps = vData[0].dependencies.filter(d => d.dependency_type === 'required' && d.project_id);
                        for (let d of deps) {
                            await resolveDepsAndAddTemp(d.project_id); // Llamada recursiva mágica
                        }
                    }
                } catch(e) {}
            };

            // Ejecutar el resolutor de dependencias para cada mod base
            for(let id of totalIniciales) {
                await resolveDepsAndAddTemp(id);
                aiTerminal.scrollTop = aiTerminal.scrollHeight; // Auto-scroll
            }

            if(tempAiCart.length === 0) {
                aiLog("Error crítico: No se encontró ningún mod compatible con tu versión. Ensamblaje cancelado.", 'error');
                btnGenerateAiDownload.innerHTML = '<i class="ph-bold ph-brain-cell"></i> Reintentar';
                btnGenerateAiDownload.disabled = false;
                return;
            }

            // 7. EJECUCIÓN DEL MOTOR DESCARGA TURBO (Integración directa)
            aiLog(`Ensamblaje completado con ${tempAiCart.length} mods. Conectando con el motor de descarga turbo...`, 'success');
            btnGenerateAiDownload.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Empaquetando ZIP...';

            // ESTA ES LA MAGIA: Llamamos a requestBuild pasándole la lista temporal
            try {
                // Modificamos temporalmente la variable global solo para la ejecución
                const originalCart = window.modpackCart;
                window.modpackCart = tempAiCart; 
                
                // Usamos la acción 'download_only' para que no lo guarde en localstorage
                await requestBuild('download_only');
                
                // Restauramos el carrito original
                window.modpackCart = originalCart;

                aiLog(`¡Felicidades! Tu modpack está listo y debería haberse descargado automáticamente.`, 'success');
                btnGenerateAiDownload.innerHTML = '<i class="ph-bold ph-check-square"></i> ¡Modpack Generado!';
                setTimeout(() => {
                    aiModal.classList.add('hidden');
                    btnGenerateAiDownload.innerHTML = '<i class="ph-bold ph-lightning"></i> Generar y Descargar Modpack Directo';
                    btnGenerateAiDownload.disabled = false;
                }, 4000);

            } catch(e) {
                aiLog(`Falló la fase de empaquetado final: ${e.message}`, 'error');
                btnGenerateAiDownload.innerHTML = '<i class="ph-bold ph-brain-cell"></i> Reintentar ZIP';
                btnGenerateAiDownload.disabled = false;
            }

            

        });
    }
