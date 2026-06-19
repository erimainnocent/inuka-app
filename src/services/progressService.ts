import {
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { generateCertificate } from "./certificateService";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ─── Mark a Lesson as Complete ───────────────────────────────────────────────
export async function markLessonComplete(
  userId: string,
  lessonId: string,
  courseId: string,
) {
  const progressId = `${userId}_${lessonId}`;
  const progressRef = doc(db, "lessonProgress", progressId);

  const existing = await getDoc(progressRef);
  if (existing.exists() && existing.data()?.completed) return; // already done

  const localKey = `lesson_progress_${userId}_${lessonId}`;
  await AsyncStorage.setItem(
    localKey,
    JSON.stringify({
      progressPercent: 100,
      completed: true,
      courseId,
      updatedAt: Date.now(),
    })
  );

  await setDoc(progressRef, {
    userId,
    lessonId,
    courseId,
    progressPercent: 100,
    completed: true,
    completedAt: serverTimestamp(),
  }, { merge: true });

  // Recalculate course progress
  await updateCourseProgress(userId, courseId);
}

// ─── Update Course Progress % ────────────────────────────────────────────────
export async function updateCourseProgress(userId: string, courseId: string) {
  // 1. Count total lessons for this course
  const lessonsSnap = await getDocs(
    query(collection(db, "lessons"), where("courseId", "==", courseId)),
  );
  const totalLessons = lessonsSnap.size;
  // don't return early — a course may have only quizzes

  // 2. Count completed lessons for this user+course (including partial progress)
  const progressSnap = await getDocs(
    query(
      collection(db, "lessonProgress"),
      where("userId", "==", userId),
      where("courseId", "==", courseId),
    ),
  );
  
  let completedUnitsFromLessons = 0;
  let completedLessonsCount = 0;
  
  progressSnap.docs.forEach((doc) => {
    const data = doc.data();
    if (data.completed) {
      completedUnitsFromLessons += 1;
      completedLessonsCount += 1;
    } else {
      const progressPercent = data.progressPercent || 0;
      completedUnitsFromLessons += progressPercent / 100;
    }
  });

  // 3. Check quizzes for this course and count passed quizzes for this user
  const quizzesSnap = await getDocs(
    query(collection(db, "quizzes"), where("courseId", "==", courseId)),
  );
  const totalQuizzes = quizzesSnap.size;
  let passedQuizzes = 0;

  if (totalQuizzes > 0) {
    for (const quizDoc of quizzesSnap.docs) {
      const quizData = quizDoc.data();
      const lessonId = quizData.lessonId;
      const resultId = `${userId}_${lessonId}`;
      const resultRef = doc(db, "quizResults", resultId);
      const resultSnap = await getDoc(resultRef);
      if (resultSnap.exists() && resultSnap.data()?.passed) {
        passedQuizzes += 1;
      }
    }
  }

  // 4. Calculate percentage treating each lesson and each quiz as equal units
  const totalUnits = totalLessons + totalQuizzes;
  let progress = 0;
  if (totalUnits > 0) {
    progress = Math.round(
      ((completedUnitsFromLessons + passedQuizzes) / totalUnits) * 100,
    );
  }

  // 5. Determine if course is fully complete: all lessons completed and all quizzes passed
  const allQuizzesPassed = totalQuizzes === passedQuizzes;
  const courseComplete = completedLessonsCount >= totalLessons && allQuizzesPassed;

  // 6. Update enrollment doc
  const enrollmentId = `${userId}_${courseId}`;
  const enrollmentRef = doc(db, "enrollments", enrollmentId);
  const enrollSnap = await getDoc(enrollmentRef);

  if (enrollSnap.exists()) {
    const updateData: any = {
      progress,
      completedLessonsCount: completedLessonsCount,
      totalLessonsCount: totalLessons,
    };

    if (courseComplete && !enrollSnap.data()?.completedAt) {
      updateData.completedAt = serverTimestamp();
    }

    await updateDoc(enrollmentRef, updateData);

    // Auto-generate certificate when course becomes complete
    if (courseComplete) {
      try {
        // fetch student name and course title for certificate
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        const studentName = userSnap.exists()
          ? (userSnap.data() as any).fullName ||
            (userSnap.data() as any).displayName ||
            "Student"
          : "Student";

        const courseRef = doc(db, "courses", courseId);
        const courseSnap = await getDoc(courseRef);
        const courseTitle = courseSnap.exists()
          ? (courseSnap.data() as any).title || "Course"
          : "Course";

        await generateCertificate(userId, courseId, studentName, courseTitle);
      } catch (err) {
        console.error("Error auto-generating certificate:", err);
      }
    }
  }

  return { progress, courseComplete, completedLessons: completedLessonsCount, totalLessons };
}

// ─── Check if a specific lesson is completed ────────────────────────────────
export async function isLessonCompleted(
  userId: string,
  lessonId: string,
): Promise<boolean> {
  const progressId = `${userId}_${lessonId}`;
  const progressRef = doc(db, "lessonProgress", progressId);
  const snap = await getDoc(progressRef);
  return snap.exists() && snap.data()?.completed === true;
}

// ─── Get all completed lesson IDs for a course ──────────────────────────────
export async function getCompletedLessonIds(
  userId: string,
  courseId: string,
): Promise<string[]> {
  const snap = await getDocs(
    query(
      collection(db, "lessonProgress"),
      where("userId", "==", userId),
      where("courseId", "==", courseId),
      where("completed", "==", true),
    ),
  );
  return snap.docs.map((d) => d.data().lessonId);
}

// ─── Mark a course (single-video) as complete and generate certificate ────
export async function markCourseComplete(userId: string, courseId: string) {
  try {
    const enrollmentId = `${userId}_${courseId}`;
    const enrollmentRef = doc(db, "enrollments", enrollmentId);
    const enrollSnap = await getDoc(enrollmentRef);

    const courseRef = doc(db, "courses", courseId);
    const courseSnap = await getDoc(courseRef);

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    const studentName = userSnap.exists()
      ? (userSnap.data() as any).fullName ||
        (userSnap.data() as any).displayName ||
        "Student"
      : "Student";
    const courseTitle = courseSnap.exists()
      ? (courseSnap.data() as any).title || "Course"
      : "Course";

    // Check if this course has quizzes and whether all have been passed.
    // A single-video course may still carry a quiz that must be passed (≥60%).
    const quizzesSnap = await getDocs(
      query(collection(db, "quizzes"), where("courseId", "==", courseId)),
    );
    const totalQuizzes = quizzesSnap.size;
    let allQuizzesPassed = true;

    if (totalQuizzes > 0) {
      for (const quizDoc of quizzesSnap.docs) {
        const lessonId = quizDoc.data().lessonId;
        const resultId = `${userId}_${lessonId}`;
        const resultRef = doc(db, "quizResults", resultId);
        const resultSnap = await getDoc(resultRef);
        if (!resultSnap.exists() || !resultSnap.data()?.passed) {
          allQuizzesPassed = false;
          break;
        }
      }
    }

    // If quizzes exist but are not all passed, mark the video as watched (80%)
    // but do NOT set completedAt or generate a certificate yet.
    if (totalQuizzes > 0 && !allQuizzesPassed) {
      const partialData: any = {
        progress: 80,
        completedLessonsCount: 1,
        totalLessonsCount: 1,
        videoWatched: true,
      };
      if (!enrollSnap.exists()) {
        await setDoc(enrollmentRef, {
          userId,
          courseId,
          enrolledAt: serverTimestamp(),
          ...partialData,
        });
      } else {
        await updateDoc(enrollmentRef, partialData);
      }
      // Do NOT generate certificate — quiz not yet passed
      return;
    }

    // All quizzes passed (or no quizzes) → mark course fully complete
    const updateData: any = {
      progress: 100,
      completedLessonsCount: 1,
      totalLessonsCount: 1,
    };

    if (!enrollSnap.exists()) {
      await setDoc(enrollmentRef, {
        userId,
        courseId,
        enrolledAt: serverTimestamp(),
        progress: 100,
        completedLessonsCount: 1,
        totalLessonsCount: 1,
        completedAt: serverTimestamp(),
      });
    } else {
      if (!enrollSnap.data()?.completedAt) {
        updateData.completedAt = serverTimestamp();
      }
      await updateDoc(enrollmentRef, updateData);
    }

    // Generate certificate and attach to enrollment
    await generateCertificate(userId, courseId, studentName, courseTitle);
  } catch (err) {
    console.error("Error in markCourseComplete:", err);
  }
}

const OFFLINE_QUEUE_KEY = "offline_completion_queue";

export interface OfflineAction {
  type: "lesson_completion" | "quiz_submission";
  userId: string;
  lessonId: string;
  courseId: string;
  timestamp: number;
  quizId?: string;
  score?: number;
  passed?: boolean;
  answers?: number[];
}

export async function queueOfflineAction(action: OfflineAction) {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: OfflineAction[] = raw ? JSON.parse(raw) : [];
    if (action.type === "lesson_completion") {
      const exists = queue.some(
        a => a.type === "lesson_completion" && a.userId === action.userId && a.lessonId === action.lessonId
      );
      if (exists) return;
    }
    if (action.type === "quiz_submission") {
      const idx = queue.findIndex(
        a => a.type === "quiz_submission" && a.userId === action.userId && a.lessonId === action.lessonId
      );
      if (idx !== -1) {
        queue[idx] = action;
      } else {
        queue.push(action);
      }
    } else {
      queue.push(action);
    }
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    console.log("Queued offline action:", action);
  } catch (err) {
    console.error("Failed to queue offline action:", err);
  }
}

export async function flushOfflineQueue() {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;
    const queue: OfflineAction[] = JSON.parse(raw);
    if (queue.length === 0) return;

    console.log(`Flushing ${queue.length} offline actions...`);
    const toProcess = [...queue];
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify([]));

    const failedActions: OfflineAction[] = [];

    for (const action of toProcess) {
      try {
        if (action.type === "lesson_completion") {
          const progressId = `${action.userId}_${action.lessonId}`;
          const progressRef = doc(db, "lessonProgress", progressId);
          await setDoc(progressRef, {
            userId: action.userId,
            lessonId: action.lessonId,
            courseId: action.courseId,
            progressPercent: 100,
            completed: true,
            completedAt: serverTimestamp(),
          }, { merge: true });
          await updateCourseProgress(action.userId, action.courseId);
        } else if (action.type === "quiz_submission") {
          const resultId = `${action.userId}_${action.lessonId}`;
          await setDoc(doc(db, "quizResults", resultId), {
            userId: action.userId,
            lessonId: action.lessonId,
            courseId: action.courseId || "",
            quizId: action.quizId || "",
            score: action.score || 0,
            passed: action.passed || false,
            answers: action.answers || [],
            completedAt: serverTimestamp(),
            attempts: 1,
          });
          if (action.passed && action.courseId) {
            const progressId = `${action.userId}_${action.lessonId}`;
            const progressRef = doc(db, "lessonProgress", progressId);
            await setDoc(progressRef, {
              userId: action.userId,
              lessonId: action.lessonId,
              courseId: action.courseId,
              progressPercent: 100,
              completed: true,
              completedAt: serverTimestamp(),
            }, { merge: true });
          }
          if (action.courseId) {
            await updateCourseProgress(action.userId, action.courseId);
          }
        }
      } catch (err) {
        console.error("Failed to process offline action:", action, err);
        failedActions.push(action);
      }
    }

    if (failedActions.length > 0) {
      const rawCurrent = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
      const currentQueue: OfflineAction[] = rawCurrent ? JSON.parse(rawCurrent) : [];
      const merged = [...failedActions, ...currentQueue];
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(merged));
    }
  } catch (err) {
    console.error("Error flushing offline queue:", err);
  }
}

// ─── Save Lesson Progress (Partial or Complete) ─────────────────────────────
export async function saveLessonProgress(
  userId: string,
  lessonId: string,
  courseId: string,
  progressPercent: number,
  completed: boolean
) {
  try {
    const progressId = `${userId}_${lessonId}`;
    const localKey = `lesson_progress_${userId}_${lessonId}`;
    
    const progressData = { progressPercent, completed, courseId, updatedAt: Date.now() };
    await AsyncStorage.setItem(localKey, JSON.stringify(progressData));

    try {
      const progressRef = doc(db, "lessonProgress", progressId);
      await setDoc(progressRef, {
        userId,
        lessonId,
        courseId,
        progressPercent,
        completed,
        completedAt: completed ? serverTimestamp() : null,
        lastWatchedAt: serverTimestamp(),
      }, { merge: true });

      await updateCourseProgress(userId, courseId);
    } catch (dbErr) {
      console.warn("Offline/Error saving progress to Firestore, saved locally:", dbErr);
      if (completed) {
        await queueOfflineAction({
          type: "lesson_completion",
          userId,
          lessonId,
          courseId,
          timestamp: Date.now(),
        });
      }
    }
  } catch (err) {
    console.error("Error in saveLessonProgress:", err);
  }
}

// ─── Get Lesson Progress Map ────────────────────────────────────────────────
export async function getLessonProgressMap(
  userId: string,
  courseId: string,
  lessonIds: string[]
): Promise<Record<string, { progressPercent: number; completed: boolean }>> {
  const progressMap: Record<string, { progressPercent: number; completed: boolean }> = {};
  
  try {
    const snap = await getDocs(
      query(
        collection(db, "lessonProgress"),
        where("userId", "==", userId),
        where("courseId", "==", courseId)
      )
    );
    
    snap.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.lessonId) {
        progressMap[data.lessonId] = {
          progressPercent: data.completed ? 100 : (data.progressPercent || 0),
          completed: !!data.completed,
        };
      }
    });
  } catch (err) {
    console.error("Error fetching lesson progress from Firestore:", err);
  }

  for (const lessonId of lessonIds) {
    try {
      const localKey = `lesson_progress_${userId}_${lessonId}`;
      const raw = await AsyncStorage.getItem(localKey);
      if (raw) {
        const localData = JSON.parse(raw);
        const existing = progressMap[lessonId];
        if (!existing || localData.progressPercent > existing.progressPercent || localData.completed) {
          progressMap[lessonId] = {
            progressPercent: localData.completed ? 100 : (localData.progressPercent || 0),
            completed: !!localData.completed,
          };
        }
      }
    } catch (e) {
      console.warn("Error reading local progress for lesson:", lessonId, e);
    }
  }

  return progressMap;
}
