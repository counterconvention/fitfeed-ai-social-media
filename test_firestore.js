import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, limit, query } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function test() {
  const q = query(collection(db, 'posts'), limit(1));
  const snap = await getDocs(q);
  snap.forEach(doc => console.log(doc.id, doc.data()));
  process.exit(0);
}
test();
