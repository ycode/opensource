/**
 * Media Elements Templates
 */

import { BlockTemplate } from '@/types';

export const mediaTemplates: Record<string, BlockTemplate> = {
  image: {
    icon: 'image',
    name: 'Image',
    template: {
      name: 'image',
      settings: {
        tag: 'img'
      },
      classes: ['w-[100%]', 'object-cover'],
      attributes: {
        loading: 'lazy'
      },
      design: {
        sizing: {
          isActive: true,
          width: '[100%]',
          objectFit: 'cover'
        }
      },
      variables: {
        image: {
          src: {
            type: 'asset',
            data: { asset_id: null }
          },
          alt: {
            type: 'dynamic_text',
            data: { content: 'Image description' }
          }
        }
      }
    }
  },

  icon: {
    icon: 'icon',
    name: 'Icon',
    template: {
      name: 'icon',
      classes: ['w-[24px]', 'h-[24px]'],
      settings: {
        tag: 'div'
      },
      design: {
        sizing: {
          isActive: true,
          width: '24px',
          height: '24px'
        }
      },
      variables: {
        icon: {
          src: {
            type: 'asset',
            data: {
              asset_id: null,
            }
          }
        }
      }
    }
  },

  video: {
    icon: 'video',
    name: 'Video',
    template: {
      name: 'video',
      classes: ['w-full', 'h-auto', 'aspect-[16/9]', 'overflow-hidden'],
      attributes: {
        controls: true,
        preload: 'metadata'
      },
      design: {
        sizing: {
          isActive: true,
          width: '100%',
          height: 'auto',
          aspectRatio: '[16/9]',
        }
      },
      variables: {
        video: {
          src: {
            type: 'asset',
            data: { asset_id: null }
          }
        }
      }
    }
  },

  audio: {
    icon: 'audio',
    name: 'Audio',
    template: {
      name: 'audio',
      classes: [],
      attributes: {
        controls: true,
        preload: 'metadata'
      },
      variables: {
        audio: {
          src: {
            type: 'asset',
            data: { asset_id: null }
          }
        }
      }
    }
  },
};
