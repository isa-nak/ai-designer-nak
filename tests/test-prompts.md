# Design Generation Test Prompts

Use these prompts to evaluate the quality of generated designs. Rate each output on:
- **Layout**: Proper structure, spacing, alignment
- **Completeness**: All requested elements present
- **Visual Quality**: Colors, typography, hierarchy
- **Responsiveness**: Appropriate for selected viewport

---

## Basic Screens

### 1. Login Screen
```
Create a login screen with email and password fields, forgot password link, and login button
```
**Expected**: Email input, password input, "Forgot password?" link, primary login button, possibly a signup link

### 2. Settings Page
```
Create a settings page with profile section, notification toggles, and logout button
```
**Expected**: User profile area at top, labeled toggle switches, danger-styled logout button at bottom

### 3. Product Card
```
Create a product card with image placeholder, product name, price, and add to cart button
```
**Expected**: Image area, title text, price styling, CTA button

---

## Complex Screens

### 4. Dashboard
```
Create a dashboard with welcome header, 3 stat cards showing numbers, and a recent activity list
```
**Expected**: Greeting with user name placeholder, stat cards with labels and values, list of activity items

### 5. Profile Page
```
Create a user profile page with avatar, name, bio, stats (followers, following, posts), and edit profile button
```
**Expected**: Circular avatar area, name/username, bio text, horizontal stats row, edit button

### 6. Checkout Flow
```
Create a checkout page with order summary, shipping address form, and payment section
```
**Expected**: Item list with prices, address input fields, payment method selection, total and submit button

---

## Mobile-Specific

### 7. Bottom Navigation
```
Create a mobile app home screen with bottom navigation (home, search, notifications, profile)
```
**Expected**: Content area, fixed bottom nav with 4 icons/labels

### 8. Onboarding Screen
```
Create an onboarding screen with illustration placeholder, headline, description, and next button
```
**Expected**: Large image area, bold headline, supporting text, prominent button

### 9. Empty State
```
Create an empty state for a shopping cart with illustration, message, and shop now button
```
**Expected**: Centered layout, illustration, friendly message, CTA button

---

## Form-Heavy

### 10. Registration Form
```
Create a registration form with first name, last name, email, password, confirm password, and terms checkbox
```
**Expected**: All input fields with proper labels, checkbox with link, submit button

### 11. Contact Form
```
Create a contact page with name, email, subject dropdown, message textarea, and send button
```
**Expected**: Text inputs, select/dropdown, multiline textarea, submit button

### 12. Search with Filters
```
Create a search results page with search bar, filter chips, and result cards
```
**Expected**: Search input at top, horizontal scrollable filters, list of result items

---

## Evaluation Criteria

### Layout Score (1-5)
- 1: Broken layout, overlapping elements
- 2: Basic structure but poor spacing
- 3: Acceptable layout, minor issues
- 4: Good layout with proper hierarchy
- 5: Excellent, professional layout

### Completeness Score (1-5)
- 1: Missing most requested elements
- 2: Missing several key elements
- 3: Has main elements, missing details
- 4: All requested elements present
- 5: All elements plus smart additions

### Visual Quality Score (1-5)
- 1: No styling, raw elements
- 2: Basic styling, poor colors
- 3: Decent styling, acceptable colors
- 4: Good visual design
- 5: Polished, production-ready look

---

## Notes

- Test each prompt on all three viewports (Mobile, Tablet, Desktop)
- Compare results between Claude and OpenAI
- Test with and without design system context
- Test with custom color palette vs defaults
