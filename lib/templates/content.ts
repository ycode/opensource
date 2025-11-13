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
    icon: 'text',
    name: 'Heading',
    template: {
      name: 'h2',
      classes: ['text-[1.875rem]', 'font-[700]', 'text-[#111827]'],
      text: 'Heading',
      children: [], // Can contain inline elements
      design: {
        typography: {
          isActive: true,
          fontSize: '1.875rem',
          fontWeight: '700',
          color: '#111827'
        }
      }
    }
  },

  p: {
    icon: 'text',
    name: 'Paragraph',
    template: {
      name: 'p',
      classes: ['text-[1rem]', 'text-[#111827]'],
      text: 'This is a paragraph. Edit this text to customize it.',
      children: [], // Can contain inline elements
      formattable: true,
      design: {
        typography: {
          isActive: true,
          fontSize: '1rem',
          color: '#111827'
        }
      }
    }
  },

  span: {
    icon: 'text',
    name: 'Text',
    template: {
      name: 'span',
      classes: ['text-[1rem]', 'text-[#111827]'],
      text: 'Text',
      children: [], // Can contain inline elements
      formattable: true,
      design: {
        typography: {
          isActive: true,
          fontSize: '1rem',
          color: '#111827'
        }
      }
    }
  },

  // Legacy 'text' type (maps to span)
  text: {
    icon: 'text',
    name: 'Text',
    template: {
      name: 'span',
      classes: ['text-[1rem]', 'text-[#111827]'],
      text: 'Text',
      children: [], // Can contain inline elements
      formattable: true,
      design: {
        typography: {
          isActive: true,
          fontSize: '1rem',
          color: '#111827'
        }
      }
    }
  },

  richtext: {
    icon: 'text',
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

