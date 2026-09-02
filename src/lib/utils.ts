export const getProxiedImageUrl = (url: string | undefined | null) => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url.includes('api.dicebear.com')) return url;
  if (url.includes('wsrv.nl')) return url;
  if (url.includes('googleusercontent.com')) return url;
  
  return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
};
