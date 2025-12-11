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
    const browserViewport = document.getElementById('browser-viewport');

    browserViewport.style.display = 'block';

    // crea la barra de búsqueda de la pestaña
    const tabBar = document.createElement('div');
    tabBar.className = 'tab-browser-bar';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'https... o nombre de pagina';
    input.value = url;
    input.className = 'tab-input';

    const button = document.createElement('button');
    button.textContent = 'Ir';
    button.id = 'tab-go';

    const label = document.createElement('span');
    label.textContent = 'Introduce la URL';
    label.className = 'tab-label';
    tabBar.appendChild(label);

    tabBar.appendChild(input);
    tabBar.appendChild(button);

    // crea elemento de pestaña
    const li = document.createElement('li');
    li.className = 'tab';
    li.dataset.url = url;
    tabsList.appendChild(li);

    // nombre de la pestaña
    const titleSpan = document.createElement('span');
    titleSpan.textContent = url || 'Nueva pestaña';
    li.appendChild(titleSpan);

        // crea botón de cerrar pestaña
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.className = 'tab-close';
    closeBtn.style.marginLeft = '4px'; // pequeño espacio
    li.appendChild(closeBtn);

    li.addEventListener('click', () => switchTab(li, tabBar, input));

    tabs.push({ tab: li, bar: tabBar, input });

    // maneja el boton de ir y de enter
    button.addEventListener('click', () => loadURL(li, input.value.trim()));
    input.addEventListener('keydown', (e) => { if(e.key==='Enter') loadURL(li, input.value.trim()); });

    switchTab(li, tabBar, input);


    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // que no active switchTab
      // elimina de DOM y del array
      tabsList.removeChild(li);
      tabs = tabs.filter(t => t.tab !== li);
      if(tabs.length === 0) {
          // no quedan pestañas: limpiar pantalla
          tabUrlContainer.innerHTML = '';
          pageFrame.src = '';
          emptyState.style.display = 'block';
          browserViewport.style.display = 'none';
          logOutput.textContent = 'Esperando solicitud...';
          activeTab = null;
    } else if(activeTab.tab === li) {
        // activa la primera pestaña restante
        switchTab(tabs[0].tab, tabs[0].bar, tabs[0].input);
    }
      if(activeTab.tab === li && tabs.length) {
          switchTab(tabs[0].tab, tabs[0].bar, tabs[0].input);
      } else if(tabs.length === 0) {
          pageFrame.src = '';
          emptyState.style.display = 'block';
          logOutput.textContent = 'Esperando solicitud...';
      }
    });
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

const isAbsoluteUrl = (u) => /^https?:\/\//i.test(u);

const loadURL = (tabLi, raw) => {
  if (!raw) return;
  let url = raw.trim();
  let inicio = "https://";

  if (!isAbsoluteUrl(url)) {
    inicio += url + '.com';
    url = inicio;
  }

  pageFrame.src = url;
  emptyState.style.display = 'none';
  logOutput.textContent = `Cargando: ${url}`;
  tabLi.dataset.url = url;
  activeTab.input.value = url;

  activeTab.tab.querySelector('span').textContent = url.split('/').pop();

};



  newTabButton.addEventListener('click', () => createTab());

  createTab(); // primera pestaña al inicio
})();
