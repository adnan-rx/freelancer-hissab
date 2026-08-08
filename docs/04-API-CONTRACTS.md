# FreelancerHisab - API Contracts & Endpoints

This document outlines the API specifications for **FreelancerHisab**. The backend is built with **NestJS**, utilizing **Drizzle ORM** for data access, **class-validator** for request validation, and **JWT-based authentication** via Passport.js. The API is documented and tested using **Swagger/OpenAPI**.

---

## 1. API Design Principles

- **Architecture:** RESTful API design.
- **Base URL:**
  - Local/Dev: `http://localhost:3001/api/v1`
  - Production: `https://api.freelancerhisab.com/api/v1`
- **Controller Setup:** All endpoints are mapped using NestJS controllers (`@Controller`) and documented with Swagger decorators (`@ApiTags`, `@ApiOperation`, `@ApiResponse`).
- **Response Structure:** A consistent envelope format is used for all responses to standardize client-side handling.
- **Authentication:** Protected routes require a valid JWT via the `Authorization: Bearer <token>` header, enforced by NestJS Guards.
- **Validation:** Global `ValidationPipe` using `class-validator` and `class-transformer`.
- **Versioning:** URL-based versioning (`/api/v1`).

---

## 2. Base Response Format

Every API response, whether successful or an error, follows this envelope structure:

```typescript
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  } | null;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### Example: Success (Paginated)
```json
{
  "success": true,
  "data": [{ "id": 1, "name": "Tech Corp" }],
  "error": null,
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

### Example: Validation Error (400 Bad Request)
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Input validation failed",
    "details": {
      "email": ["email must be an email"]
    }
  }
}
```

---

## 3. Auth Endpoints (`/api/v1/auth`)

### 3.1 Register User
- **Method & Route:** `POST /auth/register`
- **Description:** Registers a new freelancer account.
- **Auth:** Public

**Controller Signature:**
```typescript
@Post('register')
@ApiOperation({ summary: 'Register new user' })
@ApiResponse({ status: 201, description: 'User registered successfully' })
@ApiResponse({ status: 409, description: 'Email already exists' })
async register(@Body() registerDto: RegisterDto): Promise<ApiResponse<AuthResponse>>
```

**DTO:**
```typescript
export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}
```

**Response Interface:**
```typescript
export interface AuthResponse {
  user: { id: string; email: string; name: string };
  accessToken: string;
  refreshToken: string;
}
```

---

### 3.2 Login
- **Method & Route:** `POST /auth/login`
- **Description:** Authenticates user and returns tokens.

**Controller Signature:**
```typescript
@Post('login')
@UseGuards(LocalAuthGuard)
async login(@Body() loginDto: LoginDto): Promise<ApiResponse<AuthResponse>>
```

**DTO:**
```typescript
export class LoginDto {
  @IsEmail() email: string;
  @IsString() password: string;
}
```

---

### 3.3 Refresh Token
- **Method & Route:** `POST /auth/refresh`
- **Description:** Generates a new access token using a refresh token.

**DTO:**
```typescript
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
```

---

### 3.4 Google OAuth
- **Method & Route:** `POST /auth/google`
- **Description:** Authenticate via Google ID Token.

**DTO:**
```typescript
export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;
}
```

---

### 3.5 Get Current User
- **Method & Route:** `GET /auth/me`
- **Auth:** Bearer Token required.

**Controller Signature:**
```typescript
@Get('me')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
async getMe(@GetUser() user: User): Promise<ApiResponse<Partial<User>>>
```

---

### 3.6 Logout
- **Method & Route:** `POST /auth/logout`
- **Auth:** Bearer Token required.
- **Response:** `{ "success": true, "data": { "message": "Logged out" }, "error": null }`

---

## 4. Client Endpoints (`/api/v1/clients`)

### 4.1 List Clients
- **Method & Route:** `GET /clients`
- **Query Params:** `status`, `platform`, `search`, `page`, `limit`

**Controller Signature:**
```typescript
@Get()
@UseGuards(JwtAuthGuard)
async getClients(
  @Query() query: ClientQueryDto,
  @GetUser() user: User
): Promise<ApiResponse<Client[]>>
```

---

### 4.2 Get Client Details
- **Method & Route:** `GET /clients/:id`
- **Description:** Returns client info along with aggregate stats (total income, invoice count).

---

### 4.3 Create Client
- **Method & Route:** `POST /clients`

**DTO:**
```typescript
export class CreateClientDto {
  @IsString() @IsNotEmpty() name: string;
  @IsEmail() @IsOptional() email?: string;
  @IsEnum(ClientPlatform) platform: ClientPlatform;
  @IsString() @IsOptional() phone?: string;
  @IsString() @IsOptional() address?: string;
  @IsEnum(ClientStatus) @IsOptional() status?: ClientStatus;
}
```

---

### 4.4 Update Client
- **Method & Route:** `PATCH /clients/:id`
- **DTO:** `UpdateClientDto` (Partial of `CreateClientDto`)

---

### 4.5 Delete Client
- **Method & Route:** `DELETE /clients/:id`

---

## 5. Invoice Endpoints (`/api/v1/invoices`)

### 5.1 List Invoices
- **Method & Route:** `GET /invoices`
- **Query Params:** `status`, `clientId`, `fromDate`, `toDate`, `page`, `limit`

---

### 5.2 Get Invoice Detail
- **Method & Route:** `GET /invoices/:id`
- **Description:** Returns invoice, nested items, and client info.

---

### 5.3 Create Invoice
- **Method & Route:** `POST /invoices`

**DTO:**
```typescript
export class CreateInvoiceItemDto {
  @IsString() @IsNotEmpty() description: string;
  @IsNumber() @Min(1) quantity: number;
  @IsNumber() @Min(0) unitPrice: number;
}

export class CreateInvoiceDto {
  @IsUUID() clientId: string;
  @IsDateString() issueDate: string;
  @IsDateString() dueDate: string;
  @IsEnum(Currency) currency: Currency;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceItemDto)
  items: CreateInvoiceItemDto[];
  @IsString() @IsOptional() notes?: string;
}
```

---

### 5.4 Update Invoice
- **Method & Route:** `PATCH /invoices/:id`

### 5.5 Update Status
- **Method & Route:** `PATCH /invoices/:id/status`
- **DTO:** `{ "status": "PAID" }`

### 5.6 Download PDF
- **Method & Route:** `GET /invoices/:id/pdf`
- **Description:** Returns a binary stream (application/pdf).

### 5.7 Send Invoice via Email
- **Method & Route:** `POST /invoices/:id/send`
- **DTO:** `{ "email": "client@example.com" }` (optional override)

---

## 6. Income Endpoints (`/api/v1/income`)

- **GET /income** — Query: `clientId`, `platform`, `fromDate`, `toDate`, `page`, `limit`
- **POST /income** — `CreateIncomeDto`
- **PATCH /income/:id** — `UpdateIncomeDto`
- **DELETE /income/:id**

**CreateIncomeDto:**
```typescript
export class CreateIncomeDto {
  @IsNumber() @Min(0.01) amount: number;
  @IsDateString() date: string;
  @IsEnum(Platform) platform: Platform;
  @IsUUID() @IsOptional() clientId?: string;
  @IsUUID() @IsOptional() invoiceId?: string;
  @IsString() @IsOptional() description?: string;
}
```

---

## 7. Expense Endpoints (`/api/v1/expenses`)

- **GET /expenses** — Query: `category`, `fromDate`, `toDate`, `page`, `limit`
- **POST /expenses** — `CreateExpenseDto` (Supports `multipart/form-data` for receipt uploads via `@UseInterceptors(FileInterceptor('receipt'))`)
- **PATCH /expenses/:id** — `UpdateExpenseDto`
- **DELETE /expenses/:id**

**CreateExpenseDto:**
```typescript
export class CreateExpenseDto {
  @IsNumber() @Min(0.01) amount: number;
  @IsString() @IsNotEmpty() category: string;
  @IsDateString() date: string;
  @IsString() @IsOptional() description?: string;
}
```

---

## 8. Dashboard Endpoints (`/api/v1/dashboard`)

### 8.1 Dashboard Summary
- **Method & Route:** `GET /dashboard/summary`
- **Response:**
```json
{
  "success": true,
  "data": {
    "totalIncome": 150000,
    "totalExpenses": 25000,
    "netProfit": 125000,
    "pendingInvoices": 3,
    "pendingAmount": 45000,
    "monthlyGrowth": 12.5
  },
  "error": null
}
```

### 8.2 Recent Activity
- **Method & Route:** `GET /dashboard/recent-activity?limit=10`
- **Description:** Returns combined list of recent invoices, income, and expenses sorted by date descending.

---

## 9. Report Endpoints (`/api/v1/reports`)

- **GET /reports/income-vs-expenses** — Query: `period=monthly|quarterly|yearly`, `year=2026`
- **GET /reports/client-breakdown** — Query: `fromDate`, `toDate`
- **GET /reports/platform-breakdown** — Query: `fromDate`, `toDate`
- **GET /reports/monthly-summary** — Query: `year=2026`

---

## 10. Utility Endpoints (`/api/v1/utils`)

- **GET /utils/exchange-rates** — Query: `base=USD`, `target=PKR` (Fetches live or cached SBP/open market rates)
- **GET /utils/categories** — Returns predefined expense categories.

---

## 11. Configuration & Setup

### Swagger Configuration (`main.ts`)
```typescript
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('FreelancerHisab API')
    .setDescription('The API documentation for FreelancerHisab backend')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
    
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(3001);
}
bootstrap();
```

### Global Validation Pipe (`main.ts`)
```typescript
import { ValidationPipe } from '@nestjs/common';

// Inside bootstrap():
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true, // Automatically transform payloads to DTO instances
    exceptionFactory: (errors) => {
      // Custom format to match ApiResponse envelope
      const formattedErrors = errors.reduce((acc, err) => {
        acc[err.property] = Object.values(err.constraints || {});
        return acc;
      }, {});
      
      return new BadRequestException({
        code: 'VALIDATION_FAILED',
        message: 'Input validation failed',
        details: formattedErrors,
      });
    },
  }),
);
```

### JWT Auth Guard Setup
```typescript
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err, user, info) {
    if (err || !user) {
      throw err || new UnauthorizedException({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid authentication token'
      });
    }
    return user;
  }
}
```
