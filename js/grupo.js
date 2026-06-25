// js/grupo.js
import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, getDoc, collection, addDoc, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { mostrarAlerta } from "./dialogs.js";

// Elementos de la interfaz (Nav/Footer)
const navUsername = document.getElementById("nav-username");
const footerAvatar = document.getElementById("footer-avatar");
const appLoader = document.getElementById("app-loader");

// Elementos del Grupo y Viajes
const groupNameTitle = document.getElementById("group-name-title");
const groupParticipantsCount = document.getElementById("group-participants-count");
const groupCodeBadge = document.getElementById("group-code-badge");
const tripsContainer = document.getElementById("trips-container");

// Elementos del Modal de Viajes (<dialog>)
const tripModal = document.getElementById("trip-modal");
const btnOpenTripModal = document.getElementById("btn-open-trip-modal");
const btnCloseTripModal = document.getElementById("btn-close-trip-modal");
const btnSubmitTrip = document.getElementById("btn-submit-trip");

// NUEVOS INPUTS DEL FORMULARIO
const inputTripName = document.getElementById("new-trip-name");
const inputTripCity = document.getElementById("new-trip-city");
const inputTripStartDate = document.getElementById("new-trip-start-date");
const inputTripEndDate = document.getElementById("new-trip-end-date");
const inputTripPhotos = document.getElementById("new-trip-photos");

// Variables Globales
let currentUserId = null;
let grupoActivoId = localStorage.getItem("grupoActivoId");
let mapaGeneral = null;
let marcadoresGrupo = []; // Array para limpiar/pintar pines

// GUARDIÁN DE SEGURIDAD
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
    } else if (!grupoActivoId) {
        window.location.href = "app.html";
    } else {
        currentUserId = user.uid;
        
        inicializarMapaLogros();
        await cargarDatosBaseUsuario(user.uid);
        await cargarDatosGrupoCompleto();
        
        appLoader.classList.add("hidden");
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
        console.error("Error al cargar datos base del usuario:", error);
    }
}

// Inicializar el mapa interactivo
function inicializarMapaLogros() {
    mapaGeneral = L.map('group-main-map').setView([25.0, 10.0], 2);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
        minZoom: 3
    }).addTo(mapaGeneral);
}

// Cargar información del grupo de amigos
async function cargarDatosGrupoCompleto() {
    try {
        const grupoRef = doc(db, "grupos", grupoActivoId);
        const grupoSnap = await getDoc(grupoRef);

        if (grupoSnap.exists()) {
            const grupoData = grupoSnap.data();
            groupNameTitle.textContent = grupoData.nombre;
            groupCodeBadge.textContent = grupoData.codigo;
            
            const numParticipantes = grupoData.participantes ? grupoData.participantes.length : 1;
            groupParticipantsCount.textContent = `${numParticipantes} participante(s) en la cuadrilla`;
            
            await consultarYRenderizarViajes();
        } else {
            console.error("No se encontró el documento del grupo.");
            await mostrarAlerta("No se ha podido localizar este grupo de amigos.");
            window.location.href = "app.html";
        }
    } catch (error) {
        console.error("Error al cargar datos del grupo:", error);
    }
}

// Traer viajes de Firestore y actualizar mapa + lista
async function consultarYRenderizarViajes() {
    tripsContainer.innerHTML = ""; 
    
    marcadoresGrupo.forEach(m => mapaGeneral.removeLayer(m));
    marcadoresGrupo = [];

    try {
        const q = query(collection(db, "viajes"), where("grupoId", "==", grupoActivoId));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            tripsContainer.innerHTML = `<p class="loading-text" style="color: #9ca3af; text-align: center; padding: 1.5rem; width:100%;">No hay viajes registrados en este grupo todavía. ¡Crea el primero!</p>`;
            return;
        }

        querySnapshot.forEach((viajeDoc) => {
            const viajeId = viajeDoc.id;
            const viajeData = viajeDoc.data();

            // Formatear fechas para mostrar en la tarjeta
            const formatearFechaEspañol = (fechaString) => {
                if (!fechaString) return "";
                const [año, mes, dia] = fechaString.split("-");
                return `${dia}/${mes}/${año}`;
            };

            // Formatear fechas optimizadas para mostrar en la tarjeta
            const rangoFechas = (viajeData.fechaIda && viajeData.fechaVuelta) 
                ? `${formatearFechaEspañol(viajeData.fechaIda)} - ${formatearFechaEspañol(viajeData.fechaVuelta)}` 
                : "Sin fechas registradas";

            // Generar el HTML de las fotos apiladas (Máximo 3 fotos para el efecto)
            let fotosHTML = "";
            if (viajeData.fotos && viajeData.fotos.length > 0) {
                // Tomamos un máximo de 3 imágenes para que no se sature el espacio
                const fotosAMostrar = viajeData.fotos.slice(0, 3);
                
                fotosAMostrar.forEach((fotoBase64, index) => {
                    // Les asignamos una clase según su posición (0, 1, 2) para rotarlas diferente en CSS
                    fotosHTML += `<img src="${fotoBase64}" class="stack-img img-deg-${index}" alt="Foto viaje">`;
                });
            } else {
                // Si el viaje no tiene fotos, podemos poner un icono de paisaje o cámara sutil por defecto
                fotosHTML = `
                    <div class="no-photos-placeholder">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                            <circle cx="12" cy="13" r="4"/>
                        </svg>
                    </div>`;
            }

            // Crear Tarjeta HTML del viaje con el nuevo layout de dos columnas
            const tarjetaViaje = document.createElement("div");
            tarjetaViaje.classList.add("trip-card");
            tarjetaViaje.innerHTML = `
                <div class="trip-card-info">
                    <h4 style="color: white; font-size: 1.25rem; margin:0;">${viajeData.nombreViaje || viajeData.ciudad}</h4>
                    <p style="font-size: 0.8rem; color: #3b82f6; margin-top: 0.5rem; font-weight: 600; margin-bottom: 0px">📍 ${viajeData.ciudad}</p>
                    <p style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.5rem; margin-bottom: 0px;">${rangoFechas}</p>
                </div>
                <div class="trip-photos-stack">
                    ${fotosHTML}
                </div>
            `;

            tarjetaViaje.addEventListener("click", () => {
                localStorage.setItem("viajeActivoId", viajeId);
                localStorage.setItem("viajeActivoCiudad", viajeData.ciudad);
                window.location.href = "mapa.html";
            });

            tripsContainer.appendChild(tarjetaViaje);

            if (viajeData.lat && viajeData.lng) {
                let capaGeografica;

                // Si el viaje tiene guardada la silueta real en texto
                if (viajeData.geojson) {
                    try {
                        // ¡SOLUCIÓN! Convertimos el texto plano de vuelta a objeto JS/GeoJSON
                        const geojsonObjeto = JSON.parse(viajeData.geojson);

                        capaGeografica = L.geoJSON(geojsonObjeto, {
                            style: {
                                color: '#3b82f6',       
                                fillColor: '#3b82f6',   
                                fillOpacity: 0.3,       
                                weight: 2               
                            }
                        });
                    } catch (e) {
                        console.error("Error al parsear el GeoJSON del viaje:", e);
                    }
                } 
                
                // Si no hay silueta o falló el parseo, usamos el círculo como Plan B
                if (!capaGeografica) {
                    capaGeografica = L.circle([viajeData.lat, viajeData.lng], {
                        color: '#3b82f6',
                        fillColor: '#3b82f6',
                        fillOpacity: 0.4,
                        radius: 35000,
                        weight: 2
                    });
                }

                // Añadimos popups e interactividad a la capa resultante
                capaGeografica.addTo(mapaGeneral)
                    .bindPopup(`<b style="color:#111;">${viajeData.nombreViaje || viajeData.ciudad}</b><br><span style="color:#555;">📍 ${viajeData.ciudad}</span><br><span style="color:#777; font-size:0.8rem;">${rangoFechas}</span>`);

                capaGeografica.on('mouseover', function () {
                    this.setStyle({ fillOpacity: 0.6, weight: 3 });
                });
                capaGeografica.on('mouseout', function () {
                    this.setStyle({ fillOpacity: 0.3, weight: 2 });
                });

                marcadoresGrupo.push(capaGeografica);
            }
        });

    } catch (error) {
        console.error("Error al renderizar los viajes:", error);
    }
}

// ==========================================================================
/* GESTIÓN DEL MODAL NATIVO (<DIALOG>) */
// ==========================================================================
const containerCityResults = document.getElementById("trip-city-results");

// Variable global en el archivo para guardar la ciudad que el usuario seleccionó del menú
let destinoSeleccionadoGps = null;

btnOpenTripModal.addEventListener("click", () => tripModal.showModal());

function limpiarFormularioModal() {
    inputTripName.value = "";
    inputTripCity.value = "";
    inputTripStartDate.value = "";
    inputTripEndDate.value = "";
    inputTripPhotos.value = "";
    containerCityResults.innerHTML = "";
    containerCityResults.style.display = "none";
    destinoSeleccionadoGps = null; // Resetear la selección de ubicación
}

btnCloseTripModal.addEventListener("click", () => {
    limpiarFormularioModal();
    tripModal.close();
});

// Función auxiliar para convertir las imágenes a cadenas Base64
async function procesarFotosABase64(archivos) {
    const promesas = Array.from(archivos).map(archivo => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(archivo);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    // 1. Definimos las dimensiones máximas que queremos para la miniatura
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    // Escalamiento proporcional para no deformar la imagen
                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    // 2. Creamos un canvas en memoria para redibujar la imagen comprimida
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // 3. Exportamos a Base64 reduciendo la calidad al 70% (0.7)
                    // Usamos 'image/jpeg' ya que optimiza el peso muchísimo mejor que 'image/png'
                    const dataUrlComprimida = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrlComprimida);
                };
                img.onerror = error => reject(error);
            };
            reader.onerror = error => reject(error);
        });
    });
    return Promise.all(promesas);
}

function simplificarPoligono(coords, tolerancia = 0.005) {
    if (coords.length <= 2) return coords;

    // Encuentra el punto con la distancia máxima
    let maxDist = 0;
    let index = 0;
    const end = coords.length - 1;

    for (let i = 1; i < end; i++) {
        // Distancia simplificada de un punto a una línea recta (Norte/Sur/Este/Oeste)
        const p = coords[i];
        const p1 = coords[0];
        const p2 = coords[end];
        
        // Fórmula básica de distancia punto-línea
        const num = Math.abs((p2[1] - p1[1]) * p[0] - (p2[0] - p1[0]) * p[1] + p2[0] * p1[1] - p2[1] * p1[0]);
        const den = Math.sqrt(Math.pow(p2[1] - p1[1], 2) + Math.pow(p2[0] - p1[0], 2));
        const dist = den === 0 ? 0 : num / den;

        if (dist > maxDist) {
            index = i;
            maxDist = dist;
        }
    }

    // Si la distancia máxima es mayor que la tolerancia, simplifica recursivamente
    if (maxDist > tolerancia) {
        const results1 = simplificarPoligono(coords.slice(0, index + 1), tolerancia);
        const results2 = simplificarPoligono(coords.slice(index), tolerancia);
        return results1.slice(0, results1.length - 1).concat(results2);
    } else {
        return [coords[0], coords[end]];
    }
}

// Función encargada de recorrer la estructura del GeoJSON (sea Polygon o MultiPolygon) y encogerla
function optimizarGeoJSON(geojson, tolerancia = 0.005) {
    if (!geojson || !geojson.geometry || !geojson.geometry.coordinates) return geojson;
    
    const clonGeometry = JSON.parse(JSON.stringify(geojson.geometry));
    
    if (clonGeometry.type === "Polygon") {
        clonGeometry.coordinates = clonGeometry.coordinates.map(anillo => simplificarPoligono(anillo, tolerancia));
    } else if (clonGeometry.type === "MultiPolygon") {
        clonGeometry.coordinates = clonGeometry.coordinates.map(poligono => 
            poligono.map(anillo => simplificarPoligono(anillo, tolerancia))
        );
    }
    
    return { ...geojson, geometry: clonGeometry };
}

// DETECTOR: Salta automáticamente cuando el usuario quita el foco del input de la ciudad
inputTripCity.addEventListener("blur", async () => {
    const ciudadTexto = inputTripCity.value.trim();

    // Si el campo está vacío, no hacemos nada
    if (!ciudadTexto) {
        containerCityResults.innerHTML = "";
        containerCityResults.style.display = "none";
        destinoSeleccionadoGps = null;
        return;
    }

    try {
        // Ponemos un texto temporal de carga en la caja de resultados
        containerCityResults.style.display = "block";
        containerCityResults.innerHTML = `<p style="color: #9ca3af; font-size: 0.8rem; padding: 0.75rem 1rem; margin: 0;">🔍 Buscando ubicaciones...</p>`;
        destinoSeleccionadoGps = null;

        // Consultamos la API de OpenStreetMap buscando hasta 5 coincidencias
        // Cambia la URL del fetch para pedir las siluetas (polygon_geojson=1)
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(ciudadTexto)}&limit=5&addressdetails=1&polygon_geojson=1`);
        const ciudadesEncontradas = await response.json();

        // Si no encuentra nada, avisamos al usuario directamente en el desplegable
        if (!ciudadesEncontradas || ciudadesEncontradas.length === 0) {
            containerCityResults.innerHTML = `<p style="color: #ef4444; font-size: 0.8rem; padding: 0.75rem 1rem; margin: 0;">❌ No se encontraron resultados. Revisa el nombre.</p>`;
            return;
        }

        // Limpiamos el texto de "Buscando..." para renderizar los botones reales
        containerCityResults.innerHTML = "";

        // Si solo hay un resultado, lo autoseleccionamos para ahorrarle clicks al usuario
        if (ciudadesEncontradas.length === 1) {
            marcarCiudadComoSeleccionada(ciudadesEncontradas[0]);
            return;
        }

        // Si hay múltiples resultados (Duplicados), creamos la lista interactiva
        ciudadesEncontradas.forEach((lugar) => {
            const itemSeleccion = document.createElement("button");
            itemSeleccion.type = "button";
            itemSeleccion.style.cssText = `
                width: 100%; text-align: left; padding: 0.75rem 1rem; background: transparent; 
                color: #e5e7eb; border: none; border-bottom: 1px solid #374151; border-radius: 0;
                font-size: 0.85rem; font-weight: normal; margin: 0; box-shadow: none; transition: background 0.2s;
            `;
            itemSeleccion.textContent = lugar.display_name;

            // Efecto hover visual
            itemSeleccion.addEventListener("mouseover", () => itemSeleccion.style.background = "#374151");
            itemSeleccion.addEventListener("mouseleave", () => itemSeleccion.style.background = "transparent");

            // Mousedown evita conflictos con el evento blur del input principal
            itemSeleccion.addEventListener("mousedown", (e) => {
                e.preventDefault(); // Evita que el input reclame el foco antes de clickar el botón
                marcarCiudadComoSeleccionada(lugar);
            });

            containerCityResults.appendChild(itemSeleccion);
        });

    } catch (error) {
        console.error("Error al buscar ciudades en el evento blur:", error);
        containerCityResults.innerHTML = `<p style="color: #ef4444; font-size: 0.8rem; padding: 0.75rem 1rem; margin: 0;">⚠️ Error al consultar el mapa.</p>`;
    }
});

// Función interna para fijar la ciudad elegida en la interfaz
function marcarCiudadComoSeleccionada(lugar) {
    destinoSeleccionadoGps = lugar; // Guardamos el objeto entero (con lat/lon) en la variable global
    
    // Extraemos el nombre corto (Ciudad) para limpiar el cuadro de texto
    const ciudadLimpia = lugar.address.city || lugar.address.town || lugar.address.village || lugar.name;
    inputTripCity.value = ciudadLimpia;
    
    // Mostramos un mensaje de confirmación verde dentro del desplegable
    containerCityResults.innerHTML = `
        <p style="color: #10b981; font-size: 0.85rem; padding: 0.75rem 1rem; margin: 0; font-weight: 600;">
            ✓ Ubicación vinculada: <span style="color: #e5e7eb; font-weight: normal;">${lugar.display_name}</span>
        </p>
    `;
}

// BOTÓN GUARDAR: Ahora es súper directo, solo valida campos y manda a Firestore
btnSubmitTrip.addEventListener("click", async (e) => {
    e.preventDefault();

    const nombreViajeTexto = inputTripName.value.trim();
    const fechaIdaTexto = inputTripStartDate.value;
    const fechaVueltaTexto = inputTripEndDate.value;
    const archivosFotos = inputTripPhotos.files;

    // 1. Validaciones iniciales
    if (!nombreViajeTexto || !fechaIdaTexto || !fechaVueltaTexto) {
        await mostrarAlerta("Por favor, rellena el nombre del viaje y las fechas.");
        return;
    }

    // 2. Comprobamos si tenemos una ubicación válida en memoria
    if (!destinoSeleccionadoGps) {
        await mostrarAlerta("Debes seleccionar una ubicación válida de la lista desplegable de la ciudad.");
        return;
    }

    try {
        btnSubmitTrip.textContent = "Guardando en Firebase...";
        btnSubmitTrip.disabled = true;

        // Procesamos fotos a Base64 si las hubiera
        let arrayFotosBase64 = [];
        if (archivosFotos.length > 0) {
            btnSubmitTrip.textContent = "Procesando fotos...";
            arrayFotosBase64 = await procesarFotosABase64(archivosFotos);
        }

        const latitud = parseFloat(destinoSeleccionadoGps.lat);
        const longitud = parseFloat(destinoSeleccionadoGps.lon);
        const ciudadLimpia = destinoSeleccionadoGps.address.city || 
                             destinoSeleccionadoGps.address.town || 
                             destinoSeleccionadoGps.address.village || 
                             destinoSeleccionadoGps.name;

        // Estructura perfecta para Firebase
        const nuevoViaje = {
            grupoId: grupoActivoId,
            nombreViaje: nombreViajeTexto,
            ciudad: ciudadLimpia,
            ciudadCompleta: destinoSeleccionadoGps.display_name,
            fechaIda: fechaIdaTexto,
            fechaVuelta: fechaVueltaTexto,
            fotos: arrayFotosBase64,
            lat: latitud,
            lng: longitud,
            geojson: geojsonOptimizado ? JSON.stringify(geojsonOptimizado) : null,
            creador: currentUserId,
            fechaRegistro: new Date()
        };

        await addDoc(collection(db, "viajes"), nuevoViaje);

        limpiarFormularioModal();
        tripModal.close();

        await mostrarAlerta(`¡Viaje "${nombreViajeTexto}" registrado con éxito! ✈️🌍`);
        await consultarYRenderizarViajes();

    } catch (error) {
        console.error("Error al guardar definitivamente el viaje:", error);
        await mostrarAlerta("Ocurrió un error al intentar registrar los datos en Firestore.");
    } finally {
        btnSubmitTrip.textContent = "Guardar Viaje";
        btnSubmitTrip.disabled = false;
    }
});