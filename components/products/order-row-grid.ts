/**
 * Shared grid for the desktop orders list: the header row and every order row
 * use it so the columns line up. Items only get a column from `lg` up, where
 * the sidebar leaves room; below that the row stays one clean line.
 */
export const ORDER_ROW_GRID =
  'grid items-center gap-x-4 md:grid-cols-[minmax(6.5rem,0.7fr)_minmax(9rem,1.2fr)_auto_minmax(7rem,auto)_minmax(7.5rem,auto)_1rem] lg:grid-cols-[minmax(6.5rem,0.7fr)_minmax(9rem,1.1fr)_minmax(0,1.5fr)_auto_minmax(7rem,auto)_minmax(7.5rem,auto)_1rem]'
