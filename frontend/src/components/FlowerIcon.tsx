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
    const petalDistance = 7; // Distance from center to petal center
    const petalWidth = 3.5; // Width of each petal
    const petalHeight = 5; // Height of each petal

    for (let i = 0; i < 9; i++) {
        // Angle for each petal (starting from top and going clockwise)
        const angle = (i * 40 - 90) * (Math.PI / 180); // 40 degrees apart, starting at top

        // Position of petal center
        const petalX = centerX + petalDistance * Math.cos(angle);
        const petalY = centerY + petalDistance * Math.sin(angle);

        // Create ellipse for petal
        const isFilled = i < numFilled;

        petals.push(
            <ellipse
                key={i}
                cx={petalX}
                cy={petalY}
                rx={petalWidth}
                ry={petalHeight}
                transform={`rotate(${i * 40} ${petalX} ${petalY})`}
                fill={isFilled ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.5"
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
                r="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
            />
        </svg>
    );
};

export default FlowerIcon;

