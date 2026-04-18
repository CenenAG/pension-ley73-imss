# AGENTS.md — Auditex Pensiones

Pension calculator for Mexican IMSS (Ley 73, Art. 167). Angular 21 standalone SPA, no backend.

## Build / Lint / Test Commands

| Action                    | Command                                                                     |
| ------------------------- | --------------------------------------------------------------------------- |
| Install dependencies      | `bun install`                                                               |
| Dev server                | `bun start` or `ng serve`                                                   |
| Production build          | `bun run build` or `ng build`                                               |
| Development build (watch) | `bun run watch`                                                             |
| Run all tests             | `bun test` or `ng test`                                                     |
| Run a single test         | `bun test -- --include src/app/services/pension-calculator.service.spec.ts` |
| Format check              | `npx prettier --check .`                                                    |
| Format write              | `npx prettier --write .`                                                    |
| Lint                      | Not configured — no ESLint exists yet                                       |
| Type check                | `npx tsc --noEmit -p tsconfig.app.json`                                     |

**Note**: No test files exist yet. Vitest is configured in `tsconfig.spec.json` (`"types": ["vitest/globals"]`), but no runner is wired up. Run `ng test` or install a Vitest runner before writing specs.

## Project Structure

```
src/
  app/
    app.ts                    # Root component (signals, computed, inject)
    app.config.ts             # ApplicationConfig providers
    components/
      sbc-grid/               # Editable SBC periods grid
      pension-form/            # Input parameters form
      pension-result/          # Result display
      calculation-breakdown/  # Step-by-step calculation breakdown
    models/
      pension.model.ts         # Interfaces, types, constants, defaults
    services/
      pension-calculator.service.ts  # Core calculation logic
      pdf-generator.service.ts       # PDF export with jsPDF
    pipes/
      currency-mxn.pipe.ts    # currencyMXN pipe (Intl.NumberFormat)
  main.ts                     # Bootstrap
  styles.css                  # Global styles
  index.html                  # Entry HTML
```

## Code Style Guidelines

### TypeScript & Angular Conventions

- **Standalone components only** — no NgModules. All components use `standalone: true`.
- **Signals API** — use `signal()`, `computed()`, `input()`, `input.required()`, `output()` for component API. No `@Input()` / `@Output()` decorators.
- **Dependency injection** — use `inject(Service)` function, not constructor injection.
- **ChangeDetectionStrategy.OnPush** — every component must declare `changeDetection: ChangeDetectionStrategy.OnPush`.
- **No reactive forms** — uses `FormsModule` (template-driven) with manual event handlers.
- **No barrel/index files** — import directly from the file: `'./components/pension-form/pension-form'`.

### Imports

1. Angular packages first (`@angular/core`, `@angular/forms`, etc.)
2. Third-party packages next (`jspdf`, `rxjs`)
3. Local imports last (`../../models/`, `../../services/`)
4. Use single quotes for all imports
5. Use relative paths — no path aliases configured

```typescript
import { Component, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import { PensionResult, Corte250Info } from '../models/pension.model';
```

### Naming Conventions

- **Components**: PascalCase class + suffix (`PensionFormComponent`, `SbcGridComponent`)
- **Selectors**: kebab-case with `app-` prefix (`app-pension-form`, `app-sbc-grid`)
- **Services**: PascalCase with `Service` suffix (`PensionCalculatorService`)
- **Models**: PascalCase interfaces (`SbcEntry`, `PensionResult`, `Corte250Info`)
- **Type aliases**: PascalCase (`EstadoCivil`)
- **Constants**: UPPER_SNAKE_CASE (`ART167_TABLE`, `UMA_2026`, `SMG_DEFAULT`, `FACTOR_FOX`)
- **Methods**: camelCase (`calcularPension`, `calcularDiasEntreFechas`)
- **Files**: kebab-case matching selector (`pension-form.ts`, `sbc-grid.ts`)

### Formatting

- **Indent**: 2 spaces (no tabs)
- **Quotes**: Single quotes everywhere
- **Print width**: 100 characters
- **Trailing commas**: As per Prettier defaults
- **Final newline**: Yes
- **Trim trailing whitespace**: Yes
- **HTML parser**: `angular` (configured in `.prettierrc`)
- Run `npx prettier --write .` before committing

### Types & Null Handling

- **Strict mode enabled** — `strict: true`, `noImplicitReturns`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`
- **Nullability** — use `Date | null` explicitly; avoid `undefined` for dates. Check with `!` only when guaranteed non-null.
- **Union types** for enums — `type EstadoCivil = 'casado' | 'concubina' | 'soltero'` (no TypeScript enums)
- **Optional properties** — use `?` suffix (`efectivo?: boolean`, `diasEfectivos?: number`)

### Error Handling

- No global error handler. Validate inputs early and return early for invalid state.
- Prefer returning `null` over throwing. Use early returns: `if (!fechaFinal || entries.length === 0) return entries;`
- Static utility methods on services for pure functions (`PensionCalculatorService.parseDateInput`, `formatCurrency`).

### Component Structure (per file)

```typescript
// 1. Imports
import { Component, signal, computed, ChangeDetectionStrategy, inject } from '@angular/core';

// 2. @Component decorator
@Component({
  selector: 'app-xxx',
  standalone: true,
  imports: [/* deps */],
  templateUrl: './xxx.html',
  styleUrl: './xxx.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
// 3. Class
export class XxxComponent {
  // 3a. Injected services (private)
  private calculator = inject(PensionCalculatorService);
  // 3b. Signal inputs
  valor = input(0);
  // 3c. Signal outputs
  valorChange = output<number>();
  // 3d. Internal signals
  estado = signal<EstadoCivil>('casado');
  // 3e. Computed signals
  resultado = computed(() => /* ... */);
  // 3f. Methods
  onAlgoChange(event: Event): void { /* ... */ }
}
```

## Key Architecture Decisions

- **No routing** — single-page app, no `@angular/router` dependency
- **No state management library** — all state in root `App` component signals, passed down via `input()` / up via `output()`
- **No test framework runner** — `tsconfig.spec.json` declares Vitest types but no test runner is installed
- **Production baseHref**: `/pension-ley73-imss/`
- **Package manager**: Bun (v1.3.11, per `packageManager` field). Also has `package-lock.json` as npm fallback.

## Angular Compiler Options

```
strictInjectionParameters: true
strictInputAccessModifiers: true
strictTemplates: true
```

These enforce strict DI parameter types, require explicit access modifiers on inputs, and strict template type-checking.
