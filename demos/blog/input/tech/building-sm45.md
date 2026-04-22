---
title: "Building SpiderMonkey 45 on Mac OS X Tiger"
date: 2026-04-19
author: "j"
tags: [build, ppc, sm45]
---

# Building SpiderMonkey 45 on Mac OS X Tiger

Nothing in modern Mozilla's configure pipeline wants to run on a
G5, but the TenFourFox tree is close enough.

## Prerequisites

- autoconf 2.13 exactly — 2.5x is too new
- Python 2.7 for mozbuild
- gcc 4.9 with `-mmacosx-version-min=10.4`
- A few stubs (`mozilla-config.h`, empty `intl/icu`)

Build time on the iMac G5: roughly 3 hours. Plenty of time for a long
walk.
