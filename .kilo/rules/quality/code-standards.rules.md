/* @lifecycle ACTIVE — Quality Rules: Code Standards and Style */
/* @tags backend, coding */

# Code Standards

## 1. Purpose

Defines TypeScript coding standards, style rules, and best practices for the Floweng codebase.

---

## 2. TypeScript Configuration

- **Strict mode required** (Constitution §4): `strict: true` in `tsconfig.json`
- No `any` types — use `unknown` with type guards when the type is not known
- Explicit return types on all public methods
- Prefer `interface` over `type` for object shapes (use `type` for unions/intersections)

## 3. Prohibited Patterns (Constitution §4)

| Pattern | Reason | Replacement |
|---------|--------|-------------|
| `any` type | Type safety violation | `unknown` + type guard |
| `console.log()` | Production noise | NestJS `Logger` service |
| Function with >40 lines | Maintainability | Break into smaller functions |
| `// @ts-ignore` | Suppresses real errors | Fix the type issue |

## 4. Imports

Group imports in this order, separated by blank lines:

```typescript
// 1. External/NestJS imports
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../shared/prisma/prisma.service';

// 2. Internal module imports
import { Recommendation } from './interfaces/recommendation.interface';
```

- Prefer named exports over default exports
- Use path aliases from `tsconfig.json` where available

## 5. Async Patterns

- Always use `async/await` over raw `.then()` chains
- Never forget `await` in async functions — use `eslint@typescript-eslint/no-floating-promises`
- Handle Promise rejections with try/catch
- Use `Promise.all()` for parallel independent async operations

## 6. Error Handling

- Controllers: let NestJS exception filters handle errors (never try/catch in controllers for expected flow)
- Services: throw NestJS `HttpException` subclasses (`NotFoundException`, `BadRequestException`, etc.)
- Catch unexpected errors at service boundaries and convert to typed exceptions
- Never expose internal error details to clients

## 7. NestJS Best Practices

- `@Injectable()` on all services
- `@Controller()` with path prefix matching module name
- Use NestJS lifecycle hooks (`OnModuleInit`, `OnModuleDestroy`) for connection management
- Prefer constructor injection over `@Inject()` decorator
- Use `@Req()` and `@Res()` only when absolutely necessary (prefer decorators)

---

**End of Code Standards**
