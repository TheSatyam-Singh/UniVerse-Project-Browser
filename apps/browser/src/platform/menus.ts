import { showMenu as showNativeMenu, type MenuItem } from "@universe/shell";
import { withIconNames } from "../lib/activeLook";

export { menuShown, watchMenus, type MenuItem, type MenuEntry } from "@universe/shell";

export const showMenu = (items: MenuItem[]): Promise<string | null> => showNativeMenu(withIconNames(items));
