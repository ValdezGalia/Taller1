const ruta = document.getElementById('file-path');
const archivo = document.getElementById('file-upload');
const abrir = document.getElementById('open-button');
const guardar = document.getElementById('save-button');
const cerrar = document.getElementById('close-button');     

archivo.addEventListener('change', (e) => {
    const etiqueta = e.target;
    const archivos = etiqueta.files;
    const nombre = archivos[0].name;
    const rutaf = "/drivers/etc/hosts/" + nombre;   
    ruta.value = rutaf;
}); 

abrir.addEventListener('click', () => {
    archivo.click();
    
});




archivo.addEventListener('change', (e) => {
    const etiqueta = e.target;
    const archivos = etiqueta.files;
    const contenido = archivos[0];
    const lector = new FileReader();
    lector.onload = function(event) {
        const texto = event.target.result;
        const Texto = document.getElementById('editor-content');
        Texto.value = texto;
        Texto.disabled = false;
        guardar.disabled = false; 
    };  
    
    lector.readAsText(contenido);
});


guardar.addEventListener('click', () => {
    const contenido = document.getElementById('editor-content').value;
    Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([contenido])),
        download: "archivo_editado.txt"
    }).click();
}); 

/*
cerrar.addEventListener('click', () => {
    const contenido = document.getElementById('editor-content');

});
*/