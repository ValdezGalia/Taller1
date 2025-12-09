// Helpers for lan-01: taskbar, toasts and small UI utilities.
// This file centralizes creation of the taskbar and toast container and
// exposes small APIs as globals so the main windows script can remain
// focused on behavior.

(function () {
     const taskbar = document.createElement('div');
    taskbar.id = 'app-taskbar';
    taskbar.className = 'app-taskbar';

    const taskbarLeft = document.createElement('div');
    taskbarLeft.className = 'taskbar-left';
    const taskbarRight = document.createElement('div');
    taskbarRight.className = 'taskbar-right';

    const footerEl = document.querySelector('footer');
    if (footerEl) {
        const prevFooterHtml = footerEl.innerHTML || '';
        footerEl.innerHTML = '';
        footerEl.appendChild(taskbar);
        taskbar.appendChild(taskbarLeft);
        taskbar.appendChild(taskbarRight);
        // preserve previous footer html for later reinsertion by main script
        taskbar._savedFooterHtml = prevFooterHtml;
    } else {
        document.body.appendChild(taskbar);
        taskbar.appendChild(taskbarLeft);
        taskbar.appendChild(taskbarRight);
    }

    // Toast container
    const toastContainer = document.createElement('div');
    toastContainer.id = 'app-toast-container';
    toastContainer.className = 'app-toast-container';
    document.body.appendChild(toastContainer);

    const showToast = (msg, timeout = 2500) => {
        const t = document.createElement('div');
        t.className = 'app-toast';
        t.textContent = msg;
        toastContainer.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => {
            t.classList.remove('show');
            setTimeout(() => t.remove(), 300);
        }, timeout);
    };

    // Optional navigation hint about multi-instance behavior
    const navContainer = document.getElementById('app-navigation');
    if (navContainer) {
        const hint = document.createElement('div');
        hint.className = 'instance-hint';
        // value for MAX_INSTANCES is not available here; leave a generic hint
        hint.textContent = `Shift+Click para abrir nueva instancia`;
        navContainer.appendChild(hint);
    }

    // Export to window so the main script can use them without duplicating code
    window.taskbar = taskbar;
    window.taskbarLeft = taskbarLeft;
    window.taskbarRight = taskbarRight;
    window.toastContainer = toastContainer;
    window.showToast = showToast;
})(); 