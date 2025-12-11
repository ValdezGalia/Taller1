const ruta = document.getElementById('file-path');
const archivo = document.getElementById('file-upload');
const abrir = document.getElementById('open-button');
const guardar = document.getElementById('save-button');
const cerrar = document.getElementById('close-button');
const editor = document.getElementById('editor-content');
const estado = document.getElementById('status-message');
let fileHandle = null; // Handle del File System Access API cuando esté disponible

// Tipos y extensiones permitidas
const allowedExtensions = ['.txt', '.html', '.htm', '.css', '.js', '.json', '.md', '.csv', '.xml'];
const allowedMimePrefixes = ['text/'];
const allowedMimeExact = ['application/javascript', 'application/json'];

const getExtension = (name) => {
    const idx = name.lastIndexOf('.');
    return idx >= 0 ? name.slice(idx).toLowerCase() : '';
};

const isTextFile = (file) => {
    if (!file) return false;
    const type = (file.type || '').toLowerCase();
    if (allowedMimePrefixes.some(p => type.startsWith(p))) return true;
    if (allowedMimeExact.includes(type)) return true;
    const ext = getExtension(file.name || '');
    if (allowedExtensions.includes(ext)) return true;
    return false;
};

// Simple toast notification appended to body
const toast = document.createElement('div');
toast.id = 'editor-toast';
document.addEventListener('DOMContentLoaded', () => {
    document.body.appendChild(toast);
    // Si se abre la página con ?file=ruta, mostrarla en el campo de ruta
    try {
        const params = new URLSearchParams(window.location.search);
        const f = params.get('file');
        if (f) {
            ruta.value = f;
            setEstado('Ruta precargada. Puedes hacer click en "Abrir" y seleccionar el mismo archivo, o pegar la ruta en el campo.');
        }
    } catch (e) {}
});

// Escuchar mensajes de otras ventanas (ej. explorador) para cargar contenido directamente
window.addEventListener('message', (ev) => {
    try {
        const msg = ev.data || {};
        if (msg && msg.action === 'loadContent') {
            if (typeof msg.content === 'string') {
                editor.value = msg.content;
                editor.disabled = false;
                guardar.disabled = false;
                cerrar.disabled = false;
                ruta.value = msg.path || ruta.value || '';
                setEstado(`Contenido cargado desde explorador: ${msg.name || ''}`);
                // opcional: enfocar el editor
                editor.focus();
            }
        }
    } catch (e) {
        console.error('Error processing message', e);
    }
});

// Helper: generar nombre de copia editada
const makeEditedName = (name) => {
    if (!name) return 'archivo_editado.txt';
    const idx = name.lastIndexOf('.');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    if (idx === -1) return `${name}_edit_${ts}`;
    const base = name.slice(0, idx);
    const ext = name.slice(idx);
    return `${base}_edit_${ts}${ext}`;
};

// Función reutilizable para forzar descarga
const forceDownload = (contenido, editedName) => {
    const blob = new Blob([contenido], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = editedName;
    a.rel = 'noopener';
    a.target = '_self';
    document.body.appendChild(a);
    try {
        a.click();
        a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    } catch (e) {
        try { window.open(url, '_blank'); } catch (err) { }
    }
    setTimeout(() => {
        a.remove();
        try { URL.revokeObjectURL(url); } catch (e) { }
    }, 1500);
};


const showToast = (message, variant = 'info') => {
    toast.textContent = message;
    toast.className = `editor-toast editor-toast--${variant}`;
    toast.setAttribute('aria-live', 'polite');
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 2200);
};

const setEstado = (message, variant = 'info') => {
    if (estado) {
        estado.textContent = message;
        estado.dataset.variant = variant;
    }
    showToast(message, variant);
};

const resetEditor = () => {
    editor.value = '';
    editor.disabled = true;
    guardar.disabled = true;
    cerrar.disabled = true;
    ruta.value = '';
    archivo.value = '';
    fileHandle = null;
};

const supportsFileSystemAccess = () => {
    return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window && 'FileSystemFileHandle' in window;
};

const isSecureContextForFS = () => {
    // File System Access requiere https o localhost en la mayoría de navegadores
    try {
        const host = location.hostname;
        return location.protocol === 'https:' || host === 'localhost' || host === '127.0.0.1';
    } catch (e) {
        return false;
    }
};

const ensureWritePermission = async (handle) => {
    if (!handle || !handle.queryPermission) return false;
    const opts = { mode: 'readwrite' };
    let perm = await handle.queryPermission(opts);
    if (perm === 'granted') return true;
    if (perm === 'denied') return false;
    perm = await handle.requestPermission(opts);
    return perm === 'granted';
};

const cargarDesdeHandle = async (handle) => {
    const file = await handle.getFile();
    if (!isTextFile(file)) {
        setEstado('El archivo seleccionado no es de texto.', 'warning');
        resetEditor();
        return;
    }
    const texto = await file.text();
    editor.value = texto;
    editor.disabled = false;
    guardar.disabled = false;
    cerrar.disabled = false;
    ruta.value = '/drivers/etc/hosts/' + (file.name || 'archivo');
    setEstado(`Archivo "${file.name}" cargado.`);
};

abrir.addEventListener('click', async () => {
    if (supportsFileSystemAccess()) {
        if (!isSecureContextForFS()) {
            setEstado('Atención: estás en un contexto inseguro (file:// o http). Para editar el archivo original abre la página desde https:// o http://localhost.', 'warning');
        }
        try {
            const [handle] = await window.showOpenFilePicker({
                multiple: false,
                types: [{
                    description: 'Archivos de texto',
                    accept: {
                        'text/plain': ['.txt', '.md', '.csv'],
                        'text/html': ['.html', '.htm'],
                        'text/css': ['.css'],
                        'application/javascript': ['.js'],
                        'application/json': ['.json'],
                        'application/xml': ['.xml']
                    }
                }],
                excludeAcceptAllOption: true
            });
            fileHandle = handle;
            if (!fileHandle.createWritable) {
                setEstado('El navegador/versión no permite escribir directamente en el archivo. Prueba en Chrome/Edge o actualiza Brave.', 'warning');
            }
            await cargarDesdeHandle(handle);
        } catch (err) {
            if (err && err.name === 'AbortError') return; // usuario canceló
            setEstado('No se pudo abrir el archivo.', 'error');
            resetEditor();
        }
    } else {
        archivo.click();
    }
});

archivo.addEventListener('change', (e) => {
    const archivos = e.target.files;
    if (!archivos || !archivos.length) {
        resetEditor();
        setEstado('No se seleccionó ningún archivo.', 'warning');
        return;
    }

    fileHandle = null; // entrada de archivo tradicional, sin handle
    const archivoSeleccionado = archivos[0];
    if (!isTextFile(archivoSeleccionado)) {
        resetEditor();
        setEstado('Tipo no permitido. Solo archivos de texto (.txt, .html, .css, .js, .json, etc.).', 'warning');
        return;
    }
    const rutaf = '/drivers/etc/hosts/' + archivoSeleccionado.name;
    ruta.value = rutaf;

    const lector = new FileReader();
    lector.onload = function(event) {
        editor.value = event.target.result;
        editor.disabled = false;
        guardar.disabled = false;
        cerrar.disabled = false;
        setEstado(`Archivo "${archivoSeleccionado.name}" cargado.`);
    };

    lector.onerror = () => {
        resetEditor();
        setEstado('No se pudo leer el archivo.', 'error');
    };

    lector.readAsText(archivoSeleccionado);
});

guardar.addEventListener('click', async () => {
    if (guardar.disabled || editor.disabled) return;
    const contenido = editor.value;
    const originalName = (archivo.files && archivo.files[0] ? archivo.files[0].name : null) || (fileHandle && fileHandle.name) || null;

    const editedName = makeEditedName(originalName);

    // Guardar siempre como copia: usar File Save Picker si está disponible, si no forzar descarga
    if (supportsFileSystemAccess()) {
        try {
            const newHandle = await window.showSaveFilePicker({ suggestedName: editedName });
            const writable = await newHandle.createWritable();
            await writable.write(contenido);
            await writable.close();
            setEstado(`Copia guardada como ${editedName}.`);
            return;
        } catch (err) {
            if (err && err.name === 'AbortError') {
                setEstado('Guardado cancelado.', 'warning');
                return;
            }
            setEstado('No se pudo guardar la copia con el selector de archivos.', 'error');
        }
    }

    // Fallback descarga forzada (auto-download)
    forceDownload(contenido, editedName);
    setEstado(`Copia descargada como ${editedName}.`);
});

cerrar.addEventListener('click', () => {
    resetEditor();
    setEstado('Archivo cerrado.');
});

// (Se eliminó el botón de "Forzar descarga" y su listener.)

// Estado inicial
resetEditor();