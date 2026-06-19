import { doc, getDoc, setDoc, updateDoc, serverTimestamp, getDocs, collection, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { Platform } from 'react-native';

// ─── Generate a simple UUID-like certificate ID ──────────────────────────────
function generateCertId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'INUKA-';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ─── Certificate HTML Template ───────────────────────────────────────────────
function buildCertificateHtml(
  studentName: string,
  courseTitle: string,
  completionDate: string,
  certId: string,
): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Montserrat:wght@400;500;600;700&family=Dancing+Script:wght@700&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{width:842px;height:595px;font-family:'Montserrat',sans-serif;display:flex;align-items:center;justify-content:center;background:#f8f9fa;}
.cert{width:820px;height:575px;position:relative;background:#fff;border-radius:4px;box-shadow:0 10px 30px rgba(0,0,0,0.1);overflow:hidden;padding:20px;}

/* Border System */
.border-outer{position:absolute;inset:10px;border:2px solid #c5a059;pointer-events:none;}
.border-inner{position:absolute;inset:18px;border:8px double #1a1a2e;pointer-events:none;}

/* Decorative Corners */
.corner{position:absolute;width:80px;height:80px;background-repeat:no-repeat;background-size:contain;z-index:5;opacity:0.8;}
.c-tl{top:0;left:0;border-left:4px solid #c5a059;border-top:4px solid #c5a059;}
.c-tr{top:0;right:0;border-right:4px solid #c5a059;border-top:4px solid #c5a059;}
.c-bl{bottom:0;left:0;border-left:4px solid #c5a059;border-bottom:4px solid #c5a059;}
.c-br{bottom:0;right:0;border-right:4px solid #c5a059;border-bottom:4px solid #c5a059;}

/* Background Pattern */
.bg-pattern{position:absolute;inset:0;opacity:0.03;z-index:1;background-image:radial-gradient(#1a1a2e 1px, transparent 0);background-size:20px 20px;}

.content{position:relative;z-index:10;display:flex;flex-direction:column;align-items:center;height:100%;padding:40px 60px;}

/* Brand Header */
.brand{display:flex;align-items:center;gap:12px;margin-bottom:30px;}
.brand-logo{width:40px;height:40px;background:#1a1a2e;border-radius:10px;display:flex;align-items:center;justify-content:center;}
.brand-name{font-size:24px;font-weight:900;color:#1a1a2e;letter-spacing:4px;}

/* Typography */
.cert-label{font-size:12px;font-weight:700;color:#c5a059;text-transform:uppercase;letter-spacing:5px;margin-bottom:10px;}
.cert-title{font-family:'Playfair Display',serif;font-size:42px;font-weight:900;color:#1a1a2e;text-transform:uppercase;margin-bottom:5px;}
.cert-subtitle{font-size:14px;color:#666;letter-spacing:2px;margin-bottom:35px;}

.awarded-to{font-size:11px;font-weight:600;color:#999;text-transform:uppercase;letter-spacing:3px;margin-bottom:15px;}
.student-name{font-family:'Dancing Script',cursive;font-size:52px;font-weight:700;color:#1a1a2e;margin-bottom:20px;border-bottom:1px solid #eee;padding-bottom:10px;min-width:400px;text-align:center;}

.achievement{font-size:14px;color:#555;max-width:550px;text-align:center;line-height:1.6;margin-bottom:25px;}
.course-name{font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:#1a1a2e;margin-bottom:40px;padding:8px 20px;background:#f0f4f8;border-radius:4px;}

/* Bottom Section */
.footer{display:flex;justify-content:space-between;align-items:flex-end;width:100%;margin-top:auto;}
.sig-block{text-align:center;}
.signature{font-family:'Dancing Script',cursive;font-size:28px;color:#1a1a2e;margin-bottom:5px;}
.sig-line{width:180px;height:1px;background:#ccc;margin-bottom:5px;}
.sig-label{font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:1px;}

/* Seal Badge */
.seal-container{position:relative;}
.seal{width:110px;height:110px;background:#c5a059;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 5px 15px rgba(197, 160, 89, 0.3);border:4px double #fff;outline:1px solid #c5a059;}
.seal-text{font-size:10px;font-weight:900;color:#fff;text-align:center;text-transform:uppercase;letter-spacing:1px;line-height:1.2;}
.seal-ribbon{position:absolute;bottom:-20px;display:flex;gap:5px;z-index:-1;}
.ribbon{width:15px;height:40px;background:#c5a059;clip-path:polygon(0 0, 100% 0, 100% 100%, 50% 85%, 0 100%);}

.meta-info{text-align:right;}
.meta-item{font-size:9px;color:#999;margin-bottom:2px;}
.meta-value{font-size:11px;font-weight:700;color:#1a1a2e;font-family:monospace;}
</style></head>
<body>
  <div class="cert">
    <div class="border-outer"></div>
    <div class="border-inner"></div>
    <div class="bg-pattern"></div>
    <div class="corner c-tl"></div><div class="corner c-tr"></div><div class="corner c-bl"></div><div class="corner c-br"></div>
    
    <div class="content">
      <div class="brand">
        <div class="brand-logo"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="white" stroke-width="2.5"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></div>
        <span class="brand-name">INUKA</span>
      </div>
      
      <div class="cert-label">Official Certificate</div>
      <div class="cert-title">Completion</div>
      <div class="cert-subtitle">PROFESSIONAL DEVELOPMENT PROGRAM</div>
      
      <div class="awarded-to">This is to certify that</div>
      <div class="student-name">${studentName}</div>
      
      <div class="achievement">
        has successfully met all the requirements, completed the prescribed course of study, 
        and passed the final comprehensive assessments for:
      </div>
      
      <div class="course-name">${courseTitle}</div>
      
      <div class="footer">
        <div class="sig-block">
          <div class="signature">M. Karumba</div>
          <div class="sig-line"></div>
          <div class="sig-label">Training Director</div>
        </div>
        
        <div class="seal-container">
          <div class="seal">
            <div class="seal-text">OFFICIAL<br>GRADUATE<br>2026</div>
          </div>
          <div class="seal-ribbon">
            <div class="ribbon"></div>
            <div class="ribbon"></div>
          </div>
        </div>
        
        <div class="sig-block meta-info">
          <div class="meta-item">DATE ISSUED</div>
          <div class="meta-value" style="margin-bottom: 15px;">${completionDate}</div>
          <div class="meta-item">CERTIFICATE ID</div>
          <div class="meta-value">${certId}</div>
        </div>
      </div>
    </div>
  </div>
</body></html>`;
}

// ─── Build certificate HTML for viewer (exported for the viewer screen) ──────
export { buildCertificateHtml };

// ─── Generate Certificate ────────────────────────────────────────────────────
export async function generateCertificate(
  userId: string,
  courseId: string,
  studentName: string,
  courseTitle: string,
): Promise<{ certId: string; pdfUrl: string } | null> {
  try {
    const existingSnap = await getDocs(
      query(
        collection(db, 'certificates'),
        where('userId', '==', userId),
        where('courseId', '==', courseId),
      ),
    );
    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0].data();
      return { certId: existing.certificateId, pdfUrl: existing.pdfUrl };
    }

    const certId = generateCertId();
    const completionDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = buildCertificateHtml(studentName || 'Valued Student', courseTitle, completionDate, certId);
    let pdfUrl = '';

    if (Platform.OS === 'web') {
      pdfUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    } else {
      const { printToFileAsync } = await import('expo-print');
      const { uri } = await printToFileAsync({ html, width: 842, height: 595 });
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `certificates/${userId}/${courseId}.pdf`);
      await uploadBytes(storageRef, blob);
      pdfUrl = await getDownloadURL(storageRef);
    }

    const docId = `${userId}_${courseId}`;
    await setDoc(doc(db, 'certificates', docId), {
      userId,
      courseId,
      courseTitle,
      studentName,
      certificateId: certId,
      pdfUrl,
      issuedAt: serverTimestamp(),
    });

    const enrollmentRef = doc(db, 'enrollments', docId);
    const enrollSnap = await getDoc(enrollmentRef);
    if (enrollSnap.exists()) {
      await updateDoc(enrollmentRef, { certificateId: certId });
    }

    return { certId, pdfUrl };
  } catch (error) {
    console.error(`Error generating certificate for ${userId} (Course: ${courseId}):`, error);
    return null;
  }
}

// ─── Get certificates for a user ─────────────────────────────────────────────
export async function getUserCertificates(userId: string) {
  const snap = await getDocs(
    query(collection(db, 'certificates'), where('userId', '==', userId)),
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
