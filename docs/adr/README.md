# Architectural Decision Records

Numbered, append-only decision logs. Copy [`template.md`](template.md) for a
new decision; never edit an accepted ADR — supersede it instead.

| ID                                                       | Title                                                   | Status   |
| -------------------------------------------------------- | ------------------------------------------------------- | -------- |
| [0001](0001-vertical-slice-modular-monolith.md)          | Vertical slices in a modular monolith                   | Accepted |
| [0002](0002-signals-and-feature-stores.md)               | Signals + route-scoped feature stores over global store | Accepted |
| [0003](0003-ports-and-adapters-with-fake-backends.md)    | Ports & adapters with fake backends as the API seam     | Accepted |
| [0004](0004-interceptor-ordering-and-401-refresh.md)     | Interceptor ordering and single-flight 401 refresh      | Accepted |
| [0005](0005-generated-slices-and-enforced-boundaries.md) | Generator-produced slices with enforced boundaries      | Accepted |
