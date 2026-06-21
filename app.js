import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// TUTAJ WKLEJ SWÓJ CONFIG Z FIREBASE
const firebaseConfig = {
    apiKey: "TWÓJ_KLUCZ",
    authDomain: "twoj-projekt.firebaseapp.com",
    projectId: "twoj-projekt",
    storageBucket: "twoj-projekt.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Elementy UI
const loginPanel = document.getElementById('login-panel');
const dashboardPanel = document.getElementById('dashboard-panel');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginError = document.getElementById('login-error');
const welcomeMessage = document.getElementById('welcome-message');
const drawSection = document.getElementById('draw-section');
const resultSection = document.getElementById('result-section');
const drawBtn = document.getElementById('draw-btn');
const drawnPersonText = document.getElementById('drawn-person');

let currentUser = null;

// Sprawdzenie, czy użytkownik jest już zalogowany (zapisane w przeglądarce)
window.onload = () => {
    const savedUser = localStorage.getItem('secretSantaUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showDashboard();
    }
};

// Logika logowania
loginBtn.addEventListener('click', async () => {
    const user = usernameInput.value.trim().toLowerCase();
    const pass = passwordInput.value.trim().toLowerCase();

    if (!user || !pass) return;

    try {
        const userRef = doc(db, "users", user);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists() && userSnap.data().password === pass) {
            currentUser = { id: userSnap.id, ...userSnap.data() };
            localStorage.setItem('secretSantaUser', JSON.stringify(currentUser));
            loginError.classList.add('hidden');
            showDashboard();
        } else {
            loginError.classList.remove('hidden');
        }
    } catch (error) {
        console.error("Błąd logowania: ", error);
        alert("Błąd połączenia z bazą danych.");
    }
});

// Wyświetlanie panelu po zalogowaniu
function showDashboard() {
    loginPanel.classList.add('hidden');
    dashboardPanel.classList.remove('hidden');
    welcomeMessage.innerText = `Cześć, ${currentUser.name}!`;

    // Jeśli już wylosował (lub raczej odsłonił wynik), pokazujemy kogo ma
    if (currentUser.hasDrawn) {
        drawSection.classList.add('hidden');
        resultSection.classList.remove('hidden');
        drawnPersonText.innerText = capitalizeFirstLetter(currentUser.drawnUser);
    } else {
        drawSection.classList.remove('hidden');
        resultSection.classList.add('hidden');
    }
}

// Logika losowania (odsłonięcia)
drawBtn.addEventListener('click', async () => {
    try {
        const userRef = doc(db, "users", currentUser.id);
        
        // Aktualizacja w bazie, że użytkownik odkrył kartę
        await updateDoc(userRef, {
            hasDrawn: true
        });

        currentUser.hasDrawn = true;
        localStorage.setItem('secretSantaUser', JSON.stringify(currentUser));
        
        // Pokaż wynik
        showDashboard();
    } catch (error) {
        console.error("Błąd podczas losowania: ", error);
    }
});

// Wylogowanie
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('secretSantaUser');
    currentUser = null;
    usernameInput.value = '';
    passwordInput.value = '';
    dashboardPanel.classList.add('hidden');
    loginPanel.classList.remove('hidden');
    resultSection.classList.add('hidden');
});

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}