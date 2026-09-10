"use client"

import { useState } from "react"
import { useFormContext, Controller } from "react-hook-form"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

type OptionType = { [key: string]: string }

interface CustomSelectProps<T extends OptionType> {
  /** For react-hook-form integration (optional) */
  name?: string
  /** Data array of options */
  data: T[]
  /** Controlled value when used outside a form */
  value?: string
  /** Controlled onChange when used outside a form */
  onChange?: (val: string) => void
  /** Key to display labels from data */
  labelKey?: keyof T
  /** Key to use as value from data */
  valueKey?: keyof T
  /** Placeholder text */
  placeholder?: string
  /** CSS classes for the width and styling */
  className?: string
}

/**
 * CustomSelect: Works inside and outside react-hook-form.
 */
export default function CustomSelect<T extends OptionType>({
  name,
  data,
  value,
  onChange,
  labelKey = "label",
  valueKey = "value",
  placeholder = "Select an option",
  className = "w-[300px]",
}: CustomSelectProps<T>) {
  const form = useFormContext()
  const insideForm = !!(form && name)
  const [open, setOpen] = useState(false)

  const renderSelect = (selectedValue: string, onValueChange: (val: string) => void) => {
    const selectedLabel =
      data.find((item) => item[valueKey] === selectedValue)?.[labelKey] ?? placeholder

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("justify-between", className)}
          >
            {selectedLabel}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className={cn("p-0", className)}>
          <Command className="max-h-60 overflow-y-auto">
            <CommandInput placeholder="Search..." />
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup className="overflow-auto">
              {data.map((item) => (
                <CommandItem
                  key={item[valueKey]}
                  value={item[valueKey]}
                  onSelect={(val) => {
                    onValueChange(val)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      selectedValue === item[valueKey] ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {item[labelKey]}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  if (insideForm && name) {
    return (
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => renderSelect(field.value, field.onChange)}
      />
    )
  }

  return renderSelect(value ?? "", onChange ?? (() => {}))
}
