'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import Icon from '@/components/ui/icon';
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger} from "@/components/ui/select";

export default function BorderControls() {
  const [radiusBorderMode, setRadiusBorderMode] = useState<'all-borders' | 'individual-borders'>('all-borders');
  const [widthBorderMode, setWidthBorderMode] = useState<'all-borders' | 'individual-borders'>('all-borders');

  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Borders</Label>
      </header>

      <div className="flex flex-col gap-2">

        <div className="grid grid-cols-3 items-start">
          <Label variant="muted" className="h-8">Radius</Label>
          <div className="col-span-2 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <Input/>
              <Tabs value={radiusBorderMode} onValueChange={(value) => setRadiusBorderMode(value as 'all-borders' | 'individual-borders')} className="w-full">
                <TabsList className="w-full">
                  <TabsTrigger value="all-borders">
                    <Icon name="borders"/>
                  </TabsTrigger>
                  <TabsTrigger value="individual-borders">
                    <Icon name="individualBorders"/>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            {radiusBorderMode === 'individual-borders' && (
              <div className="grid grid-cols-2 gap-2">
                <InputGroup>
                  <InputGroupAddon>
                    <Icon name="borderTopLeft" className="size-3"/>
                  </InputGroupAddon>
                  <InputGroupInput className="!pr-0"/>
                </InputGroup>
                <InputGroup>
                  <InputGroupAddon>
                    <Icon name="borderTopLeft" className="size-3 rotate-90"/>
                  </InputGroupAddon>
                  <InputGroupInput className="!pr-0"/>
                </InputGroup>
                <InputGroup>
                  <InputGroupAddon>
                    <Icon name="borderTopLeft" className="size-3 rotate-270"/>
                  </InputGroupAddon>
                  <InputGroupInput className="!pr-0"/>
                </InputGroup>
                <InputGroup>
                  <InputGroupAddon>
                    <Icon name="borderTopLeft" className="size-3 rotate-180"/>
                  </InputGroupAddon>
                  <InputGroupInput className="!pr-0"/>
                </InputGroup>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 items-start">
          <Label variant="muted" className="h-8">Border</Label>
          <div className="col-span-2">
            <Popover>
              <PopoverTrigger asChild>

                {/*TODO: When not added ⬇️*/}

                <Button size="sm" variant="secondary" className="w-full">
                  <Icon name="plus"/>
                  Add
                </Button>

                {/*TODO: When added ⬇️*/}

                {/*<InputGroup>*/}
                {/*  <div className="w-full flex items-center justify-between gap-1 px-2.5">*/}
                {/*    <Label variant="muted">Solid</Label>*/}
                {/*    <Button size="xs" className="-mr-1.5" variant="ghost">*/}
                {/*      <Icon name="x"/>*/}
                {/*    </Button>*/}
                {/*  </div>*/}
                {/*</InputGroup>*/}
              </PopoverTrigger>

              <PopoverContent className="w-[255px] mr-4">

                <div className="flex flex-col gap-2">

                  <div className="grid grid-cols-3 items-start">
                    <Label variant="muted" className="h-8">Width</Label>
                    <div className="col-span-2 flex flex-col gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input/>
                        <Tabs value={widthBorderMode} onValueChange={(value) => setWidthBorderMode(value as 'all-borders' | 'individual-borders')} className="w-full">
                          <TabsList className="w-full">
                            <TabsTrigger value="all-borders">
                              <Icon name="borders"/>
                            </TabsTrigger>
                            <TabsTrigger value="individual-borders">
                              <Icon name="borderWidth"/>
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      </div>
                      {widthBorderMode === 'individual-borders' && (
                          <div className="grid grid-cols-4 gap-2">
                            <div className="flex flex-col items-center gap-1">
                              <Input />
                              <Label className="!text-[8px]" variant="muted">Top</Label>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <Input />
                              <Label className="!text-[8px]" variant="muted">Right</Label>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <Input />
                              <Label className="!text-[8px]" variant="muted">Bottom</Label>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <Input />
                              <Label className="!text-[8px]" variant="muted">Left</Label>
                            </div>
                          </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3">
                    <Label variant="muted">Style</Label>
                    <div className="col-span-2 *:w-full">
                      <Select>
                        <SelectTrigger>
                          Solid
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value="solid">Solid</SelectItem>
                            <SelectItem value="dashed">Dashed</SelectItem>
                            <SelectItem value="dotted">Dotted</SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                </div>

              </PopoverContent>
            </Popover>
          </div>
        </div>

      </div>

    </div>
  );
}

