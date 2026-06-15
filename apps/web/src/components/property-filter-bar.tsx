"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/button";
import { Search, SlidersHorizontal, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

interface PropertyFilterBarProps {
  totalCount: number;
  filteredCount: number;
  onSearchChange: (search: string) => void;
  onPropertyTypeChange: (types: string[]) => void;
  onStatusChange: (statuses: string[]) => void;
  onSortChange: (sort: string) => void;
  availablePropertyTypes: string[];
  availableStatuses: string[];
}

export function PropertyFilterBar({
  totalCount,
  filteredCount,
  onSearchChange,
  onPropertyTypeChange,
  onStatusChange,
  onSortChange,
  availablePropertyTypes,
  availableStatuses,
}: PropertyFilterBarProps) {
  const [searchValue, setSearchValue] = useState("");
  const [selectedPropertyTypes, setSelectedPropertyTypes] = useState<string[]>(
    []
  );
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("name-asc");
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    const debounce = setTimeout(() => {
      onSearchChange(searchValue);
    }, 300);
    return () => clearTimeout(debounce);
  }, [searchValue, onSearchChange]);

  const handlePropertyTypeToggle = (type: string) => {
    const newTypes = selectedPropertyTypes.includes(type)
      ? selectedPropertyTypes.filter((t) => t !== type)
      : [...selectedPropertyTypes, type];
    setSelectedPropertyTypes(newTypes);
    onPropertyTypeChange(newTypes);
  };

  const handleStatusToggle = (status: string) => {
    const newStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter((s) => s !== status)
      : [...selectedStatuses, status];
    setSelectedStatuses(newStatuses);
    onStatusChange(newStatuses);
  };

  const handleClearPropertyTypes = () => {
    setSelectedPropertyTypes([]);
    onPropertyTypeChange([]);
  };

  const handleClearStatuses = () => {
    setSelectedStatuses([]);
    onStatusChange([]);
  };

  const handleClearAll = () => {
    setSelectedPropertyTypes([]);
    setSelectedStatuses([]);
    onPropertyTypeChange([]);
    onStatusChange([]);
  };

  const handleApplyFilters = () => {
    setIsFilterOpen(false);
  };

  const handleRemoveFilter = (
    type: "propertyType" | "status",
    value: string
  ) => {
    if (type === "propertyType") {
      const newTypes = selectedPropertyTypes.filter((t) => t !== value);
      setSelectedPropertyTypes(newTypes);
      onPropertyTypeChange(newTypes);
    } else {
      const newStatuses = selectedStatuses.filter((s) => s !== value);
      setSelectedStatuses(newStatuses);
      onStatusChange(newStatuses);
    }
  };

  const handleSortChange = (value: string) => {
    setSortBy(value);
    onSortChange(value);
  };

  const activeFiltersCount =
    selectedPropertyTypes.length + selectedStatuses.length;

  return (
    <div className="space-y-4">
      {/* Search and Filter Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search properties..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filters Button */}
        <DropdownMenu open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="relative">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 rounded-full h-5 w-5 p-0 flex items-center justify-center text-xs"
                >
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80 p-0">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Filters</h3>
              </div>

              {/* Property Type Filter */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="font-medium">Property Type</Label>
                  {selectedPropertyTypes.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearPropertyTypes}
                      className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {availablePropertyTypes.map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <Checkbox
                        id={`type-${type}`}
                        checked={selectedPropertyTypes.includes(type)}
                        onCheckedChange={() => handlePropertyTypeToggle(type)}
                      />
                      <Label
                        htmlFor={`type-${type}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {type}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="my-4" />

              {/* Status Filter */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-3">
                  <Label className="font-medium">Status</Label>
                  {selectedStatuses.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearStatuses}
                      className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  {availableStatuses.map((status) => (
                    <div key={status} className="flex items-center space-x-2">
                      <Checkbox
                        id={`status-${status}`}
                        checked={selectedStatuses.includes(status)}
                        onCheckedChange={() => handleStatusToggle(status)}
                      />
                      <Label
                        htmlFor={`status-${status}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {status}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="my-4" />

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearAll}
                  className="flex-1"
                  disabled={activeFiltersCount === 0}
                >
                  Clear all
                </Button>
                <Button
                  size="sm"
                  onClick={handleApplyFilters}
                  className="flex-1"
                >
                  Apply
                </Button>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort Dropdown */}
        <Select value={sortBy} onValueChange={handleSortChange}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">Name (A-Z)</SelectItem>
            <SelectItem value="name-desc">Name (Z-A)</SelectItem>
            <SelectItem value="rent-asc">Rent (Low to High)</SelectItem>
            <SelectItem value="rent-desc">Rent (High to Low)</SelectItem>
            <SelectItem value="status-occupied">Occupied First</SelectItem>
            <SelectItem value="status-vacant">Vacant First</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Active Filters Tags */}
      {(selectedPropertyTypes.length > 0 || selectedStatuses.length > 0) && (
        <div className="flex flex-wrap items-center gap-2">
          {selectedPropertyTypes.map((type) => (
            <Badge
              key={type}
              variant="secondary"
              className="pl-2.5 pr-1 py-1 gap-1"
            >
              {type}
              <button
                onClick={() => handleRemoveFilter("propertyType", type)}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {selectedStatuses.map((status) => (
            <Badge
              key={status}
              variant="secondary"
              className="pl-2.5 pr-1 py-1 gap-1"
            >
              {status}
              <button
                onClick={() => handleRemoveFilter("status", status)}
                className="ml-1 hover:bg-secondary-foreground/20 rounded-sm"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredCount} of {totalCount} properties
      </div>
    </div>
  );
}
