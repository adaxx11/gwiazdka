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

// Elementy UI
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

let currentUser = null;

window.onload = () => {
    const savedUser = localStorage.getItem('secretSantaUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showDashboard();
    }
};

// 1. Logowanie
loginBtn.addEventListener('click', async () => {
    const user = usernameInput.value.trim().toLowerCase();
    const pass = passwordInput.value.trim().toLowerCase();

    if (!user || !pass) return;

    try {
        const userRef = doc(db, "users", user);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();

            // Sprawdzenie hasła (starego imienia lub nowego PINu, zależnie czy konto zabezpieczone)
            if (userData.password === pass) {
                currentUser = { id: userSnap.id, ...userData };
                loginError.classList.add('hidden');

                if (!userData.isSecured) {
                    // Pierwsze logowanie -> idź do ustawiania PINu
                    loginPanel.classList.add('hidden');
                    pinPanel.classList.remove('hidden');
                } else {
                    // Konto już zabezpieczone -> idź do pulpitu
                    localStorage.setItem('secretSantaUser', JSON.stringify(currentUser));
                    showDashboard();
                }
            } else {
                loginError.classList.remove('hidden');
            }
        } else {
            loginError.classList.remove('hidden');
        }
    } catch (error) {
        console.error(error);
        alert("Błąd połączenia z bazą.");
    }
});

// 2. Zapisywanie nowego PINu
savePinBtn.addEventListener('click', async () => {
    const pin = newPinInput.value.trim();

    // Walidacja czy to dokładnie 4 cyfry
    if (pin.length !== 4) {
        pinError.classList.remove('hidden');
        return;
    }

    try {
        const userRef = doc(db, "users", currentUser.id);
        
        // Nadpisujemy hasło nowym PINem i oznaczamy konto jako zabezpieczone
        await updateDoc(userRef, {
            password: pin,
            isSecured: true
        });

        currentUser.password = pin;
        currentUser.isSecured = true;
        localStorage.setItem('secretSantaUser', JSON.stringify(currentUser));

        pinError.classList.add('hidden');
        pinPanel.classList.add('hidden');
        showDashboard();
    } catch (error) {
        console.error(error);
        alert("Nie udało się zapisać PINu.");
    }
});

// Wyświetlanie pulpitu
function showDashboard() {
    loginPanel.classList.add('hidden');
    pinPanel.classList.add('hidden');
    dashboardPanel.classList.remove('hidden');
    welcomeMessage.innerText = `Cześć, ${currentUser.name}!`;

    if (currentUser.hasDrawn) {
        drawSection.classList.add('hidden');
        resultSection.classList.remove('hidden');
        drawnPersonText.innerText = capitalizeFirstLetter(currentUser.drawnUser);
    } else {
        drawSection.classList.remove('hidden');
        resultSection.classList.add('hidden');
    }
}

// Losowanie (odkrycie)
drawBtn.addEventListener('click', async () => {
    try {
        const userRef = doc(db, "users", currentUser.id);
        await updateDoc(userRef, { hasDrawn: true });

        currentUser.hasDrawn = true;
        localStorage.setItem('secretSantaUser', JSON.stringify(currentUser));
        showDashboard();
    } catch (error) {
        console.error(error);
    }
});

// Wylogowanie
logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('secretSantaUser');
    currentUser = null;
    usernameInput.value = '';
    passwordInput.value = '';
    newPinInput.value = '';
    dashboardPanel.classList.add('hidden');
    pinPanel.classList.add('hidden');
    loginPanel.classList.remove('hidden');
});

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}