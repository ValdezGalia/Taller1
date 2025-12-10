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
        });
    });
});


