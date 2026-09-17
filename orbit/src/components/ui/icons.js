// The one icon set (Lucide). No emoji anywhere in the interface.
import {
  Briefcase,
  CalendarDays,
  Check,
  CircleHelp,
  Coffee,
  Dumbbell,
  Gift,
  Hand,
  House,
  MessageSquare,
  MessagesSquare,
  Minus,
  Moon,
  Mountain,
  PartyPopper,
  Pause,
  Phone,
  Plane,
  Play,
  Plug,
  Search,
  Settings,
  Sparkles,
  StickyNote,
  Sun,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  X,
} from 'lucide-react'

export { Check, CircleHelp, Gift, Moon, Pause, Play, Plug, Search, Settings, Sparkles, Sun, X }

export const KIND_ICON = {
  Hangout: Coffee,
  'Ran into': Hand,
  Dinner: UtensilsCrossed,
  Hike: Mountain,
  Gym: Dumbbell,
  Party: PartyPopper,
  'Family event': House,
  Meeting: CalendarDays,
  Work: Briefcase,
  Trip: Plane,
  Call: Phone,
  Text: MessageSquare,
  Conversation: MessagesSquare,
  Note: StickyNote,
}

export const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus }
