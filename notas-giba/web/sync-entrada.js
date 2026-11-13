// Kit do Firebase (banco Firestore) + gerador de QR Code, empacotados para o site.
// Só é carregado quando a sincronização entre aparelhos está ligada.
import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator, doc, collection, setDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot, writeBatch } from 'firebase/firestore';
import qrcode from 'qrcode-generator';
window.FB = { initializeApp, initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator, doc, collection, setDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot, writeBatch };
window.QR = qrcode;
