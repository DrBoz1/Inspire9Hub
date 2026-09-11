"use client";

import { CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, Map as MapIcon, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { addDays, formatDateLong, formatDateShort, fromDateKey, relativeDay, toDateKey, todayKey } from "../booking/time";

export type ViewMode = "map" | "schedule";

interface Props {
  date: string;
  onDateChange: (d: string) => void;
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  /** Hidden in compact mode, where the list is a drawer with its own button. */
  showSidebarToggle: boolean;
}

/**
 * Chrome for the map — deliberately rendered OUTSIDE .fp-root.
 *
 * Inside that wrapper --color-border and --font-sans are the drawing's, so shadcn
 * controls would pick up the map's borders and Inter instead of the hub's Poppins.
 * Keeping this bar outside means it reads as part of the dashboard, which is what
 * it is, while the drawing keeps its own visual language.
 *
 * The standalone app also carried an i9 badge, an "Inspire9" wordmark and a member
 * chip here. All three are dropped: the dashboard sidebar and header already provide
 * that, and duplicating them was what made the embedded map feel like a second app
 * bolted onto the first.
 */
export function TopBar({ date, onDateChange, view, onViewChange, sidebarOpen, onToggleSidebar, showSidebarToggle }: Props) {
  const rel = relativeDay(date);
  const isToday = date === todayKey();

  return (
    // Its own provider: nesting inside the dashboard's is harmless, and it means
    // the map still renders if it is ever mounted outside that layout.
    <TooltipProvider delayDuration={300}>
    <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-slate-100 bg-white px-3 py-2 @xl:gap-x-4 @xl:px-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {showSidebarToggle && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="inline-flex h-8 w-8 shrink-0 rounded-lg"
              aria-label={sidebarOpen ? "Hide space list" : "Show space list"}
              aria-pressed={sidebarOpen}
              onClick={onToggleSidebar}
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{sidebarOpen ? "Hide space list" : "Show space list"}</TooltipContent>
        </Tooltip>
        )}

        {/* Which floor — genuine context, not branding */}
        <span className="hidden truncate text-[13px] font-medium text-slate-400 @4xl:block dark:text-slate-500">
          Level 1 · Cremorne
        </span>
      </div>

      {/* Date navigation */}
      <div className="flex shrink-0 items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              aria-label="Previous day"
              onClick={() => onDateChange(addDays(date, -1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Previous day</TooltipContent>
        </Tooltip>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-9 gap-2 rounded-lg px-3 font-semibold tabular-nums"
            >
              <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden whitespace-nowrap text-[13px] @xl:inline">
                {rel ? `${rel} · ` : ""}
                {formatDateLong(date)}
              </span>
              {/* Narrow maps get the short form -- "Today" or "Fri 11 Sep". */}
              <span className="whitespace-nowrap text-[13px] @xl:hidden">
                {rel ?? formatDateShort(date)}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="center">
            <Calendar
              mode="single"
              selected={fromDateKey(date)}
              defaultMonth={fromDateKey(date)}
              onSelect={(d) => d && onDateChange(toDateKey(d))}
              autoFocus
            />
          </PopoverContent>
        </Popover>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              aria-label="Next day"
              onClick={() => onDateChange(addDays(date, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Next day</TooltipContent>
        </Tooltip>

        {/* Reserves its slot when disabled so the bar doesn't jump on navigation */}
        <Button
          variant="ghost"
          disabled={isToday}
          onClick={() => onDateChange(todayKey())}
          className={`ml-1 hidden h-8 rounded-lg px-2.5 text-[12px] font-bold text-[#E31E24] hover:text-[#E31E24] @3xl:block ${
            isToday ? "invisible" : ""
          }`}
        >
          Today
        </Button>
      </div>

      {/* View switch */}
      <div className="flex min-w-fit flex-1 items-center justify-end">
        <Tabs value={view} onValueChange={(v) => onViewChange(v as ViewMode)}>
          <TabsList className="h-9 rounded-lg">
            <TabsTrigger value="map" className="gap-1.5 rounded-md px-3 text-[13px] font-semibold">
              <MapIcon className="h-3.5 w-3.5" />
              <span className="hidden @xl:inline">Map</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="gap-1.5 rounded-md px-3 text-[13px] font-semibold">
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden @xl:inline">Schedule</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
    </header>
    </TooltipProvider>
  );
}
