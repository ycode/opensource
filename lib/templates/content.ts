/**
 * Content Elements Templates
 */

import { Layer } from '@/types';

interface BlockTemplate {
  icon: string;
  name: string;
  template: Omit<Layer, 'id'>;
}

export const contentTemplates: Record<string, BlockTemplate> = {
  heading: {
    icon: 'heading',
    name: 'Heading',
    template: {
      name: 'h1',
      classes: ['text-[48px]', 'font-[700]'],
      text: 'Heading',
      children: [], // Can contain inline elements
      design: {
        typography: {
          isActive: true,
          fontSize: '48px',
          fontWeight: '700',
        }
      }
    }
  },

  p: {
    icon: 'text',
    name: 'Text',
    template: {
      name: 'p',
      classes: ['text-[16px]'],
      text: 'Text',
      children: [], // Can contain inline elements
      formattable: true,
      design: {
        typography: {
          isActive: true,
          fontSize: '16px',
        }
      }
    }
  },

  span: {
    icon: 'text',
    name: 'Text',
    template: {
      name: 'span',
      classes: ['text-[16px]'],
      text: 'Text',
      children: [], // Can contain inline elements
      formattable: true,
      design: {
        typography: {
          isActive: true,
          fontSize: '16px',
        }
      }
    }
  },

  richtext: {
    icon: 'rich-text',
    name: 'Rich Text',
    template: {
      name: 'div',
      classes: ['prose', 'max-w-none'],
      text: '<p>This is rich text content. You can format it with <strong>bold</strong>, <em>italic</em>, and more.</p>',
      children: [], // Can contain any elements
      formattable: true,
      design: {
        typography: {
          isActive: true
        }
      }
    }
  }
};
