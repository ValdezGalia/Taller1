(() => {
  const tabsList = document.getElementById('tabs-list');
  const newTabButton = document.getElementById('new-tab-button');
  const pageFrame = document.getElementById('page-frame');
  const emptyState = document.getElementById('empty-state');
  const logOutput = document.getElementById('log-output');
  const tabUrlContainer = document.getElementById('tab-url-container');

  let tabs = [];
  let activeTab = null;

  const createTab = (url = '') => {
    // crea la barra de búsqueda de la pestaña
    const tabBar = document.createElement('div');
    tabBar.className = 'tab-browser-bar';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Archivo local (.html)';
    input.value = url;
    input.className = 'tab-input';
    const button = document.createElement('button');
    button.textContent = 'Ir';
    button.className = 'tab-go';
    tabBar.appendChild(input);
    tabBar.appendChild(button);

    // crea elemento de pestaña
    const li = document.createElement('li');
    li.className = 'tab';
    li.textContent = url || 'Nueva pestaña';
    li.dataset.url = url;
    tabsList.appendChild(li);

    li.addEventListener('click', () => switchTab(li, tabBar, input));

    tabs.push({ tab: li, bar: tabBar, input });

    // maneja el boton de ir y de enter
    button.addEventListener('click', () => loadURL(li, input.value.trim()));
    input.addEventListener('keydown', (e) => { if(e.key==='Enter') loadURL(li, input.value.trim()); });

    switchTab(li, tabBar, input);
  };

  const switchTab = (tabLi, bar, input) => {
    activeTab = tabs.find(t => t.tab === tabLi);
    tabs.forEach(t => t.tab.classList.remove('active'));
    tabLi.classList.add('active');

    // Mostrar la barra de búsqueda de esta pestaña encima del iframe
    tabUrlContainer.innerHTML = '';
    tabUrlContainer.appendChild(bar);

    const url = tabLi.dataset.url;
    if(url){
      pageFrame.src = url;
      emptyState.style.display = 'none';
      logOutput.textContent = `Cargando: ${url}`;
      input.value = url;
    } else {
      pageFrame.src = '';
      emptyState.style.display = 'block';
      logOutput.textContent = 'Esperando solicitud...';
    }
  };

  const loadURL = (tabLi, raw) => {
    if(!raw) return;
    let url = raw;
    if(!raw.endsWith('.html')) url += '.html';
    pageFrame.src = url;
    emptyState.style.display = 'none';
    logOutput.textContent = `Cargando: ${url}`;
    tabLi.dataset.url = url;
    tabLi.textContent = url.split('/').pop();
    activeTab.input.value = url;
  };

  newTabButton.addEventListener('click', () => createTab());

  createTab(); // primera pestaña al inicio
})();
