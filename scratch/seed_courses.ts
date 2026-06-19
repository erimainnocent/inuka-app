
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, setDoc, doc, serverTimestamp, deleteDoc, getDocs } from 'firebase/firestore';

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

const courses = [
  {
    id: 'course_networks_1',
    title: 'Computer Networks Fundamentals',
    description: 'Understand how the internet works, HTTP vs SMTP, and the layers of communication.',
    coverImageUrl: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?q=80&w=600',
    videoUrl: 'YTDown.com_YouTube_What-is-Internet-and-How-Internet-works-_Media_G91s61R4qhs_001_1080p (1).mp4',
    category: 'Software',
    hasPdfMaterial: true,
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    createdAt: serverTimestamp(),
  },
  {
    id: 'course_ip_addressing',
    title: 'IP Addressing and Subnetting',
    description: 'Master CIDR, subnet masks, and how IP addresses are allocated in a network.',
    coverImageUrl: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?q=80&w=600',
    videoUrl: 'YTDown.com_YouTube_IP-addressing-and-Subnetting-CIDR-Subnet_Media_OqsXzkXfwRw_001_1080p.mp4',
    category: 'Software',
    hasPdfMaterial: false,
    createdAt: serverTimestamp(),
  },
  {
    id: 'course_http_smtp',
    title: 'HTTP vs SMTP: Explained',
    description: 'A deep dive into HyperText Transfer Protocol and Simple Mail Transfer Protocol.',
    coverImageUrl: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?q=80&w=600',
    videoUrl: 'YTDown.com_YouTube_HTTP-vs-SMTP-Explained-HyperText-Transfe_Media_gu_XgFJi_nE_001_1080p (1).mp4',
    category: 'Software',
    hasPdfMaterial: true,
    pdfUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    createdAt: serverTimestamp(),
  }
];

async function seed() {
  console.log('Cleaning up old courses...');
  const querySnapshot = await getDocs(collection(db, 'courses'));
  for (const docSnap of querySnapshot.docs) {
    await deleteDoc(doc(db, 'courses', docSnap.id));
  }

  console.log('Seeding new courses...');
  for (const course of courses) {
    await setDoc(doc(db, 'courses', course.id), course);
    console.log(`Seeded: ${course.title}`);
  }
  console.log('Seeding complete!');
}

seed().catch(console.error);
