import { db } from '../config/firebase';
import {
  collection,
  getDocs,
  setDoc,
  doc,
  serverTimestamp,
  addDoc,
  query,
  where,
} from 'firebase/firestore';

/**
 * Demo Seeder Service
 * 
 * This service populates the database with realistic progress data for demo purposes.
 * It simulates students enrolling in courses, watching lessons, passing quizzes, 
 * and earning certificates.
 */
export const seedDemoData = async () => {
  console.log('Seeding demo data...');
  
  try {
    // 1. Get Students
    const usersSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'student')));
    const students = usersSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));
    
    if (students.length === 0) {
      throw new Error('No students found. Please create at least one student user first.');
    }

    // 2. Get Courses
    const coursesSnap = await getDocs(collection(db, 'courses'));
    const courses = coursesSnap.docs.map(d => ({ id: d.id, ...d.data() as any }));

    if (courses.length === 0) {
      throw new Error('No courses found. Please create courses in the Manage tab first.');
    }

    // 3. Process each student
    let enrollmentCount = 0;
    for (const student of students) {
      // Pick up to 3 courses for each student
      const selectedCourses = courses.slice(0, 3);
      
      for (const course of selectedCourses) {
        const enrollmentId = `${student.id}_${course.id}`;
        
        // Randomize progress
        const isCompleted = Math.random() > 0.4; // 60% chance of completion
        const progress = isCompleted ? 100 : Math.floor(Math.random() * 70) + 15;
        
        // Create Enrollment
        await setDoc(doc(db, 'enrollments', enrollmentId), {
          userId: student.id,
          courseId: course.id,
          userName: student.displayName || 'Student',
          progress: progress,
          completed: isCompleted,
          watchedMinutes: Math.floor(Math.random() * 150) + 45,
          lastAccessed: serverTimestamp(),
          enrolledAt: serverTimestamp(),
        }, { merge: true });

        enrollmentCount++;

        // Seed Lesson Progress
        const lessonsSnap = await getDocs(query(collection(db, 'lessons'), where('courseId', '==', course.id)));
        const lessons = lessonsSnap.docs;
        
        if (lessons.length > 0) {
          const watchedCount = isCompleted ? lessons.length : Math.floor((progress / 100) * lessons.length);
          
          for (let i = 0; i < watchedCount; i++) {
            const lessonId = lessons[i].id;
            const progressId = `${student.id}_${lessonId}`;
            await setDoc(doc(db, 'lessonProgress', progressId), {
              userId: student.id,
              lessonId: lessonId,
              courseId: course.id,
              completed: true,
              watchedAt: serverTimestamp(),
            }, { merge: true });
          }
        }

        // If completed, add Quiz Result and Certificate
        if (isCompleted) {
          // Add Quiz Result (Simplified)
          await addDoc(collection(db, 'quizResults'), {
            userId: student.id,
            courseId: course.id,
            score: 85 + Math.floor(Math.random() * 15),
            passed: true,
            totalQuestions: 5,
            correctAnswers: 4,
            completedAt: serverTimestamp(),
          });

          // Add Certificate
          const certId = `cert_${Date.now()}_${student.id.substring(0, 5)}`;
          await setDoc(doc(db, 'certificates', certId), {
            userId: student.id,
            courseId: course.id,
            courseTitle: course.title,
            userName: student.displayName || 'Student',
            issueDate: serverTimestamp(),
            id: certId,
          });
        }
      }
    }

    return { 
      success: true, 
      message: `Successfully seeded ${enrollmentCount} enrollments across ${students.length} students.` 
    };
  } catch (e: any) {
    console.error('Seeding Error:', e);
    return { success: false, message: e.message };
  }
};
