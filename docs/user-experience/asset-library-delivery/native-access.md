# Read the catalogue through Obsidian notes and Bases

Asset notes are ordinary Markdown files in the library folder shown in the library footer.
Open a selected asset with **Open note**, or locate that folder in Obsidian's file explorer.
Neither route requires a project. Keep the `id`, `type`, `schema-version` and `revision` properties intact.

For a native table, create a Base in Obsidian, choose its built-in Table view, and add a property
filter: `type` equals `renovation-asset`. This includes asset notes throughout the vault, rather
than guessing ownership from a project folder. Add these existing note properties as columns:

| Property | Meaning |
| --- | --- |
| `name`, `category` | Definition identity and production category |
| `supplier`, `sku` | Optional sourcing metadata |
| `unit`, `unit-cost`, `currency` | Unit and exact decimal price string with its own currency |
| `waste-factor-default` | Fraction, e.g. `0.08` means 8% |
| `height` | Millimetres, or absent |
| `notes` | Optional definition notes |

Open the row's file to inspect or edit the note. A zero price is a deliberate zero, not unknown.
Do not sum the price column across currencies. Geometry is in `.rpgeo` sidecars; project usage and
price overrides require application queries and are not promised as native Base columns.
The library's unknown-category strip identifies notes the current parser cannot load; changing
an unfamiliar category to a different value is not a safe automatic repair.

This recipe uses the built-in Base table; no custom Base view or schema migration is installed.
