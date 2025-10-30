'use client';

import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';

export default function PositionControls() {
  const [positionType, setPositionType] = useState<'static' | 'fixed' | 'absolute' | 'relative' | 'sticky'>('static');
  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Position</Label>
      </header>

      <div className="flex flex-col gap-2">

        <div className="grid grid-cols-3">
          <Label variant="muted">Type</Label>
          <div className="col-span-2 *:w-full">
            <Select value={positionType} onValueChange={(v) => setPositionType(v as typeof positionType)}>
              <SelectTrigger>
                <SelectValue placeholder="Static" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="static">Static</SelectItem>
                  <SelectItem value="fixed">Fixed</SelectItem>
                  <SelectItem value="absolute">Absolute</SelectItem>
                  <SelectItem value="relative">Relative</SelectItem>
                  <SelectItem value="sticky">Sticky</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        {(positionType === 'fixed' || positionType === 'absolute' || positionType === 'sticky') && (
          <div className="grid grid-cols-3 items-start">
            <Label variant="muted" className="h-8">Placement</Label>
            <div className="col-span-2 grid grid-cols-2 gap-2">
              <InputGroup>
                <InputGroupAddon>
                  <div className="flex">
                    <Tooltip>
                      <TooltipTrigger>
                        <Icon name="paddingSide" className="size-3" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Left</p>
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
                        <Icon name="paddingSide" className="size-3 rotate-90" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Top</p>
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
                        <Icon name="paddingSide" className="size-3 rotate-180" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Right</p>
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
                        <Icon name="paddingSide" className="size-3 rotate-270" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Bottom</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </InputGroupAddon>
                <InputGroupInput className="!pr-0" />
              </InputGroup>
            </div>
          </div>
        )}

        {positionType !== 'static' && (
          <div className="grid grid-cols-3">
            <Label variant="muted">Z Index</Label>
            <div className="col-span-2 grid grid-cols-2 items-center gap-2">
              <Input />
              <Slider
                className="flex-1"
              />
            </div>
          </div>
        )}

      </div>

    </div>
  );
}


