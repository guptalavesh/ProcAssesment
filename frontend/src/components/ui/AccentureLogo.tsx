interface Props {
  className?: string
}

// AIVault wordmark — mark + "AIVault" set in Inter. Single-color via
// currentColor so callers can recolor with Tailwind text-* utilities.
export default function AccentureLogo({ className }: Props) {
  return (
    <svg
      viewBox="0 0 168 32"
      fill="none"
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth="1.6"
      className={className}
      role="img"
      aria-label="AIVault"
    >
      <path d="M16 4L27 10.25V19.75L16 26L5 19.75V10.25L16 4Z" />
      <path
        d="M16 11.25L21 14.0833V18.9167L16 21.75L11 18.9167V14.0833L16 11.25Z"
        fill="currentColor"
      />
      <text
        x="40"
        y="22"
        fill="currentColor"
        stroke="none"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="19"
        fontWeight="600"
        letterSpacing="-0.4"
      >
        AIVault
      </text>
    </svg>
  )
}
