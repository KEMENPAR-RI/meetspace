// Client-safe. Literal process.env access so Next inlines it at build time (changing it needs a rebuild).
export const APP_MAINTAINER: string = process.env.NEXT_PUBLIC_APP_MAINTAINER?.trim() || 'BIRODATIN - APJAR';
