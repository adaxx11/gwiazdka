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
let clearTextPin = ""; // Przetrzymujemy czysty PIN tylko w pamięci podręcznej sesji do odszyfrowania

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
            let isPasswordCorrect = false;

            if (!userData.isSecured) {
                // Pierwsze logowanie - porównujemy czysty tekst
                isPasswordCorrect = (userData.password === pass);
            } else {
                // Kolejne logowania - haszujemy wpisany PIN i porównujemy hashe
                const hashedInput = CryptoJS.SHA256(pass).toString();
                isPasswordCorrect = (userData.password === hashedInput);
            }

            if (isPasswordCorrect) {
                currentUser = { id: userSnap.id, ...userData };
                loginError.classList.add('hidden');

                if (!userData.isSecured) {
                    loginPanel.classList.add('hidden');
                    pinPanel.classList.remove('hidden');
                } else {
                    clearTextPin = pass; // Zapisujemy czysty PIN do deszyfracji
                    sessionStorage.setItem('secretSantaPin', clearTextPin);
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

// Zapisywanie nowego PINu i re-szyfrowanie wyniku
savePinBtn.addEventListener('click', async () => {
    const pin = newPinInput.value.trim();

    if (pin.length !== 4) {
        pinError.classList.remove('hidden');
        return;
    }

    try {
        // 1. Odszyfrowujemy imię starym hasłem (loginem)
        const bytes = CryptoJS.AES.decrypt(currentUser.drawnUser, currentUser.id);
        const decryptedDrawnUser = bytes.toString(CryptoJS.enc.Utf8);

        // 2. Szyfrujemy je ponownie nowym, bezpiecznym PINem
        const reEncryptedDrawnUser = CryptoJS.AES.encrypt(decryptedDrawnUser, pin).toString();

        // 3. Tworzymy nieodwracalny skrót (hash) z PINu do logowania
        const hashedPin = CryptoJS.SHA256(pin).toString();

        const userRef = doc(db, "users", currentUser.id);
        await updateDoc(userRef, {
            password: hashedPin,
            drawnUser: reEncryptedDrawnUser,
            isSecured: true
        });

        clearTextPin = pin;
        sessionStorage.setItem('secretSantaPin', clearTextPin);
        currentUser.password = hashedPin;
        currentUser.drawnUser = reEncryptedDrawnUser;
        currentUser.isSecured = true;
        localStorage.setItem('secretSantaUser', JSON.stringify(currentUser));

        pinError.classList.add('hidden');
        pinPanel.classList.add('hidden');
        showDashboard();
    } catch (error) {
        console.error(error);
        alert("Nie udało się zabezpieczyć konta.");
    }
});

function showDashboard() {
    loginPanel.classList.add('hidden');
    pinPanel.classList.add('hidden');
    dashboardPanel.classList.remove('hidden');
    welcomeMessage.innerText = `Cześć, ${currentUser.name}!`;

    if (currentUser.hasDrawn) {
        drawSection.classList.add('hidden');
        resultSection.classList.remove('hidden');

        try {
            // ODSZYFROWANIE WYNIKU przy użyciu PINu zapamiętanego w sesji
            const bytes = CryptoJS.AES.decrypt(currentUser.drawnUser, clearTextPin);
            const finalDrawnUser = bytes.toString(CryptoJS.enc.Utf8);
            drawnPersonText.innerText = capitalizeFirstLetter(finalDrawnUser);
        } catch (e) {
            drawnPersonText.innerText = "Błąd odczytu danych.";
        }
    } else {
        drawSection.classList.remove('hidden');
        resultSection.classList.add('hidden');
    }
}

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

logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('secretSantaUser');
    sessionStorage.removeItem('secretSantaPin');
    currentUser = null;
    clearTextPin = "";
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