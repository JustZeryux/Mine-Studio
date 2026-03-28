document.addEventListener('DOMContentLoaded', async () => {

    // ==========================================
    // 1. VARIABLES GLOBALES Y PLANTILLAS
    // ==========================================
    window.modConfigs = {}; 
    const urlParams = new URLSearchParams(window.location.search);
    const sharedPack = urlParams.get('pack');
    window.modpackCart = [];
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
    const YOUTUBE_API_KEY = 'AIzaSyCu35RupyXPEyADr7PLnZra_hT64UShEYw'; // <-- Pon aquí tu llave

    async function loadModShowcase(modTitle) {
        const container = document.getElementById('detail-video-container');
        const iframe = document.getElementById('detail-video-iframe');
        const credit = document.getElementById('detail-video-credit');
        
        // Ocultamos el video por defecto mientras carga
        container.style.display = 'none';
        iframe.src = '';
        
        if (!YOUTUBE_API_KEY || YOUTUBE_API_KEY === 'TU_API_KEY_AQUI') {
            console.warn("Falta la API Key de YouTube para buscar tutoriales.");
            return;
        }

        try {
            // Buscamos exactamente un showcase del mod
            const query = encodeURIComponent(`Minecraft mod ${modTitle} showcase tutorial`);
            const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=1&q=${query}&type=video&key=${YOUTUBE_API_KEY}`);
            const data = await res.json();
            
            if (data.items && data.items.length > 0) {
                const video = data.items[0];
                // Inyectamos el video en el iframe
                iframe.src = `https://www.youtube.com/embed/${video.id.videoId}`;
                // Damos créditos al canal creador
                credit.innerHTML = `Créditos del video: <strong style="color: white;"><i class="ph-fill ph-user"></i> ${video.snippet.channelTitle}</strong>`;
                // Mostramos el contenedor con una suave animación
                container.style.display = 'block';
            }
        } catch (e) {
            console.error("Error cargando el video de YouTube:", e);
        }
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
        if(btn.id === 'btn-ai-builder' || btn.id === 'btn-ai-builder-mobile') return; 
        navButtons.forEach(b => b.classList.remove('active')); 
        btn.classList.add('active');
        
        Object.values(views).forEach(v => { if(v) v.classList.add('hidden') }); 
        if(views[btn.getAttribute('data-target')]) views[btn.getAttribute('data-target')].classList.remove('hidden');
        
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
                                    const icon = proj.icon_url || 'https://placehold.co/48x48/18181b/ffffff?text=M';
                                    const desc = proj.description ? proj.description.substring(0, 75) + '...' : 'Sin descripción disponible.';
                                    let typeColor = 'var(--accent)', typeText = 'MOD', iconType = 'ph-puzzle-piece';
                                    
                                    if(item.type === 'shader') { typeColor = '#f59e0b'; typeText = 'SHADER'; iconType = 'ph-aperture'; }
                                    else if(item.type === 'resourcepack') { typeColor = '#10b981'; typeText = 'TEXTURA'; iconType = 'ph-paint-brush'; }

                                    sharedList.innerHTML += `
                                        <div class="shared-mod-item" onclick="window.openModDetailsById('${proj.id}')" style="display: flex; gap: 15px; align-items: center; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: 0.2s;">
                                            <img src="${icon}" onerror="this.src='https://placehold.co/50x50/18181b/ffffff?text=M'" style="width: 50px; height: 50px; border-radius: 8px; object-fit: cover; background: #27272a;">
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
        const cP = document.querySelector('.cart-panel');
        if(cP) { cP.style.right = ''; cP.classList.remove('active'); }
        modalSave.classList.remove('hidden');
    });

window.requestBuild = async function(action = 'download_only') {
        const isSaving = (action === 'save_only' || action === 'save_download');
        const isDownloading = (action === 'download_only' || action === 'save_download');

        // NUEVO: Comprobamos el estado real en Supabase
        let userIsLoggedIn = false;
        if (typeof window.checkIsLoggedIn === 'function') {
            userIsLoggedIn = await window.checkIsLoggedIn();
        }

        if (isSaving && !userIsLoggedIn) {
            alert('¡Alto! Necesitas Iniciar Sesión para guardar perfiles en la nube.');
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

            // Lógica de Guardado (Local -> Nube) - [BUG 1 ARREGLADO: COPIA PROFUNDA]
            if (isSaving) {
                const profiles = JSON.parse(localStorage.getItem('mis_modpacks_guardados') || '[]');
                // Copia profunda para evitar bucles infinitos al editar
                const cartCopy = JSON.parse(JSON.stringify(window.modpackCart)); 
                profiles.push({ name: packName, mcVersion: mcVersion, modLoader: loader, modsData: cartCopy, iconBase64: null });
                localStorage.setItem('mis_modpacks_guardados', JSON.stringify(profiles)); 
                window.loadMyProfiles();

                if(action === 'save_only') {
                    alert('✅ Perfil guardado correctamente en "Mis Modpacks".');
                    modalSave.classList.add('hidden');
                    if(activeBtn) { activeBtn.innerHTML = '<i class="ph-bold ph-floppy-disk"></i> Guardar Nube'; activeBtn.disabled = false; }
                    return; 
                }
            }

            // Lógica de Descarga y Ensamblado ZIP
            if (isDownloading) {
                if (typeof JSZip === 'undefined') throw new Error("Falta la librería JSZip.");
                const zip = new JSZip();

                if(Object.keys(window.modConfigs).length > 0) {
                    const confFolder = zip.folder("config");
                    for (const modId in window.modConfigs) { confFolder.file(window.modConfigs[modId].filename, window.modConfigs[modId].content); }
                }

                let procesados = 0;
                const totalMods = window.modpackCart.length;

                if (isMrPack) {
                    if(activeBtn) activeBtn.innerHTML = `<i class="ph ph-spinner ph-spin"></i> Generando MRPack...`;
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
                    const modsFolder = zip.folder("mods"); const shadersFolder = zip.folder("shaderpacks"); const resourceFolder = zip.folder("resourcepacks");
                    
                    // Extraer Configuración Extendida del Mundo Vanilla
                    const wGamemode = document.getElementById('world-gamemode')?.value || 'survival';
                    const wDifficulty = document.getElementById('world-difficulty')?.value || 'normal';
                    const wHardcore = document.getElementById('world-hardcore')?.checked ? 'true' : 'false';
                    const wPvp = document.getElementById('world-pvp')?.checked ? 'true' : 'false';
                    const wMaxPlayers = document.getElementById('world-max-players')?.value || '20';
                    const wStructures = document.getElementById('world-structures')?.checked ? 'true' : 'false';
                    const wMotd = document.getElementById('world-motd')?.value || 'Servidor Mine-Studio';

                    let propsContent = `# Generado por MinePack Studio\nmotd=${wMotd}\ngamemode=${wGamemode}\ndifficulty=${wDifficulty}\nhardcore=${wHardcore}\npvp=${wPvp}\nmax-players=${wMaxPlayers}\ngenerate-structures=${wStructures}\n`;
                    const wSeed = document.getElementById('world-seed-input')?.value; if (wSeed && wSeed.trim() !== '') propsContent += `level-seed=${wSeed}\n`;
                    zip.file("server.properties", propsContent);

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
            if(btnJustSave) { btnJustSave.innerHTML = '<i class="ph-bold ph-cloud-arrow-up"></i> Guardar Nube'; btnJustSave.disabled = false; }
            if(btnJustDownload) { btnJustDownload.innerHTML = '<i class="ph-bold ph-file-zip"></i> Solo Bajar'; btnJustDownload.disabled = false; }
            if(btnSaveAndDownload) { btnSaveAndDownload.innerHTML = '<i class="ph-bold ph-download-simple"></i> Guardar y Descargar'; btnSaveAndDownload.disabled = false; }
        }
    };

    if(btnJustSave) btnJustSave.addEventListener('click', () => window.requestBuild('save_only'));
    if(btnJustDownload) btnJustDownload.addEventListener('click', () => window.requestBuild('download_only'));
    if(btnSaveAndDownload) btnSaveAndDownload.addEventListener('click', () => window.requestBuild('save_download'));

// ==========================================
    // FUNCIÓN CENTRAL: ABRIR DETALLES (FULL PAGE + STICKY + VIDEO FIX)
    // ==========================================
    
    // CSS para las imágenes, el layout y el sidebar sticky
    if (!document.getElementById('cf-styles-custom')) {
        const styleCf = document.createElement('style');
        styleCf.id = 'cf-styles-custom';
        styleCf.innerHTML = `
            .markdown-body img { display: block; margin: 25px auto; max-width: 100%; border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.4); }
            .sidebar-panel { background: var(--bg-panel); border: 1px solid var(--border-color); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
            .sidebar-title { margin-top: 0; font-size: 1.1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 12px; margin-bottom: 15px; display: flex; align-items: center; gap: 8px; }
            
            /* Magia para que el sidebar te siga al hacer scroll */
            .sticky-sidebar { position: sticky; top: 20px; max-height: calc(100vh - 40px); overflow-y: auto; padding-right: 5px; }
            .sticky-sidebar::-webkit-scrollbar { width: 6px; }
            .sticky-sidebar::-webkit-scrollbar-track { background: transparent; }
            .sticky-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
        `;
        document.head.appendChild(styleCf);
    }

    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.mod) window.openModDetailsById(e.state.mod, true);
        else {
            document.getElementById('view-mod-details-page')?.classList.add('hidden');
            document.getElementById('view-mods')?.classList.remove('hidden');
        }
    });

    window.openModDetailsById = async function(modId, isPopState = false) {
        if (!modId || modId === 'undefined' || modId === 'null') return;

        if (!isPopState) {
            const newUrl = new URL(window.location);
            newUrl.searchParams.set('mod', modId);
            window.history.pushState({ mod: modId }, '', newUrl);
        }

        document.getElementById('view-mods').classList.add('hidden');
        
        let detailsPage = document.getElementById('view-mod-details-page');
        if (!detailsPage) {
            detailsPage = document.createElement('div');
            detailsPage.id = 'view-mod-details-page';
            // 🔥 MODO PÁGINA COMPLETA: Sin bordes, position absolute para que cubra todo, fondo sólido
            detailsPage.style.cssText = 'position: absolute; inset: 0; width: 100%; height: 100%; background: var(--bg-main); z-index: 50; overflow-y: auto; padding: 0; margin: 0; border: none; border-radius: 0; display: flex; flex-direction: column; scroll-behavior: smooth;';
            document.getElementById('dynamic-center-area').style.position = 'relative'; // Asegura que se ancle bien
            document.getElementById('dynamic-center-area').appendChild(detailsPage);
        }
        detailsPage.classList.remove('hidden');
        detailsPage.scrollTop = 0; // Mandar arriba al abrir

        // 🛠️ MAQUETACIÓN HTML FULL PAGE
        detailsPage.innerHTML = `
            <div id="cf-banner" style="width: 100%; height: 300px; background: #111; background-size: cover; background-position: center; position: relative;">
                <div style="position: absolute; inset: 0; background: linear-gradient(to top, var(--bg-main) 5%, transparent 95%);"></div>
                <button id="btn-back-to-mods" class="btn btn-secondary" style="position: absolute; top: 20px; left: 30px; z-index: 60; background: rgba(0,0,0,0.6); backdrop-filter: blur(5px); border: 1px solid rgba(255,255,255,0.1); padding: 10px 20px;">
                    <i class="ph-bold ph-arrow-left"></i> Volver al Buscador
                </button>
            </div>
            
            <div style="width: 100%; max-width: 1400px; margin: 0 auto; padding: 0 40px 40px 40px; margin-top: -100px; position: relative; z-index: 10;">
                
                <div style="display: flex; gap: 40px; flex-wrap: wrap; align-items: flex-start;">
                    
                    <div style="flex: 1; min-width: 600px;">
                        <div style="display: flex; gap: 25px; align-items: flex-end; margin-bottom: 40px;">
                            <img id="cf-icon" src="https://placehold.co/150x150/18181b/ffffff?text=M" style="width: 150px; height: 150px; border-radius: 20px; border: 5px solid var(--bg-main); background: #18181b; object-fit: cover; box-shadow: 0 10px 25px rgba(0,0,0,0.6);">
                            <div style="padding-bottom: 5px;">
                                <div id="cf-tags" style="display: flex; gap: 10px; margin-bottom: 12px; flex-wrap: wrap;"></div>
                                <h1 id="cf-title-main" style="margin: 0 0 8px 0; font-size: 2.5rem; color: #fff;">Cargando...</h1>
                                <p class="muted-text" style="margin: 0; font-size: 1rem;">Desarrollado por <span id="cf-author" style="color: var(--accent); font-weight: bold;">...</span></p>
                            </div>
                        </div>

                        <div class="sidebar-panel" style="margin-bottom: 0; padding: 30px; background: transparent; border: none;">
                            <h3 class="sidebar-title" style="font-size: 1.5rem; border-color: rgba(255,255,255,0.1);"><i class="ph-bold ph-file-text"></i> Descripción Oficial</h3>
                            <div id="cf-description" class="markdown-body" style="font-size: 1.05rem; line-height: 1.8; color: #e4e4e7;">
                                <div style="text-align:center; padding: 40px;"><i class="ph ph-spinner ph-spin" style="font-size: 40px; color: var(--accent);"></i><p>Conectando con Modrinth...</p></div>
                            </div>
                        </div>
                    </div>

                    <div class="sticky-sidebar" style="width: 380px;">
                        
                        <div class="sidebar-panel" style="background: rgba(99, 102, 241, 0.05); border-color: rgba(99, 102, 241, 0.2);">
                            <div id="cf-actions" style="display: flex; flex-direction: column; gap: 12px;">
                                <div style="text-align:center; color: var(--muted);"><i class="ph ph-spinner ph-spin"></i> Cargando botones...</div>
                            </div>
                        </div>

                        <div class="sidebar-panel">
                            <h4 class="sidebar-title" style="color: #a1a1aa;"><i class="ph-bold ph-books"></i> Librerías Necesarias</h4>
                            <div id="cf-dependencies" style="display: flex; flex-direction: column; gap: 10px;">
                                <div style="text-align:center; color: var(--muted);"><i class="ph ph-spinner ph-spin"></i> Buscando...</div>
                            </div>
                        </div>

                        <div class="sidebar-panel">
                            <h4 class="sidebar-title" style="color: #f87171;"><i class="ph-bold ph-youtube-logo"></i> Showcase / Tutorial</h4>
                            <div id="detail-video-container" style="display: none;">
                                <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px;">
                                    <iframe id="detail-video-iframe" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border:0;" allowfullscreen></iframe>
                                </div>
                            </div>
                            <div id="no-video-msg" style="text-align:center; color: var(--muted); font-size: 0.9rem; padding: 10px 0;"><i class="ph ph-spinner ph-spin"></i> Buscando video en YouTube...</div>
                        </div>

                        <div class="sidebar-panel" style="margin-bottom: 0;">
                            <h4 class="sidebar-title" style="color: #fbbf24;"><i class="ph-bold ph-scan"></i> Escáner Interno (JEI)</h4>
                            <div id="cf-jei">
                                <p style="font-size: 0.85rem; color: var(--muted); margin-top: 0;">Entidades y Crafteos detectados en el .JAR:</p>
                                <div id="jei-mobs-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 5px; margin-bottom: 15px;"></div>
                                <div id="jei-items-grid" style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 5px;"></div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        `;

        document.getElementById('btn-back-to-mods').addEventListener('click', () => {
            window.history.pushState({}, '', window.location.pathname);
            detailsPage.classList.add('hidden');
            document.getElementById('view-mods').classList.remove('hidden');
        });

        try {
            // 1. OBTENER INFO DEL MOD
            const res = await fetch(`https://api.modrinth.com/v2/project/${modId}`);
            if(!res.ok) { document.getElementById('cf-description').innerHTML = "<p style='color:red; text-align:center;'>Error 404: Mod no encontrado.</p>"; return; }
            const mod = await res.json();

            const iconUrl = mod.icon_url || 'https://placehold.co/150x150/18181b/ffffff?text=M';
            const bannerUrl = (mod.gallery && mod.gallery.length > 0) ? mod.gallery[0].url : iconUrl;

            document.getElementById('cf-title-main').textContent = mod.title;
            document.getElementById('cf-author').textContent = mod.team || 'Desarrollador Independiente';
            document.getElementById('cf-icon').src = iconUrl;
            document.getElementById('cf-banner').style.backgroundImage = `url('${bannerUrl}')`;
            
            document.getElementById('cf-description').innerHTML = mod.body ? marked.parse(mod.body) : `<p>${mod.description}</p>`;

            const tagsCont = document.getElementById('cf-tags');
            tagsCont.innerHTML = '';
            (mod.display_categories || []).slice(0, 4).forEach(tag => { 
                tagsCont.innerHTML += `<span class="mini-tag" style="background: rgba(255,255,255,0.1); padding: 5px 12px; border-radius: 8px; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.05); text-transform: capitalize;">${window.tagIcons ? (window.tagIcons[tag] || '<i class="ph-bold ph-tag"></i>') : '<i class="ph-bold ph-tag"></i>'} ${tag}</span>`; 
            });

            // 2. VERSIONES Y LIBRERÍAS
            const mcVers = document.getElementById('mod-version-select').value;
            const loader = document.getElementById('mod-loader-select').value;
            let primaryFile = null;
            let reqDeps = [];

            try {
                const versRes = await fetch(`https://api.modrinth.com/v2/project/${mod.id}/version?game_versions=["${mcVers}"]&loaders=["${loader}"]`);
                const versData = await versRes.json();
                if (versData.length > 0) {
                    primaryFile = versData[0].files.find(f => f.primary) || versData[0].files[0];
                    if(versData[0].dependencies) reqDeps = versData[0].dependencies.filter(d => d.dependency_type === 'required' && d.project_id);
                }
            } catch(e) {}

            // 3. BOTONES DE ACCIÓN
            const isAdded = window.modpackCart.some(item => item.id === mod.id);
            const actionsDiv = document.getElementById('cf-actions');
            
            let downloadBtnHtml = primaryFile 
                ? `<a href="${primaryFile.url}" target="_blank" class="btn btn-secondary" style="padding: 14px; width: 100%; justify-content: center; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); font-size: 1rem;"><i class="ph-bold ph-download-simple"></i> Descargar .JAR</a>`
                : `<button class="btn btn-secondary" disabled style="padding: 14px; width: 100%; justify-content: center;"><i class="ph-bold ph-warning"></i> Sin versión para ${mcVers}</button>`;

            actionsDiv.innerHTML = `
                <button class="btn btn-primary btn-add-cf" ${isAdded ? 'disabled' : ''} style="padding: 16px; font-size: 1.1rem; width: 100%; justify-content: center; border-radius: 10px; box-shadow: 0 4px 15px rgba(99,102,241,0.3); ${isAdded ? 'background: var(--success); color: white;' : 'background: linear-gradient(135deg, var(--accent), #4f46e5); border: none;'}">
                    <i class="ph-bold ${isAdded ? 'ph-check' : 'ph-plus'}"></i> ${isAdded ? 'Añadido al Modpack' : 'Instalar en el Modpack'}
                </button>
                ${downloadBtnHtml}
            `;
            
            actionsDiv.querySelector('.btn-add-cf').addEventListener('click', function() {
                if (!window.modpackCart.some(item => item.id === mod.id)) {
                    let fType = mod.project_type || 'mod';
                    if(mod.categories && mod.categories.includes('library')) fType = 'library';
                    window.modpackCart.push({ id: mod.id, title: mod.title, type: fType, icon: iconUrl, banner: bannerUrl, categories: mod.categories });
                    window.updateCartUI();
                    this.innerHTML = '<i class="ph-bold ph-check"></i> Añadido al Modpack';
                    this.style.background = 'var(--success)';
                    this.style.boxShadow = 'none';
                    this.disabled = true;
                }
            });

            // 4. LIBRERÍAS
            const depsContainer = document.getElementById('cf-dependencies');
            if (reqDeps.length > 0) {
                const projectIds = reqDeps.map(d => d.project_id);
                const depProjsRes = await fetch(`https://api.modrinth.com/v2/projects?ids=["${projectIds.join('","')}"]`);
                const depProjs = await depProjsRes.json();
                
                depsContainer.innerHTML = '';
                depProjs.forEach(dep => {
                    const isDepAdded = window.modpackCart.some(item => item.id === dep.id);
                    depsContainer.innerHTML += `
                        <div style="display:flex; align-items:center; gap: 12px; background: rgba(0,0,0,0.25); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); cursor:pointer; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='rgba(0,0,0,0.25)'" onclick="window.openModDetailsById('${dep.id}')">
                            <img src="${dep.icon_url || 'https://placehold.co/36x36'}" style="width: 40px; height: 40px; border-radius: 8px; background: #27272a; object-fit: cover;">
                            <div style="flex:1;">
                                <div style="font-size: 0.95rem; font-weight: bold; color: #fff;">${dep.title}</div>
                                <div style="font-size: 0.8rem; color: ${isDepAdded ? 'var(--success)' : 'var(--danger)'};"><i class="ph-bold ${isDepAdded ? 'ph-check' : 'ph-warning'}"></i> ${isDepAdded ? 'En tu Modpack' : 'Requiere Instalación'}</div>
                            </div>
                            <i class="ph-bold ph-caret-right" style="color: var(--muted); font-size: 1.2rem;"></i>
                        </div>
                    `;
                });
            } else {
                depsContainer.innerHTML = '<div style="color: #10b981; font-size: 0.95rem; padding: 12px; background: rgba(16,185,129,0.1); border-radius: 8px; border: 1px solid rgba(16,185,129,0.2);"><i class="ph-fill ph-check-circle"></i> Mod independiente. No necesita nada más.</div>';
            }

            // 5. CARGAR VIDEO (SÚPER FIX: Consulta interna garantizada usando una API libre)
            try {
                // Buscamos directamente el video sin depender de funciones externas que se puedan romper
                const videoQuery = encodeURIComponent(`${mod.title} minecraft mod showcase`);
                const ytRes = await fetch(`https://inv.tux.pizza/api/v1/search?q=${videoQuery}`);
                const ytData = await ytRes.json();
                
                if (ytData && ytData.length > 0) {
                    const videoId = ytData[0].videoId;
                    document.getElementById('no-video-msg').style.display = 'none';
                    document.getElementById('detail-video-container').style.display = 'block';
                    document.getElementById('detail-video-iframe').src = `https://www.youtube.com/embed/${videoId}?autoplay=0`;
                } else {
                    document.getElementById('no-video-msg').innerHTML = "No se encontraron tutoriales en YouTube.";
                }
            } catch (e) {
                // Si la API pública falla, intentamos llamar a tu función original si es que existe
                if (typeof window.loadModShowcase === 'function' || typeof loadModShowcase === 'function') {
                    try {
                        const funcToCall = window.loadModShowcase || loadModShowcase;
                        document.getElementById('no-video-msg').style.display = 'none'; 
                        funcToCall(mod.title);
                    } catch(err) {
                        document.getElementById('no-video-msg').style.display = 'block';
                        document.getElementById('no-video-msg').textContent = "No se pudo conectar con YouTube.";
                    }
                } else {
                    document.getElementById('no-video-msg').innerHTML = "Buscador de videos no disponible.";
                }
            }

            // 6. INICIAR AUTO-ESCANER JEI (Crafteos y Mobs)
            if (typeof window.runAutoScanJEI === 'function' || typeof runAutoScanJEI === 'function') {
                try {
                    const funcJEI = window.runAutoScanJEI || runAutoScanJEI;
                    funcJEI(mod.id, mcVers, loader);
                } catch (e) {}
            }

        } catch (e) {
            console.error("Fallo crítico en openModDetailsById:", e);
            document.getElementById('cf-title-main').textContent = "Error";
            document.getElementById('cf-description').innerHTML = `<p style="color:var(--danger);">Ocurrió un error cargando el mod.</p>`;
        }
    };
    
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
            const iconUrl = mod.icon_url || 'https://placehold.co/80x80/18181b/ffffff?text=M';
            const bannerUrl = (mod.gallery && mod.gallery.length > 0) ? mod.gallery[0] : iconUrl;
            
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
                            window.showEpicDepsModal({ id: this.dataset.id, title: this.dataset.title, type: this.dataset.type, iconUrl, bannerUrl, categories: mod.display_categories }, missingDeps, this);
                            this.innerHTML = originalHtml; this.disabled = false; return; 
                        }
                    }
                }

                let fType = mod.project_type || 'mod';
                if(mod.display_categories && mod.display_categories.includes('library')) fType = 'library';

                window.modpackCart.push({ 
                    id: mod.project_id, 
                    title: mod.title, 
                    type: fType, 
                    icon: iconUrl, 
                    banner: bannerUrl, 
                    categories: mod.display_categories 
                });

                window.updateCartUI();
                this.innerHTML = '<i class="ph-bold ph-check"></i> Añadido'; this.style.background = 'var(--success)'; this.style.color = 'white';
            });

            card.addEventListener('click', (e) => {
                if(e.target.closest('.btn-add-mod') || e.target.closest('.btn-download-jar')) return; 
                
                const safeId = mod.project_id || mod.id || mod.slug;
                
                if (safeId) {
                    window.openModDetailsById(safeId);
                    if (typeof runAutoScanJEI === 'function') {
                        runAutoScanJEI(safeId, versionSelect.value, loaderSelect.value);
                    }
                }
            });

            if(modsGrid) modsGrid.appendChild(card);
            
        }); 
    // ==========================================
    // MODAL ÉPICO DE DEPENDENCIAS (LIBRERÍAS)
    // ==========================================
    window.showEpicDepsModal = function(mainMod, missingDeps, triggerButton) {
        const modal = document.getElementById('epic-deps-modal');
        if(!modal) return;
        
        document.getElementById('epic-mod-name').textContent = mainMod.title;
        const list = document.getElementById('epic-deps-list'); 
        list.innerHTML = '';
        
        missingDeps.forEach((p, index) => {
            let animClass = index % 2 === 0 ? 'anim-right' : 'anim-left';
            list.innerHTML += `
            <div class="tilt-wrapper" style="margin-bottom: 10px;">
                <div class="tilt-card ${animClass}" style="background: var(--bg-main);">
                    <img src="${p.icon_url || 'https://placehold.co/40x40/18181b/ffffff?text=M'}" alt="icon">
                    <div class="dep-info" style="text-align: left;">
                        <h4>${p.title}</h4><span>Componente central requerido</span>
                    </div>
                </div>
            </div>`;
        });

        document.getElementById('btn-epic-add-all').onclick = () => {
            // Añadir mod principal
            if (!window.modpackCart.some(item => item.id === mainMod.id)) {
                window.modpackCart.push({ id: mainMod.id, title: mainMod.title, type: mainMod.type || 'mod', icon: mainMod.iconUrl, banner: mainMod.bannerUrl, categories: mainMod.categories });
            }
            // Añadir todas las librerías
            missingDeps.forEach(dep => { 
                if (!window.modpackCart.some(item => item.id === dep.id)) {
                    window.modpackCart.push({ id: dep.id, title: dep.title, type: 'library', icon: dep.icon_url, banner: dep.icon_url, categories: ['library'] }); 
                }
            });
            
            window.updateCartUI();
            
            if(triggerButton) { 
                triggerButton.innerHTML = '<i class="ph-bold ph-check"></i> Añadido'; 
                triggerButton.style.background = 'var(--success)'; 
                triggerButton.disabled = true; 
            }
            modal.classList.add('hidden');
        };
        modal.classList.remove('hidden');
    }
    }

    // ==========================================
    // 8. BUSCADOR DE SKINS 3D / INFO PREMIUM
    // ==========================================
    const btnLoadSkin = document.getElementById('btn-load-skin');
    const inputSkin = document.getElementById('mc-skin-input');
    const skinLoading = document.getElementById('skin_loading');
    const advInfoBox = document.getElementById('mc-advanced-info');
    const uuidBadge = document.getElementById('mc-uuid-badge');
    const capeBadge = document.getElementById('mc-cape-badge');

    // Se asume que en index.html está importada la librería skinview3d
    window.skinViewerInstance = null;

    if (btnLoadSkin && inputSkin) {
        const fetchMojangData = async (username) => {
            if (username === '') return;
            btnLoadSkin.innerHTML = '<i class="ph ph-spinner ph-spin"></i>'; btnLoadSkin.disabled = true;
            if(skinLoading) skinLoading.style.display = 'block';
            
            try {
                const res = await fetch(`https://api.ashcon.app/mojang/v2/user/${username}`);
                if (!res.ok) throw new Error("No encontrado");
                const data = await res.json();
                
// RENDERIZADO 3D USANDO skinview3d
                if (typeof skinview3d !== 'undefined') {
                    if (window.skinViewerInstance) { window.skinViewerInstance.dispose(); }
                    
                    window.skinViewerInstance = new skinview3d.SkinViewer({
                        canvas: document.getElementById("skin_container"),
                        width: 300,
                        height: 300,
                        // 🔥 Solución Anti-CORS: Usamos la data en Base64 directa de Ashcon
                        skin: `data:image/png;base64,${data.textures.skin.data}`
                    });

                    // Añadir capa si la tiene
                    if (data.textures && data.textures.cape && data.textures.cape.data) {
                        window.skinViewerInstance.loadCape(`data:image/png;base64,${data.textures.cape.data}`);
                    }

                    // Controles de cámara automática y animación de caminar
                    window.skinViewerInstance.autoRotate = true;
                    window.skinViewerInstance.autoRotateSpeed = 0.5;
                    window.skinViewerInstance.animation = new skinview3d.WalkingAnimation();
                }
                
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
                if (advInfoBox) advInfoBox.style.display = 'none';
            } finally {
                btnLoadSkin.innerHTML = '<i class="ph-bold ph-magnifying-glass"></i>'; btnLoadSkin.disabled = false;
                if(skinLoading) skinLoading.style.display = 'none';
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
                window.modpackCart.push({ id: p.id, title: p.title, type: p.project_type || 'mod', icon: p.icon_url, banner: (p.gallery && p.gallery.length > 0) ? p.gallery[0].url : p.icon_url, categories: p.categories });
                window.updateCartUI();
            };
        } catch(e) { recBox.style.display = 'none'; }
    };

    // ============================================================
    // 10. REFORMA TOTAL DEL CARRITO (Lógica Categorizada y Premium)
    // ============================================================

    window.updateCartUI = function() {
        const cartBody = document.querySelector('.cart-body');
        if(!cartBody) return;

        // Auto-inyecta las categorías si no existen
        if(!document.getElementById('cart-cat-mods')) {
            cartBody.innerHTML = `
                <div id="empty-cart-msg" class="empty-state"><i class="ph-duotone ph-ghost" style="color: var(--border-color); font-size: 60px;"></i><p>Tu modpack está vacío.</p></div>
                <div id="cart-cat-mods" class="cart-category-container"><div class="cart-category-header" style="color: var(--accent);"><i class="ph-fill ph-puzzle-piece"></i> Mods de Juego</div><ul id="cart-list-mods" class="cart-item-list"></ul></div>
                <div id="cart-cat-resourcepacks" class="cart-category-container"><div class="cart-category-header" style="color: #10b981;"><i class="ph-fill ph-paint-brush"></i> Texturas</div><ul id="cart-list-resourcepacks" class="cart-item-list"></ul></div>
                <div id="cart-cat-shaders" class="cart-category-container"><div class="cart-category-header" style="color: #f59e0b;"><i class="ph-fill ph-aperture"></i> Shaders</div><ul id="cart-list-shaders" class="cart-item-list"></ul></div>
                <div id="cart-cat-libraries" class="cart-category-container"><div class="cart-category-header" style="color: #6366f1;"><i class="ph-fill ph-books"></i> Librerías</div><ul id="cart-list-libraries" class="cart-item-list"></ul></div>
                <div id="recommendations-box" style="margin-top: 25px; border-top: 1px solid var(--border-color); padding-top: 15px; display: none; background: rgba(16,185,129,0.05); padding: 15px; border-radius: var(--radius-md);"><p class="muted-text text-sm mb-10"><i class="ph-fill ph-lightbulb" style="color: #fbbf24;"></i> <strong style="color:white;">Sugerencia Coherente:</strong></p><div id="rec-item"></div></div>
            `;
        }

        const cartContainers = {
            'mod': { main: document.getElementById('cart-cat-mods'), list: document.getElementById('cart-list-mods') },
            'resourcepack': { main: document.getElementById('cart-cat-resourcepacks'), list: document.getElementById('cart-list-resourcepacks') },
            'shader': { main: document.getElementById('cart-cat-shaders'), list: document.getElementById('cart-list-shaders') },
            'library': { main: document.getElementById('cart-cat-libraries'), list: document.getElementById('cart-list-libraries') }
        };

        Object.values(cartContainers).forEach(c => {
            if(c.list) c.list.innerHTML = '';
            if(c.main) c.main.style.display = 'none'; 
        });

        const emptyMsg = document.getElementById('empty-cart-msg');
        const btnFinalizar = document.getElementById('btn-open-save-modal');

        if (window.modpackCart.length === 0) {
            if(emptyMsg) emptyMsg.style.display = 'block';
            if(btnFinalizar) btnFinalizar.disabled = true;
        } else {
            if(emptyMsg) emptyMsg.style.display = 'none';
            if(btnFinalizar) btnFinalizar.disabled = false;

            window.modpackCart.forEach((item, index) => {
                let renderCat = item.type;
                if(item.type === 'mod' && item.categories && item.categories.includes('library')) renderCat = 'library';
                
                const target = cartContainers[renderCat];
                if(!target) return; 

                target.main.style.display = 'block';

                const icon = item.icon || 'https://placehold.co/48x48/18181b/ffffff?text=M';
                const banner = item.banner || item.icon || '';

// (Dentro de window.updateCartUI)
                const li = document.createElement('li');
                li.className = 'cart-item';
                li.innerHTML = `
                    <button class="btn-config-cart" data-id="${item.id}" data-title="${item.title}" title="Configurar .json/.toml"><i class="ph-bold ph-gear"></i></button>
                    <button class="btn-info-cart" data-id="${item.id}" title="Ver Detalles"><i class="ph-bold ph-info"></i></button>
                    <button class="btn-remove-cart" data-index="${index}" title="Eliminar de mi Pack"><i class="ph-bold ph-trash"></i></button>
                    <div class="cart-item-banner" style="background-image: url('${banner}');"></div>
                    <img src="${icon}" class="cart-item-avatar">
                    <div class="cart-item-info"><span class="cart-item-title">${item.title}</span></div>
                `;
                target.list.appendChild(li);
            });

            document.querySelectorAll('.btn-remove-cart').forEach(btn => {
                btn.addEventListener('click', function() {
                    window.modpackCart.splice(this.dataset.index, 1); window.updateCartUI(); fetchRealMods(false);
                });
            });
            // (Agrega esto justo debajo de los listeners de .btn-remove-cart)
            document.querySelectorAll('.btn-info-cart').forEach(btn => {
                btn.addEventListener('click', function() {
                    window.openModDetailsById(this.dataset.id);
                });
            });

            document.querySelectorAll('.btn-config-cart').forEach(btn => {
                btn.addEventListener('click', function() {
                    const editor = document.getElementById('config-editor-modal');
                    if(!editor) return;
                    document.getElementById('config-mod-id').value = this.dataset.id;
                    document.getElementById('config-mod-title').innerHTML = `<i class="ph-bold ph-gear"></i> Config: ${this.dataset.title}`;
                    document.getElementById('config-filename').value = `${this.dataset.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}.toml`;
                    editor.classList.remove('hidden');
                });
            });
        }

        const badgeBtn = document.getElementById('mobile-cart-toggle-btn');
        if(badgeBtn && !badgeBtn.innerHTML.includes('ph-x')) badgeBtn.innerHTML = `<i class="ph-bold ph-package"></i> <span class="badge">${window.modpackCart.length}</span>`;
        
        if(typeof window.updateRecommendations === 'function') window.updateRecommendations();
    };

// ============================================================
    // 11. MOTOR DE PLANTILLAS DINÁMICO (50 a 300 Mods) Y RULETA
    // ============================================================

 async function applyDynamicTemplate(btnElement, templateName, theme) {
        let targetSize = prompt(`¿Cuántos mods quieres para tu pack de ${templateName}? (Elige un número entre 50 y 300)`, "100");
        if (!targetSize || isNaN(targetSize)) return;
        targetSize = Math.max(20, Math.min(300, parseInt(targetSize)));

        if(!confirm(`Se generará un Modpack de ${templateName} con ${targetSize} mods. IMPORTANTE: También se descargarán automáticamente todas las librerías necesarias, por lo que el total será mayor. ¿Continuar?`)) return;
        
        const originalHtml = btnElement.innerHTML;
        btnElement.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Ensamblando...';
        btnElement.disabled = true;

        window.modpackCart = []; 
        window.updateCartUI();

        const mcVers = versionSelect.value;
        const loader = loaderSelect.value;

        const aiTerminal = document.getElementById('ai-terminal'); 
        if(aiTerminal) { aiTerminal.style.display = 'block'; aiTerminal.innerHTML = `> Escaneando Modrinth para ${targetSize} mods de ${templateName}...<br>`; }

        const themeCategories = {
            'rpg': ['adventure', 'magic', 'worldgen', 'equipment'],
            'tech': ['technology', 'storage', 'energy', 'automation'],
            'random': ['adventure', 'technology', 'magic', 'decoration', 'worldgen']
        };
        const categories = themeCategories[theme] || themeCategories['random'];

        let fetchedMods = [];
        let offset = 0;

        try {
            // FASE 1: Obtener mods base
            while (fetchedMods.length < targetSize && offset < 1000) {
                const randomCategory = categories[Math.floor(Math.random() * categories.length)];
                let facets = [[`versions:${mcVers}`], [`categories:${loader}`], ["project_type:mod"]];
                if (theme !== 'random') facets.push([`categories:${randomCategory}`]);

                const res = await fetch(`https://api.modrinth.com/v2/search?limit=100&offset=${offset}&index=relevance&facets=${encodeURIComponent(JSON.stringify(facets))}`);
                const data = await res.json();
                
                if (!data.hits || data.hits.length === 0) break;

                const newMods = data.hits.filter(mod => !fetchedMods.some(m => m.project_id === mod.project_id));
                fetchedMods = fetchedMods.concat(newMods);
                offset += 100;
                
                if(aiTerminal) { aiTerminal.innerHTML += `> Encontrados ${fetchedMods.length}/${targetSize} mods...<br>`; aiTerminal.scrollTop = aiTerminal.scrollHeight; }
            }

            fetchedMods = fetchedMods.sort(() => 0.5 - Math.random()).slice(0, targetSize);

            // FASE 2: Auto-Librerías (NUEVO)
            if(aiTerminal) { aiTerminal.innerHTML += `> Analizando y añadiendo librerías requeridas (Esto puede tardar unos segundos)...<br>`; aiTerminal.scrollTop = aiTerminal.scrollHeight; }
            
            // Inyectamos los mods principales primero
            fetchedMods.forEach(mod => {
                window.modpackCart.push({ 
                    id: mod.project_id, title: mod.title, type: 'mod', 
                    icon: mod.icon_url, banner: (mod.gallery && mod.gallery.length > 0) ? mod.gallery[0] : mod.icon_url,
                    categories: mod.display_categories
                });
            });

            // Buscamos dependencias en lotes para no saturar la API
            let libsAdded = 0;
            for (let mod of fetchedMods) {
                try {
                    const deps = await getRequiredDependencies(mod.project_id, mcVers, loader);
                    if (deps && deps.length > 0) {
                        deps.forEach(dep => {
                            if (!window.modpackCart.some(item => item.id === dep.id)) {
                                window.modpackCart.push({
                                    id: dep.id, title: dep.title, type: 'library',
                                    icon: dep.icon_url, banner: dep.icon_url, categories: ['library']
                                });
                                libsAdded++;
                            }
                        });
                    }
                } catch(e) {} // Ignorar si un mod falla
            }

            window.updateCartUI();
            
            btnElement.innerHTML = `<i class="ph-bold ph-check-circle"></i> ¡${fetchedMods.length} Mods + ${libsAdded} Libs!`;
            btnElement.style.background = 'var(--success)';
            btnElement.style.color = 'white';
            
            if(aiTerminal) { 
                aiTerminal.innerHTML += `> ¡Éxito! Plantilla inyectada: ${fetchedMods.length} mods y ${libsAdded} librerías.<br>`;
                aiTerminal.scrollTop = aiTerminal.scrollHeight;
            }

            setTimeout(() => { 
                btnElement.innerHTML = originalHtml; 
                btnElement.style = ''; 
                btnElement.disabled = false; 
                if(aiTerminal) aiTerminal.style.display='none'; 
            }, 5000);

        } catch(e) { 
            alert(`Error conectando con la API para la plantilla ${templateName}.`); 
            btnElement.innerHTML = originalHtml;
            btnElement.style = '';
            btnElement.disabled = false;
        }
    }
    
    // ============================================================
    // 12. MOTOR DE TOGGLE DEL CARRITO (Estilo "App" para Escritorio)
    // ============================================================
    let mobileBtn = document.getElementById('mobile-cart-toggle-btn');
    if (!mobileBtn) {
        mobileBtn = document.createElement('button');
        mobileBtn.id = 'mobile-cart-toggle-btn';
        mobileBtn.className = 'mobile-cart-toggle'; 
        mobileBtn.innerHTML = `<i class="ph-bold ph-package"></i> <span class="badge">${window.modpackCart ? window.modpackCart.length : 0}</span>`;
        document.body.appendChild(mobileBtn);
    }

    const cartPanel = document.querySelector('.cart-panel');
    if (mobileBtn && cartPanel) {
        mobileBtn.addEventListener('click', () => {
            if (cartPanel.classList.contains('active')) {
                cartPanel.classList.remove('active');
                cartPanel.style.right = ''; 
                mobileBtn.innerHTML = `<i class="ph-bold ph-package"></i> <span class="badge">${window.modpackCart.length}</span>`;
            } else {
                cartPanel.classList.add('active');
                cartPanel.style.right = ''; 
                mobileBtn.innerHTML = `<i class="ph-bold ph-x"></i>`; 
            }
        });
    }

    const btnCloseCartMobile = document.getElementById('btn-close-cart-mobile');
    if (btnCloseCartMobile && cartPanel) {
        btnCloseCartMobile.addEventListener('click', () => {
            cartPanel.classList.remove('active');
            cartPanel.style.right = ''; 
            if (mobileBtn) mobileBtn.innerHTML = `<i class="ph-bold ph-package"></i> <span class="badge">${window.modpackCart.length}</span>`;
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
    // 13. GESTIÓN DE PLANTILLAS Y PERFILES GUARDADOS
    // ==========================================
    window.loadTemplates = function() {
        const grid = document.getElementById('templates-grid');
        if(!grid) return;
        
        grid.innerHTML = '';
        window.modpackTemplates.forEach((p, index) => {
            const profileIcon = `https://placehold.co/64x64/18181b/3b82f6?text=Official`;
            const profileBanner = profileIcon;
            const modsCount = p.modsData ? p.modsData.length : 0;
            
            grid.innerHTML += `
                <div class="profile-card panel" style="padding:0; overflow:hidden; display:flex; flex-direction:column; border: 1px solid rgba(59, 130, 246, 0.2); border-radius: var(--radius-lg); background: var(--bg-panel);">
                    <div class="profile-banner" style="background-image: url('${profileBanner}'); height: 100px; background-size: cover; background-position: center; position: relative;">
                        <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, transparent, var(--bg-panel));"></div>
                    </div>
                    <div class="profile-content" style="padding: 15px; position: relative; z-index: 2; margin-top: -40px; display: flex; flex-direction: column; flex: 1;">
                        <div class="profile-header" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px;">
                            <img src="${profileIcon}" class="profile-icon" style="width: 54px; height: 54px; border-radius: 12px; border: 3px solid var(--bg-panel); background: #18181b; object-fit: cover;">
                        </div>
                        <div class="profile-title" style="font-size: 1.2rem; font-weight: bold; margin-bottom: 8px;">${p.name}</div>
                        <p class="muted-text text-sm mb-10" style="line-height: 1.4;">${p.description}</p>
                        <div class="profile-badges" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 15px;">
                            <span class="p-badge" style="background:rgba(59, 130, 246, 0.1); color:#3b82f6; padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:bold;"><i class="ph-bold ph-game-controller"></i> ${p.mcVersion}</span>
                            <span class="p-badge" style="background:rgba(245,158,11,0.1); color:#f59e0b; padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:bold;"><i class="ph-bold ph-hammer"></i> ${p.modLoader.toUpperCase()}</span>
                            <span class="p-badge" style="background:rgba(255,255,255,0.1); color:#fff; padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:bold;"><i class="ph-bold ph-puzzle-piece"></i> ${modsCount} Mods</span>
                        </div>
                        <div class="profile-actions" style="display: flex; gap: 10px; margin-top: auto;">
                            <button class="btn btn-primary btn-use-template w-100" data-index="${index}" style="padding: 12px; font-size: 0.95rem; background: linear-gradient(135deg, #3b82f6, #2563eb); border: none;">
                                <i class="ph-fill ph-package"></i> Usar Plantilla
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        document.querySelectorAll('.btn-use-template').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.currentTarget.dataset.index;
                const template = window.modpackTemplates[index];
                
                if (confirm(`¿Crear un nuevo perfil a partir de la plantilla "${template.name}"?`)) {
                    window.modpackCart = template.modsData.map(modSlug => ({ id: modSlug, title: modSlug, type: 'mod', icon: null, banner: null }));
                    versionSelect.value = template.mcVersion;
                    loaderSelect.value = template.modLoader;
                    window.updateCartUI();
                    document.querySelector('.nav-btn[data-target="mods"]').click();
                    versionSelect.dispatchEvent(new Event('change'));
                }
            });
        });
    };

    window.loadMyProfiles = function() {
        window.loadTemplates();
        
        const grid = document.getElementById('profiles-grid');
        if(!grid) return;
window.checkIsLoggedIn().then(loggedIn => {
    if(!loggedIn) { 
        grid.innerHTML = `<div style="text-align: center; padding: 40px;"><i class="ph-bold ph-lock-key" style="font-size: 40px; color: var(--muted);"></i><p style="margin-top: 10px;">Inicia sesión para guardar tus modpacks aquí.</p></div>`; 
        return; 
    }
        const profiles = JSON.parse(localStorage.getItem('mis_modpacks_guardados') || '[]');
        if (profiles.length === 0) { grid.innerHTML = '<div style="text-align:center; padding:40px;"><p>Aún no has guardado ningún Modpack.</p></div>'; return; }

        grid.innerHTML = '';
        profiles.forEach((p, index) => {
            const modsCount = p.modsData ? p.modsData.length : 0;
            
            let modsPreviewHtml = '';
            if(p.modsData && p.modsData.length > 0) {
                const maxPreview = 8;
                const previewMods = p.modsData.slice(0, maxPreview);
                previewMods.forEach((mod, i) => {
                    // BUG 3 ARREGLADO: Validar que exista el ícono
                    const icon = (mod.icon && mod.icon.startsWith('http')) ? mod.icon : 'https://placehold.co/32x32/27272a/ffffff?text=M';
                    modsPreviewHtml += `<img src="${icon}" title="${mod.title}" onerror="this.src='https://placehold.co/32x32/27272a/ffffff?text=M'" style="z-index: ${maxPreview - i}; width:32px; height:32px; border-radius:50%; border:2px solid var(--bg-panel); margin-left:-10px; object-fit:cover; background:#27272a;">`;
                });
                if(modsCount > maxPreview) {
                    modsPreviewHtml += `<div class="profile-mods-extra" style="width:32px; height:32px; border-radius:50%; background:var(--bg-hover); border:2px solid var(--bg-panel); display:flex; justify-content:center; align-items:center; font-size:0.7rem; font-weight:bold; margin-left:-10px; z-index:1; color:var(--text-muted);">+${modsCount - maxPreview}</div>`;
                }
            } else {
                modsPreviewHtml = '<span class="muted-text text-sm">Perfil Vacío</span>';
            }

            // BUG 3 ARREGLADO: Validar que exista banner
            const fallbackIcon = 'https://placehold.co/64x64/18181b/10b981?text=Pack';
            const profileIcon = p.iconBase64 || (p.modsData && p.modsData[0] && p.modsData[0].icon) || fallbackIcon;
            const profileBanner = (p.modsData && p.modsData[0] && p.modsData[0].banner) || profileIcon;

            grid.innerHTML += `
                <div class="profile-card panel" style="padding:0; overflow:hidden; display:flex; flex-direction:column; border: 1px solid var(--border-color); border-radius: var(--radius-lg); background: var(--bg-panel);">
                    <div class="profile-banner" style="background-image: url('${profileBanner}'); height: 100px; background-size: cover; background-position: center; position: relative;">
                        <div style="position: absolute; inset: 0; background: linear-gradient(to bottom, transparent, var(--bg-panel));"></div>
                    </div>
                    <div class="profile-content" style="padding: 15px; position: relative; z-index: 2; margin-top: -40px; display: flex; flex-direction: column; flex: 1;">
                        
                        <div class="profile-header" style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 10px;">
                            <img src="${profileIcon}" onerror="this.src='${fallbackIcon}'" class="profile-icon" style="width: 54px; height: 54px; border-radius: 12px; border: 3px solid var(--bg-panel); background: #18181b; object-fit: cover;">
                            <div style="display: flex; gap: 6px;">
                                <button class="btn-edit-name" data-index="${index}" title="Renombrar" style="background: rgba(255,255,255,0.1); border:none; color:white; padding:6px; border-radius:6px; cursor:pointer;"><i class="ph-bold ph-pencil-simple"></i></button>
                                <button class="btn-share-profile" data-index="${index}" title="Compartir" style="background: rgba(99,102,241,0.2); border:none; color:var(--accent); padding:6px; border-radius:6px; cursor:pointer;"><i class="ph-bold ph-link"></i></button>
                                <button class="btn-delete-profile" data-index="${index}" title="Eliminar" style="background: rgba(239,68,68,0.2); border:none; color:var(--danger); padding:6px; border-radius:6px; cursor:pointer;"><i class="ph-bold ph-trash"></i></button>
                            </div>
                        </div>
                        
                        <div class="profile-title" style="font-size: 1.2rem; font-weight: bold; margin-bottom: 8px;">${p.name}</div>
                        
                        <div class="profile-badges" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 15px;">
                            <span class="p-badge" style="background:rgba(16,185,129,0.1); color:var(--success); padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:bold;"><i class="ph-bold ph-game-controller"></i> ${p.mcVersion}</span>
                            <span class="p-badge" style="background:rgba(245,158,11,0.1); color:#f59e0b; padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:bold;"><i class="ph-bold ph-hammer"></i> ${p.modLoader.toUpperCase()}</span>
                            <span class="p-badge" style="background:rgba(255,255,255,0.1); color:#fff; padding:4px 8px; border-radius:6px; font-size:0.75rem; font-weight:bold;"><i class="ph-bold ph-puzzle-piece"></i> ${modsCount} Mods</span>
                        </div>

                        <div class="profile-mods-preview" style="display: flex; margin-bottom: 20px; align-items: center; padding-left: 10px;">
                            ${modsPreviewHtml}
                        </div>
                        
                        <div class="profile-actions" style="display: flex; gap: 10px; margin-top: auto;">
                            <button class="btn btn-secondary btn-view-content" data-index="${index}" style="flex: 1; padding: 10px; font-size: 0.9rem;">
                                <i class="ph-bold ph-list-magnifying-glass"></i> Ver Mods
                            </button>
                            <button class="btn btn-primary btn-edit-profile" data-index="${index}" style="flex: 1; padding: 10px; font-size: 0.9rem;">
                                <i class="ph-bold ph-folder-open"></i> Editar
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });

        document.querySelectorAll('.btn-edit-name').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = e.currentTarget.dataset.index;
                const newName = prompt("Escribe el nuevo nombre:", profiles[idx].name);
                if(newName && newName.trim() !== '') {
                    profiles[idx].name = newName.trim();
                    localStorage.setItem('mis_modpacks_guardados', JSON.stringify(profiles));
                    window.loadMyProfiles();
                }
            });
        });

        document.querySelectorAll('.btn-share-profile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profile = profiles[e.currentTarget.dataset.index];
                const compactData = profile.modsData.map(m => `${m.id}${m.type !== 'mod' ? '_'+m.type : ''}`).join('-');
                navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?pack=${compactData}`);
                alert("🔗 ¡Enlace copiado!");
            });
        });

        document.querySelectorAll('.btn-delete-profile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if(confirm("¿Eliminar perfil?")) { 
                    profiles.splice(e.currentTarget.dataset.index, 1); 
                    localStorage.setItem('mis_modpacks_guardados', JSON.stringify(profiles)); 
                    window.loadMyProfiles(); 
                }
            });
        });

        document.querySelectorAll('.btn-edit-profile').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const profile = profiles[e.currentTarget.dataset.index];
                // BUG 1 ARREGLADO: Copia profunda en vez de pasar referencia
                window.modpackCart = JSON.parse(JSON.stringify(profile.modsData)); 
                versionSelect.value = profile.mcVersion; 
                loaderSelect.value = profile.modLoader;
                window.updateCartUI(); 
                document.querySelector('.nav-btn[data-target="mods"]').click(); 
                versionSelect.dispatchEvent(new Event('change'));
            });
        });

        document.querySelectorAll('.btn-view-content').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const p = profiles[e.currentTarget.dataset.index];
                const sharedModal = document.getElementById('shared-pack-modal');
                const sharedList = document.getElementById('shared-pack-list');
                const btnInstall = document.getElementById('btn-install-shared');
                
                if(sharedModal && sharedList) {
                    sharedModal.querySelector('h2').textContent = `Contenido: ${p.name}`;
                    sharedModal.querySelector('p').textContent = `Vista previa de los ${p.modsData.length} mods instalados.`;
                    
                    sharedList.innerHTML = '';
                    p.modsData.forEach(item => {
                        const icon = item.icon && item.icon.startsWith('http') ? item.icon : 'https://placehold.co/40x40/18181b/ffffff?text=M';
                        sharedList.innerHTML += `
                            <div class="shared-mod-item" onclick="window.openModDetailsById('${item.id}')" style="display: flex; gap: 15px; align-items: center; background: rgba(0,0,0,0.2); padding: 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer; transition: 0.2s;">
                                <img src="${icon}" onerror="this.src='https://placehold.co/40x40/18181b/ffffff?text=M'" style="width: 40px; height: 40px; border-radius: 8px; object-fit: cover; background: #27272a;">
                                <div style="flex: 1; text-align: left;">
                                    <h4 style="margin: 0; font-size: 0.95rem; color: #fff;">${item.title}</h4>
                                    <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">${item.type}</span>
                                </div>
                            </div>
                        `;
                    });
                    
                    if(btnInstall) btnInstall.style.display = 'none';
                    document.getElementById('btn-cancel-shared').textContent = "Cerrar Lista";
                    document.getElementById('btn-cancel-shared').onclick = () => {
                        sharedModal.classList.add('hidden');
                        if(btnInstall) btnInstall.style.display = 'block'; 
                    };
                    
                    sharedModal.classList.remove('hidden');
                }
            });
        });
    });
}

    // ==========================================
    // 14. COMPARADOR DE SHADERS
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
    // 15. IMPORTADOR DE ARCHIVOS .JAR LOCALES
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
    // 16. AUTO-SCANNER JEI & VISOR 3D (Extracción ZIP Web)
    // ==========================================
    const recipeViewer = document.getElementById('jei-recipe-viewer');
    const recipeContent = document.getElementById('jei-recipe-content');
    document.getElementById('btn-close-recipe')?.addEventListener('click', () => { if(recipeViewer) recipeViewer.style.display = 'none'; });
    
    async function runAutoScanJEI(modId, mcVers, loader) {
        // 1. ESCUDO DE SEGURIDAD: Evitar que haga peticiones nulas
        if (!modId || modId === 'undefined' || modId === 'null') {
            console.warn("Auto-Scan cancelado: ID de mod inválido.");
            return;
        }

        const itemsGrid = document.getElementById('jei-items-grid'); 
        const mobsGrid = document.getElementById('jei-mobs-grid');
        const leftSidebar = document.querySelector('.jei-sidebar-left'); 
        const rightSidebar = document.querySelector('.jei-sidebar-right');
        
        if(leftSidebar) leftSidebar.style.display = 'none'; 
        if(rightSidebar) rightSidebar.style.display = 'none';
        if(!itemsGrid || !mobsGrid) return;
        
        leftSidebar.style.display = 'block'; 
        rightSidebar.style.display = 'flex'; 
        if(recipeViewer) recipeViewer.style.display = 'none';

        itemsGrid.innerHTML = '<div class="muted-text text-sm" style="grid-column:1/-1; text-align:center; padding: 20px;"><i class="ph ph-spinner ph-spin"></i> Extrayendo archivos...</div>';
        mobsGrid.innerHTML = '<div class="muted-text text-sm" style="grid-column:1/-1; padding: 20px;"><i class="ph ph-spinner ph-spin"></i> Buscando entidades...</div>';

        try {
            const versRes = await fetch(`https://api.modrinth.com/v2/project/${modId}/version?game_versions=["${mcVers}"]&loaders=["${loader}"]`);
            
            // 2. ESCUDO CONTRA 404 (Not Found)
            if (!versRes.ok) {
                throw new Error("No se pudo obtener la versión para el escáner JEI.");
            }

            const versData = await versRes.json();
            if (!versData || versData.length === 0 || versData[0].files.length === 0) {
                throw new Error("Sin archivos Java compatibles para esta versión.");
            }

            const fileUrl = versData[0].files.find(f => f.primary)?.url || versData[0].files[0].url;
            const fileRes = await fetch(fileUrl); 
            const fileBlob = await fileRes.blob();
            
            if (typeof JSZip === 'undefined') throw new Error("Falta la librería JSZip");
            
            const zip = new JSZip(); 
            const unzipped = await zip.loadAsync(fileBlob);
            const allFiles = Object.keys(unzipped.files);
            
            const recipeFiles = allFiles.filter(p => p.includes('data/') && p.includes('recipes/') && p.endsWith('.json'));
            const parsedRecipes = [];
            for (let path of recipeFiles) { 
                try { 
                    parsedRecipes.push({ path: path, data: JSON.parse(await unzipped.files[path].async('string')) }); 
                } catch(e) {} 
            }

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
            if (itemsGrid) itemsGrid.innerHTML = itemCount === 0 ? '<div class="muted-text text-sm" style="grid-column:1/-1; text-align:center; padding: 20px;">No se encontraron ítems.</div>' : itemsHTML;
            if (mobsGrid) mobsGrid.innerHTML = mobCount === 0 ? '<div class="muted-text text-sm" style="grid-column:1/-1; text-align:center; padding: 20px;">No se encontraron entidades 3D.</div>' : mobsHTML;

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

        } catch (error) { 
            console.warn("JEI Auto-Scan abortado:", error.message);
            if (leftSidebar) leftSidebar.style.display = 'none'; 
            if (rightSidebar) rightSidebar.style.display = 'none'; 
        }
    }

    // ==========================================
    // 17. INTELIGENCIA ARTIFICIAL (Agente)
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
                        tempAiCart.push({ id: pData.id, title: pData.title, type: 'mod', icon: pData.icon_url, banner: (pData.gallery && pData.gallery.length > 0) ? pData.gallery[0].url : pData.icon_url }); procesados++; aiLog(`[${procesados}] Añadido ${pData.title}...`);
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

    const btnAiBuilderMobile = document.getElementById('btn-ai-builder-mobile');
    
    if (btnAiBuilderMobile && aiModal) {
        btnAiBuilderMobile.addEventListener('click', () => {
            aiModal.classList.remove('hidden'); aiTerminal.style.display = 'none'; aiTerminal.innerHTML = '> Esperando órdenes...<br>'; aiPrompt.value = ''; btnGenerateAiDownload.disabled = false;
        });
    }


    // ============================================================
    // 19. SISTEMA DE COMUNIDAD (SUPABASE)
    // ============================================================
    
    const viewCommunity = document.getElementById('view-community');
    const communityGrid = document.getElementById('community-grid');
    const commModal = document.getElementById('community-modal');
    let currentCommunityPack = null;

    // Registrar la vista
    views['community'] = viewCommunity;

    window.loadCommunityGallery = async function() {
        if(!communityGrid) return;
        communityGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px;"><i class="ph ph-spinner ph-spin" style="font-size: 40px;"></i><p>Conectando con Supabase...</p></div>';
        
        try {
            // Llamada real a tu base de datos Supabase
            // Reemplaza 'window.supabaseClient' por la variable que uses para supabase
            const { data: publicPacks, error } = await window.supabaseClient
                .from('modpacks')
                .select('*')
                .eq('is_public', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (!publicPacks || publicPacks.length === 0) {
                communityGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px;"><p>No hay modpacks públicos todavía. ¡Sé el primero en compartir el tuyo!</p></div>';
                return;
            }

            communityGrid.innerHTML = '';
            
            publicPacks.forEach(pack => {
                const modsCount = pack.mods_data ? pack.mods_data.length : 0;
                
                communityGrid.innerHTML += `
                    <div class="profile-card panel" style="border: 1px solid var(--border-color); background: var(--bg-panel); padding: 20px;">
                        <h3 style="margin-top: 0; font-size: 1.3rem;">${pack.name}</h3>
                        <p class="muted-text text-sm mb-10">Por: <strong style="color: white;">${pack.author}</strong></p>
                        
                        <div style="display: flex; gap: 8px; margin-bottom: 15px; flex-wrap: wrap;">
                            <span class="p-badge" style="background: rgba(16,185,129,0.1); color: var(--success);"><i class="ph-bold ph-game-controller"></i> ${pack.mc_version}</span>
                            <span class="p-badge" style="background: rgba(245,158,11,0.1); color: #f59e0b;"><i class="ph-bold ph-hammer"></i> ${pack.mod_loader}</span>
                            <span class="p-badge" style="background: rgba(255,255,255,0.1); color: white;"><i class="ph-bold ph-puzzle-piece"></i> ${modsCount} Mods</span>
                        </div>
                        
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: auto;">
                            <span style="font-size: 0.9rem; color: #fbbf24;"><i class="ph-fill ph-star"></i> ${pack.likes} | <i class="ph-bold ph-download-simple" style="color:var(--accent);"></i> ${pack.downloads}</span>
                            <button class="btn btn-primary btn-open-comm-pack" data-pack='${JSON.stringify(pack)}' style="padding: 6px 15px; font-size: 0.85rem;">Detalles</button>
                        </div>
                    </div>
                `;
            });

            // Listeners para abrir el modal
            document.querySelectorAll('.btn-open-comm-pack').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const pack = JSON.parse(e.target.dataset.pack);
                    currentCommunityPack = pack;
                    
                    document.getElementById('comm-modal-title').textContent = pack.name;
                    document.getElementById('comm-modal-stats').innerHTML = `${pack.mc_version} | ${pack.mod_loader} | ${pack.mods_data.length} Mods`;
                    
                    commModal.classList.remove('hidden');
                    loadCommentsForPack(pack.id);
                });
            });

        } catch (error) {
            console.error("Error cargando comunidad:", error);
            communityGrid.innerHTML = '<div style="grid-column: 1/-1; color: var(--danger); text-align:center;">Error al conectar con la comunidad.</div>';
        }
    };

    // Botón de instalación
    document.getElementById('btn-comm-download')?.addEventListener('click', async () => {
        if(!currentCommunityPack) return;
        if(confirm(`¿Quieres cargar "${currentCommunityPack.name}" en tu carrito? (Esto reemplazará tus mods actuales)`)){
            window.modpackCart = currentCommunityPack.mods_data;
            document.getElementById('mod-version-select').value = currentCommunityPack.mc_version;
            document.getElementById('mod-loader-select').value = currentCommunityPack.mod_loader;
            window.updateCartUI();
            
            // Actualizar contador de descargas en Supabase
            await window.supabaseClient.rpc('increment_downloads', { row_id: currentCommunityPack.id });
            
            commModal.classList.add('hidden');
            document.querySelector('.nav-btn[data-target="mods"]').click();
            alert("¡Modpack cargado en el Ensamblador!");
        }
    });

    // Función para obtener comentarios de Supabase
    async function loadCommentsForPack(packId) {
        const commList = document.getElementById('comm-list');
        commList.innerHTML = '<div style="text-align:center;"><i class="ph ph-spinner ph-spin"></i> Cargando reseñas...</div>';
        
        const { data: comments, error } = await window.supabaseClient
            .from('comments')
            .select('*')
            .eq('modpack_id', packId)
            .order('created_at', { ascending: false });

        if (error || !comments || comments.length === 0) {
            commList.innerHTML = '<p class="muted-text text-sm" style="text-align:center;">No hay reseñas aún. Sé el primero.</p>';
            return;
        }

        commList.innerHTML = '';
        comments.forEach(c => {
            const stars = '⭐'.repeat(c.rating);
            commList.innerHTML += `
                <div style="background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; border-left: 3px solid var(--accent);">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <strong style="color:var(--accent); font-size:0.9rem;">${c.author}</strong>
                        <span style="color:#fbbf24; font-size:0.8rem;">${stars}</span>
                    </div>
                    <p style="margin:0; font-size:0.85rem; color:var(--text-muted);">${c.text}</p>
                </div>
            `;
        });
    }

    // Enviar comentario a Supabase
    document.getElementById('btn-comm-submit')?.addEventListener('click', async () => {
        const text = document.getElementById('comm-text').value;
        const rating = document.getElementById('comm-rating').value;
        const btnSubmit = document.getElementById('btn-comm-submit');
        
        if(text.trim() === '') return alert("Escribe un comentario.");
        
        btnSubmit.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Enviando...';
        btnSubmit.disabled = true;

        const authorName = localStorage.getItem('minepack_username') || document.getElementById('header-username').textContent || 'Anónimo';

        const { error } = await window.supabaseClient
            .from('comments')
            .insert([{ modpack_id: currentCommunityPack.id, text, rating: parseInt(rating), author: authorName }]);

        btnSubmit.innerHTML = '<i class="ph-bold ph-paper-plane-tilt"></i> Enviar Reseña';
        btnSubmit.disabled = false;

        if (error) {
            alert("Error al enviar reseña.");
        } else {
            document.getElementById('comm-text').value = '';
            loadCommentsForPack(currentCommunityPack.id); // Recargar la lista
        }
    });

    document.querySelector('.nav-btn[data-target="community"]')?.addEventListener('click', () => window.loadCommunityGallery());
    document.getElementById('btn-close-community-modal')?.addEventListener('click', () => commModal.classList.add('hidden'));


    // ============================================================
    // 20. HERRAMIENTAS PRO (CRASH LOGS Y WHITELIST)
    // ============================================================
    const viewTools = document.getElementById('view-tools');
    if (viewTools) views['tools'] = viewTools;

    // --- ANALIZADOR INTELIGENTE DE CRASH LOGS ---
    const crashDropzone = document.getElementById('crash-dropzone');
    const crashInput = document.getElementById('crash-input');
    const crashResult = document.getElementById('crash-result');

    if (crashDropzone && crashInput) {
        crashDropzone.addEventListener('click', () => crashInput.click());
        
        crashDropzone.addEventListener('dragover', (e) => { e.preventDefault(); crashDropzone.style.borderColor = 'var(--accent)'; });
        crashDropzone.addEventListener('dragleave', () => crashDropzone.style.borderColor = 'rgba(255,255,255,0.2)');
        crashDropzone.addEventListener('drop', (e) => { 
            e.preventDefault(); 
            crashDropzone.style.borderColor = 'rgba(255,255,255,0.2)'; 
            handleCrashFile(e.dataTransfer.files[0]); 
        });
        
        crashInput.addEventListener('change', (e) => handleCrashFile(e.target.files[0]));
    }

    function handleCrashFile(file) {
        if (!file || !file.name.endsWith('.txt')) return alert("Por favor sube un archivo de texto (.txt)");
        const reader = new FileReader();
        reader.onload = (e) => analyzeCrashLog(e.target.result);
        reader.readAsText(file);
    }

    function analyzeCrashLog(text) {
        crashResult.style.display = 'block';
        crashResult.style.background = 'var(--bg-main)';
        crashResult.style.border = 'none';
        crashResult.innerHTML = '<div style="text-align:center;"><i class="ph ph-spinner ph-spin"></i> Escaneando trazas de código...</div>';
        
        setTimeout(() => {
            let culprit = "Origen Desconocido";
            let reason = "Posible conflicto general, corrupción del mundo o falta de memoria profunda.";
            let color = "#f87171"; // Rojo por defecto
            
            // Heurísticas de análisis
            if (text.includes("java.lang.OutOfMemoryError")) {
                culprit = "Falta de RAM Asignada"; 
                reason = "Tu servidor o juego se quedó sin memoria física. Asigna más GB de RAM."; 
                color = "#fbbf24";
            } else if (text.match(/Suspected Mods:\s*(.+)/)) {
                // Fabric y Forge modernos suelen decir qué mod es el sospechoso
                culprit = text.match(/Suspected Mods:\s*(.+)/)[1].trim();
                reason = "El modloader detectó directamente que este mod o sus dependencias causaron el crasheo crítico.";
            } else if (text.includes("Multiple entries with same key")) {
                culprit = "Conflicto de Registros (IDs)"; 
                reason = "Dos mods están intentando registrar el mismo ítem, bioma o bloque. Quita los mods más recientes.";
            } else if (text.includes("java.lang.NoSuchMethodError")) {
                culprit = "Versión Incorrecta"; 
                reason = "Un mod está intentando ejecutar código que no existe. Esto ocurre por usar mods de otra versión (ej. un mod 1.19 en 1.20) o falta de una librería.";
            } else {
                // Buscar paquetes de java sospechosos que no sean de minecraft vanilla
                const traceMatch = text.match(/at ([a-zA-Z0-9_]+\.[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+)/);
                if (traceMatch && !traceMatch[1].startsWith("net.minecraft") && !traceMatch[1].startsWith("java.")) {
                    culprit = traceMatch[1] + " (Paquete de Código)";
                    reason = "El error reventó en esta línea de código. Revisa en tu lista de mods a quién le pertenece este paquete.";
                }
            }

            crashResult.style.background = 'rgba(239, 68, 68, 0.1)';
            crashResult.style.border = `1px solid ${color}`;
            crashResult.innerHTML = `
                <h4 style="color: ${color}; margin: 0 0 5px 0;"><i class="ph-fill ph-warning"></i> Causa probable: ${culprit}</h4>
                <p style="font-size: 0.85rem; margin: 0; color: #fff;">${reason}</p>
            `;
        }, 1200);
    }

    // --- GESTOR VISUAL DE WHITELIST ---
    let whitelistArray = [];
    const btnWlAdd = document.getElementById('btn-wl-add');
    const wlInput = document.getElementById('wl-input');
    const wlList = document.getElementById('wl-list');

    btnWlAdd?.addEventListener('click', async () => {
        const username = wlInput.value.trim();
        if(!username) return;
        
        btnWlAdd.innerHTML = '<i class="ph ph-spinner ph-spin"></i>'; 
        btnWlAdd.disabled = true;
        
        try {
            // Buscamos al usuario en la API oficial de Mojang
            const res = await fetch(`https://api.ashcon.app/mojang/v2/user/${username}`);
            if(!res.ok) throw new Error();
            const data = await res.json();
            
            // Verificar si ya lo metimos a la lista
            if(!whitelistArray.some(u => u.uuid === data.uuid)) {
                whitelistArray.push({ uuid: data.uuid, name: data.username });
                updateWhitelistUI();
            }
            wlInput.value = '';
        } catch(e) {
            alert("No se encontró al jugador. ¿Es premium?");
        } finally {
            btnWlAdd.innerHTML = '<i class="ph-bold ph-plus"></i>'; 
            btnWlAdd.disabled = false;
        }
    });

    wlInput?.addEventListener('keypress', (e) => { if(e.key === 'Enter') btnWlAdd.click(); });

    function updateWhitelistUI() {
        if(!wlList) return;
        wlList.innerHTML = '';
        if(whitelistArray.length === 0) {
            wlList.innerHTML = '<p class="muted-text text-sm" style="text-align:center;">Lista vacía.</p>';
            return;
        }

        whitelistArray.forEach((user, index) => {
            wlList.innerHTML += `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.3); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                    <div style="display: flex; align-items: center; gap: 10px;">
<img src="https://mc-heads.net/avatar/${user.uuid}/30" style="width: 30px; height: 30px; border-radius: 6px; background: #27272a;">
<span style="font-weight: 600; font-size: 0.95rem;">${user.name}</span>
                    </div>
                    <button class="btn-remove-wl" data-index="${index}" style="background: none; border: none; color: var(--danger); cursor: pointer; padding: 5px;"><i class="ph-bold ph-trash"></i></button>
                </div>
            `;
        });

        document.querySelectorAll('.btn-remove-wl').forEach(btn => {
            btn.addEventListener('click', (e) => {
                whitelistArray.splice(e.currentTarget.dataset.index, 1);
                updateWhitelistUI();
            });
        });
    }

    // Exportador mágico a JSON
    document.getElementById('btn-wl-export')?.addEventListener('click', () => {
        if(whitelistArray.length === 0) return alert("La whitelist está vacía. Añade a alguien primero.");
        
        // El servidor de Minecraft necesita que el UUID tenga guiones medios
        const formatted = whitelistArray.map(u => ({ 
            uuid: u.uuid.replace(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/, "$1-$2-$3-$4-$5"), 
            name: u.name 
        }));
        
        const blob = new Blob([JSON.stringify(formatted, null, 2)], { type: "application/json" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a'); 
        a.href = url; 
        a.download = 'whitelist.json';
        a.click(); 
        window.URL.revokeObjectURL(url);
    });

    // ==========================================
    // 18. SCROLL INFINITO Y AUTO-INICIO
    // ==========================================
    const scrollContainer = document.getElementById('dynamic-center-area');
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
    
    if (btnLoadMore) btnLoadMore.addEventListener('click', () => { if(!isFetchingMods) { currentOffset += 50; fetchRealMods(true); } });

    fetchRealMods(); 

});
