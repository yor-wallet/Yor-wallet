/** Static export: the whole site is plain files (any HTTPS static host). All data goes to Supabase through
 *  Row Level Security and SECURITY DEFINER functions; there is no server of our own holding secrets. */
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};
export default nextConfig;
