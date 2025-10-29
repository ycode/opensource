'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from '@/components/ui/select';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export default function TypographyControls() {
  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Typography</Label>
      </header>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3">
          <Label variant="muted">Font</Label>
          <div className="col-span-2 *:w-full">
            <Select>
              <SelectTrigger>
                Inherits
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="inherits">Inherits</SelectItem>
                  <SelectItem value="Inter">Inter</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">Weight</Label>
          <div className="col-span-2 *:w-full">
            <Select>
              <SelectTrigger>
                Regular
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="100">Thin</SelectItem>
                  <SelectItem value="200">Extralight</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">Size</Label>
          <div className="col-span-2 *:w-full">
            <InputGroup>
              <InputGroupInput />
              <InputGroupAddon align="inline-end">
                <Select>
                  <SelectTrigger size="xs" variant="ghost">
                    Px
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="px">Px</SelectItem>
                      <SelectItem value="rem">Rem</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </InputGroupAddon>
            </InputGroup>
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">Align</Label>
          <div className="col-span-2">
            <Tabs defaultValue="left" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="left" className="px-2 text-xs">
                  <Icon name="textAlignLeft" />
                </TabsTrigger>
                <TabsTrigger value="center" className="px-2 text-xs">
                  <Icon name="textAlignCenter" />
                </TabsTrigger>
                <TabsTrigger value="right" className="px-2 text-xs">
                  <Icon name="textAlignRight" />
                </TabsTrigger>
                <TabsTrigger value="justify" className="px-2 text-xs">
                  <Icon name="textAlignJustify" />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="grid grid-cols-3">
          <Label variant="muted">Spacing</Label>
          <div className="col-span-2 grid grid-cols-2 gap-2">
            <InputGroup>
              <InputGroupAddon>
                <div className="flex">
                  <Tooltip>
                    <TooltipTrigger>
                      <Icon name="letterSpacing" className="size-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Letter spacing</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </InputGroupAddon>
              <InputGroupInput className="!pr-0" />
            </InputGroup>
            <InputGroup>
              <InputGroupAddon>
                <div className="flex">
                  <Tooltip>
                    <TooltipTrigger>
                      <Icon name="lineHeight" className="size-3" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Line height</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </InputGroupAddon>
              <InputGroupInput className="!pr-0" />
            </InputGroup>
          </div>
        </div>
      </div>
    </div>
  );
}

