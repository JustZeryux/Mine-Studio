// ==========================================
// 4. MOD TREE / MAPA VISUAL (mod-tree.js)
// ==========================================
window.ModTree = {
    init: function() {
        console.log("🕸️ Mod Tree iniciado");
        this.injectUI();
    },

    injectUI: function() {
        const btn = `<button id="btn-open-tree" class="btn btn-secondary" style="width: 100%; margin-top: 10px; border-color: rgba(99, 102, 241, 0.5); color: #818cf8;"><i class="ph-fill ph-graph"></i> Ver Arquitectura del Pack</button>`;
        
        // Inyectar debajo del botón de Descargar ZIP en el carrito
        const checkoutArea = document.querySelector('.cart-footer') || document.body;
        checkoutArea.insertAdjacentHTML('beforeend', btn);

        const modal = `
            <div id="tree-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.95); z-index:10000; justify-content:center; align-items:center; flex-direction:column;">
                <h2 style="color:white; position:absolute; top:20px;"><i class="ph-fill ph-graph" style="color:#6366f1;"></i> Arquitectura de tu Modpack</h2>
                <button onclick="document.getElementById('tree-modal').style.display='none'" style="position:absolute; top:20px; right:30px; background:none; border:none; color:white; font-size:2rem; cursor:pointer;"><i class="ph-bold ph-x"></i></button>
                
                <div id="tree-network" style="width: 90%; height: 80%; background: #18181b; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);"></div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modal);

        document.getElementById('btn-open-tree').onclick = () => this.renderGraph();
    },

    renderGraph: function() {
        if(typeof vis === 'undefined') {
            alert("Vis.js no está cargado. Asegúrate de poner el script en el HTML.");
            return;
        }

        document.getElementById('tree-modal').style.display = 'flex';
        const container = document.getElementById('tree-network');

        // Construir nodos a partir del carrito
        const nodes = new vis.DataSet([]);
        const edges = new vis.DataSet([]);

        // Nodo central (Tu Modpack)
        nodes.add({ id: 0, label: 'Tu Modpack', shape: 'star', color: '#6366f1', size: 30, font: {color:'white'} });

        window.modpackCart.forEach((mod, index) => {
            const nodeId = index + 1;
            let color = '#10b981'; // Verde para mods normales
            if(mod.type === 'library') color = '#f59e0b'; // Naranja para librerías

            nodes.add({
                id: nodeId,
                label: mod.title,
                shape: 'dot',
                color: color,
                font: { color: 'white' }
            });

            // Conectar al modpack central
            edges.add({ from: 0, to: nodeId, color: { color: 'rgba(255,255,255,0.2)' }});
            
            // BONUS: Si tienes el sistema de dependencias, aquí podrías conectar las librerías a sus mods padres.
        });

        const data = { nodes: nodes, edges: edges };
        const options = {
            physics: { stabilization: true, barnesHut: { springLength: 150 } },
            interaction: { hover: true }
        };

        new vis.Network(container, data, options);
    }
};

window.addEventListener('load', () => setTimeout(() => window.ModTree.init(), 1000));
