import { CircleCheck, Eye, Hammer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { STATUS_LABELS, type OvaStatus } from '@/lib/ova-status';
import { cn } from '@/lib/utils';

const STYLES = {
  development: { icon: Hammer, tone: 'bg-secondary text-secondary-foreground' },
  review: { icon: Eye, tone: 'bg-warning/15 text-warning' },
  delivered: { icon: CircleCheck, tone: 'bg-success/15 text-success' },
} as const;

/** Estado de una OVA. Lleva icono y texto: nunca depende solo del color. */
export function StatusBadge({ status, className }: { status: OvaStatus; className?: string }) {
  const { icon: Icon, tone } = STYLES[status];
  return (
    <Badge variant="secondary" className={cn(tone, className)}>
      <Icon aria-hidden /> {STATUS_LABELS[status]}
    </Badge>
  );
}
