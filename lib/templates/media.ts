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
      classes: ['w-full', 'h-auto'],
      attributes: {
        loading: 'lazy'
      },
      design: {
        sizing: {
          isActive: true,
          width: '100%',
          height: 'auto'
        }
      },
      variables: {
        image: {
          src: {
            type: 'dynamic_text',
            data: { content: '' }
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
            type: 'static_text',
            data: {
              content: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>'
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
      classes: ['w-full', 'h-auto'],
      children: [], // Can contain fallback content (source, track elements)
      attributes: {
        controls: true,
        preload: 'metadata'
      },
      design: {
        sizing: {
          isActive: true,
          width: '100%',
          height: 'auto'
        }
      },
      variables: {
        video: {
          src: {
            type: 'dynamic_text',
            data: { content: '' }
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
      classes: ['w-full'],
      children: [], // Can contain fallback content (source elements)
      attributes: {
        controls: true,
        preload: 'metadata'
      },
      design: {
        sizing: {
          isActive: true,
          width: '100%'
        }
      },
      variables: {
        audio: {
          src: {
            type: 'dynamic_text',
            data: { content: '' }
          }
        }
      }
    }
  },

  youtube: {
    icon: 'video',
    name: 'YouTube',
    template: {
      name: 'youtube',
      settings: {
        tag: 'iframe',
        embedUrl: ''
      },
      classes: ['w-full', 'aspect-video'],
      children: [], // Can contain fallback content
      attributes: {
        src: '',
        frameborder: '0',
        allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
        allowfullscreen: true
      },
      design: {
        sizing: {
          isActive: true,
          width: '100%'
        }
      },
      variables: {
        iframe: {
          src: {
            type: 'dynamic_text',
            data: { content: '' }
          }
        }
      }
    }
  },

  iframe: {
    icon: 'block',
    name: 'Iframe',
    template: {
      name: 'iframe',
      classes: ['w-full', 'h-96'],
      children: [], // Can contain fallback content
      attributes: {
        src: '',
        frameborder: '0'
      },
      design: {
        sizing: {
          isActive: true,
          width: '100%',
          height: '24rem'
        }
      },
      variables: {
        iframe: {
          src: {
            type: 'dynamic_text',
            data: { content: '' }
          }
        }
      }
    }
  }
};
