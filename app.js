import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// === 1. CONFIG FIREBASE ===
const firebaseConfig = {
    apiKey: "AIzaSyATB3WbLffGoNW93kLTBuTNuIReIBr8Zvc",
    authDomain: "rodzinne-losowanie.firebaseapp.com",
    projectId: "rodzinne-losowanie",
    storageBucket: "rodzinne-losowanie.firebasestorage.app",
    messagingSenderId: "744421189392",
    appId: "1:744421189392:web:a3e450723890341c8e2795"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// === 2. ODCZYTYWANIE KODU RODZINY Z LINKU (?rodzina=8znaków) ===
const urlParams = new URLSearchParams(window.location.search);
const currentFamilyId = urlParams.get('rodzina') ? urlParams.get('rodzina').toLowerCase() : null;

// === 3. ELEMENTY INTERFEJSU (UI) ===
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
const budgetInfo = document.getElementById('budget-info');
const budgetValue = document.getElementById('budget-value');

// Elementy listy prezentów
const giftNameInput = document.getElementById('gift-name');
const giftLinkInput = document.getElementById('gift-link');
const addGiftBtn = document.getElementById('add-gift-btn');
const myGiftsList = document.getElementById('my-gifts-list');
const globalGiftsContainer = document.getElementById('global-gifts-container');

// Zmienne sesji
let currentUser = null;
let clearTextPin = "";
let decodedDrawnUser = ""; 

// === 4. START APLIKACJI (ONLOAD) ===
window.onload = async () => {
    if (!currentFamilyId) {
        document.body.innerHTML = `
            <div style='text-align:center; padding:50px; font-family:sans-serif;'>
                <h2 style='color:#c62828;'>❌ Błąd: Nieprawidłowy lub niepełny link.</h2>
                <p>Upewnij się, że otwierasz link otrzymany od administratora (musi zawierać kod rodziny na końcu).</p>
            </div>`;
        return;
    }

    const savedUser = localStorage.getItem('secretSantaUser');
    const savedPin = sessionStorage.getItem('secretSantaPin');
    if (savedUser && savedPin) {
        currentUser = JSON.parse(savedUser);
        clearTextPin = savedPin;
        await showDashboard();
    }
};

// === 5. LOGOWANIE ===
loginBtn.addEventListener('click', async () => {
    const user = usernameInput.value.trim().toLowerCase(); 
    const pass = passwordInput.value.trim().toLowerCase();
    if (!user || !pass) return;

    try {
        const userDocId = `${user}_${currentFamilyId}`; 
        
        const userRef = doc(db, "users", userDocId); 
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();

            let isPasswordCorrect = !userData.isSecured ? (userData.password === pass) : (CryptoJS.SHA256(pass).toString() === userData.password);

            if (isPasswordCorrect) {
                currentUser = { id: userDocId, ...userData }; 
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
            } else { loginError.innerText = "Błędny login, hasło lub PIN!"; loginError.classList.remove('hidden'); }
        } else { loginError.innerText = "Błędny login, hasło lub PIN!"; loginError.classList.remove('hidden'); }
    } catch (e) { console.error(e); }
});

// === 6. USTAWIENIE NOWEGO PIN-U I RE-SZYFROWANIE ===
savePinBtn.addEventListener('click', async () => {
    const pin = newPinInput.value.trim();
    if (pin.length !== 4) { pinError.classList.remove('hidden'); return; }

    try {
        const pureUsername = currentUser.name.toLowerCase();
        
        const bytes = CryptoJS.AES.decrypt(currentUser.drawnUser, pureUsername);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        
        if (!decrypted) {
            throw new Error("Nie udało się odszyfrować wylosowanej osoby kluczem startowym.");
        }

        const reEncrypted = CryptoJS.AES.encrypt(decrypted, pin).toString();
        const hashedPin = CryptoJS.SHA256(pin).toString();

        const userRef = doc(db, "users", currentUser.id);
        await updateDoc(userRef, { password: hashedPin, drawnUser: reEncrypted, isSecured: true });

        clearTextPin = pin;
        sessionStorage.setItem('secretSantaPin', clearTextPin);
        currentUser.password = hashedPin; currentUser.drawnUser = reEncrypted; currentUser.isSecured = true;
        localStorage.setItem('secretSantaUser', JSON.stringify(currentUser));
        
        await showDashboard();
    } catch (e) { 
        console.error(e); 
        alert("Wystąpił problem przy zabezpieczaniu konta. Sprawdź konsolę.");
    }
});

// === 7. PULPIT GŁÓWNY (DASHBOARD) ===
async function showDashboard() {
    loginPanel.classList.add('hidden'); pinPanel.classList.add('hidden'); dashboardPanel.classList.remove('hidden');
    welcomeMessage.innerText = `Cześć, ${currentUser.name}!`;

    try {
        const familyRef = doc(db, "families", currentFamilyId);
        const familySnap = await getDoc(familyRef);
        if (familySnap.exists()) {
            budgetValue.innerText = familySnap.data().budget;
            budgetInfo.classList.remove('hidden');
        }
    } catch (e) { console.error("Błąd pobierania budżetu:", e); }

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

// === 8. LISTA PREZENTÓW (MOJE POMYSŁY) ===
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

addGiftBtn.addEventListener('click', async () => {
    const name = giftNameInput.value.trim();
    let link = giftLinkInput.value.trim();
    if (!name) return;

    if (link && !/^https?:\/\//i.test(link)) {
        link = 'https://' + link;
    }

    let newList = [];
    if (currentUser.wishlist && Array.isArray(currentUser.wishlist)) {
        newList = [...currentUser.wishlist];
    }
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

myGiftsList.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('del-btn')) return;
    const index = parseInt(e.target.getAttribute('data-index'), 10);
    
    let newList = [];
    if (currentUser.wishlist && Array.isArray(currentUser.wishlist)) {
        newList = [...currentUser.wishlist];
    }
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

// === 9. GLOBALNA TABLICA POMYSŁÓW (Z FILTROWANIEM RODZINY) ===
async function renderGlobalTable() {
    globalGiftsContainer.innerHTML = "Ładowanie tablicy pomysłów...";
    try {
        const q = query(collection(db, "users"), where("familyId", "==", currentFamilyId));
        const querySnapshot = await getDocs(q);
        globalGiftsContainer.innerHTML = "";

        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            
            const targetDocId = `${decodedDrawnUser}_${currentFamilyId}`;
            
            const card = document.createElement('div');
            card.classList.add('family-card');
            
            if (currentUser.hasDrawn && id === targetDocId) {
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

            card.innerHTML = `<h4>👤 Prezenty osoby: <b>${data.name}</b> ${id === targetDocId ? " 🔥 (TWOJA OSOBA!)" : ""}</h4>${giftsHtml}`;
            globalGiftsContainer.appendChild(card);
        });
    } catch (e) { console.error(e); globalGiftsContainer.innerHTML = "Błąd pobierania tablicy."; }
}

// === 10. ODKRYWANIE LOSOWANIA ===
drawBtn.addEventListener('click', async () => {
    try {
        const userRef = doc(db, "users", currentUser.id);
        await updateDoc(userRef, { hasDrawn: true });
        currentUser.hasDrawn = true;
        localStorage.setItem('secretSantaUser', JSON.stringify(currentUser));
        await showDashboard();
    } catch (e) { console.error(e); }
});

// === 11. WYLOGOWANIE ===
logoutBtn.addEventListener('click', () => {
    localStorage.clear(); sessionStorage.clear();
    currentUser = null; clearTextPin = ""; decodedDrawnUser = "";
    usernameInput.value = ""; passwordInput.value = "";
    dashboardPanel.classList.add('hidden'); pinPanel.classList.add('hidden'); loginPanel.classList.remove('hidden');
});