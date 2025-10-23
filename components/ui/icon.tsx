// Icon.tsx
import React from 'react';

/**
 * Props for Icon component: any SVG attribute plus a fixed "name" key.
 */
export interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: (
      'house' | 'notification'
      );
}

/**
 * Map of icon names to SVG children (React nodes).
 */
const ICONS: Record<IconProps['name'], React.ReactNode> = {
  house: (
      <>
          <path
              d="M15.6666667,7 L9,7 L9,0.333333333 C9,0.149166667 8.85083333,0 8.66666667,0 L7.33333333,0 C7.14916667,0 7,0.149166667 7,0.333333333 L7,7 L0.333333333,7 C0.149166667,7 0,7.14916667 0,7.33333333 L0,8.66666667 C0,8.85083333 0.149166667,9 0.333333333,9 L7,9 L7,15.6666667 C7,15.8508333 7.14916667,16 7.33333333,16 L8.66666667,16 C8.85083333,16 9,15.8508333 9,15.6666667 L9,9 L15.6666667,9 C15.8508333,9 16,8.85083333 16,8.66666667 L16,7.33333333 C16,7.14916667 15.8508333,7 15.6666667,7 Z"
              transform="translate(8.000000, 8.000000) rotate(45.000000) translate(-8.000000, -8.000000) "
          />
      </>
  ),
  notification: (
      <>
        <path d="M20 17H22V19H2V17H4V10C4 5.58172 7.58172 2 12 2C16.4183 2 20 5.58172 20 10V17Z" />
        <path d="M9 21H15V23H9V21Z" />
      </>
  )
};

/**
 * Generic SVG Icon component. Forwards all SVG props (className, style, event handlers, etc.).
 */
export const Icon: React.FC<IconProps> = ({ name, ...svgProps }) => {
  const children = ICONS[name];
  if (!children) {
    console.warn(`Icon: no icon found for name "${name}"`);
    return null;
  }
  return (
      <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          fill="currentColor"
          {...svgProps}
      >
        {children}
      </svg>
  );
};

export default Icon;
