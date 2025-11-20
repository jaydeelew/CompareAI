# Image & Asset Optimization

This document describes the image and asset optimization features implemented in CompareIntel.

## Overview

CompareIntel implements comprehensive image optimization to improve performance, reduce bandwidth usage, and enhance user experience. The optimization includes:

- **Modern image formats** (WebP, AVIF) with fallbacks
- **Lazy loading** for improved initial page load
- **Responsive images** with srcset and sizes
- **Automatic optimization** via vite-imagetools
- **Proper caching headers** for static assets

## Features

### 1. Vite Image Tools Integration

The project uses [vite-imagetools](https://github.com/JonasKruckenberg/imagetools) to automatically optimize images during build time.

**Configuration** (`vite.config.ts`):
- Automatically generates WebP and AVIF variants
- Quality optimization (80% default)
- Responsive image generation
- Picture element support

**Usage**:
```typescript
// Import optimized image
import imageSrc from './image.jpg?w=1024&q=80&format=webp';

// Or use query parameters
<img src="/image.jpg?w=800&q=80" alt="Description" />
```

### 2. LazyImage Component

A reusable React component for lazy-loaded images with modern format support.

**Location**: `frontend/src/components/shared/LazyImage.tsx`

**Features**:
- Native lazy loading with Intersection Observer fallback
- WebP/AVIF support via picture element
- Progressive loading with blur placeholder
- Responsive images via srcSet
- Error handling with fallback

**Example**:
```tsx
import { LazyImage } from '@/components/shared';

<LazyImage
  src="/image.jpg"
  alt="Description"
  sources={[
    { srcSet: "/image.avif", type: "image/avif" },
    { srcSet: "/image.webp", type: "image/webp" }
  ]}
  srcSet="/image-320w.jpg 320w, /image-640w.jpg 640w"
  sizes="(max-width: 640px) 100vw, 50vw"
/>
```

**Props**:
- `src`: Image source URL (required)
- `alt`: Alternative text (required)
- `placeholder`: Optional placeholder image URL
- `blurDataURL`: Optional blur data URL for progressive loading
- `useNativeLazy`: Use native lazy loading (default: true)
- `rootMargin`: Intersection Observer root margin (default: '50px')
- `threshold`: Intersection Observer threshold (default: 0.1)
- `srcSet`: Responsive image srcset
- `sizes`: Responsive image sizes attribute
- `sources`: Picture element sources for modern formats

### 3. Image Optimization Utilities

Helper functions for image optimization.

**Location**: `frontend/src/utils/image.ts`

**Functions**:

#### `optimizeImageUrl(src, options)`
Generate optimized image URL with query parameters.

```typescript
import { optimizeImageUrl } from '@/utils/image';

const optimized = optimizeImageUrl('/image.jpg', {
  width: 800,
  quality: 80,
  format: 'webp'
});
// Returns: '/image.jpg?w=800&q=80&format=webp'
```

#### `generateSrcSet(src, widths)`
Generate responsive srcset string.

```typescript
import { generateSrcSet } from '@/utils/image';

const srcset = generateSrcSet('/image.jpg', [320, 640, 1024, 1920]);
// Returns: '/image.jpg?w=320 320w, /image.jpg?w=640 640w, ...'
```

#### `generateSizes(breakpoints)`
Generate sizes attribute for responsive images.

```typescript
import { generateSizes } from '@/utils/image';

const sizes = generateSizes({
  640: '100vw',
  1024: '50vw',
  1920: '33vw'
});
// Returns: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw'
```

#### `createOptimizedImageAttrs(src, options)`
Create optimized image attributes object.

```typescript
import { createOptimizedImageAttrs } from '@/utils/image';

const attrs = createOptimizedImageAttrs('/image.jpg', {
  alt: 'Description',
  width: 800,
  quality: 80,
  loading: 'lazy',
  responsive: true
});
```

### 4. LatexRenderer Integration

The `LatexRenderer` component automatically adds lazy loading and optimization to markdown images.

**Features**:
- Automatic `loading="lazy"` attribute
- `decoding="async"` for non-blocking decode
- Optimization query parameters for internal images
- Proper escaping for alt text and titles

**Example**:
```markdown
![Alt text](/image.jpg "Title")
```

Renders as:
```html
<img 
  src="/image.jpg?w=1024&q=80" 
  alt="Alt text" 
  title="Title" 
  loading="lazy" 
  decoding="async" 
  style="max-width: 100%; height: auto; transition: opacity 0.3s ease-in-out;" 
/>
```

### 5. Nginx Configuration

Both production and SSL nginx configurations include:

- **Modern format support**: WebP and AVIF extensions in caching rules
- **Long-term caching**: 1 year expiration for images
- **Immutable cache**: `Cache-Control: public, immutable`
- **Compression**: Gzip static compression enabled

**Configuration** (`nginx/nginx.prod.conf`, `nginx/nginx.ssl.conf`):
```nginx
# Cache images and other assets (including modern formats)
location ~* \.(png|jpg|jpeg|gif|ico|svg|webp|avif|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    # Enable compression for modern image formats
    gzip_static on;
}
```

## Best Practices

### 1. Use LazyImage for User-Uploaded Content

When displaying images that users might upload or reference:

```tsx
import { LazyImage } from '@/components/shared';

<LazyImage
  src={userImageUrl}
  alt="User uploaded image"
  useNativeLazy={true}
  rootMargin="100px"
/>
```

### 2. Optimize Images Before Upload

For best performance, optimize images before uploading:
- Use appropriate dimensions (don't upload 4K images for thumbnails)
- Compress images (aim for < 200KB for web images)
- Use appropriate formats (JPEG for photos, PNG for graphics, SVG for icons)

### 3. Use Responsive Images

Always provide responsive images for different screen sizes:

```tsx
<LazyImage
  src="/hero.jpg"
  alt="Hero image"
  srcSet="/hero-320w.jpg 320w, /hero-640w.jpg 640w, /hero-1024w.jpg 1024w, /hero-1920w.jpg 1920w"
  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 1200px"
/>
```

### 4. External Images

For external images (CDN, third-party), use basic lazy loading:

```tsx
<img 
  src="https://example.com/image.jpg" 
  alt="External image" 
  loading="lazy" 
  decoding="async"
/>
```

### 5. Progressive Loading

Use blur placeholders for better perceived performance:

```tsx
<LazyImage
  src="/image.jpg"
  alt="Description"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..." // Low-quality placeholder
/>
```

## Performance Impact

### Before Optimization
- All images loaded immediately
- No format optimization
- Large file sizes
- No lazy loading

### After Optimization
- **Lazy loading**: Images load only when needed (reduces initial page load)
- **Modern formats**: WebP/AVIF reduce file sizes by 25-50%
- **Responsive images**: Right-sized images for each device
- **Proper caching**: Long-term caching reduces repeat visits bandwidth

### Expected Improvements
- **Initial page load**: 30-50% reduction in image-related bandwidth
- **Time to Interactive**: 20-40% improvement
- **Lighthouse score**: +5-10 points for Performance
- **Bandwidth savings**: 25-50% reduction for repeat visitors

## Browser Support

### Modern Formats
- **WebP**: Supported in Chrome, Firefox, Edge, Opera (Safari 14+)
- **AVIF**: Supported in Chrome 85+, Firefox 93+, Opera 71+ (Safari 16+)

### Lazy Loading
- **Native lazy loading**: Supported in Chrome 76+, Firefox 75+, Safari 15.4+
- **Intersection Observer**: Fallback for older browsers (IE 11+)

## Troubleshooting

### Images Not Loading
1. Check browser console for errors
2. Verify image paths are correct
3. Check nginx configuration for proper MIME types
4. Verify image files exist in public directory

### Optimization Not Working
1. Ensure vite-imagetools is installed
2. Check vite.config.ts configuration
3. Verify query parameters are correct (`?w=800&q=80`)
4. Check build output for optimized images

### Lazy Loading Not Working
1. Check browser support for native lazy loading
2. Verify Intersection Observer is available (fallback)
3. Check rootMargin and threshold settings
4. Ensure images are not in viewport initially

## Future Enhancements

Potential future improvements:

1. **Image CDN Integration**: Use CDN for automatic optimization
2. **Blur Placeholder Generation**: Automatically generate blur placeholders
3. **Art Direction**: Different images for different screen sizes
4. **Image Compression API**: Server-side compression for user uploads
5. **Progressive JPEG**: Support for progressive JPEG format

## References

- [vite-imagetools Documentation](https://github.com/JonasKruckenberg/imagetools)
- [Web.dev Image Optimization](https://web.dev/fast/#optimize-your-images)
- [MDN Responsive Images](https://developer.mozilla.org/en-US/docs/Learn/HTML/Multimedia_and_embedding/Responsive_images)
- [Can I Use WebP](https://caniuse.com/webp)
- [Can I Use AVIF](https://caniuse.com/avif)
- [Can I Use Lazy Loading](https://caniuse.com/loading-lazy-attr)

