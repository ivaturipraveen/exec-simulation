/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin when the UI is hosted apart from the API (Render static site). Empty = same host. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
