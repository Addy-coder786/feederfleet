import { GLOSSARY } from '../data/glossary.js'

/** Hoverable technical term: <Term k="SOC">SoC</Term> */
export default function Term({ k, children }) {
  const text = GLOSSARY[k]
  if (!text) return <span>{children}</span>
  return (
    <span className="group relative term" tabIndex={0}>
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 w-60 -translate-x-1/2 rounded-md border border-line bg-white px-3 py-2 text-xs font-normal normal-case leading-snug tracking-normal text-fgb opacity-0 shadow-glow transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100">
        {text}
      </span>
    </span>
  )
}
