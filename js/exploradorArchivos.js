document.addEventListener('DOMContentLoaded', function () {
	try {
		const details = document.querySelectorAll('main nav details');
		details.forEach(d => d.open = false);
	} catch (e) {
		console.error('Error cerrando detalles:', e);
	}
});


const carpetas = document.querySelectorAll('summary');
const todos = document.getElementById('li');
document.addEventListener('DOMContentLoaded', function () {

    const inputRuta = document.getElementById('path-input');
    const panelNombre = document.querySelector('.panel-derecho ul li:nth-child(1)');
    const panelTipo = document.querySelector('.panel-derecho ul li:nth-child(2)');
    const panelTamano = document.querySelector('.panel-derecho ul li:nth-child(3)');

    
    const todosLosClicables = document.querySelectorAll('[data-ruta]');

    todosLosClicables.forEach(elemento => {
        elemento.addEventListener('click', function (e) {
            
            e.stopPropagation();

            
            const ruta = this.getAttribute('data-ruta');
            const tipo = this.getAttribute('data-tipo');
            const tamano = this.getAttribute('data-tamano');
            
            const nombre = this.textContent.trim();
            inputRuta.value = ruta;
            panelNombre.innerHTML = `<strong>Nombre:</strong> ${nombre}`;
            panelTipo.innerHTML = `<strong>Tipo:</strong> ${tipo}`;
            panelTamano.innerHTML = `<strong>Tamaño:</strong> ${tamano}`;
            // intentar previsualizar (fetch)
            (async () => {
                try {
                    if (!ruta) return;
                    await previewContent(ruta);
                } catch (e) { /* ignore */ }
            })();
        });
        // doble click -> intentar abrir en el editor de la página
        elemento.addEventListener('dblclick', async function (e) {
            e.stopPropagation();
            const ruta = this.getAttribute('data-ruta');
            const tipo = this.getAttribute('data-tipo');
            if (!ruta || tipo && tipo.toLowerCase().includes('carpeta')) return;
            // intentamos fetch si es un recurso accesible
            try {
                const res = await fetch(ruta);
                if (res && res.ok) {
                    const contentType = res.headers.get('content-type') || '';
                    if (contentType.startsWith('text/') || contentType.includes('application/json') || contentType.includes('application/javascript')) {
                        const texto = await res.text();
                        const url = new URL('pages/editorArchivo.html', window.location.href);
                        const editorWin = window.open(url.toString(), '_blank');
                        const send = () => editorWin.postMessage({ action: 'loadContent', path: ruta, name: elemento.textContent.trim(), content: texto }, '*');
                        const timer = setInterval(() => {
                            try { send(); clearInterval(timer); } catch (err) { /* retry */ }
                        }, 200);
                        return;
                    }
                }
            } catch (err) {
                // ignore and fallback
            }
            // fallback: open editor with query param
            const url = new URL('pages/editorArchivo.html', window.location.href);
            url.searchParams.set('file', ruta);
            window.open(url.toString(), '_blank');
        });
    });
});

// --- NUEVO: selección de carpeta y renderizado dinámico usando File System Access API ---
const openProjectBtn = document.getElementById('open-project-button');
const navRoot = document.querySelector('main nav ul');

const supportsFS = () => 'showDirectoryPicker' in window;

// IndexedDB helpers to persist directory handle between sessions (Chrome/Edge support)
const openDB = () => new Promise((resolve, reject) => {
    const req = indexedDB.open('file-explorer', 1);
    req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('handles')) db.createObjectStore('handles');
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
});

const saveDirHandle = async (handle) => {
    try {
        const db = await openDB();
        const tx = db.transaction('handles', 'readwrite');
        tx.objectStore('handles').put(handle, 'project');
        return new Promise((res) => { tx.oncomplete = () => { db.close(); res(true); }; tx.onerror = () => { db.close(); res(false); }; });
    } catch (e) { return false; }
};

const loadDirHandle = async () => {
    try {
        const db = await openDB();
        const tx = db.transaction('handles', 'readonly');
        const req = tx.objectStore('handles').get('project');
        return new Promise((res) => { req.onsuccess = () => { db.close(); res(req.result || null); }; req.onerror = () => { db.close(); res(null); }; });
    } catch (e) { return null; }
};

// Utility to render preview in right panel
const previewContent = async (fileOrUrl) => {
    const preview = document.getElementById('preview-content');
    // guarda la fuente para ver completo
    window._lastPreviewSource = fileOrUrl;
    preview.innerHTML = 'Cargando previsualización...';
    try {
        if (typeof fileOrUrl === 'string') {
            // fetch URL
            const res = await fetch(fileOrUrl);
            if (!res.ok) throw new Error('no');
            const ct = res.headers.get('content-type') || '';
            if (ct.startsWith('image/')) {
                const blob = await res.blob();
                const url = URL.createObjectURL(blob);
                preview.innerHTML = '';
                const img = document.createElement('img');
                img.src = url;
                img.alt = 'preview';
                preview.appendChild(img);
                setTimeout(() => URL.revokeObjectURL(url), 3000);
                return;
            }
            if (ct.startsWith('text/') || ct.includes('json') || ct.includes('javascript')) {
                const text = await res.text();
                preview.innerHTML = '';
                const pre = document.createElement('pre');
                pre.textContent = text.slice(0, 2000);
                preview.appendChild(pre);
                return;
            }
            preview.innerHTML = 'Previsualización no disponible para este tipo.';
            return;
        } else {
            // file object
            const file = fileOrUrl;
            const ct = file.type || '';
            if (ct.startsWith('image/')) {
                const url = URL.createObjectURL(file);
                preview.innerHTML = '';
                const img = document.createElement('img');
                img.src = url;
                img.alt = 'preview';
                preview.appendChild(img);
                setTimeout(() => URL.revokeObjectURL(url), 3000);
                return;
            }
            if (ct.startsWith('text/') || ct.includes('json') || ct.includes('javascript') || file.name.match(/\.(html|css|js|txt|md|json|csv)$/i)) {
                const text = await file.text();
                preview.innerHTML = '';
                const pre = document.createElement('pre');
                pre.textContent = text.slice(0, 2000);
                preview.appendChild(pre);
                return;
            }
            preview.innerHTML = 'Previsualización no disponible para este tipo.';
            return;
        }
    } catch (e) {
        preview.innerHTML = 'No se pudo cargar la previsualización.';
    }
};

// Helper: generar etiqueta legible para el tipo de archivo
const friendlyTypeLabel = (fileOrNameOrMime) => {
    // file object with .type and .name
    if (!fileOrNameOrMime) return 'Desconocido';
    if (typeof fileOrNameOrMime === 'object') {
        const f = fileOrNameOrMime;
        if (f.type) {
            if (f.type.startsWith('text/')) return f.type.replace('text/', '').toUpperCase() + ' (texto)';
            if (f.type.startsWith('image/')) return 'Imagen (' + f.type.split('/')[1].toUpperCase() + ')';
            return f.type;
        }
        // fallback to name
        fileOrNameOrMime = f.name || '';
    }
    if (typeof fileOrNameOrMime === 'string') {
        const s = fileOrNameOrMime;
        // if it's a mime-type
        if (s.includes('/')) {
            if (s.startsWith('text/')) return s.replace('text/', '').toUpperCase() + ' (texto)';
            if (s.startsWith('image/')) return 'Imagen (' + s.split('/')[1].toUpperCase() + ')';
            return s;
        }
        // otherwise deduce from extension
        const m = s.match(/\.([^.\/?#]+)(?:[\?#].*)?$/);
        const ext = m ? m[1].toLowerCase() : '';
        switch (ext) {
            case 'html': return 'HTML';
            case 'htm': return 'HTML';
            case 'css': return 'CSS';
            case 'js': return 'JavaScript';
            case 'json': return 'JSON';
            case 'md': return 'Markdown';
            case 'txt': return 'Texto';
            case 'csv': return 'CSV';
            case 'png': case 'jpg': case 'jpeg': case 'gif': return 'Imagen';
            default: return ext ? ext.toUpperCase() + ' (archivo)' : 'Archivo';
        }
    }
    return 'Archivo';
};

// Helpers for modal/full view and copy path
document.addEventListener('DOMContentLoaded', () => {
    const copyBtn = document.getElementById('copy-path');
    const pathInput = document.getElementById('path-input');
    if (copyBtn && pathInput) {
        copyBtn.addEventListener('click', async () => {
            const text = pathInput.value || '';
            try {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(text);
                } else {
                    const ta = document.createElement('textarea');
                    ta.value = text;
                    ta.style.position = 'fixed'; ta.style.opacity = '0';
                    document.body.appendChild(ta);
                    ta.select(); document.execCommand('copy'); ta.remove();
                }
                showExplorerToast('Ruta copiada');
            } catch (e) {
                showExplorerToast('No se pudo copiar la ruta', 'warning');
            }
        });
    }

    const viewFullBtn = document.getElementById('view-full-button');
    const modal = document.getElementById('preview-modal');
    const modalBody = document.getElementById('preview-modal-body');
    const modalClose = document.getElementById('preview-modal-close');
    const backdrop = document.getElementById('preview-modal-backdrop');

    const closeModal = () => {
        if (!modal) return;
        modal.setAttribute('aria-hidden', 'true');
        modalBody.innerHTML = '';
    };

    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);

    if (viewFullBtn) {
        viewFullBtn.addEventListener('click', async () => {
            const src = window._lastPreviewSource;
            if (!src) { showExplorerToast('No hay previsualización disponible', 'warning'); return; }
            modal.setAttribute('aria-hidden', 'false');
            modalBody.innerHTML = 'Cargando...';
            try {
                if (typeof src === 'string') {
                    const res = await fetch(src);
                    if (!res.ok) throw new Error('Fetch failed');
                    const ct = res.headers.get('content-type') || '';
                    if (ct.startsWith('image/')) {
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        modalBody.innerHTML = '';
                        const img = document.createElement('img'); img.src = url; img.alt = 'preview'; modalBody.appendChild(img);
                        setTimeout(() => URL.revokeObjectURL(url), 5000);
                        return;
                    }
                    const text = await res.text();
                    modalBody.innerHTML = '';
                    const pre = document.createElement('pre'); pre.textContent = text; modalBody.appendChild(pre);
                    return;
                } else {
                    const file = src;
                    const ct = file.type || '';
                    if (ct.startsWith('image/')) {
                        const url = URL.createObjectURL(file);
                        modalBody.innerHTML = '';
                        const img = document.createElement('img'); img.src = url; img.alt = 'preview'; modalBody.appendChild(img);
                        setTimeout(() => URL.revokeObjectURL(url), 5000);
                        return;
                    }
                    const text = await file.text();
                    modalBody.innerHTML = '';
                    const pre = document.createElement('pre'); pre.textContent = text; modalBody.appendChild(pre);
                    return;
                }
            } catch (e) {
                modalBody.innerHTML = 'No se pudo cargar la previsualización completa.';
            }
        });
    }

    // (Se eliminó el botón de descarga; la descarga desde el modal ya no está disponible)
});

// Explorer toast
const explorerToast = document.createElement('div');
explorerToast.id = 'explorer-toast';
document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(explorerToast);
});

const showExplorerToast = (message, variant = 'info') => {
    explorerToast.textContent = message;
    explorerToast.className = '';
    if (variant === 'warning') explorerToast.classList.add('warning');
    if (variant === 'error') explorerToast.classList.add('error');
    explorerToast.classList.add('show');
    setTimeout(() => explorerToast.classList.remove('show'), 2600);
};

const createFileItem = (name, handle, relativePath) => {
    const li = document.createElement('li');
    li.textContent = `📄 ${name}`;
    li.dataset.ruta = relativePath;
    li.dataset.tipo = 'file';
    li._handle = handle;
    li.style.cursor = 'pointer';
    return li;
};

const createDirItem = (name, handle, relativePath) => {
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `📂 ${name}`;
    summary.dataset.ruta = relativePath;
    summary.dataset.tipo = 'directory';
    details.appendChild(summary);
    const ul = document.createElement('ul');
    details.appendChild(ul);
    return { details, ul };
};

const renderDirectory = async (dirHandle, parentUl, basePath) => {
    // limpiar nodos previos
    for await (const entry of dirHandle.values ? dirHandle.values() : dirHandle) {
        // no-op (compat)
    }
    parentUl.innerHTML = '';
    for await (const [name, handle] of dirHandle.entries()) {
        const rel = basePath ? `${basePath}/${name}` : `/${name}`;
        if (handle.kind === 'directory') {
            const { details, ul } = createDirItem(name, handle, rel);
            parentUl.appendChild(details);
            // recursion
            await renderDirectory(handle, ul, rel);
            // attach events to summary
            const summary = details.querySelector('summary');
            summary.addEventListener('click', (e) => {
                e.stopPropagation();
                const ruta = summary.dataset.ruta;
                document.getElementById('path-input').value = ruta;
            });
        } else {
            const li = createFileItem(name, handle, rel);
            parentUl.appendChild(li);
            // single click: show details
            li.addEventListener('click', async (e) => {
                e.stopPropagation();
                document.getElementById('path-input').value = rel;
                const panelNombre = document.querySelector('.panel-derecho ul li:nth-child(1)');
                const panelTipo = document.querySelector('.panel-derecho ul li:nth-child(2)');
                const panelTamano = document.querySelector('.panel-derecho ul li:nth-child(3)');
                panelNombre.innerHTML = `<strong>Nombre:</strong> ${name}`;
                // default until we can determine
                panelTipo.innerHTML = `<strong>Tipo:</strong> Cargando...`;
                // size unknown until read
                try {
                    const file = await li._handle.getFile();
                    const friendly = friendlyTypeLabel(file);
                    panelTipo.innerHTML = `<strong>Tipo:</strong> ${friendly}`;
                    panelTamano.innerHTML = `<strong>Tamaño:</strong> ${file.size} bytes`;
                    // preview
                    previewContent(file);
                } catch (err) {
                    // fallback: try to infer from path
                    const fallbackType = friendlyTypeLabel(rel);
                    panelTipo.innerHTML = `<strong>Tipo:</strong> ${fallbackType}`;
                    panelTamano.innerHTML = `<strong>Tamaño:</strong> -`;
                    previewContent(rel);
                }
            });
            // double click: open in editor
            li.addEventListener('dblclick', async (e) => {
                e.stopPropagation();
                try {
                    const file = await li._handle.getFile();
                    const text = await file.text();
                    // abrir editor en ventana (popup) y enviar contenido
                    const url = new URL('pages/editorArchivo.html', window.location.href);
                    const editorWin = window.open(url.toString(), '_blank', 'width=900,height=700');
                    const send = () => editorWin.postMessage({ action: 'loadContent', path: rel, name, content: text }, '*');
                    // esperar a que la ventana cargue
                    const timer = setInterval(() => {
                        try { send(); clearInterval(timer); } catch (e) { /* retry until available */ }
                    }, 200);
                } catch (err) {
                    console.error('No se pudo leer el archivo vía File System API', err);
                    // fallback open editor with query param
                    const url = new URL('/pages/editorArchivo.html', window.location.href);
                    url.searchParams.set('file', rel);
                    window.open(url.toString(), '_blank', 'width=900,height=700');
                }
            });
        }
    }
};

if (openProjectBtn) {
    openProjectBtn.addEventListener('click', async () => {
        if (!supportsFS()) {
            alert('Tu navegador no soporta la API de selección de carpeta. Abre el proyecto desde un servidor o usa Chrome/Edge.');
            return;
        }
        try {
            const dirHandle = await window.showDirectoryPicker();
            // renderizar estructura en el nav
            await renderDirectory(dirHandle, navRoot, '');
            document.getElementById('path-input').value = '/';
            // guardar handle para restaurar luego
            await saveDirHandle(dirHandle);
            showExplorerToast('Proyecto cargado');
        } catch (err) {
            console.error('Directorio no seleccionado o error', err);
        }
    });
}

// Recargar arbol: intenta usar handle almacenado
const reloadBtn = document.getElementById('reload-tree-button');
if (reloadBtn) {
    reloadBtn.addEventListener('click', async () => {
        const stored = await loadDirHandle();
        if (stored) {
            try { await renderDirectory(stored, navRoot, ''); document.getElementById('path-input').value = '/'; showExplorerToast('Árbol recargado'); return; } catch (e) { console.error(e); }
        }
        // fallback: pedir al usuario que seleccione carpeta
        if (supportsFS()) {
            try { const dirHandle = await window.showDirectoryPicker(); await renderDirectory(dirHandle, navRoot, ''); await saveDirHandle(dirHandle); document.getElementById('path-input').value='/'; showExplorerToast('Proyecto cargado'); } catch (e) { }
        } else alert('No hay carpeta guardada y tu navegador no soporta selección de carpetas.');
    });
}

// On load: try to restore previously selected folder
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const stored = await loadDirHandle();
        if (stored) {
            await renderDirectory(stored, navRoot, '');
            document.getElementById('path-input').value = '/';
            showExplorerToast('Proyecto restaurado');
        }
    } catch (e) { /* ignore */ }
});

// FIN: nuevas funcionalidades


