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
                      'name': 'heading',
                      'design': {
                        'sizing': {
                          'isActive': true
                        },
                        'typography': {
                          'color': '#000000',
                          'fontSize': '36',
                          'isActive': true,
                          'fontWeight': '700',
                          'lineHeight': '1.1',
                          'letterSpacing': '-0.02'
                        }
                      },
                      'classes': 'font-[700] leading-[1.1] text-[60px] tracking-[-0.02em] max-md:text-[36px] text-[#000000]',
                      'children': [],
                      'settings': {
                        'tag': 'h1'
                      },
                      'variables': {
                        'text': {
                          'data': {
                            'content': 'Create stunning websites with ease'
                          },
                          'type': 'dynamic_text'
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
                          'name': 'p',
                          'design': {
                            'typography': {
                              'color': '#000000/60',
                              'fontSize': '20',
                              'isActive': true
                            }
                          },
                          'classes': 'text-[20px] text-[#000000]/60',
                          'children': [],
                          'variables': {
                            'text': {
                              'data': {
                                'content': 'Unlock the power to create impressive, professional websites with user-friendly tools and intuitive design.'
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
                      'name': 'div',
                      'design': {
                        'layout': {
                          'gap': '8',
                          'display': 'flex',
                          'isActive': true,
                          'flexDirection': 'column'
                        }
                      },
                      'classes': 'flex gap-[8px] max-md:flex max-md:flex-col',
                      'children': [
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
                                    'content': 'Get started'
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
                              'color': '#171717',
                              'fontSize': '16px',
                              'isActive': true
                            },
                            'backgrounds': {
                              'isActive': true,
                              'backgroundColor': '#e5e5e5'
                            }
                          },
                          'classes': 'flex flex-row items-center justify-center pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] text-[#171717] bg-[#e5e5e5]',
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
                                    'content': 'Learn more'
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
                  'name': 'heading',
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
                  'classes': 'text-[48px] font-[700] leading-[1.1] tracking-[-0.02em] text-center max-md:text-[36px]',
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
                      'color': '#000000/60',
                      'isActive': true,
                      'textAlign': 'center'
                    }
                  },
                  'classes': 'text-[20px] text-[#000000]/60 text-center',
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
                },
                {
                  'name': 'div',
                  'classes': 'flex gap-ąč gap-[8px]',
                  'children': [
                    {
                      'name': 'button',
                      'classes': 'flex flex-row items-center justify-center text-[#FFFFFF] pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] bg-[#171717]',
                      'children': [
                        {
                          'name': 'span',
                          'classes': 'text-[16px]',
                          'restrictions': {
                            'editText': true
                          },
                          'children': [],
                          'design': {
                            'typography': {
                              'isActive': true,
                              'fontSize': '16px'
                            }
                          },
                          'variables': {
                            'text': {
                              'type': 'dynamic_text',
                              'data': {
                                'content': 'Get started'
                              }
                            }
                          }
                        }
                      ],
                      'attributes': {
                        'type': 'button'
                      },
                      'design': {
                        'typography': {
                          'isActive': true,
                          'color': '#ffffff',
                          'fontSize': '16px'
                        },
                        'spacing': {
                          'isActive': true,
                          'paddingLeft': '1.5rem',
                          'paddingRight': '1.5rem',
                          'paddingTop': '0.5rem',
                          'paddingBottom': '0.5rem'
                        },
                        'borders': {
                          'isActive': true,
                          'borderRadius': '0.5rem'
                        },
                        'backgrounds': {
                          'isActive': true,
                          'backgroundColor': '#2563eb'
                        }
                      },
                      'customName': 'Button'
                    },
                    {
                      'name': 'button',
                      'classes': 'flex flex-row items-center justify-center pr-[20px] pl-[20px] pt-[10px] pb-[10px] text-[16px] rounded-[12px] text-[#171717] bg-[#e5e5e5]',
                      'children': [
                        {
                          'name': 'span',
                          'classes': 'text-[16px]',
                          'restrictions': {
                            'editText': true
                          },
                          'children': [],
                          'design': {
                            'typography': {
                              'isActive': true,
                              'fontSize': '16px'
                            }
                          },
                          'variables': {
                            'text': {
                              'type': 'dynamic_text',
                              'data': {
                                'content': 'Learn more'
                              }
                            }
                          }
                        }
                      ],
                      'attributes': {
                        'type': 'button'
                      },
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
                      'customName': 'Button'
                    }
                  ],
                  'design': {
                    'layout': {
                      'isActive': true,
                      'display': 'Flex',
                      'gap': '8'
                    }
                  },
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
};
