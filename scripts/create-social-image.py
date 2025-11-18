#!/usr/bin/env python3
"""
Create a social sharing image for CompareIntel (1200x630px)

Requirements:
    pip install Pillow

Usage:
    python scripts/create-social-image.py
"""

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Error: Pillow is required. Install it with: pip install Pillow")
    exit(1)

import os

# Brand colors
PRIMARY_BLUE = "#2563eb"
ACCENT_BLUE = "#0ea5e9"
DARK_TEXT = "#0f172a"
WHITE = "#ffffff"
BG_COLOR = "#ffffff"

# Image dimensions
WIDTH = 1200
HEIGHT = 630

def create_social_image(output_path="frontend/public/CompareIntel-social.png"):
    """Create a social sharing image"""
    
    # Create base image
    img = Image.new('RGB', (WIDTH, HEIGHT), color=BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    # Try to load fonts (fallback to default if not available)
    try:
        # Try to use system fonts
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 72)
        subtitle_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 36)
        tagline_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
    except:
        try:
            # Try macOS fonts
            title_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 72)
            subtitle_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 36)
            tagline_font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
        except:
            # Fallback to default font
            title_font = ImageFont.load_default()
            subtitle_font = ImageFont.load_default()
            tagline_font = ImageFont.load_default()
            print("Warning: Using default font. Install system fonts for better results.")
    
    # Draw background gradient (simple version - solid color with accent)
    # Top section with primary blue
    draw.rectangle([(0, 0), (WIDTH, 200)], fill=PRIMARY_BLUE)
    
    # Draw decorative elements
    # Circles pattern
    for i in range(5):
        x = 100 + (i * 250)
        y = 100
        draw.ellipse([x-30, y-30, x+30, y+30], fill=ACCENT_BLUE, outline=None)
    
    # Main title
    title = "CompareIntel"
    title_bbox = draw.textbbox((0, 0), title, font=title_font)
    title_width = title_bbox[2] - title_bbox[0]
    title_x = (WIDTH - title_width) // 2
    draw.text((title_x, 80), title, fill=WHITE, font=title_font)
    
    # Subtitle
    subtitle = "Compare 50+ AI Models Side-by-Side"
    subtitle_bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
    subtitle_width = subtitle_bbox[2] - subtitle_bbox[0]
    subtitle_x = (WIDTH - subtitle_width) // 2
    draw.text((subtitle_x, 160), subtitle, fill=WHITE, font=subtitle_font)
    
    # Features section (white background)
    features_y = 280
    features = [
        "✓ GPT-4, Claude, Gemini, Llama & More",
        "✓ LaTeX & Markdown Rendering",
        "✓ Free Tier Available"
    ]
    
    for i, feature in enumerate(features):
        feature_bbox = draw.textbbox((0, 0), feature, font=tagline_font)
        feature_width = feature_bbox[2] - feature_bbox[0]
        feature_x = (WIDTH - feature_width) // 2
        draw.text((feature_x, features_y + (i * 50)), feature, fill=DARK_TEXT, font=tagline_font)
    
    # Website URL at bottom
    url = "compareintel.com"
    url_bbox = draw.textbbox((0, 0), url, font=tagline_font)
    url_width = url_bbox[2] - url_bbox[0]
    url_x = (WIDTH - url_width) // 2
    draw.text((url_x, HEIGHT - 60), url, fill=ACCENT_BLUE, font=tagline_font)
    
    # Save image
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    img.save(output_path, "PNG", optimize=True)
    print(f"✓ Created social sharing image: {output_path}")
    print(f"  Dimensions: {WIDTH}x{HEIGHT}px")
    
    # Check file size
    file_size = os.path.getsize(output_path) / 1024  # KB
    print(f"  File size: {file_size:.1f} KB")
    
    if file_size > 1000:
        print("  ⚠ Warning: File size is large. Consider optimizing with TinyPNG or similar.")

if __name__ == "__main__":
    create_social_image()

