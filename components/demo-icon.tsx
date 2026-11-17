export default function Icon({ name, className = "" }: { name: "mic" | "chat" | "visit" | "home" | "chevron" | "prescription" | "volume"; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {name === "mic" && <><rect x="11" y="3" width="10" height="18" rx="5" /><path d="M6.5 15v2a9.5 9.5 0 0 0 19 0v-2M16 26.5V31M11 31h10" /></>}
      {name === "chat" && <path d="M28 14.5a12 12 0 0 1-17.5 10.7L3 28l2.8-7.3A12 12 0 1 1 28 14.5Z" />}
      {name === "visit" && <><rect x="7" y="3" width="18" height="26" rx="3" /><path d="M12 9h8M12 14h8M12 19h5" /></>}
      {name === "home" && <><path d="m3 14 13-11 13 11M6 12v17h7V19h6v10h7V12" /></>}
      {name === "prescription" && <><path d="m12 25 13-13a7.1 7.1 0 0 0-10-10L2 15a7.1 7.1 0 0 0 10 10Z" transform="translate(2 2)" /><path d="m11 11 10 10" /></>}
      {name === "chevron" && <path d="m12 7 9 9-9 9" />}
      {name === "volume" && (
        <>
          <path d="M11 12H6v8h5l7 5V7l-7 5Z" />
          <path d="M22 11a7 7 0 0 1 0 10" />
          <path d="M26 8a12 12 0 0 1 0 16" />
        </>
      )}
    </svg>
  );
}

