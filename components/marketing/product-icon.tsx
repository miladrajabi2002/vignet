import type { ComponentType } from 'react'
import {
	BarChart3,
	BookOpenCheck,
	Box,
	BriefcaseBusiness,
	CalendarCheck2,
	Forward,
	GraduationCap,
	Link2,
	MessageCircleMore,
	MessagesSquare,
	Mic,
	Sparkles,
	Store,
	Target,
	UtensilsCrossed,
} from 'lucide-react'
import { InstagramIcon } from './social-links'
import type { IconName } from './home-variants/shared/content'

type IconComponent = ComponentType<{ className?: string }>

const ICONS: Record<IconName, IconComponent> = {
	book: BookOpenCheck,
	box: Box,
	messages: MessagesSquare,
	users: MessageCircleMore,
	store: Store,
	calendar: CalendarCheck2,
	utensils: UtensilsCrossed,
	briefcase: BriefcaseBusiness,
	graduation: GraduationCap,
	instagram: InstagramIcon,
	mic: Mic,
	chart: BarChart3,
	handoff: Forward,
	spark: Sparkles,
	target: Target,
	plug: Link2,
}

/** Server-compatible icon registry for the homepage's static sections. */
export function ProductIcon({ name, className }: { name: IconName; className?: string }) {
	const Icon = ICONS[name] ?? Sparkles
	return <Icon aria-hidden className={className} />
}
