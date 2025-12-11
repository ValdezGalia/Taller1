const output = document.getElementById('terminal-output');
const input = document.getElementById('command-input');
const promptText = "user@simulador:~$ "; // Tu prompt base

// busy counter: cuando >0, la terminal está ejecutando procesos asíncronos
let busyCount = 0;
function startBusy() {
    try { busyCount = (busyCount || 0) + 1; } catch (e) { busyCount = 1; }
    // ocultar hint inmediatamente si existe
    const h = document.getElementById('tab-hint'); if (h) h.style.display = 'none';
}
function stopBusy() {
    try { busyCount = Math.max(0, (busyCount || 0) - 1); } catch (e) { busyCount = 0; }
    if (busyCount === 0) updateTabHintVisibility();
}

document.getElementById('terminal-window').addEventListener('click', () => {
    input.focus();
});

// Helper: agrega una línea con el prompt (span) y el comando usando DOM
function appendPromptCommand(command) {
    // Añadimos un salto de línea, un span para el prompt y el texto del comando.
    // Usar nodos evita reasignar `innerHTML` y recrear otros elementos del DOM.
    try {
        output.appendChild(document.createTextNode('\n'));
        const span = document.createElement('span');
        span.className = 'prompt';
        span.style.color = '#42a03a';
        span.textContent = promptText + '>';
        output.appendChild(span);
        output.appendChild(document.createTextNode(' ' + command));
    } catch (e) {
        // fallback seguro: usar innerHTML si algo falla (no deseado, pero seguro)
        output.innerHTML += `\n<span class="prompt" style="color: #42a03a">${promptText}></span> ${command}`;
    }
}

// Create a small Tab hint element and attach it next to the input
function createTabHint() {
    try {
        const cmdLine = document.getElementById('command-line');
        if (!cmdLine) return null;
        let hint = document.getElementById('tab-hint');
        if (hint) return hint;
        hint = document.createElement('div');
        hint.id = 'tab-hint';
        hint.setAttribute('aria-hidden', 'true');
        hint.title = 'Presiona Tab para autocompletar';
        hint.innerHTML = '<span class="kbd">Tab</span>';
        // insert after the input if possible
        const inputEl = document.getElementById('command-input');
        if (inputEl && inputEl.parentNode) {
            inputEl.parentNode.appendChild(hint);
        } else {
            cmdLine.appendChild(hint);
        }
        return hint;
    } catch (e) { return null; }
}

// Compute lightweight candidate list for current input value (used to show/hide hint)
function computeCandidatesForInput(value) {
    const cursor = value.length;
    const before = value.slice(0, cursor);
    const parts = before.split(/\s+/).filter(Boolean);
    const last = parts.length ? parts[parts.length - 1] : '';

    // if first token: commands
    if (parts.length <= 1) {
        if (!last) return AVAILABLE_COMMANDS.slice();
        const cmds = AVAILABLE_COMMANDS.filter(c => c.startsWith(last.toLowerCase()));
        return cmds;
    }

    // otherwise, check if command expects args
    const cmd = parts[0].toLowerCase();
    const commandsWithArgs = {
        ping: 'host', traceroute: 'host', pathping: 'host', curl: 'url', tree: 'path', flushdns: 'key'
    };
    const expect = commandsWithArgs[cmd];
    if (!expect) return [];
    try {
        if (expect === 'path') {
            const fs = getFsCandidates();
            return fs.filter(p => p.path.toLowerCase().startsWith(last.toLowerCase())).map(p=>p.path);
        } else if (expect === 'host' || expect === 'url') {
            const seen = new Set(['example.com','localhost']);
            for (const h of CMD_HISTORY) {
                const toks = h.split(/\s+/);
                if (toks[1] && toks[1].includes('.')) seen.add(toks[1]);
            }
            return Array.from(seen).filter(s=>s.toLowerCase().startsWith(last.toLowerCase()));
        } else if (expect === 'key') {
            const keys = [];
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k && k.toLowerCase().startsWith(last.toLowerCase())) keys.push(k);
            }
            return keys;
        }
    } catch (e) { return []; }
    return [];
}

function updateTabHintVisibility() {
    const hint = createTabHint();
    if (!hint) return;
    try {
        // si hay procesos en ejecución, ocultar hint
        if (typeof busyCount !== 'undefined' && busyCount > 0) {
            hint.style.display = 'none';
            return;
        }
        const val = input.value || '';
        const candidates = computeCandidatesForInput(val);
        if (candidates && candidates.length > 0) {
            hint.style.display = 'inline-flex';
        } else {
            hint.style.display = 'none';
        }
    } catch (e) { hint.style.display = 'none'; }
}

// Attach events to keep hint updated
try {
    input.addEventListener('input', updateTabHintVisibility);
    input.addEventListener('focus', updateTabHintVisibility);
    input.addEventListener('blur', () => { const h = document.getElementById('tab-hint'); if (h) h.style.display = 'none'; });
    // init
    window.addEventListener('load', () => { createTabHint(); updateTabHintVisibility(); });
} catch (e) {}

input.addEventListener('keydown', (e) => {
    const key = e.key;
    // Enter: ejecutar
    if (key === "Enter") {
        const command = input.value.trim(); // Elimina espacios extra

        // guardar en historial si tiene contenido y no es repetido
        if (command !== '') {
            if (CMD_HISTORY.length === 0 || CMD_HISTORY[CMD_HISTORY.length - 1] !== command) {
                CMD_HISTORY.push(command);
            }
            historyIndex = CMD_HISTORY.length; // posicion para nueva entrada
        }

        // 1. Imprimir el comando que el usuario escribió (Historial)
        appendPromptCommand(command);

        // 2. Procesar el comando
        if (command !== "") {
            executeCommand(command);
        }

        // 3. Limpiar el input y hacer scroll hacia abajo
        input.value = '';
        scrollToBottom();
        // reset cycle state
        lastCandidates = [];
        cycleIndex = -1;
        lastCompletionToken = '';
        return;
    }

    // ArrowUp / ArrowDown: historial
    if (key === 'ArrowUp' || key === 'ArrowDown') {
        e.preventDefault();
        if (CMD_HISTORY.length === 0) return;
        if (historyIndex === -1) historyIndex = CMD_HISTORY.length;
        if (key === 'ArrowUp') {
            historyIndex = Math.max(0, historyIndex - 1);
        } else {
            historyIndex = Math.min(CMD_HISTORY.length, historyIndex + 1);
        }
        if (historyIndex >= 0 && historyIndex < CMD_HISTORY.length) {
            input.value = CMD_HISTORY[historyIndex];
        } else {
            input.value = '';
        }
        // move cursor to end
        input.setSelectionRange(input.value.length, input.value.length);
        return;
    }

    // Tab: autocompletar
    if (key === 'Tab') {
        e.preventDefault();
        try {
            const cursor = input.selectionStart || input.value.length;
            const before = input.value.slice(0, cursor);
            const after = input.value.slice(cursor);
            // dividir tokens por espacios, conservar la parte que estamos completando
            const parts = before.split(/\s+/);
            const last = parts[parts.length - 1] || '';

            // build candidate objects: {text, isDir, size, type}
            let candidates = [];

            // If completing the first token (command)
            if (parts.length === 1) {
                const cmds = AVAILABLE_COMMANDS.filter(c => c.startsWith(last.toLowerCase()));
                candidates = cmds.map(c => ({ text: c, isDir: false, size: 0, type: 'cmd' }));
            }

            // If completing additional tokens, only provide suggestions for commands that accept arguments
            const cmd = parts[0] ? parts[0].toLowerCase() : '';
            const commandsWithArgs = {
                ping: 'host',
                traceroute: 'host',
                pathping: 'host',
                curl: 'url',
                tree: 'path',
                flushdns: 'key'
            };
            // spec for positional argument counts for commands that require multiple positional args
            const commandSpec = {
                // command: { positional: N }
                // add entries here for commands that require two positional args if needed
                // example: 'copy': { positional: 2 }
            };

            if (parts.length > 1) {
                // count provided positional args (exclude flags that start with '-')
                const providedPositional = parts.slice(1).filter(t => t && !t.startsWith('-')).length;
                const spec = commandSpec[cmd];
                const nextTokenIsFlag = last && last.startsWith('-');
                // If the command requires N positional args and they've been provided,
                // and the user is typing a flag/attribute, do not show suggestions
                if (spec && spec.positional && providedPositional >= spec.positional && nextTokenIsFlag) {
                    candidates = [];
                } else {
                    // if the entered command expects an argument, provide contextual suggestions
                    const expect = commandsWithArgs[cmd];
                    if (expect === 'path') {
                        const fs = getFsCandidates();
                        const pref = last;
                        const matches = fs.filter(p => p.path.toLowerCase().startsWith(pref.toLowerCase()));
                        const mapped = matches.map(m => ({ text: m.path, isDir: !!m.isDir, size: m.size||0, type: 'fs' }));
                        candidates = candidates.concat(mapped);
                    } else if (expect === 'host' || expect === 'url') {
                        // gather hosts/urls from history and some defaults
                        const seenHosts = new Set();
                        const defaults = ['example.com','localhost'];
                        for (const h of CMD_HISTORY) {
                            try {
                                const t = h.split(/\s+/)[1];
                                if (t && t.includes('.')) seenHosts.add(t);
                            } catch (e) {}
                        }
                        defaults.forEach(d=>seenHosts.add(d));
                        const pref = last.toLowerCase();
                        const arr = Array.from(seenHosts).filter(s => s.toLowerCase().startsWith(pref));
                        candidates = candidates.concat(arr.map(a=>({ text: a, isDir: false, size: 0, type: 'host' })));
                    } else if (expect === 'key') {
                        // suggest localStorage keys
                        try {
                            const keys = [];
                            for (let i = 0; i < localStorage.length; i++) {
                                const k = localStorage.key(i);
                                if (k) keys.push(k);
                            }
                            const pref = last.toLowerCase();
                            const arr = keys.filter(s => s.toLowerCase().startsWith(pref));
                            candidates = candidates.concat(arr.map(a=>({ text: a, isDir: false, size: 0, type: 'key' })));
                        } catch (e) {
                            // ignore
                        }
                    } else {
                        // command does not accept arguments -> do not suggest anything further
                        candidates = [];
                    }
                }
            }

            // if empty token and no candidates yet, suggest all commands
            if (candidates.length === 0 && last === '') {
                candidates = AVAILABLE_COMMANDS.map(c => ({ text: c, isDir: false, size: 0, type: 'cmd' }));
            }

            // remove duplicates by text
            const seen = new Map();
            candidates.forEach(c => { if (!seen.has(c.text)) seen.set(c.text, c); });
            candidates = Array.from(seen.values()).sort((a,b)=>a.text.localeCompare(b.text));

            if (candidates.length === 0) return;

            // If user is cycling (Shift+Tab or repeated Tab) and token unchanged, handle cycling
            const tokenKey = last;
            if ((e.shiftKey || lastCandidates.length > 0) && lastCompletionToken === tokenKey && lastCandidates.length > 0) {
                // cycle
                if (cycleIndex === -1) cycleIndex = 0;
                if (e.shiftKey) {
                    cycleIndex = (cycleIndex - 1 + lastCandidates.length) % lastCandidates.length;
                } else {
                    cycleIndex = (cycleIndex + 1) % lastCandidates.length;
                }
                const pick = lastCandidates[cycleIndex];
                // apply pick
                const completion = pick.text;
                if (parts.length === 1) {
                    // if directory, keep trailing slash and no space
                    if (pick.isDir) {
                        input.value = completion + after;
                        input.setSelectionRange(completion.length, completion.length);
                    } else {
                        input.value = completion + ' ' + after;
                        input.setSelectionRange(completion.length + 1, completion.length + 1);
                    }
                } else {
                    const newBefore = parts.slice(0, -1).concat([completion]).join(' ');
                    input.value = (newBefore + (after ? ' ' + after : '')).trimStart();
                    const pos = newBefore.length + 1;
                    input.setSelectionRange(pos, pos);
                }
                return;
            }

            // Not cycling: normal completion behavior
            // compute common prefix of candidate texts
            const textsLower = candidates.map(c => c.text.toLowerCase());
            const cp = commonPrefix(textsLower);

            if (candidates.length === 1) {
                const pick = candidates[0];
                // apply single completion
                const completion = pick.text;
                if (parts.length === 1) {
                    if (pick.isDir) {
                        // don't add space after directories; keep trailing '/'
                        input.value = completion + after;
                        input.setSelectionRange(completion.length, completion.length);
                    } else {
                        input.value = completion + ' ' + after;
                        input.setSelectionRange(completion.length + 1, completion.length + 1);
                    }
                } else {
                    const newBefore = parts.slice(0, -1).concat([completion]).join(' ');
                    input.value = (newBefore + (after ? ' ' + after : '')).trimStart();
                    const pos = newBefore.length + 1;
                    input.setSelectionRange(pos, pos);
                }
                // reset cycling state
                lastCandidates = [candidates[0]];
                cycleIndex = 0;
                lastCompletionToken = tokenKey;
            } else if (cp && cp.length > last.length) {
                // extend to common prefix
                const ext = cp;
                if (parts.length === 1) {
                    input.value = ext + ' ' + after;
                    input.setSelectionRange(ext.length + 1, ext.length + 1);
                } else {
                    const newBefore = parts.slice(0, -1).concat([ext]).join(' ');
                    input.value = (newBefore + (after ? ' ' + after : '')).trimStart();
                    const pos = newBefore.length + 1;
                    input.setSelectionRange(pos, pos);
                }
                // prepare cycling candidates
                lastCandidates = candidates;
                cycleIndex = -1;
                lastCompletionToken = tokenKey;
            } else {
                // show suggestions with metadata (size / dir)
                const display = candidates.map(c => c.isDir ? `${c.text} <dir>` : `${c.text} (${c.size}B)`);
                printOutput('Sugerencias:\n' + display.join('  '));
                // store for cycling
                lastCandidates = candidates;
                cycleIndex = -1;
                lastCompletionToken = tokenKey;
            }
        } catch (ex) {
            // no romper la UI por un fallo de autocompletado
            console.error('Autocompletion error', ex);
        }
        return;
    }
});

/**
 *  
 *  ping (envía IcmpPacket con ECHO_REQUEST, mide RTT, muestra stats)
    curl (simula el Fetch: construye HttpPacket, envía, muestra respuesta)
    traceroute (envía IcmpPacket con TTL incremental, muestra hops)
    pathping (combina ping/traceroute para stats ruta)
    ipconfig (muestra IP local de DHCP, MAC simulada)
    flushdns (Elimina las entradas de nombres de dominio en el mapa LocalStorage)
    tree (muestra el contenido del sistema de archivos como texto)
    help (lista de los comandos con sus descripciones respectivas).
 */

function executeCommand(cmd) {
    const args = cmd.split(' '); // Dividir por espacios (para futuros argumentos)
    const mainCommand = args[0].toLowerCase(); 

    let response = "";

    switch (mainCommand) {
        case 'help': {
            // Soporta: `help`, `help ping`, `help -att ping` o `help --att ping`
            let target = null;
            if (args.length > 1) {
                if (args[1] === '-att' || args[1] === '--att') {
                    if (args[2]) target = args[2].toLowerCase();
                } else {
                    target = args[1].toLowerCase();
                }
            }

            if (target) {
                // Ayuda detallada por comando
                if (target === 'ping') {
                    printOutput('Ayuda para: ping');
                    printOutput('Uso: ping <host> [-c count] [-i ms] [-l loss%] [-t]');
                    printOutput('Descripción: Simula un ping ICMP y muestra RTT y estadísticas.');
                    printOutput('Ejemplos:');
                    printOutput('  ping ejemplo.com');
                    printOutput('  ping ejemplo.com -c 6 -i 500');
                    printOutput('  ping ejemplo.com -l 20  (aprox. 20% pérdida)');
                } else if (target === 'date') {
                    printOutput('Ayuda para: date');
                    printOutput('Uso: date');
                    printOutput('Muestra la fecha y hora local del sistema.');
                } else if (target === 'clear') {
                    printOutput('Ayuda para: clear');
                    printOutput('Uso: clear');
                    printOutput('Limpia la pantalla de la terminal.');
                } else if (target === 'curl') {
                    printOutput('Ayuda para: curl');
                    printOutput('Uso: curl <url> [-X METHOD] [-d data] [-H "Header: val"] [-i]');
                    printOutput('Descripción: Simula una petición HTTP y muestra request/response.');
                    printOutput('Flags comunes: -X METHOD, -d "data", -H "Header: value", -i (muestra headers)');
                    printOutput('Ejemplos:');
                    printOutput('  curl ejemplo.com');
                    printOutput('  curl ejemplo.com -i');
                    printOutput('  curl ejemplo.com -X POST -d "a=1" -H "Content-Type: application/x-www-form-urlencoded" -i');
                } else if (target === 'traceroute') {
                    printOutput('Ayuda para: traceroute');
                    printOutput('Uso: traceroute <host> [-m max_hops] [-q probes] [-i ms]');
                    printOutput('Descripción: Simula un traceroute ICMP incrementando el TTL y mostrando hops.');
                    printOutput('Flags comunes: -m <max_hops> (por defecto 30), -q <probes> (por defecto 3), -i <interval_ms>');
                    printOutput('Ejemplos:');
                    printOutput('  traceroute ejemplo.com');
                    printOutput('  traceroute ejemplo.com -m 20 -q 4 -i 300');
                } else if (target === 'ipconfig') {
                    printOutput('Ayuda para: ipconfig');
                    printOutput('Uso: ipconfig');
                    printOutput('Descripción: Muestra información de red simulada: dirección IPv4 local, máscara, puerta de enlace, servidor DHCP, DNS y MAC.');
                    printOutput('Ejemplo:');
                    printOutput('  ipconfig');
                } else if (target === 'flushdns') {
                    printOutput('Ayuda para: flushdns');
                    printOutput('Uso: flushdns [<clave>] [--all|-a] [--list]');
                    printOutput('Descripción: Elimina entradas relacionadas con DNS en localStorage.');
                    printOutput('  Si se pasa <clave> se elimina únicamente esa clave concreta.');
                    printOutput('  Con --all o -a se elimina de forma agresiva todas las claves que contengan "dns".');
                    printOutput('  Con --list se listan claves: si se usa sin argumentos lista todas las claves de localStorage (solo nombres).');
                    printOutput('Ejemplos:');
                    printOutput('  flushdns                 (intenta eliminar claves DNS detectadas por patrones comunes)');
                    printOutput('  flushdns myDnsKey        (elimina la clave exacta "myDnsKey" si existe)');
                    printOutput('  flushdns --all           (elimina todas las claves que contienen "dns" en su nombre)');
                    printOutput('  flushdns --list          (muestra las claves que coinciden pero NO las elimina)');
                } else if (target === 'tree') {
                    printOutput('Ayuda para: tree');
                    printOutput('Uso: tree [ruta] [-L profundidad] [-a]');
                    printOutput('Descripción: Muestra el contenido del sistema de archivos como texto en formato árbol.');
                    printOutput('  Este comando usa un sistema de archivos simulado embebido en el navegador.');
                    printOutput('Flags:');
                    printOutput('  -L <n>    Limita la profundidad de directorios a mostrar (por defecto sin límite)');
                    printOutput('  -a        Muestra archivos ocultos (aquellos cuyo nombre empieza por ".")');
                    printOutput('Ejemplos:');
                    printOutput('  tree');
                    printOutput('  tree pages -L 2');
                    printOutput('  tree / -a');
                } else if (target === 'pathping') {
                    printOutput('Ayuda para: pathping');
                    printOutput('Uso: pathping <host> [-m max_hops] [-q probes] [-p perhop] [-i ms] [--fast|-f]');
                    printOutput('Descripción: Ejecuta un traceroute simulado y luego pings a cada hop para obtener pérdida y RTT por hop.');
                    printOutput('Flags comunes: -m <max_hops> (por defecto 30), -q <probes> (traceroute probes, por defecto 3), -p <perhop> (pings por hop, por defecto 8), -i <interval_ms>');
                    printOutput('             --fast or -f: ejecuta en modo rápido (minimiza los sleeps para pruebas).');
                    printOutput('Ejemplos:');
                    printOutput('  pathping ejemplo.com');
                    printOutput('  pathping ejemplo.com -m 20 -q 3 -p 6 -i 200 --fast');
                } else if (target === 'whoami') {
                    printOutput('Ayuda para: whoami');
                    printOutput('Uso: whoami');
                    printOutput('Muestra el nombre del usuario actual del simulador.');
                } else {
                    printOutput(`No existe ayuda detallada para '${target}'.`);
                    printOutput("Escribe 'help' para ver la lista de comandos disponibles.");
                }
                // No seguir al flujo normal (ya imprimimos la ayuda detallada)
                return;
            }

            // Ayuda general
            response = `Comandos disponibles:
            help    - Muestra esta ayuda
            ping    - Simula un ping ICMP y muestra RTT/stats
            flushdns - Elimina entradas DNS en localStorage
            tree    - Muestra el contenido del sistema de archivos como texto
            curl    - Simula una petición HTTP (muestra request/response)
            traceroute - Simula un traceroute ICMP mostrando hops por TTL
            pathping - Combina traceroute y ping para estadísticas por hop
            ipconfig - Muestra IP local simulada, máscara, gateway y MAC
            date    - Muestra la fecha y hora actual
            clear   - Limpia la terminal
            whoami  - Muestra el usuario actual

            Para ayuda detallada sobre un comando use: help [comando]
            También puede usar: help -att [comando]`;
        }
            break;

        case 'ping':
            (async () => { startBusy(); try {
                const host = args[1];
                if (!host) {
                    printOutput("Uso: ping <host> [-c count] [-i ms] [-l loss%] [-t]");
                    printOutput("Ejemplos:");
                    printOutput("  ping ejemplo.com");
                    printOutput("  ping ejemplo.com -c 6 -i 500");
                    printOutput("  ping ejemplo.com -l 20  (20% pérdida aproximada)");
                    return;
                }

                // defaults
                let count = 4;
                let interval = 1000; // ms between packets
                let lossProbability = 0.08; // default 8%
                let continuous = false;
                let baseTtl = 64;

                // parse flags - soporta formas: '-c 6', '-c6', '--count=6'
                for (let i = 2; i < args.length; i++) {
                    const a = args[i];
                    // -c or --count
                    if (a === '-c' || a === '--count') {
                        if (args[i+1]) {
                            const v = parseInt(args[i+1], 10);
                            if (!isNaN(v) && v > 0) count = v;
                            i++; // consumir el siguiente token
                        }
                        continue;
                    }
                    // -c6 style
                    const mC = a.match(/^-c(\d+)$/);
                    if (mC) { const v = parseInt(mC[1],10); if (!isNaN(v) && v>0) count = v; continue; }
                    const mCountEq = a.match(/^--count=(\d+)$/);
                    if (mCountEq) { const v = parseInt(mCountEq[1],10); if (!isNaN(v) && v>0) count = v; continue; }

                    // -i or --interval
                    if (a === '-i' || a === '--interval') {
                        if (args[i+1]) {
                            const v = parseInt(args[i+1], 10);
                            if (!isNaN(v) && v > 0) interval = v;
                            i++;
                        }
                        continue;
                    }
                    const mI = a.match(/^-i(\d+)$/);
                    if (mI) { const v = parseInt(mI[1],10); if (!isNaN(v) && v>0) interval = v; continue; }
                    const mIntervalEq = a.match(/^--interval=(\d+)$/);
                    if (mIntervalEq) { const v = parseInt(mIntervalEq[1],10); if (!isNaN(v) && v>0) interval = v; continue; }

                    // -l or --loss (percentage)
                    if (a === '-l' || a === '--loss') {
                        if (args[i+1]) {
                            const v = parseFloat(args[i+1]);
                            if (!isNaN(v) && v >= 0) lossProbability = Math.min(1, Math.max(0, v / 100.0));
                            i++;
                        }
                        continue;
                    }
                    const mL = a.match(/^-l(\d+(?:\.\d+)?)$/);
                    if (mL) { const v = parseFloat(mL[1]); if (!isNaN(v) && v>=0) lossProbability = Math.min(1, Math.max(0, v/100.0)); continue; }
                    const mLossEq = a.match(/^--loss=(\d+(?:\.\d+)?)$/);
                    if (mLossEq) { const v = parseFloat(mLossEq[1]); if (!isNaN(v) && v>=0) lossProbability = Math.min(1, Math.max(0, v/100.0)); continue; }

                    // -t or --continuous
                    if (a === '-t' || a === '--continuous') { continuous = true; continue; }

                    // TTL: -T or --ttl
                    if (a === '-T' || a === '--ttl') {
                        if (args[i+1]) {
                            const v = parseInt(args[i+1], 10);
                            if (!isNaN(v) && v > 0) baseTtl = v;
                            i++;
                        }
                        continue;
                    }
                    const mT = a.match(/^-T(\d+)$/);
                    if (mT) { const v = parseInt(mT[1],10); if (!isNaN(v) && v>0) baseTtl = v; continue; }
                    const mTEq = a.match(/^--ttl=(\d+)$/);
                    if (mTEq) { const v = parseInt(mTEq[1],10); if (!isNaN(v) && v>0) baseTtl = v; continue; }
                }

                // seeded RNG per host for consistent RTT distribution
                function makeRng(seed) {
                    let s = seed >>> 0;
                    return function() {
                        s = (s * 1664525 + 1013904223) >>> 0;
                        return s / 4294967296;
                    };
                }
                // derive seed from host string
                let seed = 0;
                for (let i = 0; i < host.length; i++) seed = (seed * 31 + host.charCodeAt(i)) >>> 0;
                const rng = makeRng(seed || 2166136261);

                // Ocultar el prompt inferior mientras el ping está activo
                const promptEl = document.getElementById('prompt');
                let _prevPromptVisibility = null;
                if (promptEl) {
                    _prevPromptVisibility = promptEl.style.visibility;
                    try { promptEl.style.visibility = 'hidden'; } catch (e) {}
                }

                printOutput(`PING ${host} (simulado) - ${continuous ? 'continuo' : (count + ' paquetes')}`);

                let transmitted = 0, received = 0;
                const rtts = [];
                let running = true;

                // allow stopping with Ctrl+C: listen for ctrl+c while ping running
                const onKeyDown = (ev) => {
                    if (ev.ctrlKey && (ev.key === 'c' || ev.key === 'C')) {
                        if (running) {
                            running = false;
                            printOutput('^C');
                        }
                    }
                };
                document.addEventListener('keydown', onKeyDown);

                try {
                    let seq = 0;
                    while (running && (continuous || seq < count)) {
                        seq++;
                        transmitted++;

                        // RTT distribution: base + jitter + occasional spike
                        // base RTT derived per-host
                        const hostBase = 10 + rng() * 60; // base between 10-70ms
                        // jitter factor ~ uniform small
                        const jitter = (rng() - 0.5) * 0.3; // +/-15%
                        // occasional spike
                        const spike = (rng() < 0.03) ? (50 + rng() * 200) : 0; // 3% chance of spike
                        const simulatedRtt = Math.max(1, hostBase * (1 + jitter) + spike);

                        // loss depends on host RNG too but can be overridden
                        const lost = rng() < lossProbability;

                        // TTL variation
                        const ttl = Math.max(1, Math.round(baseTtl - 2 + rng() * 5));

                        // wait interval (interval between packets)
                        await new Promise(res => setTimeout(res, interval));

                        if (!lost && running) {
                            received++;
                            rtts.push(simulatedRtt);
                            printOutput(`${64} bytes from ${host}: icmp_seq=${seq} ttl=${ttl} time=${simulatedRtt.toFixed(2)} ms`);
                        } else if (!running) {
                            // stopped by Ctrl+C
                            break;
                        } else {
                            printOutput(`Request timeout for icmp_seq ${seq}`);
                        }
                    }
                } finally {
                    document.removeEventListener('keydown', onKeyDown);
                    // Restaurar visibilidad del prompt cuando termine/sea interrumpido
                    try {
                        if (promptEl) promptEl.style.visibility = (_prevPromptVisibility || 'visible');
                    } catch (e) {}
                }

                // statistics
                const lossPercent = transmitted > 0 ? ((transmitted - received) / transmitted) * 100 : 0;
                let min = 0, max = 0, avg = 0, mdev = 0;
                if (rtts.length > 0) {
                    min = Math.min(...rtts);
                    max = Math.max(...rtts);
                    avg = rtts.reduce((a,b) => a + b, 0) / rtts.length;
                    const variance = rtts.reduce((a,b) => a + Math.pow(b - avg, 2), 0) / rtts.length;
                    mdev = Math.sqrt(variance);
                }

                printOutput(`--- ${host} ping statistics ---`);
                printOutput(`${transmitted} packets transmitted, ${received} received, ${lossPercent.toFixed(1)}% packet loss`);
                if (rtts.length > 0) printOutput(`rtt min/avg/max/mdev = ${min.toFixed(2)}/${avg.toFixed(2)}/${max.toFixed(2)}/${mdev.toFixed(2)} ms`);
            } finally { stopBusy(); } })();
            break;

            case 'curl':
                (async () => { startBusy(); try {
                    const raw = args[1];
                    if (!raw) {
                        printOutput('Uso: curl <url> [-X METHOD] [-d data] [-H "Header: val"] [-i]');
                        printOutput('Ejemplos:');
                        printOutput('  curl http://ejemplo.com');
                        printOutput('  curl http://ejemplo.com -X POST -d "name=1" -H "Content-Type: application/x-www-form-urlencoded" -i');
                        return;
                    }

                    // parse flags sencillos
                    let method = 'GET';
                    let data = null;
                    const extraHeaders = [];
                    let showResponseHeaders = false;
                    for (let i = 2; i < args.length; i++) {
                        const a = args[i];
                        if ((a === '-X' || a === '--request') && args[i+1]) {
                            method = args[i+1].toUpperCase();
                            i++;
                            continue;
                        }
                        if ((a === '-d' || a === '--data') && args[i+1]) {
                            data = args[i+1];
                            i++;
                            continue;
                        }
                        if (a === '-i') {
                            showResponseHeaders = true;
                            continue;
                        }
                        if ((a === '-H' || a === '--header') && args[i+1]) {
                            extraHeaders.push(args[i+1]);
                            i++;
                            continue;
                        }
                    }

                    // Normalizar URL para poder extraer host
                    let url = raw;
                    try {
                        // si no tiene esquema, asumir http
                        if (!/^https?:\/\//i.test(url)) url = 'http://' + url;
                        new URL(url); // sólo para validar
                    } catch (e) {
                        printOutput(`curl: URL inválida: ${raw}`);
                        return;
                    }

                    // RNG por URL para latencias/errores consistentes
                    function makeRng(seed) {
                        let s = seed >>> 0;
                        return function() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
                    }
                    let seed = 0; for (let i = 0; i < url.length; i++) seed = (seed * 31 + url.charCodeAt(i)) >>> 0;
                    const rng = makeRng(seed || 2166136261);

                    printOutput(`> ${method} ${url}`);
                    printOutput('Construyendo HttpPacket...');
                    const reqHeaders = [];
                    try {
                        const u = new URL(url);
                        reqHeaders.push(`Host: ${u.host}`);
                    } catch (e) {}
                    reqHeaders.push('User-Agent: simulador-curl/1.0');
                    if (data && !extraHeaders.some(h=>/content-type/i.test(h))) {
                        reqHeaders.push('Content-Type: application/x-www-form-urlencoded');
                    }
                    if (data) reqHeaders.push(`Content-Length: ${data.length}`);
                    // añadir headers extra
                    extraHeaders.forEach(h => reqHeaders.push(h));

                    // mostrar request breve
                    printOutput('\n--- Request ---');
                    printOutput(`${method} ${url} HTTP/1.1`);
                    reqHeaders.forEach(h => printOutput(h));
                    if (data) printOutput('\n' + data);

                    // simular envío
                    printOutput('Enviando...');
                    const delay = 100 + Math.floor(rng() * 800);
                    await new Promise(res => setTimeout(res, delay));

                    // posibilidad de fallo de conexión
                    if (rng() < 0.05) {
                        printOutput(`curl: (7) Failed to connect to ${raw}`);
                        return;
                    }

                    // simular respuesta
                    const statusChance = rng();
                    let status = 200, statusText = 'OK';
                    if (statusChance < 0.06) { status = 500; statusText = 'Internal Server Error'; }
                    else if (statusChance < 0.12) { status = 404; statusText = 'Not Found'; }

                    const respHeaders = [];
                    respHeaders.push(`Date: ${new Date().toUTCString()}`);
                    respHeaders.push('Server: simulador/0.1');
                    const bodyIsJson = /\.json$|\/api\//i.test(url) || (data && /json/i.test(extraHeaders.join(' ')));
                    let body = '';
                    if (status === 200) {
                        if (bodyIsJson) {
                            body = JSON.stringify({ message: 'Respuesta simulada', url: raw, method, timestamp: Date.now() }, null, 2);
                            respHeaders.push('Content-Type: application/json; charset=utf-8');
                        } else {
                            body = `<html><body><h1>Simulated response for ${raw}</h1><p>Method: ${method}</p></body></html>`;
                            respHeaders.push('Content-Type: text/html; charset=utf-8');
                        }
                    } else if (status === 404) {
                        body = '404 Not Found';
                        respHeaders.push('Content-Type: text/plain; charset=utf-8');
                    } else {
                        body = '500 Internal Server Error';
                        respHeaders.push('Content-Type: text/plain; charset=utf-8');
                    }
                    respHeaders.push(`Content-Length: ${body.length}`);

                    // mostrar respuesta
                    printOutput('\n--- Response ---');
                    if (showResponseHeaders) {
                        printOutput(`HTTP/1.1 ${status} ${statusText}`);
                        respHeaders.forEach(h => printOutput(h));
                        printOutput('');
                    }
                    // mostrar body (limitado)
                    const maxPreview = 2000;
                    if (body.length > maxPreview) {
                        printOutput(body.slice(0, maxPreview) + '\n... (truncated)');
                    } else {
                        printOutput(body);
                    }
                } finally { stopBusy(); } })();
                break;

        case 'date':
            response = new Date().toString();
            break;

        case 'traceroute':
            (async () => { startBusy(); try {
                const host = args[1];
                if (!host) {
                    printOutput('Uso: traceroute <host> [-m max_hops] [-q probes] [-i ms]');
                    printOutput('Ejemplo:');
                    printOutput('  traceroute ejemplo.com');
                    printOutput('  traceroute ejemplo.com -m 20 -q 3 -i 500');
                    return;
                }

                // defaults
                let maxHops = 30;
                let probes = 3;
                let interval = 500;
                for (let i = 2; i < args.length; i++) {
                    const a = args[i];
                    if ((a === '-m' || a === '--max-hops') && args[i+1]) {
                        const v = parseInt(args[i+1], 10); if (!isNaN(v) && v > 0) maxHops = v; i++;
                    }
                    if ((a === '-q' || a === '--probes') && args[i+1]) {
                        const v = parseInt(args[i+1], 10); if (!isNaN(v) && v > 0) probes = v; i++;
                    }
                    if ((a === '-i' || a === '--interval') && args[i+1]) {
                        const v = parseInt(args[i+1], 10); if (!isNaN(v) && v > 0) interval = v; i++;
                    }
                }

                // seeded RNG per host for consistent hop simulation
                function makeRng(seed) { let s = seed >>> 0; return function() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
                let seed = 0; for (let i = 0; i < host.length; i++) seed = (seed * 31 + host.charCodeAt(i)) >>> 0;
                const rng = makeRng(seed || 2166136261);

                printOutput(`traceroute to ${host}, ${maxHops} hops max, ${probes} probes per hop`);

                // decide ttl at which destination is reached (somewhere before maxHops)
                const destTtl = 3 + Math.floor(rng() * Math.max(1, Math.min(10, Math.floor(maxHops/2))));
                let reached = false;

                // allow Ctrl+C to stop traceroute
                let running = true;
                const onKeyDown = (ev) => { if (ev.ctrlKey && (ev.key === 'c' || ev.key === 'C')) { running = false; printOutput('^C'); } };
                document.addEventListener('keydown', onKeyDown);

                try {
                    for (let ttl = 1; ttl <= maxHops && running && !reached; ttl++) {
                        const hopAddrs = [];
                        const hopNames = [];
                        const hopTimes = [];
                        for (let p = 0; p < probes; p++) {
                            // small delay between probes to simulate real traceroute pace
                            await new Promise(r => setTimeout(r, 40));

                            // derive per-probe RNG from seed + ttl + p
                            const probeSeed = (seed ^ ttl ^ (p<<8)) >>> 0;
                            const prng = makeRng(probeSeed);

                            // simulate possible timeout
                            const lost = prng() < 0.08; // 8% packet loss at hop
                            if (lost) {
                                hopAddrs.push(null);
                                hopNames.push(null);
                                hopTimes.push(null);
                                continue;
                            }

                            // simulate an IP for the hop
                            const o1 = 10 + Math.floor(prng() * 240);
                            const o2 = 0 + Math.floor(prng() * 256);
                            const o3 = 0 + Math.floor(prng() * 256);
                            const o4 = 1 + Math.floor(prng() * 254);
                            const ip = `${o1}.${o2}.${o3}.${o4}`;
                            hopAddrs.push(ip);
                            // sometimes provide a resolved name
                            const hasName = prng() < 0.6;
                            hopNames.push(hasName ? `host-${o1}-${o2}.isp.local` : null);

                            // RTT simulated grows with ttl slightly
                            const base = 5 + ttl * (2 + prng() * 4);
                            const jitter = (prng() - 0.5) * 10;
                            const rtt = Math.max(1, base + jitter + (prng() < 0.03 ? 50 + prng()*200 : 0));
                            hopTimes.push(rtt.toFixed(2));
                        }

                        // print one line summarizing hop
                        let line = `${ttl} `;
                        // pick first non-null addr for display name/ip
                        const displayIdx = hopAddrs.findIndex(a=>a!==null);
                        if (displayIdx === -1) {
                            line += '*';
                        } else {
                            const name = hopNames[displayIdx];
                            const ip = hopAddrs[displayIdx];
                            if (name) line += `${name} (${ip}) `; else line += `${ip} `;
                            // append times for each probe
                            for (let p = 0; p < probes; p++) {
                                if (hopTimes[p] === null) line += ' *'; else line += ` ${hopTimes[p]} ms`;
                            }
                        }
                        printOutput(line);

                        // small wait before next hop to let UI update
                        await new Promise(r => setTimeout(r, interval));

                        // determine if destination reached at this ttl
                        if (ttl >= destTtl && rng() < 0.9) {
                            // show final destination line if some probe reached
                            const destIp = hopAddrs.find(a=>a!==null) || (`192.0.2.${10 + ttl}`);
                            printOutput(`${ttl+1} ${host} (${destIp}) 0.12 ms`);
                            reached = true;
                            break;
                        }
                    }
                } finally {
                    document.removeEventListener('keydown', onKeyDown);
                }
            } finally { stopBusy(); } })();
            break;

        case 'pathping':
            (async () => { startBusy(); try {
                const host = args[1];
                if (!host) {
                    printOutput('Uso: pathping <host> [-m max_hops] [-q probes] [-p-perhop] [-i ms]');
                    printOutput('Descripción: Ejecuta un traceroute simulado y luego pings a cada hop para obtener pérdida y RTT.');
                    printOutput('Ejemplo:');
                    printOutput('  pathping ejemplo.com');
                    printOutput('  pathping ejemplo.com -m 20 -q 3 -p 8 -i 200');
                    return;
                }

                // defaults
                let maxHops = 30;
                let probes = 3; // for traceroute probes per hop
                let perHopPings = 8; // number of pings to send to each hop
                let interval = 500; // wait between traceroute hops
                for (let i = 2; i < args.length; i++) {
                    const a = args[i];
                    if ((a === '-m' || a === '--max-hops') && args[i+1]) { const v = parseInt(args[i+1],10); if (!isNaN(v) && v>0) maxHops = v; i++; }
                    if ((a === '-q' || a === '--probes') && args[i+1]) { const v = parseInt(args[i+1],10); if (!isNaN(v) && v>0) probes = v; i++; }
                    if ((a === '-p' || a === '--perhop') && args[i+1]) { const v = parseInt(args[i+1],10); if (!isNaN(v) && v>0) perHopPings = v; i++; }
                    if ((a === '-i' || a === '--interval') && args[i+1]) { const v = parseInt(args[i+1],10); if (!isNaN(v) && v>0) interval = v; i++; }
                }

                // helper RNG
                function makeRng(seed) { let s = seed >>> 0; return function() { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
                let seed = 0; for (let i = 0; i < host.length; i++) seed = (seed * 31 + host.charCodeAt(i)) >>> 0;
                const rng = makeRng(seed || 2166136261);

                printOutput(`pathping to ${host} (simulado) — traceroute + ping por hop`);

                // 1) Simular traceroute y recolectar hops (primer IP por hop)
                const hops = []; // array of {ttl, ip, name}
                const destTtl = 3 + Math.floor(rng() * Math.max(1, Math.min(10, Math.floor(maxHops/2))));
                let reached = false;
                for (let ttl = 1; ttl <= maxHops && !reached; ttl++) {
                    const hopAddrs = [];
                    for (let p = 0; p < probes; p++) {
                        // small delay between probes
                        await new Promise(r => setTimeout(r, 30));
                        const probeSeed = (seed ^ ttl ^ (p<<8)) >>> 0;
                        const prng = makeRng(probeSeed);
                        const lost = prng() < 0.08;
                        if (lost) { hopAddrs.push(null); continue; }
                        const o1 = 10 + Math.floor(prng() * 240);
                        const o2 = 0 + Math.floor(prng() * 256);
                        const o3 = 0 + Math.floor(prng() * 256);
                        const o4 = 1 + Math.floor(prng() * 254);
                        const ip = `${o1}.${o2}.${o3}.${o4}`;
                        hopAddrs.push(ip);
                    }
                    const first = hopAddrs.find(a=>a!==null) || null;
                    if (!first) {
                        printOutput(`${ttl} *`);
                        hops.push({ ttl, ip: null, name: null });
                    } else {
                        const hasName = (Math.random() < 0.6);
                        const name = hasName ? `node-${first.replace(/\./g,'-')}.isp.local` : null;
                        printOutput(`${ttl} ${name ? name + ' ('+first+')' : first}`);
                        hops.push({ ttl, ip: first, name });
                    }

                    await new Promise(r => setTimeout(r, interval));

                    if (ttl >= destTtl && rng() < 0.9) { reached = true; }
                }

                // 2) Para cada hop con IP, simular pings y reportar estadísticas
                printOutput('');
                printOutput('Calculando estadísticas por hop (simulado)...');
                for (let hi = 0; hi < hops.length; hi++) {
                    const h = hops[hi];
                    if (!h.ip) {
                        printOutput(`${h.ttl}	*	(no responde)`);
                        continue;
                    }
                    // Simular perHopPings pings al hop
                    let transmitted = 0, received = 0;
                    const rtts = [];
                    for (let k = 0; k < perHopPings; k++) {
                        transmitted++;
                        await new Promise(r => setTimeout(r, Math.max(20, Math.floor(rng()*80))));
                        const probeSeed = (seed ^ h.ttl ^ (k<<16)) >>> 0;
                        const prng = makeRng(probeSeed);
                        if (prng() < 0.12) {
                            // lost
                        } else {
                            received++;
                            const base = 5 + h.ttl * (2 + prng()*4);
                            const jitter = (prng() - 0.5) * 10;
                            const rtt = Math.max(1, base + jitter + (prng() < 0.02 ? 50 + prng()*200 : 0));
                            rtts.push(rtt);
                        }
                    }
                    const loss = transmitted>0? ((transmitted-received)/transmitted)*100 : 0;
                    let min = 0, max = 0, avg = 0;
                    if (rtts.length>0) {
                        min = Math.min(...rtts); max = Math.max(...rtts); avg = rtts.reduce((a,b)=>a+b,0)/rtts.length;
                    }
                    printOutput(`${h.ttl}	${h.ip}	${transmitted} tx, ${received} rx, ${loss.toFixed(1)}% loss	 rtt min/avg/max = ${min.toFixed(2)}/${avg.toFixed(2)}/${max.toFixed(2)} ms`);
                }

                printOutput('Pathping (simulado) finalizado.');
            } finally { stopBusy(); } })();
            break;

        case 'ipconfig':
            (async () => {
                // Generar datos de red simulados
                // IP privada: elegir entre 192.168.x.y, 10.x.x.x o 172.16-31.x.x
                function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
                const choice = randInt(0,2);
                let ip = '';
                if (choice === 0) {
                    ip = `192.168.${randInt(0,255)}.${randInt(2,254)}`;
                } else if (choice === 1) {
                    ip = `10.${randInt(0,255)}.${randInt(0,255)}.${randInt(2,254)}`;
                } else {
                    ip = `172.${randInt(16,31)}.${randInt(0,255)}.${randInt(2,254)}`;
                }

                // máscara y gateway
                const mask = '255.255.255.0';
                const gateway = ip.split('.').slice(0,3).concat(['1']).join('.');

                // MAC simulada (local administrada -> segundo least-significant bit set)
                function genMac() {
                    const octets = [];
                    octets.push('02'); // locally administered
                    for (let i=0;i<5;i++) {
                        let v = randInt(0,255).toString(16);
                        if (v.length===1) v = '0'+v;
                        octets.push(v);
                    }
                    return octets.join(':').toUpperCase();
                }
                const mac = genMac();

                // DHCP server and DNS
                const dhcp = gateway;
                const dns = ['8.8.8.8','1.1.1.1'];

                const now = new Date();
                const leaseObtained = now.toString();
                const leaseExpires = new Date(now.getTime() + 24*60*60*1000).toString();

                printOutput('Configuración IP simulada');
                printOutput('');
                printOutput('Adaptador Ethernet0:');
                printOutput(`   Dirección IPv4: ${ip}`);
                printOutput(`   Máscara de subred: ${mask}`);
                printOutput(`   Puerta de enlace predeterminada: ${gateway}`);
                printOutput(`   Servidor DHCP: ${dhcp}`);
                printOutput(`   Servidores DNS: ${dns.join(', ')}`);
                printOutput(`   Dirección física (MAC): ${mac}`);
                printOutput(`   Tiempo de concesión DHCP: ${leaseObtained} -> ${leaseExpires}`);
            })();
            break;

        case 'flushdns':
            (async () => {
                // Soporta:
                //  - flushdns                : busca y elimina claves con patrones DNS comunes
                //  - flushdns <clave>        : elimina la clave exacta si existe
                //  - flushdns --all | -a     : modo agresivo, elimina todas las claves que contengan 'dns' (case-insensitive)
                //  - flushdns --list         : lista las claves que coinciden, NO elimina nada
                try {
                    let keyArg = args[1] || null;
                    const aggressive = args.includes('--all') || args.includes('-a');
                    const listOnly = args.includes('--list');
                    // si el primer arg es una bandera, ignorarlo como clave
                    if (keyArg === '--all' || keyArg === '-a' || keyArg === '--list') keyArg = null;

                    // Caso: eliminar/listar clave concreta
                    if (keyArg) {
                        try {
                            const exists = localStorage.getItem(keyArg) !== null;
                            if (listOnly) {
                                if (exists) printOutput(`Clave encontrada: ${keyArg}`);
                                else printOutput(`Clave no encontrada: ${keyArg}`);
                            } else {
                                if (exists) { localStorage.removeItem(keyArg); printOutput(`Clave eliminada: ${keyArg}`); }
                                else printOutput(`Clave no encontrada en localStorage: ${keyArg}`);
                            }
                        } catch (e) {
                            printOutput('Error al acceder a localStorage: ' + (e && e.message ? e.message : String(e)));
                        }
                        return;
                    }

                    // Caso: modo agresivo (--all/-a) -> buscar todas las claves que contengan 'dns'
                    if (aggressive) {
                        const found = [];
                        for (let i = 0; i < localStorage.length; i++) {
                            const k = localStorage.key(i);
                            if (!k) continue;
                            if (k.toLowerCase().includes('dns')) found.push(k);
                        }
                        if (found.length === 0) {
                            printOutput('No se encontraron claves que contengan "dns" en localStorage.');
                            return;
                        }
                        if (listOnly) {
                            printOutput(`Claves que coinciden (no se borrará nada):`);
                            found.forEach(k => printOutput(`  ${k}`));
                            return;
                        }
                        for (const k of found) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
                        printOutput(`Se eliminaron ${found.length} claves que contenían 'dns':`);
                        found.forEach(k => printOutput(`  ${k}`));
                        return;
                    }

                    // Comportamiento por defecto (sin argumentos):
                    // - si se solicitó --list (sin args) => LISTAR TODAS las claves de localStorage
                    // - si no se solicitó --list => buscar claves por patrones comunes y eliminarlas
                    if (listOnly) {
                        // listar todas las claves del localStorage (solo nombres)
                        const allKeys = [];
                        for (let i = 0; i < localStorage.length; i++) {
                            const k = localStorage.key(i);
                            if (k) allKeys.push(k);
                        }
                        if (allKeys.length === 0) {
                            printOutput('localStorage está vacío.');
                            return;
                        }
                        printOutput('Claves en localStorag:');
                        allKeys.forEach(k => printOutput(`  ${k}`));
                        return;
                    }

                    const toCheck = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = localStorage.key(i);
                        if (!k) continue;
                        const lk = k.toLowerCase();
                        // patrones comunes y también incluir cualquier clave que contenga 'dns'
                        if (lk === 'dnscache' || lk === 'dnsmap' || lk === 'dns-cache' || lk.startsWith('dns:') || lk.startsWith('dns_') || lk.includes('dns_cache') || lk.includes('dns:') || lk.includes('dns')) {
                            toCheck.push(k);
                        }
                    }
                    if (toCheck.length === 0) {
                        printOutput('No se encontraron entradas DNS en localStorage (patrones comunes).');
                        return;
                    }
                    if (listOnly) {
                        printOutput('Claves encontradas (no se borrará nada):');
                        toCheck.forEach(k => printOutput(`  ${k}`));
                        return;
                    }
                    for (const k of toCheck) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
                    printOutput(`Se eliminaron ${toCheck.length} entradas DNS de localStorage:`);
                    toCheck.forEach(k => printOutput(`  ${k}`));
                } catch (e) {
                    printOutput('Error al acceder a localStorage: ' + (e && e.message ? e.message : String(e)));
                }
            })();
            break;

        case 'tree':
            (async () => {
                // tree [ruta] [-L profundidad] [-a]
                // Implementación basada en un sistema de archivos simulado disponible en `window.SIM_FS`.
                // Si `SIM_FS` no existe, usamos una estructura por defecto basada en el proyecto.
                const parseArgs = () => {
                    let pathArg = null;
                    let maxDepth = Infinity;
                    let showHidden = false;
                    for (let i = 1; i < args.length; i++) {
                        const a = args[i];
                        if (a === '-a') { showHidden = true; continue; }
                        if (a === '-L' && args[i+1]) { const v = parseInt(args[i+1],10); if (!isNaN(v) && v>=0) { maxDepth = v; } i++; continue; }
                        if (!pathArg) pathArg = a;
                    }
                    if (!pathArg) pathArg = '.';
                    return { pathArg, maxDepth, showHidden };
                };

                const { pathArg, maxDepth, showHidden } = parseArgs();

                const defaultFs = () => ({
                    'lan-01.html': null,
                    'README.md': null,
                    'assets': {
                        'img': {
                            'fondo.webp': null
                        }
                    },
                    'js': {
                        'commandline.js': null,
                        'bg-menu.js': null,
                        'lan-windows-01.js': null
                    },
                    'pages': {
                        'editorArchivo.html': null,
                        'exploradorArchivos.html': null,
                        'lineaComandos.html': null,
                        'navegador.html': null
                    },
                    'style': {
                        'commandline.css': null,
                        'lan-01.css': null
                    }
                });

                const fsRoot = (typeof window !== 'undefined' && window.SIM_FS) ? window.SIM_FS : defaultFs();

                function resolvePath(root, p) {
                    if (!p || p === '.' || p === './') return { node: root, name: '.' };
                    // normalize leading slash
                    if (p.startsWith('/')) p = p.slice(1);
                    const parts = p.split('/').filter(Boolean);
                    let cur = root;
                    for (const part of parts) {
                        if (cur && typeof cur === 'object' && cur.hasOwnProperty(part)) {
                            cur = cur[part];
                        } else {
                            return { node: null, name: part };
                        }
                    }
                    return { node: cur, name: parts[parts.length-1] || '.' };
                }

                function printTree(node, name, prefix, depth, maxDepth) {
                    const isDir = node && typeof node === 'object';
                    const line = prefix + name + (isDir ? '/' : '');
                    printOutput(line);
                    if (!isDir) return;
                    if (depth >= maxDepth) return;
                    const keys = Object.keys(node).sort((a,b)=>{
                        const aIsDir = node[a] && typeof node[a] === 'object';
                        const bIsDir = node[b] && typeof node[b] === 'object';
                        if (aIsDir !== bIsDir) return aIsDir? -1: 1;
                        return a.localeCompare(b);
                    });
                    for (let i = 0; i < keys.length; i++) {
                        const k = keys[i];
                        if (!showHidden && k.startsWith('.')) continue;
                        const child = node[k];
                        const isLast = (i === keys.length - 1);
                        const nextPrefix = prefix + (isLast ? '└── ' : '├── ');
                        printTree(child, k, nextPrefix, depth + 1, maxDepth);
                    }
                }

                try {
                    const { node, name } = resolvePath(fsRoot, pathArg);
                    if (!node) { printOutput(`Ruta no encontrada o no accesible: ${pathArg}`); return; }

                    // si la ruta es un archivo, mostrarlo directamente
                    if (!(node && typeof node === 'object')) {
                        printOutput(name);
                        return;
                    }

                    printOutput(pathArg === '.' ? '.' : pathArg + '/');
                    const keys = Object.keys(node).sort();
                    for (let i = 0; i < keys.length; i++) {
                        const k = keys[i];
                        if (!showHidden && k.startsWith('.')) continue;
                        const child = node[k];
                        const isLast = (i === keys.length - 1);
                        const prefix = isLast ? '└── ' : '├── ';
                        printTree(child, k, prefix, 1, maxDepth);
                    }
                } catch (e) {
                    printOutput('Error generando árbol: ' + (e && e.message ? e.message : String(e)));
                }
            })();
            break;

        case 'whoami':
            response = "user";
            break;

        case 'clear':
            // Caso especial: limpiamos todo y retornamos para no imprimir nada más
            // Usar textContent para evitar parseo HTML y mantener la estructura del DOM
            output.textContent = "Bienvenido al Simulador. Escriba 'help' para comenzar.";
            return;

        default:
            response = `Orden no encontrada: ${mainCommand}`;
            break;
    }

    // Imprimir la respuesta del sistema
    if (response) {
        printOutput(response);
    }
}

function printOutput(text) {
    // Añadimos la línea como nodos de texto para no forzar re-parsing
    try {
        output.appendChild(document.createTextNode('\n' + text));
    } catch (e) {
        // fallback seguro
        output.innerHTML += `\n${text}\n`;
    }
    // mantener la terminal visible conforme llegan líneas nuevas
    // Asegurar scroll al final después de que el navegador haya hecho reflow.
    // Usamos requestAnimationFrame y un setTimeout como fallback para cubrir distintos navegadores.
    try {
        const terminalWindow = document.getElementById('terminal-window');
        requestAnimationFrame(() => {
            try { terminalWindow.scrollTop = terminalWindow.scrollHeight; } catch (e) {}
            // respaldo: asegurar con un pequeño timeout
            setTimeout(() => {
                try { terminalWindow.scrollTop = terminalWindow.scrollHeight; } catch (e) {}
            }, 0);
        });
    } catch (e) { /* ignore if DOM not ready */ }
}

function scrollToBottom() {
    const terminalWindow = document.getElementById('terminal-window');
    terminalWindow.scrollTop = terminalWindow.scrollHeight;
    // Opcional: Scroll de toda la página si la terminal ocupa todo
    window.scrollTo(0, document.body.scrollHeight);
}

// Autocompletion helpers
const AVAILABLE_COMMANDS = ['help','ping','flushdns','tree','curl','traceroute','pathping','ipconfig','date','clear','whoami'];

// History for Up/Down navigation
const CMD_HISTORY = [];
let historyIndex = -1; // points to next insertion index; up/down will modify

// State for cycling Tab suggestions
let lastCandidates = [];
let cycleIndex = -1;
let lastCompletionToken = '';

function flattenFs(root, prefix = '') {
    const out = [];
    if (!root || typeof root !== 'object') return out;
    for (const k of Object.keys(root)) {
        const val = root[k];
        const entryPath = prefix + k;
        if (val && typeof val === 'object') {
            out.push({ path: entryPath + '/', isDir: true, size: 0 });
            const child = flattenFs(val, entryPath + '/');
            out.push(...child);
        } else {
            // simulate a size for files (random but stable could be added later)
            const size = (k.length * 37) % 4096 + 64; // deterministic-ish pseudo-size
            out.push({ path: entryPath, isDir: false, size });
        }
    }
    return out;
}

function getFsCandidates() {
    try {
        if (typeof window !== 'undefined' && window.SIM_FS) {
            return flattenFs(window.SIM_FS, '');
        }
    } catch (e) {}
    // fallback: a lightweight list based on project layout (as objects)
    return [
        { path: 'lan-01.html', isDir: false, size: 1024 },{ path: 'README.md', isDir: false, size: 800 },
        { path: 'assets/', isDir: true, size: 0 },{ path: 'assets/img/', isDir: true, size: 0 },{ path: 'assets/img/fondo.webp', isDir: false, size: 20480 },
        { path: 'js/', isDir: true, size: 0 },{ path: 'js/commandline.js', isDir: false, size: 18000 },{ path: 'js/bg-menu.js', isDir: false, size: 2400 },{ path: 'js/lan-windows-01.js', isDir: false, size: 2800 },
        { path: 'pages/', isDir: true, size: 0 },{ path: 'pages/lineaComandos.html', isDir: false, size: 2200 },{ path: 'pages/navegador.html', isDir: false, size: 1400 },{ path: 'pages/exploradorArchivos.html', isDir: false, size: 1200 },{ path: 'pages/editorArchivo.html', isDir: false, size: 1300 },
        { path: 'style/', isDir: true, size: 0 },{ path: 'style/commandline.css', isDir: false, size: 800 },{ path: 'style/lan-01.css', isDir: false, size: 980 }
    ];
}

function commonPrefix(arr) {
    if (!arr || arr.length === 0) return '';
    let prefix = arr[0];
    for (let s of arr) {
        while (!s.startsWith(prefix)) {
            prefix = prefix.slice(0, -1);
            if (prefix === '') return '';
        }
    }
    return prefix;
}
