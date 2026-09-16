# Heading Rail — Full Guide

Every action the plugin supports, in one place. Written as a regular note, so
it can be read inside Obsidian with the rail itself running alongside it.

## The Rail

### What the Bars Are

One bar per heading in the note, docked to the right edge. Width follows the
heading level: an H1 bar is the longest, an H6 bar the shortest. The shape of
the document is readable before you read a word of it.

### The Two End Markers

Above the topmost bar and below the bottommost one sit two thinner markers.
They are the start and the end of the document. The whole empty area above
the first marker, and below the last one, is part of them — clicking anywhere
in that space jumps to the beginning or the end.

### Live Position Tracking

The bar matching your position highlights itself as you scroll. A section
becomes current when its edge crosses the middle of the screen, not the top,
so the highlight matches what you are actually reading.

### Hover

Moving the cursor near the bars widens the closest one, with its neighbours
following at a smaller scale. The further left the cursor moves into the
strip, the stronger the effect. Between the bars there is only visual
spacing — the entire strip responds to clicks, so aiming is never needed.

### Multi-Column Layout

When a note has too many headings for one column at readable spacing, the
rail adds a second column to its right, then a third. The leftmost column is
the start of the document. Within a column the bars are packed from the top.

## Moving Through the Document

### Click

A click on any bar scrolls to that heading.

### Drag to Scrub

Press and hold the mouse button on the rail and drag: the document follows
the cursor in real time, the way scrubbing works on a video timeline.
Releasing the button ends it.

### Space Bar Scrub

Holding the space bar while the cursor rests on the rail does the same thing
without holding the mouse button — just move the cursor up and down. The
space bar is only taken over while the cursor is on the rail; everywhere
else it stays an ordinary space.

### Wheel

Scrolling the wheel, or swiping on a trackpad, while the cursor is over the
rail moves the document several times faster than scrolling over the text.
Useful for crossing a long note quickly.

### Arrow Keys

With the outline open and the cursor on the rail, the up and down arrows
step between headings. Holding Ctrl does the same from anywhere in the note,
without hovering the rail first.

## The Outline Panel

### Peek With Ctrl

Holding Ctrl opens the outline for as long as the key is held. Releasing it
closes the panel again. Clicking an entry while Ctrl is held navigates
normally and does not pin the panel open.

### Pin It Open

A right-click on any bar opens the outline pinned, positioned at that
section. Right-clicking again closes it. The list button in the note's
toolbar toggles the same thing.

### Hover to Preview

Hovering a bar scrolls the outline to the matching heading — the document
itself does not move. Hovering an entry in the outline highlights the
matching bar, and the other way round.

### The Position Marker

A thin grey line beside the bars shows which part of the rail is currently
visible in the outline. With several columns it splits between them.

### Edge Indicators

If the current section scrolls out of the visible part of the outline, a
small pill appears above or below the panel showing which way it went.
Clicking it brings the current section back into view.

### Centring

Scrolling the note keeps the outline centred on the current section. Clicking
an entry that is already selected re-centres it. Right-clicking an entry
jumps to it and centres it at the same time.

### Search

The field above the outline filters entries by heading text. The bars are not
filtered — they always show the whole document. Escape clears the field.
The search box can be moved below the outline, or hidden entirely, in the
plugin settings.

## Selecting Sections

### One Section

Right-click an entry in the outline. It becomes selected and the action menu
appears next to it.

### A Range

Click one entry, then Shift-click another: everything between them is
selected. Note that starting a new range replaces the current selection
rather than adding to it.

### Scattered Sections

Alt-click adds and removes entries one at a time, so sections in unrelated
parts of the document can be selected together without taking everything
between them along. Alt-click again on a selected entry removes it.

### Clearing

Escape clears the selection, as does the Cancel button in the action menu, or
an ordinary click on any entry.

## Copying and Deleting

### The Action Menu

With something selected, a small menu appears beside the entry: Copy, Delete,
Cancel. Clicking an already-selected entry brings the menu back. The buttons
apply to the whole selection at once, not only to the entry the menu is
attached to.

### What a Section Includes

A section is the heading plus everything under it, down to the next heading
of the same or a higher level — nested subsections are included. The count
shown on the Delete button is the number of sections, not lines.

### Copy

Copies the selected sections to the clipboard. The note is not modified.

### Delete

Removes the selected sections from the note. Before writing, the plugin
checks that the outline still matches the file on disk and refuses if the
file changed while the operation was running.

### The Delete Key

With the outline pinned open, the cursor on the widget and something
selected, Delete or Backspace deletes the selection. It is deliberately
limited to that combination so the key stays an ordinary Delete everywhere
else.

### History and Restore

The rotate-arrow button in the note's toolbar opens a history window with two
lists: what was copied and what was deleted. Deleted entries can be restored
with one click; copied ones can be put back on the clipboard. Both lists can
be pruned entry by entry with Forget.

The history lives in memory for the current session only and is cleared when
Obsidian restarts. Obsidian's own undo also works on every deletion.

## On Mobile

### Bars

Tap a bar to jump. Drag a finger along the rail to scrub through the
document, exactly like dragging with a mouse. The bar under the finger
widens; sliding the finger left increases the effect up to a limit.

### Long-Press Instead of Right-Click

Holding a bar opens the outline at that section. Holding an entry in the
outline selects it and opens the action menu.

### Selecting

Once something is selected, ordinary taps add and remove entries — no
modifier keys are needed. Tapping with nothing selected navigates as usual.

### The Panel

The outline opens as a block anchored to the top-left corner. It closes on a
tap anywhere outside it, and also when the keyboard appears, since there is
no room for both. The rail hides itself while the keyboard is open.

## Commands

Three commands are available in the command palette and can be bound to
hotkeys: delete the selected sections, copy the selected sections, and
restore the last deletion.

## Settings

Three options, under Settings → Community plugins → Heading Rail:

- **Search field** — show or hide the search box above the outline.
- **Search at bottom** — swap the search box and the outline.
- **Keep deletions** — how many entries the history keeps.
