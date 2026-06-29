import type { SVGProps } from 'react'

// Vigent wordmark. Rendered with `currentColor` so it inherits the surrounding
// text color and stays visible across light/dark themes. The viewBox is cropped
// to the glyphs; aspect ratio is ~5.7:1, so set a height via className.
export function Logo({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="170 300 684 120"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Vigent"
      className={className}
      {...props}
    >
      <g transform="matrix(2.2579 0 0 2.2579 512 360.43)" fill="currentColor">
        <g transform="translate(-120.312 0)">
          <path
            transform="translate(-100 -95.8)"
            d="M 91 111.856 L 100 111.856 L 95.68 121 L 104.68 121 L 128.44 70.6 L 119.44 70.6 L 100 111.856 L 80.56 70.6 L 71.56 70.6 Z"
          />
        </g>
        <g transform="translate(-85.248 0)">
          <path
            transform="translate(-100 -95.8)"
            d="M 104.32 70.6 L 95.68 70.6 L 95.68 121 L 104.32 121 Z"
          />
        </g>
        <g transform="translate(-45.612 0)">
          <path
            transform="translate(-99.46 -95.8)"
            d="M 99.928 77.08 C 111.088 77.08 118.648 81.04 120.88 89.68 L 129.736 89.68 C 127.288 76.792 116.848 69.88 99.928 69.88 C 80.704 69.88 68.968 78.448 68.968 95.728 C 68.968 112.648 79.768 121.72 99.928 121.72 C 110.008 121.72 118.072 119.2 123.328 114.088 L 124.192 121 L 129.952 121 L 129.952 94.432 L 94.96 94.432 L 94.96 101.632 L 120.952 101.632 C 118.864 110.272 111.664 114.52 99.928 114.52 C 85.672 114.52 77.608 108.76 77.608 95.728 C 77.608 83.272 85.168 77.08 99.928 77.08 Z"
          />
        </g>
        <g transform="translate(14.832 0)">
          <path
            transform="translate(-100 -95.8)"
            d="M 76.924 121 L 124.876 121 L 124.876 113.8 L 85.564 113.8 L 85.564 98.68 L 123.436 98.68 L 123.436 91.48 L 85.564 91.48 L 85.564 77.8 L 124.876 77.8 L 124.876 70.6 L 76.924 70.6 Z"
          />
        </g>
        <g transform="translate(71.136 0)">
          <path
            transform="translate(-99.964 -95.8)"
            d="M 121.708 112.36 L 121.204 112.864 L 83.62 70.6 L 72.964 70.6 L 72.964 121 L 81.604 121 L 81.604 88.384 C 81.604 82.912 80.596 79.672 78.22 76.936 L 78.724 76.432 L 118.324 121 L 126.964 121 L 126.964 70.6 L 118.324 70.6 L 118.324 100.912 C 118.324 106.384 119.332 109.624 121.708 112.36 Z"
          />
        </g>
        <g transform="translate(124.776 0)">
          <path
            transform="translate(-99.964 -95.8)"
            d="M 101.332 78.52 L 101.332 77.8 L 75.988 77.8 L 75.988 70.6 L 123.94 70.6 L 123.94 77.8 L 104.284 77.8 L 104.284 121 L 95.644 121 L 95.644 85 C 95.644 81.904 96.868 78.52 101.332 78.52 Z"
          />
        </g>
      </g>
    </svg>
  )
}
