// Importa Firebase dal CDN ufficiale
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// === INCOLLA QUI IL TUO FIREBASE CONFIG ===
const firebaseConfig = {
  apiKey: "AIzaSyCxIc67Y-zwuqjwDL4D3VRLOeO8kPAyeQs",
  authDomain: "lamiaspesa-93e94.firebaseapp.com",
  projectId: "lamiaspesa-93e94",
  storageBucket: "lamiaspesa-93e94.firebasestorage.app",
  messagingSenderId: "1052599636336",
  appId: "1:1052599636336:web:0eee8c5e5ff9fde85a7fb5"
};
// ==========================================

// Inizializza Database
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Variabili di stato
let listaAttiva = [];
let catalogo = [];
let storico = [];
let graficoInstance = null;

// Gestione Navigazione Viste
window.cambiaVista = function(idVista) {
    document.querySelectorAll('.schermata').forEach(el => el.style.display = 'none');
    document.getElementById(idVista).style.display = 'block';
    if(idVista === 'vista-storico') aggiornaGrafico();
};
document.getElementById('btn-storico').addEventListener('click', () => cambiaVista('vista-storico'));
document.getElementById('btn-catalogo').addEventListener('click', () => cambiaVista('vista-catalogo'));

// ================= LECTURA DATI IN TEMPO REALE =================

// Ascolta il Catalogo
onSnapshot(collection(db, "catalogo"), (snapshot) => {
    catalogo = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCatalogo();
});

// Ascolta la Lista della Spesa
onSnapshot(collection(db, "lista"), (snapshot) => {
    listaAttiva = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    listaAttiva.sort((a, b) => a.corsia - b.corsia); // Ordina per corsia
    renderLista();
    controllaCompletamento();
});

// Ascolta lo Storico
onSnapshot(query(collection(db, "storico"), orderBy("timestamp", "desc")), (snapshot) => {
    storico = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStorico();
});

// ================= FUNZIONI LISTA =================

function renderLista() {
    const ul = document.getElementById('lista-spesa');
    const msg = document.getElementById('messaggio-vuoto');
    ul.innerHTML = '';
    
    if(listaAttiva.length === 0) {
        msg.style.display = 'block';
    } else {
        msg.style.display = 'none';
        listaAttiva.forEach(item => {
            const li = document.createElement('li');
            li.className = item.depennato ? 'elemento-depennato' : '';
            li.innerHTML = `
                <span style="flex:1" onclick="toggleDepennato('${item.id}', ${item.depennato})">
                    ${item.depennato ? '✅' : '➖'} ${item.nome}
                </span>
                <span style="color:#aaa; font-size:1.2rem;">C${item.corsia}</span>
            `;
            ul.appendChild(li);
        });
    }
}

window.toggleDepennato = async function(id, statoAttuale) {
    await updateDoc(doc(db, "lista", id), { depennato: !statoAttuale });
};

function controllaCompletamento() {
    if (listaAttiva.length > 0 && listaAttiva.every(item => item.depennato)) {
        document.getElementById('popup-spesa').style.display = 'flex';
    } else {
        document.getElementById('popup-spesa').style.display = 'none';
    }
}

// ================= FUNZIONI CATALOGO =================

document.getElementById('btn-salva-catalogo').addEventListener('click', async () => {
    const nome = document.getElementById('input-nome').value.trim();
    const corsia = document.getElementById('input-corsia').value || 99; // 99 se non specificata

    if(!nome) return;

    // Controllo duplicati
    const esistente = catalogo.find(c => c.nome.toLowerCase() === nome.toLowerCase());
    
    if (esistente) {
        if(confirm(`"${nome}" esiste già. Vuoi aggiornare la sua corsia a ${corsia}?`)) {
            await updateDoc(doc(db, "catalogo", esistente.id), { corsia: Number(corsia) });
        }
    } else {
        await addDoc(collection(db, "catalogo"), { nome, corsia: Number(corsia) });
    }
    
    document.getElementById('input-nome').value = '';
    document.getElementById('input-corsia').value = '';
});

function renderCatalogo() {
    const ul = document.getElementById('lista-catalogo');
    ul.innerHTML = '';
    
    // Ordina alfabeticamente
    const catalogoOrdinato = [...catalogo].sort((a,b) => a.nome.localeCompare(b.nome));

    catalogoOrdinato.forEach(prod => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div style="flex:1;">${prod.nome} <span style="font-size:1.2rem; color:#888;">(C${prod.corsia})</span></div>
            <div>
                <button class="btn-aggiungi" onclick="aggiungiInLista('${prod.id}')">➕</button>
                <button class="btn-elimina" onclick="eliminaDaCatalogo('${prod.id}')">🗑</button>
            </div>
        `;
        ul.appendChild(li);
    });
}

window.aggiungiInLista = async function(idCatalogo) {
    const prodotto = catalogo.find(c => c.id === idCatalogo);
    // Evita doppioni in lista
    if(!listaAttiva.find(l => l.nome === prodotto.nome)) {
        await addDoc(collection(db, "lista"), { 
            nome: prodotto.nome, 
            corsia: prodotto.corsia, 
            depennato: false 
        });
        alert(`${prodotto.nome} aggiunto alla lista!`);
    } else {
        alert("Prodotto già presente in lista!");
    }
};

window.eliminaDaCatalogo = async function(id) {
    if(confirm("Sicuro di voler eliminare questo prodotto dal catalogo?")) {
        await deleteDoc(doc(db, "catalogo", id));
    }
};

// ================= FINE SPESA & STORICO =================

document.getElementById('btn-annulla-popup').addEventListener('click', () => {
    document.getElementById('popup-spesa').style.display = 'none';
});

document.getElementById('btn-conferma-popup').addEventListener('click', async () => {
    const valoreInput = document.getElementById('input-costo').value.trim();
    const costo = parseFloat(valoreInput.replace(',', '.'));

    // Salva nello storico SOLO se l'utente ha inserito un numero valido
    if (valoreInput !== "" && !isNaN(costo) && costo > 0) {
        const dataOdierna = new Date().toLocaleDateString('it-IT');
        await addDoc(collection(db, "storico"), {
            data: dataOdierna,
            totale: costo,
            timestamp: Date.now()
        });
    }

    // A prescindere dall'importo, pulisci la lista
    for (const item of listaAttiva) {
        await deleteDoc(doc(db, "lista", item.id));
    }

    document.getElementById('input-costo').value = '';
    document.getElementById('popup-spesa').style.display = 'none';
});

function renderStorico() {
    const ul = document.getElementById('lista-storico');
    ul.innerHTML = '';
    storico.forEach(s => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${s.data}</span> <strong>€ ${s.totale.toFixed(2)}</strong>`;
        ul.appendChild(li);
    });
}

function aggiornaGrafico() {
    const ctx = document.getElementById('grafico-spese').getContext('2d');
    
    // Prepariamo i dati (invertiti per ordine cronologico da sinistra a destra)
    const datiOrdinati = [...storico].reverse();
    const etichette = datiOrdinati.map(s => s.data);
    const valori = datiOrdinati.map(s => s.totale);

    if(graficoInstance) graficoInstance.destroy(); // Resetta il grafico precedente

    graficoInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: etichette,
            datasets: [{
                label: 'Spesa (€)',
                data: valori,
                borderColor: '#d32f2f',
                backgroundColor: 'rgba(211, 47, 47, 0.2)',
                borderWidth: 3,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } }
        }
    });
}

// Stampa PDF (Adattato per iOS PWA)
document.getElementById('btn-stampa').addEventListener('click', () => {
    const elementoDaStampare = document.getElementById('vista-storico');
    const bottoni = elementoDaStampare.querySelector('.intestazione-sezione');
    
    // Nascondiamo temporaneamente i bottoni "Indietro" e "PDF" per non stamparli nel foglio
    bottoni.style.display = 'none';

    const opzioni = {
        margin:       10,
        filename:     'storico_spesa.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 }, // Aumenta la risoluzione
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opzioni).from(elementoDaStampare).save().then(() => {
        // Facciamo riapparire i bottoni a schermo dopo aver salvato
        bottoni.style.display = 'flex';
    });
});
