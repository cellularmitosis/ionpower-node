# j2y — JSON ↔ YAML converter

A tiny CLI tool demo. Shows off:

- `commander` for argv parsing
- `js-yaml` for YAML parse/emit
- `kleur` for colored stderr (no color when not a TTY)
- `fs` for file I/O
- the `process`, `path`, and `require` machinery together

## Run

```bash
../../ionpower-node j2y.js sample.json
../../ionpower-node j2y.js -r sample.yaml
../../ionpower-node j2y.js -o sample.yaml sample.json
```

## Example output

```
$ ionpower-node demos/json2yaml/j2y.js demos/json2yaml/sample.json
name: ionpower-node
version: 0.1.0
description: Node-compatible JS runtime on PPC Tiger
authors:
  - anonymous hacker
targets:
  G3:
    cpu: '750'
    tested: false
...
```
