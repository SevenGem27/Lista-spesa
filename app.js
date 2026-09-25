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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let listaAttiva = [];
let catalogo = [];
let storico = [];
let graficoInstance = null;

// Gestione Viste
window.cambiaVista = function(idVista) {
    document.querySelectorAll('.schermata').forEach(el => el.style.display = 'none');
    document.getElementById(idVista).style.display = 'block';
    if(idVista === 'vista-storico') aggiornaGrafico();
};
document.getElementById('btn-storico').addEventListener('click', () => cambiaVista('vista-storico'));
document.getElementById('btn-catalogo').addEventListener('click', () => cambiaVista('vista-catalogo'));
document.getElementById('btn-forza-fine').addEventListener('click', () => {
    document.getElementById('popup-spesa').style.display = 'flex';
});

// ================= AUTO-COMPLETAMENTO CORSIE =================
const dizionarioCorsie = [
    { corsia: 1, parole: ["frutta", "verdura", "insalat", "mela", "mele", "zucchine", "pomodor", "secca", "noci", "mandorle", "cereali", "legumi", "farro", "cous", "lenticchie", "piselli", "fagioli", "ceci"] },
    { corsia: 2, parole: ["formaggi", "mozzarella", "grana", "parmigiano", "ricotta", "latticin", "uova", "latte", "yogurt", "affettat", "prosciutt", "salame", "speck", "mortadella", "bresaola", "pasta fresca", "ravioli", "trofie", "gnocchi", "strozzapreti", "burro"] },
    { corsia: 3, parole: ["scatola", "sale", "sottacet", "sottoli", "olive", "salse", "maionese", "ketchup", "senape", "carne", "pesce", "tonno", "sgombro", "riso"] },
    { corsia: 4, parole: ["farina", "marmellat", "miele", "preparat", "lievito", "pizz", "fette biscottate", "budin", "torta", "torte"] },
    { corsia: 5, parole: ["dietetic", "pasta all'uovo", "passata", "pomodoro", "sugo", "pastin", "deodorant", "semola", "spaghetti", "maccheroni", "penne"] },
    { corsia: 6, parole: ["tovagli", "tappet", "casa", "tessile", "spugn"] },
    { corsia: 7, parole: ["cereali", "biscott", "frollini", "pan di stelle", "primo prezzo", "biologic", "tè"] },
    { corsia: 8, parole: ["giocattol", "sciroppata", "party", "festa", "pic-nic", "forno", "alluminio", "infanzia"] },
    { corsia: 9, parole: ["neonat", "fazzolettin", "pannolin", "intimo bambin", "ciabatt", "pantofol"] },
    { corsia: 10, parole: ["calze donn", "igiene oral", "dentifricio", "spazzolino", "collutorio", "calzature", "scarpe", "assorbent", "bigiotteri"] },
    { corsia: 11, parole: ["intimo donn", "mutande", "reggisen", "profum", "carta igienica", "biancheria"] },
    { corsia: 12, parole: ["barba", "schiuma", "rasoi", "igiene personale", "bagnoschiuma", "shampoo", "docciaschiuma", "sapone", "intimo uom", "calze uom"] },
    { corsia: 13, parole: ["sanitar", "cancelleria", "penne", "quadern", "fai da te", "auto", "carta casa", "scottex", "uffici"] },
    { corsia: 14, parole: ["detersiv", "lavatrice", "piatt", "ammorbident", "pulizia", "cere", "smacchiator", "candeggina", "acqua distillata", "bucato"] },
    { corsia: 15, parole: ["aperitiv", "crodino", "campari", "analcolic", "vini tipici", "marsala", "succh", "liquor", "amaro", "spumant", "champagne", "pile"] },
    { corsia: 16, parole: ["vini", "vino", "birr"] },
    { corsia: 17, parole: ["panni", "animal", "cane", "gatto", "croccant", "scatolette", "lampadin", "lucid"] },
    { corsia: 18, parole: ["gelat", "surgelat", "pizza", "salatin", "sofficini", "bastoncini", "piatti pronti"] },
    { corsia: 19, parole: ["patatin", "acqua", "minerale", "naturale", "frizzante", "pane", "grissin", "zuccher", "dolcificant", "bibit", "coca cola", "aranciata", "crackers"] }
];

// Funzione isolata per trovare la corsia
function suggerisciCorsia(testo) {
    testo = testo.toLowerCase();
    if (testo.length < 3) return null;
    for (const categoria of dizionarioCorsie) {
        if (categoria.parole.some(parola => testo.includes(parola))) {
            return categoria.corsia;
        }
    }
    return null;
}

// Quando scrivi un nuovo prodotto
document.getElementById('input-nome').addEventListener('input', (e) => {
    const corsiaIntelligente = suggerisciCorsia(e.target.value);
    if (corsiaIntelligente !== null) {
        document.getElementById('input-corsia').value = corsiaIntelligente;
    }
});
// ============================================================

// Sincronizzazione Realtime Firebase
onSnapshot(collection(db, "catalogo"), (snapshot) => {
    catalogo = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderCatalogo();
});
onSnapshot(collection(db, "lista"), (snapshot) => {
    listaAttiva = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    listaAttiva.sort((a, b) => a.corsia - b.corsia);
    renderLista();
    controllaCompletamento();
});
onSnapshot(query(collection(db, "storico"), orderBy("timestamp", "desc")), (snapshot) => {
    storico = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderStorico();
});

// ================= FUNZIONI LISTA =================
function renderLista() {
    const ul = document.getElementById('lista-spesa');
    const msg = document.getElementById('messaggio-vuoto');
    const btnForzaFine = document.getElementById('btn-forza-fine');
    ul.innerHTML = '';
    
    if(listaAttiva.length === 0) {
        msg.style.display = 'block';
        btnForzaFine.style.display = 'none';
    } else {
        msg.style.display = 'none';
        btnForzaFine.style.display = listaAttiva.every(item => item.depennato) ? 'none' : 'flex';
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
    document.getElementById('popup-spesa').style.display = (listaAttiva.length > 0 && listaAttiva.every(item => item.depennato)) ? 'flex' : 'none';
}

// ================= FUNZIONI CATALOGO =================
document.getElementById('btn-salva-catalogo').addEventListener('click', async () => {
    const nome = document.getElementById('input-nome').value.trim();
    const corsia = document.getElementById('input-corsia').value || 99;
    if(!nome) return;
    
    const esistente = catalogo.find(c => c.nome.toLowerCase() === nome.toLowerCase());
    
    if (esistente) {
        if(confirm(`"${nome}" esiste già. Vuoi aggiornare la sua corsia a ${corsia}?`)) {
            await updateDoc(doc(db, "catalogo", esistente.id), { corsia: Number(corsia) });
            const prodottoInLista = listaAttiva.find(l => l.nome.toLowerCase() === nome.toLowerCase());
            if(prodottoInLista) {
                await updateDoc(doc(db, "lista", prodottoInLista.id), { corsia: Number(corsia) });
            }
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
    const catalogoOrdinato = [...catalogo].sort((a,b) => a.nome.localeCompare(b.nome));
    catalogoOrdinato.forEach(prod => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div style="flex:1;">${prod.nome} <span style="font-size:1.2rem; color:#888;">(C${prod.corsia})</span></div>
            <div style="display:flex; gap:5px;">
                <button class="btn-aggiungi" onclick="aggiungiInLista('${prod.id}')">➕</button>
                <button style="background: #fff3e0; color: #e65100; border: none; padding: 5px 12px; border-radius: 5px; font-size: 1.2rem;" onclick="preparaModifica('${prod.id}')">✏️</button>
                <button class="btn-elimina" onclick="eliminaDaCatalogo('${prod.id}')">🗑</button>
            </div>
        `;
        ul.appendChild(li);
    });
}

// Quando clicchi la matita su un prodotto esistente
window.preparaModifica = function(id) {
    const prodotto = catalogo.find(c => c.id === id);
    document.getElementById('input-nome').value = prodotto.nome;
    
    // Controlla se l'Intelligenza Artificiale conosce la corsia giusta
    const corsiaIntelligente = suggerisciCorsia(prodotto.nome);
    
    // Se la conosce, inserisce quella corretta. Altrimenti lascia quella vecchia.
    document.getElementById('input-corsia').value = corsiaIntelligente !== null ? corsiaIntelligente : prodotto.corsia;
    
    document.getElementById('input-corsia').focus(); 
    window.scrollTo(0,0);
};

window.aggiungiInLista = async function(idCatalogo) {
    const prodotto = catalogo.find(c => c.id === idCatalogo);
    if(!listaAttiva.find(l => l.nome === prodotto.nome)) {
        await addDoc(collection(db, "lista"), { nome: prodotto.nome, corsia: prodotto.corsia, depennato: false });
        // Nessun fastidioso alert, l'aggiunta è fluida!
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
document.getElementById('btn-annulla-popup').addEventListener('click', () => { document.getElementById('popup-spesa').style.display = 'none'; });

document.getElementById('btn-conferma-popup').addEventListener('click', async () => {
    const valoreInput = document.getElementById('input-costo').value.trim();
    const costo = parseFloat(valoreInput.replace(',', '.'));
    if (valoreInput !== "" && !isNaN(costo) && costo > 0) {
        const dataOdierna = new Date().toLocaleDateString('it-IT');
        await addDoc(collection(db, "storico"), { data: dataOdierna, totale: costo, timestamp: Date.now() });
    }
    for (const item of listaAttiva) {
        if (item.depennato) { await deleteDoc(doc(db, "lista", item.id)); }
    }
    document.getElementById('input-costo').value = '';
    document.getElementById('popup-spesa').style.display = 'none';
});

function renderStorico() {
    const ul = document.getElementById('lista-storico');
    ul.innerHTML = '';
    storico.forEach(s => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span onclick="eliminaSpesaSegreta('${s.id}', '${s.data}', ${s.totale})" style="cursor:pointer; color:inherit; text-decoration:none;">
                ${s.data}
            </span> 
            <strong>€ ${s.totale.toFixed(2)}</strong>`;
        ul.appendChild(li);
    });
}

window.eliminaSpesaSegreta = async function(id, data, totale) {
    if(confirm(`Menu Nascosto: Vuoi eliminare la spesa del ${data} (Totale: € ${totale})?`)) {
        await deleteDoc(doc(db, "storico", id));
    }
};

function aggiornaGrafico() {
    const ctx = document.getElementById('grafico-spese').getContext('2d');
    const datiOrdinati = [...storico].reverse();
    if(graficoInstance) graficoInstance.destroy();
    graficoInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: datiOrdinati.map(s => s.data),
            datasets: [{ label: 'Spesa (€)', data: datiOrdinati.map(s => s.totale), borderColor: '#d32f2f', backgroundColor: 'rgba(211, 47, 47, 0.2)', borderWidth: 3, tension: 0.3, fill: true }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } }
    });
}

document.getElementById('btn-stampa').addEventListener('click', () => {
    const elementoDaStampare = document.getElementById('vista-storico');
    const bottoni = elementoDaStampare.querySelector('.intestazione-sezione');
    bottoni.style.display = 'none';
    html2pdf().set({ margin: 10, filename: 'storico_spesa.pdf', image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(elementoDaStampare).save().then(() => { bottoni.style.display = 'flex'; });
});
