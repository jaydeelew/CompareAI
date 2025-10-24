import React from 'react';

interface FlowerIconProps {
    filledPetals: number; // Number of petals to fill (1-9)
    size?: number; // Size of the icon
    className?: string;
}

/**
 * A 9-petal wireframe flower icon where petals are filled based on the number selected.
 * Petals are arranged in a circular pattern around a center circle.
 */
const FlowerIcon: React.FC<FlowerIconProps> = ({ filledPetals, size = 20, className = '' }) => {
    // Ensure filledPetals is between 1 and 9
    const numFilled = Math.max(1, Math.min(9, filledPetals));

    // Calculate petal positions (9 petals evenly distributed)
    const petals = [];
    const centerX = 12;
    const centerY = 12;
    const petalDistance = 6; // Distance from center to petal base

    // Create teardrop-shaped petals using path
    for (let i = 0; i < 9; i++) {
        // Angle for each petal (starting from top and going clockwise)
        const angle = (i * 40 - 90) * (Math.PI / 180); // 40 degrees apart, starting at top
        const angleDeg = i * 40; // Angle in degrees for rotation

        // Position of petal base (closer to center)
        const baseX = centerX + petalDistance * Math.cos(angle);
        const baseY = centerY + petalDistance * Math.sin(angle);

        const isFilled = i < numFilled;

        // Create a teardrop shape using a path
        // The teardrop is oriented to point away from the center
        const teardropPath = `
      M 0,0
      C -1.5,-2 -2,-3.5 0,-5
      C 2,-3.5 1.5,-2 0,0
      Z
    `;

        petals.push(
            <path
                key={i}
                d={teardropPath}
                transform={`translate(${baseX}, ${baseY}) rotate(${angleDeg})`}
                fill={isFilled ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={isFilled ? 1 : 0.4}
            />
        );
    }

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            style={{ animation: 'pulse 2s ease-in-out infinite', display: 'block' }}
        >
            {/* Petals */}
            {petals}

            {/* Center circle */}
            <circle
                cx={centerX}
                cy={centerY}
                r="4"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="1.5"
            />
        </svg>
    );
};

export default FlowerIcon;

