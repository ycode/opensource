/**
 * Structure Elements Templates
 */

import { BlockTemplate } from '@/types';

export const structureTemplates: Record<string, BlockTemplate> = {
  div: {
    icon: 'block',
    name: 'Block',
    template: {
      name: 'div',
      classes: ['flex', 'flex-col'],
      children: [],
      design: {
        layout: { isActive: true, display: 'Flex', flexDirection: 'column' },
      }
    }
  },

  section: {
    icon: 'section',
    name: 'Section',
    template: {
      name: 'section',
      classes: ['flex', 'flex-col', 'pt-[80px]', 'pb-[80px]', 'items-center'],
      children: [],
      design: {
        layout: { isActive: true, display: 'Flex', flexDirection: 'column', alignItems: 'center' },
        spacing: { isActive: true, paddingTop: '80px', paddingBottom: '80px' }
      }
    }
  },

  container: {
    icon: 'container',
    name: 'Container',
    template: {
      name: 'div',
      classes: ['flex', 'flex-col', 'max-w-[1280px]', 'w-[100%]'],
      children: [],
      design: {
        layout: { isActive: true, display: 'Flex', flexDirection: 'column' },
        sizing: { isActive: true, width: '100%', maxWidth: '1280px' },
      }
    }
  },

  hr: {
    icon: 'separator',
    name: 'Separator',
    template: {
      name: 'hr',
      classes: ['border-t', 'border-[#d1d5db]'],
      design: {
        borders: { isActive: true, borderWidth: '1px 0 0 0', borderColor: '#d1d5db' },
      }
    }
  },

  columns: {
    icon: 'columns',
    name: 'Columns',
    template: {
      name: 'div',
      classes: ['flex', 'gap-[16px]'],
      children: [
        {
          name: 'div',
          classes: ['flex', 'flex-col'],
          children: [],
          design: {
            layout: { isActive: true, display: 'Flex', flexDirection: 'column' },
          }
        },
        {
          name: 'div',
          classes: ['flex', 'flex-col'],
          children: [],
          design: {
            layout: { isActive: true, display: 'Flex', flexDirection: 'column' },
          }
        }
      ] as any[],
      design: {
        layout: { isActive: true, display: 'Flex', gap: '16px' }
      }
    }
  },

  rows: {
    icon: 'rows',
    name: 'Rows',
    template: {
      name: 'div',
      classes: ['flex', 'flex-col', 'gap-[16px]'],
      children: [
        {
          name: 'div',
          classes: ['flex', 'flex-col'],
          children: [],
          design: {
            layout: { isActive: true, display: 'Flex', flexDirection: 'column' },
          }
        },
        {
          name: 'div',
          classes: ['flex', 'flex-col'],
          children: [],
          design: {
            layout: { isActive: true, display: 'Flex', flexDirection: 'column' },
          }
        }
      ] as any[],
      design: {
        layout: { isActive: true, display: 'Flex', flexDirection: 'column', gap: '16px' }
      }
    }
  },

  grid: {
    icon: 'grid',
    name: 'Grid',
    template: {
      name: 'div',
      classes: ['grid', 'gap-[16px]'],
      children: [
        {
          name: 'div',
          classes: ['flex', 'flex-col'],
          children: [],
          design: {
            layout: { isActive: true, display: 'Flex', flexDirection: 'column' },
          }
        },
        {
          name: 'div',
          classes: ['flex', 'flex-col'],
          children: [],
          design: {
            layout: { isActive: true, display: 'Flex', flexDirection: 'column' },
          }
        },
        {
          name: 'div',
          classes: ['flex', 'flex-col'],
          children: [],
          design: {
            layout: { isActive: true, display: 'Flex', flexDirection: 'column' },
          }
        },
        {
          name: 'div',
          classes: ['flex', 'flex-col'],
          children: [],
          design: {
            layout: { isActive: true, display: 'Flex', flexDirection: 'column' },
          }
        }
      ] as any[],
      design: {
        layout: { isActive: true, display: 'Grid', gap: '1px' }
      }
    }
  },

  collection: {
    icon: 'database',
    name: 'Collection',
    template: {
      name: 'div',
      classes: ['flex', 'flex-col', 'gap-[1rem]'],
      children: [],
      design: {
        layout: { isActive: true, display: 'Flex', flexDirection: 'column', gap: '1rem' }
      },
      variables: {
        collection: {
          id: '' // To be set by user
        }
      }
    }
  }
};
