import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDJlrVBBVOMVDzq1xV5Lp_7_oTCg3clQn4",
  authDomain: "bro-s-chat-5d46d.firebaseapp.com",
  projectId: "bro-s-chat-5d46d",
  storageBucket: "bro-s-chat-5d46d.appspot.com",
  messagingSenderId: "623361636710",
  appId: "1:623361636710:web:457a6afb50aa8644f570a7"
};

const app = firebase.initializeApp(firebaseConfig);

const db = app.firestore();
const auth = app.auth();
const provider = new firebase.auth.GoogleAuthProvider();

export { db, auth, provider };