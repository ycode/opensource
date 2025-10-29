/**
 * Structure Elements Templates
 */

import { Layer } from '@/types';

interface BlockTemplate {
  icon: string;
  name: string;
  template: Omit<Layer, 'id'>;
}

export const structureTemplates: Record<string, BlockTemplate> = {
  div: {
    icon: 'block',
    name: 'Block',
    template: {
      name: 'div',
      classes: ['block'],
      children: [],
      design: {
        layout: { isActive: true, display: 'Block' }
      }
    }
  },
  
  section: {
    icon: 'section',
    name: 'Section',
    template: {
      name: 'section',
      classes: ['flex', 'flex-col', 'gap-4', 'py-12'],
      children: [],
      design: {
        layout: { isActive: true, display: 'Flex', flexDirection: 'column' },
        spacing: { isActive: true, paddingTop: '3rem', paddingBottom: '3rem' }
      }
    }
  },
  
  container: {
    icon: 'container',
    name: 'Container',
    template: {
      name: 'div',
      classes: ['max-w-7xl', 'mx-auto', 'px-4'],
      children: [],
      design: {
        sizing: { isActive: true, maxWidth: '80rem' },
        spacing: { isActive: true, marginLeft: 'auto', marginRight: 'auto', paddingLeft: '1rem', paddingRight: '1rem' }
      }
    }
  },
  
  hr: {
    icon: 'separator',
    name: 'Separator',
    template: {
      name: 'hr',
      classes: ['border-t', 'border-gray-300', 'my-4'],
      design: {
        borders: { isActive: true, borderWidth: '1px 0 0 0', borderColor: '#d1d5db' },
        spacing: { isActive: true, marginTop: '1rem', marginBottom: '1rem' }
      }
    }
  },
  
  columns: {
    icon: 'columns',
    name: 'Columns',
    template: {
      name: 'div',
      classes: ['flex', 'gap-4'],
      children: [
        {
          name: 'div',
          classes: ['w-full'],
          children: [],
          design: {
            sizing: {
              isActive: true,
              width: '100%'
            }
          }
        },
        {
          name: 'div',
          classes: ['w-full'],
          children: [],
          design: {
            sizing: {
              isActive: true,
              width: '100%'
            }
          }
        }
      ] as any[],
      design: {
        layout: { isActive: true, display: 'Flex', gap: '1rem' }
      }
    }
  },
  
  rows: {
    icon: 'rows',
    name: 'Rows',
    template: {
      name: 'div',
      classes: ['flex', 'flex-col', 'gap-4'],
      children: [
        {
          name: 'div',
          classes: ['block'],
          children: []
        },
        {
          name: 'div',
          classes: ['block'],
          children: []
        }
      ] as any[],
      design: {
        layout: { isActive: true, display: 'Flex', flexDirection: 'column', gap: '1rem' }
      }
    }
  },
  
  grid: {
    icon: 'grid',
    name: 'Grid',
    template: {
      name: 'div',
      classes: ['grid', 'grid-cols-2', 'gap-4'],
      children: [
        {
          name: 'div',
          classes: ['block'],
          children: []
        },
        {
          name: 'div',
          classes: ['block'],
          children: []
        },
        {
          name: 'div',
          classes: ['block'],
          children: []
        },
        {
          name: 'div',
          classes: ['block'],
          children: []
        }
      ] as any[],
      design: {
        layout: { isActive: true, display: 'Grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }
      }
    }
  }
};

