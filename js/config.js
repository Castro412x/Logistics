const firebaseConfig = {
  apiKey: "AIzaSyD2ZLnNrIX4FAEdEszorREAq322CG0fVVg",
  authDomain: "logistics-32d01.firebaseapp.com",
  projectId: "logistics-32d01",
  storageBucket: "logistics-32d01.firebasestorage.app",
  messagingSenderId: "300110303178",
  appId: "1:300110303178:web:c368f3198687c4e26b0933",
  measurementId: "G-YY2522S6HT"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
