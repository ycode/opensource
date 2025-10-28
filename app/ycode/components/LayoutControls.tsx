'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";
import Icon from "@/components/ui/icon";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {InputGroup, InputGroupAddon, InputGroupInput} from "@/components/ui/input-group";
import {Tooltip, TooltipContent, TooltipTrigger} from "@/components/ui/tooltip";
import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger} from "@/components/ui/select";

export default function LayoutControls() {
  const [gapMode, setGapMode] = useState<'all-borders' | 'individual-borders'>('all-borders');
  const [paddingMode, setPaddingMode] = useState<'all-borders' | 'individual-borders'>('all-borders');
  const [layoutType, setLayoutType] = useState<'columns' | 'rows' | 'grid'>('columns');
  const [wrapMode, setWrapMode] = useState<'yes' | 'no'>('no');
  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Layout</Label>
      </header>

      <div className="flex flex-col gap-2">

          <div className="grid grid-cols-3">
              <Label variant="muted">Type</Label>
              <div className="col-span-2">
                  <Tabs value={layoutType} onValueChange={(value) => setLayoutType(value as 'columns' | 'rows' | 'grid')} className="w-full">
                      <TabsList className="w-full">
                          <TabsTrigger value="columns">
                              <Icon name="columns"/>
                          </TabsTrigger>
                          <TabsTrigger value="rows">
                              <Icon name="rows"/>
                          </TabsTrigger>
                          <TabsTrigger value="grid">
                              <Icon name="grid"/>
                          </TabsTrigger>
                      </TabsList>
                  </Tabs>
              </div>
          </div>

          {layoutType !== 'grid' && (
              <>
                  <div className="grid grid-cols-3">
                      <Label variant="muted">Align</Label>
                      <div className="col-span-2">
                          <Tabs defaultValue="start" className="w-full">
                              <TabsList className="w-full">
                                  <TabsTrigger value="start">
                                      <Icon name="alignStart" className={layoutType === 'rows' ? '-rotate-90' : ''}/>
                                  </TabsTrigger>
                                  <TabsTrigger value="center">
                                      <Icon name="alignCenter" className={layoutType === 'rows' ? '-rotate-90' : ''}/>
                                  </TabsTrigger>
                                  <TabsTrigger value="end">
                                      <Icon name="alignEnd" className={layoutType === 'rows' ? '-rotate-90' : ''}/>
                                  </TabsTrigger>
                                  <TabsTrigger value="stretch">
                                      <Icon name="alignStretch" className={layoutType === 'rows' ? '-rotate-90' : ''}/>
                                  </TabsTrigger>
                              </TabsList>
                          </Tabs>
                      </div>
                  </div>

                  <div className="grid grid-cols-3">
                      <Label variant="muted">Justify</Label>
                      <div className="col-span-2 *:w-full">
                          <Select>
                              <SelectTrigger>
                                  Start
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectGroup>
                                      <SelectItem value="start">Start</SelectItem>
                                      <SelectItem value="center">Center</SelectItem>
                                      <SelectItem value="end">End</SelectItem>
                                      <SelectItem value="between">Between</SelectItem>
                                      <SelectItem value="around">Around</SelectItem>
                                      <SelectItem value="evenly">Evenly</SelectItem>
                                  </SelectGroup>
                              </SelectContent>
                          </Select>
                      </div>
                  </div>
              </>
          )}

          {layoutType === 'grid' && (
              <div className="grid grid-cols-3">
                  <Label variant="muted">Grid</Label>
                  <div className="col-span-2 grid grid-cols-2 gap-2">
                      <InputGroup>
                          <InputGroupAddon>
                              <div className="flex">
                                  <Tooltip>
                                      <TooltipTrigger>
                                          <Icon name="columns" className="size-3"/>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                          <p>Columns</p>
                                      </TooltipContent>
                                  </Tooltip>
                              </div>
                          </InputGroupAddon>
                          <InputGroupInput className="!pr-0"/>
                      </InputGroup>
                      <InputGroup>
                          <InputGroupAddon>
                              <div className="flex">
                                  <Tooltip>
                                      <TooltipTrigger>
                                          <Icon name="columns" className="size-3 rotate-90"/>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                          <p>Rows</p>
                                      </TooltipContent>
                                  </Tooltip>
                              </div>
                          </InputGroupAddon>
                          <InputGroupInput className="!pr-0"/>
                      </InputGroup>
                  </div>
              </div>
          )}

          {layoutType === 'columns' && (
              <div className="grid grid-cols-3">
                  <Label variant="muted">Wrap</Label>
                  <div className="col-span-2">
                      <Tabs value={wrapMode} onValueChange={(value) => setWrapMode(value as 'yes' | 'no')} className="w-full">
                          <TabsList className="w-full">
                              <TabsTrigger value="yes">Yes</TabsTrigger>
                              <TabsTrigger value="no">No</TabsTrigger>
                          </TabsList>
                      </Tabs>
                  </div>
              </div>
          )}

          <div className="grid grid-cols-3 items-start">
              <Label variant="muted" className="h-8">Gap</Label>
              <div className="col-span-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                      <Input className="flex-1" disabled={gapMode === 'individual-borders'}/>
                      <Button
                          variant={gapMode === 'individual-borders' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setGapMode(gapMode === 'all-borders' ? 'individual-borders' : 'all-borders')}
                      >
                          <Icon name="link"/>
                      </Button>
                  </div>
                  {gapMode === 'individual-borders' && (
                       <div className="col-span-2 grid grid-cols-2 gap-2">
                       <InputGroup>
                           <InputGroupAddon>
                               <div className="flex">
                                   <Tooltip>
                                       <TooltipTrigger>
                                           <Icon name="horizontalGap" className="size-3"/>
                                       </TooltipTrigger>
                                       <TooltipContent>
                                           <p>Horizontal gap</p>
                                       </TooltipContent>
                                   </Tooltip>
                               </div>
                           </InputGroupAddon>
                           <InputGroupInput className="!pr-0"/>
                       </InputGroup>
                       <InputGroup>
                           <InputGroupAddon>
                               <div className="flex">
                                   <Tooltip>
                                       <TooltipTrigger>
                                           <Icon name="verticalGap" className="size-3"/>
                                       </TooltipTrigger>
                                       <TooltipContent>
                                           <p>Vertical gap</p>
                                       </TooltipContent>
                                   </Tooltip>
                               </div>
                           </InputGroupAddon>
                           <InputGroupInput className="!pr-0"/>
                       </InputGroup>
                   </div>
                  )}
              </div>
          </div>

          <div className="grid grid-cols-3 items-start">
              <Label variant="muted" className="h-8">Padding</Label>
              <div className="col-span-2 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                      <Input className="flex-1" disabled={paddingMode === 'individual-borders'}/>
                      <Button
                          variant={paddingMode === 'individual-borders' ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => setPaddingMode(paddingMode === 'all-borders' ? 'individual-borders' : 'all-borders')}
                      >
                          <Icon name="individualBorders"/>
                      </Button>
                  </div>
                  {paddingMode === 'individual-borders' && (
                      <div className="grid grid-cols-2 gap-2">


                          <InputGroup>
                              <InputGroupAddon>
                                  <div className="flex">
                                      <Tooltip>
                                          <TooltipTrigger>
                                              <Icon name="paddingSide" className="size-3"/>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                              <p>Left padding</p>
                                          </TooltipContent>
                                      </Tooltip>
                                  </div>
                              </InputGroupAddon>
                              <InputGroupInput className="!pr-0"/>
                          </InputGroup>
                          <InputGroup>
                              <InputGroupAddon>
                                  <div className="flex">
                                      <Tooltip>
                                          <TooltipTrigger>
                                              <Icon name="paddingSide" className="size-3 rotate-90"/>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                              <p>Top padding</p>
                                          </TooltipContent>
                                      </Tooltip>
                                  </div>
                              </InputGroupAddon>
                              <InputGroupInput className="!pr-0"/>
                          </InputGroup>
                          <InputGroup>
                              <InputGroupAddon>
                                  <div className="flex">
                                      <Tooltip>
                                          <TooltipTrigger>
                                              <Icon name="paddingSide" className="size-3 rotate-180"/>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                              <p>Right padding</p>
                                          </TooltipContent>
                                      </Tooltip>
                                  </div>
                              </InputGroupAddon>
                              <InputGroupInput className="!pr-0"/>
                          </InputGroup>
                          <InputGroup>
                              <InputGroupAddon>
                                  <div className="flex">
                                      <Tooltip>
                                          <TooltipTrigger>
                                              <Icon name="paddingSide" className="size-3 rotate-270"/>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                              <p>Bottom padding</p>
                                          </TooltipContent>
                                      </Tooltip>
                                  </div>
                              </InputGroupAddon>
                              <InputGroupInput className="!pr-0"/>
                          </InputGroup>
                      </div>
                  )}
              </div>
          </div>

      </div>
    </div>
  );
}

