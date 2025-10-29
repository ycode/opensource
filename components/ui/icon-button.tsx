/**
 * IconButton Component
 * 
 * Composed button with icon from ShadCN Button + Icon
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface IconButtonProps {
  icon: string;
  label?: string;
  'aria-label': string; // Required for accessibility
  size?: 'sm' | 'lg' | 'icon' | 'icon-sm' | 'default';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export function IconButton({
  icon,
  label,
  'aria-label': ariaLabel,
  size = 'icon-sm',
  variant = 'ghost',
  ...props
}: IconButtonProps) {
  return (
    <Button
      size={size}
      variant={variant}
      aria-label={ariaLabel}
      {...props}
    >
      <Icon name={icon as any} className='w-4 h-4' />
      {label && <span className='ml-2'>{label}</span>}
    </Button>
  );
}

export default IconButton;

