# Social Sharing Image Guide

This guide explains how to create and configure an optimized social sharing image for CompareIntel.

## Why a Dedicated Social Sharing Image?

Social sharing images (Open Graph images) appear when your site is shared on:
- Facebook
- LinkedIn
- Twitter/X
- Slack
- Discord
- Other social platforms

A dedicated image optimized for social previews provides:
- Better visual appeal in social feeds
- Higher click-through rates
- Professional brand presentation
- Consistent messaging

## Recommended Specifications

### Dimensions
- **Optimal Size**: 1200 x 630 pixels (1.91:1 aspect ratio)
- **Minimum Size**: 600 x 315 pixels
- **Maximum Size**: 1200 x 1200 pixels
- **File Size**: Under 8MB (aim for under 1MB)

### Format
- **PNG**: Best for graphics with text/transparency
- **JPG**: Best for photos (smaller file size)
- **WebP**: Modern format (supported by most platforms)

### Design Guidelines

1. **Safe Zone**: Keep important content within 1200x630px, as platforms may crop edges
2. **Text Readability**: Use large, bold fonts (minimum 24px for body text)
3. **Brand Consistency**: Use your brand colors:
   - Primary: `#2563eb` (blue)
   - Accent: `#0ea5e9` (sky blue)
   - Text: `#0f172a` (dark) or `#ffffff` (white)
4. **Logo Placement**: Include CompareIntel logo prominently
5. **Key Message**: Highlight your value proposition:
   - "Compare 50+ AI Models Side-by-Side"
   - "GPT-4, Claude, Gemini, Llama & More"
   - "Free Tier Available"

## Tools to Create the Image

### Option 1: Online Design Tools (Easiest)
- **Canva** (https://www.canva.com/)
  - Search for "Facebook Post" or "Social Media Post" templates
  - Custom size: 1200 x 630px
  - Free tier available
  
- **Figma** (https://www.figma.com/)
  - Professional design tool
  - Free for personal use
  - Create frame: 1200 x 630px

- **Adobe Express** (https://www.adobe.com/express/)
  - Free online tool
  - Social media templates available

### Option 2: Command-Line Tools
If you have ImageMagick installed:
```bash
# Create a base image with your logo
convert -size 1200x630 xc:white \
  -gravity center \
  -pointsize 48 -fill "#2563eb" \
  -annotate +0-100 "CompareIntel" \
  -pointsize 32 -fill "#0f172a" \
  -annotate +0+0 "Compare 50+ AI Models Side-by-Side" \
  CompareIntel-social.png
```

### Option 3: Python Script
Create a simple script using PIL/Pillow:
```python
from PIL import Image, ImageDraw, ImageFont

# Create image
img = Image.new('RGB', (1200, 630), color='#ffffff')
draw = ImageDraw.Draw(img)

# Add text (you'll need to load fonts)
# draw.text((600, 315), "CompareIntel", fill="#2563eb", anchor="mm")
# ... add more elements

img.save('CompareIntel-social.png')
```

### Option 4: Design Software
- **Photoshop**: Professional tool
- **GIMP**: Free alternative
- **Sketch**: Mac design tool
- **Affinity Designer**: One-time purchase alternative

## Design Template Ideas

### Template 1: Simple & Clean
```
┌─────────────────────────────────────┐
│                                     │
│         [CompareIntel Logo]         │
│                                     │
│   Compare 50+ AI Models             │
│   Side-by-Side                      │
│                                     │
│   GPT-4 • Claude • Gemini • Llama  │
│                                     │
│         [Visual Element]            │
│                                     │
└─────────────────────────────────────┘
```

### Template 2: Feature-Focused
```
┌─────────────────────────────────────┐
│  [Background Pattern/Color]         │
│                                     │
│  CompareIntel                       │
│                                     │
│  ✓ 50+ AI Models                    │
│  ✓ Side-by-Side Comparison         │
│  ✓ LaTeX & Markdown Support         │
│  ✓ Free Tier Available              │
│                                     │
│  compareintel.com                   │
└─────────────────────────────────────┘
```

## Steps to Implement

### Option A: Use the Python Script (Quickest)

1. **Install Pillow** (if not already installed):
   ```bash
   pip install Pillow
   ```

2. **Run the script**:
   ```bash
   python scripts/create-social-image.py
   ```
   
   This creates `frontend/public/CompareIntel-social.png` (1200x630px)

3. **Update meta tags** (see Option B step 3 below)

### Option B: Manual Creation

1. **Create the Image**
   - Use one of the tools above (Canva, Figma, etc.)
   - Save as `CompareIntel-social.png` or `CompareIntel-social.jpg`
   - Place in `frontend/public/` directory
   - Ensure dimensions are 1200x630px

2. **Optimize the Image**
   ```bash
   # Using ImageMagick (if installed)
   convert CompareIntel-social.png -quality 85 -strip CompareIntel-social-optimized.png
   
   # Or use online tools like TinyPNG or Squoosh
   ```

3. **Update Meta Tags in `frontend/index.html`**
   
   Change these lines:
   ```html
   <!-- Change from: -->
   <meta property="og:image" content="https://compareintel.com/CompareIntel.png" />
   <meta property="og:image:width" content="1024" />
   <meta property="og:image:height" content="1024" />
   
   <!-- To: -->
   <meta property="og:image" content="https://compareintel.com/CompareIntel-social.png" />
   <meta property="og:image:width" content="1200" />
   <meta property="og:image:height" content="630" />
   ```
   
   Also update Twitter image:
   ```html
   <!-- Change from: -->
   <meta name="twitter:image" content="https://compareintel.com/CompareIntel.png" />
   
   <!-- To: -->
   <meta name="twitter:image" content="https://compareintel.com/CompareIntel-social.png" />
   ```

4. **Test**
   - Use Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
   - Click "Scrape Again" to refresh Facebook's cache
   - Use Twitter Card Validator: https://cards-dev.twitter.com/validator
   - Use LinkedIn Post Inspector: https://www.linkedin.com/post-inspector/

## Current Configuration

Currently using: `CompareIntel.png` (1024x1024)
- This is a square logo, good for navbar but not optimal for social sharing
- The new social image should be 1200x630 (landscape format)

## Quick Reference: Brand Colors

```css
Primary Blue:   #2563eb
Accent Blue:    #0ea5e9
Dark Text:      #0f172a
Light Text:     #ffffff
Background:     #ffffff
Secondary BG:   #f8fafc
```

## Resources

- [Facebook Sharing Best Practices](https://developers.facebook.com/docs/sharing/webmasters)
- [Twitter Card Documentation](https://developer.twitter.com/en/docs/twitter-for-websites/cards/overview/abouts-cards)
- [Open Graph Protocol](https://ogp.me/)
- [Social Media Image Sizes Guide](https://sproutsocial.com/insights/social-media-image-sizes-guide/)

