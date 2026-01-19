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

  'hero-001': {
    category: 'Hero',
    previewImage: '/layouts/hero-001.webp',
    template: {
      'name': 'section',
      'open': false,
      'design': {
        'layout': {
          'display': 'Flex',
          'isActive': true,
          'alignItems': 'center',
          'flexDirection': 'column'
        },
        'spacing': {
          'isActive': true,
          'paddingTop': '140'
        }
      },
      'classes': 'flex flex-col items-center pt-[140px]',
      'children': [
        {
          'name': 'div',
          'open': false,
          'design': {
            'layout': {
              'display': 'Flex',
              'isActive': true,
              'flexDirection': 'column'
            },
            'sizing': {
              'width': '100%',
              'isActive': true,
              'maxWidth': '1280px'
            },
            'spacing': {
              'isActive': true,
              'paddingLeft': '32',
              'paddingRight': '32'
            }
          },
          'classes': 'flex flex-col max-w-[1280px] w-[100%] pl-[32px] pr-[32px]',
          'children': [
            {
              'name': 'div',
              'open': true,
              'design': {
                'layout': {
                  'gap': '20',
                  'display': 'flex',
                  'isActive': true,
                  'flexDirection': 'column'
                },
                'sizing': {
                  'width': '[100%]',
                  'isActive': true
                }
              },
              'classes': 'flex w-[100%] gap-[72px] max-lg:flex max-lg:flex-col max-lg:gap-[20px]',
              'children': [
                {
                  'name': 'div',
                  'open': true,
                  'design': {
                    'layout': {
                      'display': 'Flex',
                      'isActive': true,
                      'flexDirection': 'column'
                    },
                    'sizing': {
                      'width': '[100%]',
                      'isActive': true,
                      'maxWidth': '560'
                    }
                  },
                  'classes': 'flex flex-col w-[100%] max-w-[560px]',
                  'children': [
                    {
                      'name': 'text',
                      'design': {
                        'typography': {
                          'fontSize': '36',
                          'isActive': true,
                          'fontWeight': '700',
                          'lineHeight': '1.1',
                          'letterSpacing': '-0.02'
                        }
                      },
                      'classes': 'font-[700] tracking-[-0.02em] text-[60px] leading-[1.1] max-md:text-[36px]',
                      'settings': {
                        'tag': 'h1'
                      },
                      'variables': {
                        'text': {
                          'data': {
                            'content': {
                              'type': 'doc',
                              'content': [
                                {
                                  'type': 'paragraph',
                                  'content': [
                                    {
                                      'text': 'Create stunning websites with ease',
                                      'type': 'text'
                                    }
                                  ]
                                }
                              ]
                            }
                          },
                          'type': 'dynamic_rich_text'
                        }
                      },
                      'customName': 'Heading',
                      'restrictions': {
                        'editText': true
                      }
                    }
                  ]
                },
                {
                  'name': 'div',
                  'open': false,
                  'design': {
                    'layout': {
                      'gap': '16px',
                      'display': 'Flex',
                      'isActive': true,
                      'flexDirection': 'column'
                    },
                    'sizing': {
                      'width': '[100%]',
                      'isActive': true
                    }
                  },
                  'classes': 'flex flex-col gap-[16px] w-[100%]',
                  'children': [
                    {
                      'name': 'div',
                      'open': false,
                      'design': {
                        'layout': {
                          'display': 'Flex',
                          'isActive': true,
                          'flexDirection': 'column'
                        }
                      },
                      'classes': 'flex flex-col',
                      'children': [
                        {
                          'name': 'text',
                          'design': {
                            'typography': {
                              'color': '#000000/60',
                              'fontSize': '20',
                              'isActive': true
                            }
                          },
                          'classes': 'text-[20px] text-[#000000]/60',
                          'settings': {
                            'tag': 'p'
                          },
                          'variables': {
                            'text': {
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'text': 'Unlock the power to create impressive, professional websites with user-friendly tools and intuitive design.',
                                          'type': 'text'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              },
                              'type': 'dynamic_rich_text'
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
                      'name': 'div',
                      'open': false,
                      'design': {
                        'layout': {
                          'gap': '8px',
                          'display': 'Flex',
                          'isActive': true
                        }
                      },
                      'classes': 'flex gap-[8px]',
                      'children': [
                        {
                          'name': 'button',
                          'open': false,
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
                              'name': 'text',
                              'design': {
                                'typography': {
                                  'fontSize': '16px',
                                  'isActive': true
                                }
                              },
                              'classes': 'text-[16px]',
                              'settings': {
                                'tag': 'span'
                              },
                              'variables': {
                                'text': {
                                  'data': {
                                    'content': {
                                      'type': 'doc',
                                      'content': [
                                        {
                                          'type': 'paragraph',
                                          'content': [
                                            {
                                              'text': 'Get started',
                                              'type': 'text'
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  },
                                  'type': 'dynamic_rich_text'
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
                        },
                        {
                          'name': 'button',
                          'open': false,
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
                              'color': '#171717',
                              'fontSize': '16px',
                              'isActive': true
                            },
                            'backgrounds': {
                              'isActive': true,
                              'backgroundColor': '#e5e5e5'
                            }
                          },
                          'classes': 'flex flex-row items-center justify-center pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] bg-[#e5e5e5] text-[#171717]',
                          'children': [
                            {
                              'name': 'text',
                              'design': {
                                'typography': {
                                  'fontSize': '16px',
                                  'isActive': true
                                }
                              },
                              'classes': 'text-[16px]',
                              'settings': {
                                'tag': 'span'
                              },
                              'variables': {
                                'text': {
                                  'data': {
                                    'content': {
                                      'type': 'doc',
                                      'content': [
                                        {
                                          'type': 'paragraph',
                                          'content': [
                                            {
                                              'text': 'Learn more',
                                              'type': 'text'
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  },
                                  'type': 'dynamic_rich_text'
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
                      'customName': 'Columns'
                    }
                  ],
                  'customName': 'Rows'
                }
              ],
              'customName': 'Columns'
            }
          ],
          'customName': 'Container'
        },
        {
          'name': 'div',
          'open': false,
          'design': {
            'layout': {
              'display': 'Flex',
              'isActive': true,
              'flexDirection': 'column'
            },
            'sizing': {
              'width': '[100%]',
              'isActive': true
            },
            'spacing': {
              'isActive': true,
              'paddingTop': '72'
            }
          },
          'classes': 'flex flex-col w-[100%] pt-[72px]',
          'children': [
            {
              'name': 'image',
              'design': {
                'sizing': {
                  'width': '100%',
                  'height': 'auto',
                  'isActive': true
                }
              },
              'classes': 'w-full h-auto',
              'settings': {
                'tag': 'img'
              },
              'variables': {
                'image': {
                  'alt': {
                    'data': {
                      'content': ''
                    },
                    'type': 'dynamic_text'
                  },
                  'src': {
                    'data': {
                      'content': 'https://app.ycode.com/images/layouts/image-GhsEblszvVGwL0OW8RsSNgSo6QMrhuaetaMo95QO.webp'
                    },
                    'type': 'dynamic_text'
                  }
                }
              },
              'attributes': {
                'loading': 'lazy'
              },
              'customName': 'Image'
            }
          ],
          'customName': 'Block'
        }
      ],
      'customName': 'Section'
    },
  },

  'hero-002': {
    category: 'Hero',
    previewImage: '/layouts/hero-002.webp',
    template: {
      'name': 'section',
      'open': false,
      'design': {
        'layout': {
          'display': 'Flex',
          'isActive': true,
          'alignItems': 'center',
          'flexDirection': 'column'
        },
        'spacing': {
          'isActive': true,
          'paddingTop': '140',
          'paddingBottom': '140'
        }
      },
      'classes': 'flex flex-col items-center pt-[140px] pb-[140px]',
      'children': [
        {
          'name': 'div',
          'open': true,
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
            },
            'spacing': {
              'isActive': true,
              'paddingLeft': '32px',
              'paddingRight': '32px'
            }
          },
          'classes': 'flex flex-col max-w-[1280px] w-[100%] pl-[32px] pr-[32px] items-center',
          'children': [
            {
              'name': 'div',
              'open': true,
              'design': {
                'layout': {
                  'gap': '16px',
                  'display': 'Flex',
                  'isActive': true,
                  'alignItems': 'center',
                  'flexDirection': 'column'
                },
                'sizing': {
                  'width': '[100%]',
                  'isActive': true,
                  'maxWidth': '680'
                }
              },
              'classes': 'flex flex-col gap-[16px] items-center w-[100%] max-w-[680px]',
              'children': [
                {
                  'name': 'text',
                  'design': {
                    'typography': {
                      'fontSize': '36',
                      'isActive': true,
                      'textAlign': 'center',
                      'fontWeight': '700',
                      'lineHeight': '1.1',
                      'letterSpacing': '-0.02'
                    }
                  },
                  'classes': 'font-[700] tracking-[-0.02em] text-[60px] leading-[1.1] text-center max-md:text-[36px]',
                  'settings': {
                    'tag': 'h1'
                  },
                  'variables': {
                    'text': {
                      'data': {
                        'content': {
                          'type': 'doc',
                          'content': [
                            {
                              'type': 'paragraph',
                              'content': [
                                {
                                  'text': 'Experience content management reimagined',
                                  'type': 'text'
                                }
                              ]
                            }
                          ]
                        }
                      },
                      'type': 'dynamic_rich_text'
                    }
                  },
                  'customName': 'Heading',
                  'restrictions': {
                    'editText': true
                  }
                },
                {
                  'name': 'text',
                  'design': {
                    'typography': {
                      'color': '#000000/60',
                      'fontSize': '20',
                      'isActive': true,
                      'textAlign': 'center'
                    }
                  },
                  'classes': 'text-[20px] text-[#000000]/60 text-center',
                  'settings': {
                    'tag': 'p'
                  },
                  'variables': {
                    'text': {
                      'data': {
                        'content': {
                          'type': 'doc',
                          'content': [
                            {
                              'type': 'paragraph',
                              'content': [
                                {
                                  'text': 'Let copywriters easily work with content via content management system or visually on canvas without breaking design.',
                                  'type': 'text'
                                }
                              ]
                            }
                          ]
                        }
                      },
                      'type': 'dynamic_rich_text'
                    }
                  },
                  'customName': 'Paragraph',
                  'restrictions': {
                    'editText': true
                  }
                },
                {
                  'name': 'div',
                  'open': false,
                  'design': {
                    'layout': {
                      'gap': '8px',
                      'display': 'Flex',
                      'isActive': true
                    }
                  },
                  'classes': 'flex gap-[8px]',
                  'children': [
                    {
                      'name': 'button',
                      'open': false,
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
                          'isActive': true,
                          'textAlign': 'center'
                        },
                        'backgrounds': {
                          'isActive': true,
                          'backgroundColor': '#2563eb'
                        }
                      },
                      'classes': 'flex flex-row items-center justify-center text-[#FFFFFF] pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] bg-[#171717] text-center',
                      'children': [
                        {
                          'name': 'text',
                          'design': {
                            'typography': {
                              'fontSize': '16px',
                              'isActive': true
                            }
                          },
                          'classes': 'text-[16px]',
                          'settings': {
                            'tag': 'span'
                          },
                          'variables': {
                            'text': {
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'text': 'Get started',
                                          'type': 'text'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              },
                              'type': 'dynamic_rich_text'
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
                    },
                    {
                      'name': 'button',
                      'open': false,
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
                          'color': '#171717',
                          'fontSize': '16px',
                          'isActive': true
                        },
                        'backgrounds': {
                          'isActive': true,
                          'backgroundColor': '#e5e5e5'
                        }
                      },
                      'classes': 'flex flex-row items-center justify-center pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] bg-[#e5e5e5] text-[#171717]',
                      'children': [
                        {
                          'name': 'text',
                          'design': {
                            'typography': {
                              'fontSize': '16px',
                              'isActive': true
                            }
                          },
                          'classes': 'text-[16px]',
                          'settings': {
                            'tag': 'span'
                          },
                          'variables': {
                            'text': {
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'text': 'Learn more',
                                          'type': 'text'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              },
                              'type': 'dynamic_rich_text'
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
                  'customName': 'Columns'
                }
              ],
              'customName': 'Rows'
            }
          ],
          'customName': 'Container'
        }
      ],
      'customName': 'Section'
    },
  },

  'hero-003': {
    category: 'Hero',
    previewImage: '/layouts/hero-003.webp',
    template: {
      'name': 'section',
      'open': false,
      'design': {
        'layout': {
          'display': 'Flex',
          'isActive': true,
          'alignItems': 'center',
          'flexDirection': 'column'
        },
        'spacing': {
          'isActive': true,
          'paddingTop': '140',
          'paddingBottom': '140'
        }
      },
      'classes': 'flex flex-col items-center pt-[140px] pb-[140px]',
      'children': [
        {
          'name': 'div',
          'open': true,
          'design': {
            'layout': {
              'display': 'Flex',
              'isActive': true,
              'flexDirection': 'column'
            },
            'sizing': {
              'width': '100%',
              'isActive': true,
              'maxWidth': '1280px'
            },
            'spacing': {
              'isActive': true,
              'paddingLeft': '32px',
              'paddingRight': '32px'
            }
          },
          'classes': 'flex flex-col max-w-[1280px] w-[100%] pl-[32px] pr-[32px]',
          'children': [
            {
              'name': 'div',
              'open': true,
              'design': {
                'layout': {
                  'gap': '72',
                  'display': 'Grid',
                  'isActive': true,
                  'alignItems': 'center',
                  'gridTemplateColumns': 'repeat(1, 1fr)'
                }
              },
              'classes': 'grid grid-cols-[repeat(2,_1fr)] gap-[72px] items-center max-lg:grid-cols-[repeat(1,_1fr)]',
              'children': [
                {
                  'name': 'div',
                  'open': true,
                  'design': {
                    'layout': {
                      'gap': '16px',
                      'display': 'Flex',
                      'isActive': true,
                      'flexDirection': 'column'
                    }
                  },
                  'classes': 'flex flex-col gap-[16px]',
                  'children': [
                    {
                      'name': 'text',
                      'design': {
                        'typography': {
                          'fontSize': '36',
                          'isActive': true,
                          'fontWeight': '700',
                          'lineHeight': '1.1',
                          'letterSpacing': '-0.02'
                        }
                      },
                      'classes': 'font-[700] tracking-[-0.02em] text-[60px] leading-[1.1] max-md:text-[36px]',
                      'settings': {
                        'tag': 'h1'
                      },
                      'variables': {
                        'text': {
                          'data': {
                            'content': {
                              'type': 'doc',
                              'content': [
                                {
                                  'type': 'paragraph',
                                  'content': [
                                    {
                                      'text': 'Build professional websites easy, fast, and affordable',
                                      'type': 'text'
                                    }
                                  ]
                                }
                              ]
                            }
                          },
                          'type': 'dynamic_rich_text'
                        }
                      },
                      'customName': 'Heading',
                      'restrictions': {
                        'editText': true
                      }
                    },
                    {
                      'name': 'text',
                      'design': {
                        'typography': {
                          'color': '#000000/60',
                          'fontSize': '20',
                          'isActive': true
                        }
                      },
                      'classes': 'text-[20px] text-[#000000]/60',
                      'settings': {
                        'tag': 'p'
                      },
                      'variables': {
                        'text': {
                          'data': {
                            'content': {
                              'type': 'doc',
                              'content': [
                                {
                                  'type': 'paragraph',
                                  'content': [
                                    {
                                      'text': 'Visually build and design beautiful, responsive web projects without compromising your vision.',
                                      'type': 'text'
                                    }
                                  ]
                                }
                              ]
                            }
                          },
                          'type': 'dynamic_rich_text'
                        }
                      },
                      'customName': 'Paragraph',
                      'restrictions': {
                        'editText': true
                      }
                    },
                    {
                      'name': 'div',
                      'open': false,
                      'design': {
                        'layout': {
                          'gap': '8px',
                          'display': 'Flex',
                          'isActive': true
                        }
                      },
                      'classes': 'flex gap-[8px]',
                      'children': [
                        {
                          'name': 'button',
                          'open': false,
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
                              'name': 'text',
                              'design': {
                                'typography': {
                                  'fontSize': '16px',
                                  'isActive': true
                                }
                              },
                              'classes': 'text-[16px]',
                              'settings': {
                                'tag': 'span'
                              },
                              'variables': {
                                'text': {
                                  'data': {
                                    'content': {
                                      'type': 'doc',
                                      'content': [
                                        {
                                          'type': 'paragraph',
                                          'content': [
                                            {
                                              'text': 'Get started',
                                              'type': 'text'
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  },
                                  'type': 'dynamic_rich_text'
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
                        },
                        {
                          'name': 'button',
                          'open': false,
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
                              'color': '#171717',
                              'fontSize': '16px',
                              'isActive': true
                            },
                            'backgrounds': {
                              'isActive': true,
                              'backgroundColor': '#e5e5e5'
                            }
                          },
                          'classes': 'flex flex-row items-center justify-center pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] bg-[#e5e5e5] text-[#171717]',
                          'children': [
                            {
                              'name': 'text',
                              'design': {
                                'typography': {
                                  'fontSize': '16px',
                                  'isActive': true
                                }
                              },
                              'classes': 'text-[16px]',
                              'settings': {
                                'tag': 'span'
                              },
                              'variables': {
                                'text': {
                                  'data': {
                                    'content': {
                                      'type': 'doc',
                                      'content': [
                                        {
                                          'type': 'paragraph',
                                          'content': [
                                            {
                                              'text': 'Learn more',
                                              'type': 'text'
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  },
                                  'type': 'dynamic_rich_text'
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
                      'customName': 'Columns'
                    }
                  ],
                  'customName': 'Rows'
                },
                {
                  'name': 'div',
                  'open': false,
                  'design': {
                    'layout': {
                      'display': 'Flex',
                      'isActive': true,
                      'flexDirection': 'column'
                    }
                  },
                  'classes': 'flex flex-col',
                  'children': [
                    {
                      'name': 'image',
                      'design': {
                        'sizing': {
                          'width': '[100%]',
                          'isActive': true,
                          'minHeight': '440',
                          'objectFit': 'cover'
                        },
                        'borders': {
                          'isActive': true,
                          'borderRadius': '24'
                        }
                      },
                      'classes': 'w-[100%] min-h-[440px] object-cover rounded-[24px]',
                      'settings': {
                        'tag': 'img'
                      },
                      'variables': {
                        'image': {
                          'alt': {
                            'data': {
                              'content': ''
                            },
                            'type': 'dynamic_text'
                          },
                          'src': {
                            'data': {
                              'content': 'https://app.ycode.com/images/layouts/image-v7rjaWPn4Dd0YIEQoyCUm59jmzwsHM8tRUJ756RV.webp'
                            },
                            'type': 'dynamic_text'
                          }
                        }
                      },
                      'attributes': {
                        'loading': 'lazy'
                      },
                      'customName': 'Image'
                    }
                  ],
                  'customName': 'Block'
                }
              ],
              'customName': 'Grid'
            }
          ],
          'customName': 'Container'
        }
      ],
      'customName': 'Section'
    },
  },

  'hero-004': {
    category: 'Hero',
    previewImage: '/layouts/hero-004.webp',
    template: {
      'name': 'section',
      'open': false,
      'design': {
        'layout': {
          'display': 'Flex',
          'isActive': true,
          'alignItems': 'center',
          'flexDirection': 'column'
        },
        'spacing': {
          'isActive': true,
          'paddingTop': '140',
          'paddingBottom': '140'
        }
      },
      'classes': 'flex flex-col items-center pt-[140px] pb-[140px]',
      'children': [
        {
          'name': 'div',
          'open': false,
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
            },
            'spacing': {
              'isActive': true,
              'paddingLeft': '32px',
              'paddingRight': '32px'
            }
          },
          'classes': 'flex flex-col max-w-[1280px] w-[100%] pl-[32px] pr-[32px] items-center',
          'children': [
            {
              'name': 'div',
              'design': {
                'layout': {
                  'gap': '72',
                  'display': 'Flex',
                  'isActive': true,
                  'flexDirection': 'column',
                  'alignItems': 'center'
                },
                'sizing': {
                  'width': '[100%]',
                  'isActive': true
                }
              },
              'classes': 'flex flex-col w-[100%] items-center gap-įš gap-] gap-]56 gap-[72px]',
              'children': [
                {
                  'name': 'div',
                  'open': true,
                  'design': {
                    'layout': {
                      'gap': '16px',
                      'display': 'Flex',
                      'isActive': true,
                      'alignItems': 'center',
                      'flexDirection': 'column'
                    },
                    'sizing': {
                      'width': '[100%]',
                      'isActive': true,
                      'maxWidth': '680'
                    }
                  },
                  'classes': 'flex flex-col gap-[16px] items-center w-[100%] max-w-[680px]',
                  'children': [
                    {
                      'name': 'text',
                      'design': {
                        'typography': {
                          'fontSize': '36',
                          'isActive': true,
                          'fontWeight': '700',
                          'lineHeight': '1.1',
                          'letterSpacing': '-0.02',
                          'textAlign': 'center'
                        }
                      },
                      'classes': 'font-[700] tracking-[-0.02em] text-[60px] leading-[1.1] text-center max-md:text-[36px]',
                      'settings': {
                        'tag': 'h1'
                      },
                      'variables': {
                        'text': {
                          'type': 'dynamic_rich_text',
                          'data': {
                            'content': {
                              'type': 'doc',
                              'content': [
                                {
                                  'type': 'paragraph',
                                  'content': [
                                    {
                                      'type': 'text',
                                      'text': 'Add some spark to your website with interactions'
                                    }
                                  ]
                                }
                              ]
                            }
                          }
                        }
                      },
                      'customName': 'Heading',
                      'restrictions': {
                        'editText': true
                      }
                    },
                    {
                      'name': 'text',
                      'design': {
                        'typography': {
                          'color': '#000000/60',
                          'fontSize': '20',
                          'isActive': true,
                          'textAlign': 'center'
                        }
                      },
                      'classes': 'text-[20px] text-[#000000]/60 text-center',
                      'settings': {
                        'tag': 'p'
                      },
                      'variables': {
                        'text': {
                          'type': 'dynamic_rich_text',
                          'data': {
                            'content': {
                              'type': 'doc',
                              'content': [
                                {
                                  'type': 'paragraph',
                                  'content': [
                                    {
                                      'type': 'text',
                                      'text': 'Create expressive and attention-grabbing interactions that enhance the overall design and user experience of your website.'
                                    }
                                  ]
                                }
                              ]
                            }
                          }
                        }
                      },
                      'customName': 'Paragraph',
                      'restrictions': {
                        'editText': true
                      }
                    },
                    {
                      'name': 'div',
                      'open': false,
                      'design': {
                        'layout': {
                          'gap': '8px',
                          'display': 'Flex',
                          'isActive': true
                        }
                      },
                      'classes': 'flex gap-[8px]',
                      'children': [
                        {
                          'name': 'button',
                          'open': false,
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
                              'isActive': true,
                              'textAlign': 'center'
                            },
                            'backgrounds': {
                              'isActive': true,
                              'backgroundColor': '#2563eb'
                            }
                          },
                          'classes': 'flex flex-row items-center justify-center text-[#FFFFFF] pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] bg-[#171717] text-center',
                          'children': [
                            {
                              'name': 'text',
                              'design': {
                                'typography': {
                                  'fontSize': '16px',
                                  'isActive': true
                                }
                              },
                              'classes': 'text-[16px]',
                              'settings': {
                                'tag': 'span'
                              },
                              'variables': {
                                'text': {
                                  'data': {
                                    'content': {
                                      'type': 'doc',
                                      'content': [
                                        {
                                          'type': 'paragraph',
                                          'content': [
                                            {
                                              'text': 'Get started',
                                              'type': 'text'
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  },
                                  'type': 'dynamic_rich_text'
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
                        },
                        {
                          'name': 'button',
                          'open': false,
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
                              'color': '#171717',
                              'fontSize': '16px',
                              'isActive': true
                            },
                            'backgrounds': {
                              'isActive': true,
                              'backgroundColor': '#e5e5e5'
                            }
                          },
                          'classes': 'flex flex-row items-center justify-center pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] bg-[#e5e5e5] text-[#171717]',
                          'children': [
                            {
                              'name': 'text',
                              'design': {
                                'typography': {
                                  'fontSize': '16px',
                                  'isActive': true
                                }
                              },
                              'classes': 'text-[16px]',
                              'settings': {
                                'tag': 'span'
                              },
                              'variables': {
                                'text': {
                                  'data': {
                                    'content': {
                                      'type': 'doc',
                                      'content': [
                                        {
                                          'type': 'paragraph',
                                          'content': [
                                            {
                                              'text': 'Learn more',
                                              'type': 'text'
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  },
                                  'type': 'dynamic_rich_text'
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
                      'customName': 'Columns'
                    }
                  ],
                  'customName': 'Rows'
                },
                {
                  'name': 'div',
                  'classes': 'flex flex-col w-[100%]',
                  'children': [
                    {
                      'name': 'image',
                      'settings': {
                        'tag': 'img'
                      },
                      'classes': 'h-auto w-[100%] rounded-[24px]',
                      'attributes': {
                        'loading': 'lazy'
                      },
                      'design': {
                        'sizing': {
                          'isActive': true,
                          'width': '[100%]',
                          'height': 'auto'
                        },
                        'borders': {
                          'borderRadius': '24',
                          'isActive': true
                        }
                      },
                      'variables': {
                        'image': {
                          'src': {
                            'type': 'dynamic_text',
                            'data': {
                              'content': 'https://app.ycode.com/images/layouts/image-ps9xO6m7BE34lp9dkPue4aAL8mcsDjw6UKg0rIVb.webp'
                            }
                          },
                          'alt': {
                            'type': 'dynamic_text',
                            'data': {
                              'content': 'Image description'
                            }
                          }
                        }
                      },
                      'customName': 'Image'
                    }
                  ],
                  'design': {
                    'layout': {
                      'isActive': true,
                      'display': 'Flex',
                      'flexDirection': 'column'
                    },
                    'sizing': {
                      'width': '[100%]',
                      'isActive': true
                    }
                  },
                  'customName': 'Block'
                }
              ],
              'customName': 'Rows'
            }
          ],
          'customName': 'Container'
        }
      ],
      'customName': 'Section'
    },
  },

  'hero-005': {
    category: 'Hero',
    previewImage: '/layouts/hero-005.webp',
    template: {
      'name': 'section',
      'open': false,
      'design': {
        'layout': {
          'display': 'Flex',
          'isActive': true,
          'alignItems': 'center',
          'flexDirection': 'column'
        },
        'spacing': {
          'isActive': true,
          'paddingTop': '200',
          'paddingBottom': '200'
        },
        'positioning': {
          'position': 'relative',
          'isActive': true
        },
        'backgrounds': {
          'backgroundColor': '#000000',
          'isActive': true
        }
      },
      'classes': 'flex flex-col items-center relative bg-[#000000] pt-[200px] pb-[200px]',
      'children': [
        {
          'name': 'div',
          'open': false,
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
            },
            'spacing': {
              'isActive': true,
              'paddingLeft': '32px',
              'paddingRight': '32px'
            },
            'positioning': {
              'position': 'relative',
              'isActive': true,
              'zIndex': '10'
            }
          },
          'classes': 'flex flex-col max-w-[1280px] w-[100%] pl-[32px] pr-[32px] items-center relative z-[10]',
          'children': [
            {
              'name': 'div',
              'open': false,
              'design': {
                'layout': {
                  'gap': '16px',
                  'display': 'Flex',
                  'isActive': true,
                  'alignItems': 'center',
                  'flexDirection': 'column'
                },
                'sizing': {
                  'width': '[100%]',
                  'isActive': true,
                  'maxWidth': '680'
                }
              },
              'classes': 'flex flex-col gap-[16px] items-center w-[100%] max-w-[680px]',
              'children': [
                {
                  'name': 'text',
                  'design': {
                    'typography': {
                      'fontSize': '36',
                      'isActive': true,
                      'textAlign': 'center',
                      'fontWeight': '700',
                      'lineHeight': '1.1',
                      'letterSpacing': '-0.02',
                      'color': '#ffffff'
                    }
                  },
                  'classes': 'font-[700] tracking-[-0.02em] text-[60px] leading-[1.1] text-center max-md:text-[36px] text-[#ffffff]',
                  'settings': {
                    'tag': 'h1'
                  },
                  'variables': {
                    'text': {
                      'type': 'dynamic_rich_text',
                      'data': {
                        'content': {
                          'type': 'doc',
                          'content': [
                            {
                              'type': 'paragraph',
                              'content': [
                                {
                                  'type': 'text',
                                  'text': 'Transform your ideas into stunning websites'
                                }
                              ]
                            }
                          ]
                        }
                      }
                    }
                  },
                  'customName': 'Heading',
                  'restrictions': {
                    'editText': true
                  }
                },
                {
                  'name': 'text',
                  'design': {
                    'typography': {
                      'color': '#ffffff/60',
                      'fontSize': '20',
                      'isActive': true,
                      'textAlign': 'center'
                    }
                  },
                  'classes': 'text-[20px] text-center text-[#ffffff]/60',
                  'settings': {
                    'tag': 'p'
                  },
                  'variables': {
                    'text': {
                      'data': {
                        'content': {
                          'type': 'doc',
                          'content': [
                            {
                              'type': 'paragraph',
                              'content': [
                                {
                                  'text': 'Let copywriters easily work with content via content management system or visually on canvas without breaking design.',
                                  'type': 'text'
                                }
                              ]
                            }
                          ]
                        }
                      },
                      'type': 'dynamic_rich_text'
                    }
                  },
                  'customName': 'Paragraph',
                  'restrictions': {
                    'editText': true
                  }
                },
                {
                  'name': 'div',
                  'open': false,
                  'design': {
                    'layout': {
                      'gap': '8px',
                      'display': 'Flex',
                      'isActive': true
                    }
                  },
                  'classes': 'flex gap-[8px]',
                  'children': [
                    {
                      'name': 'button',
                      'open': false,
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
                          'color': '#171717',
                          'fontSize': '16px',
                          'isActive': true,
                          'textAlign': 'center'
                        },
                        'backgrounds': {
                          'isActive': true,
                          'backgroundColor': '#ffffff'
                        }
                      },
                      'classes': 'flex flex-row items-center justify-center pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] text-center bg-[#ffffff] text-[#171717]',
                      'children': [
                        {
                          'name': 'text',
                          'design': {
                            'typography': {
                              'fontSize': '16px',
                              'isActive': true
                            }
                          },
                          'classes': 'text-[16px]',
                          'settings': {
                            'tag': 'span'
                          },
                          'variables': {
                            'text': {
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'text': 'Get started',
                                          'type': 'text'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              },
                              'type': 'dynamic_rich_text'
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
                  'customName': 'Columns'
                }
              ],
              'customName': 'Rows'
            }
          ],
          'customName': 'Container'
        },
        {
          'name': 'image',
          'settings': {
            'tag': 'img'
          },
          'classes': 'absolute left-[0px] top-[0px] right-[0px] bottom-[0px] w-[100%] h-au h-[100%] object-cover opacity-[30%]',
          'attributes': {
            'loading': 'lazy'
          },
          'design': {
            'sizing': {
              'isActive': true,
              'width': '[100%]',
              'height': '[100%]',
              'objectFit': 'cover'
            },
            'positioning': {
              'position': 'absolute',
              'isActive': true,
              'left': '0',
              'top': '0',
              'right': '0',
              'bottom': '0'
            },
            'effects': {
              'opacity': '30',
              'isActive': true
            }
          },
          'variables': {
            'image': {
              'src': {
                'type': 'dynamic_text',
                'data': {
                  'content': 'https://app.ycode.com/images/layouts/image-gEwXpLIeOESQlCWaCrDH3FUzT5AMZ9cEtIlpIyCc.webp'
                }
              },
              'alt': {
                'type': 'dynamic_text',
                'data': {
                  'content': ''
                }
              }
            }
          },
          'customName': 'Image'
        }
      ],
      'customName': 'Section'
    },
  },

  'header-001': {
    category: 'Header',
    previewImage: '/layouts/header-001.webp',
    template: {
      'name': 'section',
      'open': false,
      'design': {
        'layout': {
          'display': 'Flex',
          'isActive': true,
          'alignItems': 'center',
          'flexDirection': 'column'
        },
        'spacing': {
          'isActive': true,
          'paddingTop': '100',
          'paddingBottom': '100'
        }
      },
      'classes': 'flex flex-col items-center pt-[100px] pb-[100px]',
      'children': [
        {
          'name': 'div',
          'open': false,
          'design': {
            'layout': {
              'display': 'Flex',
              'isActive': true,
              'flexDirection': 'column'
            },
            'sizing': {
              'width': '100%',
              'isActive': true,
              'maxWidth': '1280px'
            },
            'spacing': {
              'isActive': true,
              'paddingLeft': '32px',
              'paddingRight': '32px'
            }
          },
          'classes': 'flex flex-col max-w-[1280px] w-[100%] pl-[32px] pr-[32px]',
          'children': [
            {
              'name': 'div',
              'open': false,
              'design': {
                'layout': {
                  'gap': '16px',
                  'display': 'Flex',
                  'isActive': true,
                  'flexDirection': 'column'
                },
                'sizing': {
                  'width': '[100%]',
                  'isActive': true,
                  'maxWidth': '640'
                }
              },
              'classes': 'flex flex-col gap-[16px] w-[100%] max-w-[640px]',
              'children': [
                {
                  'name': 'text',
                  'settings': {
                    'tag': 'p'
                  },
                  'classes': 'text-[16px]',
                  'restrictions': {
                    'editText': true
                  },
                  'design': {
                    'typography': {
                      'isActive': true,
                      'fontSize': '16px'
                    }
                  },
                  'variables': {
                    'text': {
                      'type': 'dynamic_rich_text',
                      'data': {
                        'content': {
                          'type': 'doc',
                          'content': [
                            {
                              'type': 'paragraph',
                              'content': [
                                {
                                  'type': 'text',
                                  'text': 'Tagline'
                                }
                              ]
                            }
                          ]
                        }
                      }
                    }
                  },
                  'customName': 'Paragraph'
                },
                {
                  'name': 'text',
                  'design': {
                    'typography': {
                      'fontSize': '36',
                      'isActive': true,
                      'fontWeight': '700',
                      'lineHeight': '1.1',
                      'letterSpacing': '-0.02'
                    }
                  },
                  'classes': 'font-[700] tracking-[-0.02em] text-[60px] leading-[1.1] max-md:text-[36px]',
                  'settings': {
                    'tag': 'h1'
                  },
                  'variables': {
                    'text': {
                      'type': 'dynamic_rich_text',
                      'data': {
                        'content': {
                          'type': 'doc',
                          'content': [
                            {
                              'type': 'paragraph',
                              'content': [
                                {
                                  'type': 'text',
                                  'text': 'Headline'
                                }
                              ]
                            }
                          ]
                        }
                      }
                    }
                  },
                  'customName': 'Heading',
                  'restrictions': {
                    'editText': true
                  }
                },
                {
                  'name': 'text',
                  'design': {
                    'typography': {
                      'color': '#000000/60',
                      'fontSize': '20',
                      'isActive': true
                    }
                  },
                  'classes': 'text-[20px] text-[#000000]/60',
                  'settings': {
                    'tag': 'p'
                  },
                  'variables': {
                    'text': {
                      'type': 'dynamic_rich_text',
                      'data': {
                        'content': {
                          'type': 'doc',
                          'content': [
                            {
                              'type': 'paragraph',
                              'content': [
                                {
                                  'type': 'text',
                                  'text': 'Let copywriters easily work with content via content management system or visually on canvas without breaking design.'
                                }
                              ]
                            }
                          ]
                        }
                      }
                    }
                  },
                  'customName': 'Paragraph',
                  'restrictions': {
                    'editText': true
                  }
                },
                {
                  'name': 'div',
                  'open': false,
                  'design': {
                    'layout': {
                      'gap': '8px',
                      'display': 'Flex',
                      'isActive': true
                    }
                  },
                  'classes': 'flex gap-[8px]',
                  'children': [
                    {
                      'name': 'button',
                      'open': false,
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
                          'isActive': true,
                          'textAlign': 'center'
                        },
                        'backgrounds': {
                          'isActive': true,
                          'backgroundColor': '#2563eb'
                        }
                      },
                      'classes': 'flex flex-row items-center justify-center text-[#FFFFFF] pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] bg-[#171717] text-center',
                      'children': [
                        {
                          'name': 'text',
                          'design': {
                            'typography': {
                              'fontSize': '16px',
                              'isActive': true
                            }
                          },
                          'classes': 'text-[16px]',
                          'settings': {
                            'tag': 'span'
                          },
                          'variables': {
                            'text': {
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'text': 'Get started',
                                          'type': 'text'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              },
                              'type': 'dynamic_rich_text'
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
                    },
                    {
                      'name': 'button',
                      'open': false,
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
                          'color': '#171717',
                          'fontSize': '16px',
                          'isActive': true
                        },
                        'backgrounds': {
                          'isActive': true,
                          'backgroundColor': '#e5e5e5'
                        }
                      },
                      'classes': 'flex flex-row items-center justify-center pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] bg-[#e5e5e5] text-[#171717]',
                      'children': [
                        {
                          'name': 'text',
                          'design': {
                            'typography': {
                              'fontSize': '16px',
                              'isActive': true
                            }
                          },
                          'classes': 'text-[16px]',
                          'settings': {
                            'tag': 'span'
                          },
                          'variables': {
                            'text': {
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'text': 'Learn more',
                                          'type': 'text'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              },
                              'type': 'dynamic_rich_text'
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
                  'customName': 'Columns'
                }
              ],
              'customName': 'Rows'
            }
          ],
          'customName': 'Container'
        }
      ],
      'customName': 'Section'
    },
  },

  'header-002': {
    category: 'Header',
    previewImage: '/layouts/header-002.webp',
    template: {
      'name': 'section',
      'open': false,
      'design': {
        'layout': {
          'display': 'Flex',
          'isActive': true,
          'alignItems': 'center',
          'flexDirection': 'column'
        },
        'spacing': {
          'isActive': true,
          'paddingTop': '100',
          'paddingBottom': '100'
        }
      },
      'classes': 'flex flex-col items-center pt-[100px] pb-[100px]',
      'children': [
        {
          'name': 'div',
          'open': false,
          'design': {
            'layout': {
              'display': 'Flex',
              'isActive': true,
              'flexDirection': 'column'
            },
            'sizing': {
              'width': '100%',
              'isActive': true,
              'maxWidth': '1280px'
            },
            'spacing': {
              'isActive': true,
              'paddingLeft': '32px',
              'paddingRight': '32px'
            }
          },
          'classes': 'flex flex-col max-w-[1280px] w-[100%] pl-[32px] pr-[32px]',
          'children': [
            {
              'name': 'div',
              'open': false,
              'design': {
                'layout': {
                  'gap': '16px',
                  'display': 'Flex',
                  'isActive': true,
                  'flexDirection': 'column'
                },
                'sizing': {
                  'width': '[100%]',
                  'isActive': true,
                  'maxWidth': '640'
                }
              },
              'classes': 'flex flex-col gap-[16px] w-[100%] max-w-[640px]',
              'children': [
                {
                  'name': 'text',
                  'design': {
                    'typography': {
                      'fontSize': '36',
                      'isActive': true,
                      'fontWeight': '700',
                      'lineHeight': '1.1',
                      'letterSpacing': '-0.02'
                    }
                  },
                  'classes': 'font-[700] tracking-[-0.02em] text-[60px] leading-[1.1] max-md:text-[36px]',
                  'settings': {
                    'tag': 'h1'
                  },
                  'variables': {
                    'text': {
                      'type': 'dynamic_rich_text',
                      'data': {
                        'content': {
                          'type': 'doc',
                          'content': [
                            {
                              'type': 'paragraph',
                              'content': [
                                {
                                  'type': 'text',
                                  'text': 'Headline'
                                }
                              ]
                            }
                          ]
                        }
                      }
                    }
                  },
                  'customName': 'Heading',
                  'restrictions': {
                    'editText': true
                  }
                },
                {
                  'name': 'text',
                  'design': {
                    'typography': {
                      'color': '#000000/60',
                      'fontSize': '20',
                      'isActive': true
                    }
                  },
                  'classes': 'text-[20px] text-[#000000]/60',
                  'settings': {
                    'tag': 'p'
                  },
                  'variables': {
                    'text': {
                      'type': 'dynamic_rich_text',
                      'data': {
                        'content': {
                          'type': 'doc',
                          'content': [
                            {
                              'type': 'paragraph',
                              'content': [
                                {
                                  'type': 'text',
                                  'text': 'Let copywriters easily work with content via content management system or visually on canvas without breaking design.'
                                }
                              ]
                            }
                          ]
                        }
                      }
                    }
                  },
                  'customName': 'Paragraph',
                  'restrictions': {
                    'editText': true
                  }
                }
              ],
              'customName': 'Rows'
            }
          ],
          'customName': 'Container'
        }
      ],
      'customName': 'Section'
    },
  },

  'header-003': {
    category: 'Header',
    previewImage: '/layouts/header-003.webp',
    template: {
      'name': 'section',
      'open': false,
      'design': {
        'layout': {
          'display': 'Flex',
          'isActive': true,
          'alignItems': 'center',
          'flexDirection': 'column'
        },
        'spacing': {
          'isActive': true,
          'paddingTop': '100',
          'paddingBottom': '100'
        }
      },
      'classes': 'flex flex-col items-center pt-[100px] pb-[100px]',
      'children': [
        {
          'name': 'div',
          'open': false,
          'design': {
            'layout': {
              'display': 'Flex',
              'isActive': true,
              'flexDirection': 'column'
            },
            'sizing': {
              'width': '100%',
              'isActive': true,
              'maxWidth': '1280px'
            },
            'spacing': {
              'isActive': true,
              'paddingLeft': '32',
              'paddingRight': '32'
            }
          },
          'classes': 'flex flex-col max-w-[1280px] w-[100%] pl-[32px] pr-[32px]',
          'children': [
            {
              'name': 'div',
              'open': false,
              'design': {
                'layout': {
                  'gap': '20',
                  'display': 'flex',
                  'isActive': true,
                  'flexDirection': 'column'
                },
                'sizing': {
                  'width': '[100%]',
                  'isActive': true
                }
              },
              'classes': 'flex w-[100%] gap-[72px] max-lg:flex max-lg:flex-col max-lg:gap-[20px]',
              'children': [
                {
                  'name': 'div',
                  'open': false,
                  'design': {
                    'layout': {
                      'gap': '16px',
                      'display': 'Flex',
                      'isActive': true,
                      'flexDirection': 'column'
                    },
                    'sizing': {
                      'width': '[100%]',
                      'isActive': true,
                      'maxWidth': '640'
                    }
                  },
                  'classes': 'flex flex-col gap-[16px] w-[100%] max-w-[640px]',
                  'children': [
                    {
                      'name': 'text',
                      'settings': {
                        'tag': 'p'
                      },
                      'classes': 'text-[16px]',
                      'restrictions': {
                        'editText': true
                      },
                      'design': {
                        'typography': {
                          'isActive': true,
                          'fontSize': '16px'
                        }
                      },
                      'variables': {
                        'text': {
                          'type': 'dynamic_rich_text',
                          'data': {
                            'content': {
                              'type': 'doc',
                              'content': [
                                {
                                  'type': 'paragraph',
                                  'content': [
                                    {
                                      'type': 'text',
                                      'text': 'Tagline'
                                    }
                                  ]
                                }
                              ]
                            }
                          }
                        }
                      },
                      'customName': 'Paragraph'
                    },
                    {
                      'name': 'text',
                      'design': {
                        'typography': {
                          'fontSize': '36',
                          'isActive': true,
                          'fontWeight': '700',
                          'lineHeight': '1.1',
                          'letterSpacing': '-0.02'
                        }
                      },
                      'classes': 'font-[700] tracking-[-0.02em] text-[60px] leading-[1.1] max-md:text-[36px]',
                      'settings': {
                        'tag': 'h1'
                      },
                      'variables': {
                        'text': {
                          'type': 'dynamic_rich_text',
                          'data': {
                            'content': {
                              'type': 'doc',
                              'content': [
                                {
                                  'type': 'paragraph',
                                  'content': [
                                    {
                                      'type': 'text',
                                      'text': 'Headline'
                                    }
                                  ]
                                }
                              ]
                            }
                          }
                        }
                      },
                      'customName': 'Heading',
                      'restrictions': {
                        'editText': true
                      }
                    }
                  ],
                  'customName': 'Rows'
                },
                {
                  'name': 'div',
                  'open': false,
                  'design': {
                    'layout': {
                      'gap': '16px',
                      'display': 'Flex',
                      'isActive': true,
                      'flexDirection': 'column'
                    },
                    'sizing': {
                      'width': '[100%]',
                      'isActive': true
                    }
                  },
                  'classes': 'flex flex-col gap-[16px] w-[100%]',
                  'children': [
                    {
                      'name': 'div',
                      'open': false,
                      'design': {
                        'layout': {
                          'display': 'Flex',
                          'isActive': true,
                          'flexDirection': 'column'
                        }
                      },
                      'classes': 'flex flex-col',
                      'children': [
                        {
                          'name': 'text',
                          'design': {
                            'typography': {
                              'color': '#000000/60',
                              'fontSize': '20',
                              'isActive': true
                            }
                          },
                          'classes': 'text-[20px] text-[#000000]/60',
                          'settings': {
                            'tag': 'p'
                          },
                          'variables': {
                            'text': {
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'text': 'Unlock the power to create impressive, professional websites with user-friendly tools and intuitive design.',
                                          'type': 'text'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              },
                              'type': 'dynamic_rich_text'
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
                      'name': 'div',
                      'open': false,
                      'design': {
                        'layout': {
                          'gap': '8px',
                          'display': 'Flex',
                          'isActive': true
                        }
                      },
                      'classes': 'flex gap-[8px]',
                      'children': [
                        {
                          'name': 'button',
                          'open': false,
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
                              'name': 'text',
                              'design': {
                                'typography': {
                                  'fontSize': '16px',
                                  'isActive': true
                                }
                              },
                              'classes': 'text-[16px]',
                              'settings': {
                                'tag': 'span'
                              },
                              'variables': {
                                'text': {
                                  'data': {
                                    'content': {
                                      'type': 'doc',
                                      'content': [
                                        {
                                          'type': 'paragraph',
                                          'content': [
                                            {
                                              'text': 'Get started',
                                              'type': 'text'
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  },
                                  'type': 'dynamic_rich_text'
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
                        },
                        {
                          'name': 'button',
                          'open': false,
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
                              'color': '#171717',
                              'fontSize': '16px',
                              'isActive': true
                            },
                            'backgrounds': {
                              'isActive': true,
                              'backgroundColor': '#e5e5e5'
                            }
                          },
                          'classes': 'flex flex-row items-center justify-center pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] bg-[#e5e5e5] text-[#171717]',
                          'children': [
                            {
                              'name': 'text',
                              'design': {
                                'typography': {
                                  'fontSize': '16px',
                                  'isActive': true
                                }
                              },
                              'classes': 'text-[16px]',
                              'settings': {
                                'tag': 'span'
                              },
                              'variables': {
                                'text': {
                                  'data': {
                                    'content': {
                                      'type': 'doc',
                                      'content': [
                                        {
                                          'type': 'paragraph',
                                          'content': [
                                            {
                                              'text': 'Learn more',
                                              'type': 'text'
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  },
                                  'type': 'dynamic_rich_text'
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
                      'customName': 'Columns'
                    }
                  ],
                  'customName': 'Rows'
                }
              ],
              'customName': 'Columns'
            }
          ],
          'customName': 'Container'
        }
      ],
      'customName': 'Section'
    },
  },

  'header-004': {
    category: 'Header',
    previewImage: '/layouts/header-004.webp',
    template: {
      'name': 'section',
      'open': false,
      'design': {
        'layout': {
          'display': 'Flex',
          'isActive': true,
          'alignItems': 'center',
          'flexDirection': 'column'
        },
        'spacing': {
          'isActive': true,
          'paddingTop': '100',
          'paddingBottom': '100'
        },
        'positioning': {
          'position': 'relative',
          'isActive': true
        },
        'backgrounds': {
          'backgroundColor': '#000000',
          'isActive': true
        }
      },
      'classes': 'flex flex-col items-center relative bg-[#000000] pt-[100px] pb-[100px]',
      'children': [
        {
          'name': 'div',
          'open': false,
          'design': {
            'layout': {
              'display': 'Flex',
              'isActive': true,
              'alignItems': 'start',
              'flexDirection': 'column'
            },
            'sizing': {
              'width': '100%',
              'isActive': true,
              'maxWidth': '1280px'
            },
            'spacing': {
              'isActive': true,
              'paddingLeft': '32px',
              'paddingRight': '32px'
            },
            'positioning': {
              'position': 'relative',
              'isActive': true,
              'zIndex': '10'
            }
          },
          'classes': 'flex flex-col max-w-[1280px] w-[100%] pl-[32px] pr-[32px] relative z-[10] items-start',
          'children': [
            {
              'name': 'div',
              'open': false,
              'design': {
                'layout': {
                  'gap': '16px',
                  'display': 'Flex',
                  'isActive': true,
                  'flexDirection': 'column'
                },
                'sizing': {
                  'width': '[100%]',
                  'isActive': true,
                  'maxWidth': '640'
                }
              },
              'classes': 'flex flex-col gap-[16px] w-[100%] max-w-[640px]',
              'children': [
                {
                  'name': 'text',
                  'settings': {
                    'tag': 'p'
                  },
                  'classes': 'text-[16px] text-[#ffffff]',
                  'restrictions': {
                    'editText': true
                  },
                  'design': {
                    'typography': {
                      'isActive': true,
                      'fontSize': '16px',
                      'color': '#ffffff'
                    }
                  },
                  'variables': {
                    'text': {
                      'type': 'dynamic_rich_text',
                      'data': {
                        'content': {
                          'type': 'doc',
                          'content': [
                            {
                              'type': 'paragraph',
                              'content': [
                                {
                                  'type': 'text',
                                  'text': 'Tagline'
                                }
                              ]
                            }
                          ]
                        }
                      }
                    }
                  },
                  'customName': 'Paragraph'
                },
                {
                  'name': 'text',
                  'design': {
                    'typography': {
                      'fontSize': '36',
                      'isActive': true,
                      'fontWeight': '700',
                      'lineHeight': '1.1',
                      'letterSpacing': '-0.02',
                      'color': '#ffffff'
                    }
                  },
                  'classes': 'font-[700] tracking-[-0.02em] text-[60px] leading-[1.1] max-md:text-[36px] text-[#ffffff]',
                  'settings': {
                    'tag': 'h1'
                  },
                  'variables': {
                    'text': {
                      'type': 'dynamic_rich_text',
                      'data': {
                        'content': {
                          'type': 'doc',
                          'content': [
                            {
                              'type': 'paragraph',
                              'content': [
                                {
                                  'type': 'text',
                                  'text': 'Headline'
                                }
                              ]
                            }
                          ]
                        }
                      }
                    }
                  },
                  'customName': 'Heading',
                  'restrictions': {
                    'editText': true
                  }
                },
                {
                  'name': 'text',
                  'design': {
                    'typography': {
                      'color': '#ffffff/60',
                      'fontSize': '20',
                      'isActive': true
                    }
                  },
                  'classes': 'text-[20px] text-[#ffffff]/60',
                  'settings': {
                    'tag': 'p'
                  },
                  'variables': {
                    'text': {
                      'type': 'dynamic_rich_text',
                      'data': {
                        'content': {
                          'type': 'doc',
                          'content': [
                            {
                              'type': 'paragraph',
                              'content': [
                                {
                                  'type': 'text',
                                  'text': 'Let copywriters easily work with content via content management system or visually on canvas without breaking design.'
                                }
                              ]
                            }
                          ]
                        }
                      }
                    }
                  },
                  'customName': 'Paragraph',
                  'restrictions': {
                    'editText': true
                  }
                },
                {
                  'name': 'div',
                  'open': false,
                  'design': {
                    'layout': {
                      'gap': '8px',
                      'display': 'Flex',
                      'isActive': true
                    }
                  },
                  'classes': 'flex gap-[8px]',
                  'children': [
                    {
                      'name': 'button',
                      'open': false,
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
                          'isActive': true,
                          'textAlign': 'center'
                        },
                        'backgrounds': {
                          'isActive': true,
                          'backgroundColor': '#2563eb'
                        }
                      },
                      'classes': 'flex flex-row items-center justify-center text-[#FFFFFF] pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] bg-[#171717] text-center',
                      'children': [
                        {
                          'name': 'text',
                          'design': {
                            'typography': {
                              'fontSize': '16px',
                              'isActive': true
                            }
                          },
                          'classes': 'text-[16px]',
                          'settings': {
                            'tag': 'span'
                          },
                          'variables': {
                            'text': {
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'text': 'Get started',
                                          'type': 'text'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              },
                              'type': 'dynamic_rich_text'
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
                    },
                    {
                      'name': 'button',
                      'open': false,
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
                          'color': '#171717',
                          'fontSize': '16px',
                          'isActive': true
                        },
                        'backgrounds': {
                          'isActive': true,
                          'backgroundColor': '#e5e5e5'
                        }
                      },
                      'classes': 'flex flex-row items-center justify-center pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] bg-[#e5e5e5] text-[#171717]',
                      'children': [
                        {
                          'name': 'text',
                          'design': {
                            'typography': {
                              'fontSize': '16px',
                              'isActive': true
                            }
                          },
                          'classes': 'text-[16px]',
                          'settings': {
                            'tag': 'span'
                          },
                          'variables': {
                            'text': {
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'text': 'Learn more',
                                          'type': 'text'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              },
                              'type': 'dynamic_rich_text'
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
                  'customName': 'Columns'
                }
              ],
              'customName': 'Rows'
            }
          ],
          'customName': 'Container'
        },
        {
          'name': 'image',
          'settings': {
            'tag': 'img'
          },
          'classes': 'absolute left-[0px] top-[0px] right-[0px] bottom-[0px] w-[100%] h-au h-[100%] object-cover opacity-[30%]',
          'attributes': {
            'loading': 'lazy'
          },
          'design': {
            'sizing': {
              'isActive': true,
              'width': '[100%]',
              'height': '[100%]',
              'objectFit': 'cover'
            },
            'positioning': {
              'position': 'absolute',
              'isActive': true,
              'left': '0',
              'top': '0',
              'right': '0',
              'bottom': '0'
            },
            'effects': {
              'opacity': '30',
              'isActive': true
            }
          },
          'variables': {
            'image': {
              'src': {
                'type': 'dynamic_text',
                'data': {
                  'content': 'https://app.ycode.com/images/layouts/image-ps9xO6m7BE34lp9dkPue4aAL8mcsDjw6UKg0rIVb.webp'
                }
              },
              'alt': {
                'type': 'dynamic_text',
                'data': {
                  'content': ''
                }
              }
            }
          },
          'customName': 'Image'
        }
      ],
      'customName': 'Section'
    },
  },

  'features-001': {
    category: 'Features',
    previewImage: '/layouts/features-001.webp',
    template: {
      'name': 'section',
      'open': false,
      'design': {
        'layout': {
          'display': 'Flex',
          'isActive': true,
          'alignItems': 'center',
          'flexDirection': 'column'
        },
        'spacing': {
          'isActive': true,
          'paddingTop': '140',
          'paddingBottom': '140'
        },
        'backgrounds': {
          'backgroundColor': '#ffffff',
          'isActive': true
        }
      },
      'classes': 'flex flex-col items-center pt-[140px] pb-[140px] bg-[#ffffff]',
      'children': [
        {
          'name': 'div',
          'open': false,
          'design': {
            'layout': {
              'display': 'Flex',
              'isActive': true,
              'flexDirection': 'column'
            },
            'sizing': {
              'width': '100%',
              'isActive': true,
              'maxWidth': '1280px'
            },
            'spacing': {
              'isActive': true,
              'paddingLeft': '32px',
              'paddingRight': '32px'
            }
          },
          'classes': 'flex flex-col max-w-[1280px] w-[100%] pl-[32px] pr-[32px]',
          'children': [
            {
              'name': 'div',
              'design': {
                'layout': {
                  'display': 'Flex',
                  'isActive': true,
                  'flexDirection': 'column',
                  'gap': '120'
                }
              },
              'classes': 'flex flex-col gap-[120px]',
              'children': [
                {
                  'name': 'div',
                  'open': true,
                  'design': {
                    'layout': {
                      'gap': '72',
                      'display': 'Grid',
                      'isActive': true,
                      'alignItems': 'center',
                      'gridTemplateColumns': 'repeat(1, 1fr)'
                    }
                  },
                  'classes': 'grid grid-cols-[repeat(2,_1fr)] gap-[72px] items-center max-lg:grid-cols-[repeat(1,_1fr)]',
                  'children': [
                    {
                      'name': 'div',
                      'open': false,
                      'design': {
                        'layout': {
                          'gap': '16px',
                          'display': 'Flex',
                          'isActive': true,
                          'flexDirection': 'column'
                        }
                      },
                      'classes': 'flex flex-col gap-[16px]',
                      'children': [
                        {
                          'name': 'text',
                          'design': {
                            'typography': {
                              'fontSize': '48',
                              'isActive': true,
                              'fontWeight': '700',
                              'lineHeight': '1.1',
                              'letterSpacing': '-0.02'
                            }
                          },
                          'classes': 'font-[700] tracking-[-0.02em] max-md:text-[36px] text-[48px] leading-[1.1]',
                          'settings': {
                            'tag': 'h2'
                          },
                          'variables': {
                            'text': {
                              'type': 'dynamic_rich_text',
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'type': 'text',
                                          'text': 'Get your professional website running today'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              }
                            }
                          },
                          'customName': 'Heading',
                          'restrictions': {
                            'editText': true
                          }
                        },
                        {
                          'name': 'text',
                          'design': {
                            'typography': {
                              'color': '#000000/60',
                              'fontSize': '20',
                              'isActive': true
                            }
                          },
                          'classes': 'text-[20px] text-[#000000]/60',
                          'settings': {
                            'tag': 'p'
                          },
                          'variables': {
                            'text': {
                              'type': 'dynamic_rich_text',
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'type': 'text',
                                          'text': 'Visually build and design beautiful, responsive web projects without compromising your vision.'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              }
                            }
                          },
                          'customName': 'Paragraph',
                          'restrictions': {
                            'editText': true
                          }
                        }
                      ],
                      'customName': 'Rows'
                    },
                    {
                      'name': 'div',
                      'open': false,
                      'design': {
                        'layout': {
                          'display': 'Flex',
                          'isActive': true,
                          'flexDirection': 'column'
                        }
                      },
                      'classes': 'flex flex-col',
                      'children': [
                        {
                          'name': 'image',
                          'design': {
                            'sizing': {
                              'width': '[100%]',
                              'isActive': true,
                              'objectFit': 'cover'
                            },
                            'borders': {
                              'isActive': true,
                              'borderRadius': '24'
                            }
                          },
                          'classes': 'w-[100%] object-cover rounded-[24px]',
                          'settings': {
                            'tag': 'img'
                          },
                          'variables': {
                            'image': {
                              'alt': {
                                'data': {
                                  'content': ''
                                },
                                'type': 'dynamic_text'
                              },
                              'src': {
                                'data': {
                                  'content': 'https://app.ycode.com/images/layouts/image-v7rjaWPn4Dd0YIEQoyCUm59jmzwsHM8tRUJ756RV.webp'
                                },
                                'type': 'dynamic_text'
                              }
                            }
                          },
                          'attributes': {
                            'loading': 'lazy'
                          },
                          'customName': 'Image'
                        }
                      ],
                      'customName': 'Block'
                    }
                  ],
                  'customName': 'Grid'
                },
                {
                  'name': 'div',
                  'classes': 'grid grid-cols-[repeat(2,_1fr)] gap-[72px] items-center max-lg:grid-cols-[repeat(1,_1fr)]',
                  'children': [
                    {
                      'name': 'div',
                      'open': false,
                      'design': {
                        'layout': {
                          'display': 'Flex',
                          'isActive': true,
                          'flexDirection': 'column'
                        }
                      },
                      'classes': 'flex flex-col',
                      'children': [
                        {
                          'name': 'image',
                          'design': {
                            'sizing': {
                              'width': '[100%]',
                              'isActive': true,
                              'objectFit': 'cover'
                            },
                            'borders': {
                              'isActive': true,
                              'borderRadius': '24'
                            }
                          },
                          'classes': 'w-[100%] object-cover rounded-[24px]',
                          'settings': {
                            'tag': 'img'
                          },
                          'variables': {
                            'image': {
                              'alt': {
                                'data': {
                                  'content': ''
                                },
                                'type': 'dynamic_text'
                              },
                              'src': {
                                'data': {
                                  'content': 'https://app.ycode.com/images/layouts/image-v7rjaWPn4Dd0YIEQoyCUm59jmzwsHM8tRUJ756RV.webp'
                                },
                                'type': 'dynamic_text'
                              }
                            }
                          },
                          'attributes': {
                            'loading': 'lazy'
                          },
                          'customName': 'Image'
                        }
                      ],
                      'customName': 'Block'
                    },
                    {
                      'name': 'div',
                      'open': false,
                      'design': {
                        'layout': {
                          'gap': '16px',
                          'display': 'Flex',
                          'isActive': true,
                          'flexDirection': 'column'
                        }
                      },
                      'classes': 'flex flex-col gap-[16px]',
                      'children': [
                        {
                          'name': 'text',
                          'design': {
                            'typography': {
                              'fontSize': '48',
                              'isActive': true,
                              'fontWeight': '700',
                              'lineHeight': '1.1',
                              'letterSpacing': '-0.02'
                            }
                          },
                          'classes': 'font-[700] tracking-[-0.02em] max-md:text-[36px] text-[48px] leading-[1.1]',
                          'settings': {
                            'tag': 'h2'
                          },
                          'variables': {
                            'text': {
                              'type': 'dynamic_rich_text',
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'type': 'text',
                                          'text': 'Try it out using templates'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              }
                            }
                          },
                          'customName': 'Heading',
                          'restrictions': {
                            'editText': true
                          }
                        },
                        {
                          'name': 'text',
                          'design': {
                            'typography': {
                              'color': '#000000/60',
                              'fontSize': '20',
                              'isActive': true
                            }
                          },
                          'classes': 'text-[20px] text-[#000000]/60',
                          'settings': {
                            'tag': 'p'
                          },
                          'variables': {
                            'text': {
                              'type': 'dynamic_rich_text',
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'type': 'text',
                                          'text': 'Browse through hundreds of professional website templates. Pick a template you like, customize it to fit your style without writing any code.'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              }
                            }
                          },
                          'customName': 'Paragraph',
                          'restrictions': {
                            'editText': true
                          }
                        }
                      ],
                      'customName': 'Rows'
                    }
                  ],
                  'design': {
                    'layout': {
                      'gap': '72',
                      'display': 'Grid',
                      'isActive': true,
                      'alignItems': 'center',
                      'gridTemplateColumns': 'repeat(1, 1fr)'
                    }
                  },
                  'customName': 'Grid',
                  'open': false
                }
              ],
              'customName': 'Rows',
              'open': false
            }
          ],
          'customName': 'Container'
        }
      ],
      'customName': 'Section'
    },
  },

  'features-002': {
    category: 'Features',
    previewImage: '/layouts/features-002.webp',
    template: {
      'name': 'section',
      'classes': 'flex flex-col items-center pt-[140px] pb-[140px] bg-[#ffffff]',
      'children': [
        {
          'name': 'div',
          'classes': 'flex flex-col max-w-[1280px] w-[100%] pl-[32px] pr-[32px]',
          'children': [
            {
              'name': 'div',
              'classes': 'flex flex-col items-center gap-[72px]',
              'children': [
                {
                  'name': 'div',
                  'open': false,
                  'design': {
                    'layout': {
                      'gap': '16px',
                      'display': 'Flex',
                      'isActive': true,
                      'flexDirection': 'column',
                      'alignItems': 'center'
                    },
                    'sizing': {
                      'width': '[100%]',
                      'isActive': true
                    }
                  },
                  'classes': 'flex flex-col gap-[16px] w-[100%] items-center',
                  'children': [
                    {
                      'name': 'text',
                      'settings': {
                        'tag': 'p'
                      },
                      'classes': 'text-[16px] text-center',
                      'restrictions': {
                        'editText': true
                      },
                      'design': {
                        'typography': {
                          'isActive': true,
                          'fontSize': '16px',
                          'textAlign': 'center'
                        }
                      },
                      'variables': {
                        'text': {
                          'type': 'dynamic_rich_text',
                          'data': {
                            'content': {
                              'type': 'doc',
                              'content': [
                                {
                                  'type': 'paragraph',
                                  'content': [
                                    {
                                      'type': 'text',
                                      'text': 'Tagline'
                                    }
                                  ]
                                }
                              ]
                            }
                          }
                        }
                      },
                      'customName': 'Paragraph'
                    },
                    {
                      'name': 'text',
                      'design': {
                        'typography': {
                          'isActive': true,
                          'fontWeight': '700',
                          'lineHeight': '1.1',
                          'letterSpacing': '-0.02',
                          'textAlign': 'center',
                          'fontSize': '48'
                        }
                      },
                      'classes': 'font-[700] tracking-[-0.02em] max-md:text-[36px] text-center text-[48px] leading-[1.1]',
                      'settings': {
                        'tag': 'h1'
                      },
                      'variables': {
                        'text': {
                          'type': 'dynamic_rich_text',
                          'data': {
                            'content': {
                              'type': 'doc',
                              'content': [
                                {
                                  'type': 'paragraph',
                                  'content': [
                                    {
                                      'type': 'text',
                                      'text': 'Everything you need to create your website'
                                    }
                                  ]
                                }
                              ]
                            }
                          }
                        }
                      },
                      'customName': 'Heading',
                      'restrictions': {
                        'editText': true
                      }
                    },
                    {
                      'name': 'text',
                      'design': {
                        'typography': {
                          'color': '#000000/60',
                          'fontSize': '20',
                          'isActive': true,
                          'textAlign': 'center'
                        }
                      },
                      'classes': 'text-[20px] text-[#000000]/60 text-center',
                      'settings': {
                        'tag': 'p'
                      },
                      'variables': {
                        'text': {
                          'type': 'dynamic_rich_text',
                          'data': {
                            'content': {
                              'type': 'doc',
                              'content': [
                                {
                                  'type': 'paragraph',
                                  'content': [
                                    {
                                      'type': 'text',
                                      'text': 'Customize and create a professional site in minutes.'
                                    }
                                  ]
                                }
                              ]
                            }
                          }
                        }
                      },
                      'customName': 'Paragraph',
                      'restrictions': {
                        'editText': true
                      }
                    }
                  ],
                  'customName': 'Rows'
                },
                {
                  'name': 'div',
                  'classes': 'grid w-[100%] grid-cols-[repeat(3,_1fr)] gap-[56px] max-lg:grid-cols-[repeat(1,_1fr)]',
                  'children': [
                    {
                      'name': 'div',
                      'classes': 'flex flex-col gap-[12px]',
                      'children': [
                        {
                          'name': 'div',
                          'classes': 'flex gap-[16px]',
                          'children': [
                            {
                              'name': 'text',
                              'settings': {
                                'tag': 'p'
                              },
                              'classes': 'text-[16px] font-[500]',
                              'restrictions': {
                                'editText': true
                              },
                              'design': {
                                'typography': {
                                  'isActive': true,
                                  'fontSize': '16px',
                                  'fontWeight': '500'
                                }
                              },
                              'variables': {
                                'text': {
                                  'type': 'dynamic_rich_text',
                                  'data': {
                                    'content': {
                                      'type': 'doc',
                                      'content': [
                                        {
                                          'type': 'paragraph',
                                          'content': [
                                            {
                                              'type': 'text',
                                              'text': 'Layout & Design'
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  }
                                }
                              },
                              'customName': 'Paragraph'
                            }
                          ],
                          'design': {
                            'layout': {
                              'isActive': true,
                              'display': 'Flex',
                              'gap': '16px'
                            }
                          },
                          'customName': 'Columns',
                          'open': false
                        },
                        {
                          'name': 'text',
                          'settings': {
                            'tag': 'p'
                          },
                          'classes': 'text-[16px] text-[#000000]/60',
                          'restrictions': {
                            'editText': true
                          },
                          'design': {
                            'typography': {
                              'isActive': true,
                              'fontSize': '16px',
                              'color': '#000000/60'
                            }
                          },
                          'variables': {
                            'text': {
                              'type': 'dynamic_rich_text',
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'type': 'text',
                                          'text': 'Our visual editor empowers you to create stunning, impactful designs effortlessly, leaving a lasting impression on your audience.'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              }
                            }
                          },
                          'customName': 'Paragraph'
                        }
                      ],
                      'design': {
                        'layout': {
                          'isActive': true,
                          'display': 'Flex',
                          'flexDirection': 'column',
                          'gap': '12'
                        }
                      },
                      'customName': 'Rows',
                      'open': false
                    },
                    {
                      'name': 'div',
                      'classes': 'flex flex-col gap-[12px]',
                      'children': [
                        {
                          'name': 'div',
                          'classes': 'flex gap-[16px]',
                          'children': [
                            {
                              'name': 'text',
                              'settings': {
                                'tag': 'p'
                              },
                              'classes': 'text-[16px] font-[500]',
                              'restrictions': {
                                'editText': true
                              },
                              'design': {
                                'typography': {
                                  'isActive': true,
                                  'fontSize': '16px',
                                  'fontWeight': '500'
                                }
                              },
                              'variables': {
                                'text': {
                                  'type': 'dynamic_rich_text',
                                  'data': {
                                    'content': {
                                      'type': 'doc',
                                      'content': [
                                        {
                                          'type': 'paragraph',
                                          'content': [
                                            {
                                              'type': 'text',
                                              'text': 'CMS'
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  }
                                }
                              },
                              'customName': 'Paragraph'
                            }
                          ],
                          'design': {
                            'layout': {
                              'isActive': true,
                              'display': 'Flex',
                              'gap': '16px'
                            }
                          },
                          'customName': 'Columns',
                          'open': false
                        },
                        {
                          'name': 'text',
                          'settings': {
                            'tag': 'p'
                          },
                          'classes': 'text-[16px] text-[#000000]/60',
                          'restrictions': {
                            'editText': true
                          },
                          'design': {
                            'typography': {
                              'isActive': true,
                              'fontSize': '16px',
                              'color': '#000000/60'
                            }
                          },
                          'variables': {
                            'text': {
                              'type': 'dynamic_rich_text',
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'type': 'text',
                                          'text': 'Our visual editor empowers you to create stunning, impactful designs effortlessly, leaving a lasting impression on your audience.'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              }
                            }
                          },
                          'customName': 'Paragraph'
                        }
                      ],
                      'design': {
                        'layout': {
                          'isActive': true,
                          'display': 'Flex',
                          'flexDirection': 'column',
                          'gap': '12'
                        }
                      },
                      'customName': 'Rows',
                      'open': false
                    },
                    {
                      'name': 'div',
                      'classes': 'flex flex-col gap-[12px]',
                      'children': [
                        {
                          'name': 'div',
                          'classes': 'flex gap-[16px]',
                          'children': [
                            {
                              'name': 'text',
                              'settings': {
                                'tag': 'p'
                              },
                              'classes': 'text-[16px] font-[500]',
                              'restrictions': {
                                'editText': true
                              },
                              'design': {
                                'typography': {
                                  'isActive': true,
                                  'fontSize': '16px',
                                  'fontWeight': '500'
                                }
                              },
                              'variables': {
                                'text': {
                                  'type': 'dynamic_rich_text',
                                  'data': {
                                    'content': {
                                      'type': 'doc',
                                      'content': [
                                        {
                                          'type': 'paragraph',
                                          'content': [
                                            {
                                              'type': 'text',
                                              'text': 'Forms'
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  }
                                }
                              },
                              'customName': 'Paragraph'
                            }
                          ],
                          'design': {
                            'layout': {
                              'isActive': true,
                              'display': 'Flex',
                              'gap': '16px'
                            }
                          },
                          'customName': 'Columns',
                          'open': false
                        },
                        {
                          'name': 'text',
                          'settings': {
                            'tag': 'p'
                          },
                          'classes': 'text-[16px] text-[#000000]/60',
                          'restrictions': {
                            'editText': true
                          },
                          'design': {
                            'typography': {
                              'isActive': true,
                              'fontSize': '16px',
                              'color': '#000000/60'
                            }
                          },
                          'variables': {
                            'text': {
                              'type': 'dynamic_rich_text',
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'type': 'text',
                                          'text': 'Our visual editor empowers you to create stunning, impactful designs effortlessly, leaving a lasting impression on your audience.'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              }
                            }
                          },
                          'customName': 'Paragraph'
                        }
                      ],
                      'design': {
                        'layout': {
                          'isActive': true,
                          'display': 'Flex',
                          'flexDirection': 'column',
                          'gap': '12'
                        }
                      },
                      'customName': 'Rows',
                      'open': false
                    }
                  ],
                  'design': {
                    'layout': {
                      'isActive': true,
                      'display': 'Grid',
                      'gap': '56',
                      'gridTemplateColumns': 'repeat(1, 1fr)'
                    },
                    'sizing': {
                      'width': '[100%]',
                      'isActive': true
                    }
                  },
                  'customName': 'Grid',
                  'open': false
                }
              ],
              'design': {
                'layout': {
                  'isActive': true,
                  'display': 'Flex',
                  'flexDirection': 'column',
                  'gap': '72',
                  'alignItems': 'center'
                }
              },
              'customName': 'Rows',
              'open': false
            }
          ],
          'design': {
            'layout': {
              'isActive': true,
              'display': 'Flex',
              'flexDirection': 'column'
            },
            'sizing': {
              'isActive': true,
              'width': '100%',
              'maxWidth': '1280px'
            },
            'spacing': {
              'isActive': true,
              'paddingLeft': '32px',
              'paddingRight': '32px'
            }
          },
          'customName': 'Container',
          'open': false
        }
      ],
      'design': {
        'layout': {
          'isActive': true,
          'display': 'Flex',
          'flexDirection': 'column',
          'alignItems': 'center'
        },
        'spacing': {
          'isActive': true,
          'paddingTop': '140',
          'paddingBottom': '140'
        },
        'backgrounds': {
          'backgroundColor': '#ffffff',
          'isActive': true
        }
      },
      'customName': 'Section',
      'open': false
    },
  },

  'features-003': {
    category: 'Features',
    previewImage: '/layouts/features-003.webp',
    template: {
      'name': 'section',
      'classes': 'flex flex-col items-center pt-[140px] pb-[140px] bg-[#ffffff]',
      'children': [
        {
          'name': 'div',
          'classes': 'flex flex-col max-w-[1280px] w-[100%] pl-[32px] pr-[32px]',
          'children': [
            {
              'name': 'div',
              'classes': 'grid grid-cols-[repeat(2,_1fr)] gap-[72px] max-lg:grid-cols-[repeat(1,_1fr)]',
              'children': [
                {
                  'name': 'div',
                  'classes': 'flex flex-col gap-[56px]',
                  'children': [
                    {
                      'name': 'div',
                      'open': false,
                      'design': {
                        'layout': {
                          'gap': '16px',
                          'display': 'Flex',
                          'isActive': true,
                          'flexDirection': 'column'
                        },
                        'sizing': {
                          'width': '[100%]',
                          'isActive': true,
                          'maxWidth': '640'
                        }
                      },
                      'classes': 'flex flex-col gap-[16px] w-[100%] max-w-[640px]',
                      'children': [
                        {
                          'name': 'text',
                          'settings': {
                            'tag': 'p'
                          },
                          'classes': 'text-[16px]',
                          'restrictions': {
                            'editText': true
                          },
                          'design': {
                            'typography': {
                              'isActive': true,
                              'fontSize': '16px'
                            }
                          },
                          'variables': {
                            'text': {
                              'type': 'dynamic_rich_text',
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'type': 'text',
                                          'text': 'Create without boundaries'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              }
                            }
                          },
                          'customName': 'Paragraph'
                        },
                        {
                          'name': 'text',
                          'design': {
                            'typography': {
                              'fontSize': '48',
                              'isActive': true,
                              'fontWeight': '700',
                              'lineHeight': '1.1',
                              'letterSpacing': '-0.02'
                            }
                          },
                          'classes': 'font-[700] tracking-[-0.02em] max-md:text-[36px] text-[48px] leading-[1.1]',
                          'settings': {
                            'tag': 'h2'
                          },
                          'variables': {
                            'text': {
                              'type': 'dynamic_rich_text',
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'type': 'text',
                                          'text': 'All the tools you need to build your website'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              }
                            }
                          },
                          'customName': 'Heading',
                          'restrictions': {
                            'editText': true
                          }
                        },
                        {
                          'name': 'text',
                          'design': {
                            'typography': {
                              'color': '#000000/60',
                              'fontSize': '20',
                              'isActive': true
                            }
                          },
                          'classes': 'text-[20px] text-[#000000]/60',
                          'settings': {
                            'tag': 'p'
                          },
                          'variables': {
                            'text': {
                              'type': 'dynamic_rich_text',
                              'data': {
                                'content': {
                                  'type': 'doc',
                                  'content': [
                                    {
                                      'type': 'paragraph',
                                      'content': [
                                        {
                                          'type': 'text',
                                          'text': 'Unlock the potential of easy-to-use visual editor, harness the power of built-in CMS and authentication.'
                                        }
                                      ]
                                    }
                                  ]
                                }
                              }
                            }
                          },
                          'customName': 'Paragraph',
                          'restrictions': {
                            'editText': true
                          }
                        }
                      ],
                      'customName': 'Rows'
                    },
                    {
                      'name': 'div',
                      'classes': 'grid w-[100%] grid-cols-[repeat(2,_1fr)] gap-[56px] max-lg:grid-cols-[repeat(2,_1fr)] max-md:grid-cols-[repeat(1,_1fr)]',
                      'children': [
                        {
                          'name': 'div',
                          'classes': 'flex flex-col gap-[12px]',
                          'children': [
                            {
                              'name': 'div',
                              'classes': 'flex gap-[16px]',
                              'children': [
                                {
                                  'name': 'text',
                                  'settings': {
                                    'tag': 'p'
                                  },
                                  'classes': 'text-[16px] font-[500]',
                                  'restrictions': {
                                    'editText': true
                                  },
                                  'design': {
                                    'typography': {
                                      'isActive': true,
                                      'fontSize': '16px',
                                      'fontWeight': '500'
                                    }
                                  },
                                  'variables': {
                                    'text': {
                                      'type': 'dynamic_rich_text',
                                      'data': {
                                        'content': {
                                          'type': 'doc',
                                          'content': [
                                            {
                                              'type': 'paragraph',
                                              'content': [
                                                {
                                                  'type': 'text',
                                                  'text': 'Layout & Design'
                                                }
                                              ]
                                            }
                                          ]
                                        }
                                      }
                                    }
                                  },
                                  'customName': 'Paragraph'
                                }
                              ],
                              'design': {
                                'layout': {
                                  'isActive': true,
                                  'display': 'Flex',
                                  'gap': '16px'
                                }
                              },
                              'customName': 'Columns',
                              'open': false
                            },
                            {
                              'name': 'text',
                              'settings': {
                                'tag': 'p'
                              },
                              'classes': 'text-[16px] text-[#000000]/60',
                              'restrictions': {
                                'editText': true
                              },
                              'design': {
                                'typography': {
                                  'isActive': true,
                                  'fontSize': '16px',
                                  'color': '#000000/60'
                                }
                              },
                              'variables': {
                                'text': {
                                  'type': 'dynamic_rich_text',
                                  'data': {
                                    'content': {
                                      'type': 'doc',
                                      'content': [
                                        {
                                          'type': 'paragraph',
                                          'content': [
                                            {
                                              'type': 'text',
                                              'text': 'Our visual editor gives you the power to craft stunning designs that will leave an impact.'
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  }
                                }
                              },
                              'customName': 'Paragraph'
                            }
                          ],
                          'design': {
                            'layout': {
                              'isActive': true,
                              'display': 'Flex',
                              'flexDirection': 'column',
                              'gap': '12'
                            }
                          },
                          'customName': 'Rows',
                          'open': false
                        },
                        {
                          'name': 'div',
                          'classes': 'flex flex-col gap-[12px]',
                          'children': [
                            {
                              'name': 'div',
                              'classes': 'flex gap-[16px]',
                              'children': [
                                {
                                  'name': 'text',
                                  'settings': {
                                    'tag': 'p'
                                  },
                                  'classes': 'text-[16px] font-[500]',
                                  'restrictions': {
                                    'editText': true
                                  },
                                  'design': {
                                    'typography': {
                                      'isActive': true,
                                      'fontSize': '16px',
                                      'fontWeight': '500'
                                    }
                                  },
                                  'variables': {
                                    'text': {
                                      'type': 'dynamic_rich_text',
                                      'data': {
                                        'content': {
                                          'type': 'doc',
                                          'content': [
                                            {
                                              'type': 'paragraph',
                                              'content': [
                                                {
                                                  'type': 'text',
                                                  'text': 'CMS'
                                                }
                                              ]
                                            }
                                          ]
                                        }
                                      }
                                    }
                                  },
                                  'customName': 'Paragraph'
                                }
                              ],
                              'design': {
                                'layout': {
                                  'isActive': true,
                                  'display': 'Flex',
                                  'gap': '16px'
                                }
                              },
                              'customName': 'Columns',
                              'open': false
                            },
                            {
                              'name': 'text',
                              'settings': {
                                'tag': 'p'
                              },
                              'classes': 'text-[16px] text-[#000000]/60',
                              'restrictions': {
                                'editText': true
                              },
                              'design': {
                                'typography': {
                                  'isActive': true,
                                  'fontSize': '16px',
                                  'color': '#000000/60'
                                }
                              },
                              'variables': {
                                'text': {
                                  'type': 'dynamic_rich_text',
                                  'data': {
                                    'content': {
                                      'type': 'doc',
                                      'content': [
                                        {
                                          'type': 'paragraph',
                                          'content': [
                                            {
                                              'type': 'text',
                                              'text': 'Organize your content, your way. Maximize your content for maximum impact.'
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  }
                                }
                              },
                              'customName': 'Paragraph'
                            }
                          ],
                          'design': {
                            'layout': {
                              'isActive': true,
                              'display': 'Flex',
                              'flexDirection': 'column',
                              'gap': '12'
                            }
                          },
                          'customName': 'Rows',
                          'open': false
                        },
                        {
                          'name': 'div',
                          'classes': 'flex flex-col gap-[12px]',
                          'children': [
                            {
                              'name': 'div',
                              'classes': 'flex gap-[16px]',
                              'children': [
                                {
                                  'name': 'text',
                                  'settings': {
                                    'tag': 'p'
                                  },
                                  'classes': 'text-[16px] font-[500]',
                                  'restrictions': {
                                    'editText': true
                                  },
                                  'design': {
                                    'typography': {
                                      'isActive': true,
                                      'fontSize': '16px',
                                      'fontWeight': '500'
                                    }
                                  },
                                  'variables': {
                                    'text': {
                                      'type': 'dynamic_rich_text',
                                      'data': {
                                        'content': {
                                          'type': 'doc',
                                          'content': [
                                            {
                                              'type': 'paragraph',
                                              'content': [
                                                {
                                                  'type': 'text',
                                                  'text': 'Forms'
                                                }
                                              ]
                                            }
                                          ]
                                        }
                                      }
                                    }
                                  },
                                  'customName': 'Paragraph'
                                }
                              ],
                              'design': {
                                'layout': {
                                  'isActive': true,
                                  'display': 'Flex',
                                  'gap': '16px'
                                }
                              },
                              'customName': 'Columns',
                              'open': false
                            },
                            {
                              'name': 'text',
                              'settings': {
                                'tag': 'p'
                              },
                              'classes': 'text-[16px] text-[#000000]/60',
                              'restrictions': {
                                'editText': true
                              },
                              'design': {
                                'typography': {
                                  'isActive': true,
                                  'fontSize': '16px',
                                  'color': '#000000/60'
                                }
                              },
                              'variables': {
                                'text': {
                                  'type': 'dynamic_rich_text',
                                  'data': {
                                    'content': {
                                      'type': 'doc',
                                      'content': [
                                        {
                                          'type': 'paragraph',
                                          'content': [
                                            {
                                              'type': 'text',
                                              'text': 'Organize your content, your way. Maximize your content for maximum impact.'
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  }
                                }
                              },
                              'customName': 'Paragraph'
                            }
                          ],
                          'design': {
                            'layout': {
                              'isActive': true,
                              'display': 'Flex',
                              'flexDirection': 'column',
                              'gap': '12'
                            }
                          },
                          'customName': 'Rows',
                          'open': false
                        },
                        {
                          'name': 'div',
                          'classes': 'flex flex-col gap-[12px]',
                          'children': [
                            {
                              'name': 'div',
                              'classes': 'flex gap-[16px]',
                              'children': [
                                {
                                  'name': 'text',
                                  'settings': {
                                    'tag': 'p'
                                  },
                                  'classes': 'text-[16px] font-[500]',
                                  'restrictions': {
                                    'editText': true
                                  },
                                  'design': {
                                    'typography': {
                                      'isActive': true,
                                      'fontSize': '16px',
                                      'fontWeight': '500'
                                    }
                                  },
                                  'variables': {
                                    'text': {
                                      'type': 'dynamic_rich_text',
                                      'data': {
                                        'content': {
                                          'type': 'doc',
                                          'content': [
                                            {
                                              'type': 'paragraph',
                                              'content': [
                                                {
                                                  'type': 'text',
                                                  'text': 'SEO'
                                                }
                                              ]
                                            }
                                          ]
                                        }
                                      }
                                    }
                                  },
                                  'customName': 'Paragraph'
                                }
                              ],
                              'design': {
                                'layout': {
                                  'isActive': true,
                                  'display': 'Flex',
                                  'gap': '16px'
                                }
                              },
                              'customName': 'Columns',
                              'open': false
                            },
                            {
                              'name': 'text',
                              'settings': {
                                'tag': 'p'
                              },
                              'classes': 'text-[16px] text-[#000000]/60',
                              'restrictions': {
                                'editText': true
                              },
                              'design': {
                                'typography': {
                                  'isActive': true,
                                  'fontSize': '16px',
                                  'color': '#000000/60'
                                }
                              },
                              'variables': {
                                'text': {
                                  'type': 'dynamic_rich_text',
                                  'data': {
                                    'content': {
                                      'type': 'doc',
                                      'content': [
                                        {
                                          'type': 'paragraph',
                                          'content': [
                                            {
                                              'type': 'text',
                                              'text': "Boost your website's SEO with optimized controls, fast hosting, and flexible CMS."
                                            }
                                          ]
                                        }
                                      ]
                                    }
                                  }
                                }
                              },
                              'customName': 'Paragraph'
                            }
                          ],
                          'design': {
                            'layout': {
                              'isActive': true,
                              'display': 'Flex',
                              'flexDirection': 'column',
                              'gap': '12'
                            }
                          },
                          'customName': 'Rows',
                          'open': false
                        }
                      ],
                      'design': {
                        'layout': {
                          'isActive': true,
                          'display': 'Grid',
                          'gap': '56',
                          'gridTemplateColumns': 'repeat(1, 1fr)'
                        },
                        'sizing': {
                          'width': '[100%]',
                          'isActive': true
                        }
                      },
                      'customName': 'Grid',
                      'open': false
                    }
                  ],
                  'design': {
                    'layout': {
                      'isActive': true,
                      'display': 'Flex',
                      'flexDirection': 'column',
                      'gap': '56'
                    }
                  },
                  'customName': 'Rows',
                  'open': false
                },
                {
                  'name': 'div',
                  'classes': 'flex flex-col',
                  'children': [
                    {
                      'name': 'image',
                      'settings': {
                        'tag': 'img'
                      },
                      'classes': 'w-[100%] h-[100%] min-h-[600px] object-cover rounded-[32px]',
                      'attributes': {
                        'loading': 'lazy'
                      },
                      'design': {
                        'sizing': {
                          'isActive': true,
                          'width': '[100%]',
                          'height': '[100%]',
                          'minHeight': '600',
                          'objectFit': 'cover'
                        },
                        'borders': {
                          'borderRadius': '32',
                          'isActive': true
                        }
                      },
                      'variables': {
                        'image': {
                          'src': {
                            'type': 'dynamic_text',
                            'data': {
                              'content': 'https://app.ycode.com/images/layouts/image-Gcfb6ps8XUYiLLuoFtli2KYJyEjXrOpF7hnl6qc7.webp'
                            }
                          },
                          'alt': {
                            'type': 'dynamic_text',
                            'data': {
                              'content': 'Image description'
                            }
                          }
                        }
                      },
                      'customName': 'Image'
                    }
                  ],
                  'design': {
                    'layout': {
                      'isActive': true,
                      'display': 'Flex',
                      'flexDirection': 'column'
                    }
                  },
                  'open': false
                }
              ],
              'design': {
                'layout': {
                  'isActive': true,
                  'display': 'Grid',
                  'gap': '72',
                  'gridTemplateColumns': 'repeat(1, 1fr)'
                }
              },
              'customName': 'Grid',
              'open': false
            }
          ],
          'design': {
            'layout': {
              'isActive': true,
              'display': 'Flex',
              'flexDirection': 'column'
            },
            'sizing': {
              'isActive': true,
              'width': '100%',
              'maxWidth': '1280px'
            },
            'spacing': {
              'isActive': true,
              'paddingLeft': '32px',
              'paddingRight': '32px'
            }
          },
          'customName': 'Container',
          'open': false
        }
      ],
      'design': {
        'layout': {
          'isActive': true,
          'display': 'Flex',
          'flexDirection': 'column',
          'alignItems': 'center'
        },
        'spacing': {
          'isActive': true,
          'paddingTop': '140',
          'paddingBottom': '140'
        },
        'backgrounds': {
          'backgroundColor': '#ffffff',
          'isActive': true
        }
      },
      'customName': 'Section',
      'open': false
    },
  },
};
