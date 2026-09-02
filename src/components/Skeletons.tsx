export function PostCardSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 p-4 pt-5 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 w-full">
          <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/3" />
            <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-1/4" />
          </div>
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-full" />
        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-5/6" />
        <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-4/6" />
      </div>
      <div className="mb-4 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 w-full h-48" />
      <div className="flex gap-6">
        <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-8" />
        <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-8" />
      </div>
    </div>
  );
}

export function UserListSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-800">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-900 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-24" />
          </div>
          <div className="h-8 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-20" />
        </div>
      ))}
    </div>
  );
}
