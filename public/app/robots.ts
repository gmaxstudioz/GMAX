import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/pay/', '/booking/verify/'],
    },
    sitemap: 'https://gmaxstudioz.com/sitemap.xml',
  };
}
