# CSS Modular Structure

This directory contains the modular CSS architecture for the CompareAI frontend, following 2025 best practices.

## File Structure

### Core Modules

- **`variables.css`** - CSS custom properties (design tokens)
  - Colors, spacing, typography, shadows, borders
  - Expanded with comprehensive spacing, sizing, and common value scales
  - 111 lines

- **`base.css`** - Reset and base styles
  - CSS reset, global styles, typography
  - Consolidated from `index.css` and `App.css`
  - 67 lines

- **`animations.css`** - All keyframe animations
  - `slideDown`, `pulse`, `fadeIn`, `bounce`, `rotate`, `swing`, etc.
  - Animation utility classes
  - 143 lines

- **`banners.css`** - Banner components
  - Mock mode banner, usage tracking banner
  - 95 lines

- **`components.css`** - Common UI components
  - Buttons (compare, cancel), card action buttons
  - Error and loading messages
  - 163 lines

### Legacy

- **`App.css`** - Main stylesheet that imports all modules
  - Contains legacy styles that haven't been migrated yet
  - Will be gradually reduced as more styles move to modules

## Improvements Made

1. ✅ **Removed Duplicates**
   - Removed duplicate `.provider-dropdown` and `.provider-header` styles
   - Removed duplicate `.screenshot-card-btn:hover` styles

2. ✅ **Expanded CSS Variables**
   - Added spacing scale (`--spacing-xs` through `--spacing-3xl`)
   - Added font size scale (`--font-xs` through `--font-3xl`)
   - Added font weight scale (`--font-light` through `--font-extrabold`)
   - Added line height tokens
   - Added transition tokens
   - Added z-index scale
   - Added component-specific variables (button heights, navbar height, etc.)

3. ✅ **Consolidated Global Styles**
   - Moved styles from `index.css` into `base.css`
   - All base styles now use CSS variables

4. ✅ **Modular Organization**
   - Styles grouped by purpose
   - Easier to maintain and navigate
   - Better code organization

## Usage

The modular CSS is imported in `App.css`:

```css
@import './styles/variables.css';
@import './styles/base.css';
@import './styles/animations.css';
@import './styles/banners.css';
@import './styles/components.css';
```

## Migration Path

Remaining styles in `App.css` can be gradually migrated to additional modules:

- **`navigation.css`** - Navbar, header, navigation components
- **`layout.css`** - Main layout containers, grid, sections
- **`models.css`** - Model selection, provider dropdowns, model cards
- **`results.css`** - Result cards, response display
- **`hero.css`** - Hero section styles
- **`responsive.css`** - All media queries consolidated

## Benefits

1. **Maintainability** - Easier to find and update styles
2. **Performance** - Better caching (smaller individual files)
3. **Consistency** - CSS variables ensure design consistency
4. **Scalability** - Easy to add new modules as needed
5. **Developer Experience** - Clear organization, less scrolling

## Next Steps

1. Continue migrating remaining styles from `App.css` to modules
2. Consolidate all media queries into `responsive.css`
3. Consider using CSS modules or styled-components for component-scoped styles
4. Add CSS linting/prettier for consistency

