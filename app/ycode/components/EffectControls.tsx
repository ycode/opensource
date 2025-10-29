'use client';

import { Label } from '@/components/ui/label';
import {Input} from "@/components/ui/input";
import {Tabs, TabsList, TabsTrigger} from "@/components/ui/tabs";
import Icon from "@/components/ui/icon";
import {InputGroup, InputGroupAddon, InputGroupInput} from "@/components/ui/input-group";
import {Select, SelectContent, SelectGroup, SelectItem, SelectTrigger} from "@/components/ui/select";
import {Slider} from "@/components/ui/slider";

export default function EffectControls() {
  return (
    <div className="py-5">
      <header className="py-4 -mt-4">
        <Label>Effects</Label>
      </header>

      <div className="flex flex-col gap-2">

          <div className="grid grid-cols-3">
              <Label variant="muted">Opacity</Label>
              <div className="col-span-2 grid grid-cols-2 items-center gap-2">
                  <InputGroup>
                      <InputGroupInput className="!pr-0"/>
                      <InputGroupAddon align="inline-end">
                          <Label variant="muted" className="text-xs">%</Label>
                      </InputGroupAddon>
                  </InputGroup>
                  <Slider
                      className="flex-1"
                  />
              </div>
          </div>

      </div>
    </div>
  );
}

