import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { VariantProps, cva } from "class-variance-authority"
import { PanelLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/* v2 (2026-09-24): the sidebar now rests as the icon rail and slides out on hover,
   so the notes and Teach mode's board get the width. The old "sidebar:state"
   cookie is ignored, so everyone starts folded once; docking it open again with
   the fold button (or Ctrl+B) is saved here. */
const SIDEBAR_COOKIE_NAME = "sidebar:docked"
// A year: folding the sidebar is a preference, not a session setting.
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365
const SIDEBAR_WIDTH = "16rem"
const SIDEBAR_WIDTH_MOBILE = "18rem"
const SIDEBAR_WIDTH_ICON = "3rem"
const MOBILE_QUERY = "(max-width: 767.98px)"

/*
  The hover peek: resting the mouse on the folded icon rail slides the labels out
  OVER the page, and they fold away again a couple of seconds after the mouse
  leaves (at once on a click anywhere else on the page). It is calm on purpose —
  it waits for the pointer to REST (a pass-by on the way to the page never opens
  it), never opens while a button is held (a text-selection drag toward the edge),
  and since folding no longer moves any icon, nothing under the pointer changes
  when it opens: the labels simply appear to the right.
  Switch it off here and the rail relies on its tooltips instead.
*/
export const PEEK_ON_HOVER = true
const PEEK_DWELL_MS = 300
/** Long enough to reach back for a label after overshooting; a click elsewhere folds it at once. */
const PEEK_LEAVE_MS = 2000
/** How far the mouse may drift and still count as resting. */
const PEEK_REST_PX = 4

/** One motion for everything a fold moves: the panel, the gap and the content card.
 *  (An arbitrary property, because `ease-[...]` is claimed by both Tailwind and
 *  tailwindcss-animate, and Tailwind emits nothing for an ambiguous class.) */
const MOTION = "duration-200 [transition-timing-function:cubic-bezier(0.2,0.8,0.2,1)]"

/** The fold the student chose last time on this device, or null if they never chose. */
export function readSidebarCookie(): boolean | null {
  if (typeof document === "undefined") return null
  const m = document.cookie.match(/(?:^|;\s*)sidebar:docked=(true|false)(?:;|$)/)
  return m ? m[1] === "true" : null
}

/*
  Phone or not, decided on the FIRST render. The shared useIsMobile hook starts at
  `false` and corrects itself in an effect, which drew the desktop chevron for a
  frame on every phone. matchMedia is synchronous, so there is nothing to wait for.
*/
function subscribeMobile(onChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}
function useIsMobileNow() {
  return React.useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false
  )
}

/** A keydown the page's own text fields and editors should keep. */
function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return true
  return !!target.closest("[data-an-input]")
}

/*
  When did the student last press Tab? A tooltip that opens because its trigger got
  FOCUS is only wanted when they tabbed there. Radix also opens it when focus is
  handed back by a closing dialog or menu (Esc out of the search palette put
  "Search ⌘K" beside the rail with no pointer anywhere near), and those should
  stay quiet.
*/
let lastTabAt = -Infinity
const TAB_FOCUS_WINDOW_MS = 800

type PeekHandlers = {
  ref: (el: HTMLDivElement | null) => void
  onPointerEnter: (e: React.PointerEvent) => void
  onPointerMove: (e: React.PointerEvent) => void
  onPointerLeave: (e: React.PointerEvent) => void
  onPointerDownCapture: (e: React.PointerEvent) => void
  onKeyDownCapture: (e: React.KeyboardEvent) => void
}

type SidebarContext = {
  state: "expanded" | "collapsed"
  open: boolean
  /** `persist: false` for changes the student did not ask for (a tablet rotating). */
  setOpen: (open: boolean, opts?: { persist?: boolean }) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
  /** The folded rail is peeking out over the page (see PEEK_ON_HOVER). */
  peek: boolean
  /** Fold a peek away now, and forget any pending one (a nav click, Esc). */
  closePeek: () => void
  /** Collapse, whatever state it's in: expanded, peeking out on hover, or the phone sheet. */
  collapse: () => void
  peekHandlers: PeekHandlers
}

const SidebarContext = React.createContext<SidebarContext | null>(null)

function useSidebar() {
  const context = React.useContext(SidebarContext)
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.")
  }

  return context
}

const SidebarProvider = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    defaultOpen?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
  }
>(
  (
    {
      defaultOpen = true,
      open: openProp,
      onOpenChange: setOpenProp,
      className,
      style,
      children,
      ...props
    },
    ref
  ) => {
    const isMobile = useIsMobileNow()
    const [openMobile, setOpenMobile] = React.useState(false)

    /*
      The peek's state and timers live here rather than in <Sidebar>, so that EVERY
      way of folding or unfolding (the button, the edge strip, Ctrl+B, a tablet
      rotating) ends a peek and cancels a pending one. They used to live in the
      Sidebar and only `collapse()` cleared them, so a rail click inside the 140ms
      enter delay followed by Ctrl+B left a folded sidebar stuck out at full width.
    */
    const [peek, setPeek] = React.useState(false)
    const peekRoot = React.useRef<HTMLDivElement | null>(null)
    const dwellTimer = React.useRef<number>()
    const leaveTimer = React.useRef<number>()
    const restAt = React.useRef<{ x: number; y: number } | null>(null)
    // A click or key press on the rail means the student is using it, not looking:
    // no peek until the pointer has left and come back.
    const peekBlocked = React.useRef(false)

    const closePeek = React.useCallback(() => {
      window.clearTimeout(dwellTimer.current)
      window.clearTimeout(leaveTimer.current)
      restAt.current = null
      setPeek(false)
    }, [])
    React.useEffect(() => closePeek, [closePeek])

    // This is the internal state of the sidebar.
    // We use openProp and setOpenProp for control from outside the component.
    const [_open, _setOpen] = React.useState(defaultOpen)
    const open = openProp ?? _open
    const setOpen = React.useCallback(
      (value: boolean | ((value: boolean) => boolean), opts?: { persist?: boolean }) => {
        const openState = typeof value === "function" ? value(open) : value
        closePeek()
        if (setOpenProp) {
          setOpenProp(openState)
        } else {
          _setOpen(openState)
        }

        // This sets the cookie to keep the sidebar state (AppShell reads it back).
        if (opts?.persist !== false) {
          document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; samesite=lax`
        }
      },
      [setOpenProp, open, closePeek]
    )

    // Helper to toggle the sidebar.
    const toggleSidebar = React.useCallback(() => {
      return isMobile
        ? setOpenMobile((open) => !open)
        : setOpen((open) => !open)
    }, [isMobile, setOpen, setOpenMobile])

    const collapse = React.useCallback(() => {
      if (isMobile) return setOpenMobile(false)
      setOpen(false)
    }, [isMobile, setOpen, setOpenMobile])

    // While it lingers after the pointer left, a click on the page folds it at once:
    // the panel lies over the page, and the student has moved on to the page.
    React.useEffect(() => {
      if (!peek) return
      const onDown = (e: PointerEvent) => {
        const target = e.target as Element | null
        if (peekRoot.current?.contains(target)) return
        // Menus opened from the sidebar are portaled outside it.
        if (target?.closest?.("[data-radix-popper-content-wrapper], [role='menu'], [role='dialog']")) return
        closePeek()
      }
      document.addEventListener("pointerdown", onDown, true)
      return () => document.removeEventListener("pointerdown", onDown, true)
    }, [peek, closePeek])

    // Opened from outside (a controlled `open`), resized to a phone: no peek either way.
    React.useEffect(() => {
      if (open || isMobile) closePeek()
    }, [open, isMobile, closePeek])
    // Widened past phone size with the sheet open: shut it, or it pops back open
    // (and the menu button's first tap closes it) the next time the width drops.
    React.useEffect(() => {
      if (!isMobile) setOpenMobile(false)
    }, [isMobile])

    const peekHandlers = React.useMemo<PeekHandlers>(() => {
      const outOfBounds = (e: React.PointerEvent | React.KeyboardEvent) =>
        // The fold button and the edge strip are for clicking; resting on them is
        // aiming, and sliding the panel out would move the strip from under the pointer.
        !!(e.target as Element | null)?.closest?.('[data-sidebar="rail"], [data-no-peek]')
      const fold = () => {
        // A menu opened from the sidebar (Notes, the account) is portaled outside
        // it, so the pointer "leaves" to reach it. Stay out while one is open.
        if (peekRoot.current?.querySelector('[aria-haspopup][aria-expanded="true"]')) {
          leaveTimer.current = window.setTimeout(fold, 300)
          return
        }
        setPeek(false)
      }
      return {
        ref: (el) => {
          peekRoot.current = el
        },
        onPointerEnter: () => {
          window.clearTimeout(leaveTimer.current)
        },
        onPointerMove: (e) => {
          if (!PEEK_ON_HOVER || e.pointerType !== "mouse" || open || isMobile) return
          window.clearTimeout(leaveTimer.current)
          if (peek) return
          if (e.buttons !== 0 || peekBlocked.current || outOfBounds(e)) {
            window.clearTimeout(dwellTimer.current)
            restAt.current = null
            return
          }
          const at = restAt.current
          if (at && Math.abs(e.clientX - at.x) <= PEEK_REST_PX && Math.abs(e.clientY - at.y) <= PEEK_REST_PX) return
          // Still moving: start the dwell again from here.
          restAt.current = { x: e.clientX, y: e.clientY }
          window.clearTimeout(dwellTimer.current)
          dwellTimer.current = window.setTimeout(() => setPeek(true), PEEK_DWELL_MS)
        },
        onPointerLeave: () => {
          window.clearTimeout(dwellTimer.current)
          restAt.current = null
          peekBlocked.current = false
          if (peek) leaveTimer.current = window.setTimeout(fold, PEEK_LEAVE_MS)
        },
        onPointerDownCapture: () => {
          window.clearTimeout(dwellTimer.current)
          restAt.current = null
          // Also while peeking: a nav click folds the peek, and the pointer still
          // resting on the rail must not slide it straight back out over the new page.
          peekBlocked.current = true
        },
        onKeyDownCapture: () => {
          window.clearTimeout(dwellTimer.current)
          restAt.current = null
        },
      }
    }, [open, isMobile, peek])

    // Capture phase, so a focus trap that swallows Tab still leaves the timestamp.
    React.useEffect(() => {
      const noteTab = (event: KeyboardEvent) => {
        if (event.key === "Tab") lastTabAt = performance.now()
      }
      window.addEventListener("keydown", noteTab, true)
      return () => window.removeEventListener("keydown", noteTab, true)
    }, [])

    // Adds a keyboard shortcut to toggle the sidebar, and Esc to fold a peek.
    React.useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        // Whoever handled the key first keeps it (the notes editor's Ctrl+B is
        // bold, a menu's Esc closes the menu), and so does anything being typed in.
        if (event.defaultPrevented || isEditableTarget(event.target)) return
        if (event.key === "Escape" && peek) {
          closePeek()
          return
        }
        // Exactly ⌘B / Ctrl+B: with shift or alt held it belongs to whoever bound
        // that combo (the tutor's talk key, for one). Matched on the physical key as
        // well as the letter, so Caps Lock and non-Latin layouts still fold it.
        if (
          // `key` can be missing on the synthetic keydown Chrome sends for autofill.
          (event.code === "KeyB" || (event.key ?? "").toLowerCase() === "b") &&
          (event.metaKey || event.ctrlKey) &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault()
          toggleSidebar()
        }
      }

      window.addEventListener("keydown", handleKeyDown)
      return () => window.removeEventListener("keydown", handleKeyDown)
    }, [toggleSidebar, peek, closePeek])

    // We add a state so that we can do data-state="expanded" or "collapsed".
    // This makes it easier to style the sidebar with Tailwind classes.
    const state = open ? "expanded" : "collapsed"

    const contextValue = React.useMemo<SidebarContext>(
      () => ({
        state,
        open,
        setOpen,
        isMobile,
        openMobile,
        setOpenMobile,
        toggleSidebar,
        peek,
        closePeek,
        collapse,
        peekHandlers,
      }),
      [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar, peek, closePeek, collapse, peekHandlers]
    )

    return (
      <SidebarContext.Provider value={contextValue}>
        {/* Calm tooltips: a pointer passing over the rail on its way somewhere
            else should not light up a row of labels. Once one is showing, the
            next one follows quickly. */}
        <TooltipProvider delayDuration={500} skipDelayDuration={150}>
          <div
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH,
                "--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
                ...style,
              } as React.CSSProperties
            }
            className={cn(
              "group/sidebar-wrapper flex min-h-svh w-full has-[[data-variant=inset]]:bg-sidebar",
              className
            )}
            ref={ref}
            {...props}
          >
            {children}
          </div>
        </TooltipProvider>
      </SidebarContext.Provider>
    )
  }
)
SidebarProvider.displayName = "SidebarProvider"

const Sidebar = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    side?: "left" | "right"
    variant?: "sidebar" | "floating" | "inset"
    collapsible?: "offcanvas" | "icon" | "none"
  }
>(
  (
    {
      side = "left",
      variant = "sidebar",
      collapsible = "offcanvas",
      className,
      children,
      ...props
    },
    ref
  ) => {
    const { isMobile, state, openMobile, setOpenMobile, peek, peekHandlers } = useSidebar()

    if (collapsible === "none") {
      return (
        <div
          className={cn(
            "flex h-full w-[--sidebar-width] flex-col bg-sidebar text-sidebar-foreground",
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </div>
      )
    }

    if (isMobile) {
      return (
        <Sheet open={openMobile} onOpenChange={setOpenMobile} {...props}>
          <SheetContent
            data-sidebar="sidebar"
            data-mobile="true"
            className="w-[--sidebar-width] bg-sidebar p-0 text-sidebar-foreground [&>button]:hidden"
            style={
              {
                "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
              } as React.CSSProperties
            }
            side={side}
          >
            {/* A dialog needs a name for screen readers (Radix logs an error
                without one); the sheet has no visible heading to give it. */}
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">Pages, notes, search and your account.</SheetDescription>
            <div className="flex h-full w-full flex-col">{children}</div>
          </SheetContent>
        </Sheet>
      )
    }

    /*
      While peeking, the panel is still COLLAPSED (data-state), so everything that
      has a different shape in the rail (the Notes menu, the fold button's spot)
      keeps that shape; only `data-collapsible` lifts, which is what shows the
      labels. The gap beside it keeps its rail width, so the page does not move.
    */
    const peeking = collapsible === "icon" && state === "collapsed" && peek

    return (
      <div
        ref={ref}
        className="group peer hidden md:block text-sidebar-foreground"
        data-state={state}
        data-collapsible={state === "collapsed" && !peeking ? collapsible : ""}
        data-peek={peeking ? "true" : undefined}
        data-variant={variant}
        data-side={side}
      >
        {/* This is what handles the sidebar gap on desktop */}
        <div
          className={cn(
            "relative h-svh w-[--sidebar-width] bg-transparent transition-[width]",
            MOTION,
            "group-data-[collapsible=offcanvas]:w-0",
            "group-data-[side=right]:rotate-180",
            variant === "floating" || variant === "inset"
              ? "group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))] group-data-[peek=true]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4))]"
              : "group-data-[collapsible=icon]:w-[--sidebar-width-icon] group-data-[peek=true]:w-[--sidebar-width-icon]"
          )}
        />
        <div
          ref={collapsible === "icon" ? peekHandlers.ref : undefined}
          onPointerEnter={collapsible === "icon" ? peekHandlers.onPointerEnter : undefined}
          onPointerMove={collapsible === "icon" ? peekHandlers.onPointerMove : undefined}
          onPointerLeave={collapsible === "icon" ? peekHandlers.onPointerLeave : undefined}
          onPointerDownCapture={collapsible === "icon" ? peekHandlers.onPointerDownCapture : undefined}
          onKeyDownCapture={collapsible === "icon" ? peekHandlers.onKeyDownCapture : undefined}
          className={cn(
            "fixed inset-y-0 z-10 hidden h-svh w-[--sidebar-width] transition-[left,right,width] md:flex",
            MOTION,
            "group-data-[peek=true]:z-50",
            side === "left"
              ? "left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]"
              : "right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]",
            // Adjust the padding for floating and inset variants.
            variant === "floating" || variant === "inset"
              ? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)_+_theme(spacing.4)_+2px)]"
              : "group-data-[collapsible=icon]:w-[--sidebar-width-icon] group-data-[side=left]:border-r group-data-[side=right]:border-l",
            className
          )}
          {...props}
        >
          <div
            data-sidebar="sidebar"
            className="flex h-full w-full flex-col bg-sidebar group-data-[variant=floating]:rounded-lg group-data-[variant=floating]:border group-data-[variant=floating]:border-sidebar-border group-data-[variant=floating]:shadow group-data-[peek=true]:rounded-xl group-data-[peek=true]:shadow-xl group-data-[peek=true]:ring-1 group-data-[peek=true]:ring-sidebar-border"
          >
            {/* The peek's edge is a ring, not a border: a border takes layout
                room and nudged every icon by a pixel as the panel slid out. */}
            {children}
          </div>
        </div>
      </div>
    )
  }
)
Sidebar.displayName = "Sidebar"

const SidebarTrigger = React.forwardRef<
  React.ElementRef<typeof Button>,
  React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
  const { toggleSidebar } = useSidebar()

  return (
    <Button
      ref={ref}
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn("h-7 w-7", className)}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  )
})
SidebarTrigger.displayName = "SidebarTrigger"

/*
  The edge strip: a click anywhere along the sidebar's edge folds or unfolds it.
  It sits in the gutter between the panel and the content card and stops at the
  card's edge (it used to reach 2-7px into the card, so a click at the card's edge
  folded the sidebar). Mouse only in spirit: tabIndex -1, because the fold button
  is the keyboard's way to do the same, and not rendered in the phone sheet, where
  it sat at the sheet's left edge and closed it on a stray tap.
*/
const SidebarRail = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(({ className, ...props }, ref) => {
  const { toggleSidebar, isMobile, state } = useSidebar()

  if (isMobile) return null

  const label = state === "collapsed" ? "Expand sidebar" : "Collapse sidebar"

  return (
    <button
      ref={ref}
      type="button"
      data-sidebar="rail"
      aria-label={label}
      tabIndex={-1}
      onClick={toggleSidebar}
      title={label}
      className={cn(
        "absolute inset-y-0 z-20 hidden w-3 cursor-ew-resize md:flex",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] after:-translate-x-1/2 after:rounded-full after:transition-colors hover:after:bg-sidebar-foreground/15",
        "group-data-[side=left]:right-0 group-data-[side=right]:left-0",
        className
      )}
      {...props}
    />
  )
})
SidebarRail.displayName = "SidebarRail"

const SidebarInset = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"main">
>(({ className, ...props }, ref) => {
  return (
    <main
      ref={ref}
      className={cn(
        "relative flex min-h-svh flex-1 flex-col bg-background",
        // The card's left margin moves with the panel's width, in the same motion,
        // instead of snapping 7px at the start of every fold.
        "peer-data-[variant=inset]:min-h-[calc(100svh-theme(spacing.4))] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow",
        // Unprefixed: an md: transition utility would sit later in the CSS and
        // put back Tailwind's 150ms default over MOTION's duration.
        "transition-[margin]",
        MOTION,
        className
      )}
      {...props}
    />
  )
})
SidebarInset.displayName = "SidebarInset"

const SidebarInput = React.forwardRef<
  React.ElementRef<typeof Input>,
  React.ComponentProps<typeof Input>
>(({ className, ...props }, ref) => {
  return (
    <Input
      ref={ref}
      data-sidebar="input"
      className={cn(
        "h-8 w-full bg-background shadow-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className
      )}
      {...props}
    />
  )
})
SidebarInput.displayName = "SidebarInput"

const SidebarHeader = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="header"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
})
SidebarHeader.displayName = "SidebarHeader"

const SidebarFooter = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="footer"
      className={cn("flex flex-col gap-2 p-2", className)}
      {...props}
    />
  )
})
SidebarFooter.displayName = "SidebarFooter"

const SidebarSeparator = React.forwardRef<
  React.ElementRef<typeof Separator>,
  React.ComponentProps<typeof Separator>
>(({ className, ...props }, ref) => {
  return (
    <Separator
      ref={ref}
      data-sidebar="separator"
      className={cn("mx-2 w-auto bg-sidebar-border", className)}
      {...props}
    />
  )
})
SidebarSeparator.displayName = "SidebarSeparator"

const SidebarContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="content"
      className={cn(
        // Scrolls in the rail too (its scrollbar is hidden in index.css): on a short
        // screen the lower icons used to be cut off with no way to reach them.
        "flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarContent.displayName = "SidebarContent"

const SidebarGroup = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      data-sidebar="group"
      className={cn("relative flex w-full min-w-0 flex-col p-2", className)}
      {...props}
    />
  )
})
SidebarGroup.displayName = "SidebarGroup"

const SidebarGroupLabel = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "div"

  return (
    <Comp
      ref={ref}
      data-sidebar="group-label"
      className={cn(
        "relative flex h-8 shrink-0 select-none items-center overflow-hidden whitespace-nowrap rounded-md px-2 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[color] focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        MOTION,
        // In the icon rail the label KEEPS its 28px slot, so no icon below it moves
        // when the sidebar folds (it used to slide up with -mt-8, and every icon
        // jumped). The words go and a short hairline marks the break between groups.
        "before:pointer-events-none before:absolute before:left-1/2 before:top-1/2 before:h-px before:w-3.5 before:-translate-x-1/2 before:bg-sidebar-foreground/15 before:opacity-0",
        "group-data-[collapsible=icon]:text-transparent group-data-[collapsible=icon]:before:opacity-100",
        className
      )}
      {...props}
    />
  )
})
SidebarGroupLabel.displayName = "SidebarGroupLabel"

const SidebarGroupAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & { asChild?: boolean }
>(({ className, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={ref}
      data-sidebar="group-action"
      className={cn(
        // 28px, level with the group label's own 28px row (the stock 20px square
        // was a hard target for a control students use every day).
        "absolute right-2 top-2 flex size-8 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0",
        // A 44px hit area on touch screens, without drawing anything bigger.
        "after:absolute after:-inset-[8px] after:content-[''] [@media(pointer:fine)]:after:hidden",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarGroupAction.displayName = "SidebarGroupAction"

const SidebarGroupContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="group-content"
    className={cn("w-full text-sm", className)}
    {...props}
  />
))
SidebarGroupContent.displayName = "SidebarGroupContent"

const SidebarMenu = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu"
    className={cn("flex w-full min-w-0 flex-col gap-1", className)}
    {...props}
  />
))
SidebarMenu.displayName = "SidebarMenu"

const SidebarMenuItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ className, ...props }, ref) => (
  <li
    ref={ref}
    data-sidebar="menu-item"
    className={cn("group/menu-item relative", className)}
    {...props}
  />
))
SidebarMenuItem.displayName = "SidebarMenuItem"

const sidebarMenuButtonVariants = cva(
  "peer/menu-button flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-none ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground group-data-[collapsible=icon]:!w-8 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        outline:
          "bg-background shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:bg-sidebar-accent hover:text-sidebar-accent-foreground hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]",
      },
      size: {
        default: "h-8 text-sm",
        sm: "h-7 text-xs",
        lg: "h-12 text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)
/*
  FIXED GEOMETRY. Folding changes only the panel's width: in the rail a row keeps
  its height and padding and just narrows to 28px, so every icon stays exactly
  where it was (it used to become a 28x28 square with the large rows losing their
  padding, and the logo, avatar and everything under them moved). The row
  transition is gone with it, since there is no geometry left to animate.
*/

type TooltipSpec = string | React.ComponentProps<typeof TooltipContent>

/*
  A sidebar tooltip. By default it only speaks where the words are hidden — the
  folded rail — and never on a phone (no hover there, and the sheet shows every
  label). `always` is for controls that have no visible label in any state (the
  fold button) or carry detail their label does not (presence).

  Two quiet rules on top of Radix:
  - opened by FOCUS, it waits for a Tab: focus handed back by a closing palette or
    menu does not pop a label out beside the rail;
  - opened by HOVER in the rail while PEEK_ON_HOVER is on, it stays shut, because
    resting there slides the real labels out and a tooltip would flash first.
*/
function SidebarTooltip({
  tooltip,
  always = false,
  children,
}: {
  tooltip: TooltipSpec
  always?: boolean
  children: React.ReactElement
}) {
  const { isMobile, state, peek } = useSidebar()
  const [open, setOpen] = React.useState(false)
  const byFocus = React.useRef(false)
  const labelsHidden = !isMobile && state === "collapsed" && !peek
  const allowed = !isMobile && (always || labelsHidden)

  React.useEffect(() => {
    if (!allowed) setOpen(false)
  }, [allowed])

  const content = typeof tooltip === "string" ? { children: tooltip } : tooltip
  const childProps = children.props as { onFocus?: (e: React.FocusEvent) => void }
  // Runs before Radix's own focus handler (Slot calls the child's first), so the
  // open request that handler makes can be told apart from a hover.
  const trigger = React.cloneElement(children, {
    onFocus: (e: React.FocusEvent) => {
      childProps.onFocus?.(e)
      byFocus.current = true
      queueMicrotask(() => {
        byFocus.current = false
      })
    },
  } as Partial<unknown>)

  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => {
        if (!next) return setOpen(false)
        if (!allowed) return
        if (byFocus.current) {
          if (performance.now() - lastTabAt > TAB_FOCUS_WINDOW_MS) return
        } else if (PEEK_ON_HOVER && labelsHidden && !always) {
          return
        }
        setOpen(true)
      }}
    >
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
      <TooltipContent side="right" align="center" {...content} />
    </Tooltip>
  )
}

const SidebarMenuButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    isActive?: boolean
    tooltip?: TooltipSpec
  } & VariantProps<typeof sidebarMenuButtonVariants>
>(
  (
    {
      asChild = false,
      isActive = false,
      variant = "default",
      size = "default",
      tooltip,
      className,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"

    const button = (
      <Comp
        ref={ref}
        data-sidebar="menu-button"
        data-size={size}
        data-active={isActive}
        className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
        {...props}
      />
    )

    if (!tooltip) {
      return button
    }

    // A trigger with its own menu (DropdownMenuTrigger asChild) still works:
    // its props reach `button`, and Slot lets the child's win over the
    // tooltip's, so data-state and aria-expanded stay the menu's.
    return <SidebarTooltip tooltip={tooltip}>{button}</SidebarTooltip>
  }
)
SidebarMenuButton.displayName = "SidebarMenuButton"

const SidebarMenuAction = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> & {
    asChild?: boolean
    showOnHover?: boolean
  }
>(({ className, asChild = false, showOnHover = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-action"
      className={cn(
        "absolute right-1 top-1.5 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-sidebar-foreground outline-none ring-sidebar-ring transition-transform hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 peer-hover/menu-button:text-sidebar-accent-foreground [&>svg]:size-4 [&>svg]:shrink-0",
        // Increases the hit area of the button on mobile.
        "after:absolute after:-inset-2 after:md:hidden",
        "peer-data-[size=sm]/menu-button:top-1",
        "peer-data-[size=default]/menu-button:top-1.5",
        "peer-data-[size=lg]/menu-button:top-2.5",
        "group-data-[collapsible=icon]:hidden",
        showOnHover &&
          "group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 data-[state=open]:opacity-100 peer-data-[active=true]/menu-button:text-sidebar-accent-foreground md:opacity-0",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuAction.displayName = "SidebarMenuAction"

const SidebarMenuBadge = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div">
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    data-sidebar="menu-badge"
    className={cn(
      "absolute right-1 flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-medium tabular-nums text-sidebar-foreground select-none pointer-events-none",
      "peer-hover/menu-button:text-sidebar-accent-foreground peer-data-[active=true]/menu-button:text-sidebar-accent-foreground",
      "peer-data-[size=sm]/menu-button:top-1",
      "peer-data-[size=default]/menu-button:top-1.5",
      "peer-data-[size=lg]/menu-button:top-2.5",
      "group-data-[collapsible=icon]:hidden",
      className
    )}
    {...props}
  />
))
SidebarMenuBadge.displayName = "SidebarMenuBadge"

const SidebarMenuSkeleton = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & {
    showIcon?: boolean
  }
>(({ className, showIcon = false, ...props }, ref) => {
  // Random width between 50 to 90%.
  const width = React.useMemo(() => {
    return `${Math.floor(Math.random() * 40) + 50}%`
  }, [])

  return (
    <div
      ref={ref}
      data-sidebar="menu-skeleton"
      className={cn("rounded-md h-8 flex gap-2 px-2 items-center", className)}
      {...props}
    >
      {showIcon && (
        <Skeleton
          className="size-4 rounded-md"
          data-sidebar="menu-skeleton-icon"
        />
      )}
      <Skeleton
        className="h-4 flex-1 max-w-[--skeleton-width]"
        data-sidebar="menu-skeleton-text"
        style={
          {
            "--skeleton-width": width,
          } as React.CSSProperties
        }
      />
    </div>
  )
})
SidebarMenuSkeleton.displayName = "SidebarMenuSkeleton"

const SidebarMenuSub = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<"ul">
>(({ className, ...props }, ref) => (
  <ul
    ref={ref}
    data-sidebar="menu-sub"
    className={cn(
      "mx-3.5 flex min-w-0 translate-x-px flex-col gap-1 border-l border-sidebar-border px-2.5 py-0.5",
      "group-data-[collapsible=icon]:hidden",
      className
    )}
    {...props}
  />
))
SidebarMenuSub.displayName = "SidebarMenuSub"

const SidebarMenuSubItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<"li">
>(({ ...props }, ref) => <li ref={ref} {...props} />)
SidebarMenuSubItem.displayName = "SidebarMenuSubItem"

const SidebarMenuSubButton = React.forwardRef<
  HTMLAnchorElement,
  React.ComponentProps<"a"> & {
    asChild?: boolean
    size?: "sm" | "md"
    isActive?: boolean
  }
>(({ asChild = false, size = "md", isActive, className, ...props }, ref) => {
  const Comp = asChild ? Slot : "a"

  return (
    <Comp
      ref={ref}
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        "flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-sidebar-foreground outline-none ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-sidebar-accent-foreground",
        "data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-accent-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm",
        "group-data-[collapsible=icon]:hidden",
        className
      )}
      {...props}
    />
  )
})
SidebarMenuSubButton.displayName = "SidebarMenuSubButton"

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTooltip,
  SidebarTrigger,
  useSidebar,
}
