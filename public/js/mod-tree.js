// ==========================================
// 4. MOD TREE / MAPA VISUAL ESTRUCTURADO (mod-tree.js)
// ==========================================
window.ModTree = {
    init: function() {
        console.log("🕸️ Mod Tree iniciado");
        this.injectUI();
    },

    injectUI: function() {
        // Evitamos inyectar el botón dos veces si se vuelve a llamar a init()
        if (document.getElementById('btn-open-tree')) return;

        const btn = `<button id="btn-open-tree" class="btn btn-secondary hover-scale" style="width: 100%; margin-top: 10px; border-color: rgba(99, 102, 241, 0.5); color: #818cf8; font-weight: bold;"><i class="ph-fill ph-graph"></i> Ver Arquitectura del Pack</button>`;
        
        // Inyectar debajo del botón de Descargar ZIP en el carrito
        const checkoutArea = document.querySelector('.cart-footer') || document.body;
        checkoutArea.insertAdjacentHTML('beforeend', btn);

        const modal = `
            <div id="tree-modal" class="hidden" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:10000; display: flex; justify-content:center; align-items:center; flex-direction:column; backdrop-filter: blur(5px);">
                <div style="width: 90%; max-width: 1200px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                    <h2 style="color:white; margin: 0; display: flex; align-items: center; gap: 10px;"><i class="ph-fill ph-graph" style="color:#6366f1;"></i> Arquitectura Jerárquica</h2>
                    <button onclick="document.getElementById('tree-modal').classList.add('hidden')" style="background:rgba(255,255,255,0.1); border:none; color:white; width: 40px; height: 40px; border-radius: 10px; font-size:1.5rem; cursor:pointer; display: flex; justify-content: center; align-items: center;"><i class="ph-bold ph-x"></i></button>
                </div>
                
                <div id="tree-network" style="width: 90%; max-width: 1200px; height: 80%; background: #0c0c0e; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 40px rgba(0,0,0,0.5);"></div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modal);

        // Agregamos la clase 'hidden' por defecto para que no se muestre al cargar
        document.getElementById('tree-modal').classList.add('hidden');
        document.getElementById('btn-open-tree').onclick = () => this.renderGraph();
    },

    renderGraph: function() {
        if(typeof vis === 'undefined') {
            alert("⚠️ Vis.js no está cargado. Asegúrate de poner el script de vis-network en el HTML.");
            return;
        }

        const modal = document.getElementById('tree-modal');
        modal.classList.remove('hidden'); // Mostrar el modal
        const container = document.getElementById('tree-network');

        // Construir nodos a partir del carrito
        const nodes = new vis.DataSet([]);
        const edges = new vis.DataSet([]);

        // Nivel 0: Nodo central (Tu Modpack)
        nodes.add({ 
            id: 'root', 
            label: 'Mi Modpack', 
            shape: 'image', 
            image: 'https://placehold.co/100x100/6366f1/ffffff?text=Pack', // Icono genérico de pack
            size: 45, 
            font: {color:'white', size: 18, bold: true},
            level: 0 
        });

        // Configurar categorías para organizar el árbol (Nivel 1)
        const categories = {
            'mod': { id: 'cat-mod', label: '🧩 Mods Principales', color: '#10b981', added: false },
            'library': { id: 'cat-lib', label: '📚 Librerías Core', color: '#f59e0b', added: false },
            'resourcepack': { id: 'cat-rp', label: '🎨 Texturas', color: '#ec4899', added: false },
            'shader': { id: 'cat-shader', label: '✨ Shaders', color: '#3b82f6', added: false }
        };

        window.modpackCart.forEach((mod, index) => {
            // Determinar el tipo real (Si es mod pero dice library, lo mandamos a librerías)
            let type = mod.type || 'mod';
            if (mod.categories && mod.categories.includes('library')) type = 'library';
            if (!categories[type]) type = 'mod'; // Fallback

            // Si la categoría aún no existe en el grafo, la creamos
            if (!categories[type].added) {
                nodes.add({ 
                    id: categories[type].id, 
                    label: categories[type].label, 
                    shape: 'box', 
                    color: { background: categories[type].color, border: 'rgba(255,255,255,0.2)' }, 
                    font: { color: 'white', size: 16 }, 
                    level: 1 
                });
                // Conectar el Modpack a esta categoría
                edges.add({ from: 'root', to: categories[type].id, color: { color: 'rgba(255,255,255,0.3)' }, width: 2 });
                categories[type].added = true;
            }

            // Nivel 2: Los mods reales CON ICONOS
            const nodeId = 'mod-' + index;
            // Validar si tiene icono real, si no, poner uno falso oscuro
            const iconUrl = (mod.icon && mod.icon.startsWith('http')) ? mod.icon : 'https://placehold.co/80x80/27272a/ffffff?text=M';

            nodes.add({
                id: nodeId,
                label: mod.title,
                shape: 'circularImage', // ¡Aquí está la magia de los iconos!
                image: iconUrl,
                size: 25,
                level: 2,
                font: { color: '#a1a1aa', size: 12 },
                color: { border: categories[type].color, background: '#18181b' },
                borderWidth: 3,
                borderWidthSelected: 5
            });

            // Conectar el mod a su respectiva categoría
            edges.add({ from: categories[type].id, to: nodeId, color: { color: 'rgba(255,255,255,0.1)' } });
        });

        const data = { nodes: nodes, edges: edges };
        
        // OPCIONES AVANZADAS DE VIS.JS PARA JERARQUÍA
        const options = {
            layout: {
                hierarchical: {
                    direction: 'UD', // (Up-Down) De arriba hacia abajo
                    sortMethod: 'directed',
                    nodeSpacing: 120,    // Espacio horizontal entre mods
                    levelSeparation: 150 // Espacio vertical entre niveles
                }
            },
            physics: {
                hierarchicalRepulsion: {
                    nodeDistance: 120,
                    springLength: 100
                }
            },
            edges: {
                smooth: {
                    type: 'cubicBezier',
                    forceDirection: 'vertical',
                    roundness: 0.4
                }
            },
            interaction: { 
                hover: true,
                zoomView: true,
                dragView: true
            }
        };

        // Renderizar
        new vis.Network(container, data, options);
    }
};

window.addEventListener('load', () => setTimeout(() => window.ModTree.init(), 1000));
