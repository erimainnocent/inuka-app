/**
 * backfill-certificates.js
 * ─────────────────────────────────────────────────────────────────────────────
 * One-time migration: generate certificates for every student who already
 * completed a course before the certificate bug fix was applied.
 *
 * Run:  node scripts/backfill-certificates.js
 *
 * Auth: uses Firebase Admin SDK with Application Default Credentials.
 *       The firebase CLI login token is picked up automatically — no
 *       separate service-account JSON key is needed.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const path = require('path');

// Initialise using the service account key in the project root
const serviceAccount = require(path.join(__dirname, '..', 'inuka-db-firebase-adminsdk-fbsvc-2c98ee03c0.json'));

initializeApp({
  credential: cert(serviceAccount),
  projectId: 'inuka-db',
});

const db = getFirestore();

// ─── Certificate ID generator (mirrors client-side logic) ────────────────────
function generateCertId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'INUKA-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function backfillCertificates() {
  console.log('\n🔍  Scanning completed enrollments (progress == 100)...\n');

  const enrollSnap = await db
    .collection('enrollments')
    .where('progress', '==', 100)
    .get();

  if (enrollSnap.empty) {
    console.log('ℹ️   No completed enrollments found. Nothing to backfill.');
    return;
  }

  console.log(`📋  Found ${enrollSnap.size} completed enrollment(s). Checking for missing certificates...\n`);

  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const enrollDoc of enrollSnap.docs) {
    const data = enrollDoc.data();
    const { userId, courseId } = data;

    if (!userId || !courseId) {
      console.warn(`  ⚠️   Skipping ${enrollDoc.id} — missing userId or courseId.`);
      skipped++;
      continue;
    }

    try {
      // Check if a certificate already exists for this user+course
      const certDocId = `${userId}_${courseId}`;
      const certRef = db.collection('certificates').doc(certDocId);
      const certSnap = await certRef.get();

      if (certSnap.exists) {
        console.log(`  ✅  [SKIP] Certificate already exists for ${certDocId}`);
        skipped++;
        continue;
      }

      // Fetch student name
      let studentName = 'Student';
      try {
        const userSnap = await db.collection('users').doc(userId).get();
        if (userSnap.exists) {
          const ud = userSnap.data();
          studentName = ud.fullName || ud.displayName || ud.email || 'Student';
        }
      } catch (_) {}

      // Fetch course title
      let courseTitle = 'Course';
      try {
        const courseSnap = await db.collection('courses').doc(courseId).get();
        if (courseSnap.exists) {
          courseTitle = courseSnap.data().title || 'Course';
        }
      } catch (_) {}

      // Build and write the certificate document
      const certId = generateCertId();
      // Prefer the stored completedAt timestamp; fall back to server time
      const issuedAt = data.completedAt || FieldValue.serverTimestamp();

      await certRef.set({
        userId,
        courseId,
        courseTitle,
        studentName,
        certificateId: certId,
        pdfUrl: '',       // No PDF for backfilled certs (no browser context available)
        issuedAt,
        backfilled: true, // Flag to identify migration-created certs
      });

      // Also stamp the enrollment with the new certificateId
      await db.collection('enrollments').doc(enrollDoc.id).update({
        certificateId: certId,
      });

      console.log(`  🎓  [CREATED] ${studentName} — "${courseTitle}" (certId: ${certId})`);
      created++;

    } catch (err) {
      console.error(`  ❌  Error processing ${enrollDoc.id}:`, err.message);
      errors++;
    }
  }

  console.log('\n──────────────────────────────────────────');
  console.log(`  ✅  Created : ${created}`);
  console.log(`  ⏭️   Skipped : ${skipped}`);
  console.log(`  ❌  Errors  : ${errors}`);
  console.log('──────────────────────────────────────────\n');
}

backfillCertificates()
  .then(() => {
    console.log('🏁  Backfill complete.\n');
    process.exit(0);
  })
  .catch((err) => {
    console.error('💥  Fatal error:', err);
    process.exit(1);
  });
