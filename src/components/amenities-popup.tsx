"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Wifi,
  Tv,
  Snowflake,
  // Wind,
  // Droplets,
  Car,
  Warehouse,
  Fence,
  Home,
  // Bed,
  // Bath,
  UtensilsCrossed,
  Refrigerator,
  Microwave,
  WashingMachine,
  Shirt,
  Dumbbell,
  Waves,
  Flame,
  Shield,
  Camera,
  DoorOpen,
  Heater,
  Fan,
  Armchair,
  Volume2,
  Laptop,
  TreePine,
  Sun,
} from "lucide-react";

interface Amenity {
  id: string;
  name: string;
  icon: React.ReactNode;
  category: "essentials" | "facilities" | "comfort" | "security";
}

const AVAILABLE_AMENITIES: Amenity[] = [
  // Essentials
  {
    id: "wifi",
    name: "WiFi",
    icon: <Wifi className="h-4 w-4" />,
    category: "essentials",
  },
  {
    id: "tv",
    name: "TV",
    icon: <Tv className="h-4 w-4" />,
    category: "essentials",
  },
  {
    id: "ac",
    name: "Air conditioning",
    icon: <Snowflake className="h-4 w-4" />,
    category: "essentials",
  },
  {
    id: "heating",
    name: "Heating",
    icon: <Heater className="h-4 w-4" />,
    category: "essentials",
  },
  {
    id: "kitchen",
    name: "Kitchen",
    icon: <UtensilsCrossed className="h-4 w-4" />,
    category: "essentials",
  },
  {
    id: "refrigerator",
    name: "Refrigerator",
    icon: <Refrigerator className="h-4 w-4" />,
    category: "essentials",
  },
  {
    id: "microwave",
    name: "Microwave",
    icon: <Microwave className="h-4 w-4" />,
    category: "essentials",
  },

  // Facilities
  {
    id: "parking",
    name: "Free parking",
    icon: <Car className="h-4 w-4" />,
    category: "facilities",
  },
  {
    id: "washer",
    name: "Washer",
    icon: <WashingMachine className="h-4 w-4" />,
    category: "facilities",
  },
  {
    id: "dryer",
    name: "Dryer",
    icon: <Shirt className="h-4 w-4" />,
    category: "facilities",
  },
  {
    id: "gym",
    name: "Gym",
    icon: <Dumbbell className="h-4 w-4" />,
    category: "facilities",
  },
  {
    id: "pool",
    name: "Pool",
    icon: <Waves className="h-4 w-4" />,
    category: "facilities",
  },
  {
    id: "elevator",
    name: "Elevator",
    icon: <DoorOpen className="h-4 w-4" />,
    category: "facilities",
  },
  {
    id: "storage",
    name: "Storage space",
    icon: <Warehouse className="h-4 w-4" />,
    category: "facilities",
  },

  // Comfort
  {
    id: "workspace",
    name: "Dedicated workspace",
    icon: <Laptop className="h-4 w-4" />,
    category: "comfort",
  },
  {
    id: "furnished",
    name: "Furnished",
    icon: <Armchair className="h-4 w-4" />,
    category: "comfort",
  },
  {
    id: "balcony",
    name: "Balcony",
    icon: <Home className="h-4 w-4" />,
    category: "comfort",
  },
  {
    id: "garden",
    name: "Garden",
    icon: <TreePine className="h-4 w-4" />,
    category: "comfort",
  },
  {
    id: "patio",
    name: "Patio",
    icon: <Sun className="h-4 w-4" />,
    category: "comfort",
  },
  {
    id: "fan",
    name: "Ceiling fan",
    icon: <Fan className="h-4 w-4" />,
    category: "comfort",
  },
  {
    id: "soundsystem",
    name: "Sound system",
    icon: <Volume2 className="h-4 w-4" />,
    category: "comfort",
  },

  // Security & Safety
  {
    id: "security",
    name: "Security cameras",
    icon: <Camera className="h-4 w-4" />,
    category: "security",
  },
  {
    id: "smoke",
    name: "Smoke alarm",
    icon: <Shield className="h-4 w-4" />,
    category: "security",
  },
  {
    id: "fire",
    name: "Fire extinguisher",
    icon: <Flame className="h-4 w-4" />,
    category: "security",
  },
  {
    id: "gate",
    name: "Gated community",
    icon: <Fence className="h-4 w-4" />,
    category: "security",
  },
];

interface AmenitiesPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (selectedAmenities: string[]) => void;
  currentAmenities: string[];
}

export function AmenitiesPopup({
  isOpen,
  onClose,
  onSave,
  currentAmenities,
}: AmenitiesPopupProps) {
  const [selectedAmenities, setSelectedAmenities] =
    useState<string[]>(currentAmenities);

  useEffect(() => {
    setSelectedAmenities(currentAmenities);
  }, [currentAmenities, isOpen]);

  const handleToggleAmenity = (amenityId: string) => {
    setSelectedAmenities((prev) =>
      prev.includes(amenityId)
        ? prev.filter((id) => id !== amenityId)
        : [...prev, amenityId]
    );
  };

  const handleSave = () => {
    onSave(selectedAmenities);
    onClose();
  };

  const handleCancel = () => {
    setSelectedAmenities(currentAmenities);
    onClose();
  };

  const getCategoryTitle = (category: string) => {
    switch (category) {
      case "essentials":
        return "Essentials";
      case "facilities":
        return "Facilities";
      case "comfort":
        return "Comfort";
      case "security":
        return "Security & Safety";
      default:
        return category;
    }
  };

  const categories = [
    "essentials",
    "facilities",
    "comfort",
    "security",
  ] as const;

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Property Amenities</DialogTitle>
          <DialogDescription>
            Select all amenities available in this property
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 px-6 overflow-y-auto">
          <div className="space-y-6 pb-4">
            {categories.map((category) => {
              const categoryAmenities = AVAILABLE_AMENITIES.filter(
                (a) => a.category === category
              );

              return (
                <div key={category}>
                  <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                    {getCategoryTitle(category)}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {categoryAmenities.map((amenity) => (
                      <div
                        key={amenity.id}
                        className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => handleToggleAmenity(amenity.id)}
                      >
                        <Checkbox
                          id={amenity.id}
                          checked={selectedAmenities.includes(amenity.id)}
                          onCheckedChange={() =>
                            handleToggleAmenity(amenity.id)
                          }
                          className="cursor-pointer"
                        />
                        <Label
                          htmlFor={amenity.id}
                          className="flex items-center gap-2 cursor-pointer flex-1"
                        >
                          <span className="text-muted-foreground">
                            {amenity.icon}
                          </span>
                          <span className="text-sm">{amenity.name}</span>
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0 px-6 py-4 border-t bg-background">
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-muted-foreground">
              {selectedAmenities.length} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { AVAILABLE_AMENITIES };
