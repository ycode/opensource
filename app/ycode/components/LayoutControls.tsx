'use client';

import { useState } from 'react';
import { Label } from '@/components/ui/label';
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";
import Icon from "@/components/ui/icon";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {InputGroup, InputGroupAddon, InputGroupInput} from "@/components/ui/input-group";

export default function LayoutControls() {
  const [gapMode, setGapMode] = useState<'all-borders' | 'individual-borders'>('all-borders');
  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Layout</Label>
      </header>

      <div className="flex flex-col gap-2">

          <div className="grid grid-cols-3">
              <Label variant="muted">Type</Label>
              <div className="col-span-2">
                  <Tabs defaultValue="columns" className="w-full">
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

          <div className="grid grid-cols-3">
              <Label variant="muted">Align</Label>
              <div className="col-span-2">
                  <Tabs defaultValue="start" className="w-full">
                      <TabsList className="w-full">
                          <TabsTrigger value="start">
                              <Icon name="alignStart"/>
                          </TabsTrigger>
                          <TabsTrigger value="center">
                              <Icon name="alignCenter"/>
                          </TabsTrigger>
                          <TabsTrigger value="end">
                              <Icon name="alignEnd"/>
                          </TabsTrigger>
                          <TabsTrigger value="stretch">
                              <Icon name="alignStretch"/>
                          </TabsTrigger>
                      </TabsList>
                  </Tabs>
              </div>
          </div>

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
                               <Icon name="horizontalGap" className="size-3"/>
                           </InputGroupAddon>
                           <InputGroupInput className="!pr-0"/>
                       </InputGroup>
                       <InputGroup>
                           <InputGroupAddon>
                               <Icon name="verticalGap" className="size-3"/>
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

