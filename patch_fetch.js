const fs = require('fs');
let code = fs.readFileSync('src/components/Profile.tsx', 'utf8');

const newFetch = `
    const fetchUsersList = async () => {
      setLoadingUsersList(true);
      try {
        let userIds: string[] = [];
        if (activeTab === 'followers_list') {
          const q = query(collection(db, 'follows'), where('followedId', '==', user.uid));
          const snap = await getDocs(q);
          userIds = snap.docs.map(d => d.data().followerId);
        } else if (activeTab === 'following_list') {
          const q = query(collection(db, 'follows'), where('followerId', '==', user.uid));
          const snap = await getDocs(q);
          userIds = snap.docs.map(d => d.data().followedId);
        }
        
        if (userIds.length > 0) {
          const users: User[] = [];
          for (let i = 0; i < userIds.length; i += 10) {
            const chunk = userIds.slice(i, i + 10);
            const userQ = query(collection(db, 'users'), where('uid', 'in', chunk));
            const userSnap = await getDocs(userQ);
            userSnap.docs.forEach(d => users.push(d.data() as User));
          }
          setUsersList(users);
        } else {
          setUsersList([]);
        }
      } catch (err) {
        console.warn(err);
      } finally {
        setLoadingUsersList(false);
      }
    };

    if (!editing) {
      if (activeTab === 'saved') {
        fetchSavedPosts();
      } else if (activeTab === 'following') {
        fetchFollowingPosts();
      } else if (activeTab === 'followers_list' || activeTab === 'following_list') {
        fetchUsersList();
      }
    }
`;

code = code.replace(/if \(!editing\) \{\s*if \(activeTab === 'saved'\) \{\s*fetchSavedPosts\(\);\s*\} else \{\s*fetchFollowingPosts\(\);\s*\}\s*\}/, newFetch);
fs.writeFileSync('src/components/Profile.tsx', code);
