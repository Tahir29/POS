import { useSelector, useDispatch } from 'react-redux';
import {
  toggleSidebar,
  openSidebar,
  closeSidebar,
  selectSidebarOpen,
} from '@/store/slices/uiSlice';

/**
 * Provides sidebar open/closed state and toggle actions.
 * Reads from and writes to the Redux ui slice.
 * @returns {{ sidebarOpen: boolean, toggle: Function, open: Function, close: Function }}
 */
export function useSidebar() {
  const dispatch = useDispatch();
  const sidebarOpen = useSelector(selectSidebarOpen);

  const toggle = () => dispatch(toggleSidebar());
  const open   = () => dispatch(openSidebar());
  const close  = () => dispatch(closeSidebar());

  return { sidebarOpen, toggle, open, close };
}