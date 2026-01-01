/**
 * Utility Elements Templates
 */

import { BlockTemplate } from '@/types';
import { getTemplateRef } from './blocks';

export const utilityTemplates: Record<string, BlockTemplate> = {
  map: {
    icon: 'block',
    name: 'Map',
    template: {
      name: 'map',
      classes: ['w-full', 'h-full'],
      children: [],
    },
  },

  lemonSqueezy: {
    icon: 'block',
    name: 'Lemon Squeezy',
    template: {
      name: 'lemonSqueezy',
      classes: ['w-full', 'h-full'],
      children: [],
    },
  },

  lightbox: {
    icon: 'block',
    name: 'Lightbox',
    template: {
      name: 'lightbox',
      classes: ['w-full', 'h-full'],
      children: [],
    },
  },

  slider: {
    icon: 'block',
    name: 'Slider',
    template: {
      name: 'slider',
      classes: ['w-full', 'h-full'],
      children: [],
    },
  },

  localeSelector: {
    icon: 'globe',
    name: 'Locales',
    template: getTemplateRef('div', {
      customName: 'Locales',
      name: 'localeSelector',
      open: true,
      children: [
        getTemplateRef('span', {
          text: 'English',
          customName: 'Locale',
        }),
        getTemplateRef('icon', {
          customName: 'Icon',
        }),
      ],
      attributes: {
        display_type: 'name',
      },
      classes: [
        'flex',
        'items-center',
        'pt-[10px]',
        'pb-[10px]',
        'relative',
        'border-[1px]',
        'pl-[12px]',
        'pr-[12px]',
        'bg-opacity-[100%]',
        'bg-[#F5F5F5]',
        'border-opacity-[0%]',
        'border-[#000000]',
        'w-[max-content]',
        'text-[16px]',
        'rounded-[12px]',
        'text-opacity-[100%]',
        'text-[#171717]',
        'font-medium',
        'tracking-[-0.025em]',
        'gap-[6px]',
      ],
      design: {
        layout: {
          isActive: false,
          display: 'Flex',
          gap: '6px',
          alignItems: 'center',
        },
        sizing: {
          isActive: false,
          width: 'max-content',
        },
        spacing: {
          isActive: true,
          paddingLeft: '12px',
          paddingRight: '12px',
          paddingBottom: '10px',
          paddingTop: '10px',
        },
        backgrounds: {
          isActive: true,
          backgroundColor: '#f5f5f5',
        },
        typography: {
          isActive: true,
          fontSize: '16px',
          letterSpacing: '-0.025em',
          color: '#171717',
          fontWeight: '500',
        },
        borders: {
          isActive: true,
          borderColor: '#000000',
          borderRadius: '12px',
          borderWidth: '1px',
        },
      },
    }),
  },
};
