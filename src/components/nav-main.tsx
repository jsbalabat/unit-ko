"use client";

import { useState } from "react";
import { IconCirclePlusFilled, IconMail, type Icon } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { MultiStepPopup } from "@/components/form-add-property";
import { toast } from "sonner";

export function NavMain({}: // items,
{
  items: {
    title: string;
    url: string;
    icon?: Icon;
  }[];
}) {
  const [isAddPopupOpen, setIsAddPopupOpen] = useState(false);

  const handlePropertyComplete = () => {
    toast.success("Property added successfully");
    // Optionally trigger a refresh or navigation here
  };

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent className="flex flex-col gap-2">
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center gap-2">
              <SidebarMenuButton
                tooltip="Quick Create"
                onClick={() => setIsAddPopupOpen(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary/90 active:text-primary-foreground min-w-8 duration-200 ease-linear cursor-pointer"
              >
                <IconCirclePlusFilled />
                <span>Create</span>
              </SidebarMenuButton>
              <Button
                size="icon"
                className="size-8 group-data-[collapsible=icon]:opacity-0"
                variant="outline"
              >
                <IconMail />
                <span className="sr-only">Inbox</span>
              </Button>
            </SidebarMenuItem>
          </SidebarMenu>
          {/* <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton tooltip={item.title}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu> */}
        </SidebarGroupContent>
      </SidebarGroup>

      <MultiStepPopup
        isOpen={isAddPopupOpen}
        onClose={() => setIsAddPopupOpen(false)}
        onComplete={handlePropertyComplete}
      />
    </>
  );
}
