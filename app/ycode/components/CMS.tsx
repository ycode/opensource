/**
 * CMS Component
 * 
 * Content Management System interface for managing site content
 */

import React, { useState } from 'react';
import {Input} from "@/components/ui/input";
import Icon from "@/components/ui/icon";
import {Button} from "@/components/ui/button";

export default function CMS() {
  const [activeSection, setActiveSection] = useState<'content' | 'media' | 'settings'>('content');

  return (
    <div className="flex-1 dark:bg-neutral-950 flex flex-col">

        <div className="p-4 flex">

            <div className="w-full max-w-72">
                <Input placeholder="Search..."/>
            </div>

        </div>

        <hr/>

        <div>

            <div className="grid grid-flow-col border-b">
                <div className="px-4 py-5">
                    <span>Name</span>
                </div>
                <div className="px-4 py-5">
                    <span>Slug</span>
                </div>
            </div>

            <div className="group">
                <div className="grid grid-flow-col text-primary/60 group-hover:bg-white/5">
                    <div className="px-4 py-5">
                        <span>My first blog post</span>
                    </div>
                    <div className="px-4 py-5">
                        <span>my-first-blog-post</span>
                    </div>
                </div>
                <hr className="ml-4"/>
            </div>

            <div className="group">
                <div className="grid grid-flow-col text-primary/60 group-hover:bg-white/5">
                    <div className="px-4 py-5">
                        <Button size="xs" variant="ghost">
                            <Icon name="plus"/>
                        </Button>
                    </div>
                </div>
            </div>

        </div>

    </div>
  );
}
