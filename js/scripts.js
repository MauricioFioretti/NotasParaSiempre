// ================== CONFIG ==================
const API_URL = "https://script.google.com/macros/s/AKfycbyoo4vmC69r4kJpGgAECswXegWbiYRLYyDVkJuzJfvqCTKKyuLS_kEqORm5Kxa36oDm/exec" // <-- tu URL

// ================== HEADER: TÍTULO ==================
const header = document.querySelector("header")

const seccionTitulo = document.createElement("section")
seccionTitulo.classList = "titulo"
header.appendChild(seccionTitulo)

const h1 = document.createElement("h1")
h1.innerText = "Notas para siempre"
seccionTitulo.appendChild(h1)

// ================== MAIN ==================
const main = document.querySelector("main")

// ------- Sección para agregar nota -------
const seccionAgregar = document.createElement("section")
seccionAgregar.classList = "agregarNota"
main.appendChild(seccionAgregar)

// Campo: título de la nota
const labelTitulo = document.createElement("label")
labelTitulo.innerText = "Título de la nota:"
labelTitulo.htmlFor = "titulo-nota"
seccionAgregar.appendChild(labelTitulo)

const inputTitulo = document.createElement("input")
inputTitulo.type = "text"
inputTitulo.id = "titulo-nota"
inputTitulo.placeholder = "Ej: Mejor fila del cine"
seccionAgregar.appendChild(inputTitulo)

// Campo: indicación / tip
const labelTexto = document.createElement("label")
labelTexto.innerText = "Nota / indicación:"
labelTexto.htmlFor = "texto-nota"
seccionAgregar.appendChild(labelTexto)

const textareaTexto = document.createElement("textarea")
textareaTexto.id = "texto-nota"
textareaTexto.rows = 4
textareaTexto.placeholder = "Ej: La mejor fila es la K, asientos del medio."
seccionAgregar.appendChild(textareaTexto)

// Botón: agregar nota
const buttonAgregar = document.createElement("button")
buttonAgregar.innerText = "Agregar nota"
seccionAgregar.appendChild(buttonAgregar)

// ------- Mural de notas -------
const muralNotas = document.createElement("section")
muralNotas.classList = "mural-notas"
main.appendChild(muralNotas)


// ================== FUNCIONES API ==================

// Cargar notas desde Google Sheets (vía Apps Script)
async function cargarNotasDesdeAPI() {
  try {
    const resp = await fetch(API_URL)   // modo "list" por defecto
    const notas = await resp.json()

    muralNotas.innerHTML = ""

    notas.forEach((nota, index) => {
      const card = document.createElement("article")
      card.classList.add("nota-card")

      // alternar tonos para distinguir
      if (index % 2 === 0) {
        card.classList.add("nota-oscura")
      } else {
        card.classList.add("nota-clara")
      }

      // Título
      const titulo = document.createElement("h2")
      titulo.innerText = nota.titulo
      card.appendChild(titulo)

      // Texto / indicación
      const pTexto = document.createElement("p")
      pTexto.classList.add("nota-texto")
      pTexto.innerText = nota.indicacion || ""
      card.appendChild(pTexto)

      // Timestamp (si viene)
      if (nota.timestamp) {
        const fecha = new Date(nota.timestamp)
        const pFecha = document.createElement("p")
        pFecha.classList.add("nota-fecha")
        pFecha.innerText = fecha.toLocaleString("es-AR", {
          dateStyle: "short",
          timeStyle: "short"
        })
        card.appendChild(pFecha)
      }

      muralNotas.appendChild(card)
    })
  } catch (err) {
    console.error("Error al cargar notas", err)
  }
}

// Agregar nota nueva a la hoja (usando GET con modo=add)
async function agregarNotaAPI(titulo, texto) {
  const tituloLimpio = (titulo || "").trim()
  const textoLimpio = (texto || "").trim()

  if (!tituloLimpio || !textoLimpio) return

  const url = API_URL
    + "?modo=add"
    + "&titulo=" + encodeURIComponent(tituloLimpio)
    + "&indicacion=" + encodeURIComponent(textoLimpio)

  try {
    await fetch(url)        // GET
    await cargarNotasDesdeAPI()
  } catch (err) {
    console.error("Error al agregar nota", err)
  }
}


// ================== EVENTOS ==================

// Click en "Agregar nota"
buttonAgregar.addEventListener("click", () => {
  agregarNotaAPI(inputTitulo.value, textareaTexto.value)
  inputTitulo.value = ""
  textareaTexto.value = ""
  inputTitulo.focus()
})

// Enter en título -> pasa al textarea
inputTitulo.addEventListener("keydown", function (event) {
  if (event.key === "Enter") {
    event.preventDefault()
    textareaTexto.focus()
  }
})

// Cargar al iniciar
window.addEventListener("load", cargarNotasDesdeAPI)
