/**
 * CollaboratorBadge Component
 * 
 * Reusable badge showing a collaborator's initial in their assigned color.
 * Used for layer locks, collection item locks, and other collaboration features.
 */

import React from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { getUserInitials, getDisplayName } from '@/lib/collaboration-utils';
import { cn } from '@/lib/utils';

export interface CollaboratorInfo {
  userId: string;
  email?: string;
  color?: string;
}

interface CollaboratorBadgeProps {
  collaborator: CollaboratorInfo;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
  tooltipPrefix?: string; // e.g., "Editing by", "Locked by"
  className?: string;
}

const sizeClasses = {
  xs: 'w-4 h-4 text-[9px]',
  sm: 'w-5 h-5 text-[10px]',
  md: 'w-6 h-6 text-xs',
  lg: 'w-8 h-8 text-sm',
};

export function CollaboratorBadge({
  collaborator,
  size = 'sm',
  showTooltip = true,
  tooltipPrefix = 'Editing by',
  className,
}: CollaboratorBadgeProps) {
  const { email, color } = collaborator;
  
  const userColor = color || '#ef4444';
  const userInitial = email 
    ? getUserInitials(email).charAt(0).toUpperCase()
    : '?';
  const userName = email 
    ? getDisplayName(email) 
    : 'Another user';

  const badge = (
    <div 
      className={cn(
        'flex items-center justify-center rounded-full text-white font-semibold cursor-default flex-shrink-0',
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: userColor }}
    >
      {userInitial}
    </div>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {tooltipPrefix} {userName}
      </TooltipContent>
    </Tooltip>
  );
}

export default CollaboratorBadge;
