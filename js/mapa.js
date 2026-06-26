import { db, auth } from "./firebase-config.js";
import { doc, getDoc, deleteDoc, updateDoc, arrayUnion, arrayRemove, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Capturar elementos del DOM
const navUsername = document.getElementById("nav-username");
const footerAvatar = document.getElementById("footer-avatar");
const viajeTitulo = document.getElementById("viaje-titulo");
const viajeFechas = document.getElementById("viaje-fechas");
const viajeCiudadCompleta = document.getElementById("viaje-ciudad-completa");
const galeriaFotos = document.getElementById("galeria-fotos");
const btnEliminar = document.getElementById("btn-eliminar-viaje");
const inputSubirFoto = document.getElementById("input-subir-foto");

// Elementos del Dialog de Zoom
const zoomModal = document.getElementById("zoom-modal");
const zoomImg = document.getElementById("zoom-img");
const btnCloseZoom = document.getElementById("btn-close-zoom");

// Elementos del Dialog de Confirmación de Borrado
const borrarModal = document.getElementById("confirmar-borrado-modal");
const btnCancelarBorrado = document.getElementById("btn-cancelar-borrado");
const btnConfirmarBorrado = document.getElementById("btn-confirmar-borrado");

const fotoModal = document.getElementById("confirmar-foto-modal");
const btnCancelarFoto = document.getElementById("btn-cancelar-foto");
const btnConfirmarFoto = document.getElementById("btn-confirmar-foto");

// Variable global temporal para saber qué foto está en proceso de borrado
let fotoSeleccionadaParaBorrar = null;

// Recuperar ID del LocalStorage
const viajeId = localStorage.getItem("viajeActivoId");

// GUARDIÁN DE SEGURIDAD
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else if (!viajeId) {
        window.location.href = "grupo.html";
    } else {
        await cargarDatosBaseUsuario(user.uid);
        await cargarDatosDelViaje();
    }
});

// Cargar datos del perfil del usuario (Nav y Footer)
async function cargarDatosBaseUsuario(uid) {
    try {
        const userDocRef = doc(db, "usuarios", uid);
        const userDocSnap = await getDoc(userDocRef);
        if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            navUsername.textContent = `@${userData.username}`;
            if (userData.fotoPerfil) footerAvatar.src = userData.fotoPerfil;
        }
    } catch (error) {
        console.error("Error al cargar datos del navbar/footer:", error);
    }
}

// Cargar textos del viaje
async function cargarDatosDelViaje() {
    try {
        const viajeRef = doc(db, "viajes", viajeId);
        const viajeSnap = await getDoc(viajeRef);

        if (!viajeSnap.exists()) {
            viajeTitulo.textContent = "El viaje no existe o ha sido borrado.";
            return;
        }

        const viajeData = viajeSnap.data();
        viajeTitulo.textContent = viajeData.nombreViaje || viajeData.ciudad;
        
        const formatearFecha = (f) => f ? f.split("-").reverse().join("/") : "";
        viajeFechas.textContent = `📅 Del ${formatearFecha(viajeData.fechaIda)} al ${formatearFecha(viajeData.fechaVuelta)}`;
        viajeCiudadCompleta.textContent = `📍 ${viajeData.ciudadCompleta}`;

        await cargarFotosDelViaje();

    } catch (error) {
        console.error("Error al estructurar los datos del viaje:", error);
    }
}

// Renderizar las fotos y configurar eventos (Zoom y Eliminar Individual)
async function cargarFotosDelViaje() {
    galeriaFotos.innerHTML = "";
    try {
        const fotosDocRef = doc(db, "viajes_fotos", viajeId);
        const fotosSnap = await getDoc(fotosDocRef);

        if (fotosSnap.exists() && fotosSnap.data().fotos?.length > 0) {
            const listaFotos = fotosSnap.data().fotos;
            
            listaFotos.forEach(fotoBase64 => {
                // 1. Creamos el contenedor de la tarjeta
                const wrapper = document.createElement("div");
                wrapper.classList.add("foto-wrapper");

                // 2. Creamos la imagen
                const imgElement = document.createElement("img");
                imgElement.src = fotoBase64;
                imgElement.classList.add("foto-item");
                imgElement.alt = "Foto de la cuadrilla";

                // Evento para abrir el zoom al pulsar en la foto
                imgElement.addEventListener("click", () => {
                    zoomImg.src = fotoBase64;
                    zoomModal.showModal();
                });

                // 3. ¡AQUÍ SE CREA EL BOTÓN EN EL JS!
                const btnBorrarFoto = document.createElement("button");
                btnBorrarFoto.innerHTML = "&times;"; // Esto pinta una '×' elegante
                btnBorrarFoto.classList.add("btn-borrar-foto"); // Le da el estilo CSS que pusimos
                btnBorrarFoto.title = "Eliminar foto permanentemente";
                
                // Evento para borrar esta foto concreta al pulsar la ×
                btnBorrarFoto.addEventListener("click", (e) => {
                    e.stopPropagation(); // Evita que se abra el zoom
                    
                    // Guardamos la foto actual en la variable temporal
                    fotoSeleccionadaParaBorrar = fotoBase64; 
                    
                    // Abrimos el nuevo modal
                    fotoModal.showModal();
                });

                // 4. Metemos la imagen Y el botón dentro del contenedor
                wrapper.appendChild(imgElement);
                wrapper.appendChild(btnBorrarFoto); // <--- Aquí se añade físicamente al HTML de la tarjeta
                
                // 5. Metemos la tarjeta completa en la cuadrícula de la pantalla
                galeriaFotos.appendChild(wrapper);
            });
        } else {
            galeriaFotos.innerHTML = `<p style="color: #6b7280; font-style: italic;">No se han añadido fotos para este viaje todavía.</p>`;
        }
    } catch (error) {
        console.error("Error al cargar el álbum de fotos:", error);
    }
}

// ==========================================================================
// ACCIÓN: ACCIÓN DE AÑADIR/SUBIR FOTOS NUEVAS
// ==========================================================================
inputSubirFoto.addEventListener("change", async (e) => {
    const archivos = e.target.files;
    if (!archivos || archivos.length === 0) return;

    const labelOriginal = document.querySelector("label[for='input-subir-foto']");
    labelOriginal.textContent = "Subiendo... ⏳";
    labelOriginal.style.pointerEvents = "none";

    const fotosDocRef = doc(db, "viajes_fotos", viajeId);

    try {
        // Asegurarnos de que el documento en viajes_fotos existe (por si acaso)
        const fotosSnap = await getDoc(fotosDocRef);
        if (!fotosSnap.exists()) {
            // Si el viaje no tenía fotos previas, creamos la estructura base
            await setDoc(fotosDocRef, {
                viajeId: viajeId,
                grupoId: localStorage.getItem("grupoActivoId") || "",
                fotos: []
            });
        }

        // Procesar cada archivo seleccionado
        for (const archivo of archivos) {
            const base64Str = await transformarABase64(archivo);
            
            // Inyectamos la imagen directamente en el array de Firestore de forma atómica
            await updateDoc(fotosDocRef, {
                fotos: arrayUnion(base64Str)
            });
        }

        // Limpiar el input y recargar la galería actualizada
        inputSubirFoto.value = ""; 
        await cargarFotosDelViaje();

    } catch (error) {
        console.error("Error al subir las imágenes a Firebase:", error);
        alert("Hubo un fallo al intentar guardar las fotos.");
    } finally {
        labelOriginal.textContent = "Añadir Foto 📸";
        labelOriginal.style.pointerEvents = "auto";
    }
});

// Función auxiliar para convertir File/Blob a String Base64
function transformarABase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });
}

// ==========================================================================
// ACCIÓN: ELIMINAR FOTO ESPECÍFICA
// ==========================================================================
async function eliminarFotoEspecifica(fotoBase64) {
    try {
        const fotosDocRef = doc(db, "viajes_fotos", viajeId);
        
        // Quita la cadena Base64 exacta que coincide del array en la nube
        await updateDoc(fotosDocRef, {
            fotos: arrayRemove(fotoBase64)
        });

        // Refrescar la pantalla
        await cargarFotosDelViaje();
    } catch (error) {
        console.error("Error al eliminar la foto de Firestore:", error);
        alert("No se pudo eliminar la foto.");
    }
}

// Modales del zoom
btnCloseZoom.addEventListener("click", () => { zoomModal.close(); zoomImg.src = ""; });
zoomModal.addEventListener("click", (e) => { if (e.target === zoomModal) { zoomModal.close(); zoomImg.src = ""; } });

// LÓGICA DE BORRADO EN CASCADA TOTAL CON DIALOG
// 1. Al pulsar el botón original de la pantalla, abrimos el modal personalizado
btnEliminar.addEventListener("click", () => {
    borrarModal.showModal();
});

// 2. Si el usuario pulsa "Cancelar", cerramos el modal sin hacer nada
btnCancelarBorrado.addEventListener("click", () => {
    borrarModal.close();
});

// 3. Si pulsa fuera del recuadro del modal, también se cierra
borrarModal.addEventListener("click", (e) => {
    if (e.target === borrarModal) {
        borrarModal.close();
    }
});

// 4. Si el usuario confirma que quiere destruir el viaje
btnConfirmarBorrado.addEventListener("click", async () => {
    try {
        // Modificamos el aspecto del botón de confirmación mientras procesa
        btnConfirmarBorrado.textContent = "Borrando... ⏳";
        btnConfirmarBorrado.disabled = true;
        btnCancelarBorrado.disabled = true;

        // Ejecutamos el borrado en las dos colecciones de Firebase
        await deleteDoc(doc(db, "viajes", viajeId));
        await deleteDoc(doc(db, "viajes_fotos", viajeId));

        borrarModal.close();
        window.location.href = "grupo.html";
        
    } catch (error) {
        console.error("Error al ejecutar el borrado:", error);
        alert("Hubo un fallo al intentar eliminar el viaje.");
        
        // Si falla, restauramos los botones del modal
        btnConfirmarBorrado.textContent = "Eliminar";
        btnConfirmarBorrado.disabled = false;
        btnCancelarBorrado.disabled = false;
    }
});

// LÓGICA DEL MODAL PARA ELIMINAR FOTO INDIVIDUAL

// Si pulsa "Cancelar", cerramos y limpiamos la variable
btnCancelarFoto.addEventListener("click", () => {
    fotoModal.close();
    fotoSeleccionadaParaBorrar = null;
});

// Si pulsa fuera del recuadro del modal, también se cierra
fotoModal.addEventListener("click", (e) => {
    if (e.target === fotoModal) {
        fotoModal.close();
        fotoSeleccionadaParaBorrar = null;
    }
});

// Si confirma el borrado pulsando el botón rojo del modal
btnConfirmarFoto.addEventListener("click", async () => {
    if (!fotoSeleccionadaParaBorrar) return;

    try {
        btnConfirmarFoto.textContent = "Borrando... ⏳";
        btnConfirmarFoto.disabled = true;
        btnCancelarFoto.disabled = true;

        // Llamamos a la función que ya tenías programada pasándole la variable temporal
        await eliminarFotoEspecifica(fotoSeleccionadaParaBorrar);

        // Cerramos el modal con éxito
        fotoModal.close();
        
    } catch (error) {
        console.error("Error al confirmar borrado de foto:", error);
        alert("No se pudo eliminar la foto.");
    } finally {
        // Restauramos los estados originales de los botones y la variable temporal
        btnConfirmarFoto.textContent = "Eliminar";
        btnConfirmarFoto.disabled = false;
        btnCancelarFoto.disabled = false;
        fotoSeleccionadaParaBorrar = null;
    }
});