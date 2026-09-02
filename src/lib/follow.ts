import { doc, runTransaction, addDoc, collection } from 'firebase/firestore';
import { db } from './firebase';

export async function toggleFollowTx(followerId: string, followedId: string, followerName: string, isFollowAction: boolean) {
  if (followerId === followedId) return false;

  const followId = `${followerId}_${followedId}`;
  const followRef = doc(db, 'follows', followId);
  const followerRef = doc(db, 'users', followerId);
  const followedRef = doc(db, 'users', followedId);

  try {
    const success = await runTransaction(db, async (transaction) => {
      const followDoc = await transaction.get(followRef);
      const followerDoc = await transaction.get(followerRef);
      const followedDoc = await transaction.get(followedRef);

      const exists = followDoc.exists();

      if (isFollowAction) {
        if (!exists) {
          // Add follow
          transaction.set(followRef, { followerId, followedId, createdAt: Date.now() });
          
          const newFollowingCount = Math.max(0, (followerDoc.data()?.followingCount || 0) + 1);
          const newFollowerCount = Math.max(0, (followedDoc.data()?.followerCount || 0) + 1);
          
          transaction.update(followerRef, { followingCount: newFollowingCount });
          transaction.update(followedRef, { followerCount: newFollowerCount });
          return true;
        }
      } else {
        if (exists) {
          // Remove follow
          transaction.delete(followRef);
          
          const newFollowingCount = Math.max(0, (followerDoc.data()?.followingCount || 0) - 1);
          const newFollowerCount = Math.max(0, (followedDoc.data()?.followerCount || 0) - 1);
          
          transaction.update(followerRef, { followingCount: newFollowingCount });
          transaction.update(followedRef, { followerCount: newFollowerCount });
          return true;
        }
      }
      return false;
    });

    if (success && isFollowAction) {
      // Create notification outside transaction
      await addDoc(collection(db, 'notifications'), {
        userId: followedId,
        title: 'Novo seguidor',
        message: `${followerName} começou a seguir você.`,
        type: 'follow',
        followerId: followerId,
        createdAt: Date.now(),
        read: false
      });
    }
    
    return success;
  } catch (err) {
    console.error("Transaction failed: ", err);
    throw err;
  }
}
