document.addEventListener('DOMContentLoaded', () => {
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
        navButtons.forEach(b => b.classList.remove('active')); btn.classList.add('active');
        Object.values(views).forEach(v => v.classList.add('hidden')); 
        views[btn.getAttribute('data-target')].classList.remove('hidden');
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

    // CHIPS LOGIC
    chips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            chips.forEach(c => c.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentCategory = e.currentTarget.dataset.cat;
            updateSearch();
        });
    });

    const lightbox = document.getElementById('image-lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    if(lightbox) lightbox.addEventListener('click', () => lightbox.classList.add('hidden'));

    // DICCIONARIO PARA ICONOS DE ETIQUETAS (TAGS)
    const tagIcons = {
        'technology': '<i class="ph-fill ph-cpu"></i>', 'magic': '<i class="ph-fill ph-sparkle"></i>',
        'adventure': '<i class="ph-fill ph-sword"></i>', 'mobs': '<i class="ph-fill ph-skull"></i>',
        'worldgen': '<i class="ph-fill ph-tree"></i>', 'equipment': '<i class="ph-fill ph-shield"></i>',
        'optimization': '<i class="ph-fill ph-rocket"></i>', 'library': '<i class="ph-fill ph-books"></i>'
    };

    async function fetchRealMods(isAppend = false) {
        if (!isAppend) {
            currentOffset = 0;
            modsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding: 60px;"><i class="ph ph-spinner ph-spin" style="font-size: 40px;"></i><p>Buscando...</p></div>`;
            if(btnLoadMore) btnLoadMore.classList.add('hidden');
        } else {
            if(btnLoadMore) btnLoadMore.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Cargando...';
        }

        try {
            let queryType = currentFilter === 'library' ? 'mod' : currentFilter;
            let facets = [[`versions:${versionSelect.value}`], [`project_type:${queryType}`]];
            
            if (queryType === 'mod') {
                facets.push([`categories:${loaderSelect.value}`]);
            }

            if (currentFilter === 'mod') {
                facets.push(["categories!=library"]); 
                if (currentCategory !== "") facets.push([`categories:${currentCategory}`]);
            } else if (currentFilter === 'library') {
                facets.push(["categories:library"]);
            }

            const facetsStr = encodeURIComponent(JSON.stringify(facets));
            const query = searchInput.value;
            const res = await fetch(`https://api.modrinth.com/v2/search?query=${query}&facets=${facetsStr}&index=${sortSelect.value}&limit=16&offset=${currentOffset}`);
            const data = await res.json();
            
            if (!isAppend) modsGrid.innerHTML = '';
            
            if (data.hits.length === 0 && !isAppend) {
                modsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:40px;">No se encontraron resultados para estos filtros.</div>';
            } else {
                renderRealMods(data.hits);
                if(data.hits.length === 16) {
                    if(btnLoadMore) {
                        btnLoadMore.classList.remove('hidden');
                        btnLoadMore.innerHTML = '<i class="ph-bold ph-caret-down"></i> Cargar Más';
                    }
                } else { if(btnLoadMore) btnLoadMore.classList.add('hidden'); }
            }
        } catch (error) { if(!isAppend) modsGrid.innerHTML = '<div style="grid-column: 1/-1; color: var(--danger); text-align:center;">Error de API.</div>'; }
    }

    const chipsContainer = document.getElementById('category-chips-container');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterButtons.forEach(b => b.classList.remove('active')); 
            e.currentTarget.classList.add('active');
            currentFilter = e.currentTarget.dataset.filter; 
            
            if(currentFilter === 'mod') {
                if(chipsContainer) chipsContainer.style.display = 'flex';
            } else {
                if(chipsContainer) chipsContainer.style.display = 'none';
                currentCategory = ""; 
                chips.forEach(c => c.classList.remove('active'));
                if(chips.length) chips[0].classList.add('active');
            }
            fetchRealMods(false);
        });
    });

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
            const card = document.createElement('div');
            card.className = 'mod-card';
            const iconUrl = mod.icon_url || 'https://via.placeholder.com/80/18181b/ffffff?text=?';
            const bannerUrl = (mod.gallery && mod.gallery[0]) ? mod.gallery[0] : 'https://via.placeholder.com/400x150/18181b/27272a';
            const isAdded = modpackCart.some(item => item.id === mod.project_id);
            
            let tagsHtml = '';
            if(mod.display_categories) {
                const topTags = mod.display_categories.slice(0, 3);
                topTags.forEach(tag => {
                    const icon = tagIcons[tag] || '<i class="ph-bold ph-tag"></i>';
                    tagsHtml += `<span class="mini-tag">${icon} ${tag}</span>`;
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
                <div style="padding: 0 20px 20px 20px; z-index: 10;">
                    <button class="btn btn-primary w-100 btn-add-mod" data-id="${mod.project_id}" data-title="${mod.title}" data-type="${mod.project_type}" ${isAdded ? 'disabled' : ''} style="${isAdded ? 'background: var(--success); color: white;' : ''}">
                        <i class="ph-bold ${isAdded ? 'ph-check' : 'ph-plus'}"></i> ${isAdded ? 'Añadido' : 'Añadir'}
                    </button>
                </div>
            `;

            const addBtn = card.querySelector('.btn-add-mod');
            addBtn.addEventListener('click', async function(e) {
                e.stopPropagation(); 
                
                const originalHtml = this.innerHTML;
                this.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Escaneando...';
                this.disabled = true;

                if (this.dataset.type === 'mod') {
                    const deps = await getRequiredDependencies(this.dataset.id, versionSelect.value, loaderSelect.value);
                    if (deps && deps.length > 0) {
                        const missingDeps = deps.filter(dep => !modpackCart.some(item => item.id === dep.id));
                        if (missingDeps.length > 0) {
                            showEpicDepsModal({ id: this.dataset.id, title: this.dataset.title, type: this.dataset.type }, missingDeps, this);
                            this.innerHTML = originalHtml; 
                            this.disabled = false;
                            return; 
                        }
                    }
                }

                modpackCart.push({ id: this.dataset.id, title: this.dataset.title, type: this.dataset.type });
                updateCartUI();
                this.innerHTML = '<i class="ph-bold ph-check"></i> Añadido';
                this.style.background = 'var(--success)';
                this.style.color = 'white';
            });

            card.addEventListener('click', (e) => {
                if(e.target.closest('.btn-add-mod')) return; 
                
                const modal = document.getElementById('mod-details-modal');
                modal.classList.remove('hidden');
                
                document.getElementById('detail-title').textContent = mod.title;
                document.getElementById('detail-downloads-badge').innerHTML = `<i class="ph-bold ph-download-simple"></i> ${new Intl.NumberFormat('es-MX').format(mod.downloads || 0)}`;
                document.getElementById('detail-author').innerHTML = `por ${mod.author}`;
                document.getElementById('detail-icon').src = iconUrl;
                document.getElementById('detail-description').innerHTML = `<div style="text-align:center; padding: 40px;"><i class="ph ph-spinner ph-spin" style="font-size: 30px;"></i><p>Cargando información...</p></div>`;
                document.getElementById('detail-gallery').innerHTML = '';
                const depsContainer = document.getElementById('detail-dependencies');
                depsContainer.innerHTML = '';

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

                if (mod.project_type === 'mod') {
                    getRequiredDependencies(mod.project_id, versionSelect.value, loaderSelect.value).then(depProjs => {
                        if (depProjs.length > 0) {
                            let depsHtml = '<h3 class="subtitle mb-10 w-100 text-center" style="width:100%;"><i class="ph-bold ph-books"></i> Librerías Necesarias</h3>';
                            depProjs.forEach((p, index) => {
                                let animClass = index % 2 === 0 ? 'anim-right' : 'anim-left';
                                depsHtml += `
                                <div class="tilt-wrapper">
                                    <div class="tilt-card ${animClass}">
                                        <img src="${p.icon_url || 'https://via.placeholder.com/40'}" alt="icon">
                                        <div class="dep-info">
                                            <h4>${p.title}</h4>
                                            <span>Obligatorio</span>
                                        </div>
                                    </div>
                                </div>`;
                            });
                            
                            depsHtml += `
                            <div style="width: 100%; text-align: center; margin-top: 20px;">
                                <button class="btn btn-primary" id="btn-detail-add-all" style="background: var(--accent); padding: 12px 24px; font-size: 1rem;">
                                    <i class="ph-bold ph-stack"></i> Añadir Mod y sus Librerías
                                </button>
                            </div>`;
                            
                            depsContainer.innerHTML = depsHtml;

                            document.querySelectorAll('.tilt-card').forEach(tiltCard => {
                                tiltCard.addEventListener('mousemove', e => {
                                    const rect = tiltCard.getBoundingClientRect();
                                    const x = e.clientX - rect.left; const y = e.clientY - rect.top;
                                    const rotateX = ((y - rect.height / 2) / (rect.height / 2)) * -15; 
                                    const rotateY = ((x - rect.width / 2) / (rect.width / 2)) * 15;
                                    tiltCard.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
                                });
                                tiltCard.addEventListener('mouseleave', () => { tiltCard.style.transform = `rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`; });
                            });

                            document.getElementById('btn-detail-add-all').onclick = () => {
                                processAddAll(mod, depProjs);
                                document.getElementById('mod-details-modal').classList.add('hidden');
                                addBtn.innerHTML = '<i class="ph-bold ph-check"></i> Añadido';
                                addBtn.style.background = 'var(--success)';
                                addBtn.style.color = 'white';
                                addBtn.disabled = true;
                            };
                        }
                    });
                }
            });

            modsGrid.appendChild(card);
        });
    }

    function showEpicDepsModal(mainMod, missingDeps, triggerButton) {
        const modal = document.getElementById('epic-deps-modal');
        document.getElementById('epic-mod-name').textContent = mainMod.title;
        
        const list = document.getElementById('epic-deps-list');
        list.innerHTML = '';
        missingDeps.forEach((p, index) => {
            let animClass = index % 2 === 0 ? 'anim-right' : 'anim-left';
            list.innerHTML += `
            <div class="tilt-wrapper" style="margin-bottom: 10px;">
                <div class="tilt-card ${animClass}" style="background: var(--bg-main);">
                    <img src="${p.icon_url || 'https://via.placeholder.com/40'}" alt="icon">
                    <div class="dep-info" style="text-align: left;">
                        <h4>${p.title}</h4>
                        <span>Componente central</span>
                    </div>
                </div>
            </div>`;
        });

        document.getElementById('btn-epic-add-all').onclick = () => {
            processAddAll(mainMod, missingDeps);
            if(triggerButton) {
                triggerButton.innerHTML = '<i class="ph-bold ph-check"></i> Añadido';
                triggerButton.style.background = 'var(--success)';
                triggerButton.style.color = 'white';
                triggerButton.disabled = true;
            }
            modal.classList.add('hidden');
        };

        modal.classList.remove('hidden');
    }

    function processAddAll(mainMod, depsArray) {
        if (!modpackCart.some(item => item.id === mainMod.id)) {
            modpackCart.push({ id: mainMod.id, title: mainMod.title, type: mainMod.type || 'mod' });
        }
        depsArray.forEach(dep => {
            if (!modpackCart.some(item => item.id === dep.id)) {
                modpackCart.push({ id: dep.id, title: dep.title, type: 'mod' });
            }
        });
        updateCartUI();
        if(window.showNotification) window.showNotification(`Se añadió ${mainMod.title} y sus ${depsArray.length} librerías con éxito.`, "success");
    }

    // ==========================================
    // NUEVA FUNCIÓN MEJORADA: UPDATE CART UI
    // ==========================================
    function updateCartUI() {
        cartList.innerHTML = '';
        if (modpackCart.length === 0) {
            document.getElementById('empty-cart-msg').style.display = 'block';
            if(btnOpenSaveModal) btnOpenSaveModal.disabled = true; return;
        }
        document.getElementById('empty-cart-msg').style.display = 'none';
        if(btnOpenSaveModal) btnOpenSaveModal.disabled = false;

        modpackCart.forEach((item, index) => {
            const li = document.createElement('li'); 
            li.className = `cart-item`; 
            
            // Lógica visual dependiendo del tipo
            let iconClass = 'ph-puzzle-piece';
            let typeColor = 'var(--accent)';
            let typeText = 'Mod';
            
            if(item.type === 'resourcepack') { iconClass = 'ph-paint-brush'; typeColor = '#10b981'; typeText = 'Textura'; }
            else if(item.type === 'shader') { iconClass = 'ph-aperture'; typeColor = '#f59e0b'; typeText = 'Shader'; }
            else if(item.type === 'datapack') { iconClass = 'ph-file-code'; typeColor = '#8b5cf6'; typeText = 'DataPack'; }

            li.innerHTML = `
                <div class="cart-item-info">
                    <div class="cart-item-icon" style="display:flex; justify-content:center; align-items:center; color: ${typeColor}; background: ${typeColor}20;">
                        <i class="ph-fill ${iconClass}" style="font-size: 1.2rem;"></i>
                    </div>
                    <div class="cart-item-text">
                        <span class="cart-item-title" title="${item.title}">${item.title}</span>
                        <span class="cart-item-type" style="color: ${typeColor};">${typeText}</span>
                    </div>
                </div>
                <button class="btn-remove" data-index="${index}" title="Quitar"><i class="ph-bold ph-trash"></i></button>
            `;
            cartList.appendChild(li);
        });

        document.querySelectorAll('.btn-remove').forEach(btn => {
            btn.addEventListener('click', function() {
                modpackCart.splice(this.dataset.index, 1);
                updateCartUI(); 
                fetchRealMods(false);
            });
        });
        // Actualizar el número en el botón flotante del celular
        const mobileCartBtn = document.getElementById('mobile-cart-toggle-btn');
        if(mobileCartBtn && !document.querySelector('.cart-panel').classList.contains('active-mobile')) {
            mobileCartBtn.innerHTML = `<i class="ph-bold ph-package"></i> <span class="badge">${modpackCart.length}</span>`;
        }
    }

    // ==========================================
    // LÓGICA DE CONSTRUCCIÓN Y DESCARGA AL BACKEND
    // ==========================================
    const modalSave = document.getElementById('save-pack-modal');
    const btnJustDownload = document.getElementById('btn-just-download');
    const btnSaveAndDownload = document.getElementById('btn-confirm-save-download');
    const packNameInput = document.getElementById('pack-name-input');
    
    // 1. Abrir Modal de Guardado
    if(btnOpenSaveModal) {
        btnOpenSaveModal.addEventListener('click', () => modalSave.classList.remove('hidden'));
    }

    // 2. Función central para armar y descargar
    async function requestBuild(isSaving = false) {
        try {
            const packName = (packNameInput && packNameInput.value.trim() !== '') ? packNameInput.value.trim() : 'Mi_Modpack';
            const btn = isSaving ? btnSaveAndDownload : btnJustDownload;
            
            if(btn) {
                btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Procesando...';
                btn.disabled = true;
            }

            const payload = {
                name: packName,
                mcVersion: versionSelect.value,
                modLoader: loaderSelect.value,
                mods: modpackCart,
                worldSettings: {
                    seed: document.getElementById('world-seed-input') ? document.getElementById('world-seed-input').value : '',
                    gamemode: document.getElementById('world-gamemode') ? document.getElementById('world-gamemode').value : 'survival'
                }
            };

            // Aseguramos que apunte a la ruta correcta para evitar errores
            const API_BASE = 'http://localhost:3000';

            if (isSaving) {
                const saveRes = await fetch(`${API_BASE}/api/modpacks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                if (!saveRes.ok) throw new Error("No se pudo guardar en la base de datos.");
            }

            const buildRes = await fetch(`${API_BASE}/api/export`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!buildRes.ok) throw new Error("Error en el servidor al compilar el modpack.");

            // Descargar el archivo procesado por el backend
            const blob = await buildRes.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `${packName.replace(/\s+/g, '_')}_${versionSelect.value}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            
            modalSave.classList.add('hidden');
            
        } catch (error) {
            alert("Error: " + error.message);
        } finally {
            if(btnJustDownload) { btnJustDownload.innerHTML = 'Solo Descargar'; btnJustDownload.disabled = false; }
            if(btnSaveAndDownload) { btnSaveAndDownload.innerHTML = 'Guardar y Exportar'; btnSaveAndDownload.disabled = false; }
        }
    }

    if(btnJustDownload) btnJustDownload.addEventListener('click', () => requestBuild(false));
    if(btnSaveAndDownload) btnSaveAndDownload.addEventListener('click', () => requestBuild(true));


    // ==========================================
    // LISTENERS DE BÚSQUEDA Y ARRANQUE
    // ==========================================
    sortSelect.addEventListener('change', updateSearch);
    versionSelect.addEventListener('change', updateSearch);
    loaderSelect.addEventListener('change', updateSearch);
    let timeout = null;
    searchInput.addEventListener('input', () => { clearTimeout(timeout); timeout = setTimeout(updateSearch, 600); });
    
    if(btnLoadMore) btnLoadMore.addEventListener('click', () => { currentOffset += 16; fetchRealMods(true); });

    // LA LLAMADA QUE HACE QUE CARGUE AL ENTRAR
    updateSearch();

    // ==========================================
    // 3. INICIALIZAR FUNCIONES EXTERNAS (MUNDOS Y SOFTWARE)
    // ==========================================
    if (typeof initSoftwareModal === 'function') initSoftwareModal();
    if (typeof initWorldUpload === 'function') initWorldUpload();
});

// ==========================================
// FUNCIONES GLOBALES (MUNDOS Y SOFTWARE)
// ==========================================

function initSoftwareModal() {
    const softwareModal = document.getElementById('software-modal');
    const softwareBtns = document.querySelectorAll('.software-select-btn');
    const closeBtn = document.querySelector('.close-software-modal-btn'); 

    if (softwareBtns) {
        softwareBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const softwareType = e.target.dataset.software; 
                openSoftwareModal(softwareType);
            });
        });
    }

    if (closeBtn && softwareModal) {
        closeBtn.addEventListener('click', () => {
            softwareModal.classList.add('hidden');
        });
    }
}

function openSoftwareModal(type) {
    const softwareModal = document.getElementById('software-modal');
    const versionList = document.getElementById('version-list');
    if (!softwareModal || !versionList) return;

    versionList.innerHTML = `<div style="text-align:center; padding: 20px;"><i class="ph ph-spinner ph-spin" style="font-size: 30px;"></i><p>Cargando versiones para ${type}...</p></div>`;
    softwareModal.classList.remove('hidden');

    setTimeout(() => {
        const versions = ['1.20.4', '1.20.1', '1.19.4', '1.19.2', '1.18.2'];
        versionList.innerHTML = versions.map(v => `
            <div class="version-item" style="display:flex; justify-content:space-between; padding: 10px; border-bottom: 1px solid var(--border);">
                <span>${v}</span>
                <button class="btn btn-primary" onclick="window.installSoftware('${type}', '${v}')">Instalar</button>
            </div>
        `).join('');
    }, 500);
}

window.installSoftware = function(type, version) {
    alert(`Iniciando instalación de ${type} versión ${version}...`);
    document.getElementById('software-modal').classList.add('hidden');
};

function initWorldUpload() {
    const dropZone = document.getElementById('world-drop-zone');
    const fileInput = document.getElementById('world-file-input');

    if (!dropZone || !fileInput) return;

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--accent)';
        dropZone.style.background = 'rgba(59, 130, 246, 0.1)';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = 'var(--border)';
        dropZone.style.background = 'transparent';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border)';
        dropZone.style.background = 'transparent';
        
        if (e.dataTransfer.files.length) {
            handleWorldUpload(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleWorldUpload(e.target.files[0]);
        }
    });
}

function handleWorldUpload(file) {
    if (!file.name.toLowerCase().endsWith('.zip')) {
        alert("Por favor, sube solo archivos .ZIP. Es el único formato admitido para los mundos.");
        return;
    }
    
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    alert(`Preparando la subida del mundo: ${file.name} (${fileSizeMB} MB)`);
    // Aquí irá tu lógica de Fetch/XHR para enviar el formData a tu servidor
}
