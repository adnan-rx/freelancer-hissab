# UX Wireframes & Design System: FreelancerHisab

## 1. Design System Tokens & Global Settings

**Theme**: Dark Mode Primary (Tailwind `dark` class default), Light mode toggle available.
**Typography**: Inter (English) & Noto Nastaliq Urdu (Urdu).
**Colors (Dark Mode)**:
- Background: `zinc-950`
- Surface: `zinc-900`
- Primary: `emerald-500` (Represents money/growth)
- Destructive: `red-500`
- Text: `zinc-100` (Primary), `zinc-400` (Secondary)
**Border Radius**: `0.5rem` (shadcn default `radius`)
**Spacing Scale**: Standard Tailwind (4, 8, 16, 24, 32px)

### Component Library Plan (shadcn/ui)
- **Forms**: `Form`, `Input`, `Select`, `DatePicker`, `Checkbox`
- **Layout**: `Card`, `Tabs`, `Table`, `ScrollArea`
- **Feedback**: `Toast`, `Dialog` (Modals), `Alert`, `Skeleton`
- **Navigation**: `DropdownMenu`, `Sheet` (Mobile Nav), `NavigationMenu`

### Animation/Motion Guide
- **Page Transitions**: Fade in `opacity-0` to `opacity-100` with 150ms duration.
- **Modals/Sheets**: Slide in from bottom (mobile) or right/center (desktop).
- **Hover States**: Subtle brightness increase `hover:bg-zinc-800/80`.

---

## 2. Text-Based Wireframes

### 2.1 Login / Register Page

```text
+---------------------------------------------------------+
|                        |                                |
|  [Logo]                |  Welcome back!                 |
|  FreelancerHisab       |  Manage your freelance money   |
|                        |                                |
|  "The operating        |  [ Google OAuth Button ]       |
|   system for Pakistani |  --------- OR ----------       |
|   freelancers."        |                                |
|                        |  Email: [____________]         |
|                        |  Pass:  [____________]         |
|                        |                                |
|                        |  [ Login Button (Emerald) ]    |
|                        |                                |
+---------------------------------------------------------+
(Desktop: Split 50/50. Mobile: Form only, logo on top)
```
**Interactive States**: Input focus rings (emerald), button hover state.

### 2.2 Dashboard

```text
+---------------------------------------------------------+
| [Menu] FreelancerHisab   [Search] [Light/Dark] [Avatar] |
+---------------------------------------------------------+
| Overview (PKR)                            [+ Quick Add] |
| +-------------+ +-------------+ +-------------+         |
| | Net Profit  | | Income      | | Expenses    |         |
| | Rs. 450,000 | | Rs. 500k    | | Rs. 50k     |         |
| | ^ 12% vs LM | |             | |             |         |
| +-------------+ +-------------+ +-------------+         |
|                                                         |
| [ Bar Chart: Income vs Expense last 6 months      ]     |
|                                                         |
| Recent Activity                                         |
| - Invoice #102 Sent to Upwork Client (Pending)          |
| - Payment Received: Rs. 150,000 (Fiverr)                |
| - Expense Added: Internet Bill Rs. 4,000                |
+---------------------------------------------------------+
(Mobile: Stack cards vertically, Quick Add is a FAB (Floating Action Button) fixed at bottom right)
```

### 2.3 Clients List

```text
+---------------------------------------------------------+
| Clients                                 [+ Add Client ] |
| [ Search clients... ] [ Filter: Platform v ]            |
|                                                         |
| +-------------------+  +-------------------+            |
| | John Doe (Upwork) |  | Tech Corp (Direct)|            |
| | LTV: Rs. 500,000  |  | LTV: Rs. 1,200,000|            |
| | Pending: Rs. 0    |  | Pending: Rs. 50k  |            |
| +-------------------+  +-------------------+            |
+---------------------------------------------------------+
```

### 2.4 Invoice Create / Edit

```text
+---------------------------------------------------------+
| < Back | Create Invoice                  [Save] [Send]  |
|                                                         |
| Client: [ Select Client v ]   Date: [ DD/MM/YYYY ]      |
| Currency: [ USD v ]           Rate: [ 278.50 ] PKR/USD  |
|                                                         |
| Line Items:                                             |
| 1. [ Web Development           ] [ 1 ] x [$500] = $500  |
| 2. [ UI/UX Design              ] [ 1 ] x [$200] = $200  |
| [+ Add Item]                                            |
|                                                         |
|                            Subtotal: $700               |
|                            Total (PKR est): Rs 194,950  |
+---------------------------------------------------------+
```

### 2.5 Add Income Modal

```text
+---------------------------------------------------------+
| Add Income Record                                   [x] |
|                                                         |
| Client / Source:  [ Select... v ]                       |
| Amount Received:  [ 500 ] [ USD v ]                     |
| Bank Deposit PKR: [ 138,500 ] (Actual PKR credited)     |
| Category:         [ Web Dev v ]                         |
| Date:             [ Today v ]                           |
| Notes:            [ Bank fee deducted $5... ]           |
|                                                         |
|                        [ Cancel ] [ Save Income ]       |
+---------------------------------------------------------+
```
**Accessibility**: All form fields must have `<Label>` elements. Escape key closes modal. Focus traps inside modal.

### 2.6 Settings Page

```text
+---------------------------------------------------------+
| Settings                                                |
|                                                         |
| [ Profile ] [ Business Info ] [ Preferences ]           |
|                                                         |
| Business Name: [ Freelancer Studios ]                   |
| Tax/NTN No:    [ 1234567-8 ]                            |
| Address:       [ Lahore, Pakistan ]                     |
|                                                         |
| Default Currency: [ PKR v ]                             |
| Secondary:        [ USD, GBP ]                          |
|                                                         |
| [ Save Changes ]                                        |
+---------------------------------------------------------+
```
