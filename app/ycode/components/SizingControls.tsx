'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Button } from '@/components/ui/button';
import { ButtonGroup, ButtonGroupSeparator } from '@/components/ui/button-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import Icon from '@/components/ui/icon';
import SettingsPanel from '@/app/ycode/components/SettingsPanel';

export default function SizingControls() {
  const [widthUnit, setWidthUnit] = useState<'px' | '%' | 'auto'>('px');
  const [heightUnit, setHeightUnit] = useState<'px' | '%' | 'auto'>('px');
  const [isOpen, setIsOpen] = useState(true);

  return (
    <SettingsPanel
      title="Sizing" isOpen={isOpen}
      onToggle={() => setIsOpen(!isOpen)}
    >
        <div className="grid grid-cols-3 items-start">
          <Label variant="muted" className="h-8">Width</Label>
          <div className="col-span-2 flex flex-col gap-2">
            <ButtonGroup>
              <Input />
              <ButtonGroupSeparator />
              <Select>
                <SelectTrigger />
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="w-[100%]">Fill</SelectItem>
                    <SelectItem value="w-fit-content">Fit</SelectItem>
                    <SelectItem value="w-[100vw]">Screen</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </ButtonGroup>
            <div className="grid grid-cols-2 gap-2">
              <div className="w-full group relative">
                <ButtonGroup className="w-full">
                  <InputGroup>
                    <InputGroupAddon>
                      <div className="flex">
                        <Tooltip>
                          <TooltipTrigger>
                            <Icon name="minSize" className="size-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Min width</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </InputGroupAddon>
                    <InputGroupInput placeholder="Min" />
                  </InputGroup>
                </ButtonGroup>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-100">
                  <Select>
                    <SelectTrigger size="xs" variant="ghost" />
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="w-[100%]">Fill</SelectItem>
                        <SelectItem value="w-fit-content">Fit</SelectItem>
                        <SelectItem value="w-[100vw]">Screen</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="w-full group relative">
                <ButtonGroup className="w-full">
                  <InputGroup>
                    <InputGroupAddon>
                      <div className="flex">
                        <Tooltip>
                          <TooltipTrigger>
                            <Icon name="maxSize" className="size-3" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Max width</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </InputGroupAddon>
                    <InputGroupInput placeholder="Max" />
                  </InputGroup>
                </ButtonGroup>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-100">
                  <Select>
                    <SelectTrigger size="xs" variant="ghost" />
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="w-[100%]">Fill</SelectItem>
                        <SelectItem value="w-fit-content">Fit</SelectItem>
                        <SelectItem value="w-[100vw]">Screen</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 items-start">
          <Label variant="muted" className="h-8">Height</Label>
          <div className="col-span-2 flex flex-col gap-2">
            <ButtonGroup>
              <Input />
              <ButtonGroupSeparator />
              <Select>
                <SelectTrigger />
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="h-[100%]">Fill</SelectItem>
                    <SelectItem value="h-[100svh]">Screen</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </ButtonGroup>
            <div className="grid grid-cols-2 gap-2">
              <div className="w-full group relative">
                <ButtonGroup className="w-full">
                  <InputGroup>
                    <InputGroupAddon>
                      <div className="flex">
                        <Tooltip>
                          <TooltipTrigger>
                            <Icon name="minSize" className="size-3 rotate-90" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Min height</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </InputGroupAddon>
                    <InputGroupInput placeholder="Min" />
                  </InputGroup>
                </ButtonGroup>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-100">
                  <Select>
                    <SelectTrigger size="xs" variant="ghost" />
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="w-[100%]">Fill</SelectItem>
                        <SelectItem value="w-fit-content">Fit</SelectItem>
                        <SelectItem value="w-[100vw]">Screen</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="w-full group relative">
                <ButtonGroup className="w-full">
                  <InputGroup>
                    <InputGroupAddon>
                      <div className="flex">
                        <Tooltip>
                          <TooltipTrigger>
                            <Icon name="maxSize" className="size-3 rotate-90" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Max height</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </InputGroupAddon>
                    <InputGroupInput placeholder="Max" />
                  </InputGroup>
                </ButtonGroup>
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 z-100">
                  <Select>
                    <SelectTrigger size="xs" variant="ghost" />
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="w-[100%]">Fill</SelectItem>
                        <SelectItem value="w-fit-content">Fit</SelectItem>
                        <SelectItem value="w-[100vw]">Screen</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">Overflow</Label>
          <div className="col-span-2 *:w-full">
            <Select>
              <SelectTrigger>
                Visible
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="1">Visible</SelectItem>
                  <SelectItem value="2">Hidden</SelectItem>
                  <SelectItem value="3">Scroll</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3 items-start">
          <Label variant="muted" className="h-8">Aspect ratio</Label>
          <div className="col-span-2 flex flex-col gap-2">
            <ButtonGroup>
              <Input />
              <ButtonGroupSeparator />
              <Select>
                <SelectTrigger />
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="1">Video</SelectItem>
                    <SelectItem value="2">Square</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </ButtonGroup>
          </div>
        </div>
    </SettingsPanel>
  );
}

