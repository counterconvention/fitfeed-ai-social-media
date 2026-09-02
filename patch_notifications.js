import fs from 'fs';

let code = fs.readFileSync('src/components/Notifications.tsx', 'utf8');

code = code.replace(
  /setNotifications\(snapshot\.docs\.map\(doc => \(\{ id: doc\.id, \.\.\.doc\.data\(\) \} as AppNotification\)\)\);/,
  `const allNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AppNotification));
      setNotifications(allNotifs.filter(n => !n.userId || n.userId === user?.uid));`
);

const followBtnCode = `
                <p className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">{notif.message}</p>
                {notif.type === 'follow' && notif.followerId && (
                  <div className="mt-3">
                    <button 
                      onClick={() => navigate('/profile')}
                      className="px-3 py-1.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                    >
                      Seguir de volta
                    </button>
                  </div>
                )}
`;

code = code.replace(/<p className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap">\{notif\.message\}<\/p>/, followBtnCode.trim());

fs.writeFileSync('src/components/Notifications.tsx', code);
