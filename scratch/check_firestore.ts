
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyB4RcbpaALO4m45G9Wwi95fcBKCHjV3uiw',
  authDomain: 'inuka-db.firebaseapp.com',
  databaseURL: 'https://inuka-db-default-rtdb.firebaseio.com',
  projectId: 'inuka-db',
  storageBucket: 'inuka-db.firebasestorage.app',
  messagingSenderId: '149150941197',
  appId: '1:149150941197:web:05903ad0f63a087bfe1544',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function checkCollections() {
  console.log('Checking users...');
  const usersSnapshot = await getDocs(collection(db, 'users'));
  console.log('Users count:', usersSnapshot.size);
  usersSnapshot.forEach(doc => console.log('User:', doc.id, doc.data()));

  console.log('Checking courses...');
  const coursesSnapshot = await getDocs(collection(db, 'courses'));
  console.log('Courses count:', coursesSnapshot.size);
  coursesSnapshot.forEach(doc => console.log('Course:', doc.id, doc.data()));
}

checkCollections().catch(console.error);
