/**
 * Action Elements Templates
 */

import { Layer } from '@/types';

interface BlockTemplate {
  icon: string;
  name: string;
  template: Omit<Layer, 'id'>;
}

export const actionTemplates: Record<string, BlockTemplate> = {
  button: {
    icon: 'block',
    name: 'Button',
    template: {
      name: 'button',
      classes: ['flex', 'flex-row', 'items-center', 'justify-center', 'text-[#FFFFFF]', 'pr-[20px]', 'pl-[20px]', 'pt-[10px]', 'pb-[10px]', 'text-[16px]', 'rounded-[12px]', 'bg-[#171717]'],
      children: [
        {
          id: 'button-text',
          name: 'text',
          classes: [],
          text: 'Button',
          children: [],
          design: {}
        }
      ],
      attributes: {
        type: 'button'
      },
      settings: {
        linkSettings: {
          href: '',
          target: '_self'
        }
      },
      design: {
        typography: {
          isActive: true,
          color: '#ffffff',
          fontSize: '16px',
        },
        spacing: {
          isActive: true,
          paddingLeft: '1.5rem',
          paddingRight: '1.5rem',
          paddingTop: '0.5rem',
          paddingBottom: '0.5rem'
        },
        borders: {
          isActive: true,
          borderRadius: '0.5rem'
        },
        backgrounds: {
          isActive: true,
          backgroundColor: '#2563eb'
        }
      }
    }
  },

  link: {
    icon: 'link',
    name: 'Link',
    template: {
      name: 'a',
      classes: ['text-[#2563eb]', 'hover:underline'],
      text: 'Link text',
      children: [], // Can contain icons, images, text
      attributes: {
        href: '#',
        target: '_self'
      },
      settings: {
        linkSettings: {
          href: '#',
          target: '_self'
        }
      },
      design: {
        typography: {
          isActive: true,
          color: '#2563eb',
          textDecoration: 'none'
        }
      }
    }
  }
};
