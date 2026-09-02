import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from './firebase';

export const calculateLevel = (xp: number) => Math.floor(Math.sqrt(xp / 100)) + 1;
export const getXpForLevel = (level: number) => 100 * Math.pow(level - 1, 2);

export const getLevelProgress = (xp: number) => {
  const currentLevel = calculateLevel(xp);
  const currentLevelXp = getXpForLevel(currentLevel);
  const nextLevelXp = getXpForLevel(currentLevel + 1);
  const xpIntoLevel = xp - currentLevelXp;
  const xpRequired = nextLevelXp - currentLevelXp;
  const percentage = Math.min(100, Math.max(0, (xpIntoLevel / xpRequired) * 100));
  
  return { currentLevel, currentLevelXp, nextLevelXp, xpIntoLevel, xpRequired, percentage };
};

export const awardXP = async (userId: string, amount: number) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) return false;
    
    const userData = userSnap.data();
    const oldXp = userData.xp || 0;
    const newXp = oldXp + amount;
    const oldLevel = calculateLevel(oldXp);
    const newLevel = calculateLevel(newXp);
    
    await updateDoc(userRef, { 
      xp: increment(amount), 
      level: newLevel 
    });
    
    return newLevel > oldLevel;
  } catch (e) {
    console.error('Error awarding XP:', e);
    return false;
  }
};
