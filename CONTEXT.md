# Toolbox

A collection of single-purpose browser utilities. This glossary fixes the words used in code, docs and conversation, so that "a project" cannot quietly mean three different things.

## Language

**Tool**:
One user-facing capability, reachable at `/tools/<slug>`.
_Avoid_: feature, utility, project, app

**Tool page**:
The route `/tools/<slug>` that renders one Tool. The page _is_ the Tool, not a view of one.
_Avoid_: detail page, tool detail, tool view

**Package**:
Code under `packages/*` that other workspace packages import. Not user-facing.
_Avoid_: library, module, shared folder

**App**:
A deployable workspace package. Today the only App is `@toolbox/web`.
_Avoid_: site, project

**Tool Registry**:
The single list of Tools that exist; the homepage grid and the sitemap both read it.
_Avoid_: tool list, manifest, catalog

**Tool Card**:
The card that presents one entry of the Tool Registry on the homepage, and the only place a Tool's cover is used. A Tool without a cover is set in type instead.
_Avoid_: tile, list item, preview

**Conversion**:
One input image together with the target settings it is encoded with. A Batch is many Conversions, and each Conversion yields at most one output file per target format.
_Avoid_: job, task, transform

**Lossless**:
An output that carries the source's pixels without any further lossy compression. PNG and BMP are always lossless, WebP and AVIF are lossless only when asked, and JPEG cannot be lossless at all, because the format has no such mode. This is a property of the format, not of a Batch.
_Avoid_: maximum quality, no compression
