# SRD 5.1 attribution

`srd-equipment.json` contains the base equipment tables from the D&D 5e System
Reference Document. It is generated, not hand-written — see the regeneration note
below.

## Required attribution

> This work includes material taken from the System Reference Document 5.1
> ("SRD 5.1") by Wizards of the Coast LLC and available at
> <https://www.dndbeyond.com/srd>. The SRD 5.1 is licensed under the Creative
> Commons Attribution 4.0 International License, available at
> <https://creativecommons.org/licenses/by/4.0/legalcode>.

CC-BY-4.0 permits use and redistribution, commercial included, provided the
attribution above travels with the material. Keep this file alongside the data.

It covers the SRD only. Anything outside it — most published monsters, settings,
adventures and magic items — is not licensed and must not be added here.

## Where the data came from

Fetched from the community SRD API at <https://www.dnd5eapi.co>, which serves
SRD 5.1 content, then reshaped into this app's item format: a one-line `summary`
for lists, the stat block in `data`, and any rules text in `bodyMd`.

237 entries: weapons, armour, adventuring gear, tools, equipment packs, mounts
and vehicles.

## Regenerating

The generator is not committed, since this is a one-off import rather than a
build step. To refresh, re-fetch from `/api/equipment`, map each entry to
`{ name, summary, bodyMd, tags, data }`, and write it here sorted by name.
Then `npm run db:seed:srd -- --replace`.
