import { MenuEntry } from "../rs/MenuEntry";

export interface OsrsMenuEntry extends MenuEntry {
    onClick?: (entry: MenuEntry) => void;
}
