import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, signInAnonymously, linkWithPopup } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, query, collection, where, getDocs } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Create user profile if it doesn't exist
    try {
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          username: user.displayName || 'Novo Usuário',
          avatar: user.photoURL || `https://api.dicebear.com/9.x/fun-emoji/svg?seed=${user.uid}`,
          email: user.email,
          isAnonymous: false,
          followerCount: 0,
          followingCount: 0,
          createdAt: Date.now(),
        });
      }
    } catch (fsErr) {
      console.warn("Could not sync user profile to Firestore immediately (offline or timeout):", fsErr);
    }
  } catch (error) {
    console.warn("Login failed", error);
  }
};

export const loginAnonymously = async (username: string, avatar: string, isAdmin: boolean = false) => {
  try {
    const guestUid = `guest_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const guestUser = {
      uid: guestUid,
      username: username || 'Atleta Anônimo',
      avatar: isAdmin ? 'https://i.redd.it/uyaiqogaqg761.jpg' : (avatar || 'https://api.dicebear.com/9.x/fun-emoji/svg?seed=Felix'),
      isAnonymous: true,
      isAdmin,
      followerCount: 0,
      followingCount: 0,
      createdAt: Date.now(),
    };

    const userRef = doc(db, 'users', guestUid);
    await setDoc(userRef, {
      username: guestUser.username,
      avatar: guestUser.avatar,
      isAnonymous: true,
      isAdmin,
      followerCount: 0,
      followingCount: 0,
      createdAt: guestUser.createdAt,
    });

    localStorage.setItem('fitfeed_guest_user', JSON.stringify(guestUser));
    return guestUser;
  } catch (error) {
    console.warn("Local anonymous login failed", error);
    throw error;
  }
};

export const getGuestUser = () => {
  const data = localStorage.getItem('fitfeed_guest_user');
  return data ? JSON.parse(data) : null;
};

export const clearGuestUser = () => {
  localStorage.removeItem('fitfeed_guest_user');
};

export const linkGoogleAccountFromGuest = async (guestUser: any) => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const googleUser = result.user;
    
    // Transfer profile to the new Google UID
    const userRef = doc(db, 'users', googleUser.uid);
    await setDoc(userRef, {
      username: guestUser.username,
      avatar: guestUser.avatar,
      email: googleUser.email,
      isAnonymous: false,
      followerCount: guestUser.followerCount || 0,
      followingCount: guestUser.followingCount || 0,
      createdAt: guestUser.createdAt || Date.now(),
    });

    // Update authorId on posts and comments created as guest
    try {
      const postsQuery = query(collection(db, 'posts'), where('authorId', '==', guestUser.uid));
      const postsSnap = await getDocs(postsQuery);
      postsSnap.docs.forEach(async (d) => {
        await updateDoc(d.ref, { authorId: googleUser.uid, authorName: googleUser.displayName || guestUser.username, authorAvatar: googleUser.photoURL || guestUser.avatar });
      });

      const commentsQuery = query(collection(db, 'comments'), where('authorId', '==', guestUser.uid));
      const commentsSnap = await getDocs(commentsQuery);
      commentsSnap.docs.forEach(async (d) => {
        await updateDoc(d.ref, { authorId: googleUser.uid, authorName: googleUser.displayName || guestUser.username, authorAvatar: googleUser.photoURL || guestUser.avatar });
      });
    } catch (e) {
      console.warn("Failed to migrate guest posts", e);
    }

    clearGuestUser();
    return googleUser;
  } catch (error) {
    console.warn("Failed to link Google account", error);
    throw error;
  }
};

export const logout = () => {
  clearGuestUser();
  return signOut(auth);
};

