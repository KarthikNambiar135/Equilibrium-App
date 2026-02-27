import {
  UtensilsCrossed,
  ShoppingCart,
  Car,
  Home,
  Lightbulb,
  Clapperboard,
  ShoppingBag,
  Pill,
  Plane,
  Package,
  BedDouble,
  FerrisWheel,
  Ticket,
  Fuel,
  Coffee,
  Banknote,
  Coins,
  Receipt,
  Clock,
  Paperclip,
  AlertTriangle,
  Hourglass,
  Ban,
  CircleDot,
  Zap,
  Dumbbell,
  BarChart3,
  Bomb,
  Shield,
  Bug,
  Rocket,
  Sparkles,
  Crown,
  Star,
  Gift,
  Award,
  CreditCard,
  Wallet,
  Users,
  GraduationCap,
  Briefcase,
  PartyPopper,
  Tent,
  Gamepad2,
  Flame,
  Check,
  type LucideIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  // Expense categories
  'utensils-crossed': UtensilsCrossed,
  'shopping-cart': ShoppingCart,
  'car': Car,
  'home': Home,
  'lightbulb': Lightbulb,
  'clapperboard': Clapperboard,
  'shopping-bag': ShoppingBag,
  'pill': Pill,
  'plane': Plane,
  'package': Package,
  // Trip categories
  'bed-double': BedDouble,
  'ferris-wheel': FerrisWheel,
  'ticket': Ticket,
  'fuel': Fuel,
  'coffee': Coffee,
  'banknote': Banknote,
  // Stats & scoring
  'coins': Coins,
  'receipt': Receipt,
  'clock': Clock,
  'paperclip': Paperclip,
  'alert-triangle': AlertTriangle,
  'hourglass': Hourglass,
  'ban': Ban,
  'circle-dot': CircleDot,
  'zap': Zap,
  // Badge icons
  'dumbbell': Dumbbell,
  'bar-chart': BarChart3,
  'bomb': Bomb,
  'shield': Shield,
  // Misc
  'bug': Bug,
  'rocket': Rocket,
  'sparkles': Sparkles,
  'crown': Crown,
  'star': Star,
  'gift': Gift,
  'award': Award,
  'credit-card': CreditCard,
  'wallet': Wallet,
  // Group icons
  'users': Users,
  'graduation': GraduationCap,
  'food': UtensilsCrossed,
  'briefcase': Briefcase,
  'party': PartyPopper,
  'tent': Tent,
  'gamepad': Gamepad2,
  'flame': Flame,
  'check': Check,
}

interface CategoryIconProps {
  name: string
  className?: string
  size?: number
}

export default function CategoryIcon({ name, className = 'h-4 w-4', size }: CategoryIconProps) {
  const Icon = ICON_MAP[name]
  if (!Icon) return <Package className={className} size={size} />
  return <Icon className={className} size={size} />
}

export { ICON_MAP }
