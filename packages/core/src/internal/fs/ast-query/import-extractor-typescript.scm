; Captures for extracting import names from TypeScript files.

; Default import: import React from "react"
(import_statement
  (import_clause
    (identifier) @import.name))

; Namespace import: import * as Effect from "effect"
(import_statement
  (import_clause
    (namespace_import
      (identifier) @import.name)))

; Named imports without alias: import { foo, bar } from "mod"
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        name: (_) @import.name
        !alias))))

; Named imports with alias: import { foo as bar } from "mod"
(import_statement
  (import_clause
    (named_imports
      (import_specifier
        alias: (_) @import.alias))))

; Import require clause: import x = require("mod")
(import_statement
  (import_require_clause
    (identifier) @import.name))

; Import alias: import x = Namespace.Sub
(import_alias
  (identifier) @import.name)
