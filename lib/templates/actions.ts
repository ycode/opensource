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
    icon: 'square',
    name: 'Button',
    template: {
      name: 'button',
      classes: ['px-6', 'py-2', 'bg-blue-600', 'text-white', 'rounded-lg', 'hover:bg-blue-700', 'transition-colors'],
      text: 'Button',
      children: [], // Can contain icons, spans, etc.
      attributes: {
        type: 'button'
      },
      settings: {
        linkSettings: {
          url: '',
          target: '_self'
        }
      },
      design: {
        typography: {
          isActive: true,
          color: '#ffffff'
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
      classes: ['text-blue-600', 'hover:underline'],
      text: 'Link text',
      children: [], // Can contain icons, images, text
      attributes: {
        href: '#',
        target: '_self'
      },
      settings: {
        linkSettings: {
          url: '#',
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

