'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import Icon from '@/components/ui/icon';

export default function BorderControls() {
  const [borderMode, setBorderMode] = useState<'all-borders' | 'individual-borders'>('all-borders');

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
              <Input placeholder="All"/>
              <Tabs value={borderMode} onValueChange={(value) => setBorderMode(value as 'all-borders' | 'individual-borders')} className="w-full">
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
            {borderMode === 'individual-borders' && (
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
      </div>
    </div>
  );
}

