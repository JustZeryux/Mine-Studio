document.addEventListener('DOMContentLoaded', async () => {

    // ==========================================
    // 1. VARIABLES GLOBALES
    // ==========================================
    window.modConfigs = {}; 
    const urlParams = new URLSearchParams(window.location.search);
    const sharedPack = urlParams.get('pack');
    window.modpackCart = [];
    let currentFilter = 'mod';
    let currentCategory = '';
    let currentOffset = 0; 
    let isFetchingMods = false;

    // Elementos UI principales
    const searchInput = document.getElementById('mod-search-input');
    const sortSelect = document.getElementById('mod-sort-select');
    const versionSelect = document.getElementById('mod-version-select');
    const loaderSelect = document.getElementById('mod-loader-select');
    const modsGrid = document.getElementById('mods-grid');
    const btnLoadMore = document.getElementById('btn-load-more');
    const cartList = document.getElementById('cart-list');
    const btnOpenSaveModal = document.getElementById('btn-open-save-modal');
    const authModal = document.getElementById('auth-modal');
    const btnTemplateRpg = document.getElementById('btn-template-rpg');
    const btnTemplateTech = document.getElementById('btn-template-tech');
    const btnFpsBoost = document.getElementById('btn-fps-boost');
    const btnRandomizer = document.getElementById('btn-randomizer'); // Botón de la Ruleta

    // ==========================================
    // 2. SISTEMA DE SESIONES (AUTENTICACIÓN)
    // ==========================================
    const isLoggedIn = localStorage.getItem('usuario_token'); 
    const profileSection = document.querySelector('.profile-section');

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
    // 3. NAVEGACIÓN Y VISTAS
    // ==========================================
    const navButtons = document.querySelectorAll('.nav-btn');
    const views = { 
        'mods': document.getElementById('view-mods'), 
        'worlds': document.getElementById('view-worlds'), 
        'profiles': document.getElementById('view-profiles') 
    };
    
    navButtons.forEach(btn => btn.addEventListener('click', () => {
        if(btn.id === 'btn-ai-builder') return; // Ignoramos el botón de la IA aquí
        navButtons.forEach(b => b.classList.remove('active')); 
        btn.classList.add('active');
        
        Object.values(views).forEach(v => v.classList.add('hidden')); 
        views[btn.getAttribute('data-target')].classList.remove('hidden');
        
        if (btn.getAttribute('data-target') === 'profiles') window.loadMyProfiles();
    }));

    // ==========================================
    // 4. INSTALADOR DE MODPACKS COMPARTIDOS
    // ==========================================
    if (sharedPack) {
        try {
            let parsedItems = [];
            if (sharedPack.startsWith('%') || sharedPack.includes('=')) {
                parsedItems = JSON.parse(atob(decodeURIComponent(sharedPack)));
            } else {
                const items = sharedPack.split('-');
                parsedItems = items.map(item => {
                    const parts = item.split('_');
                    return { id: parts[0], title: 'Cargando...', type: parts[1] || 'mod' };
                });
            }

            const sharedModal = document.getElementById('shared-pack-modal');
            const sharedList = document.getElementById('shared-pack-list');
            const btnInstall = document.getElementById('btn-install-shared');
            const btnCancel = document.getElementById('btn-cancel-shared');

            if(sharedModal) {
                sharedModal.classList.remove('hidden'); 
                window.history.replaceState({}, document.title, window.location.pathname);

                const ids = parsedItems.map(m => `"${m.id}"`).join(',');
                if(ids) {
                    fetch(`https://api.modrinth.com/v2/projects?ids=[${ids}]`)
                        .then(r => r.json())
                        .then(data => {
                            sharedList.innerHTML = '';
                            const projectMap = {};
                            data.forEach(p => projectMap[p.id] = p);

                            parsedItems.forEach(item => {
                                const proj = projectMap[item.id];
                                if(proj) {
                                    item.title = proj.title;
                                    const icon = proj.icon_url || 'https://via.placeholder.com/48/18181b/ffffff?text=?';
                                    const desc = proj.description ? proj.description.substring(0, 75) + '...' : 'Sin descripción disponible.';
                                    let typeColor = 'var(--accent)', typeText = 'MOD', iconType = 'ph-puzzle-piece';
                                    
                                    if(item.type === 'shader') { typeColor = '#f59e0b'; typeText = 'SHADER'; iconType = 'ph-aperture'; }
                                    else if(item.type === 'resourcepack') { typeColor = '#10b981'; typeText = 'TEXTURA'; iconType = 'ph-paint-brush'; }

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

                            btnInstall.onclick = async () => {
                                btnInstall.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Empaquetando ZIP...';
                                btnInstall.disabled = true;
                                try {
                                    window.modpackCart = [];
                                    parsedItems.forEach(pi => {
                                        if(!window.modpackCart.some(cartItem => cartItem.id === pi.id)) window.modpackCart.push(pi);
                                    });
                                    window.updateCartUI();
                                    await window.requestBuild('download_only');
                                    sharedModal.classList.add('hidden');
                                    alert(`✅ ¡Felicidades! Tu Modpack compartido se ha descargado correctamente.`);
                                } catch(e) {
                                    alert(`❌ Hubo un error al empaquetar el ZIP: ${e.message}`);
                                } finally {
                                    btnInstall.innerHTML = '<i class="ph-bold ph-download-simple"></i> Instalar Modpack';
                                    btnInstall.disabled = false;
                                }
                            };

                            btnCancel.onclick = () => sharedModal.classList.add('hidden');
                        });
                }
            }
        } catch(e) { alert("El enlace del modpack está corrupto o es inválido."); }
    }

    // ==========================================
    // 5. MOTOR UNIFICADO DE EXPORTACIÓN (ZIP, SERVER, MRPACK)
    // ==========================================
    const modalSave = document.getElementById('save-pack-modal');
    const btnJustDownload = document.getElementById('btn-just-download');
    const btnSaveAndDownload = document.getElementById('btn-confirm-save-download');
    const btnJustSave = document.getElementById('btn-just-save');
    const packNameInput = document.getElementById('pack-name-input');
    
    if(btnOpenSaveModal) btnOpenSaveModal.addEventListener('click', () => {
        document.querySelector('.cart-panel').classList.remove('active-mobile');
        modalSave.classList.remove('hidden');
    });

    window.requestBuild = async function(action = 'download_only') {
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

            let activeBtn = btnJustDownload;
            if(action === 'save_only') activeBtn = btnJustSave;
            if(action === 'save_download') activeBtn = btnSaveAndDownload;

            if(activeBtn) { activeBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Procesando...'; activeBtn.disabled = true; }

            // Lógica de Guardado en Nube (Local)
            if (isSaving) {
                const profiles = JSON.parse(localStorage.getItem('mis_modpacks_guardados') || '[]');
                profiles.push({ name: packName, mcVersion: mcVersion, modLoader: loader, modsData: window.modpackCart, iconBase64: null });
                localStorage.setItem('mis_modpacks_guardados', JSON.stringify(profiles)); 
                window.loadMyProfiles();

                if(action === 'save_only') {
                    alert('✅ Perfil guardado correctamente en "Mis Modpacks".');
                    modalSave.classList.add('hidden');
                    if(activeBtn) { activeBtn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Solo Guardar Perfil'; activeBtn.disabled = false; }
                    return; 
                }
            }

            // Lógica de Descarga y Ensamblado ZIP
            if (isDownloading) {
                if (typeof JSZip === 'undefined') throw new Error("Falta la librería JSZip.");
                const zip = new JSZip();

                // Añadir configuraciones manuales
                if(Object.keys(window.modConfigs).length > 0) {
                    const confFolder = zip.folder("config");
                    for (const modId in window.modConfigs) { confFolder.file(window.modConfigs[modId].filename, window.modConfigs[modId].content); }
                }

                let procesados = 0;
                const totalMods = window.modpackCart.length;

                // --- FORMATO MRPACK ---
                if (isMrPack) {
                    if(activeBtn) activeBtn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Generando Índices MRPack...`;
                    const mrpackIndex = { formatVersion: 1, game: "minecraft", versionId: packName, name: packName, dependencies: { minecraft: mcVersion, [loader]: "*" }, files: [] };
                    
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
                        finally { procesados++; if(activeBtn) activeBtn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Indexando (${procesados}/${totalMods})...`; }
                    }));
                    zip.file("modrinth.index.json", JSON.stringify(mrpackIndex, null, 4));

                } else {
                    // --- FORMATO ZIP CLÁSICO Y SERVER PACK ---
                    const modsFolder = zip.folder("mods"); const shadersFolder = zip.folder("shaderpacks"); const resourceFolder = zip.folder("resourcepacks");
                    const wGamemode = document.getElementById('world-gamemode')?.value || 'survival';
                    let propsContent = `# Generado por MinePack Studio\ngamemode=${wGamemode}\n`;
                    const wSeed = document.getElementById('world-seed-input')?.value; if (wSeed && wSeed.trim() !== '') propsContent += `level-seed=${wSeed}\n`;
                    zip.file("server.properties", propsContent);

                    // INYECCIÓN MAGNÉTICA DE SERVER PACK (.bat y EULA)
                    if (isServerPack) {
                        zip.file("eula.txt", "eula=true\n");
                        zip.file("iniciar_servidor.bat", "@echo off\ncolor 0a\ntitle Servidor CoreMod\necho Iniciando servidor con 4GB de RAM...\njava -Xms4G -Xmx4G -jar server.jar nogui\npause");
                        zip.file("iniciar_servidor.sh", "#!/bin/bash\njava -Xms4G -Xmx4G -jar server.jar nogui");
                        zip.file("LEER_IMPORTANTE.txt", "=== TU SERVER PACK ESTA LISTO ===\n1. Descarga el archivo de Forge/Fabric y mételo aquí.\n2. Renómbralo a 'server.jar'.\n3. Ejecuta iniciar_servidor.bat\n¡Mods listos en la carpeta /mods!");
                    }

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
                            finally { procesados++; if(activeBtn) activeBtn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Descarga Turbo (${procesados}/${totalMods})...`; }
                        }));
                    }
                }

                if(activeBtn) activeBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Finalizando ZIP...';
                const zipContent = await zip.generateAsync({ type: "blob", compression: "STORE" });
                const url = window.URL.createObjectURL(zipContent);
                const a = document.createElement('a'); a.style.display = 'none'; a.href = url;
                
                // Concatenación Segura de Nombre
                const cleanName = packName.replace(/\s+/g, '_');
                let ext = isMrPack ? "mrpack" : "zip";
                let suffix = isServerPack ? "_SERVER" : "";
                a.download = cleanName + suffix + "_" + mcVersion + "." + ext;
                
                document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url);
                modalSave.classList.add('hidden');
            }

        } catch (error) { 
            alert("Error al procesar: " + error.message); 
        } finally {
            if(btnJustSave) { btnJustSave.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Solo Guardar Perfil'; btnJustSave.disabled = false; }
            if(btnJustDownload) { btnJustDownload.innerHTML = '<i class="ph-bold ph-file-zip"></i> Solo Descargar'; btnJustDownload.disabled = false; }
            if(btnSaveAndDownload) { btnSaveAndDownload.innerHTML = '<i class="ph-bold ph-download-simple"></i> Guardar y Descargar'; btnSaveAndDownload.disabled = false; }
        }
    };

    if(btnJustSave) btnJustSave.addEventListener('click', () => window.requestBuild('save_only'));
    if(btnJustDownload) btnJustDownload.addEventListener('click', () => window.requestBuild('download_only'));
    if(btnSaveAndDownload) btnSaveAndDownload.addEventListener('click', () => window.requestBuild('save_download'));

    // ==========================================
    // 6. API DE MODRINTH (Buscador y Render)
    // ==========================================
    const updateSearch = () => {
        const cartLabel = document.getElementById('cart-version-label');
        if(cartLabel) cartLabel.textContent = `${versionSelect.value} ${loaderSelect.options[loaderSelect.selectedIndex].text}`;
        fetchRealMods(false);
    };

    sortSelect.addEventListener('change', updateSearch); versionSelect.addEventListener('change', updateSearch); loaderSelect.addEventListener('change', updateSearch);
    let timeout = null; searchInput.addEventListener('input', () => { clearTimeout(timeout); timeout = setTimeout(updateSearch, 600); });

    const chips = document.querySelectorAll('.chip');
    chips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            chips.forEach(c => c.classList.remove('active')); e.currentTarget.classList.add('active');
            currentCategory = e.currentTarget.dataset.cat; updateSearch();
        });
    });

    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterButtons.forEach(b => b.classList.remove('active')); e.currentTarget.classList.add('active');
            currentFilter = e.currentTarget.dataset.filter; 
            const chipsContainer = document.getElementById('category-chips-container');
            if(currentFilter === 'mod') { if(chipsContainer) chipsContainer.style.display = 'flex'; } 
            else {
                if(chipsContainer) chipsContainer.style.display = 'none';
                currentCategory = ""; chips.forEach(c => c.classList.remove('active'));
                if(chips.length) chips[0].classList.add('active');
            }
            fetchRealMods(false);
        });
    });

    const tagIcons = { 'technology': '<i class="ph-fill ph-cpu"></i>', 'magic': '<i class="ph-fill ph-sparkle"></i>', 'adventure': '<i class="ph-fill ph-sword"></i>', 'mobs': '<i class="ph-fill ph-skull"></i>', 'worldgen': '<i class="ph-fill ph-tree"></i>', 'equipment': '<i class="ph-fill ph-shield"></i>', 'optimization': '<i class="ph-fill ph-rocket"></i>', 'library': '<i class="ph-fill ph-books"></i>' };

    async function fetchRealMods(isAppend = false) {
        if (isFetchingMods) return;
        isFetchingMods = true;

        if (!isAppend) {
            currentOffset = 0;
            modsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 60px;"><i class="ph ph-spinner ph-spin" style="font-size: 40px;"></i><p>Conectando con la base de datos global...</p></div>`;
            if(btnLoadMore) btnLoadMore.style.display = 'none';
        } else { 
            if(btnLoadMore) { btnLoadMore.style.display = 'block'; btnLoadMore.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Cargando base de datos...'; } 
        }

        try {
            let queryType = currentFilter === 'library' ? 'mod' : currentFilter;
            let facets = [[`versions:${versionSelect.value}`], [`project_type:${queryType}`]];
            if (queryType === 'mod') facets.push([`categories:${loaderSelect.value}`]);
            if (currentFilter === 'mod') {
                facets.push(["categories!=library"]); 
                if (currentCategory !== "") facets.push([`categories:${currentCategory}`]);
            } else if (currentFilter === 'library') { facets.push(["categories:library"]); }

            const res = await fetch(`https://api.modrinth.com/v2/search?query=${searchInput.value}&facets=${encodeURIComponent(JSON.stringify(facets))}&index=${sortSelect.value}&limit=50&offset=${currentOffset}`);
            const data = await res.json();
            
            if (!isAppend) modsGrid.innerHTML = '';
            
            if (data.hits.length === 0 && !isAppend) {
                modsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px;">No se encontraron resultados para estos filtros.</div>';
            } else {
                renderRealMods(data.hits);
                if(data.hits.length === 50) { if(btnLoadMore) btnLoadMore.style.display = 'block'; } 
                else { if(btnLoadMore) btnLoadMore.style.display = 'none'; }
            }
        } catch (error) { 
            if(!isAppend) modsGrid.innerHTML = '<div style="grid-column: 1/-1; color: var(--danger); text-align:center;">Error de API.</div>'; 
        } finally {
            isFetchingMods = false;
        }
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

    const lightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    if(lightbox) lightbox.addEventListener('click', () => lightbox.classList.add('hidden'));

    function renderRealMods(mods) {
        mods.forEach(mod => {
            const card = document.createElement('div'); card.className = 'mod-card';
            const iconUrl = mod.icon_url || 'https://via.placeholder.com/80/18181b/ffffff?text=?';
            const bannerUrl = (mod.gallery && mod.gallery[0]) ? mod.gallery[0] : 'https://via.placeholder.com/400x150/18181b/27272a';
            const isAdded = window.modpackCart.some(item => item.id === mod.project_id);
            
            let tagsHtml = '';
            if(mod.display_categories) {
                mod.display_categories.slice(0, 3).forEach(tag => { tagsHtml += `<span class="mini-tag">${tagIcons[tag] || '<i class="ph-bold ph-tag"></i>'} ${tag}</span>`; });
            }

            card.innerHTML = `
                <div class="mod-banner" style="background-image: url('${bannerUrl}'); pointer-events: none;"></div>
                <div class="mod-info" style="pointer-events: none;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-end;">
                        <img src="${iconUrl}" class="mod-avatar">
                        <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; padding-bottom: 5px;">
                            <i class="ph-bold ph-download-simple"></i> ${new Intl.NumberFormat('en-US', { notation: "compact", compactDisplay: "short" }).format(mod.downloads || 0)}
                        </span>
                    </div>
                    <h3 class="mod-title">${mod.title}</h3>
                    <div class="mod-tags-container">${tagsHtml}</div>
                    <p class="mod-desc">${mod.description.substring(0, 75)}...</p>
                </div>
                
                <div style="padding: 0 15px 15px 15px; z-index: 10; margin-top: auto; display: flex; gap: 8px;">
                    <button class="btn btn-primary btn-add-mod" data-id="${mod.project_id}" data-title="${mod.title}" data-type="${mod.project_type}" ${isAdded ? 'disabled' : ''} style="flex: 1; font-size: 0.85rem; ${isAdded ? 'background: rgba(16,185,129,0.2); color: var(--success); border: 1px solid var(--success);' : ''}">
                        <i class="ph-bold ${isAdded ? 'ph-check' : 'ph-plus'}"></i> ${isAdded ? 'Añadido' : 'Añadir'}
                    </button>
                    <button class="btn btn-secondary btn-download-jar" data-id="${mod.project_id}" data-title="${mod.title}" title="Descargar .jar directo" style="padding: 0 12px; border-color: rgba(139, 92, 246, 0.5); color: #a78bfa;">
                        <i class="ph-bold ph-download-simple" style="font-size: 16px;"></i>
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
                                alert(`🚨 ALERTA DE CRASHEO:\nEste mod es incompatible con "${conflictingItem.title}".`);
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
                runAutoScanJEI(mod.project_id, versionSelect.value, loaderSelect.value);
                
                document.getElementById('detail-title').textContent = mod.title;
                document.getElementById('detail-author').innerHTML = `por ${mod.author}`;
                document.getElementById('detail-icon').src = iconUrl;
                document.getElementById('detail-downloads-badge').innerHTML = `<i class="ph-bold ph-download-simple"></i> ${new Intl.NumberFormat('es-MX').format(mod.downloads || 0)}`;
                document.getElementById('detail-description').innerHTML = `<div style="text-align:center; padding: 40px;"><i class="ph ph-spinner ph-spin" style="font-size: 30px;"></i><p>Cargando...</p></div>`;
                document.getElementById('detail-gallery').innerHTML = '';
                
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
                    const btnAddTop = topActions.querySelector('.btn-add-top');
                    btnAddTop.addEventListener('click', () => {
                        if (!window.modpackCart.some(item => item.id === mod.project_id)) {
                            window.modpackCart.push({ id: mod.project_id, title: mod.title, type: mod.project_type || 'mod' });
                            window.updateCartUI();
                            btnAddTop.innerHTML = '<i class="ph-bold ph-check"></i> Añadido'; btnAddTop.style.background = 'var(--success)'; btnAddTop.disabled = true;
                            const outerBtn = card.querySelector('.btn-add-mod');
                            if(outerBtn) { outerBtn.innerHTML = '<i class="ph-bold ph-check"></i> Añadido'; outerBtn.style.background = 'var(--success)'; outerBtn.disabled = true; }
                        }
                    });
                }
                
                const depsContainer = document.getElementById('detail-dependencies'); depsContainer.innerHTML = '';
                if (mod.project_type === 'mod') {
                    getRequiredDependencies(mod.project_id, versionSelect.value, loaderSelect.value).then(depProjs => {
                        if (depProjs.length > 0) {
                            let depsHtml = '<h3 class="subtitle mb-10 w-100"><i class="ph-bold ph-books"></i> Librerías Necesarias</h3><div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px;">';
                            depProjs.forEach(p => { depsHtml += `<div style="background: var(--bg-hover); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color); display:flex; align-items:center; gap:10px;"><img src="${p.icon_url || 'https://via.placeholder.com/40'}" style="width:24px; height:24px; border-radius:4px;"><span style="font-size:0.85rem; font-weight:600;">${p.title}</span></div>`; });
                            depsHtml += `</div><button class="btn btn-secondary w-100" id="btn-detail-add-all" style="margin-bottom: 20px;"><i class="ph-bold ph-stack"></i> Añadir Mod y Librerías al Carrito</button>`;
                            depsContainer.innerHTML = depsHtml;
                            depsContainer.innerHTML += `<button class="btn btn-secondary w-100 btn-download-jar" data-id="${mod.project_id}" data-title="${mod.title}" style="margin-bottom: 20px; border-color: #8b5cf6; color: #8b5cf6;"><i class="ph-bold ph-download-simple"></i> Descargar .jar (Mod + Librerías)</button>`;
                            
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

    // ============================================================
    // 7. PLANTILLAS BASE Y BOOST FPS
    // ============================================================

    async function applyTemplate(btnElement, templateName, slugsArray) {
        const originalHtml = btnElement.innerHTML;
        btnElement.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Ensamblando...';
        btnElement.disabled = true;

        try {
            const formatIds = slugsArray.map(slug => `"${slug}"`).join(',');
            const res = await fetch(`https://api.modrinth.com/v2/projects?ids=[${formatIds}]`);
            const projects = await res.json();

            let added = 0;
            projects.forEach(p => {
                if (!window.modpackCart.some(item => item.id === p.id)) {
                    window.modpackCart.push({ id: p.id, title: p.title, type: p.project_type || 'mod' });
                    added++;
                }
            });

            window.updateCartUI();
            btnElement.innerHTML = `<i class="ph-bold ph-check-circle"></i> ¡${added} Añadidos!`;
            btnElement.style.background = 'var(--success)'; btnElement.style.color = 'white'; btnElement.style.borderColor = 'var(--success)';
            setTimeout(() => { btnElement.innerHTML = originalHtml; btnElement.style = ''; btnElement.disabled = false; }, 3000);

        } catch (error) {
            alert(`❌ Error al aplicar la plantilla: ${error.message}`);
            btnElement.innerHTML = originalHtml; btnElement.disabled = false;
        }
    }

    if (btnTemplateRpg) btnTemplateRpg.addEventListener('click', () => applyTemplate(btnTemplateRpg, "RPG", ["epic-fight", "waystones", "irons-spells-n-spellbooks", "better-combat", "cataclysm", "jei", "appleskin"]));
    if (btnTemplateTech) btnTemplateTech.addEventListener('click', () => applyTemplate(btnTemplateTech, "Técnica", ["create", "mekanism", "applied-energistics-2", "cc-tweaked", "jei", "mouse-tweaks"]));
    if (btnFpsBoost) btnFpsBoost.addEventListener('click', () => {
        let fpsMods = ['ferrite-core', 'entityculling', 'modernfix', 'clumps'];
        if (loaderSelect.value === 'fabric') fpsMods.push('sodium', 'lithium', 'iris'); else fpsMods.push('embeddium', 'oculus', 'canary'); 
        applyTemplate(btnFpsBoost, "Boost FPS", fpsMods);
    });

    document.getElementById('btn-randomizer')?.addEventListener('click', async () => {
        if(!confirm("Esto vaciará tu carrito y generará un Modpack al azar. ¿Continuar?")) return;
        const btn = document.getElementById('btn-randomizer');
        btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Ensamblando...'; btn.disabled = true;
        window.modpackCart = []; window.updateCartUI();
        const limit = Math.floor(Math.random() * (150 - 50 + 1)) + 50; 
        try {
            const res = await fetch(`https://api.modrinth.com/v2/search?limit=${limit}&index=downloads&facets=[["versions:${versionSelect.value}"],["categories:${loaderSelect.value}"],["project_type:mod"]]`);
            const data = await res.json();
            data.hits.forEach(mod => window.modpackCart.push({ id: mod.project_id, title: mod.title, type: mod.project_type }));
            window.updateCartUI();
            alert(`📦 ¡Auto-Modpacker completado! Se añadieron ${data.hits.length} mods.`);
        } catch(e) { alert("Error conectando con la API."); }
        btn.innerHTML = '<i class="ph-bold ph-magic-wand"></i> Auto-Modpacker'; btn.disabled = false;
    });

    // ==========================================
    // 8. BUSCADOR DE SKINS / INFO PREMIUM
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
            btnLoadSkin.innerHTML = '<i class="ph ph-spinner ph-spin"></i>'; btnLoadSkin.disabled = true;
            imgSkinPreview.style.opacity = '0.5';
            
            try {
                const res = await fetch(`https://api.ashcon.app/mojang/v2/user/${username}`);
                if (!res.ok) throw new Error("No encontrado");
                const data = await res.json();
                
                imgSkinPreview.src = `https://crafatar.com/renders/body/${data.uuid}?overlay=true`;
                imgSkinPreview.onload = () => imgSkinPreview.style.opacity = '1';
                
                if (advInfoBox) {
                    advInfoBox.style.display = 'block';
                    uuidBadge.textContent = `UUID: ${data.uuid.substring(0, 13)}...`;
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
                alert('❌ No se encontró el usuario premium.');
                imgSkinPreview.src = "https://crafatar.com/renders/body/Steve?overlay=true";
                imgSkinPreview.style.opacity = '1';
                if (advInfoBox) advInfoBox.style.display = 'none';
            } finally {
                btnLoadSkin.innerHTML = '<i class="ph-bold ph-magnifying-glass"></i>'; btnLoadSkin.disabled = false;
            }
        };

        btnLoadSkin.addEventListener('click', () => fetchMojangData(inputSkin.value.trim()));
        inputSkin.addEventListener('keypress', (e) => { if(e.key === 'Enter') btnLoadSkin.click(); });
        const savedName = localStorage.getItem('minepack_username');
        if (savedName) { inputSkin.value = savedName; fetchMojangData(savedName); }
    }

    // ==========================================
    // 9. RECOMENDACIONES INTELIGENTES Y CARRITO
    // ==========================================
    window.updateRecommendations = async function() {
        const recBox = document.getElementById('recommendations-box');
        const recItem = document.getElementById('rec-item');
        if(!recBox || !recItem) return;

        if (window.modpackCart.length === 0) { recBox.style.display = 'none'; return; }

        const hasMod = (slug) => window.modpackCart.some(m => m.id === slug || m.title.toLowerCase().includes(slug.replace('-', ' ')));
        let suggestion = null;

        if (!hasMod('jei') && !hasMod('roughly-enough-items') && !hasMod('emi')) suggestion = { slug: 'jei', reason: 'Esencial para ver los crafteos.' };
        else if (hasMod('sodium') && !hasMod('iris')) suggestion = { slug: 'iris', reason: 'Necesario si quieres usar Shaders con Sodium.' };
        else if (hasMod('create') && !hasMod('mouse-tweaks')) suggestion = { slug: 'mouse-tweaks', reason: 'Ideal para manejar inventarios con Create.' };
        else if (window.modpackCart.length > 8 && !hasMod('ferrite-core')) suggestion = { slug: 'ferrite-core', reason: 'Optimiza el consumo de RAM de tu pack.' };
        else if ((hasMod('epic-fight') || hasMod('combat')) && !hasMod('better-combat')) suggestion = { slug: 'better-combat', reason: 'Mejora las animaciones de combate.' };
        else if (hasMod('cobblemon') && !hasMod('xaeros-minimap')) suggestion = { slug: 'xaeros-minimap', reason: 'Un minimapa te ayudará a encontrar Pokémon.' };

        if (!suggestion) { recBox.style.display = 'none'; return; }

        try {
            const res = await fetch(`https://api.modrinth.com/v2/project/${suggestion.slug}`);
            if(!res.ok) return;
            const p = await res.json();
            if(window.modpackCart.some(m => m.id === p.id)) { recBox.style.display = 'none'; return; }

            recBox.style.display = 'block';
            recItem.innerHTML = `
                <div style="display: flex; gap: 10px; align-items: center;">
                    <img src="${p.icon_url || 'https://via.placeholder.com/32'}" style="width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <div style="flex: 1;">
                        <h4 style="font-size: 0.95rem; color: #fff; margin:0;">${p.title}</h4>
                        <p style="font-size: 0.75rem; color: #fbbf24; margin:0;">${suggestion.reason}</p>
                    </div>
                    <button class="btn btn-primary btn-add-rec" data-id="${p.id}" data-title="${p.title}" style="padding: 6px 12px; font-size: 0.85rem;"><i class="ph-bold ph-plus"></i></button>
                </div>
            `;
            recItem.querySelector('.btn-add-rec').onclick = function() {
                window.modpackCart.push({ id: p.id, title: p.title, type: p.project_type || 'mod' });
                window.updateCartUI();
            };
        } catch(e) { recBox.style.display = 'none'; }
    };

// ============================================================
    // 10. REFORMA TOTAL DEL CARRITO (Lógica Categorizada y Premium)
    // ============================================================

    // Referencias a los nuevos contenedores dinámicos del HTML
    const cartContainers = {
        'mod': { main: document.getElementById('cart-cat-mods'), list: document.getElementById('cart-list-mods') },
        'resourcepack': { main: document.getElementById('cart-cat-resourcepacks'), list: document.getElementById('cart-list-resourcepacks') },
        'shader': { main: document.getElementById('cart-cat-shaders'), list: document.getElementById('cart-list-shaders') },
        'library': { main: document.getElementById('cart-cat-libraries'), list: document.getElementById('cart-list-libraries') }
    };

    window.updateCartUI = function() {
        // 1. Limpiar todas las listas físicas
        Object.values(cartContainers).forEach(c => {
            if(c.list) c.list.innerHTML = '';
            if(c.main) c.main.style.display = 'none'; // Ocultar categoría por defecto
        });

        const emptyMsg = document.getElementById('empty-cart-msg');
        const btnFinalizar = document.getElementById('btn-open-save-modal');

        if (window.modpackCart.length === 0) {
            if(emptyMsg) emptyMsg.style.display = 'block';
            if(btnFinalizar) btnFinalizar.disabled = true;
        } else {
            if(emptyMsg) emptyMsg.style.display = 'none';
            if(btnFinalizar) btnFinalizar.disabled = false;

            // 2. Iterar por el carrito y renderizar el HTML Premium (con Banner y Avatar)
            window.modpackCart.forEach((item, index) => {
                
                // Determinar la categoría real (separando librerías de mods comunes)
                let renderCat = item.type;
                if(item.type === 'mod' && item.categories && item.categories.includes('library')) renderCat = 'library';
                
                const target = cartContainers[renderCat];
                if(!target) return; // Por si acaso llega un tipo desconocido

                // Encender el encabezado de la categoría
                target.main.style.display = 'block';

                // Definir Iconos y Banners predeterminados si no existen
                const icon = item.icon || 'https://via.placeholder.com/48/18181b/ffffff?text=?';
                const banner = item.banner || 'https://via.placeholder.com/300x60/18181b/27272a';

                const li = document.createElement('li');
                li.className = 'cart-item';
                li.innerHTML = `
                    <button class="btn-config-cart" data-id="${item.id}" data-title="${item.title}" title="Configurar .json/.toml">
                        <i class="ph-bold ph-gear"></i>
                    </button>
                    <button class="btn-remove-cart" data-index="${index}" title="Eliminar de mi Pack">
                        <i class="ph-bold ph-trash"></i>
                    </button>
                
                    <div class="cart-item-banner" style="background-image: url('${banner}');"></div>
                    <img src="${icon}" class="cart-item-avatar">
                
                    <div class="cart-item-info">
                        <span class="cart-item-title">${item.title}</span>
                    </div>
                `;
                target.list.appendChild(li);
            });

            // 3. Re-asignar listeners a los nuevos botones flotantes del carrito
            document.querySelectorAll('.btn-remove-cart').forEach(btn => {
                btn.addEventListener('click', function() {
                    window.modpackCart.splice(this.dataset.index, 1);
                    window.updateCartUI();
                    fetchRealMods(false); // Actualizar los botones de "Añadir" en la rejilla principal
                });
            });

            document.querySelectorAll('.btn-config-cart').forEach(btn => {
                btn.addEventListener('click', function() {
                    const modId = this.dataset.id;
                    const editor = document.getElementById('config-editor-modal');
                    if(!editor) return;
                    
                    document.getElementById('config-mod-title').innerHTML = `<i class="ph-bold ph-gear"></i> Config: ${this.dataset.title}`;
                    document.getElementById('config-mod-id').value = modId;
                    
                    if(window.modConfigs[modId]) {
                        document.getElementById('config-filename').value = window.modConfigs[modId].filename;
                        document.getElementById('config-content').value = window.modConfigs[modId].content;
                    } else {
                        document.getElementById('config-filename').value = `${this.dataset.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-common.toml`;
                        document.getElementById('config-content').value = ``;
                    }
                    editor.classList.remove('hidden');
                });
            });
        }

        // 4. Actualizar el contador del botón flotante circular
        const mobileBadge = document.querySelector('#mobile-cart-toggle-btn .badge');
        if(mobileBadge) mobileBadge.textContent = window.modpackCart.length;
        
        // 5. Llamar a las recomendaciones inteligentes
        window.updateRecommendations();
    };


    // ============================================================
    // 11. MOTOR DE PLANTILLAS PRO (+100 Mods Chidos) Y RULETA
    // ============================================================


    // Motor Unificado para llenar el carrito de plantillas
    async function applyTemplate(btnElement, templateName, slugsArray) {
        if(!confirm(`Esto añadirá aproximadamente ${slugsArray.length} mods temáticos a tu pack. ¿Continuar?`)) return;
        const originalHtml = btnElement.innerHTML;
        btnElement.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Ensamblando...';
        btnElement.disabled = true;

        const mcVers = versionSelect.value;
        const loader = loaderSelect.value;
        window.modpackCart = []; // Vaciar carrito actual para la plantilla
        window.updateCartUI();

        let addedCount = 0;
        const aiTerminal = document.getElementById('ai-terminal'); // Reutilizamos la terminal para feedback
        if(aiTerminal) { aiTerminal.style.display = 'block'; aiTerminal.innerHTML = `> Iniciando plantilla ${templateName}...<br>`; }

        // Procesar en lotes de 10 para no saturar Modrinth
        const batchSize = 10;
        for(let i=0; i<slugsArray.length; i+=batchSize) {
            const batch = slugsArray.slice(i, i+batchSize);
            const formatIds = batch.map(slug => `"${slug}"`).join(',');
            
            try {
                // Pedir info detallada (Iconos, Banners)
                const res = await fetch(`https://api.modrinth.com/v2/projects?ids=[${formatIds}]`);
                const projects = await res.json();

                projects.forEach(p => {
                    // Verificación de compatibilidad básica
                    if(!p.game_versions.includes(mcVers) || !p.categories.includes(loader)) return;

                    // Lógica para separar librerías automáticamente
                    let finalType = p.project_type || 'mod';
                    if(p.categories.includes('library')) finalType = 'library';

                    window.modpackCart.push({
                        id: p.id,
                        title: p.title,
                        type: finalType,
                        icon: p.icon_url,
                        banner: (p.gallery && p.gallery.length > 0) ? p.gallery[0].url : null,
                        categories: p.categories // Guardamos categorías para JEI/Visor
                    });
                    addedCount++;
                });
                window.updateCartUI();
                if(aiTerminal) { aiTerminal.innerHTML += `> Lote ${i/batchSize + 1} listo. Mods en pack: ${addedCount}<br>`; aiTerminal.scrollTop = aiTerminal.scrollHeight; }

            } catch(e) {}
        }

        // Efecto visual de éxito
        btnElement.innerHTML = `<i class="ph-bold ph-check-circle"></i> ¡${addedCount} Mods Listos!`;
        btnElement.style.background = 'var(--success)'; btnElement.style.color = 'white';
        if(aiTerminal) aiTerminal.innerHTML += `> Plantilla ${templateName} completada con ${addedCount} mods chidos.`;
        
        setTimeout(() => { btnElement.innerHTML = originalHtml; btnElement.style = ''; btnElement.disabled = false; if(aiTerminal) aiTerminal.style.display='none'; }, 4000);
    }

    // LISTAS PRO (Expandibles hasta 100+) - Añade más slugs oficiales de Modrinth aquí
    const listRpgPro = ["epic-fight", "irons-spells-n-spellbooks", "cataclysm", "ice-and-fire", "waystones", "better-combat", "jei", "appleskin", "alexsmobs", "aquaculture-2", "wawla", "xaeros-minimap", "mowzies-mobs", "byg", "the-twilight-forest", "blue-skies", "ars-nouveau", "reliquary", "valhelsia-structures", "the-undergarden", "when-dungeons-arise", "born-in-chaos", "dungeons-libraries", "goblins-and-dungeons", "naturalist", "friends-and-foes", "environmental", "upgrade-aquatic", "guard-villagers", "castle-in-the-sky", "bountiful", "comforts", "towers-of-the-wild-reworked", "graveyard", "eidolon", "simple-shops", "tombstone", "endrem"]; // Añade ~60 slugs más para llegar a 100

    const listTechPro = ["create", "mekanism", "applied-energistics-2", "cc-tweaked", "immersive-engineering", "refined-storage", "jei", "thermal_expansion", "industrial-forethought", "pneumaticcraft", "rftools-base", "powah", "mouse-tweaks", "extremereactors", "computercraft", "ae2-things", "mekanism-generators", "create-confectionery", "create-steam-n-rails", "little-logistics", "building-gadgets", "tinkers-construct", "botania", "quark", "alexsmobs", "refined-storage-addons", "thermal_foundation", "immersive-petroleum", "cyclic", "industrial-revolution", "modern-industrialization", "tech-reborn"]; // Añade ~70 slugs más para llegar a 100

    // Asignación de clics Plantillas PRO
    if (btnTemplateRpg) btnTemplateRpg.addEventListener('click', () => applyTemplate(btnTemplateRpg, "RPG Épico", listRpgPro));
    if (btnTemplateTech) btnTemplateTech.addEventListener('click', () => applyTemplate(btnTemplateTech, "Industrial Pro", listTechPro));
    
    // Boost FPS (Se mantiene igual pero ahora usa el UI premium)
    if (btnFpsBoost) btnFpsBoost.addEventListener('click', () => {
        let fpsMods = ['ferrite-core', 'entityculling', 'modernfix', 'clumps'];
        if (loaderSelect.value === 'fabric') fpsMods.push('sodium', 'lithium', 'iris'); else fpsMods.push('embeddium', 'oculus', 'canary'); 
        applyTemplate(btnFpsBoost, "Boost FPS", fpsMods);
    });

    // LA RULETA DE RETOS (Randomizer) - Código corregido y conectado
    if (btnRandomizer) {
        btnRandomizer.addEventListener('click', async () => {
            if(!confirm("Esto vaciará tu carrito y generará un Modpack COMPLETAMENTE ALEATORIO para un survival sorpresa. ¿Continuar?")) return;
            
            btnRandomizer.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Girando Ruleta...';
            btnRandomizer.disabled = true;
            btnRandomizer.style.background = 'linear-gradient(45deg, #ec4899, #8b5cf6)'; // Efecto arcoiris

            // Vaciar carrito
            window.modpackCart = []; window.updateCartUI();

            const mcVers = versionSelect.value;
            const loader = loaderSelect.value;

            // Decidir un número al azar entre 50 y 130 mods
            const randomLimit = Math.floor(Math.random() * (130 - 50 + 1)) + 50; 
            
            try {
                // Buscamos mods populares aleatorios (limitados por el número al azar)
                const res = await fetch(`https://api.modrinth.com/v2/search?limit=${randomLimit}&index=downloads&facets=[["versions:${mcVers}"],["categories:${loader}"],["project_type:mod"]]`);
                const data = await res.json();
                
                // Añadimos TODO al carrito sin preguntar
                data.hits.forEach(mod => {
                    window.modpackCart.push({
                        id: mod.project_id,
                        title: mod.title,
                        type: 'mod',
                        icon: mod.icon_url,
                        // No tenemos banner en la búsqueda rápida, updateCartUI usará el placeholder
                    });
                });

                window.updateCartUI();
                
                btnRandomizer.innerHTML = `<i class="ph-bold ph-check"></i> ${data.hits.length} Mods al Azar`;
                btnRandomizer.style.background = 'var(--success)';

                setTimeout(() => {
                    btnRandomizer.innerHTML = '<i class="ph-bold ph-magic-wand"></i> Ruleta de Retos';
                    btnRandomizer.style = '';
                    btnRandomizer.disabled = false;
                }, 3000);

            } catch(e) { 
                alert("Error conectando con la Ruleta Cósmica."); 
                btnRandomizer.innerHTML = '<i class="ph-bold ph-magic-wand"></i> Ruleta de Retos';
                btnRandomizer.style = '';
                btnRandomizer.disabled = false;
            }
        });
    }


    // ============================================================
    // 12. MOTOR DE TOGGLE DEL CARRITO (Estilo "App" para Escritorio)
    // ============================================================
    const mobileCartBtn = document.getElementById('mobile-cart-toggle-btn');
    const cartPanel = document.querySelector('.cart-panel');

    if (mobileCartBtn && cartPanel) {
        // Esta lógica sirve para Celular y para ESCRITORIO
        mobileCartBtn.addEventListener('click', () => {
            cartPanel.classList.toggle('active'); // Enciende/Apaga la clase CSS que mueve el 'right'
            
            // Cambiar icono del botón circular
            if(cartPanel.classList.contains('active')) {
                mobileCartBtn.innerHTML = `<i class="ph-bold ph-x"></i>`; // Icono Cerrar
            } else {
                mobileCartBtn.innerHTML = `<i class="ph-bold ph-package"></i> <span class="badge">${window.modpackCart.length}</span>`;
            }
        });
    }

    document.getElementById('btn-save-config')?.addEventListener('click', () => {
        const modId = document.getElementById('config-mod-id').value;
        const filename = document.getElementById('config-filename').value;
        const content = document.getElementById('config-content').value;
        if(content.trim() !== '') { window.modConfigs[modId] = { filename, content }; alert("Configuración guardada."); }
        document.getElementById('config-editor-modal').classList.add('hidden');
    });

    document.getElementById('btn-migrate-pack')?.addEventListener('click', async () => {
        if(window.modpackCart.length === 0) return alert("Tu carrito está vacío.");
        const newVers = prompt(`¿A qué versión de Minecraft quieres migrar tus ${window.modpackCart.length} mods?\nEjemplo: 1.20.4 o 1.19.2`); if(!newVers) return;
        const btn = document.getElementById('btn-migrate-pack'); btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i>'; btn.disabled = true;
        let exist = 0, fail = 0, failedNames = [];
        for (let i = 0; i < window.modpackCart.length; i++) {
            try { const res = await fetch(`https://api.modrinth.com/v2/project/${window.modpackCart[i].id}/version?game_versions=["${newVers}"]&loaders=["${loaderSelect.value}"]`); const data = await res.json(); if(data.length > 0) exist++; else { fail++; failedNames.push(window.modpackCart[i].title); } } catch(e) { fail++; }
        }
        btn.innerHTML = '<i class="ph-bold ph-magic-wand"></i> Migrar'; btn.disabled = false;
        let msg = `✨ MIGRACIÓN COMPLETADA\n\nCompatibles con ${newVers}: ${exist}\nNo disponibles: ${fail}\n`; if(fail > 0) msg += `\nMods perdidos: ${failedNames.slice(0,3).join(', ')}${fail > 3 ? '...' : ''}`;
        if(confirm(msg + `\n\n¿Aplicar cambio a la versión ${newVers}?`)) { versionSelect.value = newVers; updateSearch(); }
    });

   // ==========================================
    // 10. GESTIÓN DE PERFILES GUARDADOS (REDISEÑO PREMIUM)
    // ==========================================
    window.loadMyProfiles = function() {
        const grid = document.getElementById('profiles-grid');
        if(!grid) return;
        if(!isLoggedIn) { grid.innerHTML = `<div style="text-align: center; padding: 40px;"><i class="ph-bold ph-lock-key" style="font-size: 40px; color: var(--muted);"></i><p style="margin-top: 10px;">Inicia sesión para guardar tus modpacks aquí.</p></div>`; return; }

        const profiles = JSON.parse(localStorage.getItem('mis_modpacks_guardados') || '[]');
        if (profiles.length === 0) { grid.innerHTML = '<div style="text-align:center; padding:40px;"><p>Aún no has guardado ningún Modpack.</p></div>'; return; }

        grid.innerHTML = '';
        profiles.forEach((p, index) => {
            const modsCount = p.modsData ? p.modsData.length : 0;
            
            // 1. Generar la fila visual de iconos superpuestos
            let modsPreviewHtml = '';
            if(p.modsData && p.modsData.length > 0) {
                const maxPreview = 8;
                const previewMods = p.modsData.slice(0, maxPreview);
                previewMods.forEach((mod, i) => {
                    const icon = mod.icon || 'https://via.placeholder.com/32/18181b/ffffff?text=?';
                    // Z-index inverso para que se superpongan correctamente de izquierda a derecha
                    modsPreviewHtml += `<img src="${icon}" title="${mod.title}" style="z-index: ${maxPreview - i};">`;
                });
                if(modsCount > maxPreview) {
                    modsPreviewHtml += `<div class="profile-mods-extra">+${modsCount - maxPreview}</div>`;
                }
            } else {
                modsPreviewHtml = '<span class="muted-text text-sm" style="margin-left: -10px;">Perfil Vacío</span>';
            }

            // 2. Extraer imágenes del primer mod para el banner/logo si el usuario no subió uno
            const profileIcon = p.iconBase64 || (p.modsData && p.modsData[0] && p.modsData[0].icon) || 'https://via.placeholder.com/64/18181b/ffffff?text=P';
            const profileBanner = (p.modsData && p.modsData[0] && p.modsData[0].banner) || 'https://via.placeholder.com/400x120/18181b/27272a';

            // 3. Inyectar la Tarjeta Premium
            grid.innerHTML += `
                <div class="profile-card">
                    <div class="profile-banner" style="background-image: url('${profileBanner}');"></div>
                    <div class="profile-content">
                        
                        <div class="profile-header">
                            <img src="${profileIcon}" class="profile-icon">
                            <div style="display: flex; gap: 6px;">
                                <button class="btn-config-cart btn-edit-name" data-index="${index}" title="Renombrar Perfil" style="position: relative; right:0; top:0; background: rgba(255,255,255,0.1);"><i class="ph-bold ph-pencil-simple"></i></button>
                                <button class="btn-config-cart btn-share-profile" data-index="${index}" title="Compartir Modpack" style="position: relative; right:0; top:0; background: rgba(99,102,241,0.2); color: var(--accent);"><i class="ph-bold ph-link"></i></button>
                                <button class="btn-remove-cart btn-delete-profile" data-index="${index}" title="Eliminar" style="position: relative; right:0; top:0;"><i class="ph-bold ph-trash"></i></button>
                            </div>
                        </div>
                        
                        <div class="profile-title">${p.name}</div>
                        
                        <div class="profile-badges">
                            <span class="p-badge" style="color: var(--success); border-color: rgba(16,185,129,0.3);"><i class="ph-bold ph-game-controller"></i> ${p.mcVersion}</span>
                            <span class="p-badge" style="color: #f59e0b; border-color: rgba(245,158,11,0.3);"><i class="ph-bold ph-hammer"></i> ${p.modLoader.toUpperCase()}</span>
                            <span class="p-badge"><i class="ph-bold ph-puzzle-piece"></i> ${modsCount} Mods</span>
                        </div>

                        <p class="muted-text text-sm" style="margin-bottom: 8px; font-weight: 600;">Contenido del Pack:</p>
                        <div class="profile-mods-preview">
                            ${modsPreviewHtml}
                        </div>
                        
                        <div class="profile-actions">
                            <button class="btn btn-primary btn-edit-profile w-100" data-index="${index}" style="padding: 12px; font-size: 0.95rem;">
                                <i class="ph-bold ph-folder-open"></i> Cargar al Ensamblador
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        // --- ASIGNACIÓN DE EVENTOS A LOS BOTONES ---

        // 1. Botón: Renombrar Perfil
        document.querySelectorAll('.btn-edit-name').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.currentTarget.dataset.index;
                const newName = prompt("Escribe el nuevo nombre para este modpack:", profiles[idx].name);
                if(newName && newName.trim() !== '') {
                    profiles[idx].name = newName.trim();
                    localStorage.setItem('mis_modpacks_guardados', JSON.stringify(profiles));
                    window.loadMyProfiles(); // Recargar la vista
                }
            });
        });

        // 2. Botón: Compartir
        document.querySelectorAll('.btn-share-profile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profile = profiles[e.currentTarget.dataset.index];
                const compactData = profile.modsData.map(m => `${m.id}${m.type !== 'mod' ? '_'+m.type : ''}`).join('-');
                navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?pack=${compactData}`);
                alert("🔗 ¡Enlace copiado al portapapeles!\nCualquier persona que lo abra podrá descargar o editar tu modpack.");
            });
        });

        // 3. Botón: Eliminar
        document.querySelectorAll('.btn-delete-profile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if(confirm("⚠️ ¿Estás seguro de que quieres eliminar este perfil para siempre?")) { 
                    profiles.splice(e.currentTarget.dataset.index, 1); 
                    localStorage.setItem('mis_modpacks_guardados', JSON.stringify(profiles)); 
                    window.loadMyProfiles(); 
                }
            });
        });

        // 4. Botón: Cargar al Ensamblador (Editar mods)
        document.querySelectorAll('.btn-edit-profile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profile = profiles[e.currentTarget.dataset.index];
                window.modpackCart = profile.modsData; 
                versionSelect.value = profile.mcVersion; 
                loaderSelect.value = profile.modLoader;
                
                // Actualizar la interfaz del carrito y abrir el buscador
                window.updateCartUI(); 
                document.querySelector('.nav-btn[data-target="mods"]').click(); 
                
                // Disparar un evento 'change' en los selects para que Modrinth busque la versión correcta
                const event = new Event('change');
                versionSelect.dispatchEvent(event);
            });
        });
    }
    // ==========================================
    // 11. SCROLL INFINITO PARA EL PANEL
    // ==========================================
    const scrollContainer = document.getElementById('dynamic-center-area');
    if (btnLoadMore) btnLoadMore.addEventListener('click', () => { if(!isFetchingMods) { currentOffset += 50; fetchRealMods(true); } });
    
    if (scrollContainer) {
        scrollContainer.addEventListener('scroll', () => {
            const modsView = document.getElementById('view-mods');
            if (modsView && !modsView.classList.contains('hidden')) {
                const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
                if (scrollTop + clientHeight >= scrollHeight - 600) {
                    if (btnLoadMore && btnLoadMore.style.display !== 'none' && !isFetchingMods) { currentOffset += 50; fetchRealMods(true); }
                }
            }
        });
    }

// Creamos el botón flotante si no existe
    let mobileBtn = document.getElementById('mobile-cart-toggle-btn');
    if (!mobileBtn) {
        mobileBtn = document.createElement('button');
        mobileBtn.id = 'mobile-cart-toggle-btn';
        // Fíjate que aquí quitamos "hidden-desktop" para que se vea siempre
        mobileBtn.className = 'mobile-cart-toggle'; 
        mobileBtn.innerHTML = `<i class="ph-bold ph-package"></i> <span class="badge">${window.modpackCart.length}</span>`;
        document.body.appendChild(mobileBtn);
    }

    if (mobileBtn && cartPanel) {
        mobileBtn.addEventListener('click', () => {
            // Ahora usamos solo 'active' para que funcione igual en PC y celular
            cartPanel.classList.toggle('active'); 
            
            if(cartPanel.classList.contains('active')) {
                mobileBtn.innerHTML = `<i class="ph-bold ph-x"></i>`; 
            } else {
                mobileBtn.innerHTML = `<i class="ph-bold ph-package"></i> <span class="badge">${window.modpackCart.length}</span>`;
            }
        });
    }

    // ==========================================
    // 12. COMPARADOR DE SHADERS
    // ==========================================
    const shaderSliderInput = document.getElementById('shader-slider-input');
    const shaderImgTop = document.getElementById('shader-img-top');
    const shaderSliderLine = document.getElementById('shader-slider-line');

    if (shaderSliderInput && shaderImgTop && shaderSliderLine) {
        shaderSliderInput.addEventListener('input', (e) => {
            const val = e.target.value;
            shaderImgTop.style.clipPath = `polygon(0 0, ${val}% 0, ${val}% 100%, 0 100%)`;
            shaderSliderLine.style.left = `${val}%`;
        });
    }

    // ==========================================
    // 13. IMPORTADOR DE ARCHIVOS .JAR LOCALES
    // ==========================================
    const btnImportJars = document.getElementById('btn-import-jars');
    const inputImportJars = document.getElementById('import-jars-input');

    if(btnImportJars && inputImportJars) {
        btnImportJars.addEventListener('click', () => inputImportJars.click());
        inputImportJars.addEventListener('change', async (e) => {
            const files = e.target.files; if(files.length === 0) return;
            btnImportJars.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Analizando...'; btnImportJars.disabled = true;
            const hashes = [];
            
            for(let i=0; i<files.length; i++) {
                const buffer = await files[i].arrayBuffer();
                const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                hashes.push(hashArray.map(b => b.toString(16).padStart(2, '0')).join(''));
            }

            try {
                const res = await fetch('https://api.modrinth.com/v2/version_files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hashes: hashes, algorithm: "sha1" }) });
                const data = await res.json();
                let added = 0, notFound = 0;

                for (const hash of hashes) {
                    if (data[hash]) {
                        const projectId = data[hash].project_id;
                        if (!window.modpackCart.some(item => item.id === projectId)) { window.modpackCart.push({ id: projectId, title: "Mod Importado", type: "mod" }); added++; }
                    } else notFound++;
                }

                if(added > 0) {
                    const ids = window.modpackCart.filter(m => m.title === "Mod Importado").map(m => `"${m.id}"`).join(',');
                    if(ids) {
                        const pRes = await fetch(`https://api.modrinth.com/v2/projects?ids=[${ids}]`);
                        const pData = await pRes.json();
                        pData.forEach(proj => { const cartItem = window.modpackCart.find(i => i.id === proj.id && i.title === "Mod Importado"); if(cartItem) cartItem.title = proj.title; });
                    }
                }
                window.updateCartUI(); alert(`📦 Completado.\nEncontrados: ${added}\nNo reconocidos: ${notFound}`);
            } catch(err) { alert("Hubo un error verificando los archivos."); }

            btnImportJars.innerHTML = '<i class="ph-bold ph-upload-simple"></i> Importar .JAR'; btnImportJars.disabled = false; inputImportJars.value = '';
        });
    }

    // ==========================================
    // 14. DESCARGAS DIRECTAS (Botón Morado)
    // ==========================================
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-download-jar');
        if (btn) { const modId = btn.dataset.id; const modTitle = btn.dataset.title; if(modId) initiateSingleJarDownload(modId, modTitle); }
    });

    async function initiateSingleJarDownload(modId, modTitle) {
        if(!confirm(`¿Descargar archivos .jar de ${modTitle}?`)) return;
        const mcVers = versionSelect.value; const loader = loaderSelect.value;
        try {
            const projRes = await fetch(`https://api.modrinth.com/v2/project/${modId}`);
            if(!projRes.ok) throw new Error("No se pudo conectar con Modrinth");
            const versRes = await fetch(`https://api.modrinth.com/v2/project/${modId}/version?game_versions=["${mcVers}"]&loaders=["${loader}"]`);
            const versData = await versRes.json();
            if(versData.length === 0 || versData[0].files.length === 0) return alert(`❌ Sin versión compatible para ${mcVers} ${loader}.`);

            const primaryFile = versData[0].files.find(f => f.primary) || versData[0].files[0];
            const dependencies = versData[0].dependencies.filter(d => d.dependency_type === 'required' && d.project_id);
            let urlsToDownload = [primaryFile.url];

            if(dependencies.length > 0 && confirm(`📦 ${modTitle} necesita ${dependencies.length} librerías.\n¿Descargarlas también?`)) {
                for(let dep of dependencies) {
                    try {
                        const dVersRes = await fetch(`https://api.modrinth.com/v2/project/${dep.project_id}/version?game_versions=["${mcVers}"]&loaders=["${loader}"]`);
                        const dVersData = await dVersRes.json();
                        if(dVersData.length > 0 && dVersData[0].files.length > 0) { urlsToDownload.push((dVersData[0].files.find(f => f.primary) || dVersData[0].files[0]).url); }
                    } catch(depErr) {}
                }
            }

            urlsToDownload.forEach((url, index) => { setTimeout(() => { const iframe = document.createElement('iframe'); iframe.style.display = 'none'; iframe.src = url; document.body.appendChild(iframe); setTimeout(() => document.body.removeChild(iframe), 120000); }, index * 500); });
            if(urlsToDownload.length > 1) alert(`🚀 Descargando ${urlsToDownload.length} archivos.`);
        } catch(err) { alert(`❌ Error: ${err.message}`); }
    }

    // ==========================================
    // 15. AUTO-SCANNER JEI & VISOR 3D (Extracción ZIP Web)
    // ==========================================
    const recipeViewer = document.getElementById('jei-recipe-viewer');
    const recipeContent = document.getElementById('jei-recipe-content');
    document.getElementById('btn-close-recipe')?.addEventListener('click', () => { if(recipeViewer) recipeViewer.style.display = 'none'; });
    
    async function runAutoScanJEI(modId, mcVers, loader) {
        const itemsGrid = document.getElementById('jei-items-grid'); const mobsGrid = document.getElementById('jei-mobs-grid');
        const leftSidebar = document.querySelector('.jei-sidebar-left'); const rightSidebar = document.querySelector('.jei-sidebar-right');
        
        if(leftSidebar) leftSidebar.style.display = 'none'; if(rightSidebar) rightSidebar.style.display = 'none';
        if(!itemsGrid || !mobsGrid) return;
        leftSidebar.style.display = 'block'; rightSidebar.style.display = 'flex'; if(recipeViewer) recipeViewer.style.display = 'none';

        itemsGrid.innerHTML = '<div class="muted-text text-sm" style="grid-column:1/-1; text-align:center; padding: 20px;"><i class="ph ph-spinner ph-spin"></i> Extrayendo archivos...</div>';
        mobsGrid.innerHTML = '<div class="muted-text text-sm" style="grid-column:1/-1; padding: 20px;"><i class="ph ph-spinner ph-spin"></i> Buscando entidades...</div>';

        try {
            const versRes = await fetch(`https://api.modrinth.com/v2/project/${modId}/version?game_versions=["${mcVers}"]&loaders=["${loader}"]`);
            const versData = await versRes.json();
            if (versData.length === 0 || versData[0].files.length === 0) throw new Error("Sin archivos Java.");

            const fileUrl = versData[0].files.find(f => f.primary)?.url || versData[0].files[0].url;
            const fileRes = await fetch(fileUrl); const fileBlob = await fileRes.blob();
            const zip = new JSZip(); const unzipped = await zip.loadAsync(fileBlob);
            const allFiles = Object.keys(unzipped.files);
            
            const recipeFiles = allFiles.filter(p => p.includes('data/') && p.includes('recipes/') && p.endsWith('.json'));
            const parsedRecipes = [];
            for (let path of recipeFiles) { try { parsedRecipes.push({ path: path, data: JSON.parse(await unzipped.files[path].async('string')) }); } catch(e) {} }

            const uniqueItemNames = new Set(), uniqueMobNames = new Set(), modTexturesCache = {}; 
            let itemsHTML = '', mobsHTML = '', itemCount = 0, mobCount = 0;

            for (let path of allFiles) {
                if (path.endsWith('.png')) {
                    let rawName = path.split('/').pop().replace('.png', '');
                    if ((path.includes('textures/item/') || path.includes('textures/block/')) && !uniqueItemNames.has(rawName)) {
                        uniqueItemNames.add(rawName); itemCount++;
                        const base64 = await unzipped.files[path].async('base64'); modTexturesCache[rawName] = base64; 
                        itemsHTML += `<div class="jei-item-slot" title="${rawName.replace(/_/g, ' ')}" onclick="openVisualRecipe('${rawName}', '${rawName}')"><img src="data:image/png;base64,${base64}"></div>`;
                    }
                    if (path.includes('textures/entity/') && !uniqueMobNames.has(rawName)) {
                        uniqueMobNames.add(rawName); mobCount++;
                        const base64 = await unzipped.files[path].async('base64');
                        mobsHTML += `<div class="jei-item-slot" title="Ver 3D: ${rawName}" style="border-color: #d97706;" onclick="triggerMob3D('${rawName}', 'data:image/png;base64,${base64}')"><img src="data:image/png;base64,${base64}"></div>`;
                    }
                }
            }

            if (leftSidebar) leftSidebar.style.display = mobCount === 0 ? 'none' : 'block';
            if (rightSidebar) rightSidebar.style.display = itemCount === 0 ? 'none' : 'flex';
            if (itemsGrid) itemsGrid.innerHTML = itemCount === 0 ? '' : itemsHTML;
            if (mobsGrid) mobsGrid.innerHTML = mobCount === 0 ? '' : mobsHTML;

            window.openVisualRecipe = (rawId, prettyName) => {
                if(!recipeViewer) return;
                const recipe = parsedRecipes.find(r => JSON.stringify(r.data).includes(rawId));
                recipeViewer.style.display = 'block';
                if (!recipe) { recipeContent.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--muted);">No hay receta para <b>${prettyName}</b>.</div>`; return; }
                recipeContent.innerHTML = `<pre style="font-size:10px; background:var(--bg-main); padding:10px; border-radius:6px; overflow-x:auto;">${JSON.stringify(recipe.data, null, 2)}</pre>`;
            };

            window.triggerMob3D = (name, base64Src) => {
                const modal = document.getElementById('mob-3d-modal'); if(!modal) return;
                document.getElementById('mob-3d-title').innerHTML = `<i class="ph-bold ph-user"></i> 3D: ${name}`;
                document.querySelectorAll('.mc-part').forEach(part => { part.style.backgroundImage = `url(${base64Src})`; });
                document.getElementById('mc-biped-model')?.classList.add('walking');
                modal.classList.remove('hidden');
            };

        } catch (error) { if (leftSidebar) leftSidebar.style.display = 'none'; if (rightSidebar) rightSidebar.style.display = 'none'; }
    }

    // ==========================================
    // 16. INTELIGENCIA ARTIFICIAL (Agente)
    // ==========================================
    const btnAiBuilder = document.getElementById('btn-ai-builder');
    const aiModal = document.getElementById('ai-builder-modal');
    const aiPrompt = document.getElementById('ai-prompt-input');
    const aiTerminal = document.getElementById('ai-terminal');
    const btnGenerateAiDownload = document.getElementById('btn-generate-ai-download');

    if (btnAiBuilder && aiModal) {
        btnAiBuilder.addEventListener('click', () => {
            aiModal.classList.remove('hidden'); aiTerminal.style.display = 'none'; aiTerminal.innerHTML = '> Esperando órdenes...<br>'; aiPrompt.value = ''; btnGenerateAiDownload.disabled = false;
        });

        document.getElementById('btn-ai-cancel')?.addEventListener('click', () => aiModal.classList.add('hidden'));

        const aiLog = (msg, type = 'info') => {
            aiTerminal.style.display = 'block';
            let color = '#4ade80', icon = '>';
            if(type === 'warn') { color = '#f59e0b'; icon = '⚠️'; }
            if(type === 'error') { color = '#ef4444'; icon = '❌'; }
            if(type === 'success') { color = '#8b5cf6'; icon = '✨'; }
            aiTerminal.innerHTML += `<span style="color: ${color}">${icon} ${msg}</span><br>`; aiTerminal.scrollTop = aiTerminal.scrollHeight;
        };

        btnGenerateAiDownload.addEventListener('click', async () => {
            let prompt = aiPrompt.value.toLowerCase().trim(); if (prompt.length < 5) return alert("¡Sé más descriptivo!");
            btnGenerateAiDownload.disabled = true; btnGenerateAiDownload.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Procesando...';
            
            const mcVers = versionSelect.value, loader = loaderSelect.value;
            let targetModCount = 15;
            const numMatch = prompt.match(/(\d+)\s*(mod|mods)/i); if(numMatch) targetModCount = Math.min(parseInt(numMatch[1]), 60);

            const cats = [
                { cat: 'adventure', kw: ['aventura', 'explore', 'dungeon', 'mazmorra'] }, { cat: 'magic', kw: ['magia', 'spell', 'bruja'] },
                { cat: 'technology', kw: ['tecnologia', 'tech', 'machine'] }, { cat: 'combat', kw: ['combate', 'hardcore', 'boss'] },
                { cat: 'decoration', kw: ['decoracion', 'mueble'] }, { cat: 'mobs', kw: ['criatura', 'animal', 'dragon'] },
                { cat: 'optimization', kw: ['optimizado', 'fps', 'rendimiento', 'lag'] }
            ];

            let detectedCats = []; cats.forEach(entry => { if(entry.kw.some(k => prompt.includes(k))) detectedCats.push(entry.cat); });
            if (detectedCats.length === 0) detectedCats.push(`q=${prompt.split(' ')[0]}`);

            let initialMods = ['jei', 'mouse-tweaks', 'appleskin'];
            if(detectedCats.includes('optimization')) { initialMods.push('sodium', 'lithium', 'ferrite-core'); detectedCats = detectedCats.filter(c => c !== 'optimization'); }

            const modsPerCat = targetModCount > 5 ? Math.ceil((targetModCount - initialMods.length) / detectedCats.length) : 1;
            
            for (let cat of detectedCats) {
                try {
                    let facets = [[`versions:${mcVers}`], [`categories:${loader}`], ["project_type:mod"]];
                    let searchUrl = `https://api.modrinth.com/v2/search?limit=${modsPerCat}&index=relevance`;
                    if(cat.startsWith('q=')) searchUrl += `&query=${encodeURIComponent(cat.substring(2))}`; else facets.push([`categories:${cat}`]);
                    searchUrl += `&facets=${encodeURIComponent(JSON.stringify(facets))}`;
                    
                    const res = await fetch(searchUrl); const data = await res.json();
                    if(data.hits) data.hits.forEach(m => initialMods.push(m.project_id));
                } catch(e) {}
            }

            let tempAiCart = []; let procesados = 0; const total = [...new Set(initialMods)];
            const resolveDepsAndAddTemp = async (modId) => {
                if(tempAiCart.some(m => m.id === modId)) return;
                try {
                    const pRes = await fetch(`https://api.modrinth.com/v2/project/${modId}`); if(!pRes.ok) return; const pData = await pRes.json();
                    const vRes = await fetch(`https://api.modrinth.com/v2/project/${modId}/version?game_versions=["${mcVers}"]&loaders=["${loader}"]`); const vData = await vRes.json();
                    if (vData.length > 0) {
                        tempAiCart.push({ id: pData.id, title: pData.title, type: 'mod' }); procesados++; aiLog(`[${procesados}] Añadido ${pData.title}...`);
                        const deps = vData[0].dependencies.filter(d => d.dependency_type === 'required' && d.project_id);
                        for (let d of deps) await resolveDepsAndAddTemp(d.project_id);
                    }
                } catch(e) {}
            };

            for(let id of total) { await resolveDepsAndAddTemp(id); aiTerminal.scrollTop = aiTerminal.scrollHeight; }

            if(tempAiCart.length === 0) { aiLog("Error: Ningún mod compatible.", 'error'); btnGenerateAiDownload.innerHTML = 'Reintentar'; btnGenerateAiDownload.disabled = false; return; }

            aiLog(`Ensamblaje listo (${tempAiCart.length} mods). Exportando ZIP...`, 'success');
            btnGenerateAiDownload.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Empaquetando...';

            try {
                const originalCart = window.modpackCart; window.modpackCart = tempAiCart; 
                await window.requestBuild('download_only');
                window.modpackCart = originalCart;
                aiLog(`¡Descarga iniciada!`, 'success'); btnGenerateAiDownload.innerHTML = '¡Modpack Generado!';
                setTimeout(() => { aiModal.classList.add('hidden'); btnGenerateAiDownload.innerHTML = 'Generar y Descargar'; btnGenerateAiDownload.disabled = false; }, 4000);
            } catch(e) { aiLog(`Falló el empaquetado: ${e.message}`, 'error'); btnGenerateAiDownload.disabled = false; }
        });
    }

    // ==========================================
    // 17. INICIO AUTOMÁTICO AL CARGAR LA PÁGINA
    // ==========================================
    fetchRealMods(); // Carga los mods iniciales de inmediato sin que el usuario tenga que dar clics

}); // <--- AQUÍ CIERRA EL DOMContentLoaded PRINCIPAL. ¡NO BORRES ESTO!
