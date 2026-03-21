document.addEventListener('DOMContentLoaded', async () => {

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
    let modpackCart = []; 
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
            const isAdded = modpackCart.some(item => item.id === mod.project_id);
            
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
                    const deps = await getRequiredDependencies(this.dataset.id, versionSelect.value, loaderSelect.value);
                    if (deps && deps.length > 0) {
                        const missingDeps = deps.filter(dep => !modpackCart.some(item => item.id === dep.id));
                        if (missingDeps.length > 0) {
                            showEpicDepsModal({ id: this.dataset.id, title: this.dataset.title, type: this.dataset.type }, missingDeps, this);
                            this.innerHTML = originalHtml; this.disabled = false; return; 
                        }
                    }
                }

                modpackCart.push({ id: this.dataset.id, title: this.dataset.title, type: this.dataset.type });
                updateCartUI();
                this.innerHTML = '<i class="ph-bold ph-check"></i> Añadido'; this.style.background = 'var(--success)'; this.style.color = 'white';
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
            if (!modpackCart.some(item => item.id === mainMod.id)) modpackCart.push({ id: mainMod.id, title: mainMod.title, type: mainMod.type || 'mod' });
            missingDeps.forEach(dep => { if (!modpackCart.some(item => item.id === dep.id)) modpackCart.push({ id: dep.id, title: dep.title, type: 'mod' }); });
            updateCartUI();
            if(triggerButton) { triggerButton.innerHTML = '<i class="ph-bold ph-check"></i> Añadido'; triggerButton.style.background = 'var(--success)'; triggerButton.disabled = true; }
            modal.classList.add('hidden');
        };
        modal.classList.remove('hidden');
    }

    function updateCartUI() {
        cartList.innerHTML = '';
        if (modpackCart.length === 0) {
            document.getElementById('empty-cart-msg').style.display = 'block';
            if(btnOpenSaveModal) btnOpenSaveModal.disabled = true; 
        } else {
            document.getElementById('empty-cart-msg').style.display = 'none';
            if(btnOpenSaveModal) btnOpenSaveModal.disabled = false;

            modpackCart.forEach((item, index) => {
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
                            <span class="cart-item-title" style="font-weight:600; font-size:0.85rem; color:var(--text-main); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:160px;">${item.title}</span>
                            <span class="cart-item-type" style="font-size:0.65rem; color:${typeColor}; text-transform:uppercase; font-weight:700;">${typeText}</span>
                        </div>
                    </div>
                    <button class="btn-remove" data-index="${index}" style="background:transparent; border:none; color:var(--danger); cursor:pointer;"><i class="ph-bold ph-trash"></i></button>
                `;
                cartList.appendChild(li);
            });
            document.querySelectorAll('.btn-remove').forEach(btn => btn.addEventListener('click', function() { modpackCart.splice(this.dataset.index, 1); updateCartUI(); fetchRealMods(false); }));
        }

        const mobileBtn = document.getElementById('mobile-cart-toggle-btn');
        if(mobileBtn) mobileBtn.innerHTML = `<i class="ph-bold ph-package"></i> <span class="badge">${modpackCart.length}</span>`;
    }

    // ==========================================
    // CARGAR MIS PERFILES DESDE LOCALSTORAGE (SIN BACKEND)
    // ==========================================
    function loadMyProfiles() {
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
        profiles.forEach(p => {
            const modsCount = p.modsData ? p.modsData.length : 0;
            grid.innerHTML += `
                <div class="profile-card panel" style="padding: 15px; border-radius: 12px; border: 1px solid var(--border-color); margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="margin-bottom: 5px;">${p.name}</h3>
                        <p class="muted-text text-sm mb-5"><i class="ph-bold ph-tag"></i> ${p.mcVersion} ${p.modLoader}</p>
                        <p class="muted-text text-sm"><i class="ph-bold ph-puzzle-piece"></i> ${modsCount} mods</p>
                    </div>
                    <button class="btn btn-secondary" onclick="alert('Se descargará pronto...')"><i class="ph-bold ph-download-simple"></i></button>
                </div>
            `;
        });
    }

    // ==========================================
    // EXPORTACIÓN 100% EN NAVEGADOR (USA JSZIP, NO BACKEND)
    // ==========================================
    const modalSave = document.getElementById('save-pack-modal');
    const btnJustDownload = document.getElementById('btn-just-download');
    const btnSaveAndDownload = document.getElementById('btn-confirm-save-download');
    const packNameInput = document.getElementById('pack-name-input');
    
    if(btnOpenSaveModal) btnOpenSaveModal.addEventListener('click', () => modalSave.classList.remove('hidden'));

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
            
            if(btn) { btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Procesando...'; btn.disabled = true; }

            // GUARDAR PERFIL EN LOCALSTORAGE (Para que funcione sin backend en Cloudflare)
            if (isSaving) {
                const profiles = JSON.parse(localStorage.getItem('mis_modpacks_guardados') || '[]');
                profiles.push({ name: packName, mcVersion: mcVersion, modLoader: loader, modsData: modpackCart });
                localStorage.setItem('mis_modpacks_guardados', JSON.stringify(profiles));
                loadMyProfiles();
            }

            // CREAR ZIP EN EL NAVEGADOR (Requiere JSZip en el index.html)
            if (typeof JSZip === 'undefined') throw new Error("Falta la librería JSZip. Revisa el Paso 1.");

            const zip = new JSZip();
            const modsFolder = zip.folder("mods");
            const shadersFolder = zip.folder("shaderpacks");
            const resourceFolder = zip.folder("resourcepacks");

            for (let i = 0; i < modpackCart.length; i++) {
                const item = modpackCart[i];
                if(btn) btn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Descargando (${i+1}/${modpackCart.length})...`;

                const versRes = await fetch(`https://api.modrinth.com/v2/project/${item.id}/version?game_versions=["${mcVersion}"]`);
                const versData = await versRes.json();

                if (versData && versData.length > 0 && versData[0].files.length > 0) {
                    const fileObj = versData[0].files.find(f => f.primary) || versData[0].files[0];
                    const fileRes = await fetch(fileObj.url);
                    const fileBlob = await fileRes.blob();
                    
                    if (item.type === 'shader') shadersFolder.file(fileObj.filename, fileBlob);
                    else if (item.type === 'resourcepack') resourceFolder.file(fileObj.filename, fileBlob);
                    else modsFolder.file(fileObj.filename, fileBlob);
                }
            }

            if(btn) btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Empaquetando ZIP...';
            const zipContent = await zip.generateAsync({ type: "blob" });

            const url = window.URL.createObjectURL(zipContent);
            const a = document.createElement('a'); a.style.display = 'none'; a.href = url;
            a.download = `${packName.replace(/\s+/g, '_')}_${mcVersion}.zip`;
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

    // ==========================================
    // CREAR BOTÓN FLOTANTE MÓVIL AL INICIAR
    // ==========================================
    const mobileBtn = document.createElement('button');
    mobileBtn.id = 'mobile-cart-toggle-btn';
    mobileBtn.className = 'mobile-cart-toggle hidden-desktop';
    mobileBtn.innerHTML = `<i class="ph-bold ph-package"></i> <span class="badge">0</span>`;
    document.body.appendChild(mobileBtn);

    mobileBtn.addEventListener('click', () => {
        const cart = document.querySelector('.cart-panel');
        cart.classList.toggle('active-mobile');
        mobileBtn.innerHTML = cart.classList.contains('active-mobile') ? `<i class="ph-bold ph-x"></i>` : `<i class="ph-bold ph-package"></i> <span class="badge">${modpackCart.length}</span>`;
    });
});
