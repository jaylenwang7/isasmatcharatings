import { useId } from 'react';

// An iced strawberry matcha latte, the drink at the top of the S tier, drawn in ink
export default function MatchaCup({ className = '' }) {
  const clipId = useId();
  const cup = 'M16 40h88l-11 104c-.6 5.4-4.6 9-10 9H37c-5.4 0-9.4-3.6-10-9L16 40z';
  return (
    <svg className={className} viewBox="0 0 120 160" aria-hidden="true">
      <defs>
        <clipPath id={clipId}>
          <path d={cup} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <path fill="#fbfaf4" d="M0 40h120v120H0z" />
        <path fill="#9ab955" d="M0 50c14-4 26 3 40 0s28-5 42 0 26 2 38-1v46c-12 4-24-3-37 1s-26 7-41 1-28-2-42 1z" />
        <path fill="#c6d79a" opacity="0.7" d="M0 93c14-3 27 4 42 0 14-4 26-2 40 2s26 1 38-2v8c-12 4-25 0-38-2s-26 3-40 3-28-6-42-2z" />
        <path fill="#ec8a9b" d="M0 128c12-3 24 3 38 0s28-5 42-1 28 3 40 0v33H0z" />
        <g fill="#ffffff" fillOpacity="0.5" stroke="#1f2b1d" strokeOpacity="0.55" strokeWidth="1.6">
          <rect x="30" y="52" width="22" height="20" rx="4" transform="rotate(-12 41 62)" />
          <rect x="58" y="60" width="20" height="19" rx="4" transform="rotate(10 68 70)" />
          <rect x="40" y="78" width="18" height="17" rx="4" transform="rotate(4 49 86)" />
        </g>
        <path fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="4" strokeLinecap="round" d="M27 52l7 86" />
      </g>
      <path stroke="#1f2b1d" strokeWidth="9" strokeLinecap="round" d="M86 4L70 92" />
      <path stroke="#df4f68" strokeWidth="5" strokeLinecap="round" d="M86 4L70 92" />
      <path fill="none" stroke="#1f2b1d" strokeWidth="2.6" strokeLinejoin="round" d={cup} />
      <path fill="none" stroke="#1f2b1d" strokeWidth="2.6" strokeLinecap="round" d="M12 40h96" />
    </svg>
  );
}
