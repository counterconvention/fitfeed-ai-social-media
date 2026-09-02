const fs = require('fs');
const file = 'src/components/Feed.tsx';
let content = fs.readFileSync(file, 'utf8');

const newOnSnapshot = `    const unsubscribe = onSnapshot(q, (snapshot) => {
      const snapshotRaw = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
      
      if (activeFilter !== 'todos') {
        const newPosts = snapshotRaw.filter(p => !p.isDeleted).sort((a, b) => b.createdAt - a.createdAt);
        setHasMore(false);
        setPosts(newPosts);
        setLoading(false);
        return;
      }

      setPosts(prev => {
        if (prev.length === 0) {
          return snapshotRaw.filter(p => !p.isDeleted);
        }
        
        const prevMap = new Map(prev.map(p => [p.id, p]));
        
        snapshotRaw.forEach(p => {
          if (p.isDeleted) {
            prevMap.delete(p.id);
          } else {
            prevMap.set(p.id, p);
          }
        });
        
        return Array.from(prevMap.values()).sort((a, b) => b.createdAt - a.createdAt);
      });

      setPosts(prev => {
        if (prev.length <= 10 && snapshot.docs.length > 0) {
          setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
          setHasMore(snapshot.docs.length === 10);
        }
        return prev;
      });

      setLoading(false);
    }, (error) => {`;

content = content.replace(/const unsubscribe = onSnapshot\(q, \(snapshot\) => \{[\s\S]*?\}, \(error\) => \{/, newOnSnapshot);
fs.writeFileSync(file, content);
