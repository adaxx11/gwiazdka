import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";



const firebaseConfig = {

  apiKey: "AIzaSyATB3WbLffGoNW93kLTBuTNuIReIBr8Zvc",
  authDomain: "rodzinne-losowanie.firebaseapp.com",
  projectId: "rodzinne-losowanie",
  storageBucket: "rodzinne-losowanie.firebasestorage.app",
  messagingSenderId: "744421189392",
  appId: "1:744421189392:web:a3e450723890341c8e2795",
 measurementId: "G-CW6D6LGFR8"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// UI Elements
const loginPanel = document.getElementById('login-panel');
const pinPanel = document.getElementById('pin-panel');
const dashboardPanel = document.getElementById('dashboard-panel');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const newPinInput = document.getElementById('new-pin');
const loginBtn = document.getElementById('login-btn');
const savePinBtn = document.getElementById('save-pin-btn');
const drawBtn = document.getElementById('draw-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginError = document.getElementById('login-error');
const pinError = document.getElementById('pin-error');
const welcomeMessage = document.getElementById('welcome-message');
const drawSection = document.getElementById('draw-section');
const resultSection = document.getElementById('result-section');
const drawnPersonText = document.getElementById('drawn-person');

// Gift Elements
const giftNameInput = document.getElementById('gift-name');
const giftLinkInput = document.getElementById('gift-link');
const addGiftBtn = document.getElementById('add-gift-btn');
const myGiftsList = document.getElementById('my-gifts-list');
const globalGiftsContainer = document.getElementById('global-gifts-container');

let currentUser = null;
let clearTextPin = "";
let decodedDrawnUser = ""; 

window.onload = () => {
    const savedUser = localStorage.getItem('secretSantaUser');
    const savedPin = sessionStorage.getItem('secretSantaPin');
    if (savedUser && savedPin) {
        currentUser = JSON.parse(savedUser);
        clearTextPin = savedPin;
        showDashboard();
    }
};

// Logowanie
loginBtn.addEventListener('click', async () => {
    const user = usernameInput.value.trim().toLowerCase();
    const pass = passwordInput.value.trim().toLowerCase();
    if (!user || !pass) return;

    try {
        const userRef = doc(db, "users", user);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();
            let isPasswordCorrect = !userData.isSecured ? (userData.password === pass) : (CryptoJS.SHA256(pass).toString() === userData.password);

            if (isPasswordCorrect) {
                currentUser = { id: userSnap.id, ...userData };
                loginError.classList.add('hidden');
                if (!userData.isSecured) {
                    loginPanel.classList.add('hidden');
                    pinPanel.classList.remove('hidden');
                } else {
                    clearTextPin = pass;
                    sessionStorage.setItem('secretSantaPin', clearTextPin);
                    localStorage.setItem('secretSantaUser', JSON.stringify(currentUser));
                    await showDashboard();
                }
            } else { loginError.classList.remove('hidden'); }
        } else { loginError.classList.remove('hidden'); }
    } catch (e) { console.error(e); }
});

// Ustawianie nowego PINu
savePinBtn.addEventListener('click', async () => {
    const pin = newPinInput.value.trim();
    if (pin.length !== 4) { pinError.classList.remove('hidden'); return; }

    try {
        const bytes = CryptoJS.AES.decrypt(currentUser.drawnUser, currentUser.id);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        const reEncrypted = CryptoJS.AES.encrypt(decrypted, pin).toString();
        const hashedPin = CryptoJS.SHA256(pin).toString();

        const userRef = doc(db, "users", currentUser.id);
        await updateDoc(userRef, { password: hashedPin, drawnUser: reEncrypted, isSecured: true });

        clearTextPin = pin;
        sessionStorage.setItem('secretSantaPin', clearTextPin);
        currentUser.password = hashedPin; currentUser.drawnUser = reEncrypted; currentUser.isSecured = true;
        localStorage.setItem('secretSantaUser', JSON.stringify(currentUser));
        
        await showDashboard();
    } catch (e) { console.error(e); }
});

// Pulpit Główny
async function showDashboard() {
    loginPanel.classList.add('hidden'); pinPanel.classList.add('hidden'); dashboardPanel.classList.remove('hidden');
    welcomeMessage.innerText = `Cześć, ${currentUser.name}!`;

    if (currentUser.hasDrawn) {
        drawSection.classList.add('hidden'); resultSection.classList.remove('hidden');
        try {
            const bytes = CryptoJS.AES.decrypt(currentUser.drawnUser, clearTextPin);
            decodedDrawnUser = bytes.toString(CryptoJS.enc.Utf8);
            drawnPersonText.innerText = decodedDrawnUser.charAt(0).toUpperCase() + decodedDrawnUser.slice(1);
        } catch (e) { drawnPersonText.innerText = "Błąd odczytu."; }
    } else {
        drawSection.classList.remove('hidden'); resultSection.classList.add('hidden');
    }

    renderMyGifts();
    await renderGlobalTable();
}

// Renderuj MOJE prezenty
function renderMyGifts() {
    myGiftsList.innerHTML = "";
    const list = currentUser.wishlist || [];
    list.forEach((gift, index) => {
        const li = document.createElement('li');
        li.innerHTML = `<b>${gift.name}</b> ${gift.link ? `<a href="${gift.link}" target="_blank">[Link]</a>` : ''} 
                        <button class="del-btn" data-index="${index}">❌ Usuń</button>`;
        myGiftsList.appendChild(li);
    });
}

// Dodawanie prezentu
addGiftBtn.addEventListener('click', async () => {
    const name = giftNameInput.value.trim();
    let link = giftLinkInput.value.trim();
    if (!name) return;

    // Automatyczne dodawanie http:// jeśli użytkownik zapomni, żeby link poprawnie przekierowywał
    if (link && !/^https?:\/\//i.test(link)) {
        link = 'https://' + link;
    }

    const newList = currentUser.wishlist || [];
    newList.push({ name, link });

    try {
        const userRef = doc(db, "users", currentUser.id);
        await updateDoc(userRef, { wishlist: newList });
        currentUser.wishlist = newList;
        localStorage.setItem('secretSantaUser', JSON.stringify(currentUser));
        
        giftNameInput.value = ""; giftLinkInput.value = "";
        renderMyGifts();
        await renderGlobalTable();
    } catch (e) { console.error(e); }
});

// Usuwanie prezentu
myGiftsList.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('del-btn')) return;
    const index = e.target.getAttribute('data-index');
    
    const newList = currentUser.wishlist || [];
    newList.splice(index, 1);

    try {
        const userRef = doc(db, "users", currentUser.id);
        await updateDoc(userRef, { wishlist: newList });
        currentUser.wishlist = newList;
        localStorage.setItem('secretSantaUser', JSON.stringify(currentUser));
        renderMyGifts();
        await renderGlobalTable();
    } catch (e) { console.error(e); }
});

// Pobieranie i generowanie GLOBALNEJ tablicy
async function renderGlobalTable() {
    globalGiftsContainer.innerHTML = "Ładowanie tablicy pomysłów...";
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        globalGiftsContainer.innerHTML = "";

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            const card = document.createElement('div');
            card.classList.add('family-card');
            
            if (currentUser.hasDrawn && id === decodedDrawnUser) {
                card.classList.add('target');
            }

            let giftsHtml = "";
            const gifts = data.wishlist || [];
            
            if (gifts.length === 0) {
                giftsHtml = "<p style='color:#888; font-style:italic;'>Brak wpisanych pomysłów...</p>";
            } else {
                gifts.forEach(g => {
                    giftsHtml += `
                        <div class="gift-item-row">
                            <b>${g.name}</b> 
                            ${g.link ? `— <a href="${g.link}" target="_blank">🔗 Zobacz ofertę</a>` : ''}
                        </div>
                    `;
                });
            }

            card.innerHTML = `<h4>👤 Prezenty osoby: <b>${data.name}</b> ${id === decodedDrawnUser ? " 🔥 (TWOJA OSOBA!)" : ""}</h4>${giftsHtml}`;
            globalGiftsContainer.appendChild(card);
        });
    } catch (e) { console.error(e); globalGiftsContainer.innerHTML = "Błąd pobierania tablicy."; }
}

// Odkrywanie losowania
drawBtn.addEventListener('click', async () => {
    try {
        const userRef = doc(db, "users", currentUser.id);
        await updateDoc(userRef, { hasDrawn: true });
        currentUser.hasDrawn = true;
        localStorage.setItem('secretSantaUser', JSON.stringify(currentUser));
        await showDashboard();
    } catch (e) { console.error(e); }
});

logoutBtn.addEventListener('click', () => {
    localStorage.clear(); sessionStorage.clear();
    currentUser = null; clearTextPin = ""; decodedDrawnUser = "";
    usernameInput.value = ""; passwordInput.value = ""; newPinInput.value = "";
    dashboardPanel.classList.add('hidden'); pinPanel.classList.add('hidden'); loginPanel.classList.remove('hidden');
});