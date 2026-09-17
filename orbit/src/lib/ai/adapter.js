import { anthropicAdapter } from './anthropicAdapter.js'
import { nullAdapter } from './nullAdapter.js'

/** The server decides whether AI is on (key present and connector enabled). */
export const pickAi = (status) => (status?.available ? anthropicAdapter : nullAdapter)
