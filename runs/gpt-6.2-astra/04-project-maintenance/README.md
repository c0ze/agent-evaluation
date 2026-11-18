# slugkit

Slugkit provides two string helpers for Python 3.10 through 3.13.

```pycon
>>> from slugkit import normalize_version, slugify
>>> slugify("Hello?! World")
'hello-world'
>>> normalize_version("2.0-RC01")
'2.0-RC01'

```

`slugify` retains ASCII letters and digits. Unicode letters can be lost during conversion.
