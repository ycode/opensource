/**
 * Layout Templates
 *
 * Pre-built combinations of layers with styles
 */

import { LayerTemplate } from '@/types';

interface LayoutTemplate {
  category: string;
  previewImage?: string;
  template: LayerTemplate;
}

export const layoutTemplates: Record<string, LayoutTemplate> = {
  'section-with-content': {
    category: 'Hero',
    previewImage: '/layouts/hero-001.webp',
    template: {
      name: 'section',
      customName: 'Section',
      classes: ['flex', 'flex-col', 'pt-[80px]', 'pb-[80px]', 'items-center'],
      children: [
        {
          name: 'div',
          customName: 'Container',
          classes: ['flex', 'flex-col', 'max-w-[1280px]', 'w-[100%]', 'items-center'],
          children: [
            {
              name: 'div',
              customName: 'Rows',
              classes: ['flex', 'flex-col', 'gap-[16px]'],
              children: [
                {
                  name: 'div',
                  classes: ['flex', 'flex-col', 'max-w-[640px]', 'items-center', 'gap-[12px]'],
                  children: [
                    {
                      name: 'heading',
                      customName: 'Heading',
                      settings: {
                        tag: 'h1'
                      },
                      classes: ['text-[48px]', 'font-[700]', 'leading-[1]', 'text-center'],
                      restrictions: { editText: true },
                      children: [],
                      design: {
                        typography: {
                          isActive: true,
                          fontSize: '48px',
                          fontWeight: '700',
                          lineHeight: '1',
                          textAlign: 'center'
                        }
                      },
                      variables: {
                        text: {
                          type: 'dynamic_text',
                          data: {
                            content: 'Experience content management reimagined'
                          }
                        }
                      }
                    },
                    {
                      name: 'p',
                      customName: 'Paragraph',
                      classes: ['text-[16px]', 'text-center'],
                      restrictions: { editText: true },
                      children: [],
                      design: {
                        typography: {
                          isActive: true,
                          fontSize: '16px',
                          textAlign: 'center'
                        }
                      },
                      variables: {
                        text: {
                          type: 'dynamic_text',
                          data: {
                            content: 'Let copywriters easily work with content via content management system or visually on canvas without breaking design.'
                          }
                        }
                      }
                    },
                  ] as any[],
                  design: {
                    layout: {
                      isActive: true,
                      display: 'Flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '12'
                    },
                    sizing: {
                      maxWidth: '640',
                      isActive: true
                    }
                  }
                },
              ] as any[],
              design: {
                layout: {
                  isActive: true,
                  display: 'Flex',
                  flexDirection: 'column',
                  gap: '16px'
                }
              }
            },
          ] as any[],
          design: {
            layout: {
              isActive: true,
              display: 'Flex',
              flexDirection: 'column',
              alignItems: 'center'
            },
            sizing: {
              isActive: true,
              width: '100%',
              maxWidth: '1280px'
            }
          }
        },
      ] as any[],
      design: {
        layout: {
          isActive: true,
          display: 'Flex',
          flexDirection: 'column',
          alignItems: 'center'
        },
        spacing: {
          isActive: true,
          paddingTop: '80px',
          paddingBottom: '80px'
        }
      }
    }
  },

  'test': {
    category: 'Hero',
    previewImage: '/layouts/test.webp',
    template: {
      'name': 'section',
      'design': {
        'layout': {
          'display': 'Flex',
          'isActive': true,
          'alignItems': 'center',
          'flexDirection': 'column'
        },
        'sizing': {},
        'borders': {},
        'effects': {},
        'spacing': {
          'isActive': true,
          'paddingTop': '40',
          'paddingBottom': '40'
        },
        'typography': {},
        'backgrounds': {
          'isActive': true,
          'backgroundColor': '#57cf8f'
        },
        'positioning': {}
      },
      'classes': 'flex flex-col pt-[80px] pb-[80px] items-center max-lg:pt-[40px] max-lg:pb-[40px] max-lg:bg-[#cf5757] max-md:bg-[#57cf8f] 2xl:bg-red-500',
      'children': [
        {
          'name': 'div',
          'design': {
            'layout': {
              'display': 'Flex',
              'isActive': true,
              'alignItems': 'center',
              'flexDirection': 'column'
            },
            'sizing': {
              'width': '100%',
              'isActive': true,
              'maxWidth': '1280px'
            }
          },
          'classes': [
            'flex',
            'flex-col',
            'max-w-[1280px]',
            'w-[100%]',
            'items-center'
          ],
          'children': [
            {
              'name': 'div',
              'design': {
                'layout': {
                  'gap': '16px',
                  'display': 'Flex',
                  'isActive': true,
                  'alignItems': 'center',
                  'flexDirection': 'column'
                }
              },
              'classes': 'flex flex-col gap-[16px] items-center',
              'children': [
                {
                  'name': 'div',
                  'design': {
                    'layout': {
                      'gap': '12',
                      'display': 'Flex',
                      'isActive': true,
                      'alignItems': 'center',
                      'flexDirection': 'column'
                    },
                    'sizing': {
                      'isActive': true,
                      'maxWidth': '640'
                    }
                  },
                  'classes': [
                    'flex',
                    'flex-col',
                    'max-w-[640px]',
                    'items-center',
                    'gap-[12px]'
                  ],
                  'children': [
                    {
                      'name': 'heading',
                      'design': {
                        'typography': {
                          'fontSize': '48px',
                          'isActive': true,
                          'textAlign': 'center',
                          'fontWeight': '700',
                          'lineHeight': '1'
                        }
                      },
                      'classes': [
                        'text-[48px]',
                        'font-[700]',
                        'leading-[1]',
                        'text-center'
                      ],
                      'children': [],
                      'settings': {
                        'tag': 'h1'
                      },
                      'variables': {
                        'text': {
                          'data': {
                            'content': 'Experience content management reimagined'
                          },
                          'type': 'dynamic_text'
                        }
                      },
                      'customName': 'Heading',
                      'restrictions': {
                        'editText': true
                      }
                    },
                    {
                      'name': 'p',
                      'design': {
                        'typography': {
                          'fontSize': '16px',
                          'isActive': true,
                          'textAlign': 'center'
                        }
                      },
                      'classes': [
                        'text-[16px]',
                        'text-center'
                      ],
                      'children': [],
                      'variables': {
                        'text': {
                          'data': {
                            'content': 'Let copywriters easily work with content via content management system or visually on canvas without breaking design.'
                          },
                          'type': 'dynamic_text'
                        }
                      },
                      'customName': 'Paragraph',
                      'restrictions': {
                        'editText': true
                      }
                    }
                  ]
                },
                {
                  'name': 'button',
                  'design': {
                    'borders': {
                      'isActive': true,
                      'borderRadius': '0.5rem'
                    },
                    'spacing': {
                      'isActive': true,
                      'paddingTop': '0.5rem',
                      'paddingLeft': '1.5rem',
                      'paddingRight': '1.5rem',
                      'paddingBottom': '0.5rem'
                    },
                    'typography': {
                      'color': '#ffffff',
                      'fontSize': '16px',
                      'isActive': true
                    },
                    'backgrounds': {
                      'isActive': true,
                      'backgroundColor': '#2563eb'
                    }
                  },
                  'classes': 'flex flex-row items-center justify-center text-[#FFFFFF] pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] bg-[#171717]',
                  'children': [
                    {
                      'name': 'span',
                      'design': {
                        'typography': {
                          'fontSize': '16px',
                          'isActive': true
                        }
                      },
                      'classes': 'text-[16px]',
                      'children': [],
                      'variables': {
                        'text': {
                          'data': {
                            'content': 'Text'
                          },
                          'type': 'dynamic_text'
                        }
                      },
                      'restrictions': {
                        'editText': true
                      }
                    }
                  ],
                  'attributes': {
                    'type': 'button'
                  },
                  'customName': 'Button'
                }
              ],
              'customName': 'Rows'
            }
          ],
          'customName': 'Container'
        }
      ],
      'customName': 'Section'
    }
  },

  'section': {
    category: 'Hero',
    previewImage: '/layouts/section.webp',
    template: {
      'name': 'section',
      'design': {
        'layout': {
          'display': 'Flex',
          'isActive': true,
          'alignItems': 'center',
          'flexDirection': 'column'
        },
        'sizing': {},
        'borders': {},
        'effects': {},
        'spacing': {
          'isActive': true,
          'paddingTop': '40',
          'paddingBottom': '40'
        },
        'typography': {},
        'backgrounds': {
          'isActive': true,
          'backgroundColor': '#57cf8f'
        },
        'positioning': {}
      },
      'classes': 'flex flex-col pt-[80px] pb-[80px] items-center max-lg:pt-[40px] max-lg:pb-[40px] max-lg:bg-[#cf5757] max-md:bg-[#57cf8f] 2xl:bg-red-500',
      'children': [
        {
          'name': 'div',
          'design': {
            'layout': {
              'display': 'Flex',
              'isActive': true,
              'alignItems': 'center',
              'flexDirection': 'column'
            },
            'sizing': {
              'width': '100%',
              'isActive': true,
              'maxWidth': '1280px'
            }
          },
          'classes': [
            'flex',
            'flex-col',
            'max-w-[1280px]',
            'w-[100%]',
            'items-center'
          ],
          'children': [
            {
              'name': 'div',
              'design': {
                'layout': {
                  'gap': '16px',
                  'display': 'Flex',
                  'isActive': true,
                  'alignItems': 'center',
                  'flexDirection': 'column'
                }
              },
              'classes': 'flex flex-col gap-[16px] items-center',
              'children': [
                {
                  'name': 'div',
                  'design': {
                    'layout': {
                      'gap': '12',
                      'display': 'Flex',
                      'isActive': true,
                      'alignItems': 'center',
                      'flexDirection': 'column'
                    },
                    'sizing': {
                      'isActive': true,
                      'maxWidth': '640'
                    }
                  },
                  'classes': [
                    'flex',
                    'flex-col',
                    'max-w-[640px]',
                    'items-center',
                    'gap-[12px]'
                  ],
                  'children': [
                    {
                      'name': 'heading',
                      'design': {
                        'typography': {
                          'fontSize': '48px',
                          'isActive': true,
                          'textAlign': 'center',
                          'fontWeight': '700',
                          'lineHeight': '1'
                        }
                      },
                      'classes': [
                        'text-[48px]',
                        'font-[700]',
                        'leading-[1]',
                        'text-center'
                      ],
                      'children': [],
                      'settings': {
                        'tag': 'h1'
                      },
                      'variables': {
                        'text': {
                          'data': {
                            'content': 'Experience content management reimagined'
                          },
                          'type': 'dynamic_text'
                        }
                      },
                      'customName': 'Heading',
                      'restrictions': {
                        'editText': true
                      }
                    },
                    {
                      'name': 'p',
                      'design': {
                        'typography': {
                          'fontSize': '16px',
                          'isActive': true,
                          'textAlign': 'center'
                        }
                      },
                      'classes': [
                        'text-[16px]',
                        'text-center'
                      ],
                      'children': [],
                      'variables': {
                        'text': {
                          'data': {
                            'content': 'Let copywriters easily work with content via content management system or visually on canvas without breaking design.'
                          },
                          'type': 'dynamic_text'
                        }
                      },
                      'customName': 'Paragraph',
                      'restrictions': {
                        'editText': true
                      }
                    }
                  ]
                },
                {
                  'name': 'button',
                  'design': {
                    'borders': {
                      'isActive': true,
                      'borderRadius': '0.5rem'
                    },
                    'spacing': {
                      'isActive': true,
                      'paddingTop': '0.5rem',
                      'paddingLeft': '1.5rem',
                      'paddingRight': '1.5rem',
                      'paddingBottom': '0.5rem'
                    },
                    'typography': {
                      'color': '#ffffff',
                      'fontSize': '16px',
                      'isActive': true
                    },
                    'backgrounds': {
                      'isActive': true,
                      'backgroundColor': '#2563eb'
                    }
                  },
                  'classes': 'flex flex-row items-center justify-center text-[#FFFFFF] pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] bg-[#171717]',
                  'children': [
                    {
                      'name': 'span',
                      'design': {
                        'typography': {
                          'fontSize': '16px',
                          'isActive': true
                        }
                      },
                      'classes': 'text-[16px]',
                      'children': [],
                      'variables': {
                        'text': {
                          'data': {
                            'content': 'Text'
                          },
                          'type': 'dynamic_text'
                        }
                      },
                      'restrictions': {
                        'editText': true
                      }
                    }
                  ],
                  'attributes': {
                    'type': 'button'
                  },
                  'customName': 'Button'
                }
              ],
              'customName': 'Rows'
            }
          ],
          'customName': 'Container'
        }
      ],
      'customName': 'Section'
    }
  }
};
